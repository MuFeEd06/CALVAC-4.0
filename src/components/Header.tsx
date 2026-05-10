import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { searchProducts } from '@/api';
import { formatPrice } from '@/utils';
import type { Product } from '@/types';

export default function Header() {
  const { totalItems } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const handleSearch = useCallback(async (q: string) => {
    setSearchQ(q);
    clearTimeout(timerRef.current);
    if (q.trim().length < 2) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      const data = await searchProducts(q.trim());
      setResults(data.slice(0, 6));
    }, 220);
  }, []);

  const submitSearch = () => {
    const q = searchQ.trim();
    if (!q) return;
    setSearchOpen(false);
    setSearchQ('');
    setResults([]);
    navigate(`/shop?q=${encodeURIComponent(q)}`);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
        setResults([]);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setMenuOpen(false); }, [location]);

  const navLinks = [
    { to: '/',           label: 'Home' },
    { to: '/#collections', label: 'Collections' },
    { to: '/shop',       label: 'Shop' },
    { to: '/contact',    label: 'Contact' },
  ];

  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 1000,
      background: 'rgba(255,255,255,0.88)',
      backdropFilter: 'blur(20px)',
      borderBottom: '1px solid var(--border)',
      boxShadow: '0 2px 16px rgba(43,159,216,0.08)',
      height: 'var(--header-h)',
      display: 'flex', alignItems: 'center',
      padding: '0 5%', gap: 20,
    }}>
      {/* Hamburger */}
      <button onClick={() => setMenuOpen(v => !v)} style={{
        display: 'flex', flexDirection: 'column', gap: 5,
        background: 'none', border: 'none', cursor: 'pointer', zIndex: 1001,
      }}>
        {[0,1,2].map(i => (
          <motion.span key={i} style={{
            display: 'block', width: 25, height: 3,
            background: 'var(--primary)', borderRadius: 2,
          }}
          animate={menuOpen ? (i === 0 ? { rotate: 45, y: 8 } : i === 1 ? { opacity: 0 } : { rotate: -45, y: -8 }) : { rotate: 0, y: 0, opacity: 1 }}
          transition={{ duration: 0.25 }}
          />
        ))}
      </button>

      {/* Logo */}
      <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
        <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.5rem', color: 'var(--primary)', letterSpacing: '-0.5px' }}>
          CALVAC
        </span>
        <img src="https://ik.imagekit.io/yocxectr4/logos/logo.png?tr=w-50,h-50,f-webp" alt="" style={{ height: 44, width: 'auto' }} />
      </Link>

      {/* Search */}
      <div ref={searchRef} style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.input
            type="text"
            placeholder="Search sneakers…"
            value={searchQ}
            onFocus={() => setSearchOpen(true)}
            onChange={e => handleSearch(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && submitSearch()}
            animate={{ width: searchOpen ? 220 : 36 }}
            transition={{ duration: 0.35 }}
            style={{
              padding: '8px 34px 8px 12px',
              border: '1.5px solid var(--border)',
              borderRadius: 20,
              fontSize: '0.85rem',
              outline: 'none',
              background: 'var(--bg)',
              color: 'var(--text)',
              fontFamily: 'var(--font-body)',
              overflow: 'hidden',
              borderColor: searchOpen ? 'var(--primary)' : 'var(--border)',
            }}
          />
          <button onClick={submitSearch} style={{
            position: 'absolute', right: 10,
            background: 'none', border: 'none', fontSize: '0.9rem',
            color: 'var(--text-muted)', lineHeight: 1,
          }}>🔍</button>
        </div>

        <AnimatePresence>
          {searchOpen && results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              style={{
                position: 'absolute', top: 'calc(100% + 8px)', left: 0,
                width: 320, background: 'var(--surface)',
                border: '1px solid var(--border)', borderRadius: 12,
                boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                zIndex: 2000, overflow: 'hidden',
              }}
            >
              {results.map(p => (
                <button key={p.id} onClick={() => { navigate(`/product/${p.id}`); setSearchOpen(false); setSearchQ(''); setResults([]); }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 14px', width: '100%', background: 'none',
                    border: 'none', borderBottom: '1px solid var(--border)',
                    cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--surface-2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'none')}
                >
                  <img src={p.image || 'https://placehold.co/40x40'} alt={p.name}
                    style={{ width: 40, height: 40, objectFit: 'contain', borderRadius: 6, background: 'var(--surface-2)' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-light)' }}>{p.brand}</div>
                  </div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--primary)' }}>{formatPrice(p.price)}</span>
                </button>
              ))}
              <button onClick={submitSearch} style={{
                width: '100%', padding: '10px 14px', background: 'var(--surface-2)',
                border: 'none', color: 'var(--primary)', fontWeight: 700,
                fontSize: '0.82rem', cursor: 'pointer', fontFamily: 'var(--font-body)',
              }}>
                See all results →
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Cart */}
      <Link to="/cart" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 4, color: 'var(--primary)', fontWeight: 700, fontSize: '1.15rem', flexShrink: 0 }}>
        🛒
        <AnimatePresence>
          {totalItems > 0 && (
            <motion.span
              key={totalItems}
              initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
              style={{
                position: 'absolute', top: -6, right: -8,
                background: 'var(--primary)', color: '#fff',
                borderRadius: '50%', width: 18, height: 18,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.65rem', fontWeight: 800,
              }}
            >
              {totalItems}
            </motion.span>
          )}
        </AnimatePresence>
      </Link>

      {/* Mobile Nav Overlay */}
      <AnimatePresence>
        {menuOpen && (
          <motion.nav
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed', top: 'var(--header-h)', left: 0, right: 0,
              background: 'var(--surface)', borderBottom: '1px solid var(--border)',
              padding: '12px 0', zIndex: 999,
              boxShadow: '0 8px 24px rgba(43,159,216,0.10)',
            }}
          >
            {navLinks.map(({ to, label }) => (
              <Link key={to} to={to} style={{
                display: 'block', padding: '14px 5%', fontSize: '1.05rem',
                fontWeight: 600, color: 'var(--text)', transition: 'color 0.2s',
                fontFamily: 'var(--font-display)',
              }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text)')}
              >
                {label}
              </Link>
            ))}
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}
