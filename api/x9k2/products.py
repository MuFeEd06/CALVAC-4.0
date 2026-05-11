import os, json, re, base64, time
from http.server import BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs
from urllib.request import Request, urlopen
from urllib.error import HTTPError

def _sb_url(): return os.environ.get("SUPABASE_URL","").rstrip("/")
def _sb_key(): return os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY","")

def _headers(prefer=None):
    k = _sb_key()
    h = {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json"}
    if prefer: h["Prefer"] = prefer
    return h

def _parse_array(val):
    if val is None: return []
    if isinstance(val, list): return val
    if not isinstance(val, str) or not val.strip(): return []
    val = val.strip()
    if val.startswith('['):
        try: return json.loads(val)
        except: return []
    if val.startswith('{') and val.endswith('}'):
        inner = val[1:-1]
        items = []
        for item in re.split(r',(?=(?:[^"]*"[^"]*")*[^"]*$)', inner):
            item = item.strip().strip('"')
            if item: items.append(item)
        return items
    return []

def _parse_obj(val):
    if val is None: return {}
    if isinstance(val, dict): return val
    if not isinstance(val, str): return {}
    try: return json.loads(val)
    except: return {}

def _fix(p):
    return {**p,
            "sizes":  _parse_array(p.get("sizes")),
            "colors": _parse_array(p.get("colors")),
            "stock":  _parse_obj(p.get("stock"))}

def _cors(o="*"):
    return {"Access-Control-Allow-Origin": o,
            "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "application/json"}

def _ok_origin(h):
    o = h.get("Origin","")
    return o if o in {"https://calvac.in","https://calvac-4-0.vercel.app",
                      "https://www.calvac.in","http://localhost:5173"} else "*"

def _auth(h):
    a = h.get("Authorization","")
    if not a.startswith("Bearer "): return False
    try:
        token = a.split(" ",1)[1]; parts = token.split(".")
        if len(parts) != 3: return False
        pad = parts[1] + "=" * (-len(parts[1]) % 4)
        p   = json.loads(base64.urlsafe_b64decode(pad))
        if p.get("iss") != f"{_sb_url()}/auth/v1": return False
        if p.get("exp",0) < time.time(): return False
        return bool(p.get("sub"))
    except: return False

def _req(method, path, body=None, prefer=None):
    data = json.dumps(body).encode() if body is not None else None
    req  = Request(f"{_sb_url()}/rest/v1/{path}",
                   data=data, headers=_headers(prefer), method=method)
    with urlopen(req, timeout=10) as r:
        raw = r.read()
        return json.loads(raw) if raw.strip() else {}

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        o = _ok_origin(self.headers); self.send_response(204)
        for k,v in _cors(o).items(): self.send_header(k,v)
        self.end_headers()

    def do_GET(self):
        o = _ok_origin(self.headers); h = _cors(o)
        if not _auth(self.headers): self._send(401, b'{"error":"Unauthorised"}', h); return
        try:
            data = _req("GET", "products?select=*&order=id&limit=500")
            rows = [_fix(p) for p in (data if isinstance(data, list) else [])]
            self._send(200, json.dumps(rows).encode(), h)
        except Exception as e:
            self._send(500, json.dumps({"error": str(e)}).encode(), h)

    def do_POST(self):
        o = _ok_origin(self.headers); h = _cors(o)
        if not _auth(self.headers): self._send(401, b'{"error":"Unauthorised"}', h); return
        try:
            length = int(self.headers.get("Content-Length",0))
            body   = json.loads(self.rfile.read(length)) if length else {}
            data   = _req("POST", "products", body, "return=representation")
            result = data[0] if isinstance(data,list) and data else data
            self._send(200, json.dumps({"success":True,"product":result}).encode(), h)
        except Exception as e: self._send(500, json.dumps({"error":str(e)}).encode(), h)

    def do_PUT(self):
        o = _ok_origin(self.headers); h = _cors(o)
        if not _auth(self.headers): self._send(401, b'{"error":"Unauthorised"}', h); return
        try:
            qs = parse_qs(urlparse(self.path).query); pid = qs["id"][0]
            length = int(self.headers.get("Content-Length",0))
            body   = json.loads(self.rfile.read(length)) if length else {}
            body.pop("id", None)
            data   = _req("PATCH", f"products?id=eq.{pid}", body, "return=representation")
            result = data[0] if isinstance(data,list) and data else data
            self._send(200, json.dumps({"success":True,"product":result}).encode(), h)
        except Exception as e: self._send(500, json.dumps({"error":str(e)}).encode(), h)

    def do_DELETE(self):
        o = _ok_origin(self.headers); h = _cors(o)
        if not _auth(self.headers): self._send(401, b'{"error":"Unauthorised"}', h); return
        try:
            qs = parse_qs(urlparse(self.path).query); pid = qs["id"][0]
            _req("DELETE", f"products?id=eq.{pid}")
            self._send(200, b'{"success":true}', h)
        except Exception as e: self._send(500, json.dumps({"error":str(e)}).encode(), h)

    def _send(self, s, b, h):
        self.send_response(s)
        for k,v in h.items(): self.send_header(k,v)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
