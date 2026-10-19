import os

from api._lib._responses import ApiError
from api._lib._supabase import public_rest_request


METHODS = ('whatsapp', 'cod', 'razorpay')
DEFAULT_METHODS = {'whatsapp': True, 'cod': True, 'razorpay': False}


def gateway_ready():
    return all(os.environ.get(key) for key in ('RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET'))


def payment_methods():
    rows = public_rest_request('GET', 'site_settings?select=data&limit=1')
    data = rows[0].get('data') or {} if rows else {}
    raw = data.get('payment_methods') or {}
    methods = {key: raw.get(key, value) is True for key, value in DEFAULT_METHODS.items()}
    methods['razorpay'] = methods['razorpay'] and gateway_ready()
    return methods


def require_method(method):
    if method not in METHODS:
        raise ApiError(400, 'Invalid payment method')
    if not payment_methods()[method]:
        raise ApiError(403, 'This payment method is currently unavailable')


def public_order(order):
    result = {key: order.get(key) for key in (
        'id', 'total', 'status', 'payment_method', 'payment_status', 'created_at', 'payment_expires_at')}
    result['items'] = [{key: item.get(key) for key in (
        'product_id', 'name', 'brand', 'qty', 'size', 'size_unit', 'color', 'price', 'image')}
        for item in (order.get('items') or []) if isinstance(item, dict)]
    return result
