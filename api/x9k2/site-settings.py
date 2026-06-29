from http.server import BaseHTTPRequestHandler

from api._lib.auth import require_admin
from api._lib.cors import handle_options, require_cors
from api._lib.http import read_json, send_error, send_json
from api._lib.rate_limit import require_rate_limit
from api._lib.supabase import rest_request
from api._lib.validation import normalize_settings_response, sanitize_settings_payload


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, "GET,POST,OPTIONS")

    def do_GET(self):
        cors = None
        try:
            cors = require_cors(self, "GET,POST,OPTIONS")
            require_rate_limit(self, "admin-read")
            require_admin(self.headers)
            rows = rest_request("GET", "site_settings?select=data&limit=1")
            data = (rows[0].get("data") or {}) if rows else {}
            send_json(self, 200, normalize_settings_response(data), cors, {"Cache-Control": "no-store"})
        except Exception as exc:
            send_error(self, exc, cors)

    def do_POST(self):
        cors = None
        try:
            cors = require_cors(self, "GET,POST,OPTIONS")
            require_rate_limit(self, "admin-write")
            require_admin(self.headers)
            rows = rest_request("GET", "site_settings?select=id,data&limit=1")
            existing = normalize_settings_response((rows[0].get("data") or {}) if rows else {})
            body = sanitize_settings_payload(read_json(self, 128 * 1024), existing)
            merged = {**existing, **body}
            merged.pop("primary_color", None)
            if rows:
                row_id = rows[0]["id"]
                rest_request("PATCH", f"site_settings?id=eq.{row_id}", {"data": merged}, "return=minimal", timeout=15)
            else:
                rest_request("POST", "site_settings", {"data": merged}, "return=minimal", timeout=15)
            send_json(
                self,
                200,
                {"success": True, "settings": normalize_settings_response(merged)},
                cors,
                {"Cache-Control": "no-store"},
            )
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
