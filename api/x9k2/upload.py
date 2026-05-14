"""
POST /api/x9k2/upload
Accepts: multipart/form-data with field 'image'
Returns: {"url": "https://ik.imagekit.io/..."} or {"error": "..."}

Security:
- JWT auth required (Supabase token)
- Max file size: 200KB (after client-side compression)
- Allowed MIME types: image/jpeg, image/png, image/webp
- Uploads to ImageKit using IK_PRIVATE_KEY + IK_URL_ENDPOINT env vars
"""
import os, json, base64, time, cgi, io, urllib.request, urllib.parse
from http.server import BaseHTTPRequestHandler

MAX_BYTES     = 200 * 1024          # 200 KB hard limit
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}

def _sb_url(): return os.environ.get("SUPABASE_URL","").rstrip("/")
def _ik_private(): return os.environ.get("IK_PRIVATE_KEY","")
def _ik_endpoint(): return os.environ.get("IK_URL_ENDPOINT","").rstrip("/")

def _cors(o="*"):
    return {"Access-Control-Allow-Origin": o,
            "Access-Control-Allow-Methods": "POST,OPTIONS",
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
        token = a.split(" ",1)[1]; parts = token.split(".")
        if len(parts)!=3: return False, "bad jwt"
        pad = parts[1]+"="*(-len(parts[1])%4)
        p   = json.loads(base64.urlsafe_b64decode(pad))
        sb  = _sb_url()
        if p.get("iss") != f"{sb}/auth/v1": return False, f"wrong issuer"
        if p.get("exp",0) < time.time(): return False, "expired"
        return bool(p.get("sub")), "ok"
    except Exception as e:
        return False, str(e)

def _upload_to_imagekit(image_bytes: bytes, filename: str, mime: str) -> str:
    """Upload bytes to ImageKit, return public URL."""
    private_key = _ik_private()
    endpoint    = _ik_endpoint()
    if not private_key or not endpoint:
        raise RuntimeError("IK_PRIVATE_KEY or IK_URL_ENDPOINT env var not set")

    # ImageKit upload API — multipart
    boundary = b"----CalvacBoundary7f3a9b2e"
    body_parts = []

    def field(name: str, value: str):
        return (
            b"--" + boundary + b"\r\n"
            + f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode()
            + value.encode() + b"\r\n"
        )
    def file_field(name: str, fname: str, data: bytes, ctype: str):
        return (
            b"--" + boundary + b"\r\n"
            + f'Content-Disposition: form-data; name="{name}"; filename="{fname}"\r\n'.encode()
            + f'Content-Type: {ctype}\r\n\r\n'.encode()
            + data + b"\r\n"
        )

    body_parts.append(file_field("file", filename, image_bytes, mime))
    body_parts.append(field("fileName", filename))
    body_parts.append(field("folder",   "/shoes"))
    body_parts.append(field("useUniqueFileName", "true"))
    body_parts.append(b"--" + boundary + b"--\r\n")
    body = b"".join(body_parts)

    # Basic auth: private_key as username, empty password
    credentials = base64.b64encode(f"{private_key}:".encode()).decode()
    req = urllib.request.Request(
        "https://upload.imagekit.io/api/v1/files/upload",
        data=body,
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": f"multipart/form-data; boundary={boundary.decode()}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as r:
        result = json.loads(r.read())
    return result.get("url","")

class handler(BaseHTTPRequestHandler):

    def do_OPTIONS(self):
        o = _ok_origin(self.headers); self.send_response(204)
        for k,v in _cors(o).items(): self.send_header(k,v)
        self.end_headers()

    def do_POST(self):
        o  = _ok_origin(self.headers)
        h  = _cors(o)
        ok, reason = _auth(self.headers)
        if not ok:
            self._send(401, {"error": f"Unauthorised: {reason}"}, h); return

        try:
            ctype = self.headers.get("Content-Type","")

            # Parse multipart form
            length = int(self.headers.get("Content-Length",0))
            if length > MAX_BYTES * 2:   # extra headroom for multipart overhead
                self._send(413, {"error": "File too large (max 200 KB)"}, h); return

            raw = self.rfile.read(length)

            # Extract file from multipart using cgi module
            env = {
                "REQUEST_METHOD": "POST",
                "CONTENT_TYPE":   ctype,
                "CONTENT_LENGTH": str(length),
            }
            fs = cgi.FieldStorage(
                fp=io.BytesIO(raw),
                headers=self.headers,
                environ=env,
            )
            if "image" not in fs:
                self._send(400, {"error": "No 'image' field in form"}, h); return

            file_item = fs["image"]
            image_bytes = file_item.file.read()
            mime        = file_item.type or "image/webp"
            filename    = file_item.filename or "product.webp"

            # Server-side validation
            if mime not in ALLOWED_TYPES:
                self._send(400, {"error": f"Type not allowed: {mime}"}, h); return
            if len(image_bytes) > MAX_BYTES:
                self._send(413, {"error": f"Image too large: {len(image_bytes)//1024}KB (max 200KB)"}, h); return
            if len(image_bytes) < 100:
                self._send(400, {"error": "Image is empty or corrupt"}, h); return

            url = _upload_to_imagekit(image_bytes, filename, mime)
            if not url:
                self._send(500, {"error": "ImageKit returned no URL"}, h); return

            self._send(200, {"url": url}, h)

        except Exception as e:
            self._send(500, {"error": str(e)}, h)

    def _send(self, s, body, h):
        b = json.dumps(body).encode()
        self.send_response(s)
        for k,v in h.items(): self.send_header(k,v)
        self.send_header("Content-Length", str(len(b)))
        self.end_headers(); self.wfile.write(b)
    def log_message(self, *a): pass
