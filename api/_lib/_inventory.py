import time
from api._lib._supabase import rest_request

_last_sweep=0.0


def refresh_expired_reservations():
    """Bounded lazy cleanup keeps expired holds from making a quiet shop appear sold out."""
    global _last_sweep
    now=time.monotonic()
    if now-_last_sweep<30:return
    _last_sweep=now
    try:rest_request('POST','rpc/expire_unpaid_orders',{},timeout=5)
    except Exception:
        # Catalog availability does not depend on maintenance being reachable.
        # The checkout transaction still enforces stock and expiry authoritatively.
        print('Inventory reservation cleanup temporarily unavailable')
