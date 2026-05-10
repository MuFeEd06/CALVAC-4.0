import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { CartProvider } from '@/context/CartContext';
import { ToastProvider } from '@/context/ToastContext';
import { AdminAuthProvider } from '@/context/AdminAuthContext';
import Layout from '@/components/Layout';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminRoute from '@/components/admin/AdminRoute';
import HomePage from '@/pages/HomePage';
import ShopPage from '@/pages/ShopPage';
import ProductPage from '@/pages/ProductPage';
import CartPage from '@/pages/CartPage';
import ContactPage from '@/pages/ContactPage';
import PolicyPage from '@/pages/PolicyPage';
import AdminLoginPage from '@/pages/admin/AdminLoginPage';
import AdminDashboardPage from '@/pages/admin/AdminDashboardPage';
import AdminProductsPage from '@/pages/admin/AdminProductsPage';
import AdminSettingsPage from '@/pages/admin/AdminSettingsPage';

/* ── Admin base path — obscured, matches old Flask convention ── */
const ADMIN_BASE = '/manage-store-x9k2';

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <CartProvider>
          <ToastProvider>
            <Routes>
              {/* ── Admin routes (obscured path) ── */}
              <Route path={`${ADMIN_BASE}/login`} element={<AdminLoginPage />} />
              <Route
                path={ADMIN_BASE}
                element={
                  <AdminRoute>
                    <AdminLayout />
                  </AdminRoute>
                }
              >
                <Route index element={<Navigate to={`${ADMIN_BASE}/dashboard`} replace />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="products"  element={<AdminProductsPage />} />
                <Route path="settings"  element={<AdminSettingsPage />} />
              </Route>

              {/* Legacy /admin redirect → new path */}
              <Route path="/admin/login"     element={<Navigate to={`${ADMIN_BASE}/login`}     replace />} />
              <Route path="/admin/dashboard" element={<Navigate to={`${ADMIN_BASE}/dashboard`} replace />} />
              <Route path="/admin/products"  element={<Navigate to={`${ADMIN_BASE}/products`}  replace />} />
              <Route path="/admin/settings"  element={<Navigate to={`${ADMIN_BASE}/settings`}  replace />} />
              <Route path="/admin"           element={<Navigate to={ADMIN_BASE}               replace />} />

              {/* ── Public routes ── */}
              <Route element={<Layout />}>
                <Route path="/"              element={<HomePage />} />
                <Route path="/shop"          element={<ShopPage />} />
                <Route path="/product/:id"   element={<ProductPage />} />
                <Route path="/cart"          element={<CartPage />} />
                <Route path="/contact"       element={<ContactPage />} />
                <Route path="/policy/:type"  element={<PolicyPage />} />
                {/* Legacy policy redirects */}
                <Route path="/privacy"  element={<Navigate to="/policy/privacy"  replace />} />
                <Route path="/return"   element={<Navigate to="/policy/return"   replace />} />
                <Route path="/shipping" element={<Navigate to="/policy/shipping" replace />} />
                <Route path="/brand"    element={<Navigate to="/shop" replace />} />
                <Route path="*"         element={<NotFound />} />
              </Route>
            </Routes>
          </ToastProvider>
        </CartProvider>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <main style={{ padding:'100px 5%', textAlign:'center' }}>
      <div style={{ fontSize:'4rem', marginBottom:16 }}>👟</div>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:'2rem', marginBottom:12 }}>Page Not Found</h1>
      <p style={{ color:'var(--text-muted)', marginBottom:32 }}>The page you're looking for doesn't exist.</p>
      <a href="/" style={{ padding:'12px 32px', background:'var(--primary)', color:'#fff', borderRadius:8, fontWeight:700, textDecoration:'none' }}>Go Home</a>
    </main>
  );
}
