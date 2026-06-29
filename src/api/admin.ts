import type { Offer, Product, SiteSettings } from '@/types';
import type { AdminOrder, AdminProductPayload } from '@/types/admin';
import { normalizeSizeList, normalizeSizeUnit } from '@/utils/sizeUnits';

// All admin API calls hit the same-domain Python serverless functions
const BASE = '';
const JSON_H = { 'Content-Type': 'application/json' };

function getSupabaseToken(): string | null {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (key.includes('-auth-token') || key.startsWith('sb-')) {
        const val = JSON.parse(localStorage.getItem(key) || 'null');
        const token = val?.access_token ?? val?.session?.access_token ?? null;
        if (token) return token;
      }
    }
  } catch {}
  return null;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getSupabaseToken();
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {}
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

async function fetchAdmin<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = { ...authHeaders(), ...(init?.headers as Record<string, string> ?? {}) };
  return fetchJson<T>(`${BASE}${path}`, { ...init, headers });
}

export async function adminLogin(email: string, password: string) {
  return fetchJson<{
    access_token: string;
    refresh_token: string;
    expires_in?: number;
    token_type?: string;
    user?: unknown;
  }>('/api/admin-login', {
    method: 'POST',
    headers: JSON_H,
    body: JSON.stringify({ email, password }),
  });
}

/* ── Orders ── */
export async function fetchAdminOrders(): Promise<AdminOrder[]> {
  const rows = await fetchAdmin<AdminOrder[]>('/api/x9k2/orders');
  return Array.isArray(rows)
    ? rows.map(row => ({ ...row, total: Number(row.total) || 0 }))
    : [];
}
export async function updateOrderStatus(orderId: number, status: AdminOrder['status']) {
  return fetchAdmin<{ success: boolean; error?: string }>(
    `/api/x9k2/orders?id=${orderId}&action=status`,
    { method: 'PATCH', headers: JSON_H, body: JSON.stringify({ status }) }
  );
}
export async function updateOrderNotes(orderId: number, notes: string) {
  return fetchAdmin<{ success: boolean; error?: string }>(
    `/api/x9k2/orders?id=${orderId}&action=notes`,
    { method: 'PATCH', headers: JSON_H, body: JSON.stringify({ notes }) }
  );
}

/* ── Products ── */
function parseF<T>(v: unknown, fb: T): T {
  if (v === null || v === undefined) return fb;
  if (typeof v === 'string') { try { return JSON.parse(v) as T; } catch { return fb; } }
  return v as T;
}

function sanitizeProduct(p: any): any {
  return {
    ...p,
    size_unit: normalizeSizeUnit(p.size_unit),
    sizes:  normalizeSizeList(Array.isArray(p.sizes) ? p.sizes : parseF<string[]>(p.sizes, [])),
    colors: Array.isArray(p.colors) ? p.colors : parseF<any[]>(p.colors, []),
    stock:  (typeof p.stock === 'object' && p.stock !== null && !Array.isArray(p.stock))
      ? p.stock
      : parseF<Record<string,number>>(p.stock, {}),
  };
}

export async function fetchAdminProducts(): Promise<Product[]> {
  const raw = await fetchAdmin<Product[]>('/api/x9k2/products');
  return Array.isArray(raw) ? raw.map(sanitizeProduct) : [];
}
export async function createAdminProduct(payload: AdminProductPayload) {
  return fetchAdmin<{ success?: boolean; product?: Product; error?: string }>(
    '/api/x9k2/products',
    { method: 'POST', headers: JSON_H, body: JSON.stringify(payload) }
  );
}
export async function updateAdminProduct(productId: number, payload: AdminProductPayload) {
  return fetchAdmin<{ success?: boolean; product?: Product; error?: string }>(
    `/api/x9k2/products?id=${productId}`,
    { method: 'PUT', headers: JSON_H, body: JSON.stringify(payload) }
  );
}
export async function deleteAdminProduct(productId: number) {
  return fetchAdmin<{ success?: boolean; error?: string }>(
    `/api/x9k2/products?id=${productId}`,
    { method: 'DELETE' }
  );
}

/* ── Settings ── */
export async function fetchAdminSettings(): Promise<Partial<SiteSettings> & Record<string, unknown>> {
  return fetchAdmin<Partial<SiteSettings> & Record<string, unknown>>('/api/x9k2/site-settings');
}
export async function saveAdminSettings(payload: Record<string, unknown>) {
  return fetchAdmin<{ success?: boolean; error?: string; settings?: Partial<SiteSettings> & Record<string, unknown> }>(
    '/api/x9k2/site-settings',
    { method: 'POST', headers: JSON_H, body: JSON.stringify(payload) }
  );
}

/* ── Offer ── */
export async function fetchAdminOffer(): Promise<Offer> {
  return fetchAdmin<Offer>('/api/x9k2/offer');
}
export async function saveAdminOffer(payload: Offer) {
  return fetchAdmin<{ success?: boolean; error?: string }>(
    '/api/x9k2/offer',
    { method: 'POST', headers: JSON_H, body: JSON.stringify(payload) }
  );
}
