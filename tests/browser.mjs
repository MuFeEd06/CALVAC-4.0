import { chromium } from '@playwright/test';
import { createServer } from 'node:http';
import { readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import assert from 'node:assert/strict';

const root = resolve('dist');
const artifact = resolve('test-results');
await mkdir(artifact, { recursive: true });
const product = { id: 1, name: 'Audit Sneaker', brand: 'Audit', price: 100, image: '/product-placeholder.svg', size_unit: 'UK', sizes: ['8'], colors: [{ name: 'Red', hex: '#FF0000', price: 150 }, { name: 'Blue', hex: '#0000FF', price: 120 }], stock: { 'Red|8': 5, 'Blue|8': 0 }, tag: 'new' };
const calls = [], orderKeys = [], assistantQuestions=[];
let assistantFailures=0;
let orderAttempts = 0;
let paymentPaid=false,paymentVerifications=0,adminCancelled=false;
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
      if(url.pathname==='/api/assistant'){
        let raw='';for await(const chunk of request)raw+=chunk;
        const body=JSON.parse(raw);assistantQuestions.push(body);
        assert.equal(typeof body.question,'string');assert.equal(body.productId,1);
        assert.ok(body.previousQuestions.length<=3);assert.ok(!('messages' in body));
        await new Promise(resolve=>setTimeout(resolve,150));
        if(body.question==='Show failure shoes'&&assistantFailures++===0){response.statusCode=503;result={error:'Fixture assistant unavailable'};}
        else if(body.question.includes('weather'))result={reply:'I can help with CALVAC footwear and sizing. What shoes are you looking for?',products:[]};
        else result={reply:'UK 8 is listed for this model. Fit varies by brand and model; I cannot assume a conversion without a size chart.',products:[{id:2,name:'Catalog match sneaker',brand:'Audit',price:150,image:'/product-placeholder.svg',sizeUnit:'UK',sizes:['8'],unavailable:false}],mode:'catalog'};
      }
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
        result = { hero_type:'scroll', hero_m_scroll_height_vh: 280, policy_privacy: '# Privacy\n\nParagraph\n\n- Item one\n- Item two' };
        if (request.method === 'POST') { response.statusCode = 503; result = { error: 'Fixture save failed. Please try again.' }; }
      }
      if (url.pathname === '/api/admin-session') result = { admin: true, id: 'test-user' };
      if (url.pathname === '/api/x9k2/orders') {
        if (request.method === 'PATCH') { adminCancelled=true; result={success:true}; }
        else result = { items: [{...paymentOrder(),name:'Payment fixture',phone:'9876543210',line1:'Fixture Street',city:'City',state:'State',pin:'123456',status:adminCancelled?'Cancelled':'Confirmed',payment_status:adminCancelled?'refund_required':'paid'}], nextCursor: null };
      }
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
const browser = await chromium.launch({ headless: true, args:['--enable-unsafe-swiftshader'], ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE } : {}) });
const errors = [];
const results = {};
async function context(options = {}) {
  const context = await browser.newContext(options);
  await context.route('**/*', async route => {
    if (route.request().url().startsWith(origin)||route.request().url().startsWith('blob:'+origin)) return route.continue();
    if (route.request().resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: await readFile(resolve(root, 'product-placeholder.svg')) });
    return route.abort();
  });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
  return context;
}
async function readability(page){
  await page.waitForTimeout(1600);
  return page.evaluate(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const ctx=canvas.getContext('2d',{willReadFrequently:true}),cache=new Map();
    const parse=value=>{if(cache.has(value))return [...cache.get(value)];ctx.clearRect(0,0,1,1);ctx.fillStyle=value;ctx.fillRect(0,0,1,1);const data=ctx.getImageData(0,0,1,1).data;const color=[data[0],data[1],data[2],data[3]/255];cache.set(value,color);return [...color];};
    const blend=(top,bottom)=>top.slice(0,3).map((v,i)=>v*top[3]+bottom[i]*(1-top[3]));
    const lum=rgb=>rgb.map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((s,v,i)=>s+v*[.2126,.7152,.0722][i],0);
    const issues=[];
    for(const el of document.querySelectorAll('body *')){
      if(el.closest('[aria-hidden="true"],[data-hero-preview],svg,script,style,option,select')||!el.getClientRects().length||!Array.from(el.childNodes).some(node=>node.nodeType===3&&node.textContent.trim()))continue;
      const style=getComputedStyle(el);if(style.visibility!=='visible'||parseFloat(style.opacity)<.01||el.closest(':disabled'))continue;
      let bg=[255,255,255],opacity=1;const chain=[];for(let parent=el;parent;parent=parent.parentElement)chain.unshift(parent);
      for(const parent of chain){const current=getComputedStyle(parent);bg=blend(parse(current.backgroundColor),bg);opacity*=parseFloat(current.opacity);}
      if(opacity<.01)continue;const color=parse(style.color);color[3]*=opacity;const foreground=blend(color,bg),a=lum(foreground),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
      const required=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&parseInt(style.fontWeight)>=700)?3:4.5;
      if(ratio<required-.03)issues.push({text:el.textContent.trim().slice(0,65),tag:el.tagName,ratio:+ratio.toFixed(2),color:style.color,background:bg,opacity});
    }
    return issues.slice(0,35);
  });
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
  await page.getByRole('button',{name:'Switch to dark theme',exact:true}).click();
  assert.deepEqual(await readability(page),[],'Dark cart contrast');
  await page.getByRole('button',{name:'Switch to light theme',exact:true}).click();
  assert.deepEqual(await readability(page),[],'Light cart contrast');
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
  assert.match(await page.getByRole('link', { name: 'Confirm Order in WhatsApp' }).getAttribute('href'), /Order%20%237/);
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
  assert.equal(await page.locator('[title="Blue"]').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.getByRole('button', { name: '8', exact: true }).isDisabled(), true);
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

  const fixes=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  const detail={...product,image:'https://ik.imagekit.io/fixture/shoe.webp?catalog=kept',brand:'Rare brand',category:'boots',specs:'Material: Leather\nCare: '+('Gentle cleaning and air drying. '.repeat(8))};
  const categoryRequests=[];
  await fixes.route('**/api/products?*',route=>{
    const query=new URL(route.request().url()).searchParams;
    let data;
    if(query.has('id'))data={...detail,id:Number(query.get('id'))};
    else if(query.has('category')){
      categoryRequests.push(query.get('category'));
      data={items:[{...detail,id:2,brand:'Other brand',category:query.get('category'),name:query.get('category')+' collection shoe'}],nextCursor:null};
    }else if(query.has('brand'))data={items:[detail],nextCursor:null};
    else data={items:[{...detail,id:3,brand:'Third brand',name:'Catalog fallback shoe'}],nextCursor:null};
    return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  const fixedPage=await fixes.newPage();
  for(const category of ['boots','crocs','girls']){
    await fixedPage.goto(origin+'/');
    await fixedPage.locator(`a[href="/shop?category=${category}"]`).first().click();
    await fixedPage.getByRole('heading',{name:category+' collection shoe',exact:true}).waitFor();
    assert.equal(new URL(fixedPage.url()).searchParams.get('category'),category);
  }
  assert.deepEqual(categoryRequests,['boots','crocs','girls']);
  await fixedPage.getByRole('button',{name:'Open menu',exact:true}).click();
  await fixedPage.getByRole('link',{name:'Sale',exact:true}).click();
  assert.equal(new URL(fixedPage.url()).searchParams.get('sale'),'1');
  await fixedPage.goto(origin+'/shop?tag=boots');await fixedPage.getByRole('heading',{name:'boots collection shoe',exact:true}).waitFor();
  await fixedPage.goto(origin+'/product/1');
  await fixedPage.locator('.product-detail-layout img').first().waitFor();
  const detailSources=await fixedPage.locator('.product-detail-layout img').first().getAttribute('srcset');
  assert.ok(detailSources.split(', ').every(candidate=>new URL(candidate.split(' ')[0]).searchParams.get('catalog')==='kept'));
  await fixedPage.getByRole('heading',{name:'You May Also Like',exact:true}).waitFor();
  await fixedPage.getByRole('heading',{name:'Catalog fallback shoe',exact:true}).waitFor();
  assert.equal(await fixedPage.locator('.product-grid a[href="/product/1"]').count(),0);
  assert.equal(await fixedPage.getByRole('link',{name:'My account',exact:true}).innerText(),'');
  assert.equal(await fixedPage.locator('header a[aria-label="My account"] svg').count(),1);
  assert.equal(await fixedPage.locator('.wa-float svg').count(),1);assert.equal(await fixedPage.locator('.wa-float img').count(),0);
  const specs=fixedPage.locator('.product-specifications');
  assert.equal(await specs.getAttribute('open'),'');assert.equal(await specs.evaluate(el=>getComputedStyle(el).borderRadius),'12px');
  await specs.getByText('Material',{exact:true}).waitFor();await specs.getByText('Leather',{exact:true}).waitFor();
  await specs.locator('summary').press('Enter');assert.equal(await specs.getAttribute('open'),null);
  await specs.locator('summary').press('Enter');assert.equal(await specs.getAttribute('open'),'');
  for(const mode of ['light','dark']){
    if(mode==='dark')await fixedPage.getByRole('button',{name:'Switch to dark theme',exact:true}).click();
    assert.deepEqual(await readability(fixedPage),[],`${mode} product specifications contrast`);
    assert.equal(await fixedPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
    await specs.screenshot({path:resolve(artifact,`specifications-mobile-${mode}.png`)});
  }
  results.collectionAndDetails={explicitAndLegacyCategories:true,similarFallback:true,rectangularReadableSpecifications:true,vectorIcons:true};
  const beforeGuide=calls.length;
  const guideLauncher=fixedPage.getByRole('button',{name:'Open CALVAC product guide',exact:true});
  await guideLauncher.scrollIntoViewIfNeeded();
  assert.equal(await fixedPage.locator('.companion-character canvas').count(),0);
  assert.equal(await fixedPage.locator('.companion-character img').evaluate(img=>img.complete&&img.naturalWidth>0),true);
  await guideLauncher.click();
  const chat=fixedPage.getByRole('dialog',{name:'CALVAC Guide',exact:true});
  const question=chat.getByLabel('Ask about products or shoe sizes',{exact:true});
  await question.focus();assert.equal(await question.evaluate(el=>el===document.activeElement),true);
  await question.fill('Which sizes are available?');
  await question.press('Enter');await question.press('Enter');
  await chat.getByRole('link',{name:/Catalog match sneaker/}).waitFor();
  assert.equal(assistantQuestions.length,1,'Duplicate sends must be blocked');
  assert.equal(assistantQuestions[0].productId,1);
  assert.equal(assistantQuestions[0].selectedColor,'Red');
  assert.equal(await fixedPage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(await readability(fixedPage),[],'Dark assistant contrast');
  await chat.screenshot({path:resolve(artifact,'product-guide-mobile-dark.png')});
  await question.fill('What is the weather?');await question.press('Enter');
  await chat.getByText('I can help with CALVAC footwear and sizing. What shoes are you looking for?',{exact:true}).waitFor();
  assert.deepEqual(assistantQuestions[1].previousQuestions,['Which sizes are available?']);
  await question.fill('Show failure shoes');await question.press('Enter');
  await chat.getByRole('alert').waitFor();
  await chat.getByRole('button',{name:'Try again',exact:true}).click();
  await fixedPage.waitForFunction(()=>document.querySelectorAll('.guide-message-assistant').length===4);
  assert.equal(await chat.locator('.guide-message-user').filter({hasText:'Show failure shoes'}).count(),1,'Retry must not repeat the user message');
  assert.equal(assistantQuestions[3].previousQuestions.includes('Show failure shoes'),false);
  await question.press('Escape');await chat.waitFor({state:'hidden'});
  assert.equal(await guideLauncher.evaluate(el=>el===document.activeElement),true);
  await fixedPage.getByRole('button',{name:'Switch to light theme',exact:true}).click();
  await guideLauncher.click();assert.deepEqual(await readability(fixedPage),[],'Light assistant contrast');
  await chat.screenshot({path:resolve(artifact,'product-guide-mobile-light.png')});
  await chat.getByRole('link',{name:/Catalog match sneaker/}).first().click();
  assert.equal(new URL(fixedPage.url()).pathname,'/product/2');
  assert.equal(calls.slice(beforeGuide).some(path=>path.includes('companionScene')||path.endsWith('.glb')),false,'Reduced-motion guide must stay on its poster');
  results.productAssistant={productContext:true,keyboard:true,doubleSendGuard:true,errorRetry:true,historyBounded:true,productLinks:true,lightDarkContrast:true,reducedMotionPoster:true};
  await fixes.close();

  const character=await context({viewport:{width:1366,height:900}});
  const characterPage=await character.newPage();
  const characterSecurityErrors=[];
  characterPage.on('console',message=>{if(/Content Security Policy|Couldn.t load texture/.test(message.text()))characterSecurityErrors.push(message.text());});
  await characterPage.goto(origin+'/product/1');
  await characterPage.waitForFunction(()=>document.querySelector('.companion-character')?.dataset.ready==='true',null,{timeout:30000});
  await characterPage.waitForTimeout(500);
  assert.equal(await characterPage.locator('.companion-character canvas').evaluate(canvas=>canvas.width>0&&canvas.height>0),true);
  assert.deepEqual(characterSecurityErrors,[],'Character textures must load under the production CSP');
  await characterPage.screenshot({path:resolve(artifact,'product-guide-desktop.png'),fullPage:false});
  await characterPage.evaluate(()=>document.querySelector('.companion-character canvas').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await characterPage.waitForFunction(()=>!document.querySelector('.companion-character canvas'));
  assert.equal(await characterPage.locator('.companion-character img').evaluate(img=>getComputedStyle(img).opacity),'1');
  results.productAssistant.webglCharacter=true;results.productAssistant.contextLossFallback=true;
  await character.close();

  const motion = await context({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  const animation = await motion.newPage();
  const beforeFrames = calls.length;
  await animation.goto(origin + '/');
  await animation.waitForFunction(() => document.querySelector('canvas')?.width > 300);
  await animation.waitForTimeout(400);
  const initialFrames = calls.slice(beforeFrames).filter(url => url.endsWith('.webp') && url.includes('/frames/'));
  assert.equal(calls.slice(beforeFrames).some(path=>path.includes('companionScene')||path.includes('ProductAssistant')||path.includes('/companion/')),false,'Homepage must not download the product assistant');
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

  // The new hero selects only the active device's image and shares the site theme.
  const particleConfig={hero_type:'particles',particle_hero:{desktop:{shoe:'retro-court-hi'},mobile:{shoe:'cloud-knit'}}};
  const particles=await context({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
  await particles.route('**/api/site-settings',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(particleConfig)}));
  const particlePage=await particles.newPage(),particleCalls=calls.length;
  await particlePage.goto(origin+'/');
  await particlePage.locator('.particle-hero[data-shoe="cloud-knit"] .sh-fallback').waitFor();
  assert.match(await particlePage.locator('.sh-fallback').getAttribute('src'),/cloud-knit-mobile/);
  assert.equal(calls.slice(particleCalls).some(path=>path.includes('/frames/')),false);
  await particlePage.getByRole('button',{name:'Switch to dark theme',exact:true}).click();
  assert.equal(await particlePage.locator('html').getAttribute('data-theme-mode'),'dark');
  await particlePage.screenshot({path:resolve(artifact,'particles-mobile-dark.png'),fullPage:false});
  await particlePage.goto(origin+'/shop');
  await particlePage.getByRole('heading',{name:'All Shoes',exact:true}).waitFor();
  assert.equal(await particlePage.locator('html').getAttribute('data-theme-mode'),'dark');
  assert.deepEqual(await readability(particlePage),[],'Dark catalog contrast');
  await particlePage.screenshot({path:resolve(artifact,'shop-mobile-dark.png'),fullPage:true});
  await particlePage.reload();
  assert.equal(await particlePage.locator('html').getAttribute('data-theme-mode'),'dark');
  for(const path of ['/product/1','/login','/signup','/forgot-password','/contact','/policy/privacy']){
    await particlePage.goto(origin+path);
    if(path==='/product/1')await particlePage.getByRole('button',{name:'8',exact:true}).click();
    assert.deepEqual(await readability(particlePage),[],`Dark ${path} contrast`);
    assert.equal(await particlePage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await particlePage.getByRole('button',{name:'Switch to light theme',exact:true}).click();
  for(const path of ['/product/1','/login','/contact','/policy/privacy']){
    await particlePage.goto(origin+path);assert.deepEqual(await readability(particlePage),[],`Light ${path} contrast`);
  }
  await particlePage.goto(origin+'/');
  await particlePage.locator('.sh-fallback').waitFor();
  await particlePage.screenshot({path:resolve(artifact,'particles-mobile-light.png'),fullPage:false});
  assert.equal(await particlePage.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await particles.close();
  const desktopParticles=await context({viewport:{width:1440,height:1000}});
  await desktopParticles.route('**/api/site-settings',route=>route.fulfill({contentType:'application/json',body:JSON.stringify(particleConfig)}));
  const desktopHero=await desktopParticles.newPage();await desktopHero.goto(origin+'/');
  await desktopHero.locator('.particle-hero[data-shoe="retro-court-hi"] .sh-fallback').waitFor();
  await desktopHero.waitForFunction(()=>document.querySelector('.sh-root')?.getAttribute('data-gl')==='on');
  await desktopHero.mouse.move(700,330);await desktopHero.mouse.move(900,400,{steps:20});
  await desktopHero.screenshot({path:resolve(artifact,'particles-desktop-light.png'),fullPage:false});
  await desktopHero.getByRole('button',{name:'Switch to dark theme',exact:true}).click();
  await desktopHero.waitForFunction(()=>document.querySelector('.sh-fallback')?.getAttribute('src')?.includes('desktop-dark'));
  await desktopHero.screenshot({path:resolve(artifact,'particles-desktop-dark.png'),fullPage:false});
  await desktopParticles.close();
  results.particleHero={separateDeviceShoes:true,webglParticles:true,themeAcrossNavigationAndReload:true,noScrollFrameDownloads:true};

  const duplicate=await context({viewport:{width:390,height:844}});let duplicateRequests=0;
  await duplicate.addInitScript(({product})=>{
    if(location.protocol!=='http:')return;
    localStorage.setItem('calvac_cart',JSON.stringify([{...product,size:'8',size_unit:'UK',color:'Red',qty:1}]));
    sessionStorage.setItem('calvac_address',JSON.stringify({ts:Date.now(),data:{name:'Customer Fixture',phone:'9876543210',line1:'Fixture Street',city:'City',state:'State',pin:'123456'}}));
  },{product});
  await duplicate.route('**/api/orders',route=>{duplicateRequests++;return route.fulfill({status:409,contentType:'application/json',body:JSON.stringify({error:'A matching WhatsApp order was placed recently.',retryAfter:120})});});
  const duplicatePage=await duplicate.newPage();await duplicatePage.goto(origin+'/cart');
  await duplicatePage.getByRole('button',{name:'Order via WhatsApp',exact:true}).click();
  await duplicatePage.getByRole('dialog').waitFor();
  await duplicatePage.getByText(/^You can place the same order again in \d+:\d{2}\.$/).waitFor();
  await duplicatePage.screenshot({path:resolve(artifact,'whatsapp-cooldown-mobile.png'),fullPage:false});
  await duplicatePage.getByRole('button',{name:'Got it',exact:true}).click();
  await duplicatePage.getByRole('button',{name:/Order cooldown/}).click();
  await duplicatePage.getByRole('dialog').waitFor();assert.equal(duplicateRequests,1);
  await duplicate.close();results.whatsappCooldown={popup:true,noSecondRequestDuringCooldown:true};

  if(process.env.BROWSER_TEST_ADMIN==='1'){
    const auth=await context({viewport:{width:390,height:844}});let exchanges=0,resends=0,recoveries=0,googleEnabled=true,authorizeUrl;
    await auth.route('https://test-fixture.supabase.co/auth/v1/**',async route=>{
      const url=new URL(route.request().url());
      if(url.pathname.endsWith('/settings'))return route.fulfill({contentType:'application/json',body:JSON.stringify({external:{google:googleEnabled}})});
      if(url.pathname.endsWith('/authorize')){authorizeUrl=url;return route.fulfill({contentType:'text/html',body:'<title>OAuth fixture</title>'});}
      if(url.pathname.endsWith('/token')){
        exchanges++;assert.equal(url.searchParams.get('grant_type'),'pkce');
        const body=route.request().postDataJSON();assert.equal(body.auth_code,'fixture-code');assert.ok(body.code_verifier.length>=43);
        return route.fulfill({contentType:'application/json',body:JSON.stringify(customerSession())});
      }
      if(url.pathname.endsWith('/resend')){
        resends++;const body=route.request().postDataJSON();assert.equal(body.type,'signup');assert.equal(body.email,customerFixture.email);
        assert.equal(new URL(url.searchParams.get('redirect_to')).searchParams.get('redirect'),'/cart');
        return route.fulfill({contentType:'application/json',body:'{}'});
      }
      if(url.pathname.endsWith('/recover')){
        recoveries++;assert.equal(route.request().postDataJSON().email,customerFixture.email);
        return route.fulfill({contentType:'application/json',body:'{}'});
      }
      return route.fulfill({contentType:'application/json',body:JSON.stringify(customerFixture)});
    });
    const authPage=await auth.newPage();await authPage.goto(origin+'/login?redirect=/account/orders');
    await authPage.getByRole('button',{name:'Continue with Google',exact:true}).click();
    await authPage.waitForURL(url=>url.hostname==='test-fixture.supabase.co');
    assert.equal(authorizeUrl.searchParams.get('provider'),'google');assert.equal(authorizeUrl.searchParams.get('code_challenge_method'),'s256');
    assert.equal(new URL(authorizeUrl.searchParams.get('redirect_to')).origin,origin);
    await authPage.goto(origin+'/auth/callback?code=fixture-code&redirect=/account/orders');
    await authPage.getByRole('heading',{name:'My orders',exact:true}).waitFor();assert.equal(exchanges,1);
    await authPage.goto(origin+'/auth/callback?error=access_denied&redirect=/account');
    await authPage.getByRole('alert').waitFor();assert.equal(new URL(authPage.url()).pathname,'/auth/callback');
    await authPage.goto(origin+'/account');await authPage.getByRole('button',{name:'Sign out',exact:true}).click();
    await authPage.goto(origin+'/login?redirect=/cart');await authPage.getByLabel('Email',{exact:true}).fill(customerFixture.email);
    await authPage.getByRole('link',{name:'Resend verification email',exact:true}).click();
    await authPage.getByRole('heading',{name:'Verify your email',exact:true}).waitFor();
    assert.equal(await authPage.getByLabel('Email',{exact:true}).inputValue(),customerFixture.email);
    assert.equal(await authPage.getByLabel('Password',{exact:true}).count(),0);
    await authPage.getByRole('button',{name:'Resend verification email',exact:true}).click();
    await authPage.getByRole('status').filter({hasText:'awaiting confirmation'}).waitFor();
    assert.equal(resends,1);assert.equal(await authPage.getByRole('button',{name:/Resend available in/}).isDisabled(),true);
    await authPage.reload();await authPage.getByLabel('Email',{exact:true}).fill(customerFixture.email);
    assert.equal(await authPage.getByRole('button',{name:/Resend available in/}).isDisabled(),true);assert.equal(resends,1);
    await authPage.goto(origin+'/forgot-password');await authPage.getByLabel('Email',{exact:true}).fill(customerFixture.email);
    await authPage.getByRole('button',{name:'Reset your password',exact:true}).click();
    await authPage.getByRole('status').filter({hasText:'If an account matches'}).waitFor();
    assert.equal(recoveries,1);assert.equal(await authPage.getByRole('button',{name:/Resend available in/}).isDisabled(),true);
    await authPage.reload();await authPage.getByLabel('Email',{exact:true}).fill(customerFixture.email);
    assert.equal(await authPage.getByRole('button',{name:/Resend available in/}).isDisabled(),true);assert.equal(recoveries,1);
    results.passwordResetCooldown=true;
    googleEnabled=false;await authPage.goto(origin+'/login');
    await authPage.getByText('Google sign-in is currently unavailable. You can continue with email.',{exact:true}).waitFor();
    assert.equal(await authPage.getByRole('button',{name:'Continue with Google',exact:true}).isDisabled(),true);
    await authPage.getByRole('button',{name:'Switch to dark theme',exact:true}).click();assert.deepEqual(await readability(authPage),[],'Dark auth contrast');
    await authPage.screenshot({path:resolve(artifact,'auth-google-email-mobile-dark.png'),fullPage:true});
    results.googleAndVerification={pkce:true,callbackExchangesOnce:true,cancellationHandled:true,resendWithoutPassword:true,cooldownSurvivesReload:true,providerAvailability:true};
    await auth.close();

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
    let historyReads=0;
    await customer.route('**/api/account?resource=orders*',route=>{
      historyReads++;
      const pending=Array.from({length:20},(_,index)=>({...paymentOrder(),id:index+100,status:'Pending',payment_status:'pending'}));
      return route.fulfill({contentType:'application/json',body:JSON.stringify({items:pending,nextCursor:null})});
    });
    await checkout.goto(origin+'/account/orders');
    await checkout.getByRole('heading',{name:'Payment pending',exact:true}).first().waitFor();
    await checkout.waitForTimeout(3100);
    assert.equal(historyReads,1,'Order history must not start a poller for every unpaid order');
    results.orderHistoryAvoidsBackgroundPolling=true;
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
    let savedHero={};
    await admin.route('**/api/x9k2/site-settings',async route=>{
      if(route.request().method()==='POST'){savedHero={...savedHero,...route.request().postDataJSON()};return route.fulfill({contentType:'application/json',body:JSON.stringify({success:true,settings:savedHero})});}
      return route.fulfill({contentType:'application/json',body:JSON.stringify(savedHero)});
    });
    await settings.goto(origin+'/manage-store-x9k2/settings');
    await settings.getByLabel('Hero experience',{exact:true}).selectOption('particles');
    await settings.getByLabel('Desktop shoe',{exact:true}).selectOption('heritage-derby');
    await settings.getByLabel('Mobile shoe',{exact:true}).selectOption('cloud-knit');
    let heroUploads=0;
    await admin.route('**/api/x9k2/upload',route=>{
      assert.ok(route.request().headers().authorization?.startsWith('Bearer '));
      assert.ok(route.request().postDataBuffer().includes(Buffer.from('name="image"')));
      heroUploads++;return route.fulfill({contentType:'application/json',body:JSON.stringify({url:'https://ik.imagekit.io/hero-fixture.webp'})});
    });
    await settings.getByRole('group',{name:'Laptop / desktop',exact:true}).getByLabel('Upload custom shoe',{exact:true}).setInputFiles(resolve('public/hero/shoes/retro-court-hi-desktop.webp'));
    await settings.waitForFunction(()=>document.querySelector('input[type="url"]')?.value==='https://ik.imagekit.io/hero-fixture.webp');
    assert.equal(heroUploads,1);
    await settings.getByRole('button',{name:'Save hero experience',exact:true}).click();
    await settings.getByText('Hero experience saved.',{exact:true}).waitFor();
    assert.equal(savedHero.particle_hero.desktop.shoe,'heritage-derby');
    await settings.reload();await settings.waitForFunction(()=>document.querySelector('.admin-panel > fieldset')?.disabled===false);
    assert.equal(await settings.getByLabel('Desktop shoe',{exact:true}).inputValue(),'heritage-derby');
    assert.equal(await settings.getByLabel('Mobile shoe',{exact:true}).inputValue(),'cloud-knit');
    await settings.getByRole('button',{name:'Switch to dark theme',exact:true}).click();
    assert.deepEqual(await readability(settings),[],'Dark hero admin contrast');
    await settings.screenshot({path:resolve(artifact,'hero-admin-dark.png'),fullPage:true});
    await settings.getByLabel('Hero experience',{exact:true}).selectOption('scroll');
    await settings.getByRole('button',{name:'Save hero experience',exact:true}).click();
    await settings.getByText('Hero experience saved.',{exact:true}).waitFor();await settings.reload();
    await settings.waitForFunction(()=>document.querySelector('.admin-panel > fieldset')?.disabled===false);
    assert.equal(await settings.getByLabel('Hero experience',{exact:true}).inputValue(),'scroll');
    assert.deepEqual(await readability(settings),[],'Dark scroll editor contrast');
    results.adminHeroSelectionPersists=true;
    await settings.goto(origin + '/manage-store-x9k2/dashboard');
    await settings.getByRole('heading',{name:'Payment fixture',exact:true}).waitFor();
    assert.deepEqual(await readability(settings),[],'Dark admin orders contrast');
    await settings.locator('.admin-order-controls select').selectOption('Cancelled');
    await settings.getByText('Refund review required. Process and verify the refund in Razorpay before closing this case.',{exact:true}).waitFor();
    results.adminCancellationShowsRefundReview = true;
    await settings.goto(origin+'/manage-store-x9k2/products');
    await settings.getByRole('button',{name:'✏️ Edit',exact:true}).click();
    await settings.getByRole('heading',{name:'Edit Product #1',exact:true}).waitFor();
    assert.deepEqual(await readability(settings),[],'Dark product editor contrast');
    await admin.close();
  }

  assert.deepEqual(errors, []);
  results.pageErrors = errors;
  await writeFile(resolve(artifact, 'browser-results.json'), JSON.stringify(results, null, 2));
  console.log(JSON.stringify(results, null, 2));
} catch(error) {
  if(process.env.GITHUB_ACTIONS==='true'){
    const message=String(error?.stack||error).replace(/%/g,'%25').replace(/\r/g,'%0D').replace(/\n/g,'%0A');
    console.error(`::error title=Browser regression::${message}`);
  }
  throw error;
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
