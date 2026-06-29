import re
from http.server import BaseHTTPRequestHandler
from urllib.parse import parse_qs, quote, urlparse

from api._lib.cors import handle_options, require_cors
from api._lib.http import ApiError, send_error, send_json
from api._lib.rate_limit import require_rate_limit
from api._lib.supabase import public_rest_request


PUBLIC_PRODUCT_SELECT = "id,name,brand,price,original_price,image,tag,category,size_unit,sizes,colors,stock,specs,out_of_stock,total_stock"


class handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        handle_options(self, "GET,OPTIONS", "Content-Type")

    def do_GET(self):
        cors = None
        try:
            cors = require_cors(self, "GET,OPTIONS", "Content-Type")
            require_rate_limit(self, "search")
            qs = parse_qs(urlparse(self.path).query)
            q = (qs.get("q", [""])[0]).strip()[:100]
            q = re.sub(r"<[^>]+>", "", q).strip()
            if not q or len(q) < 2:
                send_json(self, 200, [], cors)
                return
            enc = quote(q)
            data = public_rest_request(
                "GET",
                f"products?select={PUBLIC_PRODUCT_SELECT}&or=(name.ilike.*{enc}*,brand.ilike.*{enc}*)&limit=20",
            )
            send_json(self, 200, data, cors)
        except ApiError as exc:
            send_error(self, exc, cors)
        except Exception as exc:
            send_error(self, exc, cors)

    def log_message(self, *args):
        pass
