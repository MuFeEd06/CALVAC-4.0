"""
GET /api/products       -> list all products
GET /api/products?id=X  -> single product

Handles Supabase returning:
- sizes as TEXT array: '{UK 6,UK 7}' (PostgreSQL array literal)
- sizes as JSON string: '["UK 6","UK 7"]'
- sizes as native array: ["UK 6","UK 7"]
- stock as TEXT: '{"default|UK 6": 10}'
"""
import os, json, re
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen
from urllib.error import HTTPError

def _sb_url(): return os.environ.get("SUPABASE_URL","").rstrip("/")
def _sb_key(): return os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY","")
def _sb_headers():
    k = _sb_key()
    return {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json"}

def _sb_get(path):
    with urlopen(Request(f"{_sb_url()}/rest/v1/{path}", headers=_sb_headers()), timeout=10) as r:
        return json.loads(r.read())

def _parse_array(val):
    """Parse sizes/colors that may be stored as:
    - None / null
    - Python list (already parsed by Supabase)
    - JSON string: '["UK 6","UK 7"]'
    - PostgreSQL array literal: '{UK 6,UK 7}' or '{"UK 6","UK 7"}'
    """
    if val is None: return []
    if isinstance(val, list): return val
    if not isinstance(val, str): return []
    val = val.strip()
    if not val: return []
    # JSON array
    if val.startswith('['):
        try: return json.loads(val)
        except: return []
    # PostgreSQL array literal {a,b,c} or {"a","b"}
    if val.startswith('{') and val.endswith('}'):
        inner = val[1:-1]
        # Split on commas not inside quotes
        items = []
        for item in re.split(r',(?=(?:[^"]*"[^"]*")*[^"]*$)', inner):
            item = item.strip().strip('"')
            if item: items.append(item)
        return items
    return []

def _parse_obj(val):
    """Parse stock/dict fields."""
    if val is None: return {}
    if isinstance(val, dict): return val
    if not isinstance(val, str): return {}
    try: return json.loads(val)
    except: return {}

def _fix(p):
    return {
        "id":             p.get("id"),
        "name":           str(p.get("name") or ""),
        "brand":          str(p.get("brand") or ""),
        "price":          float(p.get("price") or 0),
        "original_price": float(p["original_price"]) if p.get("original_price") else None,
        "image":          str(p.get("image") or ""),
        "tag":            p.get("tag") or "",
        "category":       p.get("category") or "",
        "sizes":          _parse_array(p.get("sizes")),
        "colors":         _parse_array(p.get("colors")),
        "stock":          _parse_obj(p.get("stock")),
        "specs":          str(p.get("specs") or ""),
        "out_of_stock":   bool(p.get("out_of_stock")),
        "total_stock":    p.get("total_stock"),
    }

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
            qs = parse_qs(urlparse(self.path).query)
            if "id" in qs:
                pid  = qs["id"][0]
                data = _sb_get(f"products?id=eq.{pid}&limit=1")
                body = json.dumps(_fix(data[0]) if data else {}).encode()
            else:
                data = _sb_get("products?select=*&order=id&limit=500")
                body = json.dumps([_fix(p) for p in data]).encode()
            self._send(200, body, h)
        except HTTPError as e:
            self._send(500, json.dumps({"error": e.read().decode()}).encode(), h)
        except Exception as e:
            self._send(500, json.dumps({"error": str(e)}).encode(), h)

    def _send(self, s, b, h):
        self.send_response(s)
        for k,v in h.items(): self.send_header(k,v)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
