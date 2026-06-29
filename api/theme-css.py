from http.server import BaseHTTPRequestHandler

from api._lib.supabase import public_rest_request
from api._lib.validation import normalize_settings_response


def _hex_to_rgb(hex_color):
    clean = hex_color.lstrip("#")
    return (
        int(clean[0:2], 16),
        int(clean[2:4], 16),
        int(clean[4:6], 16),
    )


def _rgb_to_hex(r, g, b):
    vals = [max(0, min(255, round(v))) for v in (r, g, b)]
    return "#" + "".join(f"{v:02X}" for v in vals)


def _mix(hex_color, target, amount):
    r, g, b = _hex_to_rgb(hex_color)
    tr, tg, tb = _hex_to_rgb(target)
    return _rgb_to_hex(
        r + (tr - r) * amount,
        g + (tg - g) * amount,
        b + (tb - b) * amount,
    )


def _rgba(hex_color, alpha):
    r, g, b = _hex_to_rgb(hex_color)
    return f"rgba({r}, {g}, {b}, {alpha})"


def _button_radius(style):
    if style == "pill":
        return "999px"
    if style == "square":
        return "4px"
    return "10px"


def _theme_css(theme):
    primary = theme["primaryColor"]
    accent = theme["accentColor"]
    pr, pg, pb = _hex_to_rgb(primary)
    ar, ag, ab = _hex_to_rgb(accent)
    values = {
        "--primary": primary,
        "--primary-rgb": f"{pr}, {pg}, {pb}",
        "--primary-dark": _mix(primary, "#000000", 0.22),
        "--primary-light": _rgba(primary, 0.1),
        "--secondary": theme["secondaryColor"],
        "--accent": accent,
        "--accent-rgb": f"{ar}, {ag}, {ab}",
        "--bg": theme["backgroundColor"],
        "--surface": theme["surfaceColor"],
        "--surface-2": _mix(theme["surfaceColor"], theme["backgroundColor"], 0.68),
        "--text": theme["textColor"],
        "--text-muted": theme["mutedTextColor"],
        "--text-light": _mix(theme["mutedTextColor"], theme["surfaceColor"], 0.42),
        "--border": theme["borderColor"],
        "--button-radius": _button_radius(theme["buttonStyle"]),
        "--shadow": f"0 4px 24px {_rgba(primary, 0.1)}",
        "--shadow-hover": f"0 8px 32px {_rgba(primary, 0.22)}",
    }
    body = "html:root{" + "".join(f"{k}:{v};" for k, v in values.items()) + "}"
    body += f'html[data-theme-mode="{theme["themeMode"]}"]{{color-scheme:{theme["themeMode"] if theme["themeMode"] in ("light", "dark") else "light"};}}'
    return body


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        try:
            rows = public_rest_request("GET", "site_settings?select=data&limit=1")
            data = rows[0].get("data") or {} if rows else {}
            settings = normalize_settings_response(data)
        except Exception:
            settings = normalize_settings_response({})
        payload = _theme_css(settings["theme_settings"]).encode()
        self.send_response(200)
        self.send_header("Content-Type", "text/css; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.end_headers()
        self.wfile.write(payload)

    def log_message(self, *args):
        pass
