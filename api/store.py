import json
import re
from decimal import Decimal, ROUND_CEILING, ROUND_FLOOR
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, quote, unquote, urlparse

from api._lib._cors import handle_options, require_cors
from api._lib._rate_limit import require_rate_limit
from api._lib._pagination import page_options, page_response, filter_value, column_filter_value
from api._lib._inventory import refresh_expired_reservations
from api._lib._responses import ApiError, send_error, send_json
from api._lib._supabase import public_rest_request
from api._lib._validation import clean_size_label, normalize_settings_response, normalize_size_unit


PUBLIC_PRODUCT_SELECT = "id,name,brand,price,original_price,image,tag,category,size_unit,sizes,colors,stock,specs,out_of_stock,total_stock"
PUBLIC_PRODUCT_SUMMARY_SELECT = "id,name,brand,price,original_price,image,tag,category,size_unit,sizes,colors,out_of_stock,total_stock"
DEFAULT_OFFER = {"active": False, "text": "", "bg_color": "#FF6B35", "text_color": "#ffffff", "show_logo": True}


def _query(handler):
    return parse_qs(urlparse(handler.path).query)


def _first(qs, key, default=""):
    values = qs.get(key)
    return values[0] if values else default


def _path_parts(handler):
    path = urlparse(handler.path).path
    return [unquote(part) for part in path.strip("/").split("/") if part]


def _resource(handler, qs):
    route = (_first(qs, "resource") or _first(qs, "route")).strip("/")
    if route:
        return route
    parts = _path_parts(handler)
    if len(parts) >= 2 and parts[0] == "api":
        return parts[1]
    raise ApiError(404, "Store route not found")


def _product_id(handler, qs):
    pid = _first(qs, "id")
    if pid:
        return pid
    parts = _path_parts(handler)
    try:
        index = parts.index("products")
    except ValueError:
        return ""
    if len(parts) > index + 1:
        return parts[index + 1]
    return ""


def _parse_array(val):
    if val is None:
        return []
    if isinstance(val, list):
        return val
    if not isinstance(val, str):
        return []
    val = val.strip()
    if not val:
        return []
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
        "id": p.get("id"),
        "name": str(p.get("name") or ""),
        "brand": str(p.get("brand") or ""),
        "price": float(p.get("price") or 0),
        "original_price": float(p["original_price"]) if p.get("original_price") else None,
        "image": str(p.get("image") or ""),
        "tag": p.get("tag") or "",
        "category": p.get("category") or "",
        "size_unit": _safe_size_unit(p.get("size_unit")),
        "sizes": _safe_sizes(p.get("sizes")),
        "colors": _parse_array(p.get("colors")),
        "stock": _parse_obj(p.get("stock")),
        "specs": str(p.get("specs") or ""),
        "out_of_stock": bool(p.get("out_of_stock")),
        "total_stock": p.get("total_stock"),
    }


PUBLIC_CACHE = {'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=15', 'Vercel-CDN-Cache-Control': 'max-age=15, stale-while-revalidate=15'}


def _catalog_filters(qs):
    filters = ['active=eq.true']
    for field in ('brand', 'tag', 'category'):
        value = _first(qs, field).strip()[:100]
        if field == 'tag' and value.lower() == 'sale': continue
        if value: filters.append(f'{field}=ilike.{column_filter_value(value)}')
    prices = {}
    for name, operator, rounding in (('max_price', 'lte', ROUND_FLOOR), ('min_price', 'gte', ROUND_CEILING)):
        value = _first(qs, name).strip()
        if value:
            if len(value) > 40 or not re.fullmatch(r'[0-9]+(?:\.[0-9]+)?', value):
                raise ApiError(400, 'Invalid price filter')
            number = Decimal(value)
            if not 0 <= number <= 1000000: raise ApiError(400, 'Invalid price filter')
            prices[name] = number
            # products.price is an integer; PostgREST rejects "1500.0".
            # Round decimal bounds without changing which integer prices match.
            filters.append(f'price={operator}.{int(number.to_integral_value(rounding=rounding))}')
    if prices.get('min_price', 0) > prices.get('max_price', 1000000):
        raise ApiError(400, 'Minimum price must not exceed maximum price')
    if _first(qs, 'sale') or _first(qs, 'tag').strip().lower() == 'sale': filters.append('on_sale=eq.true')
    query = _first(qs, 'q').strip()[:100]
    if query:
        pattern = filter_value('*' + query + '*')
        filters.append(f'or=(name.ilike.{pattern},brand.ilike.{pattern})')
    return filters


def _get_products(handler, qs, cors):
    pid = _product_id(handler, qs)
    filters = _catalog_filters(qs)
    if pid:
        if not re.fullmatch(r'[1-9][0-9]{0,18}', pid): raise ApiError(400, 'Invalid product ID')
        refresh_expired_reservations()
        rows = public_rest_request('GET', f'products?select={PUBLIC_PRODUCT_SELECT}&id=eq.{pid}&active=eq.true&limit=1')
        if not rows: raise ApiError(404, 'Product not found')
        body = _fix_product(rows[0])
    else:
        limit, cursor = page_options(qs, 24)
        if cursor: filters.append('id=gt.' + cursor)
        refresh_expired_reservations()
        rows = public_rest_request('GET', f'products?select={PUBLIC_PRODUCT_SUMMARY_SELECT}&order=id.asc&limit={limit + 1}&' + '&'.join(filters))
        body = page_response([_fix_product(row) for row in rows], limit)
    send_json(handler, 200, body, cors, PUBLIC_CACHE)


def _get_search(handler, qs, cors):
    query = _first(qs, 'q').strip()[:100]
    if len(query) < 2:
        send_json(handler, 200, [], cors, PUBLIC_CACHE)
        return
    require_rate_limit(handler, 'search')
    pattern = filter_value('*' + query + '*')
    rows = public_rest_request('GET', f'products?select={PUBLIC_PRODUCT_SUMMARY_SELECT}&active=eq.true&or=(name.ilike.{pattern},brand.ilike.{pattern})&order=id&limit=20')
    send_json(handler, 200, [_fix_product(row) for row in rows], cors, PUBLIC_CACHE)


def _get_site_settings(handler, cors):
    rows = public_rest_request("GET", "site_settings?select=data&limit=1")
    data = rows[0].get("data") or {} if rows else {}
    send_json(handler, 200, normalize_settings_response(data), cors, PUBLIC_CACHE)


def _get_offer(handler, cors):
    data = public_rest_request("GET", "offer?select=active,text,bg_color,text_color,show_logo&limit=1")
    send_json(handler, 200, data[0] if data else DEFAULT_OFFER, cors, PUBLIC_CACHE)


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, "GET,OPTIONS", "Content-Type")

    def do_GET(self):
        cors = None
        try:
            cors = require_cors(self, "GET,OPTIONS", "Content-Type")
            qs = _query(self)
            resource = _resource(self, qs)
            if resource == "products":
                _get_products(self, qs, cors)
            elif resource == "search":
                _get_search(self, qs, cors)
            elif resource == "site-settings":
                _get_site_settings(self, cors)
            elif resource == "offer":
                _get_offer(self, cors)
            else:
                raise ApiError(404, "Store route not found")
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
