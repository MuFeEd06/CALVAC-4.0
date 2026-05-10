import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useCart } from '@/context/CartContext';
import { useToast } from '@/context/ToastContext';
import { formatPrice, WHATSAPP_NUMBER } from '@/utils';
import { createOrder } from '@/api';
import type { Address } from '@/types';
import { cleanStr, isValidPhone, isValidPin, validateAddress } from '@/utils/validation';

function AddressForm({ onSave, existing }: { onSave: (a: Address) => void; existing: Address | null }) {
  const [form, setForm] = useState<Address>(
    existing || { name:'', phone:'', line1:'', line2:'', city:'', state:'', pin:'', landmark:'' }
  );
  const [errors, setErrors] = useState<Partial<Record<keyof Address, string>>>({});
  const { showToast } = useToast();

  const set = (k: keyof Address) => (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = cleanStr(e.target.value, k === 'line1' || k === 'line2' ? 200 : 100);
    setForm(prev => ({ ...prev, [k]: v }));
    if (errors[k]) setErrors(prev => ({ ...prev, [k]: '' }));
  };

  const handleSave = () => {
    const err = validateAddress(form);
    if (err) { showToast(err, false); return; }

    // Extra field-level feedback
    const fieldErrs: Partial<Record<keyof Address, string>> = {};
    if (!isValidPhone(form.phone)) fieldErrs.phone = 'Invalid phone number';
    if (!isValidPin(form.pin))     fieldErrs.pin   = 'Invalid PIN code';
    if (Object.keys(fieldErrs).length > 0) { setErrors(fieldErrs); return; }

    onSave(form);
    showToast('✓ Address saved');
  };

  const inp = (k: keyof Address): React.CSSProperties => ({
    width:'100%', padding:'9px 12px',
    background:'var(--surface)', border:`1.5px solid ${errors[k]?'#ef4444':'var(--border)'}`,
    borderRadius:7, color:'var(--text)', fontSize:'0.85rem',
    fontFamily:'var(--font-body)', outline:'none',
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8, marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
      {/* Name */}
      <div>
        <input style={inp('name')} placeholder="Full Name *" value={form.name} onChange={set('name')}
          onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor=errors.name?'#ef4444':'var(--border)'} />
        {errors.name && <p style={{ fontSize:'0.72rem', color:'#ef4444', margin:'3px 0 0' }}>{errors.name}</p>}
      </div>
      {/* Phone */}
      <div>
        <input style={inp('phone')} placeholder="Phone Number * (10 digits)" value={form.phone} onChange={set('phone')} type="tel" maxLength={13}
          onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor=errors.phone?'#ef4444':'var(--border)'} />
        {errors.phone && <p style={{ fontSize:'0.72rem', color:'#ef4444', margin:'3px 0 0' }}>{errors.phone}</p>}
      </div>
      <input style={inp('line1')} placeholder="House / Flat / Building *" value={form.line1} onChange={set('line1')}
        onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'} />
      <input style={inp('line2')} placeholder="Street / Area / Locality" value={form.line2 || ''} onChange={set('line2')}
        onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'} />
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <input style={inp('city')} placeholder="City *" value={form.city} onChange={set('city')}
          onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'} />
        <input style={inp('state')} placeholder="State *" value={form.state} onChange={set('state')}
          onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'} />
      </div>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
        <div>
          <input style={inp('pin')} placeholder="PIN Code *" value={form.pin} onChange={set('pin')} type="tel" maxLength={6}
            onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor=errors.pin?'#ef4444':'var(--border)'} />
          {errors.pin && <p style={{ fontSize:'0.72rem', color:'#ef4444', margin:'3px 0 0' }}>{errors.pin}</p>}
        </div>
        <input style={inp('landmark')} placeholder="Landmark (optional)" value={form.landmark || ''} onChange={set('landmark')}
          onFocus={e=>e.target.style.borderColor='var(--primary)'} onBlur={e=>e.target.style.borderColor='var(--border)'} />
      </div>
      <button onClick={handleSave} style={{ padding:'10px', background:'var(--primary)', color:'#fff', border:'none', borderRadius:7, fontWeight:700, fontSize:'0.88rem', cursor:'pointer', fontFamily:'var(--font-body)', marginTop:2 }}>
        Save Address
      </button>
    </div>
  );
}

export default function CartPage() {
  const { cart, removeItem, changeQty, totalItems, totalPrice, address, saveAddress } = useCart();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [addrOpen, setAddrOpen] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const buildWhatsApp = () => {
    if (!address) return '#';
    // Sanitize all user-entered text before embedding in the WhatsApp URL
    let msg = '🛒 *New Order — CALVAC*\n\n👟 *Items Ordered:*\n';
    cart.forEach((item, i) => {
      msg += `\n${i + 1}. *${cleanStr(item.name, 200)}*\n`;
      msg += `   Brand: ${cleanStr(item.brand, 100)}\n`;
      msg += `   Size: ${cleanStr(item.size, 20)}\n`;
      if (item.color) msg += `   Color: ${cleanStr(item.color, 50)}\n`;
      msg += `   Qty: ${Math.max(1, Math.min(99, item.qty))}\n`;
      msg += `   Price: ${formatPrice(item.price * item.qty)}\n`;
    });
    msg += `\n━━━━━━━━━━━━━\n💰 *Total: ${formatPrice(totalPrice)}*\n🚚 Shipping: FREE\n\n`;
    msg += `📍 *Delivery Address:*\n${cleanStr(address.name, 100)}\n${cleanStr(address.phone, 15)}\n`;
    msg += `${cleanStr(address.line1, 200)}${address.line2 ? ', ' + cleanStr(address.line2, 200) : ''}\n`;
    msg += `${cleanStr(address.city, 100)}, ${cleanStr(address.state, 100)} — ${cleanStr(address.pin, 6)}\n`;
    if (address.landmark) msg += `Landmark: ${cleanStr(address.landmark, 200)}\n`;
    msg += '\nPlease confirm my order! 🙏';
    return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(msg)}`;
  };

  const handleOrder = async () => {
    if (!address) { showToast('Add a delivery address first', false); return; }
    const err = validateAddress(address);
    if (err) { showToast(err, false); return; }
    if (cart.length === 0) { showToast('Your cart is empty', false); return; }

    setOrdering(true);
    await createOrder({ address, items: cart, total: totalPrice });
    const url = buildWhatsApp();
    if (url !== '#') window.open(url, '_blank', 'noopener,noreferrer');
    setOrdering(false);
  };

  if (totalItems === 0) return (
    <main style={{ padding:'80px 5%', textAlign:'center' }}>
      <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}>
        <div style={{ fontSize:'4rem', marginBottom:20 }}>👟</div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:'1.6rem', marginBottom:10 }}>Your cart is empty</h2>
        <p style={{ color:'var(--text-muted)', marginBottom:30 }}>Looks like you haven't added any sneakers yet.</p>
        <Link to="/shop" style={{ display:'inline-block', padding:'12px 32px', border:'1.5px solid var(--primary)', color:'var(--primary)', borderRadius:8, fontWeight:600, transition:'all 0.2s' }}
          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='var(--primary)';(e.currentTarget as HTMLElement).style.color='#fff';}}
          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='transparent';(e.currentTarget as HTMLElement).style.color='var(--primary)';}}>
          Continue Shopping
        </Link>
      </motion.div>
    </main>
  );

  return (
    <main style={{ maxWidth:900, margin:'0 auto', padding:'40px 5% 100px' }}>
      <h1 style={{ fontFamily:'var(--font-display)', fontSize:'2rem', color:'var(--primary)', marginBottom:8 }}>Your Cart</h1>
      <p style={{ color:'var(--text-muted)', fontSize:'0.9rem', marginBottom:40 }}>{totalItems} item{totalItems !== 1 ? 's' : ''} in your cart</p>

      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,1fr) 300px', gap:30, alignItems:'start' }}>
        {/* Items */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <AnimatePresence>
            {cart.map((item, idx) => (
              <motion.div key={`${item.id}-${item.size}-${item.color}`}
                initial={{ opacity:0, x:-20 }} animate={{ opacity:1, x:0 }} exit={{ opacity:0, x:20 }}
                transition={{ duration:0.25 }}
                style={{ display:'grid', gridTemplateColumns:'90px 1fr auto', gap:16, alignItems:'center', background:'var(--surface)', border:'1px solid var(--border)', borderRadius:14, padding:16, boxShadow:'var(--shadow)' }}>
                <img src={item.image} alt={item.name}
                  onError={e=>{(e.target as HTMLImageElement).src='https://placehold.co/90x90/eaf3fa/2B9FD8?text=👟';}}
                  style={{ width:90, height:90, objectFit:'contain', borderRadius:8, background:'var(--surface-2)', padding:6 }} />
                <div>
                  <span style={{ fontSize:'0.7rem', color:'var(--text-light)', textTransform:'uppercase', letterSpacing:'1px' }}>{item.brand}</span>
                  <div style={{ fontWeight:600, fontSize:'0.95rem', marginBottom:4, fontFamily:'var(--font-display)' }}>{item.name}</div>
                  <div style={{ fontSize:'0.82rem', color:'var(--text-muted)', marginBottom:4 }}>
                    Size: <span style={{ background:'var(--surface-2)', padding:'2px 8px', borderRadius:4, border:'1px solid var(--border)' }}>{item.size}</span>
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
                  <div style={{ display:'flex', alignItems:'center', border:'1.5px solid var(--border)', borderRadius:8, overflow:'hidden' }}>
                    <button onClick={()=>changeQty(idx,-1)} style={{ width:32, height:32, background:'var(--surface-2)', border:'none', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>−</button>
                    <span style={{ width:36, textAlign:'center', fontWeight:600, fontSize:'0.95rem', borderLeft:'1px solid var(--border)', borderRight:'1px solid var(--border)', lineHeight:'32px' }}>{item.qty}</span>
                    <button onClick={()=>changeQty(idx,1)} style={{ width:32, height:32, background:'var(--surface-2)', border:'none', cursor:'pointer', fontSize:'1.1rem', display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
                  </div>
                  <button onClick={()=>{removeItem(idx);showToast(`${item.name} removed`);}} style={{ background:'none', border:'none', color:'var(--text-light)', fontSize:'0.78rem', cursor:'pointer', textDecoration:'underline', padding:0 }}>Remove</button>
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
          <div style={{ background:'var(--surface-2)', border:'1.5px solid var(--border)', borderRadius:12, padding:16, marginTop:16 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
              <h3 style={{ fontSize:'0.8rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px' }}>📍 Delivery Address</h3>
              <button onClick={()=>setAddrOpen(v=>!v)} style={{ background:'none', border:'1.5px solid var(--primary)', color:'var(--primary)', fontSize:'0.75rem', fontWeight:600, padding:'4px 12px', borderRadius:20, cursor:'pointer' }}>
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

          <motion.button onClick={handleOrder} whileHover={address?{scale:1.02}:{}} whileTap={address?{scale:0.98}:{}}
            disabled={!address||ordering}
            style={{ width:'100%', padding:15, marginTop:20, background:address?'#25D366':'#aaa', border:'none', borderRadius:10, color:'#fff', fontWeight:700, fontSize:'1rem', cursor:address?'pointer':'not-allowed', display:'flex', alignItems:'center', justifyContent:'center', gap:10, fontFamily:'var(--font-display)' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            {ordering ? 'Placing order…' : 'Order via WhatsApp'}
          </motion.button>
          {!address && <p style={{ textAlign:'center', fontSize:'0.78rem', color:'#e53e3e', marginTop:6 }}>⚠️ Add a delivery address to order.</p>}
          <Link to="/shop" style={{ display:'block', textAlign:'center', marginTop:10, padding:12, border:'1.5px solid var(--border)', borderRadius:10, color:'var(--text-muted)', fontSize:'0.9rem' }}>← Continue Shopping</Link>
        </div>
      </div>
      <style>{`@media(max-width:700px){main>div>div:last-child{position:static!important;grid-column:1/-1}main>div{grid-template-columns:1fr!important}}`}</style>
    </main>
  );
}
