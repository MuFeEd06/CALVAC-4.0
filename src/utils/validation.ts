/**
 * Input validation helpers — used throughout the app to
 * sanitize user-entered data before rendering or sending to API.
 */

/** Strip control characters and limit length */
export function cleanStr(s: unknown, maxLen = 500): string {
  if (typeof s !== 'string') return '';
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '').slice(0, maxLen).trim();
}

/** Validate Indian PIN code */
export function isValidPin(pin: string): boolean {
  return /^[1-9][0-9]{5}$/.test(pin.trim());
}

/** Validate Indian mobile number (10 digits, optional +91 prefix) */
export function isValidPhone(phone: string): boolean {
  return /^(\+91[\-\s]?)?[6-9]\d{9}$/.test(phone.trim().replace(/\s/g, ''));
}

/** Validate a safe URL — http/https only, no javascript: or data: */
export function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    // Relative path — allow /shop, /product, etc.
    return url.startsWith('/') && !url.startsWith('//');
  }
}

/** Validate email address */
export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim()) && email.length <= 254;
}

/** Validate address form — returns first error message or null */
export function validateAddress(form: {
  name: string; phone: string; line1: string;
  city: string; state: string; pin: string;
}): string | null {
  if (!cleanStr(form.name, 100))    return 'Full name is required.';
  if (!isValidPhone(form.phone))    return 'Enter a valid 10-digit Indian mobile number.';
  if (!cleanStr(form.line1, 200))   return 'Address line 1 is required.';
  if (!cleanStr(form.city, 100))    return 'City is required.';
  if (!cleanStr(form.state, 100))   return 'State is required.';
  if (!isValidPin(form.pin))        return 'Enter a valid 6-digit PIN code.';
  return null;
}

/** Sanitize a product payload — trim all string fields, clamp numbers */
export function sanitizeProductPayload(draft: Record<string, unknown>): Record<string, unknown> {
  return {
    ...draft,
    name:           cleanStr(draft.name as string, 200),
    brand:          cleanStr(draft.brand as string, 100),
    price:          Math.max(0, Math.min(Number(draft.price) || 0, 1_000_000)),
    original_price: Math.max(0, Math.min(Number(draft.original_price) || 0, 1_000_000)),
    tag:            cleanStr(draft.tag as string, 50),
    category:       cleanStr(draft.category as string, 50),
    specs:          cleanStr(draft.specs as string, 2000),
    image:          isSafeUrl(String(draft.image || '')) ? String(draft.image) : '',
  };
}
