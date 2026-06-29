from decimal import Decimal, InvalidOperation, ROUND_HALF_UP
import math
import re
from urllib.parse import urlparse

from api._lib.http import ApiError


MAX_LINE_ITEMS = 20
MAX_QTY = 10
HEX_COLOR_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
SIZE_LABEL_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 .+/\-]{0,19}$")
SIZE_UNITS = {"UK", "EU"}
MAX_PRODUCT_SIZES = 40

DEFAULT_THEME_SETTINGS = {
    "primaryColor": "#2B9FD8",
    "secondaryColor": "#1A7AB0",
    "accentColor": "#FF6B35",
    "backgroundColor": "#F4F8FB",
    "surfaceColor": "#FFFFFF",
    "textColor": "#1A1A2E",
    "mutedTextColor": "#5A6A7A",
    "borderColor": "#D0E6F5",
    "buttonStyle": "rounded",
    "themeMode": "light",
}
THEME_FIELDS = set(DEFAULT_THEME_SETTINGS.keys())
THEME_COLOR_FIELDS = {
    "primaryColor",
    "secondaryColor",
    "accentColor",
    "backgroundColor",
    "surfaceColor",
    "textColor",
    "mutedTextColor",
    "borderColor",
}
BUTTON_STYLES = {"rounded", "pill", "square"}
THEME_MODES = {"light", "dark", "custom"}

CAT_SLUGS = {
    "boots",
    "crocs",
    "girls",
    "sale",
    "under1000",
    "under1500",
    "under2500",
    "new",
    "premium",
    "all",
}

BOOLEAN_FIELDS = {
    "show_new_arrivals",
    "show_categories",
    "show_brands_section",
    "hero_eyebrow_visible",
    "hero_headline_visible",
    "hero_sub_visible",
    "hero_prompt_visible",
    "hero_overlay_left_visible",
    "hero_overlay_right_visible",
    "hero_intro_visible",
    "hero_image_visible",
    "hero_gradient_visible",
    "hero_offer_visible",
    "hero_skip_visible",
    "hero_star_visible",
    "hero_m_intro_visible",
    "hero_m_eyebrow_visible",
    "hero_m_headline_visible",
    "hero_m_sub_visible",
    "hero_m_prompt_visible",
    "hero_m_overlay_left_visible",
    "hero_m_overlay_right_visible",
    "hero_m_star_visible",
    "hero_m_offer_visible",
    "hero_m_skip_visible",
    "hero_m_left_visible",
    "hero_m_right_visible",
}
BOOLEAN_FIELDS.update({f"cat_{slug}" for slug in CAT_SLUGS})

COLOR_FIELDS = {
    "hero_text_color",
    "hero_sub_color",
    "hero_overlay_color",
    "hero_offer_bg",
    "hero_offer_accent",
    "hero_offer_text_color",
    "hero_skip_bg",
    "hero_skip_color",
    "hero_star_color",
    "hero_m_left_label_color",
    "hero_m_left_title_color",
    "hero_m_right_label_color",
    "hero_m_right_title_color",
}

NUMERIC_FIELDS = {
    "model_scale",
    "model_y",
    "model_speed",
    "hero_intro_font_size_rem",
    "hero_eyebrow_size_px",
    "hero_sub_size_rem",
    "hero_prompt_size_px",
    "hero_intro_max_width_px",
    "hero_intro_y_offset_px",
    "hero_intro_x_pct",
    "hero_intro_y_pct",
    "hero_prompt_x_pct",
    "hero_prompt_y_px",
    "hero_intro_fade_start",
    "hero_intro_fade_end",
    "hero_overlay_fade_in_start",
    "hero_overlay_fade_in_end",
    "hero_overlay_fade_out_start",
    "hero_overlay_fade_out_end",
    "hero_overlay_left_x",
    "hero_overlay_left_y",
    "hero_overlay_right_x",
    "hero_overlay_right_y",
    "hero_image_scale",
    "hero_scroll_height_vh",
    "hero_gradient_strength",
    "hero_offer_x_pct",
    "hero_offer_y_pct",
    "hero_offer_width_px",
    "hero_skip_x_pct",
    "hero_skip_y_px",
    "hero_skip_size_px",
    "hero_star_size",
    "hero_star_x_pct",
    "hero_star_y_pct",
    "hero_star_speed",
    "hero_m_intro_font_size_rem",
    "hero_m_eyebrow_size_px",
    "hero_m_sub_size_rem",
    "hero_m_prompt_size_px",
    "hero_m_intro_y_pct",
    "hero_m_intro_max_width_px",
    "hero_m_scroll_height_vh",
    "hero_m_star_size",
    "hero_m_star_x_pct",
    "hero_m_star_y_pct",
    "hero_m_offer_width_px",
    "hero_m_offer_x_pct",
    "hero_m_offer_y_pct",
    "hero_m_skip_y_px",
    "hero_m_skip_size_px",
    "hero_m_prompt_x_pct",
    "hero_m_prompt_y_px",
    "hero_m_left_label_size",
    "hero_m_left_title_size",
    "hero_m_left_x_pct",
    "hero_m_left_y_pct",
    "hero_m_right_label_size",
    "hero_m_right_title_size",
    "hero_m_right_x_pct",
    "hero_m_right_y_pct",
}

ENUM_FIELDS = {
    "hero_intro_align": {"left", "center", "right"},
    "hero_m_intro_align": {"left", "center", "right"},
}

TEXT_FIELDS = {
    "hero_font",
    "model_path",
    "hidden_brands",
    "policy_privacy",
    "policy_return",
    "policy_shipping",
    "hero_headline",
    "hero_highlight",
    "hero_headline2",
    "hero_eyebrow",
    "hero_sub",
    "hero_prompt_text",
    "hero_overlay_left_label",
    "hero_overlay_left_title",
    "hero_overlay_right_label",
    "hero_overlay_right_title",
    "hero_offer_tag",
    "hero_offer_title",
    "hero_offer_price",
    "hero_offer_discount",
    "hero_offer_link",
    "hero_skip_text",
    "hero_m_left_label",
    "hero_m_left_title",
    "hero_m_right_label",
    "hero_m_right_title",
}

ALLOWED_SITE_SETTING_KEYS = (
    BOOLEAN_FIELDS
    | COLOR_FIELDS
    | NUMERIC_FIELDS
    | set(ENUM_FIELDS.keys())
    | TEXT_FIELDS
    | {"theme_settings", "primary_color"}
)


def clean_str(value, max_len):
    if not isinstance(value, str):
        return ""
    value = "".join(ch for ch in value if ch >= " " and ch != "\x7f").strip()
    return value[:max_len]


def infer_size_unit(value):
    raw = clean_str(value, 30).upper()
    if raw == "EU" or raw == "EURO" or raw.startswith("EU ") or raw.startswith("EURO "):
        return "EU"
    return "UK"


def normalize_size_unit(value, fallback="UK"):
    if value is None:
        return fallback
    raw = clean_str(value, 20).upper()
    if raw == "EURO":
        raw = "EU"
    if raw not in SIZE_UNITS:
        raise ApiError(400, "Invalid size unit")
    return raw


def clean_size_label(value):
    size = clean_str(value, 20)
    size = re.sub(r"^(UK|EURO?|EUR)\s+", "", size, flags=re.IGNORECASE).strip()
    if not size or not SIZE_LABEL_RE.fullmatch(size):
        raise ApiError(400, "Invalid size label")
    return size


def normalize_size_list(value):
    if not isinstance(value, list):
        raise ApiError(400, "Product sizes must be an array")
    if len(value) > MAX_PRODUCT_SIZES:
        raise ApiError(400, "Too many product sizes")
    seen = set()
    sizes = []
    for raw in value:
        size = clean_size_label(raw)
        key = size.lower()
        if key in seen:
            raise ApiError(400, "Duplicate product size")
        seen.add(key)
        sizes.append(size)
    return sizes


def normalize_hex_color(value, field_name="color"):
    if not isinstance(value, str):
        raise ApiError(400, f"Invalid {field_name}")
    color = value.strip()
    if not HEX_COLOR_RE.match(color):
        raise ApiError(400, f"Invalid {field_name}")
    return color.upper()


def _coerce_hex_or_default(value, fallback):
    if isinstance(value, str) and HEX_COLOR_RE.match(value.strip()):
        return value.strip().upper()
    return fallback


def normalize_theme_settings(value, existing=None, legacy_primary=None, strict=False):
    base = dict(DEFAULT_THEME_SETTINGS)
    if isinstance(existing, dict):
        for key in THEME_FIELDS:
            if key in existing:
                if key in THEME_COLOR_FIELDS:
                    base[key] = _coerce_hex_or_default(existing.get(key), base[key])
                elif key == "buttonStyle" and existing.get(key) in BUTTON_STYLES:
                    base[key] = existing[key]
                elif key == "themeMode" and existing.get(key) in THEME_MODES:
                    base[key] = existing[key]

    if legacy_primary:
        base["primaryColor"] = normalize_hex_color(legacy_primary, "primary color") if strict else _coerce_hex_or_default(legacy_primary, base["primaryColor"])

    if value is None:
        return base
    if not isinstance(value, dict):
        if strict:
            raise ApiError(400, "Theme settings must be an object")
        return base

    unexpected = set(value.keys()) - THEME_FIELDS
    if unexpected and strict:
        raise ApiError(400, f"Unexpected theme field: {sorted(unexpected)[0]}")

    for key, raw in value.items():
        if key not in THEME_FIELDS:
            continue
        if key in THEME_COLOR_FIELDS:
            base[key] = normalize_hex_color(raw, key) if strict else _coerce_hex_or_default(raw, base[key])
        elif key == "buttonStyle":
            if raw not in BUTTON_STYLES:
                if strict:
                    raise ApiError(400, "Invalid button style")
            else:
                base[key] = raw
        elif key == "themeMode":
            if raw not in THEME_MODES:
                if strict:
                    raise ApiError(400, "Invalid theme mode")
            else:
                base[key] = raw
    return base


def money_to_paise(value):
    try:
        amount = Decimal(str(value or "0")).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    except (InvalidOperation, ValueError):
        raise ApiError(500, "Invalid product price")
    if amount < 0:
        raise ApiError(500, "Invalid product price")
    return int(amount * 100)


def paise_to_rupees_string(paise):
    return str((Decimal(paise) / Decimal(100)).quantize(Decimal("0.01")))


def is_safe_url(value, allow_external=True):
    if not isinstance(value, str):
        return False
    value = value.strip()
    if not value:
        return True
    if value.startswith("/") and not value.startswith("//"):
        return True
    parsed = urlparse(value)
    if parsed.scheme != "https":
        return False
    if not allow_external:
        return False
    allowed_hosts = {
        "calvac.in",
        "www.calvac.in",
        "calvac-4-0.vercel.app",
        "ik.imagekit.io",
        "placehold.co",
        "wa.me",
        "www.instagram.com",
    }
    return parsed.netloc.lower() in allowed_hosts


def sanitize_link(value, fallback="/shop"):
    if not value:
        return fallback
    value = str(value).strip()
    if is_safe_url(value):
        return value
    raise ApiError(400, "Invalid link URL")


def _sanitize_number(key, value):
    if isinstance(value, bool):
        raise ApiError(400, f"Invalid value for {key}")
    try:
        num = float(value)
    except Exception:
        raise ApiError(400, f"Invalid value for {key}")
    if not math.isfinite(num):
        raise ApiError(400, f"Invalid value for {key}")
    if key.endswith("_fade_start") or key.endswith("_fade_end"):
        if num < 0 or num > 1:
            raise ApiError(400, f"Invalid value for {key}")
    elif num < -1000 or num > 5000:
        raise ApiError(400, f"Invalid value for {key}")
    return num


def _sanitize_setting_value(key, value):
    if key in BOOLEAN_FIELDS:
        if not isinstance(value, bool):
            raise ApiError(400, f"Invalid value for {key}")
        return value
    if key in NUMERIC_FIELDS:
        return _sanitize_number(key, value)
    if key in COLOR_FIELDS:
        return normalize_hex_color(value, key)
    if key in ENUM_FIELDS:
        if value not in ENUM_FIELDS[key]:
            raise ApiError(400, f"Invalid value for {key}")
        return value
    if key == "model_path":
        return sanitize_link(value, "/static/sneaker.glb")
    if key.lower().endswith("_link") or key.lower().endswith("_url"):
        return sanitize_link(value)
    if key in TEXT_FIELDS:
        max_len = 12000 if key.startswith("policy_") else 500
        return clean_str(value, max_len)
    raise ApiError(400, f"Unexpected settings field: {key}")


def sanitize_settings_payload(body, existing=None):
    if not isinstance(body, dict):
        raise ApiError(400, "Settings payload must be an object")

    safe = {}
    legacy_primary = body.get("primary_color")
    existing_theme = (existing or {}).get("theme_settings") if isinstance(existing, dict) else None
    if "theme_settings" in body or legacy_primary is not None:
        safe["theme_settings"] = normalize_theme_settings(
            body.get("theme_settings"),
            existing=existing_theme,
            legacy_primary=legacy_primary,
            strict=True,
        )

    for key, value in body.items():
        if key == "theme_settings" or key == "primary_color":
            continue
        if key not in ALLOWED_SITE_SETTING_KEYS:
            raise ApiError(400, f"Unexpected settings field: {key}")
        if value is None:
            continue
        safe[key] = _sanitize_setting_value(key, value)
    return safe


def normalize_settings_response(data):
    if not isinstance(data, dict):
        data = {}
    normalized = {}
    theme = normalize_theme_settings(
        data.get("theme_settings"),
        legacy_primary=data.get("primary_color"),
        strict=False,
    )
    for key, value in data.items():
        if key in {"theme_settings", "primary_color"}:
            continue
        if key not in ALLOWED_SITE_SETTING_KEYS:
            continue
        try:
            normalized[key] = _sanitize_setting_value(key, value)
        except ApiError:
            continue
    normalized["theme_settings"] = theme
    normalized["primary_color"] = theme["primaryColor"]
    return normalized


def validate_order_payload(body):
    if not isinstance(body, dict):
        raise ApiError(400, "Order payload must be an object")
    if body.get("paymentMethod") != "cod":
        raise ApiError(400, "Unsupported payment method")

    items = body.get("items")
    if not isinstance(items, list) or not items:
        raise ApiError(400, "Order must contain at least one item")
    if len(items) > MAX_LINE_ITEMS:
        raise ApiError(400, "Too many cart items")

    seen = set()
    parsed_items = []
    for item in items:
        if not isinstance(item, dict):
            raise ApiError(400, "Invalid cart item")
        product_id = str(item.get("productId") or "").strip()
        raw_size = item.get("size", "")
        size_unit = normalize_size_unit(
            item.get("sizeUnit") if "sizeUnit" in item else item.get("size_unit"),
            infer_size_unit(raw_size),
        )
        size = clean_size_label(raw_size) if raw_size else ""
        color = clean_str(item.get("color", ""), 80)
        key = (product_id, size_unit, size, color)
        if not product_id:
            raise ApiError(400, "Missing product ID")
        if key in seen:
            raise ApiError(400, "Duplicate cart item")
        seen.add(key)
        try:
            qty = int(item.get("quantity"))
        except Exception:
            raise ApiError(400, "Invalid quantity")
        if qty < 1 or qty > MAX_QTY:
            raise ApiError(400, "Invalid quantity")
        parsed_items.append({"productId": product_id, "quantity": qty, "size": size, "sizeUnit": size_unit, "color": color})

    customer = body.get("customer")
    if not isinstance(customer, dict):
        raise ApiError(400, "Missing customer details")
    parsed_customer = {
        "name": clean_str(customer.get("name"), 100),
        "phone": clean_str(customer.get("phone"), 15),
        "line1": clean_str(customer.get("line1") or customer.get("address"), 200),
        "line2": clean_str(customer.get("line2"), 200),
        "city": clean_str(customer.get("city"), 100),
        "state": clean_str(customer.get("state"), 100),
        "pin": clean_str(customer.get("pin"), 6),
        "landmark": clean_str(customer.get("landmark"), 200),
    }
    for field in ("name", "phone", "line1", "city", "state", "pin"):
        if not parsed_customer[field]:
            raise ApiError(400, "Missing required customer details")
    return parsed_items, parsed_customer
