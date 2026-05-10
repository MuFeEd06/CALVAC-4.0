import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchProduct, fetchProducts, ikResize } from '@/api';
import type { Product, ProductColor } from '@/types';
import { getRating, formatPrice, getDeal, getProductDescription, getSizeLabel, UK_TO_EU } from '@/utils';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { StarDisplay } from '@/components/ProductCard';
import ProductCard from '@/components/ProductCard';

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
  const [mainImg, setMainImg] = useState('');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [specsOpen, setSpecsOpen] = useState(true);
  const [sizeUnit, setSizeUnit] = useState<'uk'|'euro'>('uk');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetchProduct(parseInt(id))
      .then(p => {
        setProduct(p);
        setMainImg(ikResize(p.image, 800, 85));
        setCurrentPrice(p.price);
        if (p.colors?.length) setSelectedColor(p.colors[0]);
        // similar products
        fetchProducts().then(all => {
          const excl = parseInt(id);
          const sameBrand = all.filter(x => x.id !== excl && x.brand.toLowerCase() === p.brand.toLowerCase());
          const rest = all.filter(x => x.id !== excl && !sameBrand.find(s => s.id === x.id));
          setSimilar([...sameBrand, ...rest].slice(0, 8));
        });
      })
      .catch(() => { showToast('Product not found', false); navigate('/shop'); })
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (selectedColor) {
      setCurrentPrice(selectedColor.price || product?.price || 0);
      if (selectedColor.image) setMainImg(ikResize(selectedColor.image, 800, 85));
    }
  }, [selectedColor]);

  const deal = product ? getDeal(currentPrice, product.original_price) : null;
  const { score, count } = product ? getRating(product.id) : { score: 0, count: 0 };

  const addToCart = (goBuy = false) => {
    if (!product || !selectedSize) { showToast('Please select a size first 👆'); return; }
    addItem({
      id: product.id, name: product.name, brand: product.brand,
      price: currentPrice, image: mainImg,
      size: selectedSize,
      color: selectedColor?.name,
      colorHex: selectedColor?.hex,
    });
    showToast(`Added to cart — ${selectedSize}${selectedColor ? ' · ' + selectedColor.name : ''}`);
    if (goBuy) navigate('/cart');
  };

  if (loading) return (
    <div style={{ padding: '60px 5%', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
    </div>
  );

  if (!product) return null;

  return (
    <main>
      <section style={{ padding: '40px 5%', display: 'flex', justifyContent: 'center' }}>
        <div style={{
          display: 'flex', flexWrap: 'wrap', gap: 48,
          maxWidth: 1100, width: '100%', alignItems: 'flex-start',
          background: 'var(--surface)', padding: '40px', borderRadius: 20,
          border: '1px solid var(--border)', boxShadow: 'var(--shadow)',
        }}>
          {/* Image */}
          <motion.div style={{ flex: 1, minWidth: 280 }} layout>
            <AnimatePresence mode="wait">
              <motion.img key={mainImg}
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                src={mainImg || 'https://placehold.co/400x300/eaf3fa/2B9FD8'}
                alt={product.name}
                onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/400x300/eaf3fa/2B9FD8'; }}
                style={{ width: '100%', borderRadius: 14, background: 'var(--surface-2)', padding: 16 }} />
            </AnimatePresence>
          </motion.div>

          {/* Details */}
          <div style={{ flex: 1, minWidth: 280 }}>
            <a onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', fontSize: '0.85rem', cursor: 'pointer', marginBottom: 20 }}>← Back</a>

            <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: 6 }}>{product.brand}</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 800, lineHeight: 1.15, marginBottom: 12 }}>{product.name}</h1>
            <div style={{ marginBottom: 16 }}><StarDisplay score={score} count={count} /></div>

            {/* Price */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <motion.span key={currentPrice} initial={{ scale: 1.1 }} animate={{ scale: 1 }}
                style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.6rem', fontFamily: 'var(--font-display)' }}>
                {formatPrice(currentPrice)}
              </motion.span>
              {deal && (
                <>
                  <span style={{ fontSize: '1rem', color: 'var(--text-light)', textDecoration: 'line-through' }}>{formatPrice(deal.origPrice)}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: 20, background: '#fff0f0', color: '#e53e3e' }}>{deal.pct}% OFF</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: 20, background: '#f0fff4', color: '#276749' }}>Special Price</span>
                </>
              )}
            </div>

            <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, margin: '16px 0', fontSize: '0.95rem', borderLeft: '2px solid var(--primary)', paddingLeft: 14 }}>
              {getProductDescription(product.id, product.name)}
            </p>

            {/* Color Variants */}
            {product.colors?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '0.88rem', color: 'var(--text-muted)', display: 'block', marginBottom: 10, fontWeight: 500 }}>
                  Color — <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{selectedColor?.name}</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  {product.colors.map(c => (
                    <motion.button key={c.name} onClick={() => setSelectedColor(c)}
                      whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.95 }}
                      title={c.name}
                      style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: c.hex, border: `2.5px solid ${selectedColor?.name === c.name ? 'var(--primary)' : 'transparent'}`,
                        outline: selectedColor?.name === c.name ? '2px solid rgba(43,159,216,0.25)' : 'none',
                        cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      }} />
                  ))}
                </div>
              </div>
            )}

            {/* Size Chips */}
            {product.sizes?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Select Size</label>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['uk','euro'] as const).map(u => (
                      <button key={u} onClick={() => setSizeUnit(u)}
                        className={`size-type-btn ${sizeUnit === u ? 'active' : ''}`}>
                        {u.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {product.sizes.map(size => {
                    const stock = product.stock || {};
                    const colorKey = selectedColor?.name || 'default';
                    const qty = stock[`${colorKey}|${size}`] !== undefined ? stock[`${colorKey}|${size}`]
                              : stock[`default|${size}`] !== undefined ? stock[`default|${size}`] : null;
                    const oos = qty !== null && qty <= 0;
                    const low = qty !== null && qty > 0 && qty <= 5;
                    const label = getSizeLabel(size, sizeUnit);

                    return (
                      <motion.button key={size} onClick={() => !oos && setSelectedSize(size)}
                        whileHover={!oos ? { scale: 1.06 } : {}}
                        title={oos ? 'Sold Out' : low ? `${qty} left` : `${size} / ${UK_TO_EU[size] || ''}`}
                        style={{
                          minWidth: 58, padding: '9px 11px', borderRadius: 10, position: 'relative',
                          border: `1.5px solid ${selectedSize === size ? 'var(--primary)' : 'var(--border)'}`,
                          background: selectedSize === size ? 'var(--primary)' : 'var(--surface-2)',
                          color: selectedSize === size ? '#fff' : oos ? 'var(--text-light)' : 'var(--text)',
                          fontWeight: 700, fontSize: '0.85rem', cursor: oos ? 'not-allowed' : 'pointer',
                          opacity: oos ? 0.35 : 1, fontFamily: 'var(--font-body)',
                          transform: selectedSize === size ? 'scale(1.06)' : 'scale(1)',
                          boxShadow: selectedSize === size ? '0 4px 14px rgba(0,0,0,0.15)' : 'none',
                        }}>
                        {label}
                        {low && <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#f5a623' }} />}
                      </motion.button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            {product.out_of_stock ? (
              <div style={{ background: '#fff5f5', border: '1.5px solid #fed7d7', borderRadius: 10, padding: 16, textAlign: 'center', color: '#e53e3e', fontWeight: 700 }}>
                😔 Currently out of stock
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                <motion.button onClick={() => addToCart(false)} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                  style={{ padding: 15, background: 'var(--primary)', color: '#fff', border: 'none', fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer', borderRadius: 10, fontFamily: 'var(--font-display)', letterSpacing: '0.3px' }}>
                  🛒 Add to Cart
                </motion.button>
                <motion.button onClick={() => addToCart(true)} whileHover={{ y: -2 }} whileTap={{ scale: 0.98 }}
                  style={{ padding: 15, background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))', color: '#fff', border: 'none', fontWeight: 700, fontSize: '1.05rem', cursor: 'pointer', borderRadius: 10, fontFamily: 'var(--font-display)', letterSpacing: '0.3px' }}>
                  ⚡ Buy Now
                </motion.button>
              </div>
            )}

            {/* Specifications */}
            {product.specs?.trim() && (
              <div style={{ marginTop: 24, border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                <button onClick={() => setSpecsOpen(v => !v)}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '11px 16px', background: 'var(--surface-2)', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.88rem', fontFamily: 'var(--font-body)' }}>
                  📋 Specifications
                  <motion.span animate={{ rotate: specsOpen ? 0 : -90 }}>▾</motion.span>
                </button>
                <AnimatePresence>
                  {specsOpen && (
                    <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} style={{ overflow: 'hidden' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        {product.specs.trim().split('\n').filter(l => l.trim()).map((line, i) => {
                          const idx = line.indexOf(':');
                          const k = idx > 0 ? line.slice(0, idx).trim() : '';
                          const v = idx > 0 ? line.slice(idx + 1).trim() : line;
                          return (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                              <td style={{ padding: '9px 16px', color: 'var(--text-muted)', fontWeight: 600, width: '40%' }}>{k}</td>
                              <td style={{ padding: '9px 16px', color: 'var(--text)' }}>{v}</td>
                            </tr>
                          );
                        })}
                      </table>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Similar Products */}
      {similar.length > 0 && (
        <section style={{ padding: '20px 5% 60px', maxWidth: 1300, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', color: 'var(--primary)', margin: '0 0 24px', fontSize: '1.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>You May Also Like</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(220px,45vw),1fr))', gap: 24 }}>
            {similar.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </main>
  );
}
