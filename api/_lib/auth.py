import os

from api._lib.http import ApiError
from api._lib.supabase import auth_get_user


def bearer_token(headers):
    value = headers.get("Authorization", "")
    if not value.startswith("Bearer "):
        raise ApiError(401, "Missing bearer token")
    token = value.split(" ", 1)[1].strip()
    if not token or "." not in token:
        raise ApiError(401, "Invalid bearer token")
    return token


def _admin_emails():
    raw = os.environ.get("ADMIN_EMAILS", "")
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


def is_admin_user(user):
    if not isinstance(user, dict):
        return False
    app_meta = user.get("app_metadata") or {}
    if isinstance(app_meta, dict) and app_meta.get("role") == "admin":
        return True
    email = str(user.get("email") or "").lower()
    return bool(email and email in _admin_emails())


def authenticate(headers):
    token = bearer_token(headers)
    try:
        user = auth_get_user(token)
    except ApiError as exc:
        if exc.status in (400, 401, 403):
            raise ApiError(401, "Invalid or expired token")
        raise
    if not user or not user.get("id"):
        raise ApiError(401, "Invalid or expired token")
    return user


def require_admin(headers):
    user = authenticate(headers)
    if not is_admin_user(user):
        raise ApiError(403, "Admin permission required")
    return user
