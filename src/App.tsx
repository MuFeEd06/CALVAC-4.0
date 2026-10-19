import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { CartProvider } from '@/context/CartContext';
import { ToastProvider } from '@/context/ToastContext';
import Layout from '@/components/Layout';
import ErrorBoundary from '@/components/ErrorBoundary';
import ScrollToTop from '@/components/ScrollToTop';
const HomePage = lazy(() => import('@/pages/HomePage'));
const ShopPage = lazy(() => import('@/pages/ShopPage'));
const ProductPage = lazy(() => import('@/pages/ProductPage'));
const CartPage = lazy(() => import('@/pages/CartPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const PolicyPage = lazy(() => import('@/pages/PolicyPage'));
const CustomerAuthPage = lazy(() => import('@/pages/CustomerAuthPage'));
const AuthCallback = lazy(() => import('@/pages/CustomerAuthPage').then(module=>({default:module.AuthCallback})));
const AccountPage = lazy(() => import('@/pages/AccountPage'));
const AdminShell = lazy(() => import('@/components/admin/AdminShell'));
const AdminLayout = lazy(() => import('@/components/admin/AdminLayout'));
const AdminRoute = lazy(() => import('@/components/admin/AdminRoute'));
const AdminLoginPage = lazy(() => import('@/pages/admin/AdminLoginPage'));
const AdminDashboardPage = lazy(() => import('@/pages/admin/AdminDashboardPage'));
const AdminProductsPage = lazy(() => import('@/pages/admin/AdminProductsPage'));
const AdminSettingsPage = lazy(() => import('@/pages/admin/AdminSettingsPage'));

// Authorization is enforced by the API; this path is only a routing convention.
const ADMIN_BASE = '/manage-store-x9k2';

export default function App() {
  return (
    <BrowserRouter>
        <CartProvider>
          <ToastProvider>
            <ScrollToTop />
            <ErrorBoundary>
            <Suspense fallback={<main role="status" className="page-loading">Loading…</main>}>
            <Routes>
              {/* ── Admin routes (obscured path) ── */}
              <Route element={<AdminShell />}>
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

              </Route>
              {/* ── Public routes ── */}
              <Route element={<Layout />}>
                <Route path="/"              element={<HomePage />} />
                <Route path="/shop"          element={<ShopPage />} />
                <Route path="/product/:id"   element={<ProductPage />} />
                <Route path="/cart"          element={<CartPage />} />
                <Route path="/checkout" element={<Navigate to="/cart" replace/>}/>
                {['login','signup','verify-email','forgot-password','reset-password'].map(path=><Route key={path} path={'/'+path} element={<CustomerAuthPage/>}/>)}
                <Route path="/auth/callback" element={<AuthCallback/>}/>
                <Route path="/account" element={<AccountPage/>}/>
                <Route path="/account/orders" element={<AccountPage/>}/>
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
            </Suspense>
            </ErrorBoundary>
          </ToastProvider>
        </CartProvider>
    </BrowserRouter>
  );
}

function NotFound() {
  return (
    <main style={{ padding:'100px 5%', textAlign:'center' }}>
      <div style={{ fontSize:'4rem', marginBottom:16 }}>👟</div>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:'2rem', marginBottom:12 }}>Page Not Found</h1>
      <p style={{ color:'var(--text-muted)', marginBottom:32 }}>The page you're looking for doesn't exist.</p>
      <Link to="/" style={{ padding:'12px 32px', background:'var(--primary)', color:'var(--on-primary)', borderRadius:8, fontWeight:700, textDecoration:'none' }}>Go Home</Link>
    </main>
  );
}
