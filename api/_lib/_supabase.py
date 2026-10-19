import json
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from api._lib._responses import ApiError


class SupabaseError(ApiError):
    pass


def _missing(name):
    print(f"Missing required server environment variable: {name}")
    raise ApiError(500, "Server configuration unavailable")


def supabase_url():
    value = os.environ.get("SUPABASE_URL", "").rstrip("/")
    if not value:
        _missing("SUPABASE_URL")
    return value


def anon_key():
    value = os.environ.get("SUPABASE_ANON_KEY") or os.environ.get("VITE_SUPABASE_ANON_KEY") or ""
    if not value:
        _missing("SUPABASE_ANON_KEY")
    return value


def service_key():
    value = (
        os.environ.get("SUPABASE_SERVICE_KEY")
        or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_KEY")
        or ""
    )
    if not value:
        _missing("SUPABASE_SERVICE_KEY")
    return value


def _json_request(url, method="GET", headers=None, body=None, timeout=10):
    data = json.dumps(body).encode() if body is not None else None
    req = Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urlopen(req, timeout=timeout) as res:
            raw = res.read()
            return json.loads(raw) if raw.strip() else {}
    except HTTPError as exc:
        safe = 'Service temporarily unavailable. Please try again.'
        try:
            detail = json.loads(exc.read())
            print(f"Supabase HTTP {exc.code}, code={detail.get('code', 'unknown')}")
            public_messages = {'Insufficient stock', 'Product is unavailable', 'Invalid product size', 'Invalid product color',
                'Invalid order status transition', 'Order not found', 'This order needs a manual inventory review before cancellation',
                'Idempotency key was already used for another order', 'Product configuration is unavailable', 'Invalid product price'}
            public_messages.update({'Online payment is not confirmed', 'Payment is already being prepared. Please retry shortly',
                'This payment reservation has expired', 'This order is not eligible for payment', 'Order does not match this account',
                'This payment method is currently unavailable'})
            if detail.get('message') in public_messages:
                safe = detail['message']
        except Exception:
            print(f"Supabase HTTP {exc.code}")
        raise SupabaseError(exc.code if exc.code < 500 else 502, safe)
    except (URLError, TimeoutError):
        raise SupabaseError(502, 'Service temporarily unavailable. Please retry the same request.')


def auth_get_user(token):
    headers = {
        "apikey": anon_key(),
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }
    return _json_request(f"{supabase_url()}/auth/v1/user", headers=headers)


def auth_password_login(email, password):
    headers = {"apikey": anon_key(), "Content-Type": "application/json"}
    body = {"email": email, "password": password}
    return _json_request(
        f"{supabase_url()}/auth/v1/token?grant_type=password",
        method="POST",
        headers=headers,
        body=body,
        timeout=12,
    )


def rest_headers(prefer=None):
    key = service_key()
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    return headers


def public_rest_headers(prefer=None):
    key = anon_key()
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    if prefer:
        headers["Prefer"] = prefer
    return headers


def rest_request(method, path, body=None, prefer=None, timeout=10):
    return _json_request(
        f"{supabase_url()}/rest/v1/{path}",
        method=method,
        headers=rest_headers(prefer),
        body=body,
        timeout=timeout,
    )


def public_rest_request(method, path, body=None, prefer=None, timeout=10):
    return _json_request(
        f"{supabase_url()}/rest/v1/{path}",
        method=method,
        headers=public_rest_headers(prefer),
        body=body,
        timeout=timeout,
    )
