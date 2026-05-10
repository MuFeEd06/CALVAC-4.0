import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { Product } from '@/types';
import { getRating, formatPrice, getDeal } from '@/utils';

function Stars({ score, size = 'sm' }: { score: number; size?: 'sm' | 'lg' }) {
  const full = Math.floor(score);
  const half = score % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  const s = size === 'lg' ? '1.2rem' : '0.8rem';
  return (
    <span className="stars" style={{ fontSize: s }}>
      {Array(full).fill('★').map((c, i) => <span key={i} className="star-full">{c}</span>)}
      {half ? <span className="star-half">★</span> : null}
      {Array(empty).fill('★').map((c, i) => <span key={i} className="star-empty">{c}</span>)}
    </span>
  );
}

export function StarDisplay({ score, count }: { score: number; count: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Stars score={score} />
      <span style={{ fontSize: '0.75rem', color: '#f5a623', fontWeight: 700 }}>{score.toFixed(1)}</span>
      <span style={{ fontSize: '0.72rem', color: 'var(--text-light)' }}>({count.toLocaleString()})</span>
    </div>
  );
}

export default function ProductCard({ product }: { product: Product }) {
  const navigate = useNavigate();
  const { score, count } = getRating(product.id);
  const deal = getDeal(product.price, product.original_price);
  const oos = product.out_of_stock === true;

  return (
    <motion.div
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
      onClick={() => !oos && navigate(`/product/${product.id}`)}
    >
      {/* Image */}
      <div style={{ position: 'relative', background: 'var(--surface-2)', aspectRatio: '4/3', overflow: 'hidden' }}>
        <img
          src={product.image || 'https://placehold.co/280x210/eaf3fa/2B9FD8?text=No+Image'}
          alt={product.name}
          loading="lazy"
          onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/280x210/eaf3fa/2B9FD8?text=No+Image'; }}
          style={{ width: '100%', height: '100%', objectFit: 'contain', padding: 12, transition: 'transform 0.4s' }}
        />
        {oos && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: '#e53e3e', color: '#fff', fontSize: '0.62rem', fontWeight: 800, padding: '3px 8px', borderRadius: 20, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            Out of Stock
          </div>
        )}
        {product.tag && !oos && (
          <div style={{ position: 'absolute', top: 8, left: 8, background: 'var(--primary)', color: '#fff', fontSize: '0.62rem', fontWeight: 800, padding: '3px 8px', borderRadius: 20, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
            {product.tag}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
        <span style={{ fontSize: '0.68rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}>{product.brand}</span>
        <h3 style={{ fontSize: '0.92rem', fontWeight: 600, color: 'var(--text)', lineHeight: 1.3, flex: 1, fontFamily: 'var(--font-display)' }}>{product.name}</h3>
        <StarDisplay score={score} count={count} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
          <span style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.05rem' }}>{formatPrice(product.price)}</span>
          {deal && (
            <>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-light)', textDecoration: 'line-through' }}>{formatPrice(deal.origPrice)}</span>
              <span style={{ fontSize: '0.65rem', fontWeight: 800, padding: '2px 6px', borderRadius: 20, background: '#fff0f0', color: '#e53e3e' }}>{deal.pct}% OFF</span>
            </>
          )}
        </div>
        <button
          disabled={oos}
          style={{
            marginTop: 8, padding: '10px', width: '100%',
            background: oos ? '#aaa' : 'var(--primary)',
            color: '#fff', border: 'none', borderRadius: 8,
            fontWeight: 700, fontSize: '0.88rem',
            cursor: oos ? 'not-allowed' : 'pointer',
            fontFamily: 'var(--font-body)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => !oos && (e.currentTarget.style.background = 'var(--primary-dark)')}
          onMouseLeave={e => !oos && (e.currentTarget.style.background = 'var(--primary)')}
        >
          {oos ? 'Out of Stock' : 'View Product'}
        </button>
      </div>
    </motion.div>
  );
}
