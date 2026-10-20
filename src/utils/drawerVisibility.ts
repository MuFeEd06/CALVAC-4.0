export const DRAWER_VISIBILITY_EVENT = 'calvac:drawer-visibility';
export const isDrawerOpen = () => document.documentElement.hasAttribute('data-store-drawer-open');

/** Keep expensive background animation still while the native modal is visible. */
export function setDrawerOpen(open: boolean, minimalEffects = false) {
  if (open) document.documentElement.setAttribute('data-store-drawer-effects', minimalEffects ? 'simple' : 'full');
  else document.documentElement.removeAttribute('data-store-drawer-effects');
  document.documentElement.toggleAttribute('data-store-drawer-open', open);
  document.dispatchEvent(new Event(DRAWER_VISIBILITY_EVENT));
}
