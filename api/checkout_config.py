from http.server import BaseHTTPRequestHandler
from api._lib._checkout import payment_methods
from api._lib._cors import handle_options, require_cors
from api._lib._responses import send_json, send_error


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self): handle_options(self, 'GET,OPTIONS')
    def do_GET(self):
        cors = None
        try:
            cors = require_cors(self, 'GET,OPTIONS')
            send_json(self, 200, {'methods': payment_methods()}, cors)
        except Exception as error: send_error(self, error, cors)
    def log_message(self, *args): pass
