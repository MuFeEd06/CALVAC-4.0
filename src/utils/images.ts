import type { SyntheticEvent } from 'react';
export const FALLBACK_IMAGE = '/product-placeholder.svg';
export function imageFallback(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallback) return;
  image.dataset.fallback = 'true'; image.removeAttribute('srcset'); image.src = FALLBACK_IMAGE;
}
