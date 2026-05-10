import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Product, SiteSettings } from '@/types';
import { BRANDS, CATEGORIES, formatPrice, getDeal } from '@/utils';
import HorizontalScroll from './HorizontalScroll';
import { ikResize } from '@/api';
import { FocusRail } from './FocusRail';
import type { FocusRailItem } from './FocusRail';

/* ── New Arrivals — FocusRail carousel ── */
export function NewArrivals({ products }: { products: Product[] }) {
  const newProducts = products.filter(p => p.tag === 'new');
  if (newProducts.length === 0) return null;

  /* Map Product → FocusRailItem */
  const railItems: FocusRailItem[] = newProducts.map(p => {
    const deal = getDeal(p.price, p.original_price);
    return {
      id:          p.id,
      title:       p.name,
      description: p.colors?.length
        ? `Available in ${p.colors.length} colour${p.colors.length > 1 ? 's' : ''} · Sizes ${p.sizes?.slice(0, 3).join(', ')}${p.sizes?.length > 3 ? '…' : ''}`
        : p.sizes?.length
          ? `Available in sizes ${p.sizes.slice(0, 4).join(', ')}${p.sizes.length > 4 ? '…' : ''}`
          : 'Premium quality sneaker',
      imageSrc:    ikResize(p.image, 600, 80) || 'https://placehold.co/300x400/1a1a1a/2B9FD8?text=👟',
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
        <a href="/shop?tag=new" style={{ textDecoration: 'none' }}>
          <h2 style={{
            fontFamily: 'var(--font-display)', color: 'var(--primary)',
            fontSize: '1.6rem', fontWeight: 800, letterSpacing: '-0.5px',
            display: 'inline-flex', alignItems: 'center', gap: 10,
            cursor: 'pointer', margin: 0,
          }}>
            New Arrivals <span style={{ transition: 'transform 0.2s' }}>→</span>
          </h2>
        </a>
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
  const navigate = useNavigate();
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
            <motion.div key={brand.slug}
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              whileHover={{ y: -6, boxShadow: 'var(--shadow-hover)', borderColor: 'var(--primary)' }}
              onClick={() => navigate(`/shop?brand=${encodeURIComponent(brand.slug)}`)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                padding: '18px 10px 14px', borderRadius: 16, border: '1px solid var(--border)',
                background: 'var(--surface)', cursor: 'pointer', boxShadow: 'var(--shadow)',
              }}>
              <div style={{ width: 60, height: 60, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1.5px solid ${brand.color}44`, background: '#fff', padding: 8, overflow: 'hidden' }}>
                {brand.logo ? (
                  <img src={brand.logo} alt={brand.name}
                    onError={e => { const el = e.target as HTMLImageElement; el.style.display = 'none'; el.nextElementSibling!.removeAttribute('hidden'); }}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                ) : null}
                <span hidden style={{ fontWeight: 900, color: brand.color, fontSize: '1.1rem' }}>{initials}</span>
              </div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, textAlign: 'center', color: 'var(--text-muted)', lineHeight: 1.2 }}>{brand.name}</span>
              <span style={{ fontSize: '0.82rem', color: `${brand.color}88` }}>→</span>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}

/* ── Category Scroll ── */
export function CategoryScroll({ settings }: { settings: SiteSettings }) {
  const navigate = useNavigate();
  if (!settings.show_categories) return null;

  const visible = CATEGORIES.filter(c => (settings as any)[`cat_${c.slug}`] !== false);
  if (visible.length === 0) return null;

  return (
    <section style={{ padding: '40px 0 8px', overflow: 'hidden', position: 'relative' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 5%', marginBottom: 16, flexWrap: 'wrap', gap: 6 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)', fontSize: '1.6rem', fontWeight: 800, margin: 0 }}>Collections</h2>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Swipe to explore</p>
      </div>
      <HorizontalScroll>
        {[...visible, ...visible].map((cat, i) => (
          <motion.div key={`${cat.slug}-${i}`}
            whileHover={{ y: -3, borderColor: 'var(--primary)', boxShadow: '0 8px 24px rgba(0,0,0,0.1)' }}
            onClick={() => navigate(cat.path)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              width: 160, flexShrink: 0, background: 'var(--surface)',
              border: '1.5px solid var(--border)', borderRadius: 14, overflow: 'hidden',
              cursor: 'pointer', textDecoration: 'none',
            }}>
            <div style={{ width: '100%', aspectRatio: '1/1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--surface-2)' }}>
              <img src={`https://ik.imagekit.io/yocxectr4/logos/categories/${cat.slug}.png`} alt={cat.label}
                loading="lazy"
                onError={e => { const el = e.target as HTMLImageElement; el.style.display = 'none'; el.nextElementSibling!.removeAttribute('hidden'); }}
                style={{ width: '70%', height: '70%', objectFit: 'contain' }} />
              <span hidden style={{ fontSize: '2.4rem' }}>{cat.emoji}</span>
            </div>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, textAlign: 'center', color: 'var(--text)', letterSpacing: '0.3px', textTransform: 'uppercase', padding: '8px 6px 10px', width: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {cat.label}
            </span>
          </motion.div>
        ))}
      </HorizontalScroll>
    </section>
  );
}
