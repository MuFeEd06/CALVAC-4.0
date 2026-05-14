import { useState, useRef, useEffect, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { searchProducts } from '@/api';
import { formatPrice } from '@/utils';
import type { Product } from '@/types';

const navLinks = [
  { to: '/shop',              label: 'All Shoes' },
  { to: '/shop?tag=new',      label: 'New Arrivals' },
  { to: '/shop?tag=trending', label: 'Trending' },
  { to: '/shop?tag=sale',     label: 'Sale' },
  { to: '/contact',           label: 'Contact' },
];

export default function Header() {
  const { totalItems } = useCart();
  const navigate   = useNavigate();
  const location   = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ,    setSearchQ]    = useState('');
  const [results,    setResults]    = useState<Product[]>([]);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef  = useRef<HTMLInputElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout>>();

  /* Close search when navigating */
  useEffect(() => {
    setMenuOpen(false);
    setSearchOpen(false);
    setSearchQ('');
    setResults([]);
  }, [location.pathname, location.search]);

  /* Click-outside closes search */
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

  const handleSearch = useCallback(async (q: string) => {
    setSearchQ(q);
    clearTimeout(timerRef.current);
    if (!q.trim()) { setResults([]); return; }
    timerRef.current = setTimeout(async () => {
      const res = await searchProducts(q);
      setResults(res.slice(0, 5));
    }, 320);
  }, []);

  const submitSearch = () => {
    if (searchQ.trim()) {
      navigate(`/shop?q=${encodeURIComponent(searchQ.trim())}`);
      setSearchOpen(false);
      setResults([]);
    }
  };

  return (
    <>
      <header style={{
        position: 'sticky', top: 0, zIndex: 1000,
        background: 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border)',
        boxShadow: '0 2px 16px rgba(43,159,216,0.08)',
        height: 'var(--header-h)',
        display: 'flex', alignItems: 'center',
        padding: '0 5%', gap: 12,
      }}>
        {/* ── Hamburger — always visible ── */}
        <button
          type="button"
          onClick={() => setMenuOpen(v => !v)}
          aria-label="Open menu"
          aria-expanded={menuOpen}
          style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 5,
            background: 'none', border: 'none', cursor: 'pointer',
            zIndex: 1001, flexShrink: 0, padding: '4px 2px', height: 40, width: 32,
          }}
        >
          {[0, 1, 2].map(i => (
            <motion.span key={i} style={{
              display: 'block', width: 24, height: 2.5,
              background: 'var(--primary)', borderRadius: 2, originX: 0.5,
            }}
            animate={menuOpen
              ? (i===0 ? {rotate:45,y:7.5} : i===1 ? {opacity:0,scaleX:0} : {rotate:-45,y:-7.5})
              : {rotate:0, y:0, opacity:1, scaleX:1}}
            transition={{ duration: 0.22 }}
            />
          ))}
        </button>

        {/* ── Logo ── */}
        <Link to="/" style={{ display:'flex', alignItems:'center', gap:8, flex:1, minWidth:0, textDecoration:'none' }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 'clamp(1rem, 2.5vw, 1.5rem)',
            color: 'var(--primary)', letterSpacing: '-0.5px', whiteSpace: 'nowrap',
          }}>CALVAC</span>
          <img
            src="https://ik.imagekit.io/yocxectr4/logos/logo.png?tr=w-50,h-50,f-webp"
            alt="" loading="lazy"
            style={{ height: 'clamp(28px,4vw,44px)', width: 'auto', flexShrink: 0 }}
          />
        </Link>

        {/* ── Search ── */}
        <div ref={searchRef} style={{ position: 'relative', flexShrink: 0 }}>
          <motion.div
            animate={{ width: searchOpen ? 'clamp(140px, 30vw, 240px)' : 36 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            style={{
              display: 'flex', alignItems: 'center',
              border: `1.5px solid ${searchOpen ? 'var(--primary)' : 'var(--border)'}`,
              borderRadius: 20, overflow: 'hidden', height: 36,
              background: 'var(--bg)',
            }}
          >
            <button
              type="button"
              onClick={() => {
                setSearchOpen(v => !v);
                if (!searchOpen) setTimeout(() => inputRef.current?.focus(), 50);
              }}
              style={{ background:'none', border:'none', cursor:'pointer',
                padding:'0 8px', flexShrink:0, display:'flex', alignItems:'center', color:'var(--primary)' }}
              aria-label="Search"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
            </button>
            {searchOpen && (
              <input
                ref={inputRef}
                type="text"
                placeholder="Search…"
                value={searchQ}
                onChange={e => handleSearch(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submitSearch()}
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: '0.85rem', color: 'var(--text)', fontFamily: 'var(--font-body)',
                  paddingRight: 8, minWidth: 0,
                }}
              />
            )}
          </motion.div>

          {/* Search results dropdown */}
          <AnimatePresence>
            {searchOpen && results.length > 0 && (
              <motion.div
                initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }} exit={{ opacity:0, y:6 }}
                style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0,
                  background: 'var(--surface)', border: '1px solid var(--border)',
                  borderRadius: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.12)',
                  zIndex: 2000, overflow: 'hidden', width: 'clamp(240px, 40vw, 320px)',
                }}
              >
                {results.map(p => (
                  <Link key={p.id} to={`/product/${p.id}`}
                    onClick={() => { setSearchOpen(false); setResults([]); }}
                    style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px',
                      textDecoration:'none', color:'var(--text)',
                      borderBottom:'1px solid var(--border)', transition:'background 0.15s' }}
                    onMouseEnter={e=>(e.currentTarget.style.background='var(--surface-2)')}
                    onMouseLeave={e=>(e.currentTarget.style.background='transparent')}
                  >
                    <img src={p.image||'https://placehold.co/40x40/eaf3fa/2B9FD8?text=👟'}
                      alt="" style={{ width:40, height:40, borderRadius:8, objectFit:'contain',
                        background:'var(--surface-2)', flexShrink:0 }} />
                    <div style={{ minWidth:0 }}>
                      <div style={{ fontSize:'0.82rem', fontWeight:600, overflow:'hidden',
                        textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                      <div style={{ fontSize:'0.74rem', color:'var(--text-muted)' }}>
                        {p.brand} · {formatPrice(p.price)}
                      </div>
                    </div>
                  </Link>
                ))}
                <button type="button" onClick={submitSearch}
                  style={{ width:'100%', padding:'10px 14px', background:'none', border:'none',
                    cursor:'pointer', color:'var(--primary)', fontSize:'0.8rem', fontWeight:700,
                    textAlign:'center', fontFamily:'var(--font-body)' }}>
                  See all results →
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Cart ── */}
        <Link to="/cart" aria-label={`Cart, ${totalItems} items`}
          style={{ position:'relative', display:'flex', alignItems:'center',
            color:'var(--primary)', fontWeight:700, fontSize:'1.15rem', flexShrink:0 }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
            <line x1="3" y1="6" x2="21" y2="6"/>
            <path d="M16 10a4 4 0 01-8 0"/>
          </svg>
          {totalItems > 0 && (
            <span style={{
              position:'absolute', top:-6, right:-8,
              background:'var(--primary)', color:'#fff',
              borderRadius:'50%', width:18, height:18,
              fontSize:'0.65rem', fontWeight:800,
              display:'flex', alignItems:'center', justifyContent:'center',
            }}>{totalItems}</span>
          )}
        </Link>
      </header>

      {/* ── Slide-down menu ── */}
      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.div
              initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}}
              onClick={() => setMenuOpen(false)}
              style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.18)',
                zIndex:998, top:'var(--header-h)' }}
            />
            <motion.nav
              initial={{opacity:0, y:-12}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-12}}
              transition={{ duration:0.22 }}
              style={{
                position:'fixed', top:'var(--header-h)', left:0, right:0,
                background:'var(--surface)', borderBottom:'1px solid var(--border)',
                padding:'8px 0 16px', zIndex:999,
                boxShadow:'0 8px 24px rgba(43,159,216,0.10)',
              }}
            >
              {navLinks.map(({ to, label }) => (
                <Link key={to} to={to} onClick={() => setMenuOpen(false)}
                  style={{ display:'block', padding:'14px 5%', fontSize:'1.05rem',
                    fontWeight:600, color:'var(--text)', textDecoration:'none',
                    fontFamily:'var(--font-display)', transition:'color 0.15s',
                    borderBottom:'1px solid var(--border)' }}
                  onMouseEnter={e=>(e.currentTarget.style.color='var(--primary)')}
                  onMouseLeave={e=>(e.currentTarget.style.color='var(--text)')}
                >{label}</Link>
              ))}
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
