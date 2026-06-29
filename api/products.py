import json
import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, quote, urlparse

from api._lib.cors import handle_options, require_cors
from api._lib.http import ApiError, send_error, send_json
from api._lib.supabase import public_rest_request
from api._lib.validation import clean_size_label, normalize_size_unit


PUBLIC_PRODUCT_SELECT = "id,name,brand,price,original_price,image,tag,category,size_unit,sizes,colors,stock,specs,out_of_stock,total_stock"


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


def _fix(p):
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


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, "GET,OPTIONS", "Content-Type")

    def do_GET(self):
        cors = None
        try:
            cors = require_cors(self, "GET,OPTIONS", "Content-Type")
            qs = parse_qs(urlparse(self.path).query)
            if "id" in qs:
                pid = quote(qs["id"][0], safe="")
                data = public_rest_request("GET", f"products?select={PUBLIC_PRODUCT_SELECT}&id=eq.{pid}&limit=1")
                if not data:
                    raise ApiError(404, "Product not found")
                body = _fix(data[0])
            else:
                data = public_rest_request("GET", f"products?select={PUBLIC_PRODUCT_SELECT}&order=id&limit=500")
                body = [_fix(p) for p in data]
            send_json(self, 200, body, cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
