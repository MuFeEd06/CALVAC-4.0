"""
GET  /api/x9k2/site-settings  — admin, returns settings from data jsonb column
POST /api/x9k2/site-settings  — admin, merges payload into data jsonb column
"""
import os, json, base64, time
from http.server import BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError

def _sb_url(): return os.environ.get("SUPABASE_URL","").rstrip("/")
def _sb_key(): return os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY","")

def _headers(prefer=None):
    k = _sb_key()
    h = {"apikey": k, "Authorization": f"Bearer {k}", "Content-Type": "application/json"}
    if prefer: h["Prefer"] = prefer
    return h

def _cors(o="*"):
    return {"Access-Control-Allow-Origin": o,
            "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
            "Access-Control-Allow-Credentials": "true",
            "Content-Type": "application/json"}

def _ok_origin(h):
    o = h.get("Origin","")
    return o if o in {"https://calvac.in","https://calvac-4-0.vercel.app",
                      "https://www.calvac.in","http://localhost:5173"} else "*"

def _auth(h):
    a = h.get("Authorization","")
    if not a.startswith("Bearer "): return False, "no token"
    try:
        token = a.split(" ",1)[1]
        parts = token.split(".")
        if len(parts) != 3: return False, "bad format"
        pad = parts[1] + "=" * (-len(parts[1]) % 4)
        p   = json.loads(base64.urlsafe_b64decode(pad))
        if p.get("iss") != f"{_sb_url()}/auth/v1": return False, f"wrong issuer: {p.get('iss')}"
        if p.get("exp",0) < time.time(): return False, "expired"
        if not p.get("sub"): return False, "no sub"
        return True, "ok"
    except Exception as e:
        return False, str(e)

def _get(path, prefer=None):
    req = Request(f"{_sb_url()}/rest/v1/{path}", headers=_headers(prefer))
    with urlopen(req, timeout=10) as r:
        return json.loads(r.read())

def _patch(path, body, prefer=None):
    data = json.dumps(body).encode()
    req  = Request(f"{_sb_url()}/rest/v1/{path}",
                   data=data, headers=_headers(prefer), method="PATCH")
    with urlopen(req, timeout=15) as r:
        raw = r.read()
        return json.loads(raw) if raw.strip() else {}

def _post(path, body, prefer=None):
    data = json.dumps(body).encode()
    req  = Request(f"{_sb_url()}/rest/v1/{path}",
                   data=data, headers=_headers(prefer), method="POST")
    with urlopen(req, timeout=15) as r:
        raw = r.read()
        return json.loads(raw) if raw.strip() else {}

class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        o = _ok_origin(self.headers); self.send_response(204)
        for k,v in _cors(o).items(): self.send_header(k,v)
        self.end_headers()

    def do_GET(self):
        o = _ok_origin(self.headers); h = _cors(o)
        ok, reason = _auth(self.headers)
        if not ok:
            self._send(401, {"error": f"Unauthorised: {reason}"}, h); return
        try:
            rows = _get("site_settings?select=data&limit=1")
            data = (rows[0].get("data") or {}) if rows else {}
            self._send(200, data, h)
        except Exception as e:
            self._send(200, {}, h)

    def do_POST(self):
        o = _ok_origin(self.headers); h = _cors(o)
        ok, reason = _auth(self.headers)
        if not ok:
            self._send(401, {"error": f"Unauthorised: {reason}"}, h); return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body   = json.loads(self.rfile.read(length)) if length else {}
            body.pop("id", None)

            # Get existing row
            try:
                rows = _get("site_settings?select=id,data&limit=1")
            except:
                rows = []

            if rows:
                row_id    = rows[0]["id"]
                existing  = rows[0].get("data") or {}
                # Merge new settings into existing data
                merged    = {**existing, **body}
                _patch(f"site_settings?id=eq.{row_id}",
                       {"data": merged}, "return=minimal")
            else:
                # Insert first row
                _post("site_settings", {"data": body}, "return=minimal")

            self._send(200, {"success": True}, h)

        except HTTPError as he:
            err_body = he.read().decode()
            self._send(500, {"error": f"Supabase: {err_body}"}, h)
        except Exception as e:
            self._send(500, {"error": str(e)}, h)

    def _send(self, s, body, h):
        b = json.dumps(body).encode()
        self.send_response(s)
        for k,v in h.items(): self.send_header(k,v)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)

    def log_message(self, *a): pass
