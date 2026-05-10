import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import type { Session } from '@supabase/supabase-js';
import { hasSupabaseEnv, supabase } from '@/lib/supabase';

interface AdminAuthContextValue {
  session: Session | null;
  loading: boolean;
  hasEnv: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextValue>({
  session: null,
  loading: true,
  hasEnv: hasSupabaseEnv,
});

export function AdminAuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setLoading(false);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const value = useMemo<AdminAuthContextValue>(() => ({
    session,
    loading,
    hasEnv: hasSupabaseEnv,
  }), [session, loading]);

  return <AdminAuthContext.Provider value={value}>{children}</AdminAuthContext.Provider>;
}

export function useAdminAuth() {
  return useContext(AdminAuthContext);
}

