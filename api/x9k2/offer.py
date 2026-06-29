from http.server import BaseHTTPRequestHandler

from api._lib.auth import require_admin
from api._lib.cors import handle_options, require_cors
from api._lib.http import read_json, send_error, send_json
from api._lib.rate_limit import require_rate_limit
from api._lib.supabase import rest_request
from api._lib.validation import clean_str


def _clean_offer(body):
    if not isinstance(body, dict):
        return {}
    return {
        "active": bool(body.get("active")),
        "text": clean_str(body.get("text", ""), 300),
        "bg_color": clean_str(body.get("bg_color", "#FF6B35"), 20),
        "text_color": clean_str(body.get("text_color", "#ffffff"), 20),
        "show_logo": body.get("show_logo") is not False,
    }


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, "GET,POST,OPTIONS")

    def do_GET(self):
        cors = None
        try:
            cors = require_cors(self, "GET,POST,OPTIONS")
            require_rate_limit(self, "admin-read")
            require_admin(self.headers)
            data = rest_request("GET", "offer?select=*&limit=1")
            send_json(self, 200, data[0] if data else {}, cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def do_POST(self):
        cors = None
        try:
            cors = require_cors(self, "GET,POST,OPTIONS")
            require_rate_limit(self, "admin-write")
            require_admin(self.headers)
            body = _clean_offer(read_json(self, 16 * 1024))
            existing = rest_request("GET", "offer?select=id&limit=1")
            if existing:
                rest_request("PATCH", f"offer?id=eq.{existing[0]['id']}", body)
            else:
                rest_request("POST", "offer", body)
            send_json(self, 200, {"success": True}, cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
