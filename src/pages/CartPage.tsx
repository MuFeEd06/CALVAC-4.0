import OrderCooldown from '@/components/OrderCooldown';
import { imageFallback, FALLBACK_IMAGE, ikResize } from '@/utils/images';
import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { formatPrice } from '@/utils';
import { createOrder, requestJson, ApiError, type OrderPayload } from '@/api';
import type { ConfirmedOrder, PaymentMethod } from '@/types/api';
import AddressForm from '@/components/AddressForm';
import OrderConfirmation from '@/components/OrderConfirmation';
import { checkoutKey } from '@/utils/checkout';
import { MAX_QTY } from '@/utils/cart';
import { validateAddress } from '@/utils/validation';
import { formatSizeWithUnit } from '@/utils/sizeUnits';

export default function CartPage() {
  const { cart, removeItem, changeQty, totalItems, totalPrice, address, saveAddress, clearCart } = useCart();
  const { showToast, clearToasts } = useToast();
  const navigate = useNavigate();
  const [addrOpen, setAddrOpen] = useState(false);
  const [ordering, setOrdering] = useState(false);
  const orderLock = useRef(false);
  const [cooldownUntil,setCooldownUntil]=useState(0),[cooldownOpen,setCooldownOpen]=useState(false),[now,setNow]=useState(Date.now);
  const remaining=Math.max(0,Math.ceil((cooldownUntil-now)/1000));
  useEffect(()=>{if(!cooldownUntil)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[cooldownUntil]);
  const attemptRef = useRef<{ fingerprint: string; key: string } | null>(null);
  const [confirmed, setConfirmed] = useState<ConfirmedOrder | null>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem('calvac_confirmed_order') || 'null');
      return saved?.ts > Date.now() - 86_400_000 && saved.order?.id ? saved.order : null;
    } catch { return null; }
  });


  const [methods,setMethods]=useState<Record<PaymentMethod,boolean>|null>(null);
  const [configError,setConfigError]=useState('');
  const [method,setMethod]=useState<PaymentMethod>(()=>new URLSearchParams(window.location.search).get('payment')==='razorpay'?'razorpay':'whatsapp');
  const loadMethods=()=>{setConfigError('');requestJson<{methods:Record<PaymentMethod,boolean>}>('/api/checkout-config').then(data=>setMethods(data.methods)).catch(()=>setConfigError('Payment options could not load. Please try again.'));};
  const hasItems = totalItems > 0;
  useEffect(()=>{if(hasItems)loadMethods();},[hasItems]);

  const handleOrder = async () => {
    if (orderLock.current) return;
    if (cooldownUntil>Date.now()) {setCooldownOpen(true);return;}
    if (!address) { showToast('Add a delivery address first', false); return; }
    const error = validateAddress(address);
    if (error) { showToast(error, false); return; }
    if (!cart.length) return;
    if (!methods?.[method]) { showToast('This payment method is currently unavailable.',false); return; }
    clearToasts();
    orderLock.current = true; setOrdering(true);
    const payload: OrderPayload = {
      items: cart.map(item => ({ productId: item.id, quantity: item.qty, size: item.size, sizeUnit: item.size_unit, color: item.color })),
      customer: { ...address, address: `${address.line1}, ${address.city}, ${address.state} ${address.pin}` }, paymentMethod: method,
    };
    try {
      const fingerprint = JSON.stringify(payload);
      const key = attemptRef.current?.fingerprint === fingerprint ? attemptRef.current.key : await checkoutKey(payload);
      attemptRef.current = { fingerprint, key };
      const { order } = await createOrder(payload, key);
      const confirmation = { ...order, customer: order.customer || address };
      setConfirmed(confirmation);
      try { sessionStorage.setItem('calvac_confirmed_order', JSON.stringify({ ts: Date.now(), order: confirmation })); sessionStorage.removeItem('calvac_checkout_attempt'); } catch {}
      clearCart(); attemptRef.current = null;
    } catch (error) {
      if(error instanceof ApiError && error.status===409 && error.retryAfter){setNow(Date.now());setCooldownUntil(Date.now()+error.retryAfter*1000);setCooldownOpen(true);return;}
      if (error instanceof ApiError && error.status === 401) { navigate('/login?redirect='+encodeURIComponent('/cart?payment=razorpay')); return; }
      showToast(error instanceof Error ? error.message : 'Could not place order. Retry to check the same order.', false);
    } finally { orderLock.current = false; setOrdering(false); }
  };

  if (confirmed && totalItems === 0) return (
    <main className="account-shell"><OrderConfirmation order={confirmed} autoPoll onChange={order=>{
      setConfirmed(order);try{sessionStorage.setItem('calvac_confirmed_order',JSON.stringify({ts:Date.now(),order}));}catch{}
    }}/></main>
  );

  if (totalItems === 0) return (
    <main style={{ padding:'80px 5%', textAlign:'center' }}>
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
        <div style={{ fontSize:'4rem', marginBottom:20 }}>👟</div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.6rem', marginBottom:10 }}>Your cart is empty</h2>
        <p style={{ color:'var(--text-muted)', marginBottom:30 }}>Looks like you haven't added any sneakers yet.</p>
        <Link to="/shop" style={{ display:'inline-block', padding:'12px 32px', border:'1.5px solid var(--primary)', color:'var(--primary)', borderRadius:'var(--button-radius)', fontWeight:600, transition:'all 0.2s' }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--primary)';(e.currentTarget as HTMLElement).style.color='var(--on-primary)';}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--primary)';}}>
          Continue Shopping
        </Link>
      </motion.div>
    </main>
  );

  return (
    <main style={{ maxWidth:900, margin:'0 auto', padding:'40px 5% 100px' }}>
      {cooldownOpen&&<OrderCooldown remaining={remaining} onClose={()=>setCooldownOpen(false)}/>}

      <h1 style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'var(--primary)', marginBottom:8 }}>Your Cart</h1>
      <p style={{ color:'var(--text-muted)', fontSize:'0.9rem', marginBottom:40 }}>{totalItems} item{totalItems !== 1 ? 's' : ''} in your cart</p>

      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 300px', gap:30, alignItems:'start' }}>
        {/* Items */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <AnimatePresence>
            {cart.map((item, idx) => (
              <motion.div key={`${item.id}-${item.size_unit}-${item.size}-${item.color}`}
                initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20 }}
                transition={{ duration:0.25 }}
                style={{ display:'grid', gridTemplateColumns:'90px 1fr auto', gap:16, alignItems:'center', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:16, boxShadow:'var(--shadow)' }}>
                <img src={ikResize(item.image,160,75)||FALLBACK_IMAGE} alt={item.name}
                  onError={imageFallback}
                  style={{ width:90, height:90, objectFit:'contain', borderRadius:8, background:'var(--surface-2)', padding:6 }} />
                <div>
                  <span style={{ fontSize:'0.7rem', color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'1px' }}>{item.brand}</span>
                  <div style={{ fontWeight:600, fontSize:'0.95rem', marginBottom:4, fontFamily:'var(--font-display)' }}>{item.name}</div>
                  <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:4 }}>
                    Size: <span style={{ background:'var(--surface-2)', padding:'2px 8px', borderRadius:4, border:'1px solid var(--border)' }}>{formatSizeWithUnit(item.size_unit, item.size)}</span>
                    {item.color && (
                      <span style={{ display:'inline-flex', alignItems:'center', gap:5, marginLeft:8 }}>
                        <span style={{ width:11, height:11, borderRadius:'50%', background:item.colorHex||'#aaa', border:'1px solid rgba(0,0,0,0.12)', display:'inline-block' }} />
                        {item.color}
                      </span>
                    )}
                  </div>
                  <span style={{ color:'var(--primary)', fontWeight:700, fontSize:'0.95rem' }}>{formatPrice(item.price)}</span>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'flex-end', gap:12 }}>
                  <div style={{ display:'flex', alignItems:'center', border:'1.5px solid var(--border)', borderRadius:'var(--button-radius)', overflow:'hidden' }}>
                    <button disabled={ordering} aria-label={`Decrease quantity of ${item.name}`} onClick={()=>changeQty(idx,-1)} style={{ width:32, height:32, background:'var(--surface-2)', border:'none', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                    <span style={{ width:36, textAlign:'center', fontWeight:600, fontSize:'0.95rem', borderLeft:'1px solid var(--border)', borderRight:'1px solid var(--border)', lineHeight:'32px' }}>{item.qty}</span>
                    <button disabled={ordering || item.qty >= MAX_QTY} aria-label={`Increase quantity of ${item.name}`} onClick={()=>changeQty(idx,1)} style={{ width:32, height:32, background:'var(--surface-2)', border:'none', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                  </div>
                  <button disabled={ordering} onClick={()=>{removeItem(idx);showToast(`${item.name} removed`);}} style={{ background:'none', border:'none', color:'var(--text-light)', fontSize:'0.78rem', cursor:'pointer', textDecoration:'underline', padding:0 }}>Remove</button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:16, padding:24, position:'sticky', top:90, boxShadow:'var(--shadow)' }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1rem', fontWeight:700, marginBottom:20, textTransform:'uppercase', letterSpacing:'1px' }}>Order Summary</h2>
          {[
            { label:`Subtotal (${totalItems} items)`, value:formatPrice(totalPrice) },
            { label:'Shipping', value:<span style={{ color:'var(--primary)', fontWeight:600 }}>FREE</span> },
          ].map(r=>(
            <div key={r.label} style={{ display:'flex', justifyContent:'space-between', padding:'10px 0', borderBottom:'1px solid var(--border)', fontSize:'0.9rem', color:'var(--text-muted)' }}>
              <span>{r.label}</span><span>{r.value}</span>
            </div>
          ))}
          <div style={{ display:'flex', justifyContent:'space-between', padding:'16px 0 0', fontWeight:700, fontSize:'1.15rem' }}>
            <span>Total</span>
            <span style={{ color:'var(--primary)' }}>{formatPrice(totalPrice)}</span>
          </div>

          {/* Address */}
          <p><button disabled={ordering} onClick={async()=>{
            try{const {fetchAccount}=await import('@/api/customer');const account=await fetchAccount();
              if(!account.profile.address){showToast('Save a delivery address in your account first.',false);return;}
              saveAddress(account.profile.address);setAddrOpen(false);
            }catch(error){if(error instanceof ApiError&&error.status===401)navigate('/login?redirect=/cart');else showToast(error instanceof Error?error.message:'Could not load your saved address.',false);}
          }}>Use saved address</button></p>
          <div style={{ background:'var(--surface-2)', border:'1.5px solid var(--border)', borderRadius:12, padding:16, marginTop:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <h3 style={{ fontSize:'0.8rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px' }}>📍 Delivery Address</h3>
              <button disabled={ordering} onClick={()=>setAddrOpen(v=>!v)} style={{ background:'none', border:'1.5px solid var(--primary)', color:'var(--primary)', fontSize:'0.75rem', fontWeight:600, padding:'4px 12px', borderRadius:'var(--button-radius)', cursor:'pointer' }}>
                {address ? '✏️ Edit' : '+ Add'}
              </button>
            </div>
            {address && !addrOpen ? (
              <div style={{ fontSize:'0.87rem', color:'var(--text-muted)', lineHeight:1.7 }}>
                <strong style={{ color:'var(--text)', display:'block', marginBottom:2 }}>{address.name} · {address.phone}</strong>
                {address.line1}{address.line2 ? ', ' + address.line2 : ''}<br />
                {address.city}, {address.state} — {address.pin}
                {address.landmark && <><br /><span style={{ fontSize:'0.8rem', color:'var(--text-light)' }}>Near: {address.landmark}</span></>}
              </div>
            ) : !address && !addrOpen ? (
              <p style={{ fontSize:'0.82rem', color:'var(--text-light)', fontStyle:'italic' }}>No address saved. Add your delivery address.</p>
            ) : null}
            <AnimatePresence>
              {addrOpen && (
                <motion.div initial={{ height:0, opacity:0 }} animate={{ height:'auto', opacity:1 }} exit={{ height:0, opacity:0 }}>
                  <AddressForm existing={address} onSave={a=>{saveAddress(a);setAddrOpen(false);}} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>


          <fieldset disabled={ordering} className="payment-options">
            <legend>Payment method</legend>
            {(['whatsapp','cod','razorpay'] as const).map(value=><label key={value}>
              <input type="radio" name="payment-method" value={value} checked={method===value} disabled={!methods?.[value]} onChange={()=>setMethod(value)}/>
              {value==='whatsapp'?'WhatsApp':value==='cod'?'Cash on Delivery':'Pay Online'}
              {!methods?.[value]&&<small>Currently unavailable</small>}
            </label>)}
          </fieldset>
          {method==='razorpay'&&<p>Online payment requires <Link to={'/login?redirect='+encodeURIComponent('/cart?payment=razorpay')}>sign-in</Link>.</p>}
          {configError&&<p role="alert" className="load-error">{configError} <button onClick={loadMethods}>Try again</button></p>}
          <button className="primary-link" disabled={ordering||!address||!methods?.[method]} onClick={()=>void handleOrder()}
            style={{width:'100%',marginTop:16,background:'var(--primary)'}}>
            {ordering?'Placing order…':remaining>0?`Order cooldown · ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`:method==='whatsapp'?'Order via WhatsApp':method==='cod'?'Place Cash on Delivery Order':'Continue to payment'}
          </button>

          {!address && <p style={{ textAlign:'center', fontSize:'0.78rem', color:'var(--danger)', marginTop:6 }}>⚠️ Add a delivery address to order.</p>}
          <Link to="/shop" style={{ display:'block', textAlign:'center', marginTop:10, padding:12, border:'1.5px solid var(--border)', borderRadius:'var(--button-radius)', color:'var(--text-muted)', fontSize:'0.9rem' }}>← Continue Shopping</Link>
        </div>
      </div>
      <style>{`@media(max-width:700px){main>div>div:last-child{position:static!important;grid-column:1/-1}main>div{grid-template-columns:1fr!important}}`}</style>
    </main>
  );
}
