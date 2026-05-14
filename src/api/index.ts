import type { Product, SiteSettings, Offer } from '@/types';

const BASE = '';

// Cache TTLs
const PRODUCTS_TTL = 12 * 60 * 60 * 1000;
const SETTINGS_TTL = 12 * 60 * 60 * 1000;
const SEARCH_TTL   =  1 * 60 * 60 * 1000;
const OFFER_TTL    =  5 * 60 * 60 * 1000;
const PRODUCT_TTL  =  8 * 60 * 60 * 1000;

// ── Cache key version — bump to invalidate all stale browser caches ──
const V = 'v4'; // bump clears all stale caches

function ikResize(url: string, width: number, quality: number): string {
  if (!url || !url.includes('ik.imagekit.io')) return url;
  const base = url.split('?')[0];
  // f-webp: modern format, 40-60% smaller than JPEG
  // q: quality 1-100
  // c-at_max: never upscale (saves bandwidth on small images)
  // pr-true: progressive — shows blurred preview while loading
  // dpr-2: serve 2× pixels for retina screens
  return `${base}?tr=w-${width},q-${quality},f-webp,c-at_max,pr-true,dpr-2`;
}

export function ikSrcSet(url: string, quality = 75): string {
  if (!url || !url.includes('ik.imagekit.io')) return '';
  const base = url.split('?')[0];
  // Responsive srcset — browser picks the right size for the screen
  return [320, 480, 640, 800, 1080, 1440]
    .map(w => `${base}?tr=w-${w},q-${quality},f-webp,c-at_max,pr-true ${w}w`)
    .join(', ');
}

function fixImage(img: string | undefined): string {
  if (!img) return '';
  if (img.startsWith("http")) return ikResize(img, 220, 75);
  if (img.startsWith('/static/')) return img;
  return '';
}

/** Parse a field that might be a JSON string, array, or object */
function parseJsonField<T>(v: unknown, fallback: T): T {
  if (v === null || v === undefined) return fallback;
  if (typeof v === 'string') {
    try { return JSON.parse(v) as T; } catch { return fallback; }
  }
  return v as T;
}

function fixProducts(list: unknown[]): Product[] {
  if (!Array.isArray(list)) return [];
  return list.map((p: any) => {
    const sizes  = parseJsonField<string[]>(p.sizes, []);
    const colors = parseJsonField<any[]>(p.colors, []);
    const stock  = parseJsonField<Record<string,number>>(p.stock, {});
    return {
      ...p,
      name:   String(p.name  || '').slice(0, 200),
      brand:  String(p.brand || '').slice(0, 100),
      price:  Math.max(0, Number(p.price) || 0),
      image:  fixImage(p.image),
      sizes:  Array.isArray(sizes) ? sizes : [],
      colors: Array.isArray(colors)
        ? colors.map((c: any) => ({ ...c, image: fixImage(c.image) }))
        : [],
      stock: typeof stock === 'object' && stock !== null ? stock : {},
    };
  });
}

// ── Safe localStorage ────────────────────────────────────────────────
function lsGet<T>(key: string, validate?: (d: T) => boolean): T | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.ts !== 'number') return null;
    if (parsed.data === undefined || parsed.data === null) return null;
    // Reject empty arrays — empty means a previous failed/empty fetch was cached
    if (Array.isArray(parsed.data) && parsed.data.length === 0) return null;
    if (validate && !validate(parsed.data as T)) return null;
    return parsed as T;
  } catch { return null; }
}

function lsSet(key: string, data: unknown): void {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function lsDel(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

// ── Products (12hr) ──────────────────────────────────────────────────
let _productsPromise: Promise<Product[]> | null = null;

export async function fetchProducts(): Promise<Product[]> {
  if (_productsPromise) return _productsPromise;

  const cacheKey = `calvac_products_${V}`;
  const cached = lsGet<{ ts: number; data: Product[] }>(cacheKey);
  if (cached && Date.now() - cached.ts < PRODUCTS_TTL) {
    _productsPromise = Promise.resolve(fixProducts(cached.data));
    return _productsPromise;
  }

  _productsPromise = fetch(`${BASE}/api/products`)
    .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
    .then((data: Product[]) => {
      // Only cache if we actually got products
      if (Array.isArray(data) && data.length > 0) {
        lsSet(cacheKey, data);
      }
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

// ── Site settings (12hr) ─────────────────────────────────────────────
let _settingsPromise: Promise<SiteSettings> | null = null;

const DEFAULT_SETTINGS: SiteSettings = {
  primary_color: '#2B9FD8', hero_font: 'default',
  model_path: '/static/sneaker.glb', model_scale: 3.0, model_y: 0.8, model_speed: 0.006,
  size_unit: 'uk', show_new_arrivals: true, show_categories: true,
  cat_boots: true, cat_crocs: true, cat_girls: true, cat_sale: true,
  cat_under1000: true, cat_under1500: true, cat_under2500: true,
  cat_new: true, cat_premium: true, cat_all: true,
};

export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (_settingsPromise) return _settingsPromise;

  const cacheKey = `calvac_settings_${V}`;
  const cached = lsGet<{ ts: number; data: Partial<SiteSettings> }>(cacheKey);
  if (cached && Date.now() - cached.ts < SETTINGS_TTL) {
    _settingsPromise = Promise.resolve({ ...DEFAULT_SETTINGS, ...cached.data });
    return _settingsPromise;
  }

  _settingsPromise = fetch(`${BASE}/api/site-settings`)
    .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
    .then((data: Partial<SiteSettings>) => {
      lsSet(cacheKey, data);
      return { ...DEFAULT_SETTINGS, ...data };
    })
    .catch(() => {
      _settingsPromise = null; // reset so next navigation retries
      return DEFAULT_SETTINGS;
    });

  return _settingsPromise!;
}

// ── Offer (5hr) ──────────────────────────────────────────────────────
export async function fetchOffer(): Promise<Offer> {
  const cacheKey = `calvac_offer_${V}`;
  const cached = lsGet<{ ts: number; data: Offer }>(cacheKey);
  if (cached && Date.now() - cached.ts < OFFER_TTL) return cached.data;

  try {
    const r = await fetch(`${BASE}/api/offer`);
    if (!r.ok) throw new Error(`${r.status}`);
    const data: Offer = await r.json();
    lsSet(cacheKey, data);
    return data;
  } catch {
    return { active: false, text: '', bg_color: '#FF6B35', text_color: '#ffffff', show_logo: true };
  }
}

// ── Single product (8hr) ─────────────────────────────────────────────
export async function fetchProduct(id: number): Promise<Product> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid product ID');

  const cacheKey = `calvac_product_${id}_${V}`;
  const cached = lsGet<{ ts: number; data: Product }>(cacheKey);
  if (cached && Date.now() - cached.ts < PRODUCT_TTL) return cached.data;

  const r = await fetch(`${BASE}/api/products?id=${id}`);
  if (!r.ok) throw new Error('Not found');
  const p: Product = await r.json();
  const fixed = fixProducts([p])[0];
  lsSet(cacheKey, fixed);
  return fixed;
}

// ── Search (1hr) ─────────────────────────────────────────────────────
export async function searchProducts(q: string): Promise<Product[]> {
  const safe = q.replace(/<[^>]*>/g, '').slice(0, 100).trim();
  if (!safe) return [];

  const cacheKey = `calvac_search_${safe.toLowerCase()}_${V}`;
  const cached = lsGet<{ ts: number; data: Product[] }>(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_TTL) return cached.data;

  try {
    const r = await fetch(`${BASE}/api/search?q=${encodeURIComponent(safe)}`);
    if (!r.ok) throw new Error(`${r.status}`);
    const data: Product[] = await r.json();
    const fixed = fixProducts(data);
    if (fixed.length > 0) lsSet(cacheKey, fixed);
    return fixed;
  } catch { return []; }
}

// ── Create order ──────────────────────────────────────────────────────
export async function createOrder(payload: {
  address: object; items: object[]; total: number;
}): Promise<void> {
  try {
    await fetch(`${BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}
}

export { ikResize };
