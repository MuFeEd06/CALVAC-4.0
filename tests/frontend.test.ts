import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TimedCache, PublicCacheStorage, PUBLIC_CACHE_KEY } from '../src/api/cache';
import { priceBound, priceFilterError } from '../src/utils/priceFilters';
import { cleanInput, cleanStr, isSafeImageUrl, safeLink, sanitizeProductPayload } from '../src/utils/validation';
import { migrateCart, MAX_LINE_ITEMS, MAX_QTY } from '../src/utils/cart';
import { FrameBuffer } from '../src/utils/frameBuffer';
import { checkoutKey } from '../src/utils/checkout';
import { ikResize, ikSrcSet } from '../src/utils/images';

test('responsive images preserve metadata and signatures and use only the exact ImageKit host', () => {
  const source = 'https://ik.imagekit.io/store/shoe.webp?version=2&tr=w-800,q-90';
  const resized = new URL(ikResize(source, 80, 75));
  assert.equal(resized.searchParams.get('version'), '2');
  assert.equal(resized.searchParams.getAll('tr').length, 1);
  assert.match(resized.searchParams.get('tr')!, /^w-80,q-75,/);
  const candidates = ikSrcSet(source, 75, [220, 400])!.split(', ');
  assert.equal(candidates.length, 2);
  assert.ok(candidates.every(candidate => new URL(candidate.split(' ')[0]).searchParams.get('version') === '2'));
  const signed = 'https://ik.imagekit.io/store/shoe.webp?tr=w-800&ik-t=9999999999&ik-s=fixture';
  assert.equal(ikResize(signed, 80, 75), signed);
  assert.equal(ikSrcSet(signed), undefined);
  for (const url of ['/product-placeholder.svg','https://ik.imagekit.io.evil.invalid/shoe.webp','https://other.invalid/ik.imagekit.io/shoe.webp']) {
    assert.equal(ikResize(url, 80, 75), url);
    assert.equal(ikSrcSet(url), undefined);
  }
});

test('image saving preserves ImageKit URLs and rejects deceptive/unsafe hosts', () => {
  const image = 'https://ik.imagekit.io/store/shoe.webp';
  assert.equal(sanitizeProductPayload({ image }).image, image);
  assert.equal(isSafeImageUrl('https://ik.imagekit.io.evil.test/shoe.webp'), false);
  assert.equal(isSafeImageUrl('/\\evil.test/image'), false);
  assert.throws(() => sanitizeProductPayload({ image: 'javascript:alert(1)' }));
  assert.equal(safeLink('/\\evil.test'), '/shop');
});

test('input editing keeps spaces; final normalization trims', () => {
  assert.equal(cleanInput('John '), 'John ');
  assert.equal(cleanStr('  John Doe  '), 'John Doe');
});

test('cache deduplicates only pending work, expires, and does not retain invalidated in-flight values', async () => {
  let now = 0, calls = 0;
  const cache = new TimedCache(() => now);
  const load = async () => ++calls;
  assert.deepEqual(await Promise.all([cache.get('products', 30, load), cache.get('products', 30, load)]), [1, 1]);
  now = 31;
  assert.equal(await cache.get('products', 30, load), 2);
  let release!: (value: number) => void;
  const pending = cache.get('product/1', 30, () => new Promise<number>(resolve => { release = resolve; }));
  await Promise.resolve();
  cache.invalidate('product/'); release(99); await pending;
  assert.equal(await cache.get('product/1', 30, load), 3);
});

test('public cache survives reloads only until expiry and never persists private responses or search text', async () => {
  let now = 1000, calls = 0;
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const disk = new PublicCacheStorage(() => storage, () => now);
  const create = () => new TimedCache(() => now, 3, disk);
  const item = (id: number) => ({ id, name: 'Fixture', price: 100, image: '' });
  const load = async () => ({ items: [item(++calls)], nextCursor: null });
  await create().get('/api/products?limit=24', 60_000, load, true);
  assert.deepEqual(await create().get('/api/products?limit=24', 60_000, load, true), { items: [item(1)], nextCursor: null });
  now += 60_001;
  assert.deepEqual(await create().get('/api/products?limit=24', 60_000, load, true), { items: [item(2)], nextCursor: null });
  for (const key of ['/api/account', '/api/orders', '/api/search?q=private-query', '/api/x9k2/products']) {
    await create().get(key, 60_000, async () => 'private fixture', true);
  }
  assert.doesNotMatch(data.get(PUBLIC_CACHE_KEY)!, /private|account|orders|x9k2/);
  create().invalidate('/api/products');
  assert.deepEqual(JSON.parse(data.get(PUBLIC_CACHE_KEY)!), {});
});

test('cache handles denied/corrupt/full storage, bounds memory, and keeps unrelated in-flight results', async () => {
  let now = 0;
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const disk = new PublicCacheStorage(() => storage, () => now, 1000);
  const cache = new TimedCache(() => now, 2, disk);
  data.set(PUBLIC_CACHE_KEY, '{broken');
  assert.equal(await cache.get('/api/offer', 10, async () => 1, true), 1);
  data.set(PUBLIC_CACHE_KEY,JSON.stringify({'/api/products?limit=24':{expires:10,value:{items:'corrupt',nextCursor:null}},'/api/offer':{expires:1000,value:{active:true}}}));
  assert.equal(disk.get('/api/products?limit=24',10),undefined);
  assert.equal(disk.get('/api/offer',10),undefined,'Future timestamps cannot extend the TTL');
  await cache.get('/api/products?id=1', 10, async () => 'x'.repeat(2000), true);
  assert.ok(data.get(PUBLIC_CACHE_KEY)!.length * 2 <= 1000);
  const denied = new TimedCache(() => now, 2, new PublicCacheStorage(() => { throw new Error('Storage denied'); }));
  assert.equal(await denied.get('/api/offer', 10, async () => 2, true), 2);
  let release!: (value: number) => void;
  const pending = cache.get('/api/site-settings', 10, () => new Promise<number>(resolve => { release = resolve; }));
  await Promise.resolve(); cache.invalidate('/api/products'); release(3); await pending;
  assert.equal(await cache.get('/api/site-settings', 10, async () => 99), 3);
  cache.set('a', 10, 1); cache.set('b', 10, 2); cache.peek('a'); cache.set('c', 10, 3);
  assert.equal(cache.peek('b'), undefined); assert.equal(cache.peek('a'), 1);
  now = 11; assert.equal(cache.peek('a'), undefined);
});

test('price filters preserve zero and decimal precision and reject malformed or reversed ranges', () => {
  assert.equal(priceBound(null), undefined); assert.equal(priceBound('0'), 0);
  assert.equal(priceBound('1499.99'), 1499.99);
  assert.equal(priceFilterError(1000, 1500), '');
  assert.ok(priceFilterError(2000, 1000));
  for (const value of ['NaN', '-1', 'Infinity', '1000001', '10x', '1e3']) assert.ok(priceFilterError(undefined, priceBound(value)));
});

test('cart migration caps quantities and line count, merges duplicate variants, and rejects bad IDs', () => {
  const base = { id: 1, price: 100, size: '8', size_unit: 'UK', qty: 8 };
  const cart = migrateCart([base, base, ...Array.from({ length: 30 }, (_, index) => ({ ...base, id: index + 2 })), { ...base, id: -1 }]);
  assert.equal(cart.length, MAX_LINE_ITEMS);
  assert.equal(cart[0].qty, MAX_QTY);
  assert.ok(cart.every(row => row.id > 0 && Number.isInteger(row.qty) && row.qty <= MAX_QTY));
});

test('frame loading stays bounded, cancels obsolete requests, and releases decoded frames', async () => {
  let loaded = 0, released = 0, aborted = 0;
  const buffer = new FrameBuffer<number>({ count: 60, radius: 4,
    load: (index, signal) => new Promise((resolve, reject) => {
      const timer = setTimeout(() => { loaded++; resolve(index); }, 1);
      signal.addEventListener('abort', () => { clearTimeout(timer); aborted++; reject(new Error('aborted')); }, { once: true });
    }), release: () => { released++; }, onReady: () => {},
  });
  buffer.request(0);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.ok(loaded <= 5, 'initial viewport must not download all frames');
  buffer.request(20); buffer.request(59);
  await new Promise(resolve => setTimeout(resolve, 30));
  assert.ok(buffer.size <= 10);
  assert.ok(aborted > 0);
  buffer.dispose();
  assert.equal(buffer.size, 0);
  assert.equal(released, loaded);
});

test('reduced-data frame buffer requests one poster only', async () => {
  const indices: number[] = [];
  const buffer = new FrameBuffer({ count: 60, radius: 0, load: async index => { indices.push(index); return index; }, release: () => {}, onReady: () => {} });
  buffer.request(0);
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.deepEqual(indices, [0]); buffer.dispose();
});

test('checkout retries reuse their key across calls and generate a new key for changed payloads', async () => {
  const memory = new Map<string, string>();
  Object.defineProperty(globalThis, 'sessionStorage', { configurable: true, value: {
    getItem: (key: string) => memory.get(key) || null, setItem: (key: string, value: string) => memory.set(key, value),
  } });
  const payload = { paymentMethod: 'cod' as const, items: [{ productId: 1, quantity: 1, size: '8', sizeUnit: 'UK' as const }], customer: { name: 'John Doe', phone: '9876543210', line1: 'Street', address: 'Street', city: 'City', state: 'State', pin: '123456' } };
  const first = await checkoutKey(payload);
  assert.equal(await checkoutKey(payload), first);
  assert.notEqual(await checkoutKey({ ...payload, items: [{ ...payload.items[0], quantity: 2 }] }), first);
});
