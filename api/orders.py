import json
import re
from http.server import BaseHTTPRequestHandler

from api._lib._cors import handle_options, require_cors
from api._lib._rate_limit import require_rate_limit, reserve_idempotency_key
from api._lib._responses import ApiError, read_json, send_error, send_json
from api._lib._supabase import public_rest_request, rest_request
from api._lib._validation import money_to_paise, paise_to_rupees_string, validate_order_payload


ORDER_PRODUCT_SELECT = "id,name,brand,price,image,active,out_of_stock,size_unit,sizes,stock,total_stock"


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


def _safe_id(value):
    value = str(value)
    if not re.fullmatch(r"[A-Za-z0-9_-]+", value):
        raise ApiError(400, "Invalid product ID")
    return value


def _fetch_products(ids):
    safe_ids = [_safe_id(pid) for pid in ids]
    selector = ",".join(safe_ids)
    rows = public_rest_request("GET", f"products?select={ORDER_PRODUCT_SELECT}&id=in.({selector})")
    by_id = {str(row.get("id")): row for row in rows if row.get("id") is not None}
    return by_id


def _stock_key(product, item):
    stock = _parse_obj(product.get("stock"))
    color = item.get("color") or "default"
    size = item.get("size") or ""
    candidates = []
    if size:
        candidates.extend([f"{color}|{size}", f"default|{size}"])
    candidates.append(color)
    for key in candidates:
        if key in stock:
            return key, stock
    return None, stock


def _assert_available(product, item):
    if product.get("active") is False or product.get("out_of_stock") is True:
        raise ApiError(400, "Product is unavailable")
    qty = item["quantity"]
    key, stock = _stock_key(product, item)
    if key is not None:
        try:
            available = int(stock.get(key) or 0)
        except Exception:
            raise ApiError(400, "Product stock is unavailable")
        if available < qty:
            raise ApiError(400, "Insufficient stock")
    elif product.get("total_stock") is not None:
        try:
            if int(product.get("total_stock") or 0) < qty:
                raise ApiError(400, "Insufficient stock")
        except ApiError:
            raise
        except Exception:
            pass


def _decrement_stock(product, item):
    key, stock = _stock_key(product, item)
    if key is None:
        return
    stock[key] = max(0, int(stock.get(key) or 0) - item["quantity"])
    rest_request("PATCH", f"products?id=eq.{_safe_id(product.get('id'))}", {"stock": stock}, "return=minimal")


def _build_order(items, customer):
    products = _fetch_products([item["productId"] for item in items])
    snapshots = []
    total_paise = 0
    stock_products = []
    for item in items:
        product = products.get(item["productId"])
        if not product:
            raise ApiError(400, "Product does not exist")
        _assert_available(product, item)
        qty = item["quantity"]
        unit_paise = money_to_paise(product.get("price"))
        line_paise = unit_paise * qty
        total_paise += line_paise
        snapshots.append({
            "product_id": product.get("id"),
            "name": str(product.get("name") or "")[:200],
            "brand": str(product.get("brand") or "")[:100],
            "size": item.get("size") or "",
            "size_unit": item.get("sizeUnit") or "UK",
            "color": item.get("color") or "",
            "qty": qty,
            "unit_price_paise": unit_paise,
            "line_total_paise": line_paise,
            "price": paise_to_rupees_string(unit_paise),
            "image": str(product.get("image") or "")[:500],
        })
        stock_products.append((product, item))
    row = {
        "name": customer["name"],
        "phone": customer["phone"],
        "line1": customer["line1"],
        "line2": customer["line2"],
        "city": customer["city"],
        "state": customer["state"],
        "pin": customer["pin"],
        "landmark": customer["landmark"],
        "total": paise_to_rupees_string(total_paise),
        "status": "Pending",
        "items": snapshots,
    }
    return row, stock_products


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, "POST,OPTIONS")

    def do_POST(self):
        cors = None
        try:
            cors = require_cors(self, "POST,OPTIONS")
            require_rate_limit(self, "order-create")
            reserve_idempotency_key(self.headers.get("Idempotency-Key", ""))
            body = read_json(self, 64 * 1024)
            items, customer = validate_order_payload(body)
            created = rest_request(
                "POST",
                "rpc/create_order_with_stock",
                {"p_items": items, "p_customer": customer},
                timeout=20,
            )
            order = created[0] if isinstance(created, list) and created else created
            send_json(self, 200, {"success": True, "order": order}, cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
