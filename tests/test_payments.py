import hashlib
import hmac
import io
import json
import os
import unittest
from unittest.mock import patch
from api import account, orders, payments
from api._lib import _checkout
from api._lib import _rate_limit, _auth
from api._lib._razorpay import signature_valid
from api._lib._responses import ApiError
from api._lib._validation import sanitize_settings_payload
from test_api import Handler, payload


USER = {'id':'11111111-1111-4111-8111-111111111111','email':'fixture@example.invalid'}


class PaymentTests(unittest.TestCase):
    def test_email_allowlist_requires_confirmed_email(self):
        with patch.dict(os.environ,{'ADMIN_EMAILS':'admin@example.invalid'}):
            self.assertFalse(_auth.is_admin_user({'email':'admin@example.invalid'}))
            self.assertTrue(_auth.is_admin_user({'email':'admin@example.invalid','email_confirmed_at':'fixture-time'}))

    def test_database_rate_limiter_fails_closed_on_invalid_or_unavailable_results(self):
        for value in ({'allowed':'true','retry_after':5},{'allowed':True,'retry_after':0}):
            with patch.object(_rate_limit,'rest_request',return_value=value):
                with self.assertRaises(ApiError):_rate_limit._database_check('fixture',1,60)
        with patch.object(_rate_limit,'rest_request',side_effect=ApiError(502,'Unavailable')):
            with self.assertRaises(ApiError):_rate_limit._database_check('fixture',1,60)

    def test_gateway_requires_server_configuration_and_strict_admin_switches(self):
        with patch.dict(os.environ,{},clear=True), patch.object(_checkout,'public_rest_request',return_value=[{'data':{'payment_methods':{'razorpay':True}}}]):
            self.assertFalse(_checkout.payment_methods()['razorpay'])
        with self.assertRaises(ApiError):sanitize_settings_payload({'payment_methods':{'razorpay':'true'}})
        with self.assertRaises(ApiError):sanitize_settings_payload({'payment_methods':{'unknown':True}})

    def test_online_checkout_requires_verified_customer_before_stock_changes(self):
        body=payload();body['paymentMethod']='razorpay';handler=Handler(body)
        with patch.object(orders,'require_cors'),patch.object(orders,'require_rate_limit'),patch.object(orders,'rest_request') as rpc:
            orders.handler.do_POST(handler)
            self.assertEqual(handler.status,401);rpc.assert_not_called()

    def test_customer_history_is_filtered_by_verified_id_and_hides_private_fields(self):
        handler=Handler({});handler.path='/api/account?resource=orders&user_id=someone-else'
        with patch.object(account,'require_cors'),patch.object(account,'require_rate_limit'),patch.object(account,'authenticate',return_value=USER), \
             patch.object(account,'rest_request',return_value=[{'id':1,'total':100,'items':[{'name':'Shoe','_stock_key':'secret'}],'notes':'private'}]) as database:
            account.handler.do_GET(handler)
            self.assertIn('user_id=eq.'+USER['id'],database.call_args.args[1])
            response=json.loads(handler.wfile.getvalue())['items'][0]
            self.assertNotIn('notes',response);self.assertNotIn('_stock_key',response['items'][0])

    def test_profile_identity_cannot_be_reassigned_by_the_request(self):
        handler=Handler({'id':'other-user','full_name':'Fixture'})
        with patch.object(account,'require_cors'),patch.object(account,'require_rate_limit'),patch.object(account,'authenticate',return_value=USER),patch.object(account,'rest_request') as database:
            account.handler.do_POST(handler)
            self.assertEqual(handler.status,200)
            self.assertEqual(database.call_args.args[2]['id'],USER['id'])

    def test_browser_signature_is_checked_against_stored_provider_order_and_never_marks_paid(self):
        secret='fixture-secret';stored='order_fixture1';payment='pay_fixture1'
        signature=hmac.new(secret.encode(),f'{stored}|{payment}'.encode(),hashlib.sha256).hexdigest()
        self.assertTrue(signature_valid(f'{stored}|{payment}'.encode(),signature,secret))
        handler=Handler({'orderId':1,'razorpay_order_id':stored,'razorpay_payment_id':payment,'razorpay_signature':signature});handler.path='/api/razorpay/verify'
        with patch.dict(os.environ,{'RAZORPAY_KEY_SECRET':secret}),patch.object(payments,'require_cors'),patch.object(payments,'require_rate_limit'),patch.object(payments,'authenticate',return_value=USER), \
             patch.object(payments,'owned_order',return_value={'razorpay_order_id':stored,'payment_status':'pending'}),patch.object(payments,'rest_request') as database:
            payments.handler.do_POST(handler)
            self.assertEqual(handler.status,200);database.assert_not_called()
            self.assertEqual(json.loads(handler.wfile.getvalue())['payment_status'],'pending')

    def test_tampered_webhooks_are_rejected_and_processing_errors_are_retryable(self):
        secret='fixture-webhook-secret';body={'event':'payment.captured'}
        def signed():
            handler=Handler(body);handler.path='/api/razorpay/webhook'
            raw=json.dumps(body).encode();handler.headers['X-Razorpay-Signature']=hmac.new(secret.encode(),raw,hashlib.sha256).hexdigest()
            return handler
        with patch.dict(os.environ,{'RAZORPAY_WEBHOOK_SECRET':secret}),patch.object(payments,'rest_request',side_effect=ApiError(502,'Retry')) as database:
            invalid=signed();invalid.headers['X-Razorpay-Signature']='0'*64;payments.handler.do_POST(invalid)
            self.assertEqual(invalid.status,400);database.assert_not_called()
            valid=signed();payments.handler.do_POST(valid);self.assertEqual(valid.status,502)


if __name__=='__main__':unittest.main()
