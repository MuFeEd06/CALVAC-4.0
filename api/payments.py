import hashlib
import json
import os
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

from api._lib._auth import authenticate
from api._lib._checkout import require_method, gateway_ready
from api._lib._cors import handle_options, require_cors
from api._lib._rate_limit import require_rate_limit
from api._lib._razorpay import gateway_request, signature_valid
from api._lib._responses import ApiError, read_json, send_json, send_error
from api._lib._supabase import rest_request


def owned_order(order_id, user_id):
    if not re.fullmatch(r'[1-9][0-9]{0,18}', str(order_id)): raise ApiError(400, 'Invalid order ID')
    rows = rest_request('GET', f'orders?select=id,total,status,payment_method,payment_status,razorpay_order_id,razorpay_payment_id&user_id=eq.{user_id}&id=eq.{order_id}&limit=1')
    if not rows: raise ApiError(404, 'Order not found')
    order = rows[0]
    if order['payment_method'] != 'razorpay': raise ApiError(400, 'This order does not use online payment')
    return order


def webhook(handler):
    secret = os.environ.get('RAZORPAY_WEBHOOK_SECRET')
    if not secret: raise ApiError(503, 'Payment webhook is not configured')
    try: length = int(handler.headers.get('Content-Length', '0'))
    except ValueError: raise ApiError(400, 'Invalid webhook length')
    if length <= 0 or length > 256 * 1024: raise ApiError(413, 'Invalid webhook size')
    raw = handler.rfile.read(length)
    if not signature_valid(raw, handler.headers.get('X-Razorpay-Signature', ''), secret):
        raise ApiError(400, 'Invalid webhook signature')
    try: payload = json.loads(raw)
    except ValueError: raise ApiError(400, 'Invalid webhook body')
    if not isinstance(payload, dict): raise ApiError(400, 'Invalid webhook body')
    event_id = handler.headers.get('X-Razorpay-Event-Id', '').strip() or hashlib.sha256(raw).hexdigest()
    if len(event_id) > 200: raise ApiError(400, 'Invalid webhook event')
    # Event deduplication and the order update commit in the same SQL transaction.
    result = rest_request('POST', 'rpc/process_razorpay_event', {'p_event_id': event_id, 'p_payload': payload}, timeout=20)
    send_json(handler, 200, result)


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self): handle_options(self, 'POST,OPTIONS')

    def do_POST(self):
        cors = None
        try:
            action = parse_qs(urlparse(self.path).query).get('action', [''])[0] or urlparse(self.path).path.rsplit('/', 1)[-1]
            if action == 'webhook': return webhook(self)
            cors = require_cors(self, 'POST,OPTIONS')
            require_rate_limit(self, 'payment')
            user = authenticate(self.headers)
            body = read_json(self, 16 * 1024)
            order_id = body.get('orderId')
            order = owned_order(order_id, user['id'])
            if action == 'create-order':
                require_method('razorpay')
                claim = rest_request('POST', 'rpc/claim_razorpay_order', {'p_order_id': order_id, 'p_user_id': user['id']})
                if claim.get('action') == 'create':
                    result = gateway_request('orders', {'amount': claim['amount'], 'currency': 'INR',
                        'receipt': f'calvac-{order_id}', 'partial_payment': False,
                        'notes': {'store': 'calvac-footwear', 'local_order_id': str(order_id)}})
                    if result.get('amount') != claim['amount'] or result.get('currency') != 'INR' or not re.fullmatch(r'order_[A-Za-z0-9]+', str(result.get('id', ''))):
                        raise ApiError(502, 'Invalid payment provider response')
                    claim = rest_request('POST', 'rpc/bind_razorpay_order', {'p_order_id': order_id, 'p_user_id': user['id'],
                        'p_token': claim['token'], 'p_provider_order_id': result['id']})
                send_json(self, 200, {'id': claim['provider_order_id'], 'amount': claim['amount'], 'currency': 'INR',
                    'keyId': os.environ.get('RAZORPAY_KEY_ID')}, cors)
            elif action == 'verify':
                provider_id, payment_id = order.get('razorpay_order_id'), body.get('razorpay_payment_id')
                if not provider_id or body.get('razorpay_order_id') != provider_id or not re.fullmatch(r'pay_[A-Za-z0-9]+', str(payment_id or '')):
                    raise ApiError(400, 'Order does not match this payment')
                if not signature_valid(f'{provider_id}|{payment_id}'.encode(), body.get('razorpay_signature'), os.environ.get('RAZORPAY_KEY_SECRET')):
                    raise ApiError(400, 'Invalid payment signature')
                # A valid browser signature does not authorize marking the order paid.
                send_json(self, 200, {'success': True, 'payment_status': order['payment_status'],
                    'message': 'Payment submitted. Confirmation is pending from the payment provider.'}, cors)
            else: raise ApiError(404, 'Payment route not found')
        except Exception as error: send_error(self, error, cors)

    def log_message(self, *args): pass
