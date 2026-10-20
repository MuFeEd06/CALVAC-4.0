import type { Product, SiteSettings, Offer } from '@/types';
import type { Page, ConfirmedOrder } from '@/types/api';
import { DEFAULT_THEME_SETTINGS, normalizeSiteSettings } from '@/theme';
import { normalizeSizeList, normalizeSizeUnit } from '@/utils/sizeUnits';
import { TimedCache, PublicCacheStorage, PUBLIC_CACHE_KEY } from './cache';
import { ikResize } from '@/utils/images';
export { ikResize, ikSrcSet } from '@/utils/images';

const cache = new TimedCache(() => Date.now(), 100, new PublicCacheStorage(() => localStorage));
const SETTINGS_KEY = 'calvac_settings_v8';
const CATALOG_TTL = 60_000, SETTINGS_TTL = 300_000, OFFER_TTL = 60_000, SEARCH_TTL = 30_000;
let searchGeneration = 0;
if (typeof window !== 'undefined') window.addEventListener('storage', event => {
  if (event.key === PUBLIC_CACHE_KEY || event.key === null) { cache.invalidateMemory(); searchGeneration++; }
});

function parseField(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try { return JSON.parse(value); } catch {
    if (value.startsWith('{') && value.endsWith('}')) return value.slice(1, -1).split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    return null;
  }
}
export function normalizeProduct(p: Product): Product {
  const colors = parseField(p.colors), stock = parseField(p.stock);
  return {
    ...p, name: String(p.name || '').slice(0, 200), brand: String(p.brand || '').slice(0, 100),
    price: Math.max(0, Number(p.price) || 0), image: ikResize(p.image, 400, 75),
    size_unit: normalizeSizeUnit(p.size_unit), sizes: normalizeSizeList(parseField(p.sizes)),
    colors: Array.isArray(colors) ? colors.filter(c => c && typeof c === 'object').map(c => ({ ...c, image: ikResize(c.image || '', 400, 75) })) : [],
    stock: stock && typeof stock === 'object' && !Array.isArray(stock) ? stock as Record<string, number> : {},
  };
}

export class ApiError extends Error {
  constructor(message: string, public status: number, public retryAfter?: number) { super(message); }
}
export async function requestJson<T>(url: string, options: RequestInit = {}, timeoutMs = 12_000): Promise<T> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new ApiError(body?.error || `Request failed (${response.status})`, response.status,
      Math.max(0,Math.min(300,Number(body?.retryAfter||response.headers.get('Retry-After'))||0)));
    if (body === null) throw new Error('The server returned an invalid response.');
    return body as T;
  } catch (error) {
    if (controller.signal.aborted && !options.signal?.aborted) throw new ApiError('The request timed out. Please try again.', 408);
    throw error;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', abort);
  }
}

export interface ProductFilters {
  limit?: number; after?: string | null; brand?: string; tag?: string; category?: string;
  q?: string; sale?: string; max_price?: number; min_price?: number;
}
export async function fetchProductsPage(filters: ProductFilters = {}): Promise<Page<Product>> {
  const params = new URLSearchParams();
  Object.entries({ limit: 24, ...filters }).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  });
  params.sort();
  const url = `/api/products?${params}`;
  return cache.get(url, CATALOG_TTL, async () => {
    const page = await requestJson<Page<Product>>(url);
    if (!Array.isArray(page.items)) throw new Error('Invalid product response.');
    return { items: page.items.map(normalizeProduct), nextCursor: page.nextCursor ?? null };
  }, true);
}
export async function fetchProducts(filters: ProductFilters = {}): Promise<Product[]> {
  return (await fetchProductsPage(filters)).items;
}
export function clearProductsCache(): void {
  searchGeneration++;
  cache.invalidate('/api/products'); cache.invalidate('/api/search');
  try {
    for (const key of Object.keys(localStorage)) {
      if (/^calvac_(products|product_|search_)/.test(key)) localStorage.removeItem(key);
    }
  } catch { /* Storage may be disabled. */ }
}
export async function fetchProduct(id: number): Promise<Product | null> {
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('Invalid product ID');
  const key = `/api/products?id=${id}`;
  return cache.get(key, 15_000, async () => {
    try { return normalizeProduct(await requestJson<Product>(key)); }
    catch (error) { if (error instanceof ApiError && error.status === 404) return null; throw error; }
  }, true);
}

export const DEFAULT_SETTINGS: SiteSettings = {
  theme_settings: DEFAULT_THEME_SETTINGS, primary_color: DEFAULT_THEME_SETTINGS.primaryColor,
  hero_font: 'default', model_path: '', model_scale: 3, model_y: .8, model_speed: .006,
  show_new_arrivals: true, show_categories: true,
  cat_boots: true, cat_crocs: true, cat_girls: true, cat_sale: true,
  cat_under1000: true, cat_under1500: true, cat_under2500: true,
  cat_new: true, cat_premium: true, cat_all: true,
};
export function setCachedSiteSettings(settings: Partial<SiteSettings> & Record<string, unknown>, invalidate = true): SiteSettings & Record<string, unknown> {
  const normalized = normalizeSiteSettings({ ...DEFAULT_SETTINGS, ...settings });
  if (invalidate) { cache.invalidate('/api/site-settings'); cache.set('/api/site-settings', SETTINGS_TTL, normalized, true); }
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ts: Date.now(), data: normalized }));
    localStorage.removeItem('calvac_settings_v4'); localStorage.removeItem('calvac_settings_v5'); localStorage.removeItem('calvac_settings_v6'); localStorage.removeItem('calvac_settings_v7');
  } catch { /* Keep the in-memory theme usable when storage is unavailable. */ }
  return normalized;
}
export function clearSettingsCache() { cache.invalidate('/api/site-settings'); }
export async function fetchSiteSettings(options: { force?: boolean } = {}): Promise<SiteSettings> {
  if (options.force) clearSettingsCache();
  return cache.get('/api/site-settings', SETTINGS_TTL, async () => {
    const data = await requestJson<Partial<SiteSettings> & Record<string, unknown>>('/api/site-settings');
    return setCachedSiteSettings(data, false);
  }, true);
}
export function refreshSiteSettings() { return fetchSiteSettings({ force: true }); }
export function clearOfferCache() { cache.invalidate('/api/offer'); }
export function fetchOffer(): Promise<Offer> {
  return cache.get('/api/offer', OFFER_TTL, () => requestJson<Offer>('/api/offer'), true);
}
export async function searchProducts(q: string, signal?: AbortSignal): Promise<Product[]> {
  const safe = q.replace(/<[^>]*>/g, '').slice(0, 100).trim();
  if (safe.length < 2) return [];
  if (signal?.aborted) throw new DOMException('Search cancelled', 'AbortError');
  const url = `/api/search?q=${encodeURIComponent(safe.toLowerCase())}`;
  const cached = cache.peek<Product[]>(url);
  if (cached) return cached;
  const generation = searchGeneration;
  const data = await requestJson<Product[]>(url, { signal });
  const products = Array.isArray(data) ? data.map(normalizeProduct) : [];
  if (!signal?.aborted && generation === searchGeneration) cache.set(url, SEARCH_TTL, products);
  return products;
}
export interface OrderPayload {
  items: Array<{ productId: number | string; quantity: number; size: string; sizeUnit: 'UK' | 'EU'; color?: string }>;
  customer: { name: string; phone: string; address: string; line1: string; line2?: string; city: string; state: string; pin: string; landmark?: string };
  paymentMethod: 'cod'|'whatsapp'|'razorpay';
}
export async function createOrder(payload: OrderPayload, idempotencyKey: string): Promise<{ success: true; order: ConfirmedOrder }> {
  const {customerAuthHeaders}=await import('@/lib/customerAuth');
  const auth=await customerAuthHeaders(payload.paymentMethod==='razorpay');
  const result = await requestJson<{ success: true; order: ConfirmedOrder }>('/api/orders', {
    method: 'POST', headers: { ...auth, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify(payload),
  }, 60_000);
  if (!result.success || !result.order?.id) throw new Error('Order confirmation is incomplete. Retry to check the same order.');
  clearProductsCache();
  return result;
}
