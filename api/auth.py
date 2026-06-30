from http.server import BaseHTTPRequestHandler

from api._lib._auth import is_admin_user
from api._lib._cors import handle_options, require_cors
from api._lib._rate_limit import client_ip, require_rate_limit
from api._lib._responses import ApiError, read_json, send_error, send_json
from api._lib._supabase import auth_get_user, auth_password_login
from api._lib._validation import clean_str


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, "POST,OPTIONS")

    def do_POST(self):
        cors = None
        try:
            cors = require_cors(self, "POST,OPTIONS")
            body = read_json(self, 8 * 1024)
            email = clean_str(body.get("email"), 254).lower()
            password = body.get("password") if isinstance(body.get("password"), str) else ""
            require_rate_limit(self, "admin-login", subject=f"{client_ip(self)}:{email}")
            if not email or not password or len(password) > 256:
                raise ApiError(400, "Invalid login request")
            session = auth_password_login(email, password)
            token = session.get("access_token")
            if not token:
                raise ApiError(401, "Invalid credentials")
            user = auth_get_user(token)
            if not is_admin_user(user):
                raise ApiError(403, "Admin permission required")
            session["user"] = user
            send_json(self, 200, session, cors)
        except ApiError as exc:
            if exc.status in (400, 401):
                exc = ApiError(401, "Invalid credentials")
            send_error(self, exc, cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
