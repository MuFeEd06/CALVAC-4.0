import io
import json
import os
import unittest
from urllib.parse import parse_qs, urlparse
from unittest.mock import patch
from api import admin, orders, upload, store
from api._lib import _auth, _rate_limit
from api._lib._pagination import page_options, page_response, filter_value
from api._lib._responses import ApiError, read_json
from api._lib._validation import validate_order_payload, sanitize_settings_payload


def payload():
    return {'paymentMethod': 'cod', 'items': [{'productId': 1, 'quantity': 1, 'size': '8', 'sizeUnit': 'UK'}],
            'customer': {'name': 'John Doe', 'phone': '9876543210', 'line1': 'Street', 'city': 'City', 'state': 'State', 'pin': '123456'}}


class Handler:
    def __init__(self, body, key='test-idempotency-key-001'):
        raw = json.dumps(body).encode()
        self.headers = {'Content-Length': str(len(raw)), 'Idempotency-Key': key}
        self.rfile, self.wfile = io.BytesIO(raw), io.BytesIO()
        self.client_address = ('127.0.0.1', 1)
        self.status, self.sent_headers = None, {}
        self.path = '/api/products?limit=2'
    def send_response(self, status): self.status = status
    def send_header(self, name, value): self.sent_headers[name] = value
    def end_headers(self): pass


class ApiTests(unittest.TestCase):
    def test_invalid_catalog_requests_do_not_run_inventory_maintenance_or_database_reads(self):
        for query in ({'id':['bad']}, {'limit':['10000']}, {'after':['1&active=eq.false']}, {'max_price':['NaN']}):
            with self.subTest(query=query), patch.object(store,'refresh_expired_reservations') as maintenance, \
                 patch.object(store,'public_rest_request') as database:
                with self.assertRaises(ApiError):store._get_products(Handler({}),query,None)
                maintenance.assert_not_called();database.assert_not_called()

    def test_catalog_cards_omit_long_details_but_product_pages_keep_them(self):
        with patch.object(store,'refresh_expired_reservations'), patch.object(store,'public_rest_request',return_value=[]) as database:
            store._get_products(Handler({}),{'limit':['2']},None)
            selected=parse_qs(database.call_args.args[1].split('?',1)[1])['select'][0].split(',')
            self.assertNotIn('specs',selected);self.assertNotIn('stock',selected)
            self.assertIn('sizes',selected);self.assertIn('colors',selected)
        with patch.object(store,'refresh_expired_reservations'), patch.object(store,'public_rest_request',return_value=[{'id':1,'specs':'Material: Leather','stock':{'default|8':2}}]):
            handler=Handler({});store._get_products(handler,{'id':['1']},None)
            data=json.loads(handler.wfile.getvalue())
            self.assertEqual(data['specs'],'Material: Leather');self.assertEqual(data['stock'],{'default|8':2})

    def test_sale_links_use_the_sale_flag_including_legacy_tag_links(self):
        for query in ({'sale':['1']},{'tag':['sale']}):
            filters=parse_qs('&'.join(store._catalog_filters(query)))
            self.assertEqual(filters['on_sale'],['eq.true'])
            self.assertNotIn('tag',filters)

    def test_catalog_column_filters_match_without_literal_quotes_and_do_not_inject_parameters(self):
        for field,value in [('category','boots'),('category','crocs'),('category','girls'),('brand','New Balance'),('tag','new'),('brand','x&active=eq.false,or=(id.gt.0)')]:
            with self.subTest(field=field,value=value):
                filters=store._catalog_filters({field:[value]})
                query=parse_qs('&'.join(filters))
                self.assertEqual(query[field],['ilike.'+value])
                self.assertEqual(query['active'],['eq.true'])
                self.assertEqual(set(query),{field,'active'})

    def test_catalog_search_keeps_logical_filter_values_quoted(self):
        filters=store._catalog_filters({'q':['x),active.eq.false']})
        query=parse_qs('&'.join(filters))
        self.assertEqual(query['active'],['eq.true'])
        self.assertEqual(query['or'],['(name.ilike."*x),active.eq.false*",brand.ilike."*x),active.eq.false*")'])

    def test_duplicate_order_returns_a_bounded_cooldown_without_customer_data(self):
        handler = Handler(payload())
        with patch.object(orders,'require_cors'), patch.object(orders,'require_rate_limit'), patch.object(orders,'require_method'), \
             patch.object(orders,'rest_request',side_effect=[0,{'duplicate':True,'retry_after':120}]):
            orders.handler.do_POST(handler)
        self.assertEqual(handler.status,409)
        self.assertEqual(handler.sent_headers['Retry-After'],'120')
        response=json.loads(handler.wfile.getvalue())
        self.assertEqual(response['retryAfter'],120)
        self.assertNotIn('order',response)

    def test_particle_settings_preserve_separate_views_and_reject_unsafe_values(self):
        data={'hero_type':'particles','particle_hero':{'headline':'Form that\nmoves you.',
            'desktop':{'shoe':'retro-court-hi','scale':1,'x':0,'y':0},'mobile':{'shoe':'cloud-knit','scale':.8,'x':3,'y':-5}}}
        safe=sanitize_settings_payload(data)
        self.assertEqual(safe['particle_hero']['mobile']['shoe'],'cloud-knit')
        self.assertIn('\n',safe['particle_hero']['headline'])
        for view in ({'image':'javascript:alert(1)'},{'image':'https://example.com/shoe.png'},{'shoe':'missing'},{'scale':True},{'x':100}):
            with self.assertRaises(ApiError):sanitize_settings_payload({'particle_hero':{'mobile':view}})

    def test_legacy_orders_created_during_cutover_load_relational_items(self):
        handler = Handler({}); handler.path = '/api/x9k2/orders?limit=2'
        rows = [{'id': 9, 'items': [], 'checkout_v2': False},
                {'id': 8, 'items': [{'name': 'Snapshot'}], 'checkout_v2': True}]
        with patch.object(admin, 'require_rate_limit'), patch.object(admin, 'require_admin'), \
             patch.object(admin, 'rest_request', side_effect=[rows, [{'order_id': 9, 'name': 'Legacy item', 'qty': 1}]]) as database:
            admin._get_orders(handler, None)
            self.assertIn('order_id=in.(9)', database.call_args.args[1])
            response = json.loads(handler.wfile.getvalue())['items']
            self.assertEqual(response[0]['items'], [{'name': 'Legacy item', 'qty': 1}])
            self.assertEqual(response[1]['items'], [{'name': 'Snapshot'}])

    def test_order_rejects_bad_customer_and_noninteger_quantities(self):
        for field, value in [('phone', 'abcdef'), ('pin', '000000')]:
            body = payload(); body['customer'][field] = value
            with self.assertRaises(ApiError): validate_order_payload(body)
        for qty in (True, 1.5, 0, 11, '2'):
            body = payload(); body['items'][0]['quantity'] = qty
            with self.assertRaises(ApiError): validate_order_payload(body)
        for size in ('', None):
            body = payload(); body['items'][0]['size'] = size
            with self.assertRaises(ApiError): validate_order_payload(body)
        self.assertEqual(validate_order_payload(payload())[0][0]['quantity'], 1)

    def test_policy_roundtrip_preserves_paragraphs_and_lists(self):
        content = '# Policy\n\nParagraph\n\n- First\n- Second'
        self.assertEqual(sanitize_settings_payload({'policy_privacy': content})['policy_privacy'], content)

    def test_shape_and_body_size_validation(self):
        with self.assertRaises(ApiError): read_json(Handler([]))
        handler = Handler({}); handler.headers['Content-Length'] = '-1'
        with self.assertRaises(ApiError): read_json(handler)
        handler.headers['Content-Length'] = str(100_000)
        with self.assertRaises(ApiError) as error: read_json(handler)
        self.assertEqual(error.exception.status, 413)

    def test_server_uses_transactional_key_and_failed_requests_can_retry(self):
        first, retry = Handler(payload()), Handler(payload())
        with patch.object(orders, 'require_cors', return_value=None), patch.object(orders, 'require_rate_limit'), patch.object(orders,'require_method'), \
             patch.object(orders, 'rest_request') as rpc:
            self.retry_calls=0
            def respond(method,path,body,**kw):
                if path.endswith('expire_unpaid_orders'): return 0
                self.retry_calls+=1
                if self.retry_calls==1: raise ApiError(502,'Temporary failure')
                return {'id':5,'total':100,'status':'Pending','items':[]}
            rpc.side_effect=respond
            orders.handler.do_POST(first); orders.handler.do_POST(retry)
            self.assertEqual((first.status, retry.status), (502, 200))
            self.assertEqual(rpc.call_count, 4)
            self.assertEqual(rpc.call_args.args[1], 'rpc/create_order_with_stock_v4')
            self.assertEqual(rpc.call_args.args[2]['p_idempotency_key'], first.headers['Idempotency-Key'])

    def test_invalid_order_does_not_claim_idempotency_or_call_database(self):
        body = payload(); body['items'][0]['quantity'] = 11
        handler = Handler(body)
        with patch.object(orders, 'require_cors', return_value=None), patch.object(orders, 'rest_request') as rpc:
            orders.handler.do_POST(handler)
            self.assertEqual(handler.status, 400); rpc.assert_not_called()

    def test_fixed_window_recovers_without_denied_requests_extending_it(self):
        _rate_limit._memory.clear()
        for now, allowed in [(0, True), (10, True), (20, False), (59, False), (61, True)]:
            with patch.object(_rate_limit.time, 'time', return_value=now):
                result, _ = _rate_limit._memory_check('fixed', 2, 60)
                self.assertEqual(result, allowed)

    def test_redis_command_errors_fail_closed(self):
        class Response:
            def __enter__(self): return self
            def __exit__(self, *args): pass
            def read(self): return b'{"error":"WRONGTYPE"}'
        with patch.dict(os.environ, {'UPSTASH_REDIS_REST_URL': 'https://example.invalid', 'UPSTASH_REDIS_REST_TOKEN': 'mock'}), \
             patch.object(_rate_limit, 'urlopen', return_value=Response()):
            with self.assertRaises(ApiError) as error: _rate_limit._upstash_check('key', 2, 60)
            self.assertEqual(error.exception.status, 503)

    def test_permissions_require_trusted_admin_metadata(self):
        self.assertFalse(_auth.is_admin_user({'user_metadata': {'role': 'admin'}}))
        self.assertTrue(_auth.is_admin_user({'app_metadata': {'role': 'admin'}}))
        with self.assertRaises(ApiError): _auth.require_admin({})
        with patch.object(_auth, 'auth_get_user', return_value={'id': 'user', 'app_metadata': {}}):
            with self.assertRaises(ApiError) as error: _auth.require_admin({'Authorization': 'Bearer fake.token'})
            self.assertEqual(error.exception.status, 403)

    def test_pagination_and_public_active_filter(self):
        self.assertEqual(page_response([{'id': 1}, {'id': 2}, {'id': 3}], 2), {'items': [{'id': 1}, {'id': 2}], 'nextCursor': '2'})
        for query in ({'limit': ['500']}, {'after': ['1&active=eq.false']}):
            with self.assertRaises(ApiError): page_options(query)
        with patch.object(store,'refresh_expired_reservations'),patch.object(store, 'public_rest_request', return_value=[]) as database:
            handler = Handler({}); store._get_products(handler, {'limit': ['2']}, None)
            self.assertIn('active=eq.true', database.call_args.args[1])
            self.assertIn('limit=3', database.call_args.args[1])
        self.assertIn('%22', filter_value('x,price.gt.0'))

    def test_stdlib_multipart_upload_rejects_nonmultipart_and_enforces_admin(self):
        handler = Handler({})
        with patch.object(upload, 'require_cors', return_value=None), patch.object(upload, 'require_rate_limit'), \
             patch.object(upload, 'require_admin', side_effect=ApiError(401, 'Sign in')):
            upload.handler.do_POST(handler)
            self.assertEqual(handler.status, 401)
        handler = Handler({})
        with patch.object(upload, 'require_cors', return_value=None), patch.object(upload, 'require_rate_limit'), patch.object(upload, 'require_admin'):
            upload.handler.do_POST(handler)
            self.assertEqual(handler.status, 400)

    def test_stdlib_multipart_accepts_one_valid_image(self):
        image = bytearray(128)
        image[:8] = b'\x89PNG\r\n\x1a\n'
        image[16:20] = (16).to_bytes(4, 'big')
        image[20:24] = (16).to_bytes(4, 'big')
        raw = b'--test-boundary\r\nContent-Disposition: form-data; name="image"; filename="shoe.png"\r\nContent-Type: image/png\r\n\r\n' + image + b'\r\n--test-boundary--\r\n'
        handler = Handler({})
        handler.headers.update({'Content-Length': str(len(raw)), 'Content-Type': 'multipart/form-data; boundary=test-boundary'})
        handler.rfile = io.BytesIO(raw)
        with patch.object(upload, 'require_cors', return_value=None), patch.object(upload, 'require_rate_limit'), \
             patch.object(upload, 'require_admin'), patch.object(upload, '_upload_to_imagekit', return_value='https://ik.imagekit.io/test/shoe.png') as uploaded:
            upload.handler.do_POST(handler)
            self.assertEqual(handler.status, 200)
            self.assertEqual(uploaded.call_args.args[1:], ('shoe.png', 'image/png'))


if __name__ == '__main__': unittest.main()
