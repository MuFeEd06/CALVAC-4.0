"""
GET /api/site-settings  — public, returns site settings
Data is stored in site_settings.data (jsonb column)
"""
import os, json
from http.server import BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError

def _sb_url(): return os.environ.get("SUPABASE_URL","").rstrip("/")
def _sb_key(): return os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY","")
def _sb_headers():
    k = _sb_key()
    return {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json"}

def _cors(o="*"):
    return {"Access-Control-Allow-Origin": o,
            "Access-Control-Allow-Methods": "GET,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Content-Type": "application/json"}

def _ok_origin(h):
    o = h.get("Origin","")
    return o if o in {"https://calvac.in","https://calvac-4-0.vercel.app",
                      "https://www.calvac.in","http://localhost:5173"} else "*"

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        o = _ok_origin(self.headers); self.send_response(204)
        for k,v in _cors(o).items(): self.send_header(k,v)
        self.end_headers()

    def do_GET(self):
        o = _ok_origin(self.headers); h = _cors(o)
        try:
            req = Request(
                f"{_sb_url()}/rest/v1/site_settings?select=data&limit=1",
                headers=_sb_headers()
            )
            with urlopen(req, timeout=10) as r:
                rows = json.loads(r.read())
                # Return the data jsonb column, or {} if empty
                data = rows[0].get("data") or {} if rows else {}
                self._send(200, data, h)
        except HTTPError:
            self._send(200, {}, h)
        except Exception as e:
            self._send(200, {}, h)

    def _send(self, s, body, h):
        b = json.dumps(body).encode()
        self.send_response(s)
        for k,v in h.items(): self.send_header(k,v)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
