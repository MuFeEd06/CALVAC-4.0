import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TimedCache } from '../src/api/cache';
import { cleanInput, cleanStr, isSafeImageUrl, safeLink, sanitizeProductPayload } from '../src/utils/validation';
import { migrateCart, MAX_LINE_ITEMS, MAX_QTY } from '../src/utils/cart';
import { FrameBuffer } from '../src/utils/frameBuffer';
import { checkoutKey } from '../src/utils/checkout';

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
