import { imageFallback, FALLBACK_IMAGE, ikSrcSet } from '@/utils/images';
import { lazy,Suspense,useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchProduct, fetchProducts, ikResize } from '@/api';
import type { Product, ProductColor } from '@/types';
import { formatPrice, getDeal } from '@/utils';
import { formatSizeWithUnit } from '@/utils/sizeUnits';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import ProductCard from '@/components/ProductCard';
import ProductSpecifications from '@/components/ProductSpecifications';
import { relatedProducts } from '@/utils/productDetails';
const ProductAssistant=lazy(()=>import('@/components/ProductAssistant'));

function ProductStateMessage({
  title,
  body,
  action,
  onAction,
}: {
  title: string;
  body: string;
  action: string;
  onAction: () => void;
}) {
  return (
    <main style={{ minHeight: '60vh', padding: '80px 5%', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <div style={{ maxWidth: 420 }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>!</div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.6rem', marginBottom: 10 }}>{title}</h1>
        <p style={{ color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 24 }}>{body}</p>
        <button
          type="button"
          onClick={onAction}
          style={{ padding: '11px 28px', background: 'var(--primary)', color: 'var(--on-primary)', border: 'none', borderRadius: 'var(--button-radius)', fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)' }}
        >
          {action}
        </button>
      </div>
    </main>
  );
}

function stockFor(product: Product, selectedColor: ProductColor | null, size: string): number | null {
  const stock = product.stock || {};
  const colorKey = selectedColor?.name || 'default';
  const unit = product.size_unit || 'UK';
  const candidates = [
    `${colorKey}|${size}`,
    `default|${size}`,
    `${colorKey}|${unit} ${size}`,
    `default|${unit} ${size}`,
    colorKey,
    ...(unit === 'EU' ? [`${colorKey}|EURO ${size}`, `default|EURO ${size}`] : []),
  ];
  for (const key of candidates) {
    if (stock[key] !== undefined) return Math.min(Number(stock[key]) || 0, product.total_stock ?? Infinity);
  }
  return product.total_stock ?? null;
}

export default function ProductPage() {
  const { id } = useParams<{ id: string }>();
  const productId = Number(id);
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { showToast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [retryNonce, setRetryNonce] = useState(0);
  const [selectedSize, setSelectedSize] = useState('');
  const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
  const [mainImg, setMainImg] = useState('');
  const [currentPrice, setCurrentPrice] = useState(0);
  const [similar, setSimilar] = useState<Product[]>([]);
  const [similarLoading,setSimilarLoading]=useState(false),[similarError,setSimilarError]=useState(false),[similarRetry,setSimilarRetry]=useState(0);

  useEffect(() => {
    let active = true;

    async function loadProduct() {
      setLoading(true);
      setError('');
      setNotFound(false);
      setProduct(null);
      setSelectedSize('');
      setSelectedColor(null);
      setMainImg('');
      setCurrentPrice(0);
      setSimilar([]);

      if (!Number.isInteger(productId) || productId <= 0) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      try {
        const nextProduct = await fetchProduct(productId);
        if (!active) return;

        if (!nextProduct) {
          setNotFound(true);
          return;
        }

        setProduct(nextProduct);
        const firstColor = nextProduct.colors?.[0] || null;
        setSelectedColor(firstColor);
        setCurrentPrice(firstColor?.price ?? nextProduct.price);
        setMainImg(ikResize(firstColor?.image || nextProduct.image, 800, 85));

        setLoading(false);
      } catch (loadError) {
        if (!active) return;
        if (import.meta.env.DEV) console.warn('[CALVAC] Product load failed:', loadError);
        setError('Could not load this product. Please check your connection and try again.');
      } finally {
        if (active) setLoading(false);
      }
    }

    loadProduct();
    return () => { active = false; };
  }, [productId, retryNonce]);

  useEffect(()=>{
    if(!product)return;
    let active=true;setSimilarLoading(true);setSimilarError(false);
    relatedProducts(product,fetchProducts).then(items=>{if(active)setSimilar(items);})
      .catch(()=>{if(active)setSimilarError(true);})
      .finally(()=>{if(active)setSimilarLoading(false);});
    return()=>{active=false;};
  },[product,similarRetry]);

  useEffect(() => {
    if (!product) return;
    setSelectedSize('');
    setCurrentPrice(selectedColor?.price ?? product.price);
    setMainImg(ikResize(selectedColor?.image || product.image, 800, 85));
  }, [selectedColor, product]);

  const deal = product ? getDeal(currentPrice, product.original_price) : null;
  const hasSizes = Boolean(product?.sizes?.length);
  const available = product && selectedSize ? stockFor(product, selectedColor, selectedSize) : null;
  const canAdd = Boolean(product && hasSizes && selectedSize && !product.out_of_stock && (available === null || available > 0));

  const sizeButtons = useMemo(() => product?.sizes || [], [product]);

  const addToCart = (goBuy = false) => {
    if (!product) return;
    if (!hasSizes) { showToast('Size unavailable', false); return; }
    if (!selectedSize) { showToast('Please select a size first', false); return; }
    if (!canAdd) { showToast('This size or color is unavailable', false); return; }
    const added = addItem({
      id: product.id,
      name: product.name,
      brand: product.brand,
      price: currentPrice,
      image: mainImg,
      size: selectedSize,
      size_unit: product.size_unit,
      color: selectedColor?.name,
      colorHex: selectedColor?.hex,
    }, available ?? 10);
    if (!added) { showToast('Cart quantity or item limit reached', false); return; }
    showToast(`Added to cart - ${formatSizeWithUnit(product.size_unit, selectedSize)}${selectedColor ? ' / ' + selectedColor.name : ''}`);
    if (goBuy) navigate('/cart');
  };

  if (loading) return (
    <div style={{ padding: '60px 5%', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid var(--border)', borderTopColor: 'var(--primary)' }} />
    </div>
  );

  if (notFound) return (
    <ProductStateMessage
      title="Product not found"
      body="This product is unavailable or the link is no longer valid."
      action="Back to shop"
      onAction={() => navigate('/shop')}
    />
  );

  if (error) return (
    <ProductStateMessage
      title="Could not load product"
      body={error}
      action="Retry"
      onAction={() => setRetryNonce(v => v + 1)}
    />
  );

  if (!product) return (
    <ProductStateMessage
      title="Product unavailable"
      body="We could not render this product."
      action="Back to shop"
      onAction={() => navigate('/shop')}
    />
  );

  return (
    <main>
      <section className="product-detail-section">
        <div className="product-detail-layout">
          <motion.div style={{ minWidth: 0 }} layout>
            <AnimatePresence mode="wait">
              <motion.img key={mainImg || product.id}
                initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
                transition={{ duration: 0.25 }}
                src={mainImg || FALLBACK_IMAGE}
                srcSet={ikSrcSet(mainImg, 85, [400, 600, 800, 1080])}
                sizes="(max-width:768px) 100vw, 50vw"
                alt={product.name}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                onError={imageFallback}
                style={{ width: '100%', borderRadius: 14, background: 'var(--surface-2)', padding: 16 }} />
            </AnimatePresence>
          </motion.div>

          <div style={{ minWidth: 0 }}>
            <div className="product-summary-top"><div>
            <button type="button" onClick={() => navigate(-1)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--text-muted)', background: 'none', border: 'none', fontSize: '0.85rem', cursor: 'pointer', marginBottom: 20, padding: 0 }}>
              Back
            </button>

            <p style={{ fontSize: '0.72rem', color: 'var(--text-light)', textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600, marginBottom: 6 }}>{product.brand}</p>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '1.9rem', fontWeight: 800, lineHeight: 1.15, marginBottom: 12 }}>{product.name}</h1>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
              <motion.span key={currentPrice} initial={{ scale: 1.1 }} animate={{ scale: 1 }}
                style={{ color: 'var(--primary)', fontWeight: 800, fontSize: '1.6rem', fontFamily: 'var(--font-display)' }}>
                {formatPrice(currentPrice)}
              </motion.span>
              {deal && (
                <>
                  <span style={{ fontSize: '1rem', color: 'var(--text-light)', textDecoration: 'line-through' }}>{formatPrice(deal.origPrice)}</span>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, padding: '3px 10px', borderRadius: 'var(--button-radius)', background: 'var(--danger-bg)', color: 'var(--danger)' }}>{deal.pct}% OFF</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 800, padding: '3px 8px', borderRadius: 'var(--button-radius)', background: 'var(--success-bg)', color: 'var(--success)' }}>Special Price</span>
                </>
              )}
            </div>

            </div><Suspense fallback={<div className="guide-placeholder"/>}><ProductAssistant key={product.id} product={product} selectedSize={selectedSize} selectedColor={selectedColor?.name||''}/></Suspense></div>

            <p style={{ color: 'var(--text-muted)', lineHeight: 1.8, margin: '16px 0', fontSize: '0.95rem', borderLeft: '2px solid var(--primary)', paddingLeft: 14 }}>
              {product.specs?.trim() ? 'See the product details below for specifications.' : 'Contact us for details about this product.'}
            </p>

            {product.colors?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: '0.88rem', color: 'var(--text-muted)', display: 'block', marginBottom: 10, fontWeight: 500 }}>
                  Color - <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{selectedColor?.name}</span>
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                  {product.colors.map(c => (
                    <motion.button key={c.name} onClick={() => setSelectedColor(c)}
                      whileHover={{ scale: 1.15 }} whileTap={{ scale: 0.95 }}
                      title={c.name}
                      aria-label={`Colour ${c.name}`}
                      aria-pressed={selectedColor?.name === c.name}
                      style={{
                        width: 30, height: 30, borderRadius: '50%',
                        background: c.hex, border: `2.5px solid ${selectedColor?.name === c.name ? 'var(--primary)' : 'transparent'}`,
                        outline: selectedColor?.name === c.name ? '2px solid var(--primary-light)' : 'none',
                        cursor: 'pointer', boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                      }} />
                  ))}
                </div>
              </div>
            )}

            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <label style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: 600 }}>Select Size</label>
                {hasSizes && (
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--primary)', border: '1px solid var(--border)', borderRadius: 'var(--button-radius)', padding: '4px 10px', background: 'var(--surface-2)' }}>
                    {product.size_unit}
                  </span>
                )}
              </div>
              {hasSizes ? (
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {sizeButtons.map(size => {
                    const qty = stockFor(product, selectedColor, size);
                    const oos = qty !== null && qty <= 0;
                    const low = qty !== null && qty > 0 && qty <= 5;

                    return (
                      <motion.button key={size} onClick={() => !oos && setSelectedSize(size)}
                        disabled={oos}
                        aria-pressed={selectedSize === size}
                        whileHover={!oos ? { scale: 1.06 } : {}}
                        title={oos ? 'Sold Out' : low ? `${qty} left` : formatSizeWithUnit(product.size_unit, size)}
                        style={{
                          minWidth: 58, padding: '9px 11px', borderRadius: 'var(--button-radius)', position: 'relative',
                          border: `1.5px solid ${selectedSize === size ? 'var(--primary)' : 'var(--border)'}`,
                          background: selectedSize === size ? 'var(--primary)' : 'var(--surface-2)',
                          color: selectedSize === size ? 'var(--on-primary)' : oos ? 'var(--text-light)' : 'var(--text)',
                          fontWeight: 700, fontSize: '0.85rem', cursor: oos ? 'not-allowed' : 'pointer',
                          opacity: oos ? 0.35 : 1, fontFamily: 'var(--font-body)',
                          transform: selectedSize === size ? 'scale(1.06)' : 'scale(1)',
                          boxShadow: selectedSize === size ? '0 4px 14px rgba(0,0,0,0.15)' : 'none',
                        }}>
                        {size}
                        {low && <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: '50%', background: '#f5a623' }} />}
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ background: 'var(--surface-2)', border: '1.5px solid var(--border)', borderRadius: 'var(--button-radius)', padding: 14, color: 'var(--text-muted)', fontWeight: 700 }}>
                  Size unavailable
                </div>
              )}
            </div>

            {product.out_of_stock ? (
              <div style={{ background: 'var(--danger-bg)', border: '1.5px solid #fed7d7', borderRadius: 10, padding: 16, textAlign: 'center', color: 'var(--danger)', fontWeight: 700 }}>
                Currently out of stock
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
                <motion.button onClick={() => addToCart(false)} whileHover={canAdd ? { y: -2 } : {}} whileTap={canAdd ? { scale: 0.98 } : {}}
                  disabled={!canAdd}
                  style={{ padding: 15, background: canAdd ? 'var(--primary)' : 'var(--text-muted)', color: 'var(--on-primary)', border: 'none', fontWeight: 700, fontSize: '1.05rem', cursor: canAdd ? 'pointer' : 'not-allowed', borderRadius: 'var(--button-radius)', fontFamily: 'var(--font-display)', letterSpacing: '0.3px' }}>
                  Add to Cart
                </motion.button>
                <motion.button onClick={() => addToCart(true)} whileHover={canAdd ? { y: -2 } : {}} whileTap={canAdd ? { scale: 0.98 } : {}}
                  disabled={!canAdd}
                  style={{ padding: 15, background: canAdd ? 'var(--primary)' : 'var(--text-muted)', color: 'var(--on-primary)', border: 'none', fontWeight: 700, fontSize: '1.05rem', cursor: canAdd ? 'pointer' : 'not-allowed', borderRadius: 'var(--button-radius)', fontFamily: 'var(--font-display)', letterSpacing: '0.3px' }}>
                  Buy Now
                </motion.button>
              </div>
            )}

            <ProductSpecifications product={product}/>
          </div>
        </div>
      </section>

      {(similar.length > 0||similarLoading||similarError) && (
        <section style={{ padding: '20px 5% 60px', maxWidth: 1300, margin: '0 auto' }}>
          <h2 style={{ fontFamily: 'var(--font-display)', textAlign: 'center', color: 'var(--primary)', margin: '0 0 24px', fontSize: '1.6rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '2px' }}>You May Also Like</h2>
          {similarLoading&&<p role="status">Finding similar styles…</p>}
          {similarError&&<p role="alert">Could not load similar styles. <button type="button" className="text-button" onClick={()=>setSimilarRetry(value=>value+1)}>Try again</button></p>}
          <div className="product-grid">
            {similar.map(p => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      )}
    </main>
  );
}
