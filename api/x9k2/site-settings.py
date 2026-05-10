import os, json, base64, time
from http.server import BaseHTTPRequestHandler
from urllib.request import Request, urlopen
from urllib.error import HTTPError

def _sb_url(): return os.environ.get("SUPABASE_URL","").rstrip("/")
def _sb_key(): return os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY","")

def _sb_headers(prefer=None):
    k=_sb_key()
    h={"apikey":k,"Authorization":f"Bearer {k}","Content-Type":"application/json"}
    if prefer: h["Prefer"]=prefer
    return h

def _auth(h):
    a=h.get("Authorization","")
    if not a.startswith("Bearer "): return False
    try:
        token=a.split(" ",1)[1]
        parts=token.split(".")
        if len(parts)!=3: return False
        pad=parts[1]+"="*(-len(parts[1])%4)
        payload=json.loads(base64.urlsafe_b64decode(pad))
        sb_url=os.environ.get("SUPABASE_URL","").rstrip("/")
        if payload.get("iss")!=f"{sb_url}/auth/v1": return False
        if payload.get("exp",0)<time.time(): return False
        return bool(payload.get("sub"))
    except: return False

def _cors(o="*"):
    return {"Access-Control-Allow-Origin":o,
            "Access-Control-Allow-Methods":"GET,POST,OPTIONS",
            "Access-Control-Allow-Headers":"Content-Type,Authorization",
            "Access-Control-Allow-Credentials":"true",
            "Content-Type":"application/json"}

def _ok_origin(h):
    o=h.get("Origin","")
    return o if o in {"https://calvac.in","https://calvac-4-0.vercel.app",
                      "https://www.calvac.in","http://localhost:5173"} else "*"

def _upsert(body):
    """Upsert settings — update if exists, insert if not."""
    base = f"{_sb_url()}/rest/v1/site_settings"
    data = json.dumps(body).encode()
    # Try to get existing row ID
    try:
        req = Request(f"{base}?select=id&limit=1", headers=_sb_headers())
        with urlopen(req, timeout=10) as r:
            existing = json.loads(r.read())
    except: existing = []

    if existing:
        row_id = existing[0]["id"]
        # Remove id from body to avoid conflicts
        body.pop("id", None)
        req = Request(f"{base}?id=eq.{row_id}",
                      data=json.dumps(body).encode(),
                      headers=_sb_headers("return=minimal"),
                      method="PATCH")
    else:
        req = Request(base,
                      data=json.dumps(body).encode(),
                      headers=_sb_headers("return=minimal"),
                      method="POST")
    with urlopen(req, timeout=15) as r:
        return True

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        o=_ok_origin(self.headers); self.send_response(204)
        for k,v in _cors(o).items(): self.send_header(k,v)
        self.end_headers()

    def do_GET(self):
        o=_ok_origin(self.headers); h=_cors(o)
        if not _auth(self.headers): self._send(401,b'{"error":"Unauthorised"}',h); return
        try:
            req=Request(f"{_sb_url()}/rest/v1/site_settings?select=*&limit=1",
                        headers=_sb_headers())
            with urlopen(req,timeout=10) as r:
                data=json.loads(r.read())
                self._send(200,json.dumps(data[0] if data else {}).encode(),h)
        except:
            self._send(200,b"{}",h)

    def do_POST(self):
        o=_ok_origin(self.headers); h=_cors(o)
        if not _auth(self.headers): self._send(401,b'{"error":"Unauthorised"}',h); return
        try:
            length=int(self.headers.get("Content-Length",0))
            body=json.loads(self.rfile.read(length)) if length else {}
            _upsert(body)
            self._send(200,b'{"success":true}',h)
        except Exception as e:
            self._send(500,json.dumps({"error":str(e)}).encode(),h)

    def _send(self,s,b,h):
        self.send_response(s)
        for k,v in h.items(): self.send_header(k,v)
        self.send_header("Content-Length",str(len(b))); self.end_headers(); self.wfile.write(b)
    def log_message(self,*a): pass
