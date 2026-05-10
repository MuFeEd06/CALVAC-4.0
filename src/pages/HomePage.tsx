import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchProducts, fetchSiteSettings, fetchOffer } from '@/api';
import type { Product, SiteSettings, Offer } from '@/types';
import ScrollyShoeExperience from '@/components/ScrollyShoeExperience';
import OfferRibbon from '@/components/OfferRibbon';
import { NewArrivals, BrandTiles, CategoryScroll } from '@/components/HomeSections';
import ProductCard from '@/components/ProductCard';

const DEFAULT_SETTINGS: SiteSettings = {
  primary_color: '#2B9FD8', hero_font: 'default', model_path: '/static/sneaker.glb',
  model_scale: 3, model_y: 0.8, model_speed: 0.006, size_unit: 'uk',
  show_new_arrivals: true, show_categories: true,
  cat_boots: true, cat_crocs: true, cat_girls: true, cat_sale: true,
  cat_under1000: true, cat_under1500: true, cat_under2500: true,
  cat_new: true, cat_premium: true, cat_all: true,
};

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [offer, setOffer] = useState<Offer>({ active: false, text: '', bg_color: '#FF6B35', text_color: '#fff' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchProducts(), fetchSiteSettings(), fetchOffer()])
      .then(([prods, s, o]) => { setProducts(prods); setSettings(s); setOffer(o); })
      .finally(() => setLoading(false));
  }, []);

  const trending = products.filter(p => p.tag === 'trending');

  return (
    <main>
      <OfferRibbon offer={offer} />
      <ScrollyShoeExperience settings={settings as SiteSettings & Record<string, unknown>} />

      {settings.show_new_arrivals && <NewArrivals products={products} />}
      {(settings as any).show_brands_section !== false && (
        <BrandTiles hiddenBrands={(settings as any).hidden_brands || ''} />
      )}
      <CategoryScroll settings={settings} />

      <section style={{ padding: '0 5% 60px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', color: 'var(--primary)', margin: '30px 0 10px', fontSize: '1.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>
          Trending Shoes
        </h2>

        {loading ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px,1fr))', gap: 24, padding: '20px 0' }}>
            {Array(8).fill(0).map((_, i) => (
              <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, height: 320 }}>
                <div style={{ background: 'var(--surface-2)', borderRadius: 8, height: 160, marginBottom: 12, animation: 'pulse 1.5s ease-in-out infinite' }} />
                <div style={{ background: 'var(--surface-2)', borderRadius: 6, height: 14, marginBottom: 8, width: '60%' }} />
                <div style={{ background: 'var(--surface-2)', borderRadius: 6, height: 18, marginBottom: 8 }} />
                <div style={{ background: 'var(--surface-2)', borderRadius: 6, height: 14, width: '40%' }} />
              </div>
            ))}
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px,45vw),1fr))', gap: 24, padding: '20px 0' }}>
            {trending.length > 0
              ? trending.map(p => <ProductCard key={p.id} product={p} />)
              : products.slice(0, 12).map(p => <ProductCard key={p.id} product={p} />)
            }
          </motion.div>
        )}
      </section>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
      `}</style>
    </main>
  );
}
