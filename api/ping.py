import os, json
from http.server import BaseHTTPRequestHandler

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        body = json.dumps({
            "ok": True,
            "env": {
                "has_supabase_url": bool(os.environ.get("SUPABASE_URL")),
                "has_supabase_key": bool(os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY")),
                "has_vite_supa_url": bool(os.environ.get("VITE_SUPABASE_URL")),
            }
        }).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)
    def log_message(self, *a): pass
