import os, json, base64, time
from http.server import BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError

def _sb_url(): return os.environ.get("SUPABASE_URL","").rstrip("/")
def _sb_key(): return os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY","")

def _sb_headers(prefer=None, method_override=None):
    k = _sb_key()
    h = {
        "apikey": k,
        "Authorization": f"Bearer {k}",
        "Content-Type": "application/json",
    }
    if prefer:          h["Prefer"] = prefer
    if method_override: h["X-HTTP-Method-Override"] = method_override
    return h

def _cors(o="*"):
    return {
        "Access-Control-Allow-Origin":      o,
        "Access-Control-Allow-Methods":     "GET,POST,OPTIONS",
        "Access-Control-Allow-Headers":     "Content-Type,Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Content-Type":                     "application/json",
    }

def _ok_origin(h):
    o = h.get("Origin","")
    return o if o in {
        "https://calvac.in","https://calvac-4-0.vercel.app",
        "https://www.calvac.in","http://localhost:5173",
    } else "*"

def _auth(h):
    """Verify Supabase JWT by decoding payload — no HTTP call needed."""
    a = h.get("Authorization","")
    if not a.startswith("Bearer "): return False, "No Bearer token"
    try:
        token  = a.split(" ",1)[1]
        parts  = token.split(".")
        if len(parts) != 3: return False, "Invalid JWT format"
        pad    = parts[1] + "=" * (-len(parts[1]) % 4)
        payload = json.loads(base64.urlsafe_b64decode(pad))
        sb_url  = _sb_url()
        expected_iss = f"{sb_url}/auth/v1"
        if payload.get("iss") != expected_iss:
            return False, f"Wrong issuer: got={payload.get('iss')} expected={expected_iss}"
        if payload.get("exp",0) < time.time():
            return False, "Token expired"
        if not payload.get("sub"):
            return False, "No subject in token"
        return True, "ok"
    except Exception as e:
        return False, str(e)

def _sb_request(method, path, body=None, prefer=None):
    url  = f"{_sb_url()}/rest/v1/{path}"
    data = json.dumps(body).encode() if body is not None else None
    req  = Request(url, data=data, headers=_sb_headers(prefer), method=method)
    with urlopen(req, timeout=15) as r:
        raw = r.read()
        return json.loads(raw) if raw.strip() else None

class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        o = _ok_origin(self.headers)
        self.send_response(204)
        for k,v in _cors(o).items(): self.send_header(k,v)
        self.end_headers()

    def do_GET(self):
        o = _ok_origin(self.headers); h = _cors(o)
        ok, reason = _auth(self.headers)
        if not ok:
            self._send(401, {"error": f"Unauthorised: {reason}"}, h); return
        try:
            data = _sb_request("GET", "site_settings?select=*&limit=1")
            self._send(200, data[0] if data else {}, h)
        except:
            self._send(200, {}, h)

    def do_POST(self):
        o = _ok_origin(self.headers); h = _cors(o)
        ok, reason = _auth(self.headers)
        if not ok:
            self._send(401, {"error": f"Unauthorised: {reason}"}, h); return
        try:
            length = int(self.headers.get("Content-Length", 0))
            body   = json.loads(self.rfile.read(length)) if length else {}
            body.pop("id", None)  # never send id in payload

            # Check if row exists
            existing = _sb_request("GET", "site_settings?select=id&limit=1")

            if existing and len(existing) > 0:
                row_id = existing[0]["id"]
                _sb_request("PATCH", f"site_settings?id=eq.{row_id}", body, "return=minimal")
            else:
                # Table might not exist — try insert; if 404 table-not-found, create it first
                try:
                    _sb_request("POST", "site_settings", body, "return=minimal")
                except HTTPError as he:
                    err = he.read().decode()
                    self._send(500, {"error": f"Insert failed: {err}"}, h); return

            self._send(200, {"success": True}, h)
        except HTTPError as he:
            err = he.read().decode()
            self._send(500, {"error": f"Supabase error: {err}"}, h)
        except Exception as e:
            self._send(500, {"error": str(e)}, h)

    def _send(self, status, body, headers):
        payload = json.dumps(body).encode()
        self.send_response(status)
        for k,v in headers.items(): self.send_header(k,v)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *a): pass
