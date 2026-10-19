import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve('dist');
const artifact = resolve('test-results');
await mkdir(artifact, { recursive: true });
const product = { id: 1, name: 'Audit Sneaker', brand: 'Audit', price: 100, image: '/product-placeholder.svg', size_unit: 'UK', sizes: ['8'], colors: [{ name: 'Red', hex: '#FF0000', price: 150 }, { name: 'Blue', hex: '#0000FF', price: 120 }], stock: { 'Red|8': 5, 'Blue|8': 0 }, tag: 'new' };
const calls = [], orderKeys = [];
let orderAttempts = 0;
let paymentPaid=false,paymentVerifications=0;
const customerFixture={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'customer@example.invalid',app_metadata:{provider:'email'},user_metadata:{full_name:'Customer Fixture'},created_at:new Date().toISOString()};
function customerSession(){
  const encode=value=>Buffer.from(JSON.stringify(value)).toString('base64url');
  return {access_token:`${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:customerFixture.id,exp:Math.floor(Date.now()/1000)+3600,role:'authenticated'})}.fixture`,refresh_token:'fixture-refresh-token',expires_in:3600,token_type:'bearer',user:customerFixture};
}
const paymentOrder=()=>({id:8,total:150,status:paymentPaid?'Confirmed':'Pending',payment_method:'razorpay',payment_status:paymentPaid?'paid':'pending',items:[{name:'Audit Sneaker',qty:1,size:'8',size_unit:'UK',color:'Red',price:150}],created_at:new Date().toISOString()});
const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    calls.push(url.pathname);
    if (url.pathname.startsWith('/api/')) {
      response.setHeader('Content-Type', 'application/json');
      let result = {};
      if(url.pathname==='/api/checkout-config')result={methods:{whatsapp:true,cod:true,razorpay:false}};
      if(url.pathname==='/api/account'){
        assert.ok(request.headers.authorization?.startsWith('Bearer '),'account requests must include the signed-in session');
        result=url.searchParams.get('resource')==='orders'?{items:[paymentOrder()],nextCursor:null}:{user:customerFixture,profile:{full_name:'Customer Fixture',phone:'9876543210',address:null}};
      }
      if(url.pathname==='/api/razorpay/create-order'){
        assert.ok(request.headers.authorization?.startsWith('Bearer '));
        result={id:'order_fixture',amount:15000,currency:'INR',keyId:'rzp_test_fixture'};
      }
      if(url.pathname==='/api/razorpay/verify'){
        assert.ok(request.headers.authorization?.startsWith('Bearer '));paymentVerifications++;
        result={success:true,payment_status:'pending'};
      }
      if (url.pathname === '/api/products') result = url.searchParams.has('id') ? product : { items: url.searchParams.has('after') ? [{ ...product, id: 2, name: 'Second Sneaker' }] : [product], nextCursor: url.searchParams.has('after') ? null : '1' };
      if (url.pathname === '/api/search') {
        const q = url.searchParams.get('q');
        await new Promise(resolve => setTimeout(resolve, q === 'first' ? 500 : 10));
        result = [{ ...product, name: q === 'first' ? 'Old Search Result' : 'Latest Search Result' }];
      }
      if (url.pathname === '/api/offer' || url.pathname === '/api/x9k2/offer') result = { active: false, text: '', bg_color: '#FF6B35', text_color: '#FFFFFF', show_logo: true };
      if (url.pathname.includes('site-settings')) {
        result = { hero_m_scroll_height_vh: 280, policy_privacy: '# Privacy\n\nParagraph\n\n- Item one\n- Item two' };
        if (request.method === 'POST') { response.statusCode = 503; result = { error: 'Fixture save failed. Please try again.' }; }
      }
      if (url.pathname === '/api/admin-session') result = { admin: true, id: 'test-user' };
      if (url.pathname === '/api/x9k2/orders') result = { items: [], nextCursor: null };
      if (url.pathname === '/api/x9k2/products') result = { items: [product], nextCursor: null };
      if (url.pathname === '/api/orders') {
        let raw = ''; for await (const chunk of request) raw += chunk;
        const body = JSON.parse(raw);
        orderKeys.push(request.headers['idempotency-key']); orderAttempts++;
        await new Promise(resolve => setTimeout(resolve, 150));
        if (orderAttempts === 1) { response.statusCode = 503; result = { error: 'Temporary failure. Retry the same order.' }; }
        else result = { success: true, order: { id: body.paymentMethod==='razorpay'?8:7, total: 150 * body.items[0].quantity, status: 'Pending',payment_method:body.paymentMethod,payment_status:body.paymentMethod==='razorpay'?'pending':'whatsapp_pending', items: [{ product_id: 1, name: product.name, brand: product.brand, price: 150, qty: body.items[0].quantity, size: '8', size_unit: 'UK', color: 'Red' }], customer: body.customer } };
      }
      response.end(JSON.stringify(result)); return;
    }
    let file = resolve(root, '.' + decodeURIComponent(url.pathname));
    if (file !== root && !file.startsWith(root + sep)) { response.statusCode = 403; response.end(); return; }
    try { if (!(await stat(file)).isFile()) file = resolve(root, 'index.html'); } catch { file = resolve(root, 'index.html'); }
    response.setHeader('Content-Type', { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.webp': 'image/webp' }[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch (error) { response.statusCode = 500; response.end(String(error)); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const errors = [];
const results = {};
async function context(options = {}) {
  const context = await browser.newContext(options);
  await context.route('**/*', async route => {
    if (route.request().url().startsWith(origin)) return route.continue();
    if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: await readFile(resolve(root, 'product-placeholder.svg')) });
    return route.abort();
  });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  return context;
}
try {
  const store = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  await store.addInitScript(({ product }) => {
    if (location.protocol !== 'http:') return;
    localStorage.setItem('calvac_cart', JSON.stringify([{ ...product, size: '8', size_unit: 'UK', color: 'Red', qty: 1 }]));
    sessionStorage.setItem('calvac_address', JSON.stringify({ ts: Date.now(), data: { name: 'Audit', phone: '9876543210', line1: 'Audit Street', city: 'City', state: 'State', pin: '123456' } }));
  }, { product });
  const page = await store.newPage();
  const firstCalls = calls.length;
  await page.goto(origin + '/cart');
  await page.getByRole('heading', { name: 'Your Cart', exact: true }).waitFor();
  assert.equal(await page.getByRole('radio',{name:/Pay Online/}).isDisabled(),true);
  await page.getByRole('button', { name: /Edit/ }).click();
  const name = page.getByPlaceholder('Full Name *', { exact: true });
  await name.fill(''); await name.pressSequentially('John Doe');
  assert.equal(await name.inputValue(), 'John Doe');
  await page.getByRole('button', { name: 'Save Address', exact: true }).click();
  const increase = page.getByRole('button', { name: 'Increase quantity of Audit Sneaker' });
  for (let i = 0; i < 9; i++) await increase.click();
  assert.ok(await increase.isDisabled());
  const publicCalls = calls.slice(firstCalls);
  assert.equal(publicCalls.some(url => /\/assets\/(?:Admin|admin-|supabase-)/i.test(url)), false);
  assert.equal(publicCalls.some(url => url.includes('/theme-css')), false);
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(button => button.textContent.includes('Order via WhatsApp'));
    button.click(); button.click();
  });
  await page.getByText('Temporary failure. Retry the same order.').waitFor();
  assert.equal(orderAttempts, 1);
  await page.getByRole('button', { name: 'Order via WhatsApp', exact: true }).click();
  await page.getByRole('heading', { name: 'Order received', exact: true }).waitFor();
  assert.equal(orderAttempts, 2); assert.equal(orderKeys[0], orderKeys[1]);
  assert.match(await page.locator('main').innerText(), /1,500/);
  assert.match(await page.getByRole('link', { name: 'Open order in WhatsApp' }).getAttribute('href'), /Order%20%237/);
  await page.screenshot({ path: resolve(artifact, 'checkout-mobile.png'), fullPage: true });
  results.checkout = { retriesReuseKey: true, doubleClickGuard: true, quantityCap: 10, spacesPreserved: true, authoritativeTotal: 1500, adminDownloaded: false };
  await page.goto(origin + '/shop');
  await page.getByRole('button', { name: 'Load more shoes', exact: true }).click();
  await page.getByRole('heading', { name: 'Second Sneaker' }).waitFor();
  results.catalogPagination = true;
  await page.goto(origin + '/product/1');
  await page.getByRole('button', { name: '8', exact: true }).click();
  const addButton = page.getByRole('button', { name: /Add to Cart/i });
  assert.equal(await addButton.isDisabled(), false);
  // The color buttons carry title attributes rather than visible text.
  await page.locator('[title="Blue"]').click();
  assert.equal(await addButton.isDisabled(), true);
  results.variantRevalidation = true;
  await page.getByRole('button', { name: 'Search', exact: true }).click();
  const search = page.getByPlaceholder('Search…', { exact: true });
  const oldSearch = page.waitForRequest(request => request.url().includes('/api/search?q=first'));
  await search.fill('first'); await oldSearch;
  await search.fill('latest');
  await page.getByText('Latest Search Result', { exact: true }).waitFor();
  await page.waitForTimeout(600);
  assert.equal(await page.getByText('Old Search Result', { exact: true }).count(), 0);
  await search.fill('');
  await page.getByText('Latest Search Result', { exact: true }).waitFor({ state: 'detached' });
  results.searchIgnoresOldRequests = true;
  await store.close();

  const motion = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const animation = await motion.newPage();
  const beforeFrames = calls.length;
  await animation.goto(origin + '/');
  await animation.waitForFunction(() => document.querySelector('canvas')?.width > 300);
  await animation.waitForTimeout(400);
  const initialFrames = calls.slice(beforeFrames).filter(url => url.endsWith('.webp') && url.includes('/frames/'));
  assert.ok(initialFrames.length >= 1 && initialFrames.length <= 5);
  assert.ok(initialFrames.every(url => url.includes('/mobile/')));
  await animation.screenshot({ path: resolve(artifact, 'home-mobile.png'), fullPage: false });
  await animation.getByRole('link', { name: /^Cart,/ }).click();
  await animation.getByRole('heading', { name: 'Your cart is empty' }).waitFor();
  const afterNavigation = calls.length;
  await animation.waitForTimeout(500);
  assert.equal(calls.slice(afterNavigation).filter(url => url.includes('/frames/')).length, 0);
  results.animation = { initialFrames: initialFrames.length, mobileAssets: true, stoppedAfterNavigation: true };
  await motion.close();

  const reduced = await context({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const poster = await reduced.newPage();
  const beforePoster = calls.length;
  await poster.goto(origin + '/');
  await poster.waitForFunction(() => document.querySelector('canvas')?.width > 300);
  await poster.waitForTimeout(300);
  assert.equal(calls.slice(beforePoster).filter(url => url.includes('/frames/')).length, 1);
  results.reducedMotionPosterOnly = true;
  await reduced.close();

  if(process.env.BROWSER_TEST_ADMIN==='1'){
    const customer=await context({viewport:{width:390,height:844}});
    await customer.route('https://test-fixture.supabase.co/auth/v1/**',async route=>{
      if(route.request().url().includes('/token'))return route.fulfill({contentType:'application/json',body:JSON.stringify(customerSession())});
      return route.fulfill({contentType:'application/json',body:JSON.stringify(customerFixture)});
    });
    await customer.route('**/api/checkout-config',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({methods:{whatsapp:true,cod:true,razorpay:true}})}));
    await customer.route('https://checkout.razorpay.com/v1/checkout.js',route=>route.fulfill({contentType:'application/javascript',body:`window.Razorpay=class{constructor(options){this.options=options}open(){setTimeout(()=>this.options.handler({razorpay_order_id:'order_fixture',razorpay_payment_id:'pay_fixture',razorpay_signature:'fixture-signature'}),10)}};`}));
    await customer.addInitScript(({product})=>{
      if(location.protocol!=='http:')return;
      if(!sessionStorage.getItem('payment-fixture-initialized')){
        localStorage.setItem('calvac_cart',JSON.stringify([{...product,size:'8',size_unit:'UK',color:'Red',qty:1}]));
        sessionStorage.setItem('calvac_address',JSON.stringify({ts:Date.now(),data:{name:'Customer Fixture',phone:'9876543210',line1:'Fixture Street',city:'City',state:'State',pin:'123456'}}));
        sessionStorage.setItem('payment-fixture-initialized','1');
      }
    },{product});
    const checkout=await customer.newPage();
    await checkout.goto(origin+'/login?redirect='+encodeURIComponent('/cart?payment=razorpay'));
    await checkout.getByLabel('Email',{exact:true}).fill(customerFixture.email);
    await checkout.getByLabel('Password',{exact:true}).fill('fixture-password');
    await checkout.getByRole('button',{name:'Sign in',exact:true}).click();
    await checkout.getByRole('button',{name:'Continue to payment',exact:true}).click();
    await checkout.getByRole('heading',{name:'Payment pending',exact:true}).waitFor();
    await checkout.getByRole('button',{name:'Pay online',exact:true}).click();
    await checkout.getByText('Payment submitted. Checking confirmation…',{exact:true}).waitFor();
    assert.equal(paymentVerifications,1);
    assert.equal(await checkout.getByRole('heading',{name:'Payment confirmed',exact:true}).count(),0);
    paymentPaid=true;
    await checkout.getByRole('button',{name:'Check payment status',exact:true}).click();
    await checkout.getByRole('heading',{name:'Payment confirmed',exact:true}).waitFor();
    await checkout.goto(origin+'/account/orders');
    await checkout.getByRole('heading',{name:'Payment confirmed',exact:true}).waitFor();
    assert.equal(await checkout.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await checkout.screenshot({path:resolve(artifact,'customer-paid-order-mobile.png'),fullPage:true});
    await checkout.getByRole('button',{name:'Sign out',exact:true}).click();
    await checkout.getByRole('heading',{name:'Sign in',exact:true}).waitFor();
    assert.equal(await checkout.evaluate(()=>sessionStorage.getItem('calvac_address')),null);
    results.customerAccountAndPayments={signIn:true,signatureRemainsPending:true,serverConfirmsPayment:true,ownOrderHistory:true,signOutClearsAddress:true};
    await customer.close();
  }

  if (process.env.BROWSER_TEST_ADMIN === '1') {
    const admin = await context();
    await admin.addInitScript(() => {
      if (location.protocol !== 'http:') return;
      const expires = Math.floor(Date.now() / 1000) + 3600;
      const encode = value => btoa(JSON.stringify(value)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
      const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'admin@example.invalid', app_metadata: { role: 'admin' }, user_metadata: {}, created_at: new Date().toISOString() };
      const token = `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode({ sub: user.id, exp: expires, role: 'authenticated' })}.fixture`;
      localStorage.setItem('sb-test-fixture-auth-token', JSON.stringify({ access_token: token, refresh_token: 'fixture-refresh-token', expires_at: expires, expires_in: 3600, token_type: 'bearer', user }));
    });
    const settings = await admin.newPage();
    await settings.goto(origin + '/manage-store-x9k2/settings');
    await settings.getByRole('button', { name: '🏪 Store Info', exact: true }).click();
    assert.equal(await settings.getByRole('checkbox',{name:'Pay Online / Razorpay',exact:true}).isChecked(),false);
    await settings.getByRole('button', { name: 'Save Store Info', exact: true }).click();
    await settings.getByText('Fixture save failed. Please try again.', { exact: true }).waitFor();
    await settings.screenshot({ path: resolve(artifact, 'admin-save-error.png'), fullPage: true });
    results.adminSaveErrorsVisible = true;
    await admin.close();
  }

  assert.deepEqual(errors, []);
  results.pageErrors = errors;
  await writeFile(resolve(artifact, 'browser-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
