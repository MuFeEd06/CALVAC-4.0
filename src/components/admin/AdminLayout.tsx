import ThemeSwitch from '../ThemeSwitch';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { customerSignOut } from '@/lib/customerAuth';

const BASE = '/manage-store-x9k2';

export default function AdminLayout() {
  const navigate = useNavigate();
  const [error,setError]=useState('');

  const logout = async () => {
    try{await customerSignOut();navigate(`${BASE}/login`, { replace: true });}
    catch(error){setError(error instanceof Error?error.message:'Could not sign out.');}
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
        <ThemeSwitch />
        <button type="button" className="admin-logout" onClick={logout}>
          Sign Out
        </button>
      </header>
      <main className="admin-page-wrap">
        {error&&<p role="alert" className="admin-error">{error}</p>}
        <Outlet />
      </main>
    </div>
  );
}
