import base64
import hashlib
import hmac
import json
import os
import re
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from api._lib._responses import ApiError


def signature_valid(body, signature, secret):
    if not secret or not isinstance(signature, str) or not re.fullmatch(r'[0-9a-fA-F]{64}', signature): return False
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature.lower())


def gateway_request(path, body=None):
    key_id, secret = os.environ.get('RAZORPAY_KEY_ID'), os.environ.get('RAZORPAY_KEY_SECRET')
    if not key_id or not secret: raise ApiError(503, 'Online payment is unavailable')
    authorization = base64.b64encode(f'{key_id}:{secret}'.encode()).decode()
    request = Request('https://api.razorpay.com/v1/' + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers={'Authorization': 'Basic ' + authorization, 'Content-Type': 'application/json'},
        method='POST' if body is not None else 'GET')
    try:
        with urlopen(request, timeout=15) as response: return json.loads(response.read())
    except (HTTPError, URLError, TimeoutError, ValueError):
        raise ApiError(502, 'Unable to contact the payment provider. Retry this order from your account.')
