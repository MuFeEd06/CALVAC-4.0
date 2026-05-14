"""
GET /api/search?q=<query>
Rate-limited: max 30 requests per minute per IP
"""
import os, json, time
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs, quote
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from collections import defaultdict

# Simple in-memory rate limit: {ip: [timestamps]}
_rate: dict = defaultdict(list)
RATE_MAX    = 30   # requests
RATE_WINDOW = 60   # seconds

def _check_rate(ip: str) -> bool:
    now  = time.time()
    hits = [t for t in _rate[ip] if now - t < RATE_WINDOW]
    _rate[ip] = hits
    if len(hits) >= RATE_MAX: return False
    _rate[ip].append(now)
    return True

def _sb_url(): return os.environ.get("SUPABASE_URL","").rstrip("/")
def _sb_key(): return os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY","")
def _sb_headers():
    k=_sb_key()
    return {"apikey":k,"Authorization":f"Bearer {k}","Content-Type":"application/json"}
def _cors(o="*"):
    return {"Access-Control-Allow-Origin":o,"Access-Control-Allow-Methods":"GET,OPTIONS",
            "Access-Control-Allow-Headers":"Content-Type,Authorization","Content-Type":"application/json"}
def _ok_origin(h):
    o=h.get("Origin","")
    return o if o in {"https://calvac.in","https://calvac-4-0.vercel.app",
                      "https://www.calvac.in","http://localhost:5173"} else "*"

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        o=_ok_origin(self.headers); self.send_response(204)
        for k,v in _cors(o).items(): self.send_header(k,v)
        self.end_headers()

    def do_GET(self):
        o=_ok_origin(self.headers); h=_cors(o)
        # Rate limit by IP
        ip = self.headers.get("X-Forwarded-For","127.0.0.1").split(",")[0].strip()
        if not _check_rate(ip):
            self._send(429, json.dumps({"error":"Rate limit exceeded"}).encode(), h); return
        try:
            qs  = parse_qs(urlparse(self.path).query)
            q   = (qs.get("q",[""])[0]).strip()[:100]
            # Strip HTML/script tags from query
            q   = __import__('re').sub(r'<[^>]+>','',q).strip()
            if not q or len(q) < 2:
                self._send(200,b"[]",h); return
            enc = quote(q)
            req = Request(
                f"{_sb_url()}/rest/v1/products?select=*&or=(name.ilike.*{enc}*,brand.ilike.*{enc}*)&limit=20",
                headers=_sb_headers()
            )
            with urlopen(req,timeout=10) as r:
                self._send(200,r.read(),h)
        except HTTPError as e:
            self._send(500,json.dumps({"error":e.read().decode()}).encode(),h)
        except Exception as e:
            self._send(500,json.dumps({"error":str(e)}).encode(),h)

    def _send(self,s,b,h):
        self.send_response(s)
        for k,v in h.items(): self.send_header(k,v)
        self.send_header("Content-Length",str(len(b))); self.end_headers(); self.wfile.write(b)
    def log_message(self,*a): pass
