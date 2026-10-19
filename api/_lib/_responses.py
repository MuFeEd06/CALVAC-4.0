import json


class ApiError(Exception):
    def __init__(self, status, message, headers=None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.headers = headers or {}


def read_json(handler, max_bytes=64 * 1024):
    try:
        length = int(handler.headers.get("Content-Length", 0))
    except ValueError:
        raise ApiError(400, "Invalid request length")
    if length <= 0:
        raise ApiError(400, 'JSON body is required')
    if length > max_bytes:
        raise ApiError(413, "Request body too large")
    try:
        def reject_constant(value): raise ValueError('Invalid JSON number')
        body = json.loads(handler.rfile.read(length), parse_constant=reject_constant)
    except Exception:
        raise ApiError(400, "Invalid JSON body")
    if not isinstance(body, dict):
        raise ApiError(400, 'JSON body must be an object')
    return body


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
        body = {"error": error.message}
        if str(error.headers.get('Retry-After', '')).isdigit():
            body['retryAfter'] = int(error.headers['Retry-After'])
        return send_json(handler, error.status, body, cors, error.headers)
    print(f"Unhandled API error: {type(error).__name__}")
    return send_json(handler, 500, {"error": "Internal server error"}, cors)
