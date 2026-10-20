import { FALLBACK_IMAGE } from '@/utils/images';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Product, SiteSettings } from '@/types';
import { BRANDS, CATEGORIES, formatPrice, getDeal } from '@/utils';
import TiltCascadeCarousel from './ui/tilt-cascade-carousel';
import { ikResize } from '@/api';
import { FocusRail } from './FocusRail';
import type { FocusRailItem } from './FocusRail';
const MotionLink = motion(Link);

/* ── New Arrivals — FocusRail carousel ── */
export function NewArrivals({ products }: { products: Product[] }) {
  const newProducts = products.filter(p => p.tag === 'new');
  if (newProducts.length === 0) return null;

  /* Map Product → FocusRailItem */
  const railItems: FocusRailItem[] = newProducts.map(p => {
    const deal = getDeal(p.price, p.original_price);
    // Guard: sizes/colors might be strings from old cache
    const safeColors = Array.isArray(p.colors) ? p.colors : [];
    const safeSizes  = Array.isArray(p.sizes)  ? p.sizes  : [];
    return {
      id:          p.id,
      title:       p.name,
      description: safeColors.length
        ? `Available in ${safeColors.length} colour${safeColors.length > 1 ? 's' : ''} · Sizes ${safeSizes.slice(0, 3).join(', ')}${safeSizes.length > 3 ? '…' : ''}`
        : safeSizes.length
          ? `Available in sizes ${safeSizes.slice(0, 4).join(', ')}${safeSizes.length > 4 ? '…' : ''}`
          : 'Premium quality sneaker',
      imageSrc:    ikResize(p.image, 600, 80) || FALLBACK_IMAGE,
      href:        `/product/${p.id}`,
      meta:        deal
        ? `${p.brand}  ·  ${deal.pct}% OFF`
        : p.brand,
      price:       deal
        ? `${formatPrice(p.price)}  ·  was ${formatPrice(deal.origPrice)}`
        : formatPrice(p.price),
      badge:       'New',
    };
  });

  return (
    <section style={{ padding: '48px 5% 24px' }}>
      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 24, flexWrap: 'wrap', gap: 6,
      }}>
        <Link to="/shop?tag=new" style={{ textDecoration: 'none' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', color: 'var(--primary)',
            fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', margin: 0,
          }}>
            New Arrivals <span style={{ transition: 'transform 0.2s' }}>→</span>
          </h2>
        </Link>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Drag · Scroll · Click side cards to navigate
        </p>
      </div>

      {/* FocusRail */}
      <FocusRail
        items={railItems}
        loop={true}
        autoPlay={true}
        interval={5000}
        style={{ borderRadius: 20 }}
      />
    </section>
  );
}

/* ── Brand Tiles ── */
export function BrandTiles({ hiddenBrands = '' }: { hiddenBrands?: string }) {
  const hidden = new Set(hiddenBrands.split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
  const visible = BRANDS.filter(b => !hidden.has(b.slug.toLowerCase()));

  return (
    <section id="collections" style={{ padding: '20px 5% 40px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', color: 'var(--primary)', margin: '30px 0 20px', fontSize: '1.8rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>
        Shop by Brand
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: 14, margin: '20px 0' }}>
        {visible.map((brand, i) => {
          const initials = brand.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
          return (
            <MotionLink key={brand.slug} to={`/shop?brand=${encodeURIComponent(brand.slug)}`}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              whileHover={{ y: -6, boxShadow: 'var(--shadow-hover)', borderColor: 'var(--primary)' }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '18px 10px 14px', borderRadius: 16, border: '1px solid var(--border)',
                background: 'var(--surface)', cursor: 'pointer', boxShadow: 'var(--shadow)',
              }}>
              <div style={{ width: 60, height: 60, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${brand.color}44`, background: 'var(--surface)', padding: 8, overflow: 'hidden' }}>
                {brand.logo ? (
                  <img src={brand.logo} alt={brand.name}
                    loading="lazy" decoding="async" width={44} height={44}
                    onError={e => { const el = e.target as HTMLImageElement; el.style.display = 'none'; el.nextElementSibling!.removeAttribute('hidden'); }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : null}
                <span hidden style={{ fontWeight: 900, color: brand.color, fontSize: '1.1rem' }}>{initials}</span>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, textAlign: 'center', color: 'var(--text-muted)', lineHeight: 1.2 }}>{brand.name}</span>
              <span style={{ fontSize: '0.82rem', color: `${brand.color}88` }}>→</span>
            </MotionLink>
          );
        })}
      </div>
    </section>
  );
}

/* ── Collection tilt cascade ── */
export function CategoryScroll({ settings }: { settings: SiteSettings }) {
  if (!settings.show_categories) return null;

  const visible = CATEGORIES.filter(c => (settings as any)[`cat_${c.slug}`] !== false);
  if (visible.length === 0) return null;

  return (
    <section aria-labelledby="collections-title" style={{ padding: '40px 0 8px', overflow: 'hidden', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 5%', marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
        <h2 id="collections-title" style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)', fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Collections</h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Swipe, drag or use the arrows to explore</p>
      </div>
      <TiltCascadeCarousel key={visible.map(category => category.slug).join(',')} loop={visible.length > 3} items={visible.map(category => ({
        id: category.slug, title: category.label, href: category.path, fallback: category.emoji,
        src: `https://ik.imagekit.io/yocxectr4/logos/categories/${category.slug}.png?tr=w-400,h-400,f-webp,q-80`,
      }))} />
    </section>
  );
}
