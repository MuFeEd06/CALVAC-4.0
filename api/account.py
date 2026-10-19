from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, urlparse, quote

from api._lib._auth import authenticate
from api._lib._checkout import public_order
from api._lib._cors import handle_options, require_cors
from api._lib._pagination import page_options, page_response
from api._lib._rate_limit import require_rate_limit
from api._lib._responses import ApiError, read_json, send_json, send_error
from api._lib._supabase import rest_request
from api._lib._validation import clean_str, validate_customer


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self): handle_options(self, 'GET,POST,OPTIONS')

    def do_GET(self):
        cors = None
        try:
            cors = require_cors(self, 'GET,POST,OPTIONS')
            require_rate_limit(self, 'account-read')
            user = authenticate(self.headers)
            uid = quote(user['id'], safe='')
            query = parse_qs(urlparse(self.path).query)
            if query.get('resource', [''])[0] == 'orders':
                limit, cursor = page_options(query, 20)
                path = f'orders?select=id,total,status,items,payment_method,payment_status,created_at,payment_expires_at&user_id=eq.{uid}&order=id.desc&limit={limit + 1}'
                if cursor: path += '&id=lt.' + cursor
                if query.get('id'):
                    order_id = query['id'][0]
                    if not order_id.isdigit() or len(order_id) > 19: raise ApiError(400, 'Invalid order ID')
                    path += '&id=eq.' + order_id
                rows = rest_request('GET', path)
                send_json(self, 200, page_response([public_order(row) for row in rows], limit), cors)
            else:
                rows = rest_request('GET', f'profiles?select=full_name,phone,address&id=eq.{uid}&limit=1')
                profile = rows[0] if rows else {'full_name': (user.get('user_metadata') or {}).get('full_name',''), 'phone': '', 'address': None}
                send_json(self, 200, {'user': {'id': user['id'], 'email': user.get('email')}, 'profile': profile}, cors)
        except Exception as error: send_error(self, error, cors)

    def do_POST(self):
        cors = None
        try:
            cors = require_cors(self, 'GET,POST,OPTIONS')
            require_rate_limit(self, 'account-write')
            user = authenticate(self.headers)
            body = read_json(self, 16 * 1024)
            if body.get('action') == 'cancel-unpaid':
                order_id = str(body.get('orderId') or '')
                if not order_id.isdigit() or len(order_id)>19: raise ApiError(400, 'Invalid order ID')
                rest_request('POST','rpc/cancel_own_unpaid_order',{'p_order_id':order_id,'p_user_id':user['id']})
                send_json(self,200,{'success':True},cors)
                return
            address = body.get('address')
            if address is not None:
                address = validate_customer(address)
            profile = {'id': user['id'], 'full_name': clean_str(body.get('full_name'), 100),
                'phone': clean_str(address.get('phone') if address else body.get('phone'), 15), 'address': address}
            # Identity is derived exclusively from the verified access token.
            rest_request('POST', 'profiles?on_conflict=id', profile, prefer='resolution=merge-duplicates,return=minimal')
            send_json(self, 200, {'success': True}, cors)
        except Exception as error: send_error(self, error, cors)

    def log_message(self, *args): pass
