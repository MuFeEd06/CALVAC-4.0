import type { CartItem } from '@/types';
import { cleanSizeLabel, normalizeSizeUnit } from './sizeUnits';

export const MAX_QTY = 10;
export const MAX_LINE_ITEMS = 20;
export function sameCartItem(a: Pick<CartItem, 'id' | 'size' | 'size_unit' | 'color'>, b: Pick<CartItem, 'id' | 'size' | 'size_unit' | 'color'>) {
  return a.id === b.id && a.size === b.size && a.size_unit === b.size_unit && (a.color || '') === (b.color || '');
}
export function migrateCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  const result: CartItem[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const size = cleanSizeLabel(item.size), id = Number(item.id), price = Number(item.price);
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isFinite(price) || price < 0 || !size) continue;
    const next: CartItem = {
      id, price, size, size_unit: normalizeSizeUnit(item.size_unit || item.sizeUnit || item.size),
      qty: Math.max(1, Math.min(MAX_QTY, Math.floor(Number(item.qty) || 1))),
      name: String(item.name || '').slice(0, 200), brand: String(item.brand || '').slice(0, 100),
      image: String(item.image || ''), color: item.color ? String(item.color).slice(0, 80) : undefined,
      colorHex: item.colorHex ? String(item.colorHex).slice(0, 20) : undefined,
    };
    const existing = result.find(row => sameCartItem(row, next));
    if (existing) existing.qty = Math.min(MAX_QTY, existing.qty + next.qty);
    else if (result.length < MAX_LINE_ITEMS) result.push(next);
  }
  return result;
}
