import os, json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, quote
from urllib.request import Request, urlopen

def _sb_url(): return os.environ.get("SUPABASE_URL","").rstrip("/")
def _sb_key(): return os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY","")
def _sb_headers():
    k = _sb_key()
    return {"apikey":k,"Authorization":f"Bearer {k}","Content-Type":"application/json"}
def _sb_get(path):
    with urlopen(Request(f"{_sb_url()}/rest/v1/{path}",headers=_sb_headers()),timeout=10) as r:
        return json.loads(r.read())
def _cors(o="*"):
    return {"Access-Control-Allow-Origin":o,"Access-Control-Allow-Methods":"GET,OPTIONS",
            "Access-Control-Allow-Headers":"Content-Type,Authorization","Content-Type":"application/json"}
def _ok_origin(h):
    o=h.get("Origin","")
    return o if o in {"https://calvac.in","https://calvac-4-0.vercel.app","http://localhost:5173"} else "*"

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        o=_ok_origin(self.headers); self.send_response(204)
        for k,v in _cors(o).items(): self.send_header(k,v)
        self.end_headers()
    def do_GET(self):
        o=_ok_origin(self.headers); h=_cors(o)
        try:
            qs=parse_qs(urlparse(self.path).query)
            q=(qs.get("q",[""])[0]).strip()[:100]
            if not q: self._send(200,b"[]",h); return
            enc=quote(q)
            data=_sb_get(f"products?select=*&or=(name.ilike.*{enc}*,brand.ilike.*{enc}*)&limit=20")
            self._send(200,json.dumps(data).encode(),h)
        except Exception as e:
            self._send(500,json.dumps({"error":str(e)}).encode(),h)
    def _send(self,s,b,h):
        self.send_response(s)
        for k,v in h.items(): self.send_header(k,v)
        self.send_header("Content-Length",str(len(b))); self.end_headers(); self.wfile.write(b)
    def log_message(self,*a): pass
