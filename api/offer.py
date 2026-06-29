from http.server import BaseHTTPRequestHandler

from api._lib.cors import handle_options, require_cors
from api._lib.http import send_error, send_json
from api._lib.supabase import public_rest_request


DEFAULT = {"active": False, "text": "", "bg_color": "#FF6B35", "text_color": "#ffffff", "show_logo": True}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, "GET,OPTIONS", "Content-Type")

    def do_GET(self):
        cors = None
        try:
            cors = require_cors(self, "GET,OPTIONS", "Content-Type")
            data = public_rest_request("GET", "offer?select=active,text,bg_color,text_color,show_logo&limit=1")
            send_json(self, 200, data[0] if data else DEFAULT, cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
