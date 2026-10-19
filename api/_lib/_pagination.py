from urllib.parse import quote
from api._lib._responses import ApiError


def page_options(qs, default=50):
    try:
        limit = int(qs.get('limit', [default])[0])
        cursor = str(qs.get('after', [''])[0])
        if limit < 1 or limit > 100 or (cursor and (not cursor.isdigit() or len(cursor) > 19)):
            raise ValueError()
    except (ValueError, TypeError):
        raise ApiError(400, 'Invalid pagination')
    return limit, cursor


def page_response(rows, limit):
    rows = rows if isinstance(rows, list) else []
    items = rows[:limit]
    return {'items': items, 'nextCursor': str(items[-1]['id']) if len(rows) > limit and items else None}


def filter_value(value):
    """Quote PostgREST filter grammar as well as URL-encoding the value."""
    return quote('"' + str(value).replace('\\', '\\\\').replace('"', '\\"') + '"', safe='')
