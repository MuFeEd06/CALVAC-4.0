import os, json
from http.server import BaseHTTPRequestHandler
from urllib.request import Request, urlopen

def _sb_url(): return os.environ.get("SUPABASE_URL","").rstrip("/")
def _sb_key(): return os.environ.get("SUPABASE_SERVICE_KEY") or os.environ.get("SUPABASE_KEY","")
def _sb_headers():
    k=_sb_key()
    return {"apikey":k,"Authorization":f"Bearer {k}","Content-Type":"application/json","Prefer":"return=representation"}
def _sb_post(path,body):
    data=json.dumps(body).encode()
    req=Request(f"{_sb_url()}/rest/v1/{path}",data=data,headers=_sb_headers(),method="POST")
    with urlopen(req,timeout=10) as r: return json.loads(r.read())
def _cors(o="*"):
    return {"Access-Control-Allow-Origin":o,"Access-Control-Allow-Methods":"POST,OPTIONS",
            "Access-Control-Allow-Headers":"Content-Type,Authorization","Content-Type":"application/json"}
def _ok_origin(h):
    o=h.get("Origin","")
    return o if o in {"https://calvac.in","https://calvac-4-0.vercel.app","http://localhost:5173"} else "*"

class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        o=_ok_origin(self.headers); self.send_response(204)
        for k,v in _cors(o).items(): self.send_header(k,v)
        self.end_headers()
    def do_POST(self):
        o=_ok_origin(self.headers); h=_cors(o)
        try:
            length=int(self.headers.get("Content-Length",0))
            body=json.loads(self.rfile.read(length)) if length else {}
            addr=body.get("address",{})
            row={"name":str(addr.get("name",""))[:100],"phone":str(addr.get("phone",""))[:15],
                 "line1":str(addr.get("line1",""))[:200],"line2":str(addr.get("line2",""))[:200],
                 "city":str(addr.get("city",""))[:100],"state":str(addr.get("state",""))[:100],
                 "pin":str(addr.get("pin",""))[:6],"landmark":str(addr.get("landmark",""))[:200],
                 "total":float(body.get("total",0)),"status":"Pending","items":body.get("items",[])}
            _sb_post("orders",row)
            self._send(200,b'{"success":true}',h)
        except Exception as e:
            self._send(500,json.dumps({"error":str(e)}).encode(),h)
    def _send(self,s,b,h):
        self.send_response(s)
        for k,v in h.items(): self.send_header(k,v)
        self.send_header("Content-Length",str(len(b))); self.end_headers(); self.wfile.write(b)
    def log_message(self,*a): pass
