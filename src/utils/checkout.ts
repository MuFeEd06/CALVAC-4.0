import type { OrderPayload } from '@/api';

export async function checkoutKey(payload: OrderPayload): Promise<string> {
  const fingerprint = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)))))
    .map(byte => byte.toString(16).padStart(2, '0')).join('');
  try {
    const saved = JSON.parse(sessionStorage.getItem('calvac_checkout_attempt') || 'null');
    if (saved?.fingerprint === fingerprint && typeof saved.key === 'string') return saved.key;
  } catch { /* Storage is optional; the current click still receives a secure key. */ }
  const key = crypto.randomUUID();
  try { sessionStorage.setItem('calvac_checkout_attempt', JSON.stringify({ fingerprint, key })); } catch {}
  return key;
}
