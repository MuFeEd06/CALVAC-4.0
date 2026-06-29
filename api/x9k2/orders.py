import json
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, quote, urlparse

from api._lib.auth import require_admin
from api._lib.cors import handle_options, require_cors
from api._lib.http import ApiError, read_json, send_error, send_json
from api._lib.rate_limit import require_rate_limit
from api._lib.supabase import rest_request
from api._lib.validation import clean_str


STATUSES = {"Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"}


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, "GET,PATCH,OPTIONS")

    def do_GET(self):
        cors = None
        try:
            cors = require_cors(self, "GET,PATCH,OPTIONS")
            require_rate_limit(self, "admin-read")
            require_admin(self.headers)
            data = rest_request("GET", "orders?select=*&order=created_at.desc")
            send_json(self, 200, data if isinstance(data, list) else [], cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def do_PATCH(self):
        cors = None
        try:
            cors = require_cors(self, "GET,PATCH,OPTIONS")
            require_rate_limit(self, "admin-write")
            require_admin(self.headers)
            qs = parse_qs(urlparse(self.path).query)
            oid = quote(qs.get("id", [""])[0], safe="")
            action = qs.get("action", ["status"])[0]
            if not oid:
                raise ApiError(400, "Missing order ID")
            body = read_json(self, 16 * 1024)
            if action == "status":
                status = clean_str(body.get("status"), 40)
                if status not in STATUSES:
                    raise ApiError(400, "Invalid order status")
                patch = {"status": status}
            elif action == "notes":
                patch = {"notes": clean_str(body.get("notes", ""), 1000)}
            else:
                raise ApiError(400, "Invalid order action")
            rest_request("PATCH", f"orders?id=eq.{oid}", patch)
            send_json(self, 200, {"success": True}, cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
