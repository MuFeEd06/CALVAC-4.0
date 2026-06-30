import json


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def read_json(handler, max_bytes=64 * 1024):
    try:
        length = int(handler.headers.get("Content-Length", 0))
    except ValueError:
        raise ApiError(400, "Invalid request length")
    if length <= 0:
        return {}
    if length > max_bytes:
        raise ApiError(413, "Request body too large")
    try:
        return json.loads(handler.rfile.read(length))
    except Exception:
        raise ApiError(400, "Invalid JSON body")


def send_json(handler, status, body, cors=None, extra_headers=None):
    payload = json.dumps(body).encode()
    handler.send_response(status)
    if cors:
        cors(handler)
    headers = {
        "Content-Type": "application/json",
        "Content-Length": str(len(payload)),
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
        "Cache-Control": "no-store, no-cache, must-revalidate",
    }
    headers.update(extra_headers or {})
    for key, value in headers.items():
        handler.send_header(key, value)
    handler.end_headers()
    handler.wfile.write(payload)


def send_error(handler, error, cors=None):
    if isinstance(error, ApiError):
        return send_json(handler, error.status, {"error": error.message}, cors)
    print(f"Unhandled API error: {type(error).__name__}")
    return send_json(handler, 500, {"error": "Internal server error"}, cors)
