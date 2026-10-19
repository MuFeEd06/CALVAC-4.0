import { test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

const user = '11111111-1111-4111-8111-111111111111';
const other = '22222222-2222-4222-8222-222222222222';
const customer = { name: 'Fixture Customer', phone: '9876543210', line1: 'Fixture Street', city: 'City', state: 'State', pin: '123456' };
const items = [{ productId: '1', size: '8', sizeUnit: 'UK', color: 'Red', quantity: 1 }];
let db: PGlite;
async function rpc(name: string, params: unknown[]) {
  return (await db.query<{value:any}>(`select public.${name}(${params.map((_, i) => '$' + (i + 1)).join(',')}) as value`, params)).rows[0].value;
}
const create = (method = 'razorpay', uid: string | null = user, key = 'payment-fixture-key-0001') => rpc('create_order_with_stock_v3', [JSON.stringify(items),JSON.stringify(customer),key,method,uid]);
const getOrder = async () => (await db.query('select * from orders order by id desc limit 1')).rows[0];
const event = (type = 'payment.captured', amount = 15000, currency = 'INR') => JSON.stringify({event:type,payload:{payment:{entity:{id:'pay_test1',order_id:'order_test1',amount,currency,status:type.split('.')[1]}}}});
before(async () => {
  db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    grant usage on schema public to anon,authenticated,service_role;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    insert into auth.users values('${user}'),('${other}');`);
  await db.exec(await readFile(new URL('./fixtures/live-schema.sql', import.meta.url),'utf8'));
  for (const name of ['20261019111147_checkout_hardening.sql','20261019111159_customer_payments.sql','20261019161008_hero_theme_whatsapp_cooldown.sql'])
    await db.exec(await readFile(new URL('../supabase/migrations/' + name, import.meta.url),'utf8'));
});
after(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`reset role; truncate products,orders,order_items,checkout_idempotency,payment_events,site_settings,profiles,api_rate_limits restart identity cascade;
    insert into site_settings(id,data) values(1,'{"payment_methods":{"whatsapp":true,"cod":true,"razorpay":true}}');
    insert into products(id,name,brand,price,sizes,colors,stock) values
    (1,'Fixture Shoe','Audit',100,'["UK 8"]','[{"name":"Red","price":150}]','{"default|UK 8":10}');`);
});
async function bind() {
  const order = await create();
  const claim = await rpc('claim_razorpay_order',[order.id,user]);
  await rpc('bind_razorpay_order',[order.id,user,claim.token,'order_test1']);
  return order;
}

test('online checkout requires an account, binds identity/method to retries, and honors disabled methods', async () => {
  await assert.rejects(create('razorpay',null),/Sign in required/);
  const first = await create();
  assert.equal((await create()).id,first.id);
  await assert.rejects(create('cod'),/already used/);
  await assert.rejects(create('razorpay',other),/already used/);
  await db.exec(`update site_settings set data='{"payment_methods":{"cod":false}}'`);
  await assert.rejects(create('cod',null,'disabled-payment-key-0001'),/unavailable/);
});

test('different WhatsApp request keys share a cooldown without another stock deduction; retries still replay',async()=>{
  const call=(key:string,cart=items,person=customer)=>rpc('create_order_with_stock_v4',[JSON.stringify(cart),JSON.stringify(person),key,'whatsapp',null]);
  const first=await call('whatsapp-first-key-0001');
  assert.equal((await call('whatsapp-first-key-0001')).id,first.id);
  const duplicate=await call('whatsapp-other-key-0002');
  assert.equal(duplicate.duplicate,true);assert.ok(duplicate.retry_after>0&&duplicate.retry_after<=300);
  assert.equal((await db.query('select count(*)::integer count from orders')).rows[0].count,1);
  assert.equal(JSON.parse((await db.query('select stock from products where id=1')).rows[0].stock as string)['default|UK 8'],9);
  // A changed address/name does not bypass the same-phone/cart guard.
  assert.equal((await call('whatsapp-other-key-0003',items,{...customer,name:'Changed',line1:'Different street'})).duplicate,true);
  assert.ok((await call('whatsapp-other-key-0004',items,{...customer,phone:'9876543211'})).id);
  await db.exec(`update orders set created_at=now()-interval '6 minutes' where id=${first.id}`);
  assert.ok((await call('whatsapp-other-key-0005')).id);
});

test('WhatsApp duplicate comparison is independent of cart order and cancellation releases the cooldown',async()=>{
  await db.exec(`insert into products(id,name,brand,price,sizes,colors,stock) select 2,name,brand,price,sizes,colors,stock from products where id=1`);
  const cart=[...items,{...items[0],productId:'2'}];
  const call=(key:string,value=cart)=>rpc('create_order_with_stock_v4',[JSON.stringify(value),JSON.stringify(customer),key,'whatsapp',null]);
  const first=await call('whatsapp-sort-key-0001');
  assert.equal((await call('whatsapp-sort-key-0002',[...cart].reverse())).duplicate,true);
  await rpc('set_order_status_v3',[first.id,'Cancelled']);
  assert.ok((await call('whatsapp-sort-key-0003')).id);
  await db.exec('set role anon');
  await assert.rejects(call('whatsapp-denied-key-0004'),/permission denied/);
});

test('a recent WhatsApp order from the preceding deployment also activates the cooldown',async()=>{
  await create('whatsapp',null,'whatsapp-preceding-version-001');
  const result=await rpc('create_order_with_stock_v4',[JSON.stringify(items),JSON.stringify(customer),'whatsapp-new-version-key-001','whatsapp',null]);
  assert.equal(result.duplicate,true);
  assert.equal((await db.query('select count(*)::integer count from orders')).rows[0].count,1);
});
test('provider orders are leased once, owned by the account, and reused after binding', async () => {
  const order = await create();
  await assert.rejects(rpc('claim_razorpay_order',[order.id,other]),/does not match/);
  const claim = await rpc('claim_razorpay_order',[order.id,user]);
  await assert.rejects(rpc('claim_razorpay_order',[order.id,user]),/already being prepared/);
  await rpc('bind_razorpay_order',[order.id,user,claim.token,'order_test1']);
  assert.equal((await rpc('claim_razorpay_order',[order.id,user])).provider_order_id,'order_test1');
});
test('capture and event deduplication commit together; failed events remain retryable', async () => {
  await bind();
  await assert.rejects(rpc('process_razorpay_event',['evt_one',event('payment.captured',14999)]),/amount or currency/);
  assert.equal((await db.query('select * from payment_events')).rows.length,0);
  await assert.rejects(rpc('process_razorpay_event',['evt_one',event('payment.captured',15000,'USD')]),/amount or currency/);
  await rpc('process_razorpay_event',['evt_one',event()]);
  assert.equal((await getOrder()).payment_status,'paid');
  assert.equal((await getOrder()).status,'Confirmed');
  assert.equal((await rpc('process_razorpay_event',['evt_one',event()])).duplicate,true);
  await rpc('process_razorpay_event',['evt_older_failed',event('payment.failed')]);
  assert.equal((await getOrder()).payment_status,'paid');
});
test('unpaid reservations expire and restore stock once; late capture requires refund review', async () => {
  const order = await bind();
  await assert.rejects(rpc('set_order_status_v3',[order.id,'Confirmed']),/not confirmed/);
  await db.exec(`update orders set payment_expires_at=now()-interval '1 second'`);
  assert.equal(await rpc('expire_unpaid_orders',[]),1);
  assert.equal(await rpc('expire_unpaid_orders',[]),0);
  assert.equal(JSON.parse((await db.query<{stock:string}>('select stock from products')).rows[0].stock)['default|UK 8'],10);
  await rpc('process_razorpay_event',['evt_late',event()]);
  assert.equal((await getOrder()).status,'Cancelled');
  assert.equal((await getOrder()).payment_status,'refund_required');
});
test('a webhook that precedes binding is retried rather than recorded as processed', async () => {
  await create();
  const payload = JSON.parse(event()); payload.payload.payment.entity.notes={store:'calvac-footwear'};
  await assert.rejects(rpc('process_razorpay_event',['evt_early',JSON.stringify(payload)]),/binding is pending/);
  assert.equal((await db.query('select * from payment_events')).rows.length,0);
});
test('profiles are private to their owner and payment RPCs are unavailable to browser roles', async () => {
  await db.exec(`insert into profiles(id,full_name) values('${user}','Private Fixture'); set role authenticated; set request.jwt.claim.sub='${other}';`);
  assert.equal((await db.query('select * from profiles')).rows.length,0);
  await assert.rejects(db.query(`insert into profiles(id) values('${user}')`),/row-level security/);
  await assert.rejects(create(),/permission denied/);
  await assert.rejects(db.query('select * from payment_events'),/permission denied/);
});

test('persistent rate limits recover on expiry and denied hits never extend the window', async () => {
  assert.equal((await rpc('consume_api_rate_limit',['fixture-limit',1,60])).allowed,true);
  const before=(await db.query('select reset_at from api_rate_limits')).rows[0].reset_at;
  assert.equal((await rpc('consume_api_rate_limit',['fixture-limit',1,60])).allowed,false);
  assert.deepEqual((await db.query('select reset_at from api_rate_limits')).rows[0].reset_at,before);
  await db.exec(`update api_rate_limits set reset_at=now()-interval '1 second'`);
  assert.equal((await rpc('consume_api_rate_limit',['fixture-limit',1,60])).allowed,true);
});
