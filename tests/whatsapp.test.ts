import test from 'node:test';
import assert from 'node:assert/strict';
import type { ConfirmedOrder } from '../src/types/api';
import { orderWhatsAppUrl } from '../src/utils/whatsapp';

const order: ConfirmedOrder = {
  id: 1210, total: 3497, status: 'Pending', payment_method: 'whatsapp',
  items: [
    { product_id: 33, name: 'Superstar & Court', brand: 'Adidas', qty: 1, size: '8', size_unit: 'UK', color: 'White', price: 1499,
      image: 'https://ik.imagekit.io/fixture/white%20shoe.jpg?tr=w-640&q=80&ik-s=signed%2Bvalue' },
    { product_id: 12, name: 'Court Low', brand: 'Nike', qty: 2, size: '42', size_unit: 'EU', color: 'Black', price: 999, image: '/shoes/court.jpg' },
  ],
  customer: { name: 'Customer', phone: '9876543210', line1: '1 Main Street', line2: 'Floor 2', city: 'Kochi', state: 'Kerala', pin: '682001' },
};
const message = (value: ConfirmedOrder) => new URL(orderWhatsAppUrl(value, 'https://calvac.in')).searchParams.get('text')!;

test('WhatsApp and COD messages keep item details and the photo and product link for every item', () => {
  for (const payment_method of ['whatsapp', 'cod'] as const) {
    const url = new URL(orderWhatsAppUrl({ ...order, payment_method }, 'https://calvac.in'));
    const text = url.searchParams.get('text')!;
    assert.equal(url.origin + url.pathname, 'https://wa.me/919645087584');
    assert.match(text, /Order #1210 — CALVAC/);
    assert.ok(text.includes(`Superstar & Court × 1 — UK 8 / White\nPhoto: ${order.items[0].image}\nProduct: https://calvac.in/product/33`));
    assert.ok(text.includes('Court Low × 2 — EU 42 / Black\nPhoto: https://calvac.in/shoes/court.jpg\nProduct: https://calvac.in/product/12'));
    assert.match(text, /Total: ₹3,497/);
    assert.ok(text.includes('Customer · 9876543210\n1 Main Street, Floor 2, Kochi, Kerala 682001'));
  }
});

test('missing or unsafe legacy photos keep the product link without leaking invalid URLs', () => {
  for (const image of [null, '', '/product-placeholder.svg', 'javascript:alert(1)', 'data:image/png;base64,abc', '//example.invalid/shoe.jpg', 'https://user:secret@example.invalid/shoe.jpg', 'not a URL']) {
    const text = message({ ...order, items: [{ ...order.items[0], image: image as string }] });
    assert.doesNotMatch(text, /Photo:/);
    assert.match(text, /Product: https:\/\/calvac.in\/product\/33/);
    assert.doesNotMatch(text, /secret|javascript:|data:image|example.invalid/);
  }
});

test('a legacy order without image, product ID or customer still has a usable message', () => {
  const text = message({ ...order, customer: undefined, items: [{ ...order.items[0], image: '', product_id: null as unknown as number }] });
  assert.match(text, /Superstar & Court × 1 — UK 8/);
  assert.match(text, /Total: ₹3,497/);
  assert.doesNotMatch(text, /Photo:|Product:|undefined|null/);
});
