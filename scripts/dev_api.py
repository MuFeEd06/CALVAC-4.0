"""Local-only API runner; all application handlers are shared with deployment."""
import os
from pathlib import Path
from urllib.parse import urlparse
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from api import admin, auth, health, orders, store, theme_css, upload, account, payments, checkout_config
from api._lib._responses import ApiError, send_error


def load_environment():
    env = Path('.env')
    if env.exists():
        for line in env.read_text(encoding='utf-8').splitlines():
            line = line.strip()
            if not line or line.startswith('#') or '=' not in line: continue
            key, value = line.split('=', 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))
    hostname = urlparse(os.environ.get('SUPABASE_URL', '')).hostname
    if hostname == 'jjyysdxkoarjlxwttiak.supabase.co' and os.environ.get('ALLOW_PRODUCTION_BACKEND') != 'true':
        raise RuntimeError('Local API would access production. Configure a preview database or explicitly set ALLOW_PRODUCTION_BACKEND=true.')


class handler(BaseHTTPRequestHandler):
    def dispatch(self):
        path = urlparse(self.path).path
        if path in ('/api/admin-login', '/api/admin-session', '/api/auth'): endpoint = auth.handler
        elif path.startswith('/api/x9k2/upload'): endpoint = upload.handler
        elif path.startswith('/api/x9k2/'): endpoint = admin.handler
        elif path == '/api/orders': endpoint = orders.handler
        elif path == '/api/account': endpoint = account.handler
        elif path.startswith('/api/razorpay/'): endpoint = payments.handler
        elif path == '/api/checkout-config': endpoint = checkout_config.handler
        elif path in ('/api/theme-css', '/api/theme_css'): endpoint = theme_css.handler
        elif path in ('/api/ping', '/api/health'): endpoint = health.handler
        elif path.split('/')[2:3] and path.split('/')[2] in ('products', 'search', 'site-settings', 'offer'): endpoint = store.handler
        else: return send_error(self, ApiError(404, 'API route not found'))
        if endpoint is admin.handler and self.command != 'OPTIONS':
            return endpoint._dispatch(self, self.command)
        method = getattr(endpoint, 'do_' + self.command, None)
        if method: return method(self)
        send_error(self, ApiError(405, 'Method not allowed'))

    do_GET = do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = dispatch
    def log_message(self, *args): pass


if __name__ == '__main__':
    load_environment()
    print('CALVAC API listening at http://127.0.0.1:8000', flush=True)
    ThreadingHTTPServer(('127.0.0.1', 8000), handler).serve_forever()
