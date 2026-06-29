import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, quote, urlparse

from api._lib.auth import require_admin
from api._lib.cors import handle_options, require_cors
from api._lib.http import ApiError, read_json, send_error, send_json
from api._lib.rate_limit import require_rate_limit
from api._lib.supabase import rest_request
from api._lib.validation import clean_size_label, clean_str, is_safe_url, normalize_size_list, normalize_size_unit


ALLOWED_PRODUCT_FIELDS = {
    "name",
    "brand",
    "price",
    "original_price",
    "image",
    "tag",
    "category",
    "size_unit",
    "sizes",
    "colors",
    "stock",
    "specs",
    "total_stock",
    "out_of_stock",
    "active",
}
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")


def _parse_array(val):
    if val is None:
        return []
    if isinstance(val, list):
        return val
    if not isinstance(val, str) or not val.strip():
        return []
    val = val.strip()
    if val.startswith("["):
        try:
            return json.loads(val)
        except Exception:
            return []
    if val.startswith("{") and val.endswith("}"):
        inner = val[1:-1]
        items = []
        for item in re.split(r',(?=(?:[^"]*"[^"]*")*[^"]*$)', inner):
            item = item.strip().strip('"')
            if item:
                items.append(item)
        return items
    return []


def _parse_obj(val):
    if val is None:
        return {}
    if isinstance(val, dict):
        return val
    if not isinstance(val, str):
        return {}
    try:
        return json.loads(val)
    except Exception:
        return {}


def _safe_size_unit(value):
    try:
        return normalize_size_unit(value, "UK")
    except ApiError:
        return "UK"


def _safe_sizes(value):
    sizes = []
    seen = set()
    for raw in _parse_array(value):
        try:
            size = clean_size_label(raw)
        except ApiError:
            continue
        key = size.lower()
        if key in seen:
            continue
        seen.add(key)
        sizes.append(size)
        if len(sizes) >= 40:
            break
    return sizes


def _fix(p):
    return {
        **p,
        "size_unit": _safe_size_unit(p.get("size_unit")),
        "sizes": _safe_sizes(p.get("sizes")),
        "colors": _parse_array(p.get("colors")),
        "stock": _parse_obj(p.get("stock")),
    }


def _clean_product_payload(body):
    if not isinstance(body, dict):
        raise ApiError(400, "Product payload must be an object")
    unexpected = set(body.keys()) - ALLOWED_PRODUCT_FIELDS - {"id"}
    if unexpected:
        raise ApiError(400, f"Unexpected product field: {sorted(unexpected)[0]}")
    payload = {key: body.get(key) for key in ALLOWED_PRODUCT_FIELDS if key in body}
    payload["name"] = clean_str(payload.get("name"), 200)
    payload["brand"] = clean_str(payload.get("brand"), 100)
    if not payload["name"] or not payload["brand"]:
        raise ApiError(400, "Missing product name or brand")
    payload["tag"] = clean_str(payload.get("tag", ""), 50)
    payload["category"] = clean_str(payload.get("category", ""), 50)
    payload["specs"] = clean_str(payload.get("specs", ""), 2000)
    image = clean_str(payload.get("image", ""), 500)
    if image and not is_safe_url(image):
        raise ApiError(400, "Invalid product image URL")
    payload["image"] = image
    for key in ("price", "original_price"):
        try:
            payload[key] = max(0, min(float(payload.get(key) or 0), 1000000))
        except Exception:
            raise ApiError(400, "Invalid product price")
    payload["size_unit"] = normalize_size_unit(payload.get("size_unit"), "UK")
    raw_sizes = payload.get("sizes", [])
    payload["sizes"] = normalize_size_list([] if raw_sizes is None else raw_sizes)

    colors = payload.get("colors") or []
    if not isinstance(colors, list) or len(colors) > 50:
        raise ApiError(400, "Invalid product colors")
    clean_colors = []
    for color in colors:
        if not isinstance(color, dict):
            raise ApiError(400, "Invalid product color")
        hex_value = clean_str(color.get("hex"), 20)
        if hex_value and not HEX_RE.match(hex_value):
            raise ApiError(400, "Invalid color hex")
        image_url = clean_str(color.get("image", ""), 500)
        if image_url and not is_safe_url(image_url):
            raise ApiError(400, "Invalid color image URL")
        try:
            price = max(0, min(float(color.get("price") or 0), 1000000))
        except Exception:
            raise ApiError(400, "Invalid color price")
        clean_colors.append({
            "name": clean_str(color.get("name"), 80),
            "hex": hex_value,
            "price": price if price else None,
            "image": image_url,
        })
    payload["colors"] = clean_colors

    stock = payload.get("stock") or {}
    if not isinstance(stock, dict) or len(stock) > 500:
        raise ApiError(400, "Invalid stock")
    clean_stock = {}
    for key, value in stock.items():
        stock_key = clean_str(key, 120)
        if not stock_key:
            continue
        try:
            qty = int(value)
        except Exception:
            raise ApiError(400, "Invalid stock quantity")
        clean_stock[stock_key] = max(0, min(qty, 100000))
    payload["stock"] = clean_stock

    if "total_stock" in payload:
        try:
            payload["total_stock"] = max(0, min(int(payload.get("total_stock") or 0), 100000))
        except Exception:
            raise ApiError(400, "Invalid total stock")
    if "out_of_stock" in payload and not isinstance(payload["out_of_stock"], bool):
        raise ApiError(400, "Invalid stock flag")
    if "active" in payload and not isinstance(payload["active"], bool):
        raise ApiError(400, "Invalid active flag")
    return payload


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, "GET,POST,PUT,DELETE,OPTIONS")

    def do_GET(self):
        cors = None
        try:
            cors = require_cors(self, "GET,POST,PUT,DELETE,OPTIONS")
            require_rate_limit(self, "admin-read")
            require_admin(self.headers)
            data = rest_request("GET", "products?select=*&order=id&limit=500")
            rows = [_fix(p) for p in (data if isinstance(data, list) else [])]
            send_json(self, 200, rows, cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def do_POST(self):
        self._write("POST")

    def do_PUT(self):
        self._write("PUT")

    def do_DELETE(self):
        cors = None
        try:
            cors = require_cors(self, "GET,POST,PUT,DELETE,OPTIONS")
            require_rate_limit(self, "admin-write")
            require_admin(self.headers)
            qs = parse_qs(urlparse(self.path).query)
            pid = quote(qs.get("id", [""])[0], safe="")
            if not pid:
                raise ApiError(400, "Missing product ID")
            rest_request("DELETE", f"products?id=eq.{pid}")
            send_json(self, 200, {"success": True}, cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def _write(self, method):
        cors = None
        try:
            cors = require_cors(self, "GET,POST,PUT,DELETE,OPTIONS")
            require_rate_limit(self, "admin-write")
            require_admin(self.headers)
            body = _clean_product_payload(read_json(self, 128 * 1024))
            if method == "POST":
                data = rest_request("POST", "products", body, "return=representation")
            else:
                qs = parse_qs(urlparse(self.path).query)
                pid = quote(qs.get("id", [""])[0], safe="")
                if not pid:
                    raise ApiError(400, "Missing product ID")
                data = rest_request("PATCH", f"products?id=eq.{pid}", body, "return=representation")
            result = data[0] if isinstance(data, list) and data else data
            send_json(self, 200, {"success": True, "product": result}, cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
