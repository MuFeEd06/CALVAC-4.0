from http.server import BaseHTTPRequestHandler

from api._lib.cors import handle_options, require_cors
from api._lib.http import send_error, send_json
from api._lib.supabase import public_rest_request
from api._lib.validation import normalize_settings_response


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, "GET,OPTIONS", "Content-Type")

    def do_GET(self):
        cors = None
        try:
            cors = require_cors(self, "GET,OPTIONS", "Content-Type")
            rows = public_rest_request("GET", "site_settings?select=data&limit=1")
            data = rows[0].get("data") or {} if rows else {}
            send_json(self, 200, normalize_settings_response(data), cors, {"Cache-Control": "no-store"})
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
