import os, json
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen

def _sb_url(): return os.environ.get("SUPABASE_URL","").rstrip("/")
def _sb_key(): return os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY","")
def _sb_headers():
    k=_sb_key()
    return {"apikey":k,"Authorization":f"Bearer {k}","Content-Type":"application/json"}
def _sb_get(path):
    with urlopen(Request(f"{_sb_url()}/rest/v1/{path}",headers=_sb_headers()),timeout=10) as r:
        return json.loads(r.read())

def _parse_json_field(val, default):
    """Handle fields that might be stored as JSON strings instead of native JSON."""
    if val is None: return default
    if isinstance(val, (list, dict)): return val
    if isinstance(val, str):
        try: return json.loads(val)
        except: return default
    return default

def _fix(p):
    return {
        "id":             p.get("id"),
        "name":           str(p.get("name") or ""),
        "brand":          str(p.get("brand") or ""),
        "price":          float(p.get("price") or 0),
        "original_price": float(p["original_price"]) if p.get("original_price") else None,
        "image":          str(p.get("image") or ""),
        "tag":            p.get("tag"),
        "category":       p.get("category"),
        # Handle JSON strings — SQLAlchemy sometimes stores arrays as text
        "sizes":          _parse_json_field(p.get("sizes"), []),
        "colors":         _parse_json_field(p.get("colors"), []),
        "stock":          _parse_json_field(p.get("stock"), {}),
        "specs":          p.get("specs"),
        "out_of_stock":   bool(p.get("out_of_stock")),
        "total_stock":    p.get("total_stock"),
    }

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
        try:
            qs=parse_qs(urlparse(self.path).query)
            if "id" in qs:
                pid=qs["id"][0]
                data=_sb_get(f"products?id=eq.{pid}&limit=1")
                body=json.dumps(_fix(data[0]) if data else {}).encode()
            else:
                data=_sb_get("products?select=*&order=id")
                body=json.dumps([_fix(p) for p in data]).encode()
            self._send(200,body,h)
        except Exception as e:
            self._send(500,json.dumps({"error":str(e)}).encode(),h)
    def _send(self,s,b,h):
        self.send_response(s)
        for k,v in h.items(): self.send_header(k,v)
        self.send_header("Content-Length",str(len(b))); self.end_headers(); self.wfile.write(b)
    def log_message(self,*a): pass
