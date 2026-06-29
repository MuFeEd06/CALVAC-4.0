import type { ProductSizeUnit } from '@/types';

export const SIZE_UNITS: ProductSizeUnit[] = ['UK', 'EU'];

export const SIZE_OPTIONS: Record<ProductSizeUnit, string[]> = {
  UK: ['3', '3.5', '4', '5', '6', '6.5', '7', '8', '9', '10', '11', '11.5', '12'],
  EU: ['35', '36', '37', '38', '39', '40', '41', '42', '43', '44', '45', '46', '47'],
};

const SAFE_SIZE_RE = /^[A-Za-z0-9][A-Za-z0-9 .+/-]{0,19}$/;

export function normalizeSizeUnit(value: unknown): ProductSizeUnit {
  const raw = String(value || 'UK').trim().toUpperCase();
  if (raw === 'EU' || raw === 'EURO' || raw.startsWith('EU ') || raw.startsWith('EURO ')) return 'EU';
  return 'UK';
}

export function cleanSizeLabel(value: unknown): string {
  if (value === null || value === undefined) return '';
  let size = String(value).replace(/[\x00-\x1F\x7F]/g, '').trim();
  size = size.replace(/^(UK|EURO?|EUR)\s+/i, '').trim();
  size = size.slice(0, 20);
  if (!SAFE_SIZE_RE.test(size)) return '';
  return size;
}

export function normalizeSizeList(value: unknown): string[] {
  const list = Array.isArray(value) ? value : [];
  const seen = new Set<string>();
  const sizes: string[] = [];
  for (const raw of list) {
    const size = cleanSizeLabel(raw);
    const key = size.toLowerCase();
    if (!size || seen.has(key)) continue;
    seen.add(key);
    sizes.push(size);
    if (sizes.length >= 40) break;
  }
  return sizes;
}

export function formatSizeWithUnit(unit: unknown, size: unknown): string {
  const label = cleanSizeLabel(size);
  return label ? `${normalizeSizeUnit(unit)} ${label}` : 'Size unavailable';
}
