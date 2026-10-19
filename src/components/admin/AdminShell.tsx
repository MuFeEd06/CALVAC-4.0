import { Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { fetchSiteSettings } from '@/api';
import { applyThemeSettings } from '@/theme';
import { AdminAuthProvider } from '@/context/AdminAuthContext';
import '@/styles/admin.css';

export default function AdminShell() {
  useEffect(()=>{let active=true;fetchSiteSettings().then(settings=>{if(active)applyThemeSettings(settings.theme_settings);}).catch(()=>{});return()=>{active=false;};},[]);
  return <AdminAuthProvider><Outlet /></AdminAuthProvider>;
}
