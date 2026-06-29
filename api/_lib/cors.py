import os

from api._lib.http import ApiError, send_json


DEFAULT_DEV_ORIGINS = {
    "http://localhost:5173",
    "http://127.0.0.1:5173",
}


def _is_production():
    return os.environ.get("VERCEL_ENV") == "production" or os.environ.get("NODE_ENV") == "production"


def allowed_origins():
    raw = os.environ.get("ALLOWED_ORIGINS", "")
    origins = {o.strip().rstrip("/") for o in raw.split(",") if o.strip()}
    if not origins and not _is_production():
        origins = set(DEFAULT_DEV_ORIGINS)
    return origins


def origin_for(handler):
    origin = (handler.headers.get("Origin") or "").rstrip("/")
    if not origin:
        return None
    if origin in allowed_origins():
        return origin
    return False


def cors_headers(origin, methods, request_headers="Content-Type,Authorization,Idempotency-Key"):
    def apply(handler):
        if origin:
            handler.send_header("Access-Control-Allow-Origin", origin)
            handler.send_header("Vary", "Origin")
        handler.send_header("Access-Control-Allow-Methods", methods)
        handler.send_header("Access-Control-Allow-Headers", request_headers)
        handler.send_header("Access-Control-Max-Age", "600")
    return apply


def require_cors(handler, methods, request_headers="Content-Type,Authorization,Idempotency-Key"):
    origin = origin_for(handler)
    if origin is False:
        raise ApiError(403, "Origin not allowed")
    return cors_headers(origin, methods, request_headers)


def handle_options(handler, methods, request_headers="Content-Type,Authorization,Idempotency-Key"):
    try:
        cors = require_cors(handler, methods, request_headers)
        handler.send_response(204)
        cors(handler)
        handler.send_header("Content-Length", "0")
        handler.end_headers()
    except ApiError as exc:
        send_json(handler, exc.status, {"error": exc.message})
