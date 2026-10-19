import { createClient } from '@supabase/supabase-js';
import { requestJson } from '@/api';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const hasSupabaseEnv = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = hasSupabaseEnv
  ? createClient(supabaseUrl!, supabaseAnonKey!, { auth: { flowType: 'pkce', detectSessionInUrl: true } })
  : null;

export async function googleSignInAvailable():Promise<boolean> {
  if(!hasSupabaseEnv)return false;
  const settings=await requestJson<{external?:{google?:boolean}}>(`${supabaseUrl}/auth/v1/settings`,{headers:{apikey:supabaseAnonKey!}},8000);
  return settings.external?.google===true;
}

