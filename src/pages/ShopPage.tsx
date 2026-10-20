import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { fetchProductsPage, type ProductFilters } from '@/api';
import type { Product } from '@/types';
import ProductCard from '@/components/ProductCard';
import { BRANDS } from '@/utils';
import CollectionIcon from '@/components/CollectionIcon';
import '@/components/brand-tiles.css';
import { priceBound, priceFilterError } from '@/utils/priceFilters';

function norm(s: string) { return s.toLowerCase().replace(/[^a-z0-9]/g, ''); }

export default function ShopPage() {
  const [params] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const loadingMore = useRef(false);

  const brand    = params.get('brand') || '';
  const tag      = params.get('tag') || '';
  const category = params.get('category') || (['boots','crocs','girls'].includes(tag) ? tag : '');
  const q        = params.get('q') || '';
  const sale     = params.get('sale') || '';
  const maxPrice = priceBound(params.get('max_price'));
  const minPrice = priceBound(params.get('min_price'));
  const invalidPrice = priceFilterError(minPrice, maxPrice);

  const filters: ProductFilters = { brand, q, sale, max_price: maxPrice, min_price: minPrice,
    category, tag: ['boots','crocs','girls'].includes(tag) ? undefined : tag };
  useEffect(() => {
    const request = ++generation.current;
    loadingMore.current = false;
    setLoading(true); setError(''); setProducts([]); setNextCursor(null);
    if (invalidPrice) { setError(invalidPrice); setLoading(false); return; }
    fetchProductsPage(filters).then(page => {
      if (request === generation.current) { setProducts(page.items); setNextCursor(page.nextCursor); }
    }).catch(() => { if (request === generation.current) setError('Could not load shoes. Please try again.'); })
      .finally(() => { if (request === generation.current) setLoading(false); });
    return () => { generation.current++; };
  }, [brand, tag, category, q, sale, maxPrice, minPrice, invalidPrice, retry]);
  const loadMore = async () => {
    if (!nextCursor || loading || loadingMore.current) return;
    loadingMore.current = true;
    const request = generation.current;
    setLoading(true); setError('');
    try {
      const page = await fetchProductsPage({ ...filters, after: nextCursor });
      if (request === generation.current) { setProducts(prev => [...new Map([...prev, ...page.items].map(p => [p.id, p])).values()]); setNextCursor(page.nextCursor); }
    } catch { if (request === generation.current) setError('Could not load more shoes. Please try again.'); }
    finally { if (request === generation.current) { loadingMore.current = false; setLoading(false); } }
  };

  // Page title derivation
  const brandCfg = brand ? BRANDS.find(b => norm(b.slug) === norm(brand)) : null;
  const tagLabels: Record<string,string> = { boots:'Boots', crocs:'Crocs', girls:'Girls', new:'New Arrivals', sale:'Sale', trending:'Trending', luxury:'Luxury' };

  let pageTitle = 'All Shoes';
  let icon = 'all';
  if (q)        { pageTitle = `"${q}"`; icon = 'search'; }
  else if (brand) { pageTitle = brand; }
  else if (category) { pageTitle = tagLabels[category] || category; icon = category; }
  else if (tag)   { pageTitle = tagLabels[tag] || tag; icon = tag; }
  else if (sale)  { pageTitle = 'Sale'; icon = 'sale'; }
  else if (!invalidPrice && maxPrice !== undefined) {
    pageTitle = minPrice !== undefined ? `₹${minPrice.toLocaleString('en-IN')} – ₹${maxPrice.toLocaleString('en-IN')}` : `Under ₹${maxPrice.toLocaleString('en-IN')}`; icon = 'price';
  }
  else if (!invalidPrice && minPrice !== undefined) { pageTitle = minPrice === 2500 ? 'Premium' : `From ₹${minPrice.toLocaleString('en-IN')}`; icon = 'premium'; }

  return (
    <main style={{ padding: '0 5% 80px' }}>
      {/* Hero banner */}
      <div style={{
        padding: '40px 0 24px', display: 'flex', alignItems: 'center', gap: 24,
        borderBottom: '1px solid var(--border)', marginBottom: 32,
      }}>
        {brandCfg?.logo ? (
          <div className="brand-logo-square" style={{ width: 80, height: 80, borderRadius: 18, borderColor: `${brandCfg.color}44`, padding: 12, flexShrink: 0 }}>
            <img src={brandCfg.logo} alt={brand} data-light-art={['On','Brik'].includes(brandCfg.slug) ? '' : undefined} decoding="async" width={56} height={56} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          </div>
        ) : (
          <div className="collection-heading-icon" style={{ width: 80, height: 80, borderRadius: 18, background: 'var(--primary-light)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', flexShrink: 0 }}>
            <CollectionIcon kind={icon} />
          </div>
        )}
        <div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 4vw, 2.4rem)', fontWeight: 800, color: 'var(--text)', marginBottom: 6 }}>
            {pageTitle}
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {loading && !products.length ? 'Loading…' : `${products.length} style${products.length !== 1 ? 's' : ''} loaded`}
          </p>
        </div>
      </div>

      {/* Grid */}
      {error && <div role="alert"><p>{error}</p>{!invalidPrice && <button onClick={() => nextCursor ? loadMore() : setRetry(n => n + 1)}>Try again</button>}</div>}
      {loading && !products.length ? (
        <div className="product-grid">
          {Array(8).fill(0).map((_, i) => (
            <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, height: 340, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : products.length === 0 && !error ? (
        <div style={{ textAlign: 'center', padding: '80px 20px', color: 'var(--text-muted)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}><CollectionIcon kind="search" size={48} /></div>
          <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 8 }}>No products found</h2>
          <p>Try a different filter or search term.</p>
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}
          className="product-grid">
          {products.map(p => <ProductCard key={p.id} product={p} />)}
        </motion.div>
      )}

      {nextCursor && <button className="primary-link" disabled={loading} onClick={loadMore}>{loading ? 'Loading…' : 'Load more shoes'}</button>}
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </main>
  );
}
