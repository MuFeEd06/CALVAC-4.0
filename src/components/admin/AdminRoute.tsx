import type { PropsWithChildren } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { supabase } from '@/lib/supabase';

const BASE = '/manage-store-x9k2';

export default function AdminRoute({ children }: PropsWithChildren) {
  const { session, loading, hasEnv, authorized, error } = useAdminAuth();
  const location = useLocation();

  if (!hasEnv) {
    return (
      <main className="admin-login-page">
        <div className="admin-login-card">
          <h1>Supabase Not Configured</h1>
          <p>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to your <code>.env</code> file.</p>
        </div>
      </main>
    );
  }

  if (loading) {
    return (
      <main className="admin-loading-page">
        <p>Checking admin session…</p>
      </main>
    );
  }

  if (!session) {
    return <Navigate to={`${BASE}/login`} replace state={{ from: location.pathname }} />;
  }

  if (!authorized || error) return <main role="alert" className="admin-login-page"><div className="admin-login-card">
    <h1>Admin access unavailable</h1><p>{error || 'This account does not have admin permission.'}</p>
    <button onClick={() => window.location.reload()}>Try again</button>
    <button onClick={() => void supabase?.auth.signOut()}>Sign out</button>
  </div></main>;
  return <>{children}</>;
}
