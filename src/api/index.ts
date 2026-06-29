import type { Product, SiteSettings, Offer } from '@/types';
import { DEFAULT_THEME_SETTINGS, normalizeSiteSettings } from '@/theme';
import { normalizeSizeList, normalizeSizeUnit } from '@/utils/sizeUnits';

const BASE = '';
const V = 'v6';

// TTLs
const PRODUCTS_TTL = 12 * 60 * 60 * 1000;
const SETTINGS_TTL = 30 * 1000;
const SEARCH_TTL   =  1 * 60 * 60 * 1000;
const OFFER_TTL    =  5 * 60 * 60 * 1000;
const PRODUCT_TTL  =  8 * 60 * 60 * 1000;

// ── ImageKit helpers ─────────────────────────────────────────────────
function ikResize(url: string, width: number, quality: number): string {
  if (!url || !url.includes('ik.imagekit.io')) return url;
  const base = url.split('?')[0];
  return `${base}?tr=w-${width},q-${quality},f-webp,c-at_max,pr-true,dpr-2`;
}

export function ikSrcSet(url: string, quality = 75): string {
  if (!url || !url.includes('ik.imagekit.io')) return '';
  const base = url.split('?')[0];
  return [320, 480, 640, 800, 1080, 1440]
    .map(w => `${base}?tr=w-${w},q-${quality},f-webp,c-at_max,pr-true ${w}w`)
    .join(', ');
}

function fixImage(img: string | undefined): string {
  if (!img) return '';
  if (img.startsWith('http')) return ikResize(img, 400, 75);
  if (img.startsWith('/static/')) return img;
  return '';
}

/** Parse a field that might be a JSON string, Postgres array, or native array */
function parseJsonField<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (Array.isArray(v) || (typeof v === 'object' && !Array.isArray(v))) return v as T;
  if (typeof v === 'string') {
    const s = v.trim();
    // JSON array
    if (s.startsWith('[')) { try { return JSON.parse(s) as T; } catch {} }
    // Postgres array literal {a,b,c}
    if (s.startsWith('{') && s.endsWith('}')) {
      const items = s.slice(1,-1).split(',').map(i => i.trim().replace(/^"|"$/g,''));
      return items as unknown as T;
    }
    // JSON object
    if (s.startsWith('{')) { try { return JSON.parse(s) as T; } catch {} }
  }
  return fallback;
}

function fixProducts(list: unknown[]): Product[] {
  if (!Array.isArray(list)) return [];
  return list.map((p: any) => ({
    ...p,
    name:   String(p.name  || '').slice(0, 200),
    brand:  String(p.brand || '').slice(0, 100),
    price:  Math.max(0, Number(p.price) || 0),
    image:  fixImage(p.image),
    size_unit: normalizeSizeUnit(p.size_unit),
    sizes:  normalizeSizeList(parseJsonField<string[]>(p.sizes, [])),
    colors: (parseJsonField<any[]>(p.colors, [])).map((c: any) => ({
      ...c, image: fixImage(c.image)
    })),
    stock:  parseJsonField<Record<string,number>>(p.stock, {}),
  }));
}

// ── Fetch with timeout (8 seconds) ───────────────────────────────────
async function fetchWithTimeout(url: string, options?: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return res;
  } catch (e: any) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error('Request timed out — please refresh');
    throw e;
  }
}

// ── Safe localStorage ─────────────────────────────────────────────────
function lsGet<T>(key: string): { ts: number; data: T } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.ts !== 'number') return null;
    if (parsed.data === undefined || parsed.data === null) return null;
    if (Array.isArray(parsed.data) && parsed.data.length === 0) return null;
    return parsed as { ts: number; data: T };
  } catch { return null; }
}
function lsSet(key: string, data: unknown): void {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}
function lsDel(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

// ── Products (12hr) ───────────────────────────────────────────────────
let _productsPromise: Promise<Product[]> | null = null;

export async function fetchProducts(): Promise<Product[]> {
  if (_productsPromise) return _productsPromise;

  const cached = lsGet<Product[]>(`calvac_products_${V}`);
  if (cached && Date.now() - cached.ts < PRODUCTS_TTL) {
    _productsPromise = Promise.resolve(fixProducts(cached.data));
    return _productsPromise;
  }

  _productsPromise = fetchWithTimeout(`${BASE}/api/products`)
    .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
    .then((data: Product[]) => {
      if (Array.isArray(data) && data.length > 0) lsSet(`calvac_products_${V}`, data);
      return fixProducts(data);
    })
    .catch(e => { _productsPromise = null; throw e; });

  return _productsPromise;
}

export function clearProductsCache(): void {
  _productsPromise = null;
  lsDel(`calvac_products_${V}`);
}

export function clearSettingsCache(): void {
  _settingsPromise = null;
  lsDel(`calvac_settings_${V}`);
}

export function setCachedSiteSettings(settings: Partial<SiteSettings> & Record<string, unknown>): SiteSettings & Record<string, unknown> {
  const normalized = normalizeSiteSettings({ ...DEFAULT_SETTINGS, ...settings });
  _settingsPromise = Promise.resolve(normalized);
  lsSet(`calvac_settings_${V}`, normalized);
  return normalized as SiteSettings & Record<string, unknown>;
}

// ── Site settings (12hr) ──────────────────────────────────────────────
let _settingsPromise: Promise<SiteSettings> | null = null;

const DEFAULT_SETTINGS: SiteSettings = {
  theme_settings: DEFAULT_THEME_SETTINGS,
  primary_color: DEFAULT_THEME_SETTINGS.primaryColor,
  hero_font: 'default',
  model_path: '/static/sneaker.glb', model_scale: 3.0, model_y: 0.8, model_speed: 0.006,
  show_new_arrivals: true, show_categories: true,
  cat_boots: true, cat_crocs: true, cat_girls: true, cat_sale: true,
  cat_under1000: true, cat_under1500: true, cat_under2500: true,
  cat_new: true, cat_premium: true, cat_all: true,
};

export async function fetchSiteSettings(options: { force?: boolean } = {}): Promise<SiteSettings> {
  if (!options.force && _settingsPromise) return _settingsPromise;

  const cached = lsGet<Partial<SiteSettings> & Record<string, unknown>>(`calvac_settings_${V}`);
  if (!options.force && cached && Date.now() - cached.ts < SETTINGS_TTL) {
    _settingsPromise = Promise.resolve(normalizeSiteSettings({ ...DEFAULT_SETTINGS, ...cached.data }));
    return _settingsPromise;
  }

  _settingsPromise = fetchWithTimeout(`${BASE}/api/site-settings`)
    .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
    .then((data: Partial<SiteSettings> & Record<string, unknown>) => {
      const normalized = normalizeSiteSettings({ ...DEFAULT_SETTINGS, ...data });
      lsSet(`calvac_settings_${V}`, normalized);
      return normalized;
    })
    .catch(() => { _settingsPromise = null; return DEFAULT_SETTINGS; });

  return _settingsPromise;
}

export function refreshSiteSettings(): Promise<SiteSettings> {
  _settingsPromise = null;
  return fetchSiteSettings({ force: true });
}

// ── Offer (5hr) ───────────────────────────────────────────────────────
export async function fetchOffer(): Promise<Offer> {
  const cached = lsGet<Offer>(`calvac_offer_${V}`);
  if (cached && Date.now() - cached.ts < OFFER_TTL) return cached.data;
  try {
    const r = await fetchWithTimeout(`${BASE}/api/offer`);
    if (!r.ok) throw new Error(`${r.status}`);
    const data: Offer = await r.json();
    lsSet(`calvac_offer_${V}`, data);
    return data;
  } catch {
    return { active: false, text: '', bg_color: '#FF6B35', text_color: '#ffffff', show_logo: true };
  }
}

// ── Single product (8hr) ──────────────────────────────────────────────
export async function fetchProduct(id: number): Promise<Product | null> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid product ID');
  const cacheKey = `calvac_product_${id}_${V}`;
  const cached = lsGet<Product>(cacheKey);
  if (cached && Date.now() - cached.ts < PRODUCT_TTL) return cached.data;
  const r = await fetchWithTimeout(`${BASE}/api/products?id=${id}`);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error('Could not load product');
  const p: Product = await r.json();
  const fixed = fixProducts([p])[0];
  if (!fixed?.id) return null;
  lsSet(cacheKey, fixed);
  return fixed;
}

// ── Search (1hr) ──────────────────────────────────────────────────────
export async function searchProducts(q: string): Promise<Product[]> {
  const safe = q.replace(/<[^>]*>/g, '').slice(0, 100).trim();
  if (!safe) return [];
  const cacheKey = `calvac_search_${safe.toLowerCase()}_${V}`;
  const cached = lsGet<Product[]>(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_TTL) return cached.data;
  try {
    const r = await fetchWithTimeout(`${BASE}/api/search?q=${encodeURIComponent(safe)}`);
    if (!r.ok) throw new Error(`${r.status}`);
    const data: Product[] = await r.json();
    const fixed = fixProducts(data);
    if (fixed.length > 0) lsSet(cacheKey, fixed);
    return fixed;
  } catch { return []; }
}

// ── Create order ──────────────────────────────────────────────────────
export interface OrderPayload {
  items: Array<{ productId: number | string; quantity: number; size?: string; sizeUnit?: 'UK' | 'EU'; color?: string }>;
  customer: {
    name: string;
    phone: string;
    address: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pin: string;
    landmark?: string;
  };
  paymentMethod: 'cod';
}

export async function createOrder(payload: OrderPayload, idempotencyKey: string): Promise<{ success: boolean; order?: unknown }> {
  const res = await fetchWithTimeout(`${BASE}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    let message = 'Could not place order';
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return res.json();
}

export { ikResize };
