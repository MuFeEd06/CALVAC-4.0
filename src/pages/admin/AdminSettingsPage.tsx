import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { fetchAdminOffer, fetchAdminSettings, saveAdminOffer, saveAdminSettings } from '@/api/admin';
import { BRANDS } from '@/utils';

/* ═══════════════════════════════════════════════════════
   TYPES
═══════════════════════════════════════════════════════ */
type S = Record<string, unknown>;
type ElementId = 'intro' | 'prompt' | 'left' | 'right' | 'image' | 'gradient' | 'offer' | 'skip' | 'star';
type OfferState = { active: boolean; text: string; bg_color: string; text_color: string; show_logo?: boolean };
type Tab = 'hero' | 'mobile' | 'store' | 'announcement' | 'policies';

/* ═══════════════════════════════════════════════════════
   CONSTANTS
═══════════════════════════════════════════════════════ */
const ELEM_DEFS: {
  id: ElementId; label: string; emoji: string; color: string;
  visKey: string; type: 'intro' | 'overlay' | 'prompt' | 'fixed';
}[] = [
  { id:'intro',    label:'Intro Block',   emoji:'📝', color:'#3b82f6', visKey:'hero_intro_visible',         type:'intro'   },
  { id:'prompt',   label:'Scroll Prompt', emoji:'⬇️', color:'#8b5cf6', visKey:'hero_prompt_visible',        type:'prompt'  },
  { id:'left',     label:'Left Overlay',  emoji:'◀',  color:'#10b981', visKey:'hero_overlay_left_visible',  type:'overlay' },
  { id:'right',    label:'Right Overlay', emoji:'▶',  color:'#f59e0b', visKey:'hero_overlay_right_visible', type:'overlay' },
  { id:'image',    label:'Hero Image',    emoji:'🖼️', color:'#64748b', visKey:'hero_image_visible',         type:'fixed'   },
  { id:'gradient', label:'Gradient',      emoji:'🌊', color:'#2B9FD8', visKey:'hero_gradient_visible',      type:'fixed'   },
  { id:'offer',    label:'Offer Tag',     emoji:'🏷️', color:'#e53e3e', visKey:'hero_offer_visible',          type:'fixed'   },
  { id:'skip',     label:'Skip Button',   emoji:'⏭️', color:'#8b5cf6', visKey:'hero_skip_visible',           type:'fixed'   },
  { id:'star',     label:'Spin Star',     emoji:'✨', color:'#FF6B35', visKey:'hero_star_visible',           type:'fixed'   },
];

const CAT_SLUGS = ['boots','crocs','girls','sale','under1000','under1500','under2500','new','premium','all'];
const POLICY_KEYS = [
  { key:'policy_privacy',  label:'Privacy Policy'  },
  { key:'policy_return',   label:'Return Policy'   },
  { key:'policy_shipping', label:'Shipping Policy' },
] as const;

/* ═══════════════════════════════════════════════════════
   OPACITY MATH  (mirrors ScrollyShoeExperience.tsx)
═══════════════════════════════════════════════════════ */
const n = (v: unknown, fallback: number) => { const x = Number(v); return isFinite(x) ? x : fallback; };

function calcIntroOpacity(scroll: number, s: S) {
  const fs = n(s.hero_intro_fade_start, 0.16);
  const fe = n(s.hero_intro_fade_end,   0.30);
  if (scroll <= fs) return 1;
  if (scroll >= fe) return 0;
  return 1 - (scroll - fs) / (fe - fs);
}
function calcOverlayOpacity(scroll: number, s: S) {
  const is = n(s.hero_overlay_fade_in_start,  0.22);
  const ie = n(s.hero_overlay_fade_in_end,    0.36);
  const os = n(s.hero_overlay_fade_out_start, 0.86);
  const oe = n(s.hero_overlay_fade_out_end,   1.00);
  if (scroll < is) return 0;
  if (scroll < ie) return (scroll - is) / (ie - is);
  if (scroll < os) return 1;
  if (scroll < oe) return 1 - (scroll - os) / (oe - os);
  return 0;
}
function calcPromptOpacity(scroll: number) { return Math.max(0, 1 - scroll / 0.08); }

function getOpacity(id: ElementId, scroll: number, s: S): number {
  const def = ELEM_DEFS.find(e => e.id === id)!;
  if (s[def.visKey] === false) return 0;
  if (id === 'intro')  return calcIntroOpacity(scroll, s);
  if (id === 'prompt') return calcPromptOpacity(scroll);
  if (id === 'left' || id === 'right') return calcOverlayOpacity(scroll, s);
  return 1;
}

/* ═══════════════════════════════════════════════════════
   SMALL UI HELPERS
═══════════════════════════════════════════════════════ */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:5,
      fontSize:'0.7rem', fontWeight:800, color:'#9badb8',
      textTransform:'uppercase', letterSpacing:'0.6px' }}>
      {label}
      {children}
    </label>
  );
}

function TextInput({ value, onChange, placeholder, type='text', style }: {
  value: string|number; onChange:(v:string)=>void;
  placeholder?:string; type?:string; style?:React.CSSProperties;
}) {
  const [f, setF] = useState(false);
  return (
    <input type={type} value={value ?? ''} placeholder={placeholder}
      onChange={e=>onChange(e.target.value)}
      onFocus={()=>setF(true)} onBlur={()=>setF(false)}
      style={{
        width:'100%', padding:'8px 10px',
        border:`1px solid ${f?'#2B9FD8':'#d0e6f5'}`, borderRadius:7,
        fontSize:'0.84rem', fontFamily:'inherit',
        outline:'none', background:'#f4f8fb', color:'#1a1a2e',
        transition:'border-color 0.15s', ...style,
      }} />
  );
}

function ColourPick({ label, value, onChange }: { label:string; value:string; onChange:(v:string)=>void }) {
  return (
    <Field label={label}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 8px',
        border:'1px solid #d0e6f5', borderRadius:7, background:'#f4f8fb' }}>
        <label style={{ width:22, height:22, borderRadius:5, overflow:'hidden',
          border:'1px solid #d0e6f5', cursor:'pointer', flexShrink:0, display:'block' }}>
          <input type="color" value={value||'#000000'} onChange={e=>onChange(e.target.value)}
            style={{ width:'200%', height:'200%', marginLeft:'-50%', marginTop:'-50%', border:'none', cursor:'pointer' }} />
        </label>
        <span style={{ fontSize:'0.76rem', color:'#5a6a7a', fontFamily:'monospace' }}>{value}</span>
      </div>
    </Field>
  );
}

function SliderRow({ label, min, max, step, value, onChange }: {
  label:string; min:number; max:number; step:number; value:number; onChange:(v:number)=>void;
}) {
  return (
    <Field label={`${label}  ${value}`}>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e=>onChange(Number(e.target.value))}
        style={{ width:'100%', accentColor:'#2B9FD8' }} />
    </Field>
  );
}

/* ═══════════════════════════════════════════════════════
   HERO MINI PREVIEW
═══════════════════════════════════════════════════════ */
function HeroPreview({ settings, playhead, activeId }: {
  settings: S; playhead: number; activeId: ElementId;
}) {
  const txt = (k:string, fb:string) => typeof settings[k]==='string' && (settings[k] as string).trim() ? settings[k] as string : fb;
  const opac = (id: ElementId) => getOpacity(id, playhead, settings);
  const gradStr = n(settings.hero_gradient_strength, 1);
  const textCol = txt('hero_text_color','#2B9FD8');
  const subCol  = txt('hero_sub_color','#5a6a7a');
  const eyeCol  = txt('hero_overlay_color','#2B9FD8');

  return (
    <div style={{ position:'relative', borderRadius:12, overflow:'hidden',
      background:'#eaf3fa', border:'1px solid #d0e6f5', aspectRatio:'16/9' }}>

      {/* Gradient */}
      {settings.hero_gradient_visible !== false && (
        <div style={{ position:'absolute', inset:0, pointerEvents:'none',
          opacity: opac('gradient'),
          background:`radial-gradient(ellipse at 50% 0%, rgba(43,159,216,${0.18*gradStr}),transparent 60%), linear-gradient(125deg,rgba(43,159,216,${0.12*gradStr}) 0%,transparent 40%,rgba(43,159,216,${0.07*gradStr}) 100%)` }} />
      )}

      {/* Shoe image */}
      {settings.hero_image_visible !== false && (
        <img src="/frames/ffout001.gif" alt=""
          style={{ position:'absolute', left:'50%', top:'50%', transform:'translate(-50%,-50%)',
            width:'min(70%,280px)', objectFit:'contain', opacity:opac('image'), transition:'opacity 0.1s' }} />
      )}

      {/* Intro block */}
      {settings.hero_intro_visible !== false && (
        <div style={{ position:'absolute', left:'50%', top:'50%',
          transform:'translate(-50%,-50%)', textAlign:'center',
          opacity:opac('intro'), transition:'opacity 0.1s', width:'90%', zIndex:3,
          outline: activeId==='intro' ? '2px dashed #3b82f6' : 'none',
          borderRadius:6, padding:4 }}>
          <p style={{ fontSize:'0.55rem', fontWeight:700, letterSpacing:'0.2em',
            textTransform:'uppercase', color:eyeCol, marginBottom:4 }}>
            {txt('hero_eyebrow','Aether 01')}
          </p>
          <h2 style={{ fontSize:'clamp(0.9rem,3vw,1.4rem)', fontWeight:700,
            letterSpacing:'-0.03em', color:textCol, lineHeight:1.1 }}>
            {txt('hero_headline','Step Into')}{' '}
            {txt('hero_highlight','Premium')}{' '}
            {txt('hero_headline2','Comfort')}
          </h2>
          <p style={{ fontSize:'0.6rem', color:subCol, marginTop:4, lineHeight:1.5 }}>
            {txt('hero_sub','Precision-crafted components.')}
          </p>
        </div>
      )}

      {/* Left overlay */}
      {settings.hero_overlay_left_visible !== false && (
        <div style={{ position:'absolute', left:'6%', top:'18%', zIndex:4,
          opacity:opac('left'), transition:'opacity 0.1s', maxWidth:'28%',
          outline: activeId==='left' ? '2px dashed #10b981' : 'none', borderRadius:4, padding:2 }}>
          <p style={{ fontSize:'0.5rem', textTransform:'uppercase', letterSpacing:'0.18em', color:eyeCol }}>
            {txt('hero_overlay_left_label','Exploded Architecture')}
          </p>
          <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:textCol, lineHeight:1.1, marginTop:2 }}>
            {txt('hero_overlay_left_title','Step Into')}
          </h3>
        </div>
      )}

      {/* Right overlay */}
      {settings.hero_overlay_right_visible !== false && (
        <div style={{ position:'absolute', right:'6%', bottom:'16%', zIndex:4, textAlign:'right',
          opacity:opac('right'), transition:'opacity 0.1s', maxWidth:'28%',
          outline: activeId==='right' ? '2px dashed #f59e0b' : 'none', borderRadius:4, padding:2 }}>
          <p style={{ fontSize:'0.5rem', textTransform:'uppercase', letterSpacing:'0.18em', color:eyeCol }}>
            {txt('hero_overlay_right_label','Cushion + Structure')}
          </p>
          <h3 style={{ fontSize:'0.85rem', fontWeight:700, color:textCol, lineHeight:1.1, marginTop:2 }}>
            {txt('hero_overlay_right_title','Premium Comfort')}
          </h3>
        </div>
      )}

      {/* Prompt */}
      {settings.hero_prompt_visible !== false && (
        <div style={{ position:'absolute', bottom:'8%', left:'50%', transform:'translateX(-50%)',
          zIndex:4, textAlign:'center', opacity:opac('prompt'), transition:'opacity 0.1s',
          outline: activeId==='prompt' ? '2px dashed #8b5cf6' : 'none', borderRadius:4, padding:2 }}>
          <p style={{ fontSize:'0.42rem', textTransform:'uppercase', letterSpacing:'0.22em', color:'var(--primary)' }}>
            {txt('hero_prompt_text','Scroll to Explore')}
          </p>
        </div>
      )}

      {/* Offer tag preview */}
      {settings.hero_offer_visible !== false && (
        <div style={{
          position:'absolute',
          left:`${n(settings.hero_offer_x_pct,3)}%`,
          top:`${n(settings.hero_offer_y_pct,12)}%`,
          zIndex:8,
          width: Math.min(n(settings.hero_offer_width_px,160), 140),
          opacity: opac('intro'),
          outline: activeId==='offer' ? '2px dashed #e53e3e' : 'none',
          borderRadius:8,
        }}>
          <div style={{
            background:(settings.hero_offer_bg as string)||'#fff',
            border:`1px solid ${(settings.hero_offer_accent as string)||'#2B9FD8'}22`,
            borderRadius:8, padding:'8px 10px',
            boxShadow:'0 4px 12px rgba(0,0,0,0.10)',
          }}>
            <div style={{ background:(settings.hero_offer_accent as string)||'#2B9FD8', color:'#fff',
              fontSize:'0.45rem', fontWeight:800, padding:'1px 5px', borderRadius:3,
              letterSpacing:'0.06em', textTransform:'uppercase', display:'inline-block', marginBottom:4 }}>
              {(settings.hero_offer_tag as string)||'Featured Drop'}
            </div>
            <div style={{ fontSize:'0.6rem', fontWeight:700, color:(settings.hero_offer_text_color as string)||'#1a1a2e', lineHeight:1.2 }}>
              {(settings.hero_offer_title as string)||'New Arrivals'}
            </div>
            {(settings.hero_offer_price as string) && (
              <div style={{ display:'flex', alignItems:'center', gap:4, marginTop:4 }}>
                <span style={{ fontSize:'0.65rem', fontWeight:800, color:(settings.hero_offer_accent as string)||'#2B9FD8' }}>
                  {settings.hero_offer_price as string}
                </span>
                {(settings.hero_offer_discount as string) && (
                  <span style={{ fontSize:'0.5rem', fontWeight:800, background:'#fff0f0', color:'#e53e3e', padding:'1px 4px', borderRadius:3 }}>
                    {settings.hero_offer_discount as string}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Skip button preview */}
      {settings.hero_skip_visible !== false && (
        <div style={{
          position:'absolute',
          left:`${n(settings.hero_skip_x_pct,3)}%`,
          bottom:`${n(settings.hero_skip_y_px,32)*0.4}px`,
          zIndex:8,
          outline: activeId==='skip' ? '2px dashed #8b5cf6' : 'none',
          borderRadius:20,
        }}>
          <div style={{
            display:'inline-flex', alignItems:'center', gap:4,
            background:(settings.hero_skip_bg as string)||'rgba(43,159,216,0.12)',
            border:`1px solid ${(settings.hero_skip_color as string)||'#2B9FD8'}44`,
            borderRadius:20, padding:'4px 9px',
          }}>
            <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
              <path d="M2 3l4 3-4 3V3zM7 3h1.5v6H7V3z" fill={(settings.hero_skip_color as string)||'#2B9FD8'}/>
            </svg>
            <span style={{ fontSize:'0.45rem', fontWeight:700, color:(settings.hero_skip_color as string)||'#2B9FD8',
              letterSpacing:'0.06em', textTransform:'uppercase' }}>
              {(settings.hero_skip_text as string)||'Skip Animation'}
            </span>
          </div>
        </div>
      )}


      {/* Spinning star preview */}
      {settings.hero_star_visible !== false && (()=>{
        const sz = n(settings.hero_star_size,48)*0.55; // scale down for preview
        const r1=sz/2, r2=sz/8;
        const pts=Array.from({length:8},(_,i)=>{const a=(i*Math.PI)/4-Math.PI/2;const r=i%2===0?r1:r2;return `${r1+r*Math.cos(a)},${r1+r*Math.sin(a)}`;}).join(' ');
        return (
          <div style={{
            position:'absolute',
            left:`${n(settings.hero_star_x_pct,18)}%`,
            top:`${n(settings.hero_star_y_pct,55)}%`,
            transform:'translate(-50%,-50%)',
            zIndex:7, pointerEvents:'none',
            outline: activeId==='star' ? '2px dashed #FF6B35' : 'none',
            borderRadius:'50%',
          }}>
            <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}
              fill={(settings.hero_star_color as string)||'#FF6B35'}
              style={{ animation:`spin ${n(settings.hero_star_speed,8)}s linear infinite` }}>
              <polygon points={pts}/>
            </svg>
          </div>
        );
      })()}

      {/* Playhead % badge */}
      {/* Playhead % badge */}
      <div style={{ position:'absolute', top:8, right:8, background:'rgba(239,68,68,0.9)',
        color:'#fff', fontSize:'0.62rem', fontWeight:800, padding:'3px 8px', borderRadius:20 }}>
        {Math.round(playhead*100)}% scroll
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ELEMENT INSPECTOR  (right panel)
═══════════════════════════════════════════════════════ */
function Inspector({ activeId, settings, setField }: {
  activeId: ElementId; settings: S; setField:(k:string,v:unknown)=>void;
}) {
  const def = ELEM_DEFS.find(e=>e.id===activeId)!;
  const txt = (k:string) => (settings[k] as string)||'';
  const num = (k:string, fb:number) => n(settings[k], fb);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      {/* Element header */}
      <div style={{ display:'flex', alignItems:'center', gap:8, paddingBottom:10,
        borderBottom:'1px solid #eaf3fa' }}>
        <div style={{ width:32, height:32, borderRadius:8, background:`${def.color}18`,
          display:'flex', alignItems:'center', justifyContent:'center', fontSize:'1rem' }}>
          {def.emoji}
        </div>
        <div>
          <div style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:'0.9rem', color:'#1a1a2e' }}>
            {def.label}
          </div>
          <div style={{ fontSize:'0.7rem', color:'#9badb8' }}>Edit content & appearance</div>
        </div>
        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ fontSize:'0.7rem', color:'#9badb8', fontWeight:600 }}>Visible</span>
          <button
            onClick={()=>setField(def.visKey, settings[def.visKey]===false ? true : false)}
            style={{
              width:40, height:22, borderRadius:11,
              background: settings[def.visKey]===false ? '#d0e6f5' : def.color,
              border:'none', cursor:'pointer', position:'relative', transition:'background 0.2s',
            }}>
            <span style={{
              position:'absolute', top:3, width:16, height:16, borderRadius:'50%',
              background:'#fff', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
              left: settings[def.visKey]===false ? 3 : 21,
            }}/>
          </button>
        </div>
      </div>

      {/* INTRO BLOCK */}
      {activeId==='intro' && <>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Field label="Eyebrow text">
            <TextInput value={txt('hero_eyebrow')} placeholder="Aether 01"
              onChange={v=>setField('hero_eyebrow',v)} />
          </Field>
          <Field label="Headline line 1">
            <TextInput value={txt('hero_headline')} placeholder="Step Into"
              onChange={v=>setField('hero_headline',v)} />
          </Field>
          <Field label="Highlight word">
            <TextInput value={txt('hero_highlight')} placeholder="Premium"
              onChange={v=>setField('hero_highlight',v)} />
          </Field>
          <Field label="Headline line 2">
            <TextInput value={txt('hero_headline2')} placeholder="Comfort"
              onChange={v=>setField('hero_headline2',v)} />
          </Field>
          <Field label="Sub text" >
            <TextInput value={txt('hero_sub')} placeholder="Precision-crafted…"
              onChange={v=>setField('hero_sub',v)} style={{ gridColumn:'1/-1' }} />
          </Field>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          <ColourPick label="Text Colour"    value={txt('hero_text_color')||'#2B9FD8'}   onChange={v=>setField('hero_text_color',v)} />
          <ColourPick label="Subtext Colour" value={txt('hero_sub_color')||'#5a6a7a'}    onChange={v=>setField('hero_sub_color',v)} />
          <ColourPick label="Eyebrow Colour" value={txt('hero_overlay_color')||'#2B9FD8'}onChange={v=>setField('hero_overlay_color',v)} />
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <SliderRow label="Headline size (rem)" min={1.2} max={5} step={0.05}
            value={num('hero_intro_font_size_rem',2.25)} onChange={v=>setField('hero_intro_font_size_rem',v)} />
          <SliderRow label="Eyebrow size (px)" min={8} max={28} step={1}
            value={num('hero_eyebrow_size_px',12)} onChange={v=>setField('hero_eyebrow_size_px',v)} />
          <SliderRow label="Subtext size (rem)" min={0.7} max={1.6} step={0.05}
            value={num('hero_sub_size_rem',1)} onChange={v=>setField('hero_sub_size_rem',v)} />
          <SliderRow label="Block width (px)" min={400} max={1300} step={10}
            value={num('hero_intro_max_width_px',960)} onChange={v=>setField('hero_intro_max_width_px',v)} />
          <SliderRow label="Position X (%)" min={10} max={90} step={1}
            value={num('hero_intro_x_pct',50)} onChange={v=>setField('hero_intro_x_pct',v)} />
          <SliderRow label="Position Y (%)" min={15} max={85} step={1}
            value={num('hero_intro_y_pct',50)} onChange={v=>setField('hero_intro_y_pct',v)} />
        </div>
        <Field label="Alignment">
          <div style={{ display:'flex', gap:6 }}>
            {['left','center','right'].map(a=>(
              <button key={a} type="button"
                onClick={()=>setField('hero_intro_align',a)}
                style={{
                  flex:1, padding:'7px', border:`1.5px solid ${settings.hero_intro_align===a?'#2B9FD8':'#d0e6f5'}`,
                  borderRadius:8, background:settings.hero_intro_align===a?'#2B9FD8':'#f4f8fb',
                  color:settings.hero_intro_align===a?'#fff':'#5a6a7a',
                  cursor:'pointer', fontWeight:700, fontSize:'0.78rem', fontFamily:'inherit',
                }}>
                {a[0].toUpperCase()+a.slice(1)}
              </button>
            ))}
          </div>
        </Field>
      </>}

      {/* SCROLL PROMPT */}
      {activeId==='prompt' && <>
        <Field label="Prompt text">
          <TextInput value={txt('hero_prompt_text')} placeholder="Scroll to Explore"
            onChange={v=>setField('hero_prompt_text',v)} />
        </Field>
        <p style={{ fontSize:'0.72rem', color:'#9badb8', fontStyle:'italic' }}>
          The scroll prompt always fades out in the first 8% of scroll. Its timing is fixed.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <SliderRow label="Prompt size (px)" min={8} max={20} step={0.5}
            value={num('hero_prompt_size_px',10.4)} onChange={v=>setField('hero_prompt_size_px',v)} />
          <SliderRow label="Position X (%)" min={10} max={90} step={1}
            value={num('hero_prompt_x_pct',50)} onChange={v=>setField('hero_prompt_x_pct',v)} />
        </div>
      </>}

      {/* LEFT OVERLAY */}
      {activeId==='left' && <>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Field label="Label (small caps)">
            <TextInput value={txt('hero_overlay_left_label')} placeholder="Exploded Architecture"
              onChange={v=>setField('hero_overlay_left_label',v)} />
          </Field>
          <Field label="Title (large text)">
            <TextInput value={txt('hero_overlay_left_title')} placeholder="Step Into"
              onChange={v=>setField('hero_overlay_left_title',v)} />
          </Field>
          <SliderRow label="X from left (%)" min={0} max={45} step={1}
            value={num('hero_overlay_left_x',8)} onChange={v=>setField('hero_overlay_left_x',v)} />
          <SliderRow label="Y from top (%)" min={0} max={60} step={1}
            value={num('hero_overlay_left_y',20)} onChange={v=>setField('hero_overlay_left_y',v)} />
        </div>
        <ColourPick label="Label colour" value={txt('hero_overlay_color')||'#2B9FD8'} onChange={v=>setField('hero_overlay_color',v)} />
        <p style={{ fontSize:'0.72rem', color:'#9badb8', fontStyle:'italic' }}>
          Left & Right overlays share the same fade-in/out timing. Drag their tracks on the timeline.
        </p>
      </>}

      {/* RIGHT OVERLAY */}
      {activeId==='right' && <>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <Field label="Label (small caps)">
            <TextInput value={txt('hero_overlay_right_label')} placeholder="Cushion + Structure"
              onChange={v=>setField('hero_overlay_right_label',v)} />
          </Field>
          <Field label="Title (large text)">
            <TextInput value={txt('hero_overlay_right_title')} placeholder="Premium Comfort"
              onChange={v=>setField('hero_overlay_right_title',v)} />
          </Field>
          <SliderRow label="X from right (%)" min={0} max={45} step={1}
            value={num('hero_overlay_right_x',8)} onChange={v=>setField('hero_overlay_right_x',v)} />
          <SliderRow label="Y from bottom (%)" min={0} max={60} step={1}
            value={num('hero_overlay_right_y',16)} onChange={v=>setField('hero_overlay_right_y',v)} />
        </div>
        <p style={{ fontSize:'0.72rem', color:'#9badb8', fontStyle:'italic' }}>
          Left & Right overlays share the same fade-in/out timing. Drag their tracks on the timeline.
        </p>
      </>}

      {/* HERO IMAGE */}
      {activeId==='image' && <>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <SliderRow label="Image scale" min={0.95} max={1.1} step={0.001}
            value={num('hero_image_scale',1.008)} onChange={v=>setField('hero_image_scale',v)} />
          <SliderRow label="Scroll height (vh)" min={200} max={700} step={10}
            value={num('hero_scroll_height_vh',420)} onChange={v=>setField('hero_scroll_height_vh',v)} />
        </div>
        <p style={{ fontSize:'0.72rem', color:'#9badb8' }}>
          Scroll height controls how long the hero section is — more vh = slower scroll through the animation.
        </p>
      </>}

      {/* GRADIENT */}
      {activeId==='gradient' && <>
        <ColourPick label="Primary colour" value={txt('primary_color')||'#2B9FD8'} onChange={v=>setField('primary_color',v)} />
        <SliderRow label="Gradient strength" min={0} max={2} step={0.05}
          value={num('hero_gradient_strength',1)} onChange={v=>setField('hero_gradient_strength',v)} />
        <Field label="Hero font family">
          <TextInput value={txt('hero_font')||'default'} placeholder="default"
            onChange={v=>setField('hero_font',v)} />
        </Field>
      </>}

      {/* OFFER TAG */}
      {activeId==='offer' && <>
        <div style={{ background:'#fff7f0',border:'1px solid #fcd34d',borderRadius:8,padding:'8px 12px',fontSize:'0.74rem',color:'#92400e',marginBottom:4 }}>
          💡 This tag floats over the hero. Links to a product or collection page.
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
          <Field label="Tag label">
            <TextInput value={txt('hero_offer_tag')} placeholder="Featured Drop" onChange={v=>setField('hero_offer_tag',v)} />
          </Field>
          <Field label="Title / product name">
            <TextInput value={txt('hero_offer_title')} placeholder="New Arrivals" onChange={v=>setField('hero_offer_title',v)} />
          </Field>
          <Field label="Price (e.g. ₹3,499)">
            <TextInput value={txt('hero_offer_price')} placeholder="₹3,499" onChange={v=>setField('hero_offer_price',v)} />
          </Field>
          <Field label="Discount badge (e.g. -20%)">
            <TextInput value={txt('hero_offer_discount')} placeholder="-20%" onChange={v=>setField('hero_offer_discount',v)} />
          </Field>
          <Field label="Link URL">
            <TextInput value={txt('hero_offer_link')} placeholder="/shop?tag=new" onChange={v=>setField('hero_offer_link',v)} />
          </Field>
          <SliderRow label="Width (px)" min={120} max={280} step={4} value={num('hero_offer_width_px',160)} onChange={v=>setField('hero_offer_width_px',v)} />
          <SliderRow label="X from left (%)" min={0} max={80} step={1} value={num('hero_offer_x_pct',3)} onChange={v=>setField('hero_offer_x_pct',v)} />
          <SliderRow label="Y from top (%)" min={0} max={80} step={1} value={num('hero_offer_y_pct',12)} onChange={v=>setField('hero_offer_y_pct',v)} />
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10 }}>
          <ColourPick label="Background" value={txt('hero_offer_bg')||'#ffffff'} onChange={v=>setField('hero_offer_bg',v)} />
          <ColourPick label="Accent" value={txt('hero_offer_accent')||'#2B9FD8'} onChange={v=>setField('hero_offer_accent',v)} />
          <ColourPick label="Text" value={txt('hero_offer_text_color')||'#1a1a2e'} onChange={v=>setField('hero_offer_text_color',v)} />
        </div>
        <div style={{ background:'#f8fafc',borderRadius:8,padding:10 }}>
          <p style={{ fontSize:'0.7rem',fontWeight:700,color:'#9badb8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8 }}>Card preview</p>
          <div style={{ background:txt('hero_offer_bg')||'#fff',border:`1px solid ${txt('hero_offer_accent')||'#2B9FD8'}22`,borderRadius:10,padding:'12px 14px',boxShadow:'0 4px 16px rgba(0,0,0,0.08)',display:'inline-block',minWidth:140 }}>
            <div style={{ background:txt('hero_offer_accent')||'#2B9FD8',color:'#fff',fontSize:'0.58rem',fontWeight:800,padding:'2px 7px',borderRadius:4,letterSpacing:'0.08em',textTransform:'uppercase',display:'inline-block',marginBottom:7 }}>
              {txt('hero_offer_tag')||'Featured Drop'}
            </div>
            <div style={{ fontSize:'0.82rem',fontWeight:700,color:txt('hero_offer_text_color')||'#1a1a2e',marginBottom:txt('hero_offer_price')?8:0 }}>
              {txt('hero_offer_title')||'New Arrivals'}
            </div>
            {txt('hero_offer_price') && (
              <div style={{ display:'flex',alignItems:'center',gap:6 }}>
                <span style={{ fontSize:'0.88rem',fontWeight:800,color:txt('hero_offer_accent')||'#2B9FD8' }}>{txt('hero_offer_price')}</span>
                {txt('hero_offer_discount') && <span style={{ fontSize:'0.65rem',fontWeight:800,background:'#fff0f0',color:'#e53e3e',padding:'2px 5px',borderRadius:4 }}>{txt('hero_offer_discount')}</span>}
              </div>
            )}
            <div style={{ marginTop:8,fontSize:'0.62rem',fontWeight:700,color:txt('hero_offer_accent')||'#2B9FD8' }}>Shop now →</div>
          </div>
        </div>
      </>}

      {/* SKIP BUTTON */}
      {activeId==='skip' && <>
        <div style={{ background:'#f5f3ff',border:'1px solid #c4b5fd',borderRadius:8,padding:'8px 12px',fontSize:'0.74rem',color:'#5b21b6',marginBottom:4 }}>
          💡 Lets users skip past the scroll animation straight to shop content.
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
          <Field label="Button text">
            <TextInput value={txt('hero_skip_text')} placeholder="Skip Animation" onChange={v=>setField('hero_skip_text',v)} />
          </Field>
          <SliderRow label="Text size (px)" min={9} max={16} step={0.5} value={num('hero_skip_size_px',12)} onChange={v=>setField('hero_skip_size_px',v)} />
          <SliderRow label="X from left (%)" min={0} max={80} step={1} value={num('hero_skip_x_pct',3)} onChange={v=>setField('hero_skip_x_pct',v)} />
          <SliderRow label="Y from bottom (px)" min={10} max={100} step={2} value={num('hero_skip_y_px',32)} onChange={v=>setField('hero_skip_y_px',v)} />
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
          <ColourPick label="Background" value={txt('hero_skip_bg')||'rgba(43,159,216,0.12)'} onChange={v=>setField('hero_skip_bg',v)} />
          <ColourPick label="Text & icon" value={txt('hero_skip_color')||'#2B9FD8'} onChange={v=>setField('hero_skip_color',v)} />
        </div>
        <div style={{ background:'#f8fafc',borderRadius:8,padding:10 }}>
          <p style={{ fontSize:'0.7rem',fontWeight:700,color:'#9badb8',textTransform:'uppercase',letterSpacing:'0.5px',marginBottom:8 }}>Button preview</p>
          <div style={{ display:'inline-flex',alignItems:'center',gap:6,background:txt('hero_skip_bg')||'rgba(43,159,216,0.12)',border:`1px solid ${txt('hero_skip_color')||'#2B9FD8'}44`,borderRadius:20,padding:'7px 14px' }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3l4 3-4 3V3zM7 3h1.5v6H7V3z" fill={txt('hero_skip_color')||'#2B9FD8'}/></svg>
            <span style={{ fontSize:num('hero_skip_size_px',12),fontWeight:700,color:txt('hero_skip_color')||'#2B9FD8',letterSpacing:'0.06em',textTransform:'uppercase' }}>
              {txt('hero_skip_text')||'Skip Animation'}
            </span>
          </div>
        </div>
      </>}

      {/* SPINNING STAR */}
      {activeId==='star' && <>
        <div style={{ background:'#fff7ed',border:'1px solid #fed7aa',borderRadius:8,padding:'8px 12px',fontSize:'0.74rem',color:'#9a3412',marginBottom:4 }}>
          ✨ A rotating 4-point sparkle that floats over the hero — fades out with the intro block.
        </div>
        <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:10 }}>
          <ColourPick label="Star colour" value={txt('hero_star_color')||'#FF6B35'} onChange={v=>setField('hero_star_color',v)} />
          <SliderRow label="Size (px)" min={16} max={120} step={2} value={num('hero_star_size',48)} onChange={v=>setField('hero_star_size',v)} />
          <SliderRow label="X from left (%)" min={0} max={90} step={1} value={num('hero_star_x_pct',18)} onChange={v=>setField('hero_star_x_pct',v)} />
          <SliderRow label="Y from top (%)" min={5} max={90} step={1} value={num('hero_star_y_pct',55)} onChange={v=>setField('hero_star_y_pct',v)} />
          <SliderRow label="Rotation speed (s/rev)" min={2} max={30} step={0.5} value={num('hero_star_speed',8)} onChange={v=>setField('hero_star_speed',v)} />
        </div>
        {/* Live star preview */}
        <div style={{ background:'#fff7ed',borderRadius:8,padding:14,display:'flex',alignItems:'center',justifyContent:'center',gap:16 }}>
          <svg width={num('hero_star_size',48)} height={num('hero_star_size',48)}
            viewBox={`0 0 ${num('hero_star_size',48)} ${num('hero_star_size',48)}`}
            fill={txt('hero_star_color')||'#FF6B35'}
            style={{ animation:`spin ${num('hero_star_speed',8)}s linear infinite`,flexShrink:0 }}>
            {(()=>{
              const s=num('hero_star_size',48),r1=s/2,r2=s/8;
              const pts=Array.from({length:8},(_,i)=>{const a=(i*Math.PI)/4-Math.PI/2;const r=i%2===0?r1:r2;return `${r1+r*Math.cos(a)},${r1+r*Math.sin(a)}`;}).join(' ');
              return <polygon points={pts}/>;
            })()}
          </svg>
          <div style={{ fontSize:'0.72rem',color:'#9a3412' }}>
            <div style={{ fontWeight:700 }}>{txt('hero_star_color')||'#FF6B35'}</div>
            <div>{num('hero_star_size',48)}px · {num('hero_star_speed',8)}s/rev</div>
          </div>
        </div>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   ANIMATION TIMELINE  (video-editor style)
═══════════════════════════════════════════════════════ */
const LABEL_W = 136; // px

interface TLProps {
  settings: S;
  setField: (k:string, v:unknown)=>void;
  activeId: ElementId;
  setActiveId: (id:ElementId)=>void;
  playhead: number;
  setPlayhead: (v:number)=>void;
}

function AnimationTimeline({ settings, setField, activeId, setActiveId, playhead, setPlayhead }: TLProps) {
  const trackRef  = useRef<HTMLDivElement>(null);
  const dragging  = useRef<{key:string;min:number;max:number}|null>(null);
  const phDrag    = useRef(false);

  const pctFromX = useCallback((cx:number)=>{
    const el = trackRef.current;
    if (!el) return 0;
    const r = el.getBoundingClientRect();
    return Math.max(0, Math.min(1, (cx - r.left) / r.width));
  },[]);

  useEffect(()=>{
    const mv = (e:MouseEvent) => {
      if (phDrag.current) { setPlayhead(pctFromX(e.clientX)); return; }
      if (!dragging.current) return;
      const {key,min,max} = dragging.current;
      setField(key, Math.round(Math.max(min,Math.min(max,pctFromX(e.clientX)))*1000)/1000);
    };
    const up = () => { dragging.current=null; phDrag.current=false; };
    document.addEventListener('mousemove',mv);
    document.addEventListener('mouseup',up);
    return ()=>{ document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up); };
  },[pctFromX,setField,setPlayhead]);

  const startHandle = (key:string,min:number,max:number) => (e:React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    dragging.current = {key,min,max};
  };
  const startPH = (e:React.MouseEvent) => {
    e.preventDefault();
    phDrag.current=true;
    setPlayhead(pctFromX(e.clientX));
  };

  const v = (k:string,fb:number) => n(settings[k],fb);
  const is = v('hero_intro_fade_start',0.16);
  const ie = v('hero_intro_fade_end',  0.30);
  const ois = v('hero_overlay_fade_in_start', 0.22);
  const oie = v('hero_overlay_fade_in_end',   0.36);
  const oos = v('hero_overlay_fade_out_start',0.86);
  const ooe = v('hero_overlay_fade_out_end',  1.00);

  /* Bar rendering helpers */
  const Bar = ({ l,r,col,fade }: { l:number;r:number;col:string;fade?:'in'|'out'|'full' }) => (
    <div style={{
      position:'absolute', left:`${l*100}%`, right:`${(1-r)*100}%`,
      top:5, bottom:5, borderRadius:3,
      background: fade==='in'
        ? `linear-gradient(to right,transparent,${col})`
        : fade==='out'
        ? `linear-gradient(to right,${col},transparent)`
        : col,
      opacity:0.9,
    }}/>
  );

  const DragHandle = ({ pos,col,onDown }: { pos:number;col:string;onDown:(e:React.MouseEvent)=>void }) => (
    <div data-handle="1" onMouseDown={onDown}
      style={{
        position:'absolute', left:`${pos*100}%`, top:'50%',
        transform:'translate(-50%,-50%)',
        width:14, height:14, borderRadius:'50%',
        background:'#fff', border:`2.5px solid ${col}`,
        cursor:'ew-resize', zIndex:10,
        boxShadow:'0 1px 5px rgba(0,0,0,0.25)',
      }}>
      {/* Grip lines */}
      <div style={{ position:'absolute', inset:'2px', display:'flex', alignItems:'center', justifyContent:'center', gap:1.5 }}>
        {[0,1,2].map(i=><div key={i} style={{ width:1.5, height:6, background:col, borderRadius:1 }}/>)}
      </div>
    </div>
  );

  const TICK_PCT = [0,0.25,0.5,0.75,1];

  const renderTrack = (el: typeof ELEM_DEFS[0]) => {
    const isActive = el.id === activeId;
    const visible  = settings[el.visKey] !== false;
    const c = el.color;
    return (
      <div key={el.id} style={{ display:'flex', alignItems:'stretch', height:36,
        background: isActive ? `${c}0d` : 'transparent',
        borderRadius:6, marginBottom:2,
        borderLeft:`3px solid ${isActive?c:'transparent'}`,
        transition:'all 0.15s', cursor:'pointer' }}
        onClick={()=>setActiveId(el.id as ElementId)}>

        {/* Label */}
        <div style={{ width:LABEL_W, flexShrink:0, display:'flex', alignItems:'center', gap:6,
          padding:'0 10px', fontSize:'0.72rem', fontWeight:700,
          color:isActive?c:'#5a6a7a' }}>
          <span style={{ fontSize:'0.9rem',lineHeight:1,flexShrink:0 }}>{el.emoji}</span>
          <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{el.label}</span>
          <button
            data-handle="1"
            onMouseDown={e=>e.stopPropagation()}
            onClick={e=>{ e.stopPropagation(); setField(el.visKey, !visible); }}
            title={visible?'Hide':'Show'}
            style={{ background:'none',border:'none',cursor:'pointer',
              fontSize:'0.8rem', opacity:visible?1:0.35, padding:0, lineHeight:1, flexShrink:0 }}>
            {visible?'👁':'🚫'}
          </button>
        </div>

        {/* Track bars (positioned inside trackRef – we position relative to this row's own flex area) */}
        <div style={{ flex:1, position:'relative', opacity:visible?1:0.2,
          pointerEvents: visible?'auto':'none' }}
          onMouseDown={e=>{ if((e.target as HTMLElement).closest('[data-handle]')) return; startPH(e); }}>
          {/* Background reel */}
          <div style={{ position:'absolute', inset:'8px 0', background:'#e2e8f0', borderRadius:3 }}/>

          {el.type==='intro' && <>
            <Bar l={0} r={is} col={c} />
            <Bar l={is} r={ie} col={c} fade="out" />
            <DragHandle pos={is} col={c} onDown={startHandle('hero_intro_fade_start',0,ie-0.02)} />
            <DragHandle pos={ie} col={c} onDown={startHandle('hero_intro_fade_end',is+0.02,1)} />
          </>}

          {el.type==='prompt' && <>
            <Bar l={0} r={0.02} col={c} />
            <Bar l={0} r={0.08} col={c} fade="out" />
            <div style={{ position:'absolute',left:'8%',top:'50%',transform:'translateY(-50%)',
              fontSize:'0.58rem',color:'#9badb8',whiteSpace:'nowrap' }}>fixed at 8%</div>
          </>}

          {el.type==='overlay' && <>
            <Bar l={ois} r={oie} col={c} fade="in" />
            <Bar l={oie} r={oos} col={c} />
            <Bar l={oos} r={ooe} col={c} fade="out" />
            <DragHandle pos={ois} col={c} onDown={startHandle('hero_overlay_fade_in_start', 0,        oie-0.02)} />
            <DragHandle pos={oie} col={c} onDown={startHandle('hero_overlay_fade_in_end',  ois+0.02, oos-0.02)} />
            <DragHandle pos={oos} col={c} onDown={startHandle('hero_overlay_fade_out_start',oie+0.02, ooe-0.02)} />
            <DragHandle pos={ooe} col={c} onDown={startHandle('hero_overlay_fade_out_end', oos+0.02, 1)} />
          </>}

          {el.type==='fixed' && <Bar l={0} r={1} col={c} />}
        </div>
      </div>
    );
  };

  return (
    <div style={{ border:'1px solid #d0e6f5', borderRadius:14, background:'#fff', overflow:'hidden' }}>

      {/* ── Ruler + playhead drag zone ── */}
      <div style={{ display:'flex', borderBottom:'1px solid #e2e8f0', background:'#f8fafc' }}>
        <div style={{ width:LABEL_W, flexShrink:0, padding:'6px 10px',
          fontSize:'0.65rem', fontWeight:800, color:'#9badb8', textTransform:'uppercase', letterSpacing:'0.5px',
          display:'flex', alignItems:'center' }}>
          Scroll %
        </div>
        <div ref={trackRef} style={{ flex:1, position:'relative', height:32, cursor:'col-resize' }}
          onMouseDown={startPH}>
          {/* Tick marks */}
          {TICK_PCT.map(t=>(
            <div key={t} style={{ position:'absolute', left:`${t*100}%`, top:0, bottom:0,
              display:'flex', flexDirection:'column', alignItems:'center',
              transform:'translateX(-50%)', pointerEvents:'none' }}>
              <div style={{ flex:1 }}/>
              <div style={{ width:1, height:7, background:'#c7d9eb' }}/>
              <span style={{ fontSize:'0.58rem', color:'#9badb8', marginTop:2 }}>
                {Math.round(t*100)}%
              </span>
            </div>
          ))}
          {/* Playhead in ruler */}
          <div style={{ position:'absolute', top:0, bottom:0, left:`${playhead*100}%`,
            transform:'translateX(-50%)', width:2, background:'#ef4444', zIndex:20, pointerEvents:'none' }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:'#ef4444',
              position:'absolute', top:2, left:'50%', transform:'translateX(-50%)' }}/>
          </div>
        </div>
      </div>

      {/* ── All element track rows ── */}
      <div style={{ padding:'6px 0 6px 0', position:'relative' }}>
        {/* Vertical playhead line across all tracks */}
        <div style={{
          position:'absolute',
          // LABEL_W for label col + playhead% of the remaining track area
          // We can't do calc easily so we use a pointer-events-none overlay
          left:`${LABEL_W}px`,
          right:0,
          top:0, bottom:0,
          pointerEvents:'none', zIndex:6,
        }}>
          <div style={{
            position:'absolute',
            left:`${playhead*100}%`,
            top:0, bottom:0, width:1,
            background:'rgba(239,68,68,0.25)',
            transform:'translateX(-50%)',
          }}/>
        </div>

        {/* Tracks */}
        <div style={{ padding:'0 8px 0 0' }}>
          {ELEM_DEFS.map(el=>renderTrack(el))}
        </div>
      </div>

      {/* ── Bottom scrub bar ── */}
      <div style={{ borderTop:'1px solid #e2e8f0', padding:'8px 14px',
        background:'#f8fafc', display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:'0.68rem', fontWeight:800, color:'#9badb8', textTransform:'uppercase', letterSpacing:'0.5px', flexShrink:0 }}>
          Scrub:
        </span>
        <input type="range" min={0} max={100} step={1}
          value={Math.round(playhead*100)}
          onChange={e=>setPlayhead(Number(e.target.value)/100)}
          style={{ flex:1, accentColor:'#ef4444' }} />
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#ef4444' }}/>
          <span style={{ fontSize:'0.7rem', fontFamily:'monospace', color:'#ef4444', fontWeight:800 }}>
            {Math.round(playhead*100)}%
          </span>
        </div>
        <div style={{ fontSize:'0.65rem', color:'#9badb8', flexShrink:0 }}>
          ← drag handles on tracks to set timing
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   HERO STUDIO  (assembled)
═══════════════════════════════════════════════════════ */
function HeroStudio({ settings, setField, onSave, status }: {
  settings:S; setField:(k:string,v:unknown)=>void; onSave:(e:FormEvent)=>void; status:string;
}) {
  const [activeId, setActiveId] = useState<ElementId>('intro');
  const [playhead, setPlayhead] = useState(0);
  const def = ELEM_DEFS.find(e=>e.id===activeId)!;

  return (
    <form onSubmit={onSave} style={{ display:'flex', flexDirection:'column', gap:20 }}>
      {/* ── Element chip strip ── */}
      <div>
        <p style={{ fontSize:'0.72rem', color:'#9badb8', fontWeight:700, textTransform:'uppercase',
          letterSpacing:'0.5px', marginBottom:10 }}>
          Click an element to edit it · Toggle 👁 to show/hide
        </p>
        <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
          {ELEM_DEFS.map(el=>{
            const isActive = el.id===activeId;
            const visible  = settings[el.visKey]!==false;
            return (
              <button key={el.id} type="button" onClick={()=>setActiveId(el.id as ElementId)}
                style={{
                  display:'flex', alignItems:'center', gap:7,
                  padding:'7px 14px', borderRadius:999,
                  border:`2px solid ${isActive?el.color:'#d0e6f5'}`,
                  background:isActive?`${el.color}15`:'#fff',
                  color:isActive?el.color:'#5a6a7a',
                  cursor:'pointer', fontWeight:700, fontSize:'0.78rem',
                  fontFamily:'inherit', transition:'all 0.15s',
                  opacity:visible?1:0.5,
                }}>
                <span style={{ fontSize:'1rem', lineHeight:1 }}>{el.emoji}</span>
                {el.label}
                <span style={{ fontSize:'0.8rem', opacity:0.7 }}>{visible?'●':'○'}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Main two-panel area ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:20, alignItems:'start' }}>
        {/* Preview */}
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <span style={{ fontSize:'0.72rem', fontWeight:800, color:'#9badb8', textTransform:'uppercase', letterSpacing:'0.5px' }}>
              Live Preview
            </span>
            <span style={{ fontSize:'0.7rem', color:'#9badb8' }}>
              Drag the timeline scrub bar below to simulate scroll
            </span>
          </div>
          <HeroPreview settings={settings} playhead={playhead} activeId={activeId} />
        </div>

        {/* Inspector */}
        <div style={{ border:'1px solid #d0e6f5', borderRadius:14, padding:18,
          background:'#fff', maxHeight:480, overflowY:'auto' }}>
          <Inspector activeId={activeId} settings={settings} setField={setField} />
        </div>
      </div>

      {/* ── Animation Timeline ── */}
      <div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
          <div>
            <span style={{ fontSize:'0.78rem', fontWeight:800, color:'#1a1a2e' }}>Animation Timeline</span>
            <span style={{ fontSize:'0.7rem', color:'#9badb8', marginLeft:10 }}>
              Drag coloured handles to set when each element appears and disappears
            </span>
          </div>
          <div style={{ display:'flex', gap:10, alignItems:'center' }}>
            {/* Legend */}
            <div style={{ display:'flex', gap:8, fontSize:'0.66rem', color:'#9badb8' }}>
              <span>████ Visible</span>
              <span style={{ opacity:0.5 }}>▓▓▓▓ Fading</span>
            </div>
          </div>
        </div>
        <AnimationTimeline
          settings={settings} setField={setField}
          activeId={activeId} setActiveId={setActiveId}
          playhead={playhead} setPlayhead={setPlayhead} />
      </div>

      {/* ── Save footer ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'flex-end', gap:12,
        padding:'14px 0 0', borderTop:'1px solid #d0e6f5', flexWrap:'wrap' }}>
        {status && <span style={{ fontSize:'0.82rem', color:'#10b981', fontWeight:600, flex:1 }}>✓ {status}</span>}
        <button type="button"
          onClick={()=>{
            if (!window.confirm('Reset all Hero Studio settings to defaults? This cannot be undone.')) return;
            const defaults: Record<string,unknown> = {
              hero_intro_align:'center', hero_intro_x_pct:50, hero_intro_y_pct:50,
              hero_intro_fade_start:0.16, hero_intro_fade_end:0.3,
              hero_overlay_fade_in_start:0.22, hero_overlay_fade_in_end:0.36,
              hero_overlay_fade_out_start:0.86, hero_overlay_fade_out_end:1,
              hero_image_scale:1.008, hero_scroll_height_vh:420, hero_gradient_strength:1,
              hero_intro_max_width_px:960, hero_eyebrow_size_px:12, hero_sub_size_rem:1,
              hero_prompt_size_px:10.4, hero_intro_font_size_rem:2.25,
              hero_intro_visible:true, hero_prompt_visible:true,
              hero_overlay_left_visible:true, hero_overlay_right_visible:true,
              hero_image_visible:true, hero_gradient_visible:true,
              hero_offer_visible:true, hero_skip_visible:true,
              hero_offer_x_pct:3, hero_offer_y_pct:12, hero_offer_width_px:160,
              hero_skip_x_pct:3, hero_skip_y_px:32, hero_skip_size_px:12,
            };
            Object.entries(defaults).forEach(([k,v])=>setField(k,v));
          }}
          style={{ padding:'11px 20px', background:'#fff', border:'1.5px solid #d0e6f5',
            borderRadius:10, color:'#5a6a7a', fontWeight:600, cursor:'pointer',
            fontFamily:'inherit', fontSize:'0.85rem', display:'flex', alignItems:'center', gap:6 }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='#fca5a5';e.currentTarget.style.color='#ef4444';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='#d0e6f5';e.currentTarget.style.color='#5a6a7a';}}>
          ↺ Reset Defaults
        </button>
        <button type="submit"
          style={{ padding:'11px 28px', background:'linear-gradient(135deg,#2B9FD8,#1a7ab0)',
            color:'#fff', border:'none', borderRadius:10,
            fontWeight:700, fontSize:'0.9rem', cursor:'pointer', fontFamily:'inherit' }}>
          Save Hero Studio
        </button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════
   ADMIN SETTINGS PAGE  (main export)
═══════════════════════════════════════════════════════ */
export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<S>({});
  const [offer, setOffer]       = useState<OfferState>({ active:false, text:'', bg_color:'#FF6B35', text_color:'#ffffff', show_logo:true });
  const [status, setStatus]     = useState('');
  const [activeTab, setActiveTab] = useState<Tab>('hero');

  useEffect(()=>{
    fetchAdminSettings().then(setSettings).catch(()=>{});
    fetchAdminOffer().then(setOffer).catch(()=>{});
  },[]);

  const flash = (msg:string) => { setStatus(msg); setTimeout(()=>setStatus(''),3000); };
  const setField = useCallback((k:string, v:unknown) => setSettings(prev=>({...prev,[k]:v})), []);

  /* ── Save handlers ── */
  const saveHero = async (e: FormEvent) => {
    e.preventDefault();
    const hero_keys = [
      'primary_color','hero_font',
      'hero_headline','hero_highlight','hero_headline2','hero_eyebrow','hero_sub','hero_prompt_text',
      'hero_text_color','hero_sub_color','hero_overlay_color',
      'hero_intro_font_size_rem','hero_eyebrow_size_px','hero_sub_size_rem','hero_prompt_size_px',
      'hero_intro_max_width_px','hero_intro_y_offset_px','hero_intro_align',
      'hero_intro_x_pct','hero_intro_y_pct','hero_prompt_x_pct','hero_prompt_y_px',
      'hero_intro_fade_start','hero_intro_fade_end',
      'hero_overlay_fade_in_start','hero_overlay_fade_in_end','hero_overlay_fade_out_start','hero_overlay_fade_out_end',
      'hero_overlay_left_label','hero_overlay_left_title','hero_overlay_left_x','hero_overlay_left_y',
      'hero_overlay_right_label','hero_overlay_right_title','hero_overlay_right_x','hero_overlay_right_y',
      'hero_image_scale','hero_scroll_height_vh','hero_gradient_strength',
      'hero_image_visible','hero_intro_visible','hero_prompt_visible',
      'hero_overlay_left_visible','hero_overlay_right_visible','hero_gradient_visible',
      'hero_offer_visible','hero_offer_tag','hero_offer_title','hero_offer_price','hero_offer_discount',
      'hero_offer_bg','hero_offer_accent','hero_offer_text_color','hero_offer_link',
      'hero_offer_x_pct','hero_offer_y_pct','hero_offer_width_px',
      'hero_skip_visible','hero_skip_text','hero_skip_bg','hero_skip_color',
      'hero_skip_x_pct','hero_skip_y_px','hero_skip_size_px',
      'hero_star_visible','hero_star_color','hero_star_size','hero_star_x_pct','hero_star_y_pct','hero_star_speed',
    ];
    const payload: S = {};
    hero_keys.forEach(k => { payload[k] = settings[k] ?? undefined; });
    const res = await saveAdminSettings(payload);
    flash(res.success ? 'Hero Studio saved!' : (res.error||'Save failed'));
  };

  const saveStore = async () => {
    const payload: S = { show_new_arrivals:settings.show_new_arrivals!==false, show_categories:settings.show_categories!==false, show_brands_section:settings.show_brands_section!==false, hidden_brands:settings.hidden_brands||'' };
    CAT_SLUGS.forEach(slug => { payload[`cat_${slug}`] = settings[`cat_${slug}`]!==false; });
    const res = await saveAdminSettings(payload);
    flash(res.success?'Store settings saved!':(res.error||'Save failed'));
  };

  const saveOffer = async () => {
    const res = await saveAdminOffer(offer);
    flash(res.success?'Offer ribbon saved!':(res.error||'Save failed'));
  };

  const savePolicies = async () => {
    const res = await saveAdminSettings({ policy_privacy:settings.policy_privacy||'', policy_return:settings.policy_return||'', policy_shipping:settings.policy_shipping||'' });
    flash(res.success?'Policies saved!':(res.error||'Save failed'));
  };

  const hiddenBrands = new Set(String(settings.hidden_brands||'').split(',').map(s=>s.trim().toLowerCase()).filter(Boolean));
  const toggleBrand = (slug:string) => {
    const next = new Set(hiddenBrands);
    const k = slug.toLowerCase();
    if (next.has(k)) next.delete(k); else next.add(k);
    setField('hidden_brands', Array.from(next).join(','));
  };

  const tabStyle = (t:Tab): React.CSSProperties => ({
    padding:'8px 18px', borderRadius:20, border:`1.5px solid ${activeTab===t?'#2B9FD8':'#d0e6f5'}`,
    background:activeTab===t?'#2B9FD8':'#fff', color:activeTab===t?'#fff':'#5a6a7a',
    cursor:'pointer', fontWeight:700, fontSize:'0.84rem', fontFamily:'inherit',
    transition:'all 0.15s',
  });

  const [saveErr, setSaveErr] = useState('');
  const [testStatus, setTestStatus] = useState('');
  const LOCAL = typeof window!=='undefined' && (window.location.hostname==='localhost'||window.location.hostname==='127.0.0.1');

  const testConnection = async () => {
    setTestStatus('Testing…');
    try {
      const token = (() => { try { for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i)||'';if(k.includes('-auth-token')||k.startsWith('sb-')){const v=JSON.parse(localStorage.getItem(k)||'null');const t=v?.access_token??v?.session?.access_token??null;if(t)return t;}}  } catch{} return null; })();
      const r = await fetch('/api/x9k2/site-settings', { credentials:'include', headers: token?{'Authorization':`Bearer ${token}`}:{} });
      if (r.ok) setTestStatus('✅ Connected! Settings will save.');
      else if (r.status===401||r.status===403) setTestStatus('🔐 Auth rejected — deploy to Vercel for full admin.');
      else setTestStatus(`⚠️ Status ${r.status} — may not save locally.`);
    } catch { setTestStatus('❌ Cannot reach /api/x9k2 — proxy error.'); }
    setTimeout(()=>setTestStatus(''),7000);
  };

  return (
    <section className="admin-panel">

      {/* ── Local dev banner ── */}
      {LOCAL && (
        <div style={{ background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:10,
          padding:'12px 16px', marginBottom:20, display:'flex', alignItems:'flex-start', gap:10, flexWrap:'wrap' }}>
          <span style={{ fontSize:'1.1rem', flexShrink:0, marginTop:2 }}>⚠️</span>
          <div style={{ flex:1, minWidth:260, fontSize:'0.82rem', color:'#92400e', lineHeight:1.7 }}>
            <strong>Local dev — settings may not persist.</strong><br/>
            Flask's <code style={{ background:'#fef3c7', padding:'1px 5px', borderRadius:3 }}>/api/x9k2/*</code> routes
            require the old Flask session cookie (set by <code style={{ background:'#fef3c7', padding:'1px 5px', borderRadius:3 }}>/manage-store-x9k2</code>),
            which can't be forwarded from React's Supabase login.
            <strong> Deploy to Vercel</strong> to fully save — or manage settings at{' '}
            <a href="https://calvac.in/manage-store-x9k2" target="_blank" rel="noopener"
              style={{ color:'#2B9FD8', fontWeight:700 }}>calvac.in/manage-store-x9k2</a>.
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
            <button type="button" onClick={testConnection}
              style={{ padding:'5px 12px', border:'1px solid #d97706', borderRadius:8, background:'#fff',
                color:'#92400e', cursor:'pointer', fontSize:'0.78rem', fontWeight:700, fontFamily:'inherit' }}>
              Test connection
            </button>
            {testStatus && <span style={{ fontSize:'0.78rem', fontWeight:700, color:'#92400e' }}>{testStatus}</span>}
          </div>
        </div>
      )}

      {saveErr && (
        <div style={{ background:'#fff1f2', border:'1px solid #fecdd3', borderRadius:8,
          padding:'10px 14px', marginBottom:14, fontSize:'0.82rem', color:'#be123c', display:'flex', alignItems:'center', gap:8 }}>
          ⚠️ {saveErr}
          <button type="button" onClick={()=>setSaveErr('')}
            style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#be123c', fontSize:'1rem' }}>✕</button>
        </div>
      )}

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
        <h2 style={{ margin:0 }}>Site Settings</h2>
        {status && (
          <span style={{ fontSize:'0.84rem', color:'#10b981', fontWeight:700,
            background:'#f0fdf4', padding:'6px 14px', borderRadius:20, border:'1px solid #86efac' }}>
            ✓ {status}
          </span>
        )}
      </div>

      {/* Tab strip */}
      <div style={{ display:'flex', gap:8, marginBottom:24, flexWrap:'wrap' }}>
        {(['hero','mobile','store','announcement','policies'] as Tab[]).map(t=>(
          <button key={t} type="button" style={tabStyle(t)} onClick={()=>setActiveTab(t)}>
            { t==='hero'?'🎬 Hero Studio' : t==='mobile'?'📱 Mobile Hero' : t==='store'?'🏪 Store Info' : t==='announcement'?'📢 Announcement' : '📄 Policies' }
          </button>
        ))}
      </div>

      {/* ── HERO STUDIO ── */}
      {activeTab==='hero' && (
        <HeroStudio settings={settings} setField={setField} onSave={saveHero} status="" />
      )}

      {/* ── STORE INFO ── */}
      {activeTab==='store' && (
        <div className="admin-form" style={{ borderTop:'none', marginTop:0, paddingTop:0 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:20 }}>
            <ColourPick label="Primary Colour"
              value={(settings.primary_color as string)||'#2B9FD8'}
              onChange={v=>setField('primary_color',v)} />
            <Field label="Hero Font">
              <TextInput value={(settings.hero_font as string)||'default'} placeholder="default"
                onChange={v=>setField('hero_font',v)} />
            </Field>
          </div>

          <h4 className="admin-subtitle">Homepage Sections</h4>
          {[
            { key:'show_new_arrivals',   label:'Show New Arrivals section'       },
            { key:'show_categories',     label:'Show Category Quick Links'       },
            { key:'show_brands_section', label:'Show Shop by Brand section'      },
          ].map(row=>(
            <label key={row.key} className="admin-check" style={{ marginBottom:10 }}>
              <input type="checkbox"
                checked={settings[row.key]!==false}
                onChange={e=>setField(row.key,e.target.checked)} />
              {row.label}
            </label>
          ))}

          <h4 className="admin-subtitle" style={{ marginTop:16 }}>Category buttons</h4>
          <div className="admin-form-grid">
            {CAT_SLUGS.map(slug=>(
              <label key={slug} className="admin-check">
                <input type="checkbox"
                  checked={settings[`cat_${slug}`]!==false}
                  onChange={e=>setField(`cat_${slug}`,e.target.checked)} />
                {slug}
              </label>
            ))}
          </div>

          <h4 className="admin-subtitle" style={{ marginTop:16 }}>Visible brands</h4>
          <div className="admin-form-grid">
            {BRANDS.map(b=>(
              <label key={b.slug} className="admin-check">
                <input type="checkbox"
                  checked={!hiddenBrands.has(b.slug.toLowerCase())}
                  onChange={()=>toggleBrand(b.slug)} />
                {b.name}
              </label>
            ))}
          </div>

          <button className="admin-primary-btn" style={{ marginTop:20 }} type="button" onClick={saveStore}>
            Save Store Info
          </button>
        </div>
      )}

      {/* ── ANNOUNCEMENT ── */}
      {activeTab==='announcement' && (
        <div className="admin-form" style={{ borderTop:'none', marginTop:0, paddingTop:0 }}>

          {/* Live preview */}
          {offer.active && offer.text && (
            <div style={{ padding:'8px 0', overflow:'hidden', background:offer.bg_color,
              borderRadius:8, marginBottom:16, display:'flex', alignItems:'center',
              justifyContent:'center', gap:10, flexWrap:'nowrap' }}>
              {offer.show_logo !== false && (
                <img src="https://ik.imagekit.io/yocxectr4/logos/logo.png?tr=w-28,h-28,f-webp"
                  alt="logo" style={{ height:18, width:'auto', objectFit:'contain', opacity:0.85, mixBlendMode:'multiply' as const }} />
              )}
              <span style={{ fontSize:'0.88rem', fontWeight:700, color:offer.text_color, whiteSpace:'nowrap' }}>{offer.text}</span>
              <span style={{ opacity:0.3, fontSize:'0.7rem', color:offer.text_color }}>✦</span>
              {offer.show_logo !== false && (
                <img src="https://ik.imagekit.io/yocxectr4/logos/logo.png?tr=w-28,h-28,f-webp"
                  alt="logo" style={{ height:18, width:'auto', objectFit:'contain', opacity:0.85, mixBlendMode:'multiply' as const }} />
              )}
              <span style={{ fontSize:'0.88rem', fontWeight:700, color:offer.text_color, whiteSpace:'nowrap' }}>{offer.text}</span>
              <span style={{ opacity:0.3, fontSize:'0.7rem', color:offer.text_color }}>✦</span>
            </div>
          )}

          <div className="admin-form-grid">
            <input className="full" placeholder="Ribbon text (repeating marquee)"
              value={offer.text}
              onChange={e=>setOffer(p=>({...p,text:e.target.value}))}
              style={{ border:'1px solid #d0e6f5', borderRadius:8, padding:'9px 10px' }} />
            <div>
              <ColourPick label="Background" value={offer.bg_color} onChange={v=>setOffer(p=>({...p,bg_color:v}))} />
            </div>
            <div>
              <ColourPick label="Text colour" value={offer.text_color} onChange={v=>setOffer(p=>({...p,text_color:v}))} />
            </div>
          </div>

          {/* Toggles */}
          <div style={{ display:'flex', flexDirection:'column', gap:10, margin:'14px 0' }}>
            <label className="admin-check" style={{ alignItems:'flex-start', gap:10 }}>
              <input type="checkbox"
                checked={offer.show_logo !== false}
                onChange={e=>setOffer(p=>({...p, show_logo:e.target.checked}))}
                style={{ marginTop:2 }} />
              <div>
                <div style={{ fontWeight:600, fontSize:'0.88rem' }}>Show CALVAC logo in ribbon</div>
                <div style={{ fontSize:'0.76rem', color:'#9badb8', marginTop:3, display:'flex', alignItems:'center', gap:6 }}>
                  Adds
                  <img src="https://ik.imagekit.io/yocxectr4/logos/logo.png?tr=w-28,h-28,f-webp"
                    alt="logo" style={{ height:15, width:'auto', objectFit:'contain', opacity:0.7 }} />
                  between each text segment
                </div>
              </div>
            </label>
            <label className="admin-check">
              <input type="checkbox" checked={offer.active}
                onChange={e=>setOffer(p=>({...p,active:e.target.checked}))} />
              Ribbon is active (shown on homepage)
            </label>
          </div>

          <button className="admin-primary-btn" type="button" onClick={saveOffer}>
            Save Announcement
          </button>
        </div>
      )}

      {/* ── POLICIES ── */}
      {activeTab==='policies' && (
        <div className="admin-form" style={{ borderTop:'none', marginTop:0, paddingTop:0 }}>
          <p style={{ fontSize:'0.8rem', color:'#9badb8', marginBottom:16 }}>
            Supports basic Markdown: <code style={{ background:'#eaf3fa', padding:'1px 5px', borderRadius:4 }}># Heading</code>, <code style={{ background:'#eaf3fa', padding:'1px 5px', borderRadius:4 }}>**bold**</code>, <code style={{ background:'#eaf3fa', padding:'1px 5px', borderRadius:4 }}>- list</code>
          </p>
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {POLICY_KEYS.map(item=>(
              <Field key={item.key} label={item.label}>
                <textarea
                  value={(settings[item.key] as string)||''}
                  onChange={e=>setField(item.key,e.target.value)}
                  style={{ width:'100%', minHeight:120, padding:'10px 12px',
                    border:'1px solid #d0e6f5', borderRadius:8, fontSize:'0.84rem',
                    fontFamily:'inherit', outline:'none', background:'#f4f8fb',
                    resize:'vertical', lineHeight:1.7 }} />
              </Field>
            ))}
          </div>
          <button className="admin-primary-btn" style={{ marginTop:16 }} type="button" onClick={savePolicies}>
            Save Policies
          </button>
        </div>
      )}

      {/* ══════════════════════════════════════════
          📱 MOBILE HERO STUDIO
      ══════════════════════════════════════════ */}
      {activeTab==='mobile' && (
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>

          {/* Info banner */}
          <div style={{ background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:10,
            padding:'12px 16px', fontSize:'0.82rem', color:'#1e40af', lineHeight:1.7 }}>
            <strong>📱 Mobile Hero Studio</strong> — these settings override the desktop Hero Studio on screens narrower than 768px.
            Leave a field at its default to inherit the desktop value. Changes here only affect mobile visitors.
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:24, alignItems:'start' }}>

            {/* Left: controls */}
            <div style={{ display:'flex', flexDirection:'column', gap:20 }}>

              {/* Text & layout */}
              <div style={{ background:'#fff', border:'1px solid #d0e6f5', borderRadius:12, padding:18 }}>
                <h4 style={{ fontFamily:'var(--font-display)', fontSize:'0.88rem', fontWeight:800,
                  color:'#2B9FD8', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                  📝 Text &amp; Layout
                </h4>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <SliderRow label="Headline size (rem)" min={1} max={3.5} step={0.05}
                    value={n(settings.hero_m_intro_font_size_rem, 1.35)}
                    onChange={v=>setField('hero_m_intro_font_size_rem',v)} />
                  <SliderRow label="Eyebrow size (px)" min={7} max={16} step={0.5}
                    value={n(settings.hero_m_eyebrow_size_px, 9)}
                    onChange={v=>setField('hero_m_eyebrow_size_px',v)} />
                  <SliderRow label="Sub text size (rem)" min={0.6} max={1.2} step={0.05}
                    value={n(settings.hero_m_sub_size_rem, 0.78)}
                    onChange={v=>setField('hero_m_sub_size_rem',v)} />
                  <SliderRow label="Prompt size (px)" min={7} max={14} step={0.5}
                    value={n(settings.hero_m_prompt_size_px, 8.5)}
                    onChange={v=>setField('hero_m_prompt_size_px',v)} />
                  <SliderRow label="Intro Y position (%)" min={30} max={90} step={1}
                    value={n(settings.hero_m_intro_y_pct, 72)}
                    onChange={v=>setField('hero_m_intro_y_pct',v)} />
                  <SliderRow label="Max width (px)" min={240} max={400} step={4}
                    value={n(settings.hero_m_intro_max_width_px, 340)}
                    onChange={v=>setField('hero_m_intro_max_width_px',v)} />
                  <SliderRow label="Scroll height (vh)" min={150} max={400} step={10}
                    value={n(settings.hero_m_scroll_height_vh, 280)}
                    onChange={v=>setField('hero_m_scroll_height_vh',v)} />
                  <Field label="Alignment">
                    <div style={{ display:'flex', gap:5 }}>
                      {['left','center','right'].map(a=>(
                        <button key={a} type="button"
                          onClick={()=>setField('hero_m_intro_align',a)}
                          style={{
                            flex:1, padding:'6px', border:`1.5px solid ${(settings.hero_m_intro_align||'center')===a?'#2B9FD8':'#d0e6f5'}`,
                            borderRadius:6, background:(settings.hero_m_intro_align||'center')===a?'#2B9FD8':'#f4f8fb',
                            color:(settings.hero_m_intro_align||'center')===a?'#fff':'#5a6a7a',
                            cursor:'pointer', fontWeight:700, fontSize:'0.72rem', fontFamily:'inherit',
                          }}>
                          {a[0].toUpperCase()+a.slice(1)}
                        </button>
                      ))}
                    </div>
                  </Field>
                </div>
              </div>

              {/* Visibility toggles */}
              <div style={{ background:'#fff', border:'1px solid #d0e6f5', borderRadius:12, padding:18 }}>
                <h4 style={{ fontFamily:'var(--font-display)', fontSize:'0.88rem', fontWeight:800,
                  color:'#2B9FD8', marginBottom:14, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                  👁 Element Visibility (Mobile)
                </h4>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                  {[
                    { key:'hero_m_intro_visible',          label:'Intro Block',    def:true  },
                    { key:'hero_m_eyebrow_visible',        label:'Eyebrow text',   def:true  },
                    { key:'hero_m_headline_visible',       label:'Headline',       def:true  },
                    { key:'hero_m_sub_visible',            label:'Sub text',       def:false },
                    { key:'hero_m_prompt_visible',         label:'Scroll Prompt',  def:true  },
                    { key:'hero_m_overlay_left_visible',   label:'Left Overlay',   def:false },
                    { key:'hero_m_overlay_right_visible',  label:'Right Overlay',  def:false },
                    { key:'hero_m_star_visible',           label:'Spin Star',      def:true  },
                    { key:'hero_m_offer_visible',          label:'Offer Tag',      def:true  },
                    { key:'hero_m_skip_visible',           label:'Skip Button',    def:true  },
                  ].map(row=>{
                    const val = settings[row.key] !== undefined ? settings[row.key] as boolean : row.def;
                    return (
                      <label key={row.key} style={{ display:'flex', alignItems:'center', gap:8,
                        cursor:'pointer', userSelect:'none', fontSize:'0.82rem',
                        padding:'6px 10px', borderRadius:8,
                        background: val ? '#eaf3fa' : '#f9fafb',
                        border:`1px solid ${val?'#2B9FD8':'#d0e6f5'}`,
                        color: val ? '#1e40af' : '#5a6a7a',
                        transition:'all 0.15s' }}>
                        <input type="checkbox" checked={!!val}
                          onChange={e=>setField(row.key,e.target.checked)}
                          style={{ accentColor:'#2B9FD8', width:14, height:14 }} />
                        {row.label}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Element positions on mobile */}
              <div style={{ background:'#fff', border:'1px solid #d0e6f5', borderRadius:12, padding:18 }}>
                <h4 style={{ fontFamily:'var(--font-display)', fontSize:'0.88rem', fontWeight:800,
                  color:'#2B9FD8', marginBottom:16, textTransform:'uppercase', letterSpacing:'0.5px' }}>
                  📍 Element Positions (Mobile)
                </h4>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
                  <SliderRow label="Star size (px)" min={12} max={60} step={2}
                    value={n(settings.hero_m_star_size,28)} onChange={v=>setField('hero_m_star_size',v)} />
                  <SliderRow label="Star X (%)" min={0} max={90} step={1}
                    value={n(settings.hero_m_star_x_pct,10)} onChange={v=>setField('hero_m_star_x_pct',v)} />
                  <SliderRow label="Star Y (%)" min={5} max={90} step={1}
                    value={n(settings.hero_m_star_y_pct,32)} onChange={v=>setField('hero_m_star_y_pct',v)} />
                  <SliderRow label="Offer width (px)" min={100} max={200} step={4}
                    value={n(settings.hero_m_offer_width_px,128)} onChange={v=>setField('hero_m_offer_width_px',v)} />
                  <SliderRow label="Offer X (%)" min={0} max={70} step={1}
                    value={n(settings.hero_m_offer_x_pct,3)} onChange={v=>setField('hero_m_offer_x_pct',v)} />
                  <SliderRow label="Offer Y (%)" min={0} max={70} step={1}
                    value={n(settings.hero_m_offer_y_pct,7)} onChange={v=>setField('hero_m_offer_y_pct',v)} />
                  <SliderRow label="Skip Y from bottom (px)" min={8} max={80} step={2}
                    value={n(settings.hero_m_skip_y_px,16)} onChange={v=>setField('hero_m_skip_y_px',v)} />
                  <SliderRow label="Skip size (px)" min={8} max={14} step={0.5}
                    value={n(settings.hero_m_skip_size_px,10)} onChange={v=>setField('hero_m_skip_size_px',v)} />
                </div>
              </div>

              {/* ── Mobile Overlay Editor ── */}
              {(['left','right'] as const).map(side => {
                const isLeft = side === 'left';
                const col   = isLeft ? '#10b981' : '#f59e0b';
                const visKey    = `hero_m_${side}_visible`;
                const labelKey  = `hero_m_${side}_label`;
                const titleKey  = `hero_m_${side}_title`;
                const labelSzK  = `hero_m_${side}_label_size`;
                const titleSzK  = `hero_m_${side}_title_size`;
                const labelColK = `hero_m_${side}_label_color`;
                const titleColK = `hero_m_${side}_title_color`;
                const xKey      = `hero_m_${side}_x_pct`;
                const yKey      = `hero_m_${side}_y_pct`;
                const isVisible = settings[visKey] === true;
                return (
                  <div key={side} style={{ background:'#fff', border:`1px solid ${col}44`, borderRadius:12,
                    padding:18, borderLeft:`4px solid ${col}` }}>
                    {/* Header row */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
                      <h4 style={{ fontFamily:'var(--font-display)', fontSize:'0.88rem', fontWeight:800,
                        color:col, textTransform:'uppercase', letterSpacing:'0.5px', margin:0 }}>
                        {isLeft ? '◀ Left Overlay (Mobile)' : '▶ Right Overlay (Mobile)'}
                      </h4>
                      {/* Toggle */}
                      <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', userSelect:'none' }}>
                        <span style={{ fontSize:'0.72rem', fontWeight:700, color:'#9badb8' }}>
                          {isVisible ? 'Visible' : 'Hidden'}
                        </span>
                        <button
                          type="button"
                          onClick={()=>setField(visKey, !isVisible)}
                          style={{
                            width:44, height:24, borderRadius:12, position:'relative',
                            background:isVisible ? col : '#d0e6f5',
                            border:'none', cursor:'pointer', transition:'background 0.2s',
                          }}>
                          <span style={{
                            position:'absolute', top:3, width:18, height:18, borderRadius:'50%',
                            background:'#fff', transition:'left 0.2s',
                            boxShadow:'0 1px 3px rgba(0,0,0,0.2)',
                            left: isVisible ? 23 : 3,
                          }}/>
                        </button>
                      </label>
                    </div>

                    {isVisible && (
                      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                        {/* Text inputs */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                          <Field label="Label text (small caps)">
                            <TextInput
                              value={(settings[labelKey] as string)||''}
                              placeholder={isLeft ? 'Cushion' : 'Structure'}
                              onChange={v=>setField(labelKey,v)} style={{
                                width:'100%', padding:'8px 10px', border:'1px solid #d0e6f5',
                                borderRadius:7, fontSize:'0.84rem', fontFamily:'inherit',
                                outline:'none', background:'#f4f8fb', color:'#1a1a2e',
                              }} />
                          </Field>
                          <Field label="Title text (large)">
                            <TextInput
                              value={(settings[titleKey] as string)||''}
                              placeholder={isLeft ? 'Step Into' : 'Premium Comfort'}
                              onChange={v=>setField(titleKey,v)} style={{
                                width:'100%', padding:'8px 10px', border:'1px solid #d0e6f5',
                                borderRadius:7, fontSize:'0.84rem', fontFamily:'inherit',
                                outline:'none', background:'#f4f8fb', color:'#1a1a2e',
                              }} />
                          </Field>
                        </div>

                        {/* Size sliders */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                          <SliderRow label="Label size (px)" min={6} max={14} step={0.5}
                            value={n(settings[labelSzK], 8)} onChange={v=>setField(labelSzK,v)} />
                          <SliderRow label="Title size (rem)" min={0.6} max={2.5} step={0.05}
                            value={n(settings[titleSzK], 1.1)} onChange={v=>setField(titleSzK,v)} />
                        </div>

                        {/* Position sliders */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                          <SliderRow
                            label={isLeft ? 'X from left (%)' : 'X from right (%)'}
                            min={0} max={50} step={1}
                            value={n(settings[xKey], 4)} onChange={v=>setField(xKey,v)} />
                          <SliderRow
                            label={isLeft ? 'Y from top (%)' : 'Y from bottom (%)'}
                            min={5} max={80} step={1}
                            value={n(settings[yKey], 18)} onChange={v=>setField(yKey,v)} />
                        </div>

                        {/* Color pickers */}
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                          <ColourPick label="Label colour"
                            value={(settings[labelColK] as string)||'#2B9FD8'}
                            onChange={v=>setField(labelColK,v)} />
                          <ColourPick label="Title colour"
                            value={(settings[titleColK] as string)||'#2B9FD8'}
                            onChange={v=>setField(titleColK,v)} />
                        </div>

                        {/* Live mini preview strip */}
                        <div style={{ background:`${col}0d`, border:`1px solid ${col}33`,
                          borderRadius:8, padding:'10px 12px' }}>
                          <p style={{ fontSize:'0.7rem', fontWeight:700, color:'#9badb8',
                            textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Preview</p>
                          <div style={{ textAlign: isLeft ? 'left' : 'right' }}>
                            <p style={{ fontSize:n(settings[labelSzK],8),
                              textTransform:'uppercase', letterSpacing:'0.22em',
                              color:(settings[labelColK] as string)||'#2B9FD8', marginBottom:3 }}>
                              {(settings[labelKey] as string)||( isLeft ? 'Cushion' : 'Structure')}
                            </p>
                            <p style={{ fontSize:`${n(settings[titleSzK],1.1)}rem`,
                              fontWeight:600, letterSpacing:'-0.03em',
                              color:(settings[titleColK] as string)||'#2B9FD8', lineHeight:1.1 }}>
                              {(settings[titleKey] as string)||(isLeft ? 'Step Into' : 'Premium Comfort')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

            </div>

            {/* Right: phone-shaped preview */}
            <div style={{ position:'sticky', top:90 }}>
              <p style={{ fontSize:'0.72rem', fontWeight:800, color:'#9badb8',
                textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:10, textAlign:'center' }}>
                Live Mobile Preview
              </p>
              {/* Phone shell */}
              <div style={{
                margin:'0 auto',
                width:220, height:440,
                background:'#1a1a2e',
                borderRadius:28,
                padding:8,
                boxShadow:'0 20px 60px rgba(0,0,0,0.25), inset 0 0 0 1px rgba(255,255,255,0.08)',
                position:'relative',
              }}>
                {/* Notch */}
                <div style={{ position:'absolute', top:10, left:'50%', transform:'translateX(-50%)',
                  width:50, height:8, background:'#2a2a3e', borderRadius:4, zIndex:10 }}/>
                {/* Screen */}
                <div style={{
                  width:'100%', height:'100%',
                  borderRadius:22,
                  background: typeof settings.hero_gradient_visible!=='undefined'&&settings.hero_gradient_visible===false ? '#eaf3fa' : '#eaf3fa',
                  overflow:'hidden', position:'relative',
                }}>
                  {/* Gradient wash */}
                  <div style={{ position:'absolute', inset:0,
                    background:`radial-gradient(ellipse at 50% 0%,rgba(43,159,216,0.22),transparent 55%)` }}/>

                  {/* Shoe image placeholder */}
                  <img src="/frames/ffout001.gif" alt=""
                    style={{ position:'absolute', left:'50%', top:'38%',
                      transform:'translate(-50%,-50%)',
                      width:'75%', objectFit:'contain', zIndex:1 }} />

                  {/* Star */}
                  {(settings.hero_m_star_visible !== false) && (()=>{
                    const sz = n(settings.hero_m_star_size,28)*0.55;
                    const r1=sz/2,r2=sz/8;
                    const pts=Array.from({length:8},(_,i)=>{const a=(i*Math.PI)/4-Math.PI/2;const r=i%2===0?r1:r2;return `${r1+r*Math.cos(a)},${r1+r*Math.sin(a)}`;}).join(' ');
                    return (
                      <div style={{ position:'absolute',
                        left:`${n(settings.hero_m_star_x_pct,10)}%`,
                        top:`${n(settings.hero_m_star_y_pct,32)}%`,
                        transform:'translate(-50%,-50%)', zIndex:5 }}>
                        <svg width={sz} height={sz} viewBox={`0 0 ${sz} ${sz}`}
                          fill={typeof settings.hero_star_color==='string'?settings.hero_star_color:'#FF6B35'}
                          style={{ animation:'spin 8s linear infinite' }}>
                          <polygon points={pts}/>
                        </svg>
                      </div>
                    );
                  })()}

                  {/* Intro block */}
                  {(settings.hero_m_intro_visible!==false) && (
                    <div style={{
                      position:'absolute',
                      left:'50%', top:`${n(settings.hero_m_intro_y_pct,72)}%`,
                      transform:'translate(-50%,-50%)',
                      textAlign:(settings.hero_m_intro_align as 'left'|'center'|'right')||'center',
                      width:'88%', zIndex:4,
                    }}>
                      {(settings.hero_m_eyebrow_visible!==false) && (
                        <p style={{ fontSize:n(settings.hero_m_eyebrow_size_px,9)*0.55,
                          textTransform:'uppercase', letterSpacing:'0.22em',
                          color:typeof settings.hero_overlay_color==='string'?settings.hero_overlay_color:'#2B9FD8',
                          marginBottom:4 }}>
                          {typeof settings.hero_eyebrow==='string'?settings.hero_eyebrow:'Aether 01'}
                        </p>
                      )}
                      {(settings.hero_m_headline_visible!==false) && (
                        <h2 style={{
                          fontSize:`${n(settings.hero_m_intro_font_size_rem,1.35)*0.52}rem`,
                          fontWeight:600, letterSpacing:'-0.03em', lineHeight:1.15,
                          color:typeof settings.hero_text_color==='string'?settings.hero_text_color:'#2B9FD8',
                        }}>
                          {typeof settings.hero_headline==='string'?settings.hero_headline:'Step Into'}{' '}
                          {typeof settings.hero_highlight==='string'?settings.hero_highlight:'Premium'}{' '}
                          {typeof settings.hero_headline2==='string'?settings.hero_headline2:'Comfort'}
                        </h2>
                      )}
                    </div>
                  )}

                  {/* Offer tag */}
                  {(settings.hero_m_offer_visible!==false) && (
                    <div style={{
                      position:'absolute',
                      left:`${n(settings.hero_m_offer_x_pct,3)}%`,
                      top:`${n(settings.hero_m_offer_y_pct,7)}%`,
                      width: n(settings.hero_m_offer_width_px,128)*0.54,
                      zIndex:5,
                    }}>
                      <div style={{
                        background:typeof settings.hero_offer_bg==='string'?settings.hero_offer_bg:'#fff',
                        borderRadius:5, padding:'4px 6px',
                        boxShadow:'0 3px 10px rgba(0,0,0,0.10)',
                      }}>
                        <div style={{
                          background:typeof settings.hero_offer_accent==='string'?settings.hero_offer_accent:'#2B9FD8',
                          color:'#fff', fontSize:'0.32rem', fontWeight:800,
                          padding:'1px 4px', borderRadius:2, display:'inline-block',
                          textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:2,
                        }}>
                          {typeof settings.hero_offer_tag==='string'?settings.hero_offer_tag:'Featured Drop'}
                        </div>
                        <div style={{ fontSize:'0.38rem', fontWeight:700,
                          color:typeof settings.hero_offer_text_color==='string'?settings.hero_offer_text_color:'#1a1a2e' }}>
                          {typeof settings.hero_offer_title==='string'?settings.hero_offer_title:'New Arrivals'}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Scroll prompt */}
                  {(settings.hero_m_prompt_visible!==false) && (
                    <div style={{ position:'absolute', bottom:12, left:'50%',
                      transform:'translateX(-50%)', textAlign:'center', zIndex:4 }}>
                      <p style={{ fontSize:'0.3rem', textTransform:'uppercase',
                        letterSpacing:'0.2em', color:'#2B9FD8' }}>
                        {typeof settings.hero_prompt_text==='string'?settings.hero_prompt_text:'Scroll to Explore'}
                      </p>
                    </div>
                  )}

                  {/* Mobile Left overlay in preview */}
                  {settings.hero_m_left_visible === true && (
                    <div style={{
                      position:'absolute',
                      left:`${n(settings.hero_m_left_x_pct,4)}%`,
                      top:`${n(settings.hero_m_left_y_pct,18)}%`,
                      zIndex:5, maxWidth:'42%',
                    }}>
                      <p style={{ fontSize:'0.28rem', textTransform:'uppercase',
                        letterSpacing:'0.18em', color:(settings.hero_m_left_label_color as string)||'#2B9FD8',
                        marginBottom:2 }}>
                        {(settings.hero_m_left_label as string)||'Cushion'}
                      </p>
                      <p style={{
                        fontSize:`${n(settings.hero_m_left_title_size,1.1)*0.32}rem`,
                        fontWeight:600, letterSpacing:'-0.02em', lineHeight:1.1,
                        color:(settings.hero_m_left_title_color as string)||'#2B9FD8',
                      }}>
                        {(settings.hero_m_left_title as string)||'Step Into'}
                      </p>
                    </div>
                  )}

                  {/* Mobile Right overlay in preview */}
                  {settings.hero_m_right_visible === true && (
                    <div style={{
                      position:'absolute',
                      right:`${n(settings.hero_m_right_x_pct,4)}%`,
                      bottom:`${n(settings.hero_m_right_y_pct,18)}%`,
                      zIndex:5, maxWidth:'42%', textAlign:'right',
                    }}>
                      <p style={{ fontSize:'0.28rem', textTransform:'uppercase',
                        letterSpacing:'0.18em', color:(settings.hero_m_right_label_color as string)||'#2B9FD8',
                        marginBottom:2 }}>
                        {(settings.hero_m_right_label as string)||'Structure'}
                      </p>
                      <p style={{
                        fontSize:`${n(settings.hero_m_right_title_size,1.1)*0.32}rem`,
                        fontWeight:600, letterSpacing:'-0.02em', lineHeight:1.1,
                        color:(settings.hero_m_right_title_color as string)||'#2B9FD8',
                      }}>
                        {(settings.hero_m_right_title as string)||'Premium Comfort'}
                      </p>
                    </div>
                  )}

                  {/* Skip button */}
                  {(settings.hero_m_skip_visible!==false) && (
                    <div style={{ position:'absolute', bottom:n(settings.hero_m_skip_y_px,16)*0.25,
                      left:'50%', transform:'translateX(-50%)', zIndex:5 }}>
                      <div style={{
                        display:'inline-flex', alignItems:'center', gap:2,
                        background:'rgba(43,159,216,0.12)',
                        border:'1px solid rgba(43,159,216,0.3)',
                        borderRadius:10, padding:'2px 6px',
                      }}>
                        <svg width="4" height="4" viewBox="0 0 12 12" fill="none">
                          <path d="M2 3l4 3-4 3V3zM7 3h1.5v6H7V3z" fill="#2B9FD8"/>
                        </svg>
                        <span style={{ fontSize:'0.28rem', fontWeight:700, color:'#2B9FD8',
                          letterSpacing:'0.05em', textTransform:'uppercase' }}>
                          {typeof settings.hero_skip_text==='string'?settings.hero_skip_text:'Skip'}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Screen percentage badge */}
                  <div style={{ position:'absolute', top:8, right:8,
                    background:'rgba(239,68,68,0.85)', color:'#fff',
                    fontSize:'0.3rem', fontWeight:800, padding:'2px 5px', borderRadius:8 }}>
                    Mobile
                  </div>
                </div>

                {/* Home button */}
                <div style={{ position:'absolute', bottom:-18, left:'50%',
                  transform:'translateX(-50%)', width:26, height:26, borderRadius:'50%',
                  background:'#2a2a3e', border:'2px solid #3a3a5e' }}/>
              </div>

              {/* Reset mobile button */}
              <div style={{ textAlign:'center', marginTop:20 }}>
                <button type="button"
                  onClick={()=>{
                    if(!window.confirm('Reset all Mobile Hero settings to defaults?')) return;
                    const mobileDefaults: Record<string,unknown> = {
                      hero_m_intro_font_size_rem:1.35, hero_m_eyebrow_size_px:9,
                      hero_m_sub_size_rem:0.78, hero_m_prompt_size_px:8.5,
                      hero_m_intro_y_pct:72, hero_m_intro_max_width_px:340,
                      hero_m_scroll_height_vh:280, hero_m_intro_align:'center',
                      hero_m_intro_visible:true, hero_m_eyebrow_visible:true,
                      hero_m_headline_visible:true, hero_m_sub_visible:false,
                      hero_m_prompt_visible:true, hero_m_overlay_left_visible:false,
                      hero_m_overlay_right_visible:false, hero_m_star_visible:true,
                      hero_m_offer_visible:true, hero_m_skip_visible:true,
                      hero_m_star_size:28, hero_m_star_x_pct:10, hero_m_star_y_pct:32,
                      hero_m_offer_width_px:128, hero_m_offer_x_pct:3, hero_m_offer_y_pct:7,
                      hero_m_skip_y_px:16, hero_m_skip_size_px:10,
                      hero_m_left_visible:false, hero_m_left_label:'', hero_m_left_title:'Step Into',
                      hero_m_left_label_size:8, hero_m_left_title_size:1.1,
                      hero_m_left_label_color:'#2B9FD8', hero_m_left_title_color:'#2B9FD8',
                      hero_m_left_x_pct:4, hero_m_left_y_pct:18,
                      hero_m_right_visible:false, hero_m_right_label:'', hero_m_right_title:'Premium Comfort',
                      hero_m_right_label_size:8, hero_m_right_title_size:1.1,
                      hero_m_right_label_color:'#2B9FD8', hero_m_right_title_color:'#2B9FD8',
                      hero_m_right_x_pct:4, hero_m_right_y_pct:18,
                      hero_m_prompt_x_pct:50, hero_m_prompt_y_px:20,
                    };
                    Object.entries(mobileDefaults).forEach(([k,v])=>setField(k,v));
                  }}
                  style={{ padding:'8px 18px', border:'1.5px solid #fca5a5', borderRadius:8,
                    background:'#fff', color:'#ef4444', cursor:'pointer', fontSize:'0.8rem',
                    fontWeight:600, fontFamily:'inherit' }}>
                  ↺ Reset Mobile Defaults
                </button>
              </div>
            </div>
          </div>

          {/* Save */}
          <div style={{ display:'flex', justifyContent:'flex-end', paddingTop:14, borderTop:'1px solid #d0e6f5' }}>
            <button type="button"
              onClick={async()=>{
                const mobileKeys = [
                  'hero_m_intro_font_size_rem','hero_m_eyebrow_size_px','hero_m_sub_size_rem',
                  'hero_m_prompt_size_px','hero_m_intro_y_pct','hero_m_intro_max_width_px',
                  'hero_m_scroll_height_vh','hero_m_intro_align','hero_m_intro_visible',
                  'hero_m_eyebrow_visible','hero_m_headline_visible','hero_m_sub_visible',
                  'hero_m_prompt_visible','hero_m_overlay_left_visible','hero_m_overlay_right_visible',
                  'hero_m_star_visible','hero_m_offer_visible','hero_m_skip_visible',
                  'hero_m_star_size','hero_m_star_x_pct','hero_m_star_y_pct',
                  'hero_m_offer_width_px','hero_m_offer_x_pct','hero_m_offer_y_pct',
                  'hero_m_skip_y_px','hero_m_skip_size_px','hero_m_prompt_x_pct','hero_m_prompt_y_px',
                  'hero_m_left_visible','hero_m_left_label','hero_m_left_title',
                  'hero_m_left_label_size','hero_m_left_title_size',
                  'hero_m_left_label_color','hero_m_left_title_color',
                  'hero_m_left_x_pct','hero_m_left_y_pct',
                  'hero_m_right_visible','hero_m_right_label','hero_m_right_title',
                  'hero_m_right_label_size','hero_m_right_title_size',
                  'hero_m_right_label_color','hero_m_right_title_color',
                  'hero_m_right_x_pct','hero_m_right_y_pct',
                ];
                const payload: Record<string,unknown> = {};
                mobileKeys.forEach(k=>{payload[k]=settings[k]??undefined;});
                const res = await saveAdminSettings(payload);
                flash(res.success?'Mobile hero saved!':(res.error||'Save failed'));
              }}
              style={{ padding:'11px 28px', background:'linear-gradient(135deg,#6366f1,#4f46e5)',
                color:'#fff', border:'none', borderRadius:10, fontWeight:700,
                fontSize:'0.9rem', cursor:'pointer', fontFamily:'inherit' }}>
              💾 Save Mobile Hero
            </button>
          </div>
        </div>
      )}

    </section>
  );
}
