import { FormEvent, useState, useRef, useCallback } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '@/context/AdminAuthContext';
import { supabase } from '@/lib/supabase';

/* ── Rate-limit: max 5 attempts per 15 minutes ── */
const MAX_ATTEMPTS = 5;
const WINDOW_MS    = 15 * 60 * 1000;

function useRateLimit() {
  const attempts = useRef<number[]>([]);

  const check = useCallback((): { allowed: boolean; waitSec: number } => {
    const now = Date.now();
    attempts.current = attempts.current.filter(t => now - t < WINDOW_MS);
    if (attempts.current.length >= MAX_ATTEMPTS) {
      const oldest  = attempts.current[0];
      const waitSec = Math.ceil((WINDOW_MS - (now - oldest)) / 1000);
      return { allowed: false, waitSec };
    }
    return { allowed: true, waitSec: 0 };
  }, []);

  const record = useCallback(() => {
    attempts.current.push(Date.now());
  }, []);

  return { check, record };
}

/** Validate the redirect `from` param — only allow same-origin paths */
function safePath(raw: string | undefined): string {
  if (!raw) return '/manage-store-x9k2/dashboard';
  try {
    // Reject anything that looks like a full URL (has a scheme or //)
    if (/^https?:|^\/\//i.test(raw)) return '/manage-store-x9k2/dashboard';
    // Must start with /admin
    if (!raw.startsWith('/manage-store-x9k2')) return '/manage-store-x9k2/dashboard';
    return raw;
  } catch {
    return '/manage-store-x9k2/dashboard';
  }
}

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, hasEnv } = useAdminAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [locked,   setLocked]   = useState(false);
  const [lockSec,  setLockSec]  = useState(0);
  const { check, record } = useRateLimit();

  const from = safePath((location.state as { from?: string } | undefined)?.from);

  if (session) return <Navigate to={from} replace />;

  const submit = async (e: FormEvent) => {
    e.preventDefault();

    // Rate-limit check
    const { allowed, waitSec } = check();
    if (!allowed) {
      setLocked(true);
      setLockSec(waitSec);
      setError(`Too many attempts. Try again in ${Math.ceil(waitSec / 60)} min.`);
      // Countdown
      const iv = setInterval(() => {
        setLockSec(s => {
          if (s <= 1) { clearInterval(iv); setLocked(false); setError(''); return 0; }
          return s - 1;
        });
      }, 1000);
      return;
    }

    if (!supabase) return;

    // Basic input sanity (Supabase validates properly server-side)
    if (!email.trim() || !password) { setError('Enter your email and password.'); return; }
    if (email.length > 254)         { setError('Email is too long.');              return; }

    setLoading(true);
    setError('');
    record();

    const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);

    if (signInError) {
      // Don't reveal whether it's the email or password that's wrong
      setError('Invalid credentials. Please try again.');
      setPassword(''); // clear password field on failure
      return;
    }

    navigate(from.startsWith('/manage-store-x9k2') ? from : '/manage-store-x9k2/dashboard', { replace: true });
  };

  return (
    <main className="admin-login-page">
      <form className="admin-login-card" onSubmit={submit} autoComplete="on">
        <div className="admin-lock">🔐</div>
        <h1>CALVAC Admin</h1>
        <p>Secure admin login</p>

        {!hasEnv && (
          <div className="admin-error">
            Missing env vars: <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code>
          </div>
        )}
        {error && <div className="admin-error" role="alert">{error}</div>}

        {locked && (
          <div style={{ background:'#fff0f0', border:'1px solid #fca5a5', borderRadius:8,
            padding:'8px 12px', fontSize:'0.82rem', color:'#b91c1c', textAlign:'center' }}>
            🔒 Locked — {lockSec}s remaining
          </div>
        )}

        <label htmlFor="admin-email">Email</label>
        <input
          id="admin-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          maxLength={254}
          disabled={locked}
          onChange={e => setEmail(e.target.value)}
          placeholder="admin@calvac.com"
        />
        <label htmlFor="admin-password">Password</label>
        <input
          id="admin-password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          maxLength={128}
          disabled={locked}
          onChange={e => setPassword(e.target.value)}
          placeholder="Enter password"
        />
        <button type="submit" disabled={loading || !hasEnv || locked}>
          {loading ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </main>
  );
}
