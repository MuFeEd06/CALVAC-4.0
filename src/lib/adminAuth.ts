import { supabase } from './supabase';

export async function getAdminAuthHeaders(): Promise<Record<string, string>> {
  if (!supabase) throw new Error('Admin sign-in is not configured.');
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.access_token) throw new Error('Your session expired. Sign in again.');
  return { Authorization: `Bearer ${data.session.access_token}` };
}
