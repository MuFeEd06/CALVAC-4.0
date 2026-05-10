import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabase';

const BASE = '/manage-store-x9k2';

export default function AdminLayout() {
  const navigate = useNavigate();

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    navigate(`${BASE}/login`, { replace: true });
  };

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <div className="admin-brand">CALVAC <span>Admin</span></div>
        <nav className="admin-nav">
          <NavLink to={`${BASE}/dashboard`}>Orders</NavLink>
          <NavLink to={`${BASE}/products`}>Products</NavLink>
          <NavLink to={`${BASE}/settings`}>Site Settings</NavLink>
        </nav>
        <button type="button" className="admin-logout" onClick={logout}>
          Sign Out
        </button>
      </header>
      <main className="admin-page-wrap">
        <Outlet />
      </main>
    </div>
  );
}
