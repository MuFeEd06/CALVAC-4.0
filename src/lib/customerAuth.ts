import { supabase } from './supabase';
import { ApiError } from '@/api';

export async function customerAuthHeaders(required = true): Promise<Record<string,string>> {
  if (!supabase) {
    if (required) throw new ApiError('Customer sign-in is not configured.',503);
    return {};
  }
  const { data, error } = await supabase.auth.getSession();
  if (error) throw new ApiError('Your session could not be refreshed. Please sign in again.',401);
  if (!data.session) {
    if (required) throw new ApiError('Sign in to continue.',401);
    return {};
  }
  return { Authorization: `Bearer ${data.session.access_token}` };
}

export function localRedirect(value: string | null, fallback = '/account') {
  return value && value.startsWith('/') && !value.startsWith('//') && !/[\\\x00-\x20]/.test(value) ? value : fallback;
}

export async function customerSignOut() {
  if (supabase) {
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    if (error) throw new Error('Could not sign out. Please try again.');
  }
  try { for (const key of ['calvac_address','calvac_confirmed_order','calvac_checkout_attempt']) sessionStorage.removeItem(key); } catch {}
  window.dispatchEvent(new Event('calvac:signout'));
}
