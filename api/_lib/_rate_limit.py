import hashlib
import json
import os
import time
from urllib.request import Request, urlopen
from api._lib._responses import ApiError
from api._lib._supabase import rest_request

_memory = {}
ROUTE_LIMITS = {
    'admin-login': (5, 900), 'admin-login-ip': (30, 900),
    'admin-read': (120, 60), 'admin-write': (30, 60),
    'order-create': (8, 600), 'upload': (20, 3600), 'search': (30, 60),
    'account-read': (120, 60), 'account-write': (20, 60), 'payment': (20, 60),
}
RATE_SCRIPT = """
local count = redis.call('INCR', KEYS[1])
if count == 1 then redis.call('EXPIRE', KEYS[1], ARGV[1]) end
local ttl = redis.call('TTL', KEYS[1])
if ttl < 0 then redis.call('EXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end
return {count, ttl}
"""


def _is_production():
    return os.environ.get('VERCEL_ENV') == 'production' or os.environ.get('NODE_ENV') == 'production'


def _upstash_configured():
    return bool(os.environ.get('UPSTASH_REDIS_REST_URL') and os.environ.get('UPSTASH_REDIS_REST_TOKEN'))


def client_ip(handler):
    headers = ('X-Vercel-Forwarded-For',) if _is_production() else ('X-Vercel-Forwarded-For', 'X-Real-IP', 'CF-Connecting-IP')
    for header in headers:
        value = handler.headers.get(header)
        if value: return value.split(',')[0].strip()
    return handler.client_address[0] if getattr(handler, 'client_address', None) else 'unknown'


def _subject_hash(subject):
    return hashlib.sha256(str(subject).encode()).hexdigest()[:24]


def _memory_check(key, limit, window):
    now = time.time()
    if len(_memory) > 4096:
        for old_key in list(_memory):
            if _memory[old_key]['reset'] <= now: del _memory[old_key]
    entry = _memory.get(key)
    if not entry or entry['reset'] <= now:
        entry = {'count': 0, 'reset': now + window}
        _memory[key] = entry
    entry['count'] += 1
    return entry['count'] <= limit, max(1, int(entry['reset'] - now + .999))


def _upstash_check(key, limit, window):
    request = Request(os.environ['UPSTASH_REDIS_REST_URL'].rstrip('/'),
        data=json.dumps(['EVAL', RATE_SCRIPT, '1', key, str(window)]).encode(),
        headers={'Authorization': 'Bearer ' + os.environ['UPSTASH_REDIS_REST_TOKEN'], 'Content-Type': 'application/json'}, method='POST')
    try:
        with urlopen(request, timeout=5) as response: data = json.loads(response.read())
        result = data.get('result')
        if data.get('error') or not isinstance(result, list) or len(result) != 2:
            raise ValueError('Invalid limiter response')
        count, ttl = result
        if type(count) is not int or type(ttl) is not int or count < 1 or ttl < 0:
            raise ValueError('Invalid limiter count')
        return count <= limit, max(1, ttl)
    except Exception as error:
        print('Rate limit store error: ' + type(error).__name__)
        raise ApiError(503, 'Rate limit unavailable')


def _database_check(key,limit,window):
    try:
        result=rest_request('POST','rpc/consume_api_rate_limit',{'p_key':key,'p_limit':limit,'p_window':window},timeout=5)
        if type(result.get('allowed')) is not bool or type(result.get('retry_after')) is not int or result['retry_after']<1:
            raise ValueError('Invalid limiter response')
        return result['allowed'],result['retry_after']
    except Exception:
        raise ApiError(503,'Rate limit unavailable')


def require_rate_limit(handler, route, subject=None):
    if route not in ROUTE_LIMITS: raise ApiError(500, 'Unknown rate limit route')
    limit, window = ROUTE_LIMITS[route]
    key = f'rl:{route}:{_subject_hash(subject if subject is not None else client_ip(handler))}'
    if _upstash_configured(): allowed, retry = _upstash_check(key, limit, window)
    elif _is_production(): allowed,retry=_database_check(key,limit,window)
    else: allowed, retry = _memory_check(key, limit, window)
    if not allowed: raise ApiError(429, 'Too many requests. Please try again later.', {'Retry-After': str(retry)})
