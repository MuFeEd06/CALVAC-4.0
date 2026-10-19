import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { hasSupabaseEnv, supabase } from '@/lib/supabase';
import { requestJson } from '@/api';

interface AdminAuthContextValue {
  session: Session | null;
  loading: boolean;
  hasEnv: boolean;
  authorized: boolean;
  error: string;
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  session: null,
  loading: true,
  hasEnv: hasSupabaseEnv,
  authorized: false,
  error: '',
});

export function AdminAuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let version = 0;
    let active = true;
    const validate = async (nextSession: Session | null) => {
      const request = ++version;
      setSession(nextSession); setAuthorized(false); setLoading(Boolean(nextSession)); setError('');
      if (!nextSession) return;
      try {
        const result = await requestJson<{admin: boolean}>('/api/admin-session', { headers: { Authorization: `Bearer ${nextSession.access_token}` } });
        if (active && request === version) setAuthorized(result.admin === true);
      } catch (error) {
        if (active && request === version) setError(error instanceof Error ? error.message : 'Could not verify admin access.');
      } finally { if (active && request === version) setLoading(false); }
    };
    supabase.auth.getSession().then(({ data }) => { if (active) void validate(data.session ?? null); })
      .catch(() => { if (active) { setError('Could not load your session. Please sign in again.'); setLoading(false); } });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (active) void validate(nextSession);
    });

    return () => { active = false; version++; sub.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AdminAuthContextValue>(() => ({
    session,
    loading,
    hasEnv: hasSupabaseEnv,
    authorized, error,
  }), [session, loading, authorized, error]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

