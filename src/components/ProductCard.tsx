import { imageFallback, FALLBACK_IMAGE, ikResize, ikSrcSet } from '@/utils/images';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Product } from '@/types';
import { formatPrice, getDeal } from '@/utils';

const MotionLink = motion(Link);

export default function ProductCard({ product }: { product: Product }) {
  const deal = getDeal(product.price, product.original_price);
  const oos = product.out_of_stock === true;

  return (
    <MotionLink to={`/product/${product.id}`}
      whileHover={{ y: -6, boxShadow: '0 12px 36px rgba(43,159,216,0.18)' }}
      transition={{ duration: 0.25 }}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        cursor: oos ? 'default' : 'pointer',
        opacity: oos ? 0.75 : 1,
        boxShadow: 'var(--shadow)',
      }}
    >
      {/* Image — lazy load + srcset for responsive delivery */}
      <div style={{ position: 'relative', background: 'var(--surface-2)', aspectRatio: '4/3', overflow: 'hidden' }}>
        <img
          src={ikResize(product.image, 400, 75) || FALLBACK_IMAGE}
          srcSet={ikSrcSet(product.image, 75, [220, 320, 480])}
          sizes="(max-width:767px) 44vw, (max-width:1100px) 28vw, 240px"
          alt={product.name}
          loading="lazy"
          decoding="async"
          onError={imageFallback}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12, transition: 'transform 0.4s' }}
        />
        {oos && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'var(--danger-bg)', color: 'var(--danger)', fontSize: '0.62rem', fontWeight: 800, padding: '3px 8px', borderRadius: 'var(--button-radius)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Out of Stock
          </div>
        )}
        {product.tag && !oos && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'var(--primary)', color: 'var(--on-primary)', fontSize: '0.62rem', fontWeight: 800, padding: '3px 8px', borderRadius: 'var(--button-radius)', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {product.tag}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>{product.brand}</span>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, flex: 1, fontFamily: 'var(--font-display)' }}>{product.name}</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
          <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.05rem' }}>{formatPrice(product.price)}</span>
          {deal && (
            <>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', textDecoration: 'line-through' }}>{formatPrice(deal.origPrice)}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: 'var(--button-radius)', background: 'var(--danger-bg)', color: 'var(--danger)' }}>{deal.pct}% OFF</span>
            </>
          )}
        </div>
        <span
          style={{
            marginTop: 8, padding: '10px', width: '100%',
            background: oos ? '#aaa' : 'var(--primary)',
            color: 'var(--on-primary)', border: 'none', borderRadius: 'var(--button-radius)',
            fontWeight: 700, fontSize: '0.88rem',
            cursor: oos ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => !oos && (e.currentTarget.style.background = 'var(--primary-dark)')}
          onMouseLeave={e => !oos && (e.currentTarget.style.background = 'var(--primary)')}
        >
          {oos ? 'Out of Stock' : 'View Product'}
        </span>
      </div>
    </MotionLink>
  );
}
