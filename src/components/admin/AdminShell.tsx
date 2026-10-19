import { Outlet } from 'react-router-dom';
import { AdminAuthProvider } from '@/context/AdminAuthContext';
import '@/styles/admin.css';

export default function AdminShell() {
  return <AdminAuthProvider><Outlet /></AdminAuthProvider>;
}
