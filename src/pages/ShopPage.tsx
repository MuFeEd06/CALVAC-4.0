import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchProducts } from '@/api';
import type { Product } from '@/types';
import ProductCard from '@/components/ProductCard';
import { BRANDS } from '@/utils';

function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }

export default function ShopPage() {
  const [params] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  const brand    = params.get('brand') || '';
  const tag      = params.get('tag') || '';
  const q        = params.get('q') || '';
  const sale     = params.get('sale') || '';
  const maxPrice = parseInt(params.get('max_price') || '0');
  const minPrice = parseInt(params.get('min_price') || '0');

  useEffect(() => {
    setLoading(true);
    fetchProducts().then(all => {
      let filtered = [...all];
      if (q) {
        const nq = norm(q);
        filtered = filtered.filter(p => norm(p.name).includes(nq) || norm(p.brand).includes(nq));
      } else if (brand) {
        const nb = norm(brand);
        filtered = filtered.filter(p => norm(p.brand) === nb || norm(p.brand).includes(nb));
      } else if (tag) {
        const CAT = new Set(['boots','crocs','girls']);
        filtered = CAT.has(tag)
          ? filtered.filter(p => p.category === tag)
          : filtered.filter(p => p.tag === tag);
      } else if (sale) {
        filtered = filtered.filter(p => p.original_price && p.original_price > p.price);
      } else if (maxPrice) {
        filtered = filtered.filter(p => p.price <= maxPrice);
      } else if (minPrice) {
        filtered = filtered.filter(p => p.price >= minPrice);
      }
      setProducts(filtered);
      setLoading(false);
    });
  }, [brand, tag, q, sale, maxPrice, minPrice]);

  // Page title derivation
  const brandCfg = brand ? BRANDS.find(b => norm(b.slug) === norm(brand)) : null;
  const tagLabels: Record<string,string> = { boots:'Boots', crocs:'Crocs', girls:'Girls', new:'New Arrivals', sale:'Sale', trending:'Trending', luxury:'Luxury' };
  const tagEmoji: Record<string,string>  = { boots:'👢', crocs:'🥿', girls:'👟', new:'✨', sale:'🏷️', trending:'🔥', luxury:'💎' };

  let pageTitle = 'All Shoes';
  let pageEmoji = '👟';
  if (q)        { pageTitle = `"${q}"`; pageEmoji = '🔍'; }
  else if (brand) { pageTitle = brand; pageEmoji = ''; }
  else if (tag)   { pageTitle = tagLabels[tag] || tag; pageEmoji = tagEmoji[tag] || '🛍️'; }
  else if (sale)  { pageTitle = 'Sale'; pageEmoji = '🏷️'; }
  else if (maxPrice) { pageTitle = `Under ₹${maxPrice.toLocaleString('en-IN')}`; pageEmoji = '💰'; }
  else if (minPrice) { pageTitle = 'Premium'; pageEmoji = '💎'; }

  return (
    <main style={{ padding: '0 5% 80px' }}>
      {/* Hero banner */}
      <div style={{
        padding: '40px 0 24px', display: 'flex', alignItems: 'center', gap: 24,
        borderBottom: '1px solid var(--border)', marginBottom: 32,
      }}>
        {brandCfg?.logo ? (
          <div style={{ width: 80, height: 80, borderRadius: 18, background: `${brandCfg.color}18`, border: `1px solid ${brandCfg.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 12, flexShrink: 0 }}>
            <img src={brandCfg.logo} alt={brand} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        ) : pageEmoji ? (
          <div style={{ width: 80, height: 80, borderRadius: 18, background: 'rgba(43,159,216,0.08)', border: '1px solid rgba(43,159,216,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.2rem', flexShrink: 0 }}>
            {pageEmoji}
          </div>
        ) : null}
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
            {pageTitle}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {loading ? 'Loading…' : `${products.length} style${products.length !== 1 ? 's' : ''} available`}
          </p>
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px,45vw),1fr))', gap: 24 }}>
          {Array(8).fill(0).map((_, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, height: 340, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>🔍</div>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>No products found</h2>
          <p>Try a different filter or search term.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px,45vw),1fr))', gap: 24 }}>
          {products.map(p => <ProductCard key={p.id} product={p} />)}
        </motion.div>
      )}

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </main>
  );
}
