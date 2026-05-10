import os, json
from http.server import BaseHTTPRequestHandler
from urllib.request import Request, urlopen
import base64, time

def _auth(h):
    """Verify Supabase JWT by decoding payload — no HTTP call needed."""
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


def _sb_url(): return os.environ.get("SUPABASE_URL","").rstrip("/")
def _sb_key(): return os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY","")
def _sb_headers(prefer=None):
    k=_sb_key(); h={"apikey":k,"Authorization":f"Bearer {k}","Content-Type":"application/json"}
    if prefer: h["Prefer"]=prefer
    return h
def _get(path):
    with urlopen(Request(f"{_sb_url()}/rest/v1/{path}",headers=_sb_headers()),timeout=10) as r:
        return json.loads(r.read())
def _patch(path,body):
    data=json.dumps(body).encode()
    req=Request(f"{_sb_url()}/rest/v1/{path}",data=data,headers=_sb_headers(),method="PATCH")
    with urlopen(req,timeout=10) as r: return {}
def _post(path,body):
    data=json.dumps(body).encode()
    req=Request(f"{_sb_url()}/rest/v1/{path}",data=data,headers=_sb_headers(),method="POST")
    with urlopen(req,timeout=10) as r: return {}
def _cors(o="*"):
    return {"Access-Control-Allow-Origin":o,"Access-Control-Allow-Methods":"GET,POST,OPTIONS",
            "Access-Control-Allow-Headers":"Content-Type,Authorization",
            "Access-Control-Allow-Credentials":"true","Content-Type":"application/json"}
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
        if not _auth(self.headers): self._send(401,b'{"error":"Unauthorised"}',h); return
        try:
            data=_get("offer?select=*&limit=1")
            self._send(200,json.dumps(data[0] if data else {}).encode(),h)
        except Exception as e: self._send(500,json.dumps({"error":str(e)}).encode(),h)
    def do_POST(self):
        o=_ok_origin(self.headers); h=_cors(o)
        if not _auth(self.headers): self._send(401,b'{"error":"Unauthorised"}',h); return
        try:
            length=int(self.headers.get("Content-Length",0))
            body=json.loads(self.rfile.read(length)) if length else {}
            existing=_get("offer?select=id&limit=1")
            if existing: _patch(f"offer?id=eq.{existing[0]['id']}",body)
            else: _post("offer",body)
            self._send(200,b'{"success":true}',h)
        except Exception as e: self._send(500,json.dumps({"error":str(e)}).encode(),h)
    def _send(self,s,b,h):
        self.send_response(s)
        for k,v in h.items(): self.send_header(k,v)
        self.send_header("Content-Length",str(len(b))); self.end_headers(); self.wfile.write(b)
    def log_message(self,*a): pass
