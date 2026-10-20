import type { SyntheticEvent } from 'react';
export const FALLBACK_IMAGE = '/product-placeholder.svg';

function imagekitUrl(url: string): URL | null {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname === 'ik.imagekit.io'
      && !parsed.username && !parsed.password ? parsed : null;
  } catch { return null; }
}

/** Keep query metadata and signed URLs intact; resize only the ImageKit host. */
export function ikResize(url: string, width: number, quality: number): string {
  if (!url) return '';
  const parsed = imagekitUrl(url);
  if (!parsed || parsed.searchParams.has('ik-s')) return url;
  const size = Math.max(16, Math.min(1920, Math.round(width) || 400));
  const q = Math.max(1, Math.min(100, Math.round(quality) || 75));
  parsed.searchParams.set('tr', `w-${size},q-${q},f-webp,c-at_max,pr-true`);
  return parsed.toString();
}

export function ikSrcSet(url: string, quality = 75, widths = [320, 480, 640, 800, 1080, 1440]): string | undefined {
  const parsed = imagekitUrl(url);
  if (!parsed || parsed.searchParams.has('ik-s')) return undefined;
  return widths.map(width => `${ikResize(url, width, quality)} ${width}w`).join(', ');
}

export function imageFallback(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallback) return;
  image.dataset.fallback = 'true'; image.removeAttribute('srcset'); image.src = FALLBACK_IMAGE;
}
