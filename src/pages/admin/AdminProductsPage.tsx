import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createAdminProduct, deleteAdminProduct,
  fetchAdminProducts, updateAdminProduct,
} from '@/api/admin';
import type { Product, ProductColor } from '@/types';
import type { AdminProductPayload } from '@/types/admin';
import { sanitizeProductPayload } from '@/utils/validation';

/* ─── Constants ─── */
const UK_SIZES = ['UK 3','UK 3.5','UK 4','UK 5','UK 6','UK 6.5',
                  'UK 7','UK 8','UK 9','UK 10','UK 11','UK 11.5','UK 12'];
const UK_TO_EU: Record<string,string> = {
  'UK 3':'EU 35','UK 3.5':'EU 36','UK 4':'EU 37','UK 5':'EU 38',
  'UK 6':'EU 39','UK 6.5':'EU 40','UK 7':'EU 41','UK 8':'EU 42',
  'UK 9':'EU 43','UK 10':'EU 44','UK 11':'EU 45','UK 11.5':'EU 46','UK 12':'EU 47',
};
const TAG_OPTIONS = ['trending','new','sale','luxury'];
const CAT_OPTIONS = ['boots','crocs','girls'];

function displaySize(uk: string, unit: 'uk'|'eu') {
  return unit === 'eu' ? (UK_TO_EU[uk] || uk) : uk;
}

const emptyDraft = (): AdminProductPayload => ({
  name:'', brand:'', price:0, original_price:0,
  image:'', tag:'', category:'',
  sizes:[], colors:[], specs:'', stock:{},
});

/* ─── shared input style ─── */
const inp = (focus=false): React.CSSProperties => ({
  width:'100%', padding:'9px 12px',
  border:`1px solid ${focus?'#2B9FD8':'#d0e6f5'}`, borderRadius:8,
  fontSize:'0.86rem', fontFamily:'inherit', outline:'none',
  background:'#f4f8fb', color:'#1a1a2e',
});
const fieldLabel: React.CSSProperties = {
  display:'flex', flexDirection:'column', gap:5,
  fontSize:'0.78rem', fontWeight:700, color:'#5a6a7a', textTransform:'uppercase', letterSpacing:'0.5px',
};
const sectionHead: React.CSSProperties = {
  fontSize:'0.72rem', fontWeight:800, color:'#9badb8',
  textTransform:'uppercase', letterSpacing:'1px',
  margin:'20px 0 10px', display:'flex', alignItems:'center', gap:8,
};

/* ══════════════════════════════════════════
   1. IMAGE UPLOADER
══════════════════════════════════════════ */
function ImageUploader({ value, onChange }: { value:string; onChange:(url:string)=>void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [err, setErr] = useState('');

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { setErr('File exceeds 5 MB limit'); return; }
    if (!['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) {
      setErr('Only JPG, PNG, WEBP or GIF allowed'); return;
    }
    setErr(''); setUploading(true);
    try {
      const fd = new FormData();
      fd.append('image', file);
      // Try Flask backend upload endpoint (works when deployed on calvac.in)
      const res = await fetch('/api/x9k2/upload', {
        method:'POST', credentials:'include', body:fd,
      });
      if (!res.ok) throw new Error(`${res.status}`);
      const data = await res.json();
      onChange(data.url || data.image_url || data.path || '');
    } catch {
      // Fallback: convert to base64 data URL for preview only
      const reader = new FileReader();
      reader.onload = () => {
        setErr('⚠️ Direct upload unavailable locally — image shown as preview. Deploy to Vercel for real uploads, or paste an ImageKit URL below.');
        onChange(reader.result as string);
      };
      reader.readAsDataURL(file);
    } finally {
      setUploading(false);
    }
  };

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) upload(file);
  }, []);

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload(file);
    e.target.value = '';
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
        style={{
          border:`2px dashed ${dragging?'#2B9FD8':'#d0e6f5'}`,
          borderRadius:12, padding:'20px 16px',
          background:dragging?'#eaf3fa':'#f4f8fb',
          cursor:'pointer', textAlign:'center',
          transition:'all 0.2s', position:'relative',
        }}
      >
        {value && (value.startsWith('http') || value.startsWith('data:')) ? (
          <div style={{ position:'relative', display:'inline-block' }}>
            <img src={value} alt="Preview"
              style={{ maxHeight:140, maxWidth:'100%', borderRadius:8, objectFit:'contain' }}
              onError={e=>{(e.target as HTMLImageElement).style.display='none';}} />
            <button
              type="button"
              onClick={e=>{e.stopPropagation();onChange('');}}
              style={{
                position:'absolute',top:-8,right:-8,
                width:22,height:22,borderRadius:'50%',
                background:'#ef4444',color:'#fff',border:'none',
                cursor:'pointer',fontSize:'0.7rem',fontWeight:800,lineHeight:1,
              }}>✕</button>
          </div>
        ) : uploading ? (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, color:'#5a6a7a' }}>
            <div style={{ width:28,height:28,border:'3px solid #d0e6f5',borderTopColor:'#2B9FD8',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
            <span style={{ fontSize:'0.82rem' }}>Uploading…</span>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, color:'#9badb8' }}>
            <span style={{ fontSize:'2rem' }}>🖼️</span>
            <span style={{ fontSize:'0.82rem', fontWeight:600 }}>Click or drag to upload image</span>
            <span style={{ fontSize:'0.72rem' }}>JPG, PNG, WEBP · max 5MB</span>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={onFileChange} />
      </div>

      {/* URL paste fallback */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ flex:1, height:1, background:'#d0e6f5' }}/>
        <span style={{ fontSize:'0.7rem', color:'#9badb8', fontWeight:600 }}>OR PASTE URL</span>
        <div style={{ flex:1, height:1, background:'#d0e6f5' }}/>
      </div>
      <FocusInput
        placeholder="https://ik.imagekit.io/…"
        value={value.startsWith('data:') ? '' : value}
        onChange={e => onChange(e.target.value)}
        style={inp()}
      />
      {err && <p style={{ fontSize:'0.74rem', color:'#f59e0b', margin:0 }}>{err}</p>}
    </div>
  );
}

/* ══════════════════════════════════════════
   2. COLOR VARIANT EDITOR
══════════════════════════════════════════ */
interface ColorDraft { name:string; hex:string; price:string; image:string; }

function colorDraftToProductColor(c: ColorDraft): ProductColor {
  return { name:c.name, hex:c.hex, price:c.price?Number(c.price):undefined, image:c.image||undefined };
}
function productColorToDraft(c: ProductColor): ColorDraft {
  return { name:c.name, hex:c.hex, price:c.price!=null?String(c.price):'', image:c.image||'' };
}

function ColorVariantEditor({ colors, onChange }: {
  colors: ProductColor[];
  onChange: (c: ProductColor[]) => void;
}) {
  const [drafts, setDrafts] = useState<ColorDraft[]>(() => colors.map(productColorToDraft));

  useEffect(() => {
    onChange(drafts.filter(d=>d.name.trim()).map(colorDraftToProductColor));
  }, [drafts]);

  const update = (i:number, field:keyof ColorDraft, val:string) => {
    setDrafts(prev => prev.map((d,idx) => idx===i?{...d,[field]:val}:d));
  };

  const add = () => setDrafts(prev => [...prev, { name:'', hex:'#000000', price:'', image:'' }]);
  const remove = (i:number) => setDrafts(prev => prev.filter((_,idx)=>idx!==i));

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {drafts.map((c,i) => (
        <div key={i} style={{
          border:'1px solid #d0e6f5', borderRadius:10, padding:'12px 14px',
          background:'#f4f8fb', display:'flex', flexDirection:'column', gap:8,
          borderLeft:`4px solid ${c.hex||'#d0e6f5'}`,
        }}>
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 1fr', gap:8, alignItems:'end' }}>
            {/* Hex picker */}
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span style={{ ...fieldLabel, fontSize:'0.7rem' }}>Colour</span>
              <label style={{
                width:38, height:38, borderRadius:8, border:'1px solid #d0e6f5',
                overflow:'hidden', cursor:'pointer', display:'block',
              }}>
                <input type="color" value={c.hex||'#000000'}
                  onChange={e=>update(i,'hex',e.target.value)}
                  style={{ width:'200%',height:'200%',marginLeft:'-50%',marginTop:'-50%',border:'none',cursor:'pointer' }} />
              </label>
            </div>
            <label style={fieldLabel}>
              Colour Name *
              <FocusInput placeholder="e.g. Midnight Blue"
                value={c.name} onChange={e=>update(i,'name',e.target.value)} style={inp()} />
            </label>
            <label style={fieldLabel}>
              Price (₹) for this colour
              <FocusInput type="number" placeholder="Leave blank = same as base"
                value={c.price} onChange={e=>update(i,'price',e.target.value)} style={inp()} />
            </label>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <label style={{ ...fieldLabel, flex:1 }}>
              Colour Image URL (optional)
              <FocusInput placeholder="https://ik.imagekit.io/…"
                value={c.image} onChange={e=>update(i,'image',e.target.value)} style={inp()} />
            </label>
            {c.image && c.image.startsWith('http') && (
              <img src={c.image} alt="" style={{ width:40,height:40,borderRadius:6,objectFit:'contain',background:'#fff',border:'1px solid #d0e6f5',flexShrink:0 }}
                onError={e=>{(e.target as HTMLImageElement).style.display='none';}} />
            )}
            <button type="button" onClick={()=>remove(i)}
              style={{ marginTop:20,padding:'6px 10px',background:'#fee2e2',border:'1px solid #fca5a5',
                borderRadius:7,color:'#ef4444',cursor:'pointer',fontSize:'0.78rem',fontWeight:700,flexShrink:0 }}>
              ✕ Remove
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        style={{
          padding:'10px', border:'1.5px dashed #2B9FD8', borderRadius:10,
          background:'transparent', color:'#2B9FD8', cursor:'pointer',
          fontWeight:700, fontSize:'0.85rem', fontFamily:'inherit',
          transition:'background 0.15s',
        }}
        onMouseEnter={e=>e.currentTarget.style.background='#eaf3fa'}
        onMouseLeave={e=>e.currentTarget.style.background='transparent'}>
        + Add Colour Variant
      </button>
    </div>
  );
}

/* ══════════════════════════════════════════
   3. INVENTORY GRID
══════════════════════════════════════════ */
function InventoryGrid({ sizes, colors, stock, onChange }: {
  sizes: string[];
  colors: ProductColor[];
  stock: Record<string,number>;
  onChange: (s:Record<string,number>)=>void;
}) {
  const [bulkVal, setBulkVal] = useState('');
  const rows = colors.length > 0 ? colors.map(c=>c.name) : ['default'];

  if (sizes.length === 0) {
    return <p style={{ fontSize:'0.8rem', color:'#9badb8', fontStyle:'italic' }}>Select sizes above to manage inventory.</p>;
  }

  const get = (row:string, size:string) => {
    const key = `${row}|${size}`;
    return stock[key] != null ? String(stock[key]) : '';
  };

  const set = (row:string, size:string, val:string) => {
    const key = `${row}|${size}`;
    const next = { ...stock };
    if (val === '') { delete next[key]; }
    else { next[key] = Number(val); }
    onChange(next);
  };

  const setAll = () => {
    if (!bulkVal) return;
    const next = { ...stock };
    rows.forEach(row => sizes.forEach(size => { next[`${row}|${size}`] = Number(bulkVal); }));
    onChange(next);
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
      {/* Bulk setter */}
      <div style={{ display:'flex', gap:8, alignItems:'center' }}>
        <span style={{ fontSize:'0.8rem', color:'#5a6a7a', fontWeight:600 }}>Set all to same qty:</span>
        <FocusInput type="number" min="0" placeholder="e.g. 10"
          value={bulkVal} onChange={e=>setBulkVal(e.target.value)}
          style={{ ...inp(), width:90 }} />
        <button type="button" onClick={setAll}
          style={{ padding:'7px 14px',background:'#eaf3fa',border:'1px solid #2B9FD8',
            borderRadius:8,color:'#2B9FD8',cursor:'pointer',fontWeight:700,fontSize:'0.8rem',
            fontFamily:'inherit',whiteSpace:'nowrap' }}>
          Apply
        </button>
        <span style={{ fontSize:'0.72rem', color:'#9badb8' }}>· blank = unlimited</span>
      </div>

      {/* Grid */}
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'0.78rem' }}>
          <thead>
            <tr>
              <th style={{ padding:'6px 10px', background:'#eaf3fa', textAlign:'left',
                borderBottom:'1px solid #d0e6f5', borderRadius:'8px 0 0 0',
                color:'#5a6a7a', fontWeight:700, minWidth:90 }}>
                {colors.length > 0 ? 'Colour' : '—'}
              </th>
              {sizes.map(s => (
                <th key={s} style={{ padding:'6px 10px', background:'#eaf3fa',
                  borderBottom:'1px solid #d0e6f5', borderLeft:'1px solid #d0e6f5',
                  color:'#5a6a7a', fontWeight:700, minWidth:58, textAlign:'center' }}>
                  {s.replace('UK ','')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,ri) => (
              <tr key={row}>
                <td style={{ padding:'5px 10px', borderBottom:'1px solid #d0e6f5',
                  fontWeight:600, color:'#1a1a2e', background:ri%2===0?'#fff':'#f9fbfd' }}>
                  {colors.length > 0 ? (
                    <span style={{ display:'flex', alignItems:'center', gap:6 }}>
                      <span style={{ width:12,height:12,borderRadius:'50%',
                        background:colors[ri]?.hex||'#ccc',border:'1px solid rgba(0,0,0,0.1)',display:'inline-block' }}/>
                      {row}
                    </span>
                  ) : 'Stock'}
                </td>
                {sizes.map(size => {
                  const v = get(row, size);
                  const oos = v !== '' && Number(v) === 0;
                  return (
                    <td key={size} style={{ padding:'4px 6px', borderBottom:'1px solid #d0e6f5',
                      borderLeft:'1px solid #d0e6f5', textAlign:'center',
                      background:ri%2===0?'#fff':'#f9fbfd' }}>
                      <input type="number" min="0"
                        value={v} onChange={e=>set(row,size,e.target.value)}
                        placeholder="∞"
                        style={{
                          width:50, padding:'4px 6px', textAlign:'center',
                          border:`1px solid ${oos?'#fca5a5':v?'#86efac':'#d0e6f5'}`,
                          borderRadius:6, fontSize:'0.78rem', outline:'none',
                          background:oos?'#fff1f2':v?'#f0fdf4':'#fff',
                          color:oos?'#ef4444':'#1a1a2e', fontFamily:'inherit',
                        }} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize:'0.7rem', color:'#9badb8', marginTop:6 }}>
          🔴 Red = out of stock (shows "Out of Stock" badge on product page) · Green = in stock · Blank = unlimited
        </p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════
   Focus-aware input helper
══════════════════════════════════════════ */
const FocusInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement> & { style?: React.CSSProperties }>(
  ({ style, type='text', ...props }, ref) => {
    const [focused, setFocused] = useState(false);
    return (
      <input ref={ref} type={type} {...props}
        style={{ ...style, borderColor: focused?'#2B9FD8':'#d0e6f5' }}
        onFocus={e=>{setFocused(true);props.onFocus?.(e);}}
        onBlur={e=>{setFocused(false);props.onBlur?.(e);}} />
    );
  }
);
FocusInput.displayName = 'FocusInput';

/* ══════════════════════════════════════════
   PRODUCT MODAL
══════════════════════════════════════════ */
function ProductModal({ open, onClose, editing, draft, setDraft, onSubmit, saving }: {
  open:boolean; onClose:()=>void;
  editing:Product|null;
  draft:AdminProductPayload;
  setDraft:React.Dispatch<React.SetStateAction<AdminProductPayload>>;
  onSubmit:(e:FormEvent|React.MouseEvent)=>void;
  saving:boolean;
}) {
  const [sizeUnit, setSizeUnit] = useState<'uk'|'eu'>('uk');
  const firstRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (open) setTimeout(()=>firstRef.current?.focus(),80); }, [open]);
  useEffect(() => {
    const fn = (e:KeyboardEvent) => { if (e.key==='Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  if (!open) return null;

  const toggleSize = (s:string) =>
    setDraft(d => ({ ...d, sizes: d.sizes.includes(s)?d.sizes.filter(x=>x!==s):[...d.sizes,s] }));

  const setImg   = (url:string) => setDraft(d=>({...d,image:url}));
  const setColors = (cols:ProductColor[]) => setDraft(d=>({...d,colors:cols}));
  const setStock  = (st:Record<string,number>) => setDraft(d=>({...d,stock:st}));

  const S: Record<string,React.CSSProperties> = {
    backdrop: { position:'fixed',inset:0,background:'rgba(26,26,46,0.6)',backdropFilter:'blur(4px)',zIndex:1000,animation:'fadeIn 0.2s ease' },
    panel: { position:'fixed',top:0,right:0,bottom:0,width:'min(620px,100vw)',background:'#fff',zIndex:1001,display:'flex',flexDirection:'column',boxShadow:'-10px 0 50px rgba(43,159,216,0.15)',animation:'slideIn 0.28s cubic-bezier(0.4,0,0.2,1)' },
    header: { padding:'18px 24px',borderBottom:'1px solid #d0e6f5',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 },
    body: { flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:16 },
    footer: { padding:'14px 24px',borderTop:'1px solid #d0e6f5',display:'flex',gap:10,flexShrink:0,background:'#fff' },
    grid2: { display:'grid',gridTemplateColumns:'1fr 1fr',gap:14 },
  };

  return (
    <>
      <div style={S.backdrop} onClick={onClose} />
      <div style={S.panel}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={{ fontFamily:'var(--font-display)',fontSize:'1.1rem',fontWeight:800,margin:0 }}>
              {editing ? `Edit Product #${editing.id}` : 'Add New Product'}
            </h2>
            {editing && <p style={{ fontSize:'0.74rem',color:'#9badb8',margin:'2px 0 0' }}>{editing.name}</p>}
          </div>
          <button type="button" onClick={onClose}
            style={{ width:34,height:34,borderRadius:'50%',border:'1.5px solid #d0e6f5',background:'#f4f8fb',cursor:'pointer',fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center',color:'#5a6a7a',transition:'all 0.15s' }}
            onMouseEnter={e=>{e.currentTarget.style.background='#fee2e2';e.currentTarget.style.color='#ef4444';}}
            onMouseLeave={e=>{e.currentTarget.style.background='#f4f8fb';e.currentTarget.style.color='#5a6a7a';}}>
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={S.body}>

          {/* ── BASIC INFO ── */}
          <div style={S.grid2}>
            <label style={{ ...fieldLabel, gridColumn:'1/-1' }}>
              Product Name *
              <FocusInput ref={firstRef} placeholder="e.g. Nike Air Max 90"
                value={draft.name} required onChange={e=>setDraft(d=>({...d,name:e.target.value}))} style={inp()} />
            </label>
            <label style={fieldLabel}>
              Brand *
              <FocusInput placeholder="e.g. Nike" value={draft.brand} required
                onChange={e=>setDraft(d=>({...d,brand:e.target.value}))} style={inp()} />
            </label>
            <label style={fieldLabel}>
              Tag
              <select style={{ ...inp(),cursor:'pointer' }} value={draft.tag||''}
                onChange={e=>setDraft(d=>({...d,tag:e.target.value}))}>
                <option value="">— None —</option>
                {TAG_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}
              </select>
            </label>
            <label style={fieldLabel}>
              Sale Price (₹) * <span style={{ color:'#9badb8',fontWeight:400,fontSize:'0.7rem'}}>— ACTUAL SELLING PRICE</span>
              <FocusInput type="number" placeholder="2799" value={draft.price||''}
                onChange={e=>setDraft(d=>({...d,price:Number(e.target.value)}))} style={inp()} />
            </label>
            <label style={fieldLabel}>
              Original MRP (₹) <span style={{ color:'#9badb8',fontWeight:400,fontSize:'0.7rem'}}>— CROSSED-OUT PRICE</span>
              <FocusInput type="number" placeholder="Leave blank for no offer" value={draft.original_price||''}
                onChange={e=>setDraft(d=>({...d,original_price:Number(e.target.value)}))} style={inp()} />
              {draft.original_price && Number(draft.original_price)>0 && Number(draft.original_price)<draft.price && (
                <span style={{ fontSize:'0.7rem',color:'#ef4444' }}>⚠ Must be higher than sale price</span>
              )}
            </label>
            <label style={{ ...fieldLabel, gridColumn:'1/-1' }}>
              Category
              <select style={{ ...inp(),cursor:'pointer' }} value={draft.category||''}
                onChange={e=>setDraft(d=>({...d,category:e.target.value}))}>
                <option value="">— None —</option>
                {CAT_OPTIONS.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          {/* ── IMAGE UPLOAD ── */}
          <div>
            <p style={sectionHead}>🖼 Product Image</p>
            <ImageUploader value={draft.image} onChange={setImg} />
          </div>

          {/* ── SIZES ── */}
          <div>
            <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:10 }}>
              <p style={{ ...sectionHead, margin:0 }}>📐 Sizes Available</p>
              <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                <span style={{ fontSize:'0.72rem',color:'#9badb8',fontWeight:600 }}>Display unit:</span>
                {(['uk','eu'] as const).map(u=>(
                  <button key={u} type="button"
                    onClick={()=>setSizeUnit(u)}
                    style={{
                      padding:'4px 12px',borderRadius:20,border:`1.5px solid ${sizeUnit===u?'#2B9FD8':'#d0e6f5'}`,
                      background:sizeUnit===u?'#2B9FD8':'#fff',color:sizeUnit===u?'#fff':'#5a6a7a',
                      cursor:'pointer',fontSize:'0.72rem',fontWeight:700,fontFamily:'inherit',
                    }}>
                    {u.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:7 }}>
              {UK_SIZES.map(s => {
                const active = draft.sizes.includes(s);
                return (
                  <button key={s} type="button" onClick={()=>toggleSize(s)}
                    style={{
                      padding:'6px 12px',borderRadius:8,fontSize:'0.8rem',fontWeight:600,
                      border:`1.5px solid ${active?'#2B9FD8':'#d0e6f5'}`,
                      background:active?'#2B9FD8':'#f4f8fb',
                      color:active?'#fff':'#5a6a7a',cursor:'pointer',transition:'all 0.15s',
                    }}>
                    {displaySize(s,sizeUnit)}
                  </button>
                );
              })}
            </div>
            {draft.sizes.length > 0 && (
              <p style={{ fontSize:'0.72rem',color:'#9badb8',marginTop:8 }}>
                Selected: {draft.sizes.map(s=>displaySize(s,sizeUnit)).join(' · ')}
              </p>
            )}
          </div>

          {/* ── COLOR VARIANTS ── */}
          <div>
            <p style={sectionHead}>
              🎨 Color Variants
              <span style={{ fontWeight:400,textTransform:'none',letterSpacing:0,fontSize:'0.7rem',color:'#9badb8' }}>
                (optional — each can have its own price + image)
              </span>
            </p>
            <ColorVariantEditor colors={draft.colors||[]} onChange={setColors} />
          </div>

          {/* ── SPECS ── */}
          <div>
            <div style={{ display:'flex',alignItems:'baseline',justifyContent:'space-between' }}>
              <p style={{ ...sectionHead, margin:'0 0 8px' }}>📋 Product Specifications</p>
              <span style={{ fontSize:'0.68rem',color:'#9badb8' }}>One "Key: Value" per line · e.g. "Material: Leather"</span>
            </div>
            <textarea
              placeholder={'Material: Full-grain leather\nSole: Rubber\nClosure: Lace-up\nWeight: 320g'}
              value={draft.specs||''}
              onChange={e=>setDraft(d=>({...d,specs:e.target.value}))}
              style={{ ...inp(),minHeight:90,resize:'vertical',lineHeight:1.7 }}
            />
          </div>

          {/* ── INVENTORY ── */}
          <div>
            <p style={sectionHead}>
              📦 Inventory
              <span style={{ fontWeight:400,textTransform:'none',letterSpacing:0,fontSize:'0.7rem',color:'#9badb8' }}>
                (stock per colour × size — leave blank = unlimited)
              </span>
            </p>
            {editing ? (
              <InventoryGrid
                sizes={draft.sizes} colors={draft.colors||[]}
                stock={draft.stock||{}} onChange={setStock} />
            ) : (
              <div style={{ background:'#fffbeb',border:'1px solid #fcd34d',borderRadius:8,padding:'10px 14px',fontSize:'0.8rem',color:'#92400e' }}>
                💡 Save sizes & colours first, then reopen to manage stock.
              </div>
            )}
          </div>

        </div>{/* end body */}

        {/* Footer */}
        <div style={S.footer}>
          <button type="button" onClick={onClose}
            style={{ flex:1,padding:'11px',border:'1.5px solid #d0e6f5',borderRadius:10,background:'#fff',color:'#5a6a7a',fontWeight:600,cursor:'pointer',fontFamily:'inherit',fontSize:'0.9rem',transition:'background 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.background='#f4f8fb'}
            onMouseLeave={e=>e.currentTarget.style.background='#fff'}>
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={onSubmit}
            style={{
              flex:2,padding:'11px',border:'none',borderRadius:10,
              background:saving?'#9badb8':'linear-gradient(135deg,#2B9FD8,#1a7ab0)',
              color:'#fff',fontWeight:700,cursor:saving?'not-allowed':'pointer',
              fontFamily:'inherit',fontSize:'0.9rem',
              display:'flex',alignItems:'center',justifyContent:'center',gap:8,
            }}>
            {saving
              ? <><SpinIcon/>Saving…</>
              : editing ? '✓ Update Product' : '+ Create Product'}
          </button>
        </div>

      </div>{/* end panel */}

      <style>{`
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        @keyframes slideIn{from{transform:translateX(100%)}to{transform:translateX(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>
    </>
  );
}

function SpinIcon() {
  return <div style={{ width:15,height:15,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'#fff',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>;
}

/* ══════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════ */
export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [query, setQuery]       = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [editing, setEditing]   = useState<Product|null>(null);
  const [draft, setDraft]       = useState<AdminProductPayload>(emptyDraft());
  const [saving, setSaving]     = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [toast, setToast]       = useState('');
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetchAdminProducts().then(p=>{setProducts(p);setLoading(false);}).catch(()=>setLoading(false));
  }, []);

  const brands = useMemo(()=>[...new Set(products.map(p=>p.brand))].sort(),[products]);

  const visible = useMemo(()=>
    products.filter(p=>{
      const matchQ = p.name.toLowerCase().includes(query.toLowerCase())||p.brand.toLowerCase().includes(query.toLowerCase());
      const matchB = !brandFilter || p.brand===brandFilter;
      return matchQ && matchB;
    }), [products, query, brandFilter]);

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(''),3000); };

  const openCreate = () => { setEditing(null); setDraft(emptyDraft()); setModalOpen(true); };
  const openEdit   = (p:Product) => {
    setEditing(p);
    setDraft({ name:p.name, brand:p.brand, price:p.price, original_price:p.original_price||0,
      image:p.image, tag:p.tag||'', category:p.category||'',
      sizes:p.sizes||[], colors:p.colors||[], specs:p.specs||'', stock:p.stock||{} });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setTimeout(()=>{setEditing(null);setDraft(emptyDraft());},250); };

  const submit = async (e:FormEvent|React.MouseEvent) => {
    e.preventDefault();
    if (!draft.name||!draft.brand||!draft.price) { showToast('⚠️ Name, brand and price are required'); return; }
    if (draft.original_price && draft.original_price < draft.price) { showToast('⚠️ MRP must be higher than sale price'); return; }
    // Sanitize all string fields before sending to backend
    const safeDraft = sanitizeProductPayload(draft as unknown as Record<string,unknown>) as unknown as AdminProductPayload;
    setSaving(true);
    try {
      if (editing) { await updateAdminProduct(editing.id, safeDraft); showToast(`✓ "${safeDraft.name}" updated`); }
      else          { await createAdminProduct(safeDraft);            showToast(`✓ "${safeDraft.name}" created`); }
      setProducts(await fetchAdminProducts());
      closeModal();
    } catch { showToast('✗ Save failed — check network / backend'); }
    finally  { setSaving(false); }
  };

  const remove = async (p:Product) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await deleteAdminProduct(p.id);
    setProducts(prev=>prev.filter(x=>x.id!==p.id));
    showToast(`🗑 "${p.name}" deleted`);
  };

  return (
    <>
      <section className="admin-panel">
        {/* Header */}
        <div className="admin-section-head">
          <h2>
            Products{' '}
            <span style={{ fontSize:'0.8rem',color:'#9badb8',fontWeight:400 }}>
              ({visible.length}{query||brandFilter?` of ${products.length}`:''})</span>
          </h2>
          <button type="button" className="admin-primary-btn" onClick={openCreate}
            style={{ display:'flex',alignItems:'center',gap:6 }}>
            <span style={{ fontSize:'1.1rem',lineHeight:1 }}>+</span> Add Product
          </button>
        </div>

        {/* Search + brand filter */}
        <div style={{ display:'flex',gap:10,marginBottom:16 }}>
          <input className="admin-search" style={{ margin:0,flex:1 }}
            placeholder="🔍  Search by name or brand…"
            value={query} onChange={e=>setQuery(e.target.value)} />
          <select value={brandFilter} onChange={e=>setBrandFilter(e.target.value)}
            style={{ padding:'9px 12px',border:'1px solid #d0e6f5',borderRadius:8,fontSize:'0.86rem',background:'#f4f8fb',color:'#1a1a2e',cursor:'pointer',minWidth:130 }}>
            <option value="">All Brands</option>
            {brands.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12 }}>
            {Array(8).fill(0).map((_,i)=>(
              <div key={i} style={{ background:'#eaf3fa',borderRadius:12,height:260,animation:'pulse 1.5s ease-in-out infinite' }}/>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign:'center',padding:'48px 20px',color:'#9badb8' }}>
            <div style={{ fontSize:'2.5rem',marginBottom:10 }}>👟</div>
            {products.length===0
              ? <><p style={{ fontWeight:600,marginBottom:12 }}>No products yet</p>
                  <button className="admin-primary-btn" onClick={openCreate}>+ Add your first product</button></>
              : <><p>No products match your filter</p>
                  <button onClick={()=>{setQuery('');setBrandFilter('');}} style={{ marginTop:8,background:'none',border:'1px solid #d0e6f5',borderRadius:6,padding:'5px 14px',color:'#2B9FD8',cursor:'pointer',fontSize:'0.82rem' }}>
                    Clear filters</button></>}
          </div>
        ) : (
          <div className="admin-product-grid">
            {visible.map(p=>(
              <article key={p.id} className="admin-product-card" style={{ position:'relative' }}>
                {p.tag && (
                  <div style={{ position:'absolute',top:8,left:8,zIndex:2,background:'#2B9FD8',color:'#fff',fontSize:'0.58rem',fontWeight:800,padding:'2px 7px',borderRadius:20,letterSpacing:'0.5px',textTransform:'uppercase' }}>
                    {p.tag}
                  </div>
                )}
                {p.out_of_stock && (
                  <div style={{ position:'absolute',top:8,right:8,zIndex:2,background:'#ef4444',color:'#fff',fontSize:'0.58rem',fontWeight:800,padding:'2px 7px',borderRadius:20,letterSpacing:'0.5px',textTransform:'uppercase' }}>
                    OOS
                  </div>
                )}
                <img src={p.image} alt={p.name}
                  style={{ transition:'transform 0.3s' }}
                  onError={e=>{(e.target as HTMLImageElement).src='https://placehold.co/200x130/eaf3fa/2B9FD8?text=👟';}} />
                <h3 title={p.name}>{p.name}</h3>
                <p>{p.brand}</p>
                <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
                  <strong style={{ color:'#2B9FD8' }}>₹{p.price.toLocaleString('en-IN')}</strong>
                  {p.original_price&&p.original_price>p.price&&(
                    <><span style={{ fontSize:'0.72rem',color:'#9badb8',textDecoration:'line-through' }}>₹{p.original_price.toLocaleString('en-IN')}</span>
                    <span style={{ fontSize:'0.62rem',fontWeight:800,background:'#fff0f0',color:'#e53e3e',padding:'1px 5px',borderRadius:10 }}>
                      {Math.round((p.original_price-p.price)/p.original_price*100)}% OFF
                    </span></>
                  )}
                </div>
                {p.sizes?.length>0&&<p style={{ fontSize:'0.68rem',color:'#9badb8',marginBottom:4 }}>{p.sizes.slice(0,4).join(' · ')}{p.sizes.length>4?'…':''}</p>}
                <div className="admin-card-actions">
                  <button type="button" onClick={()=>openEdit(p)}>✏️ Edit</button>
                  <button type="button" className="danger" onClick={()=>remove(p)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <ProductModal open={modalOpen} onClose={closeModal}
        editing={editing} draft={draft} setDraft={setDraft}
        onSubmit={submit} saving={saving} />

      {toast && (
        <div style={{ position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',background:'#1a1a2e',color:'#fff',padding:'11px 22px',borderRadius:30,fontSize:'0.88rem',fontWeight:600,boxShadow:'0 8px 24px rgba(0,0,0,0.2)',zIndex:9999,borderLeft:'3px solid #2B9FD8',whiteSpace:'nowrap',animation:'fadeIn 0.2s ease' }}>
          {toast}
        </div>
      )}

      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}
        @keyframes fadeIn{from{opacity:0}to{opacity:1}}
        .admin-product-card:hover img{transform:scale(1.04);}
      `}</style>
    </>
  );
}
