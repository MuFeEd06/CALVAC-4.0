import hashlib
import json
import os
import time
from collections import defaultdict
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from api._lib._responses import ApiError


_memory = defaultdict(list)


ROUTE_LIMITS = {
    "admin-login": (5, 15 * 60),
    "admin-read": (120, 60),
    "admin-write": (30, 60),
    "order-create": (8, 10 * 60),
    "upload": (20, 60 * 60),
    "search": (30, 60),
}


def _is_production():
    return os.environ.get("VERCEL_ENV") == "production" or os.environ.get("NODE_ENV") == "production"


def _upstash_configured():
    return bool(os.environ.get("UPSTASH_REDIS_REST_URL") and os.environ.get("UPSTASH_REDIS_REST_TOKEN"))


def client_ip(handler):
    headers = ("X-Vercel-Forwarded-For",) if _is_production() else ("X-Vercel-Forwarded-For", "X-Real-IP", "CF-Connecting-IP")
    for header in headers:
        value = handler.headers.get(header)
        if value:
            return value.split(",")[0].strip()
    if getattr(handler, "client_address", None):
        return handler.client_address[0]
    return "unknown"


def _subject_hash(subject):
    return hashlib.sha256(str(subject).encode()).hexdigest()[:24]


def _memory_check(key, limit, window):
    now = time.time()
    hits = [ts for ts in _memory[key] if now - ts < window]
    if len(hits) >= limit:
        _memory[key] = hits
        return False
    hits.append(now)
    _memory[key] = hits
    return True


def _upstash_check(key, limit, window):
    url = os.environ["UPSTASH_REDIS_REST_URL"].rstrip("/")
    token = os.environ["UPSTASH_REDIS_REST_TOKEN"]
    body = json.dumps([["INCR", key], ["EXPIRE", key, window]]).encode()
    req = Request(
        f"{url}/pipeline",
        data=body,
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urlopen(req, timeout=5) as res:
            data = json.loads(res.read())
    except HTTPError as exc:
        print(f"Rate limit store HTTP {exc.code}")
        raise ApiError(503, "Rate limit unavailable")
    except Exception as exc:
        print(f"Rate limit store error: {type(exc).__name__}")
        raise ApiError(503, "Rate limit unavailable")
    count = int((data[0] or {}).get("result", 0))
    return count <= limit


def require_rate_limit(handler, route, subject=None):
    if route not in ROUTE_LIMITS:
        raise ApiError(500, "Unknown rate limit route")
    limit, window = ROUTE_LIMITS[route]
    scope = subject if subject is not None else client_ip(handler)
    key = f"rl:{route}:{_subject_hash(scope)}"
    if _upstash_configured():
        allowed = _upstash_check(key, limit, window)
    elif _is_production():
        print("Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN")
        raise ApiError(503, "Rate limit unavailable")
    else:
        allowed = _memory_check(key, limit, window)
    if not allowed:
        raise ApiError(429, "Too many requests. Please try again later.")


def reserve_idempotency_key(key):
    if not key:
        raise ApiError(400, "Idempotency-Key header is required")
    safe_key = f"idem:{_subject_hash(key)}"
    if _upstash_configured():
        url = os.environ["UPSTASH_REDIS_REST_URL"].rstrip("/")
        token = os.environ["UPSTASH_REDIS_REST_TOKEN"]
        body = json.dumps([["SET", safe_key, "1", "NX", "EX", 86400]]).encode()
        req = Request(
            f"{url}/pipeline",
            data=body,
            headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urlopen(req, timeout=5) as res:
                data = json.loads(res.read())
            if not (data[0] or {}).get("result"):
                raise ApiError(409, "Duplicate order request")
        except ApiError:
            raise
        except Exception as exc:
            print(f"Idempotency store error: {type(exc).__name__}")
            raise ApiError(503, "Idempotency unavailable")
    elif _is_production():
        print("Missing Upstash config for idempotency")
        raise ApiError(503, "Idempotency unavailable")
    elif safe_key in _memory:
        raise ApiError(409, "Duplicate order request")
    else:
        _memory[safe_key] = [time.time()]
