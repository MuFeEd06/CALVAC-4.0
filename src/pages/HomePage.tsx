import { lazy, Suspense, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { fetchProducts, fetchSiteSettings, fetchOffer } from '@/api';
import type { Product, SiteSettings, Offer } from '@/types';
const ScrollyShoeExperience = lazy(()=>import('@/components/ScrollyShoeExperience'));
const ParticleHero = lazy(()=>import('@/components/ParticleHero'));
import OfferRibbon from '@/components/OfferRibbon';
import { NewArrivals, BrandTiles, CategoryScroll } from '@/components/HomeSections';
import ProductCard from '@/components/ProductCard';
import { DEFAULT_THEME_SETTINGS } from '@/theme';

const DEFAULT_SETTINGS: SiteSettings = {
  theme_settings: DEFAULT_THEME_SETTINGS,
  primary_color: DEFAULT_THEME_SETTINGS.primaryColor,
  hero_font: 'default', model_path: '/static/sneaker.glb',
  model_scale: 3, model_y: 0.8, model_speed: 0.006,
  show_new_arrivals: true, show_categories: true,
  cat_boots: true, cat_crocs: true, cat_girls: true, cat_sale: true,
  cat_under1000: true, cat_under1500: true, cat_under2500: true,
  cat_new: true, cat_premium: true, cat_all: true,
};

export default function HomePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState<SiteSettings>(DEFAULT_SETTINGS);
  const [offer, setOffer] = useState<Offer>({ active: false, text: '', bg_color: '#FF6B35', text_color: 'var(--on-primary)' });
  const [loading, setLoading] = useState(true);
  const [heroReady,setHeroReady]=useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true); setError('');
    const catalog = Promise.all([fetchProducts({ tag: 'new', limit: 12 }), fetchProducts({ tag: 'trending', limit: 12 })])
      .then(async ([fresh, trending]) => {
        const items = [...new Map([...fresh, ...trending].map(p => [p.id, p])).values()];
        return items.length ? items : fetchProducts({ limit: 12 });
      });
    Promise.allSettled([catalog, fetchSiteSettings().then(value=>{if(active){setSettings(value);setHeroReady(true);}return value;}).catch(error=>{if(active)setHeroReady(true);throw error;}), fetchOffer()]).then(([products, settings, offer]) => {
      if (!active) return;
      if (products.status === 'fulfilled') setProducts(products.value);
      else setError('Could not load the catalog. Please try again.');
      if (settings.status === 'fulfilled') setSettings(settings.value);
      if (offer.status === 'fulfilled') setOffer(offer.value);
      setLoading(false);setHeroReady(true);
    });
    return () => { active = false; };
  }, [retry]);

  const trending = products.filter(p => p.tag === 'trending');

  return (
    <main>
      <OfferRibbon offer={offer} />
      <Suspense fallback={<div className="hero-loading" aria-label="Loading hero"/>}>
      {!heroReady?<div className="hero-loading"/>:settings.hero_type!=='hidden' && (settings.hero_type==='scroll'?<ScrollyShoeExperience settings={settings as SiteSettings & Record<string, unknown>}/>:<ParticleHero settings={settings as unknown as Record<string,unknown>}/>)}
      </Suspense>

      {error && <div role="alert" className="load-error"><p>{error}</p><button onClick={() => setRetry(n => n + 1)}>Try again</button></div>}
      {settings.show_new_arrivals && <NewArrivals products={products} />}
      {(settings as any).show_brands_section !== false && (
        <BrandTiles hiddenBrands={(settings as any).hidden_brands || ''} />
      )}
      {heroReady && <CategoryScroll settings={settings} />}

      <section style={{ padding: '0 5% 60px' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', color: 'var(--primary)', margin: '30px 0 10px', fontSize: '1.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>
          Trending Shoes
        </h2>

        {loading ? (
          <div className="product-grid">
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
            className="product-grid">
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
