import re
from http.server import BaseHTTPRequestHandler
from api._lib._cors import handle_options, require_cors
from api._lib._rate_limit import require_rate_limit
from api._lib._responses import ApiError, read_json, send_error, send_json
from api._lib._supabase import rest_request
from api._lib._validation import validate_order_payload
from api._lib._auth import authenticate
from api._lib._checkout import require_method, public_order


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, 'POST,OPTIONS')

    def do_POST(self):
        cors = None
        try:
            cors = require_cors(self, 'POST,OPTIONS')
            body = read_json(self, 64 * 1024)
            items, customer = validate_order_payload(body)
            key = self.headers.get('Idempotency-Key', '')
            if not re.fullmatch(r'[A-Za-z0-9_-]{16,128}', key):
                raise ApiError(400, 'A valid Idempotency-Key header is required')
            require_rate_limit(self, 'order-create')
            method = body['paymentMethod']
            user = authenticate(self.headers) if self.headers.get('Authorization') else None
            if method == 'razorpay' and (not user or user.get('is_anonymous')):
                raise ApiError(401, 'Sign in required for online payment')
            require_method(method)
            # Commit expired reservation cleanup separately from the new stock locks.
            rest_request('POST', 'rpc/expire_unpaid_orders', {}, timeout=10)
            created = rest_request('POST', 'rpc/create_order_with_stock_v3',
                {'p_items': items, 'p_customer': customer, 'p_idempotency_key': key,
                 'p_payment_method': method, 'p_user_id': user['id'] if user else None}, timeout=20)
            order = created[0] if isinstance(created, list) and created else created
            if not isinstance(order, dict) or not order.get('id') or not isinstance(order.get('items'), list):
                raise ApiError(502, 'Order confirmation unavailable. Retry the same order.')
            safe = public_order(order)
            safe['customer'] = customer
            send_json(self, 200, {'success': True, 'order': safe}, cors)
        except Exception as error:
            send_error(self, error, cors)

    def log_message(self, *args): pass
