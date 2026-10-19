import { imageFallback, FALLBACK_IMAGE } from '@/utils/images';
import React, { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  createAdminProduct, deleteAdminProduct,
  fetchAdminProducts, updateAdminProduct,
} from '@/api/admin';
import type { Product, ProductColor, ProductSizeUnit } from '@/types';
import type { AdminProductPayload } from '@/types/admin';
import { getAdminAuthHeaders } from '@/lib/adminAuth';
import { requestJson } from '@/api';
import { sanitizeProductPayload } from '@/utils/validation';
import { cleanSizeLabel, normalizeSizeList, normalizeSizeUnit, SIZE_OPTIONS, SIZE_UNITS } from '@/utils/sizeUnits';

/* ─── Constants ─── */
const TAG_OPTIONS = ['trending','new','sale','luxury'];
const CAT_OPTIONS = ['boots','crocs','girls'];

const emptyDraft = (): AdminProductPayload => ({
  name:'', brand:'', price:0, original_price:0,
  image:'', tag:'', category:'',
  size_unit:'UK',
  sizes:[], colors:[], specs:'', stock:{},
});

function normalizeStockKeys(stock: Record<string, number>, sizes: string[]): Record<string, number> {
  const next: Record<string, number> = {};
  const allowed = new Set(sizes.map(s => s.toLowerCase()));
  Object.entries(stock || {}).forEach(([key, value]) => {
    const qty = Math.max(0, Math.min(Number(value) || 0, 100000));
    if (!key.includes('|')) {
      next[key] = qty;
      return;
    }
    const [row, rawSize] = key.split('|');
    const size = cleanSizeLabel(rawSize);
    if (!size || (allowed.size > 0 && !allowed.has(size.toLowerCase()))) return;
    next[`${row || 'default'}|${size}`] = qty;
  });
  return next;
}

/* ─── shared input style ─── */
const inp = (focus=false): React.CSSProperties => ({
  width:'100%', padding:'9px 12px',
  border:`1px solid ${focus?'var(--primary)':'var(--border)'}`, borderRadius:8,
  fontSize:'0.86rem', fontFamily:'inherit', outline:'none',
  background:'var(--bg)', color:'var(--text)',
});
const fieldLabel: React.CSSProperties = {
  display:'flex', flexDirection:'column', gap:5,
  fontSize:'0.78rem', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px',
};
const sectionHead: React.CSSProperties = {
  fontSize:'0.72rem', fontWeight:800, color:'var(--text-muted)',
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
  const [progress, setProgress] = useState('');
  const [err, setErr] = useState('');

  /** Compress image client-side to ≤200KB using canvas + WebP */
  const compress = (file: File): Promise<Blob> => new Promise((resolve, reject) => {
    const MAX_KB  = 190;   // target < 200KB
    const MAX_DIM = 800;   // max width or height in pixels

    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      // Scale down if larger than MAX_DIM
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height);
        width  = Math.round(width  * ratio);
        height = Math.round(height * ratio);
      }
      const canvas = document.createElement('canvas');
      canvas.width  = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, width, height);

      // Try WebP first, reduce quality until ≤ MAX_KB
      let quality = 0.85;
      const tryEncode = () => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Canvas toBlob failed')); return; }
          if (blob.size <= MAX_KB * 1024 || quality <= 0.30) {
            resolve(blob);
          } else {
            quality -= 0.10;
            tryEncode();
          }
        }, 'image/webp', quality);
      };
      tryEncode();
    };
    img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('Could not load image')); };
    img.src = objectUrl;
  });

  const upload = async (file: File) => {
    if (!['image/jpeg','image/png','image/webp'].includes(file.type)) {
      setErr('Only JPG, PNG or WEBP allowed (no GIF — use a still image)'); return;
    }
    setErr(''); setUploading(true);
    try {
      if (file.size > 10 * 1024 * 1024) {
        setErr('File too large (max 10MB raw). Use a smaller image.'); setUploading(false); return;
      }
      setProgress('Compressing…');
      const blob = await compress(file);
      const sizeKB = Math.round(blob.size / 1024);
      setProgress(`Uploading ${sizeKB}KB…`);

      const fd = new FormData();
      fd.append('image', blob, 'product.webp');

      const data = await requestJson<{url: string}>('/api/x9k2/upload', {
        method: 'POST', body: fd, headers: await getAdminAuthHeaders(),
      }, 35_000);
      onChange(data.url || '');
      setProgress('');
    } catch (e: any) {
      setErr(e.message || 'Upload failed');
      setProgress('');
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
          border:`2px dashed ${dragging?'var(--primary)':'var(--border)'}`,
          borderRadius:12, padding:'20px 16px',
          background:dragging?'var(--surface-2)':'var(--bg)',
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
                background:'var(--danger)',color:'var(--on-primary)',border:'none',
                cursor:'pointer',fontSize:'0.7rem',fontWeight:800,lineHeight:1,
              }}>✕</button>
          </div>
        ) : uploading ? (
              progress ||
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, color:'var(--text-muted)' }}>
            <div style={{ width:28,height:28,border:'3px solid var(--border)',borderTopColor:'var(--primary)',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>
            <span style={{ fontSize:'0.82rem' }}>Uploading…</span>
          </div>
        ) : (
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:6, color:'var(--text-muted)' }}>
            <span style={{ fontSize:'2rem' }}>🖼️</span>
            <span style={{ fontSize:'0.82rem', fontWeight:600 }}>Click or drag to upload image</span>
            <span style={{ fontSize:'0.72rem' }}>JPG, PNG, WEBP · max 5MB</span>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/*" style={{ display:'none' }} onChange={onFileChange} />
      </div>

      {/* URL paste fallback */}
      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
        <div style={{ flex:1, height:1, background:'var(--border)' }}/>
        <span style={{ fontSize:'0.7rem', color:'var(--text-muted)', fontWeight:600 }}>OR PASTE URL</span>
        <div style={{ flex:1, height:1, background:'var(--border)' }}/>
      </div>
      <FocusInput
        placeholder="https://ik.imagekit.io/…"
        value={value.startsWith('data:') ? '' : value}
        onChange={e => onChange(e.target.value)}
        style={inp()}
      />
      {progress && <p style={{ fontSize:'0.74rem', color:'var(--primary)', margin:0 }}>{progress}</p>}
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
          border:'1px solid var(--border)', borderRadius:10, padding:'12px 14px',
          background:'var(--bg)', display:'flex', flexDirection:'column', gap:8,
          borderLeft:`4px solid ${c.hex||'var(--border)'}`,
        }}>
          <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 1fr', gap:8, alignItems:'end' }}>
            {/* Hex picker */}
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <span style={{ ...fieldLabel, fontSize:'0.7rem' }}>Colour</span>
              <label style={{
                width:38, height:38, borderRadius:8, border:'1px solid var(--border)',
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
              <img src={c.image} alt="" style={{ width:40,height:40,borderRadius:6,objectFit:'contain',background:'var(--surface)',border:'1px solid var(--border)',flexShrink:0 }}
                onError={e=>{(e.target as HTMLImageElement).style.display='none';}} />
            )}
            <button type="button" onClick={()=>remove(i)}
              style={{ marginTop:20,padding:'6px 10px',background:'var(--danger-bg)',border:'1px solid #fca5a5',
                borderRadius:7,color:'var(--danger)',cursor:'pointer',fontSize:'0.78rem',fontWeight:700,flexShrink:0 }}>
              ✕ Remove
            </button>
          </div>
        </div>
      ))}
      <button type="button" onClick={add}
        style={{
          padding:'10px', border:'1.5px dashed var(--primary)', borderRadius:10,
          background:'transparent', color:'var(--primary)', cursor:'pointer',
          fontWeight:700, fontSize:'0.85rem', fontFamily:'inherit',
          transition:'background 0.15s',
        }}
        onMouseEnter={e=>e.currentTarget.style.background='var(--surface-2)'}
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
    return <p style={{ fontSize:'0.8rem', color:'var(--text-muted)', fontStyle:'italic' }}>Select sizes above to manage inventory.</p>;
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
        <span style={{ fontSize:'0.8rem', color:'var(--text-muted)', fontWeight:600 }}>Set all to same qty:</span>
        <FocusInput type="number" min="0" placeholder="e.g. 10"
          value={bulkVal} onChange={e=>setBulkVal(e.target.value)}
          style={{ ...inp(), width:90 }} />
        <button type="button" onClick={setAll}
          style={{ padding:'7px 14px',background:'var(--surface-2)',border:'1px solid var(--primary)',
            borderRadius:8,color:'var(--primary)',cursor:'pointer',fontWeight:700,fontSize:'0.8rem',
            fontFamily:'inherit',whiteSpace:'nowrap' }}>
          Apply
        </button>
        <span style={{ fontSize:'0.72rem', color:'var(--text-muted)' }}>· blank = unlimited</span>
      </div>

      {/* Grid */}
      <div style={{ overflowX:'auto' }}>
        <table style={{ borderCollapse:'collapse', width:'100%', fontSize:'0.78rem' }}>
          <thead>
            <tr>
              <th style={{ padding:'6px 10px', background:'var(--surface-2)', textAlign:'left',
                borderBottom:'1px solid var(--border)', borderRadius:'8px 0 0 0',
                color:'var(--text-muted)', fontWeight:700, minWidth:90 }}>
                {colors.length > 0 ? 'Colour' : '—'}
              </th>
              {sizes.map(s => (
                <th key={s} style={{ padding:'6px 10px', background:'var(--surface-2)',
                  borderBottom:'1px solid var(--border)', borderLeft:'1px solid var(--border)',
                  color:'var(--text-muted)', fontWeight:700, minWidth:58, textAlign:'center' }}>
                  {s.replace('UK ','')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row,ri) => (
              <tr key={row}>
                <td style={{ padding:'5px 10px', borderBottom:'1px solid var(--border)',
                  fontWeight:600, color:'var(--text)', background:ri%2===0?'var(--surface)':'var(--surface-2)' }}>
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
                    <td key={size} style={{ padding:'4px 6px', borderBottom:'1px solid var(--border)',
                      borderLeft:'1px solid var(--border)', textAlign:'center',
                      background:ri%2===0?'var(--surface)':'var(--surface-2)' }}>
                      <input type="number" min="0"
                        value={v} onChange={e=>set(row,size,e.target.value)}
                        placeholder="∞"
                        style={{
                          width:50, padding:'4px 6px', textAlign:'center',
                          border:`1px solid ${oos?'#fca5a5':v?'#86efac':'var(--border)'}`,
                          borderRadius:6, fontSize:'0.78rem', outline:'none',
                          background:oos?'var(--danger-bg)':v?'var(--success-bg)':'var(--surface)',
                          color:oos?'var(--danger)':'var(--text)', fontFamily:'inherit',
                        }} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p style={{ fontSize:'0.7rem', color:'var(--text-muted)', marginTop:6 }}>
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
        style={{ ...style, borderColor: focused?'var(--primary)':'var(--border)' }}
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
  const firstRef = useRef<HTMLInputElement>(null);
  const selectedSizeUnit = normalizeSizeUnit(draft.size_unit);
  const sizeOptions = SIZE_OPTIONS[selectedSizeUnit];

  useEffect(() => { if (open) setTimeout(()=>firstRef.current?.focus(),80); }, [open]);
  useEffect(() => {
    const fn = (e:KeyboardEvent) => { if (e.key==='Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  if (!open) return null;

  const setSizeUnit = (unit: ProductSizeUnit) =>
    setDraft(d => {
      const current = normalizeSizeUnit(d.size_unit);
      if (current === unit) return { ...d, size_unit: unit };
      return { ...d, size_unit: unit, sizes: [], stock: {} };
    });

  const toggleSize = (s:string) =>
    setDraft(d => ({ ...d, sizes: d.sizes.includes(s)?d.sizes.filter(x=>x!==s):[...d.sizes,s] }));

  const setImg   = (url:string) => setDraft(d=>({...d,image:url}));
  const setColors = (cols:ProductColor[]) => setDraft(d=>({...d,colors:cols}));
  const setStock  = (st:Record<string,number>) => setDraft(d=>({...d,stock:st}));

  const S: Record<string,React.CSSProperties> = {
    backdrop: { position:'fixed',inset:0,background:'rgba(26,26,46,0.6)',backdropFilter:'blur(4px)',zIndex:1000,animation:'fadeIn 0.2s ease' },
    panel: { position:'fixed',top:0,right:0,bottom:0,width:'min(620px,100vw)',background:'var(--surface)',zIndex:1001,display:'flex',flexDirection:'column',boxShadow:'-10px 0 50px rgba(43,159,216,0.15)',animation:'slideIn 0.28s cubic-bezier(0.4,0,0.2,1)' },
    header: { padding:'18px 24px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 },
    body: { flex:1,overflowY:'auto',padding:'20px 24px',display:'flex',flexDirection:'column',gap:16 },
    footer: { padding:'14px 24px',borderTop:'1px solid var(--border)',display:'flex',gap:10,flexShrink:0,background:'var(--surface)' },
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
            {editing && <p style={{ fontSize:'0.74rem',color:'var(--text-muted)',margin:'2px 0 0' }}>{editing.name}</p>}
          </div>
          <button type="button" onClick={onClose}
            style={{ width:34,height:34,borderRadius:'50%',border:'1.5px solid var(--border)',background:'var(--bg)',cursor:'pointer',fontSize:'1rem',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text-muted)',transition:'all 0.15s' }}
            onMouseEnter={e=>{e.currentTarget.style.background='var(--danger-bg)';e.currentTarget.style.color='var(--danger)';}}
            onMouseLeave={e=>{e.currentTarget.style.background='var(--bg)';e.currentTarget.style.color='var(--text-muted)';}}>
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
              Sale Price (₹) * <span style={{ color:'var(--text-muted)',fontWeight:400,fontSize:'0.7rem'}}>— ACTUAL SELLING PRICE</span>
              <FocusInput type="number" placeholder="2799" value={draft.price||''}
                onChange={e=>setDraft(d=>({...d,price:Number(e.target.value)}))} style={inp()} />
            </label>
            <label style={fieldLabel}>
              Original MRP (₹) <span style={{ color:'var(--text-muted)',fontWeight:400,fontSize:'0.7rem'}}>— CROSSED-OUT PRICE</span>
              <FocusInput type="number" placeholder="Leave blank for no offer" value={draft.original_price||''}
                onChange={e=>setDraft(d=>({...d,original_price:Number(e.target.value)}))} style={inp()} />
              {draft.original_price && Number(draft.original_price)>0 && Number(draft.original_price)<draft.price && (
                <span style={{ fontSize:'0.7rem',color:'var(--danger)' }}>⚠ Must be higher than sale price</span>
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
              <label style={{ display:'flex',alignItems:'center',gap:6,fontSize:'0.72rem',color:'var(--text-muted)',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px' }}>
                Size Unit *
                <select
                  value={selectedSizeUnit}
                  onChange={e=>setSizeUnit(e.target.value as ProductSizeUnit)}
                  style={{ ...inp(),width:88,padding:'5px 10px',cursor:'pointer',fontWeight:800 }}
                >
                  {SIZE_UNITS.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              </label>
            </div>
            <div style={{ display:'flex',flexWrap:'wrap',gap:7 }}>
              {sizeOptions.map(s => {
                const active = draft.sizes.includes(s);
                return (
                  <button key={s} type="button" onClick={()=>toggleSize(s)}
                    style={{
                      padding:'6px 12px',borderRadius:8,fontSize:'0.8rem',fontWeight:600,
                      border:`1.5px solid ${active?'var(--primary)':'var(--border)'}`,
                      background:active?'var(--primary)':'var(--bg)',
                      color:active?'var(--on-primary)':'var(--text-muted)',cursor:'pointer',transition:'all 0.15s',
                    }}>
                    {s}
                  </button>
                );
              })}
            </div>
            {draft.sizes.length > 0 && (
              <p style={{ fontSize:'0.72rem',color:'var(--text-muted)',marginTop:8 }}>
                Selected {selectedSizeUnit}: {draft.sizes.join(' | ')}
              </p>
            )}
          </div>

          {/* ── COLOR VARIANTS ── */}
          <div>
            <p style={sectionHead}>
              🎨 Color Variants
              <span style={{ fontWeight:400,textTransform:'none',letterSpacing:0,fontSize:'0.7rem',color:'var(--text-muted)' }}>
                (optional — each can have its own price + image)
              </span>
            </p>
            <ColorVariantEditor colors={draft.colors||[]} onChange={setColors} />
          </div>

          {/* ── SPECS ── */}
          <div>
            <div style={{ display:'flex',alignItems:'baseline',justifyContent:'space-between' }}>
              <p style={{ ...sectionHead, margin:'0 0 8px' }}>📋 Product Specifications</p>
              <span style={{ fontSize:'0.68rem',color:'var(--text-muted)' }}>One "Key: Value" per line · e.g. "Material: Leather"</span>
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
              <span style={{ fontWeight:400,textTransform:'none',letterSpacing:0,fontSize:'0.7rem',color:'var(--text-muted)' }}>
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
            style={{ flex:1,padding:'11px',border:'1.5px solid var(--border)',borderRadius:10,background:'var(--surface)',color:'var(--text-muted)',fontWeight:600,cursor:'pointer',fontFamily:'inherit',fontSize:'0.9rem',transition:'background 0.15s' }}
            onMouseEnter={e=>e.currentTarget.style.background='var(--bg)'}
            onMouseLeave={e=>e.currentTarget.style.background='var(--surface)'}>
            Cancel
          </button>
          <button type="button" disabled={saving} onClick={onSubmit}
            style={{
              flex:2,padding:'11px',border:'none',borderRadius:10,
              background:saving?'var(--text-muted)':'var(--primary)',
              color:'var(--on-primary)',fontWeight:700,cursor:saving?'not-allowed':'pointer',
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
  return <div style={{ width:15,height:15,border:'2px solid rgba(255,255,255,0.4)',borderTopColor:'var(--on-primary)',borderRadius:'50%',animation:'spin 0.8s linear infinite' }}/>;
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

  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const generation = useRef(0);
  const reload = async () => {
    const page = await fetchAdminProducts(null, query, brandFilter);
    setProducts(page.items); setNextCursor(page.nextCursor);
  };
  useEffect(() => {
    const request = ++generation.current;
    setLoading(true); setLoadError('');
    const timer = setTimeout(() => fetchAdminProducts(null, query, brandFilter).then(page => {
      if (request === generation.current) { setProducts(page.items); setNextCursor(page.nextCursor); }
    }).catch(() => { if (request === generation.current) setLoadError('Could not load products. Please try again.'); })
      .finally(() => { if (request === generation.current) setLoading(false); }), 250);
    return () => { clearTimeout(timer); generation.current++; };
  }, [query, brandFilter, retry]);
  const loadMore = async () => {
    if (!nextCursor || loading) return;
    const request = generation.current;
    setLoading(true); setLoadError('');
    try {
      const page = await fetchAdminProducts(nextCursor, query, brandFilter);
      if (request === generation.current) { setProducts(prev => [...prev, ...page.items]); setNextCursor(page.nextCursor); }
    } catch { setLoadError('Could not load more products. Please try again.'); }
    finally { if (request === generation.current) setLoading(false); }
  };

  const brands = useMemo(()=>[...new Set(products.map(p=>p.brand))].sort(),[products]);

  const visible = products;

  const showToast = (msg:string) => { setToast(msg); setTimeout(()=>setToast(''),3000); };

  const openCreate = () => { setEditing(null); setDraft(emptyDraft()); setModalOpen(true); };
  const openEdit   = (p:Product) => {
    setEditing(p);
    // Parse JSON string fields that may come from older cache/API
    const parseFld = <T,>(v: unknown, fb: T): T => {
      if (Array.isArray(v) || (typeof v === 'object' && v !== null)) return v as T;
      if (typeof v === 'string') { try { return JSON.parse(v) as T; } catch {} }
      return fb;
    };
    const sizes = normalizeSizeList(parseFld<string[]>(p.sizes, []));
    setDraft({ name:p.name, brand:p.brand, price:p.price, original_price:p.original_price||0,
      image:p.image, tag:p.tag||'', category:p.category||'',
      size_unit: normalizeSizeUnit(p.size_unit),
      sizes,
      colors: parseFld<any[]>(p.colors, []),
      specs:  p.specs||'',
      stock:  normalizeStockKeys(parseFld<Record<string,number>>(p.stock, {}), sizes) });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setTimeout(()=>{setEditing(null);setDraft(emptyDraft());},250); };

  const submit = async (e:FormEvent|React.MouseEvent) => {
    e.preventDefault();
    if (!draft.name||!draft.brand||!draft.price) { showToast('⚠️ Name, brand and price are required'); return; }
    if (draft.original_price && draft.original_price < draft.price) { showToast('⚠️ MRP must be higher than sale price'); return; }
    // Sanitize all string fields before sending to backend
    if (saving) return;
    setSaving(true);
    try {
      const safeDraft = sanitizeProductPayload(draft as unknown as Record<string,unknown>) as unknown as AdminProductPayload;
      if (editing) { await updateAdminProduct(editing.id, safeDraft); showToast(`✓ "${safeDraft.name}" updated`); }
      else          { await createAdminProduct(safeDraft);            showToast(`✓ "${safeDraft.name}" created`); }
      await reload();
      closeModal();
    } catch (error) { showToast(error instanceof Error ? error.message : 'Save failed'); }
    finally  { setSaving(false); }
  };

  const remove = async (p:Product) => {
    if (!window.confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    try {
      await deleteAdminProduct(p.id);
      setProducts(prev=>prev.filter(x=>x.id!==p.id));
      showToast(`Deleted ${p.name}`);
    } catch (error) { showToast(error instanceof Error ? error.message : 'Delete failed'); }
  };

  return (
    <>
      <section className="admin-panel">
        {/* Header */}
        <div className="admin-section-head">
          <h2>
            Products{' '}
            <span style={{ fontSize:'0.8rem',color:'var(--text-muted)',fontWeight:400 }}>
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
            style={{ padding:'9px 12px',border:'1px solid var(--border)',borderRadius:8,fontSize:'0.86rem',background:'var(--bg)',color:'var(--text)',cursor:'pointer',minWidth:130 }}>
            <option value="">All Brands</option>
            {brands.map(b=><option key={b} value={b}>{b}</option>)}
          </select>
        </div>

        {/* Grid */}
        {loading ? (
          <div style={{ display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:12 }}>
            {Array(8).fill(0).map((_,i)=>(
              <div key={i} style={{ background:'var(--surface-2)',borderRadius:12,height:260,animation:'pulse 1.5s ease-in-out infinite' }}/>
            ))}
          </div>
        ) : visible.length === 0 ? (
          <div style={{ textAlign:'center',padding:'48px 20px',color:'var(--text-muted)' }}>
            <div style={{ fontSize:'2.5rem',marginBottom:10 }}>👟</div>
            {products.length===0
              ? <><p style={{ fontWeight:600,marginBottom:12 }}>No products yet</p>
                  <button className="admin-primary-btn" onClick={openCreate}>+ Add your first product</button></>
              : <><p>No products match your filter</p>
                  <button onClick={()=>{setQuery('');setBrandFilter('');}} style={{ marginTop:8,background:'none',border:'1px solid var(--border)',borderRadius:6,padding:'5px 14px',color:'var(--primary)',cursor:'pointer',fontSize:'0.82rem' }}>
                    Clear filters</button></>}
          </div>
        ) : (
          <div className="admin-product-grid">
            {visible.map(p=>(
              <article key={p.id} className="admin-product-card" style={{ position:'relative' }}>
                {p.tag && (
                  <div style={{ position:'absolute',top:8,left:8,zIndex:2,background:'var(--primary)',color:'var(--on-primary)',fontSize:'0.58rem',fontWeight:800,padding:'2px 7px',borderRadius:20,letterSpacing:'0.5px',textTransform:'uppercase' }}>
                    {p.tag}
                  </div>
                )}
                {p.out_of_stock && (
                  <div style={{ position:'absolute',top:8,right:8,zIndex:2,background:'var(--danger)',color:'var(--on-primary)',fontSize:'0.58rem',fontWeight:800,padding:'2px 7px',borderRadius:20,letterSpacing:'0.5px',textTransform:'uppercase' }}>
                    OOS
                  </div>
                )}
                <img src={p.image} alt={p.name}
                  style={{ transition:'transform 0.3s' }}
                  onError={imageFallback} />
                <h3 title={p.name}>{p.name}</h3>
                <p>{p.brand}</p>
                <div style={{ display:'flex',alignItems:'center',gap:6,marginBottom:2 }}>
                  <strong style={{ color:'var(--primary)' }}>₹{p.price.toLocaleString('en-IN')}</strong>
                  {p.original_price&&p.original_price>p.price&&(
                    <><span style={{ fontSize:'0.72rem',color:'var(--text-muted)',textDecoration:'line-through' }}>₹{p.original_price.toLocaleString('en-IN')}</span>
                    <span style={{ fontSize:'0.62rem',fontWeight:800,background:'#fff0f0',color:'var(--danger)',padding:'1px 5px',borderRadius:10 }}>
                      {Math.round((p.original_price-p.price)/p.original_price*100)}% OFF
                    </span></>
                  )}
                </div>
                {Array.isArray(p.sizes)&&p.sizes.length>0&&<p style={{ fontSize:'0.68rem',color:'var(--text-muted)',marginBottom:4 }}>{normalizeSizeUnit(p.size_unit)} {normalizeSizeList(p.sizes).slice(0,4).join(' | ')}{p.sizes.length>4?'...':''}</p>}
                <div className="admin-card-actions">
                  <button type="button" onClick={()=>openEdit(p)}>✏️ Edit</button>
                  <button type="button" className="danger" onClick={()=>remove(p)}>Delete</button>
                </div>
              </article>
            ))}
          </div>
        )}
        {loadError && <div role="alert">{loadError} <button onClick={() => setRetry(n => n + 1)}>Try again</button></div>}
        {nextCursor && <button className="admin-primary-btn" disabled={loading} onClick={loadMore}>{loading ? 'Loading…' : 'Load more products'}</button>}
      </section>

      <ProductModal open={modalOpen} onClose={closeModal}
        editing={editing} draft={draft} setDraft={setDraft}
        onSubmit={submit} saving={saving} />

      {toast && (
        <div style={{ position:'fixed',bottom:28,left:'50%',transform:'translateX(-50%)',background:'var(--text)',color:'var(--on-primary)',padding:'11px 22px',borderRadius:30,fontSize:'0.88rem',fontWeight:600,boxShadow:'0 8px 24px rgba(0,0,0,0.2)',zIndex:9999,borderLeft:'3px solid var(--primary)',whiteSpace:'nowrap',animation:'fadeIn 0.2s ease' }}>
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
