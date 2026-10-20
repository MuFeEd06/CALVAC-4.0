import type { ConfirmedOrder } from '@/types/api';
import { formatPrice, WHATSAPP_NUMBER } from './index';
import { formatSizeWithUnit } from './sizeUnits';

function photoUrl(image: unknown, origin: string): string | null {
  if (typeof image !== 'string' || !image.trim()) return null;
  const value = image.trim();
  if (!value.startsWith('https://') && !/^\/(?!\/)/.test(value)) return null;
  try {
    const url = new URL(value, origin);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password
      || url.pathname === '/product-placeholder.svg') return null;
    return url.href;
  } catch { return null; }
}

/** Use saved item snapshots; opening or restoring a confirmation never refetches products. */
export function orderWhatsAppUrl(order: ConfirmedOrder, storefrontOrigin: string): string {
  const origin = new URL(storefrontOrigin).origin;
  let text = `Order #${order.id} — CALVAC\n\n`;
  for (const item of order.items) {
    text += `${item.name} × ${item.qty} — ${formatSizeWithUnit(item.size_unit, item.size)}${item.color ? ' / ' + item.color : ''}\n`;
    const photo = photoUrl(item.image, origin);
    if (photo) text += `Photo: ${photo}\n`;
    if (Number.isSafeInteger(item.product_id) && item.product_id > 0)
      text += `Product: ${origin}/product/${item.product_id}\n`;
    text += '\n';
  }
  text += `Total: ${formatPrice(Number(order.total))}\n`;
  if (order.customer) {
    const a = order.customer;
    text += `${a.name} · ${a.phone}\n${a.line1}${a.line2 ? ', ' + a.line2 : ''}, ${a.city}, ${a.state} ${a.pin}`;
  }
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(text)}`;
}
