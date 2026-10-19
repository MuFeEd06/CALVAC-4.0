import base64
from email.parser import BytesParser
from email.policy import default as email_policy
import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler

from api._lib._auth import require_admin
from api._lib._cors import handle_options, require_cors
from api._lib._rate_limit import require_rate_limit
from api._lib._responses import ApiError, send_error, send_json


MAX_BYTES = 200 * 1024
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}
ALLOWED_EXTS = {".jpg", ".jpeg", ".png", ".webp"}
MAX_DIMENSION = 4096
MAX_PIXELS = 16_000_000


def _safe_filename(filename):
    safe_name = "".join(ch for ch in (filename or "") if ch.isalnum() or ch in ".-_")[:80] or "product.webp"
    lower = safe_name.lower()
    if not any(lower.endswith(ext) for ext in ALLOWED_EXTS):
        raise ApiError(400, "Image extension not allowed")
    return safe_name


def _read_u24_le(data):
    return data[0] | (data[1] << 8) | (data[2] << 16)


def _image_info(data):
    if data.startswith(b"\xff\xd8\xff"):
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            i += 2
            if marker in (0xD8, 0xD9):
                continue
            if i + 2 > len(data):
                break
            seg_len = int.from_bytes(data[i:i + 2], "big")
            if seg_len < 2 or i + seg_len > len(data):
                break
            if marker in {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}:
                height = int.from_bytes(data[i + 3:i + 5], "big")
                width = int.from_bytes(data[i + 5:i + 7], "big")
                return "image/jpeg", width, height
            i += seg_len
    if data.startswith(b"\x89PNG\r\n\x1a\n") and len(data) >= 24:
        width = int.from_bytes(data[16:20], "big")
        height = int.from_bytes(data[20:24], "big")
        return "image/png", width, height
    if data.startswith(b"RIFF") and data[8:12] == b"WEBP" and len(data) >= 30:
        chunk = data[12:16]
        if chunk == b"VP8X" and len(data) >= 30:
            width = _read_u24_le(data[24:27]) + 1
            height = _read_u24_le(data[27:30]) + 1
            return "image/webp", width, height
        if chunk == b"VP8 " and len(data) >= 30 and data[23:26] == b"\x9d\x01\x2a":
            width = int.from_bytes(data[26:28], "little") & 0x3FFF
            height = int.from_bytes(data[28:30], "little") & 0x3FFF
            return "image/webp", width, height
        if chunk == b"VP8L" and len(data) >= 25 and data[20] == 0x2F:
            bits = int.from_bytes(data[21:25], "little")
            width = (bits & 0x3FFF) + 1
            height = ((bits >> 14) & 0x3FFF) + 1
            return "image/webp", width, height
    raise ApiError(400, "Image type not allowed")


def _validate_image(data, browser_mime, filename):
    safe_name = _safe_filename(filename)
    detected_mime, width, height = _image_info(data)
    if detected_mime not in ALLOWED_TYPES or browser_mime not in ALLOWED_TYPES:
        raise ApiError(400, "Image type not allowed")
    if detected_mime != browser_mime:
        raise ApiError(400, "Image MIME does not match file content")
    if width < 1 or height < 1 or width > MAX_DIMENSION or height > MAX_DIMENSION or width * height > MAX_PIXELS:
        raise ApiError(400, "Image dimensions not allowed")
    return safe_name, detected_mime


def _ik_private():
    value = os.environ.get("IK_PRIVATE_KEY", "")
    if not value:
        print("Missing required server environment variable: IK_PRIVATE_KEY")
        raise ApiError(500, "Upload configuration unavailable")
    return value


def _ik_endpoint():
    value = os.environ.get("IK_URL_ENDPOINT", "").rstrip("/")
    if not value:
        print("Missing required server environment variable: IK_URL_ENDPOINT")
        raise ApiError(500, "Upload configuration unavailable")
    return value


def _upload_to_imagekit(image_bytes, filename, mime):
    private_key = _ik_private()
    _ik_endpoint()
    boundary = b"----CalvacBoundary7f3a9b2e"
    parts = []

    def field(name, value):
        return b"--" + boundary + b"\r\n" + f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode() + value.encode() + b"\r\n"

    def file_field(name, fname, data, ctype):
        return (
            b"--" + boundary + b"\r\n"
            + f'Content-Disposition: form-data; name="{name}"; filename="{fname}"\r\n'.encode()
            + f"Content-Type: {ctype}\r\n\r\n".encode()
            + data + b"\r\n"
        )

    parts.append(file_field("file", filename, image_bytes, mime))
    parts.append(field("fileName", filename))
    parts.append(field("folder", "/shoes"))
    parts.append(field("useUniqueFileName", "true"))
    parts.append(b"--" + boundary + b"--\r\n")
    credentials = base64.b64encode(f"{private_key}:".encode()).decode()
    req = urllib.request.Request(
        "https://upload.imagekit.io/api/v1/files/upload",
        data=b"".join(parts),
        headers={
            "Authorization": f"Basic {credentials}",
            "Content-Type": f"multipart/form-data; boundary={boundary.decode()}",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as res:
        result = json.loads(res.read())
    return result.get("url", "")


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, "POST,OPTIONS")

    def do_POST(self):
        cors = None
        try:
            cors = require_cors(self, "POST,OPTIONS")
            require_rate_limit(self, "upload")
            require_admin(self.headers)
            try: length = int(self.headers.get('Content-Length', 0))
            except ValueError: raise ApiError(400, 'Invalid request length')
            if length < 1: raise ApiError(400, 'An image is required')
            if length > MAX_BYTES * 2: raise ApiError(413, 'File too large')
            content_type = self.headers.get('Content-Type', '')
            if '\r' in content_type or '\n' in content_type or len(content_type) > 250:
                raise ApiError(400, 'Invalid multipart request')
            raw = self.rfile.read(length)
            message = BytesParser(policy=email_policy).parsebytes(('Content-Type: ' + content_type + '\r\nMIME-Version: 1.0\r\n\r\n').encode() + raw)
            if message.get_content_type() != 'multipart/form-data' or not message.is_multipart() or message.defects:
                raise ApiError(400, 'Invalid multipart request')
            parts = list(message.iter_parts())
            if len(parts) != 1 or parts[0].get_param('name', header='content-disposition') != 'image' or parts[0].defects:
                raise ApiError(400, 'Exactly one image is required')
            part = parts[0]
            image_bytes = part.get_payload(decode=True)
            if not isinstance(image_bytes, bytes): raise ApiError(400, 'Invalid image')
            mime, filename = part.get_content_type(), part.get_filename() or 'product.webp'
            if len(image_bytes) > MAX_BYTES:
                raise ApiError(413, "Image too large")
            if len(image_bytes) < 100:
                raise ApiError(400, "Image is empty or corrupt")
            safe_name, detected_mime = _validate_image(image_bytes, mime, filename)
            url = _upload_to_imagekit(image_bytes, safe_name, detected_mime)
            if not url:
                raise ApiError(502, "Image upload failed")
            send_json(self, 200, {"url": url}, cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
