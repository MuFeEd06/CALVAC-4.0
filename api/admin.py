import json
import math
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, quote, unquote, urlparse

from api._lib._auth import require_admin
from api._lib._cors import handle_options, require_cors
from api._lib._rate_limit import require_rate_limit
from api._lib._pagination import page_options, page_response, filter_value
from api._lib._responses import ApiError, read_json, send_error, send_json
from api._lib._supabase import rest_request
from api._lib._validation import (
    clean_size_label,
    clean_str,
    is_safe_url,
    normalize_settings_response,
    normalize_size_list,
    normalize_size_unit,
    sanitize_settings_payload,
)


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
STATUSES = {"Pending", "Confirmed", "Shipped", "Delivered", "Cancelled"}
ADMIN_METHODS = {
    "products": "GET,POST,PUT,DELETE,OPTIONS",
    "orders": "GET,PATCH,OPTIONS",
    "site-settings": "GET,POST,OPTIONS",
    "offer": "GET,POST,OPTIONS",
}
ALL_ADMIN_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS"


def _query(handler):
    return parse_qs(urlparse(handler.path).query)


def _first(qs, key, default=""):
    values = qs.get(key)
    return values[0] if values else default


def _path_parts(handler):
    path = urlparse(handler.path).path
    return [unquote(part) for part in path.strip("/").split("/") if part]


def _resource(handler):
    qs = _query(handler)
    resource = (_first(qs, "resource") or _first(qs, "route")).strip("/")
    if not resource:
        parts = _path_parts(handler)
        if "x9k2" in parts:
            index = parts.index("x9k2")
            if len(parts) > index + 1:
                resource = parts[index + 1]
        elif "admin" in parts:
            index = parts.index("admin")
            if len(parts) > index + 1:
                resource = parts[index + 1]
    resource = resource.replace("_", "-")
    if resource not in ADMIN_METHODS:
        raise ApiError(404, "Admin route not found")
    return resource


def _admin_cors(handler, resource):
    return require_cors(handler, ADMIN_METHODS.get(resource, ALL_ADMIN_METHODS))


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


def _fix_product(p):
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
    payload["specs"] = clean_str(payload.get("specs", ""), 2000, multiline=True)
    image = clean_str(payload.get("image", ""), 500)
    if image and not is_safe_url(image):
        raise ApiError(400, "Invalid product image URL")
    payload["image"] = image
    for key in ("price", "original_price"):
        try:
            value = float(payload.get(key) or 0)
            if not math.isfinite(value) or value < 0 or value > 1000000: raise ValueError()
            payload[key] = round(value, 2)
        except Exception:
            raise ApiError(400, "Invalid product price")
    if payload['price'] <= 0: raise ApiError(400, 'Product price must be positive')
    if payload['original_price'] and payload['original_price'] < payload['price']: raise ApiError(400, 'MRP must not be below price')
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
            price = float(color.get('price') or 0)
            if not math.isfinite(price) or price < 0 or price > 1000000: raise ValueError()
            price = round(price, 2)
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


def _clean_offer(body):
    if not isinstance(body, dict): raise ApiError(400, 'Offer must be an object')
    if type(body.get('active', False)) is not bool or type(body.get('show_logo', True)) is not bool:
        raise ApiError(400, 'Invalid offer flag')
    bg = clean_str(body.get('bg_color', '#FF6B35'), 20)
    fg = clean_str(body.get('text_color', '#FFFFFF'), 20)
    if not HEX_RE.fullmatch(bg) or not HEX_RE.fullmatch(fg): raise ApiError(400, 'Invalid offer color')
    return {'active': body.get('active', False), 'text': clean_str(body.get('text', ''), 300), 'bg_color': bg, 'text_color': fg, 'show_logo': body.get('show_logo', True)}


def _get_products(handler, cors):
    require_rate_limit(handler, 'admin-read')
    require_admin(handler.headers)
    qs = _query(handler)
    limit, cursor = page_options(qs)
    filters = []
    if cursor: filters.append('id=gt.' + cursor)
    if _first(qs, 'brand'): filters.append('brand=ilike.' + filter_value(_first(qs, 'brand')[:100]))
    query = _first(qs, 'q').strip()[:100]
    if query:
        pattern = filter_value('*' + query + '*')
        filters.append(f'or=(name.ilike.{pattern},brand.ilike.{pattern})')
    rows = rest_request('GET', f'products?select=*&order=id.asc&limit={limit + 1}&' + '&'.join(filters))
    send_json(handler, 200, page_response([_fix_product(row) for row in rows], limit), cors)


def _write_product(handler, cors, method):
    require_rate_limit(handler, "admin-write")
    require_admin(handler.headers)
    body = _clean_product_payload(read_json(handler, 128 * 1024))
    if method == "POST":
        data = rest_request("POST", "products", body, "return=representation")
    else:
        qs = _query(handler)
        pid = quote(_first(qs, "id"), safe="")
        if not pid:
            raise ApiError(400, "Missing product ID")
        data = rest_request("PATCH", f"products?id=eq.{pid}", body, "return=representation")
    result = data[0] if isinstance(data, list) and data else data
    send_json(handler, 200, {"success": True, "product": result}, cors)


def _delete_product(handler, cors):
    require_rate_limit(handler, "admin-write")
    require_admin(handler.headers)
    qs = _query(handler)
    pid = quote(_first(qs, "id"), safe="")
    if not pid:
        raise ApiError(400, "Missing product ID")
    rest_request("DELETE", f"products?id=eq.{pid}")
    send_json(handler, 200, {"success": True}, cors)


def _get_orders(handler, cors):
    require_rate_limit(handler, 'admin-read')
    require_admin(handler.headers)
    qs = _query(handler)
    limit, cursor = page_options(qs)
    query = f'orders?select=*&order=id.desc&limit={limit + 1}'
    if cursor: query += '&id=lt.' + cursor
    status = _first(qs, 'status')
    if status:
        if status not in STATUSES: raise ApiError(400, 'Invalid order status')
        query += '&status=eq.' + quote(status, safe='')
    rows = rest_request('GET', query)
    # The old storefront may still write relational items during the cutover.
    legacy = {str(row['id']): row for row in rows
              if not row.get('checkout_v2') and not row.get('items')}
    if legacy:
        item_rows = rest_request('GET', 'order_items?select=order_id,product_id,name,brand,size,color,qty,price,image'
                                 '&order_id=in.(' + ','.join(legacy) + ')&order=id.asc')
        for row in legacy.values():
            row['items'] = []
        for item in item_rows:
            order = legacy.get(str(item.get('order_id')))
            if order is not None:
                order['items'].append({key: value for key, value in item.items() if key != 'order_id'})
    send_json(handler, 200, page_response(rows, limit), cors)


def _patch_order(handler, cors):
    require_rate_limit(handler, "admin-write")
    require_admin(handler.headers)
    qs = _query(handler)
    oid = quote(_first(qs, "id"), safe="")
    action = _first(qs, "action", "status")
    if not oid:
        raise ApiError(400, "Missing order ID")
    body = read_json(handler, 16 * 1024)
    if action == "status":
        status = clean_str(body.get("status"), 40)
        if status not in STATUSES:
            raise ApiError(400, "Invalid order status")
        rest_request('POST', 'rpc/set_order_status_v3', {'p_order_id': oid, 'p_status': status})
        send_json(handler, 200, {'success': True}, cors)
        return
    elif action == "notes":
        patch = {"notes": clean_str(body.get("notes", ""), 1000)}
    else:
        raise ApiError(400, "Invalid order action")
    rest_request("PATCH", f"orders?id=eq.{oid}", patch)
    send_json(handler, 200, {"success": True}, cors)


def _get_settings(handler, cors):
    require_rate_limit(handler, "admin-read")
    require_admin(handler.headers)
    rows = rest_request("GET", "site_settings?select=data&limit=1")
    data = (rows[0].get("data") or {}) if rows else {}
    send_json(handler, 200, normalize_settings_response(data), cors, {"Cache-Control": "no-store"})


def _save_settings(handler, cors):
    require_rate_limit(handler, "admin-write")
    require_admin(handler.headers)
    rows = rest_request("GET", "site_settings?select=id,data&limit=1")
    existing = normalize_settings_response((rows[0].get("data") or {}) if rows else {})
    body = sanitize_settings_payload(read_json(handler, 128 * 1024), existing)
    merged = {**existing, **body}
    merged.pop("primary_color", None)
    if rows:
        row_id = rows[0]["id"]
        rest_request("PATCH", f"site_settings?id=eq.{row_id}", {"data": merged}, "return=minimal", timeout=15)
    else:
        rest_request("POST", "site_settings", {"data": merged}, "return=minimal", timeout=15)
    send_json(
        handler,
        200,
        {"success": True, "settings": normalize_settings_response(merged)},
        cors,
        {"Cache-Control": "no-store"},
    )


def _get_offer(handler, cors):
    require_rate_limit(handler, "admin-read")
    require_admin(handler.headers)
    data = rest_request("GET", "offer?select=*&limit=1")
    send_json(handler, 200, data[0] if data else {}, cors)


def _save_offer(handler, cors):
    require_rate_limit(handler, "admin-write")
    require_admin(handler.headers)
    body = _clean_offer(read_json(handler, 16 * 1024))
    existing = rest_request("GET", "offer?select=id&limit=1")
    if existing:
        rest_request("PATCH", f"offer?id=eq.{existing[0]['id']}", body)
    else:
        rest_request("POST", "offer", body)
    send_json(handler, 200, {"success": True}, cors)


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        try:
            methods = ADMIN_METHODS.get(_resource(self), ALL_ADMIN_METHODS)
        except ApiError:
            methods = ALL_ADMIN_METHODS
        handle_options(self, methods)

    def do_GET(self):
        self._dispatch("GET")

    def do_POST(self):
        self._dispatch("POST")

    def do_PUT(self):
        self._dispatch("PUT")

    def do_PATCH(self):
        self._dispatch("PATCH")

    def do_DELETE(self):
        self._dispatch("DELETE")

    def _dispatch(self, method):
        cors = None
        try:
            resource = _resource(self)
            cors = _admin_cors(self, resource)
            if resource == "products" and method == "GET":
                _get_products(self, cors)
            elif resource == "products" and method in {"POST", "PUT"}:
                _write_product(self, cors, method)
            elif resource == "products" and method == "DELETE":
                _delete_product(self, cors)
            elif resource == "orders" and method == "GET":
                _get_orders(self, cors)
            elif resource == "orders" and method == "PATCH":
                _patch_order(self, cors)
            elif resource == "site-settings" and method == "GET":
                _get_settings(self, cors)
            elif resource == "site-settings" and method == "POST":
                _save_settings(self, cors)
            elif resource == "offer" and method == "GET":
                _get_offer(self, cors)
            elif resource == "offer" and method == "POST":
                _save_offer(self, cors)
            else:
                raise ApiError(405, "Method not allowed")
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
