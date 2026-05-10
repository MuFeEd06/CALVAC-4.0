import { useEffect, useRef, useState } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'framer-motion';
import type { SiteSettings } from '@/types';

/* ─── Frame configuration ────────────────────────────────────────────
   FRAME_COUNT : how many frames in your sequence (you have 120)
   FRAMES_BASE : where frames live. Options:
     1. '/frames'                               → Vite public/ (Vercel CDN, 30-day cache)
     2. 'https://ik.imagekit.io/yocxectr4/frames' → ImageKit CDN (better global edge)
   Set VITE_FRAMES_BASE in .env to switch to ImageKit without code changes.
───────────────────────────────────────────────────────────────────── */
const FRAME_COUNT = 120;
const FRAMES_BASE: string =
  (import.meta.env.VITE_FRAMES_BASE as string | undefined) ?? '/frames';
const FRAMES_EXT = FRAMES_BASE.includes('ik.imagekit.io') ? 'gif' : 'gif';

/* ImageKit transform params for frames — smaller quality = faster load */
const IK_FRAME_PARAMS = FRAMES_BASE.includes('ik.imagekit.io')
  ? '?tr=q-60,f-webp,pr-true'   // 60% quality WebP + progressive
  : '';                           // static files: no transform needed

function frameSrc(i: number): string {
  const name = `ffout${String(i + 1).padStart(3, '0')}.${FRAMES_EXT}`;
  return `${FRAMES_BASE}/${name}${IK_FRAME_PARAMS}`;
}

/* ─── Loading strategy ───────────────────────────────────────────────
   Priority 1 (immediate): frame 0 — shown before any scroll
   Priority 2 (fast):      frames 1-29 — cover first scroll movement
   Priority 3 (idle):      frames 30-119 — loaded when browser is idle
───────────────────────────────────────────────────────────────────── */
const PRIORITY_BATCHES = [
  { start: 0,  end: 0,   label: 'first-frame'  }, // instant
  { start: 1,  end: 29,  label: 'early-frames' }, // fast
  { start: 30, end: FRAME_COUNT - 1, label: 'rest' }, // idle
];

/* ─── Types ─────────────────────────────────────────────────────── */
interface Props { settings?: SiteSettings & Record<string, unknown>; }

function num(v: unknown, fb: number)  { const n = Number(v); return Number.isFinite(n) ? n : fb; }
function bool(v: unknown, fb: boolean) {
  if (typeof v === 'boolean') return v;
  if (v === 'true')  return true;
  if (v === 'false') return false;
  return fb;
}
function txt(v: unknown, fb: string) {
  return typeof v === 'string' && v.trim().length > 0 ? v : fb;
}

function useResponsive() {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < 768
  );
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

export default function ScrollyShoeExperience({ settings }: Props) {
  const sectionRef = useRef<HTMLElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const framesRef  = useRef<(HTMLImageElement | null)[]>(Array(FRAME_COUNT).fill(null));
  const loadedRef  = useRef<boolean[]>(Array(FRAME_COUNT).fill(false));
  const [activeFrame, setActiveFrame] = useState(0);
  const [bgColor, setBgColor]         = useState('#f4f8fb');
  const [skipped, setSkipped]         = useState(false);
  const [loadProgress, setLoadProgress] = useState(0); // 0-100
  const isMobile = useResponsive();

  /* ─── Mobile-aware settings ──────────────────────────────────── */
  function mNum(k: string, mk: string, dfb: number, mfb: number) {
    if (isMobile) { const mv = settings?.[mk]; return mv !== undefined ? num(mv, mfb) : mfb; }
    return num(settings?.[k], dfb);
  }
  function mBool(k: string, mk: string, dfb: boolean, mfb: boolean) {
    if (isMobile) { const mv = settings?.[mk]; return mv !== undefined ? bool(mv, mfb) : mfb; }
    return bool(settings?.[k], dfb);
  }
  function mTxt(k: string, mk: string, fb: string) {
    const src = isMobile ? (settings?.[mk] ?? settings?.[k]) : settings?.[k];
    return txt(src, fb);
  }

  const heroImageScale    = num(settings?.hero_image_scale, 1.008);
  const gradientStrength  = num(settings?.hero_gradient_strength, 1);
  const gradientVisible   = bool(settings?.hero_gradient_visible, true);
  const imageVisible      = bool(settings?.hero_image_visible, true);
  const scrollHeightVh    = mNum('hero_scroll_height_vh',  'hero_m_scroll_height_vh',  420, 280);
  const introAlign        = mTxt('hero_intro_align',       'hero_m_intro_align',       'center');
  const introX            = mNum('hero_intro_x_pct',       'hero_m_intro_x_pct',       50,  50);
  const introYPct         = mNum('hero_intro_y_pct',       'hero_m_intro_y_pct',       50,  72);
  const introMaxW         = mNum('hero_intro_max_width_px','hero_m_intro_max_width_px', 960, 340);
  const introYOffset      = mNum('hero_intro_y_offset_px', 'hero_m_intro_y_offset_px', 0,   0);
  const introFontSz       = mNum('hero_intro_font_size_rem','hero_m_intro_font_size_rem',2.25,1.35);
  const eyebrowSize       = mNum('hero_eyebrow_size_px',   'hero_m_eyebrow_size_px',   12,  9);
  const subSize           = mNum('hero_sub_size_rem',      'hero_m_sub_size_rem',       1,   0.78);
  const promptSize        = mNum('hero_prompt_size_px',    'hero_m_prompt_size_px',     10.4,8.5);
  const promptX           = mNum('hero_prompt_x_pct',      'hero_m_prompt_x_pct',       50,  50);
  const promptY           = mNum('hero_prompt_y_px',       'hero_m_prompt_y_px',        32,  20);
  const introVisible      = mBool('hero_intro_visible',         'hero_m_intro_visible',         true, true);
  const eyebrowVisible    = mBool('hero_eyebrow_visible',       'hero_m_eyebrow_visible',       true, true);
  const headlineVisible   = mBool('hero_headline_visible',      'hero_m_headline_visible',      true, true);
  const subVisible        = mBool('hero_sub_visible',           'hero_m_sub_visible',           true, false);
  const promptVisible     = mBool('hero_prompt_visible',        'hero_m_prompt_visible',        true, true);
  const leftVisible       = mBool('hero_overlay_left_visible',  'hero_m_overlay_left_visible',  true, false);
  const rightVisible      = mBool('hero_overlay_right_visible', 'hero_m_overlay_right_visible', true, false);
  const introFadeStart    = num(settings?.hero_intro_fade_start,    0.16);
  const introFadeEnd      = num(settings?.hero_intro_fade_end,      0.30);
  const overlayFadeInStart  = num(settings?.hero_overlay_fade_in_start,  0.22);
  const overlayFadeInEnd    = num(settings?.hero_overlay_fade_in_end,    0.36);
  const overlayFadeOutStart = num(settings?.hero_overlay_fade_out_start, 0.86);
  const overlayFadeOutEnd   = num(settings?.hero_overlay_fade_out_end,   1.00);
  const starVisible = mBool('hero_star_visible','hero_m_star_visible',true,true);
  const starColor   = txt(settings?.hero_star_color,'#FF6B35');
  const starSize    = mNum('hero_star_size','hero_m_star_size',48,28);
  const starX       = mNum('hero_star_x_pct','hero_m_star_x_pct',18,10);
  const starY       = mNum('hero_star_y_pct','hero_m_star_y_pct',55,32);
  const starSpeed   = num(settings?.hero_star_speed,8);
  const offerVisible  = mBool('hero_offer_visible','hero_m_offer_visible',true,true);
  const offerTag      = txt(settings?.hero_offer_tag,'Featured Drop');
  const offerTitle    = txt(settings?.hero_offer_title,'New Arrivals');
  const offerPrice    = txt(settings?.hero_offer_price,'');
  const offerDiscount = txt(settings?.hero_offer_discount,'');
  const offerBg       = txt(settings?.hero_offer_bg,'#ffffff');
  const offerAccent   = txt(settings?.hero_offer_accent,'#2B9FD8');
  const offerTextCol  = txt(settings?.hero_offer_text_color,'#1a1a2e');
  const offerLink     = txt(settings?.hero_offer_link,'/shop?tag=new');
  const offerX        = mNum('hero_offer_x_pct','hero_m_offer_x_pct',3,3);
  const offerY        = mNum('hero_offer_y_pct','hero_m_offer_y_pct',12,7);
  const offerWidth    = mNum('hero_offer_width_px','hero_m_offer_width_px',160,128);
  const skipVisible   = mBool('hero_skip_visible','hero_m_skip_visible',true,true);
  const skipText      = txt(settings?.hero_skip_text,'Skip Animation');
  const skipBg        = txt(settings?.hero_skip_bg,'rgba(43,159,216,0.12)');
  const skipColor     = txt(settings?.hero_skip_color,'#2B9FD8');
  const skipX         = mNum('hero_skip_x_pct','hero_m_skip_x_pct',3,50);
  const skipY         = mNum('hero_skip_y_px','hero_m_skip_y_px',32,16);
  const skipSize      = mNum('hero_skip_size_px','hero_m_skip_size_px',12,10);
  const mobileSkipCenter = isMobile && !settings?.hero_m_skip_x_pct;

  /* ─── Scroll transforms ──────────────────────────────────────── */
  const { scrollYProgress } = useScroll({
    target: sectionRef, offset: ['start start','end end'],
  });
  const overlayY1      = useTransform(scrollYProgress,[0,1],['0%','-35%']);
  const overlayY2      = useTransform(scrollYProgress,[0,1],['8%','-18%']);
  const overlayOpacity = useTransform(scrollYProgress,
    [overlayFadeInStart, overlayFadeInEnd, overlayFadeOutStart, overlayFadeOutEnd],[0,1,1,0]);
  const promptOpacity  = useTransform(scrollYProgress,[0,0.08],[1,0]);
  const introOpacity   = useTransform(scrollYProgress,[0,introFadeStart,introFadeEnd],[1,1,0]);
  const introY         = useTransform(scrollYProgress,[0,introFadeEnd],['0%','-16%']);

  // Offer tag, star and skip button stay fully visible throughout the animation,
  // only fading out in the final 10% of scroll (when overlays also fade out)
  const persistentOpacity = useTransform(
    scrollYProgress,
    [0, overlayFadeOutStart, overlayFadeOutEnd],
    [1, 1, 0]
  );

  useMotionValueEvent(scrollYProgress,'change',latest=>{
    const frame = Math.min(FRAME_COUNT-1, Math.max(0, Math.round(latest*(FRAME_COUNT-1))));
    setActiveFrame(frame);
  });

  /* ─── Canvas draw helper ─────────────────────────────────────── */
  const drawOnCanvas = (canvas: HTMLCanvasElement, img: HTMLImageElement, bg: string) => {
    const ctx = canvas.getContext('2d',{alpha:false});
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio||1,2);
    const nw = Math.max(1,Math.floor(rect.width*dpr));
    const nh = Math.max(1,Math.floor(rect.height*dpr));
    if (canvas.width!==nw||canvas.height!==nh){canvas.width=nw;canvas.height=nh;}
    ctx.setTransform(1,0,0,1,0,0);
    ctx.fillStyle=bg; ctx.fillRect(0,0,canvas.width,canvas.height);
    if (!imageVisible) return;
    const ir=img.width/img.height, cr=canvas.width/canvas.height;
    const sc=ir>cr?canvas.width/img.width:canvas.height/img.height;
    const dw=img.width*sc*heroImageScale, dh=img.height*sc*heroImageScale;
    const x=(canvas.width-dw)/2, y=(canvas.height-dh)/2;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,1,1,img.width-2,img.height-2,x,y,dw,dh);
  };

  /* ─── Smart frame loading ─────────────────────────────────────────
     Strategy:
     1. Load frame 0 synchronously (shown immediately)
     2. Load frames 1-29 right after (covers first scroll zone)
     3. Load frames 30-119 via requestIdleCallback (background)
     This cuts first-paint cost while ensuring smooth scrubbing.
  ────────────────────────────────────────────────────────────────── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let loadedCount = 0;

    const onLoad = (i: number, img: HTMLImageElement, bg: string) => {
      loadedRef.current[i] = true;
      loadedCount++;
      setLoadProgress(Math.round((loadedCount / FRAME_COUNT) * 100));

      if (i === 0) {
        // Sample background colour from first frame corners
        try {
          const sc = document.createElement('canvas');
          const sx = sc.getContext('2d');
          if (sx) {
            sc.width = img.naturalWidth || img.width;
            sc.height = img.naturalHeight || img.height;
            sx.drawImage(img, 0, 0);
            const w = sc.width, h = sc.height;
            if (w > 4 && h > 4) {
              const pts = [[2,2],[w-3,2],[2,h-3],[w-3,h-3]] as const;
              let r=0,g=0,b=0;
              pts.forEach(([px,py])=>{ const d=sx.getImageData(px,py,1,1).data; r+=d[0];g+=d[1];b+=d[2]; });
              const hex=(n:number)=>Math.round(n).toString(16).padStart(2,'0');
              setBgColor(`#${hex(r/4)}${hex(g/4)}${hex(b/4)}`);
            }
          }
        } catch {}
        drawOnCanvas(canvas, img, bg);
      }
    };

    const loadFrame = (i: number, bg: string): Promise<void> => new Promise(resolve => {
      if (framesRef.current[i]?.complete) { resolve(); return; }
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => { onLoad(i, img, bg); resolve(); };
      img.onerror = () => { loadedCount++; resolve(); };
      img.src = frameSrc(i);
      framesRef.current[i] = img;
    });

    // Priority 1: frame 0 — blocks until loaded to paint immediately
    loadFrame(0, '#f4f8fb').then(() => {
      const bg = bgColor;

      // Priority 2: frames 1-29 — load sequentially, fast
      const loadBatch = async (start: number, end: number) => {
        for (let i = start; i <= end && i < FRAME_COUNT; i++) {
          await loadFrame(i, bg);
        }
      };

      loadBatch(1, 29).then(() => {
        // Priority 3: frames 30-end — idle loading
        const loadIdle = (i: number) => {
          if (i >= FRAME_COUNT) return;
          const doLoad = () => loadFrame(i, bg).then(() => loadIdle(i + 1));
          if ('requestIdleCallback' in window) {
            (window as any).requestIdleCallback(doLoad, { timeout: 2000 });
          } else {
            setTimeout(doLoad, 50);
          }
        };
        loadIdle(30);
      });
    });

    const onResize = () => {
      const img = framesRef.current[activeFrame];
      if (img?.complete && img.naturalWidth > 0) drawOnCanvas(canvas, img, bgColor);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Redraw on frame change
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const img = framesRef.current[activeFrame];
    if (!img?.complete || img.naturalWidth <= 0) return;
    const raf = requestAnimationFrame(() => drawOnCanvas(canvas, img, bgColor));
    return () => cancelAnimationFrame(raf);
  }, [activeFrame, bgColor, heroImageScale, imageVisible]);

  /* ── Skip handler ─────────────────────────────────────────────────
     Calculate target BEFORE setSkipped changes section height (420vh→100vh).
     Target = hero offsetTop + one viewport = first content below the sticky frame.
  ──────────────────────────────────────────────────────────────────── */
  const handleSkip = () => {
    const el = sectionRef.current; if (!el) return;
    const target = el.offsetTop + window.innerHeight;
    setSkipped(true);
    requestAnimationFrame(() => {
      window.scrollTo({ top: target, behavior: 'smooth' });
    });
  };
  /* ─── Star polygon ────────────────────────────────────────────── */
  const starPolygon = (s: number) => {
    const r1=s/2, r2=s/8;
    return Array.from({length:8},(_,i)=>{
      const a=(i*Math.PI)/4-Math.PI/2, r=i%2===0?r1:r2;
      return `${r1+r*Math.cos(a)},${r1+r*Math.sin(a)}`;
    }).join(' ');
  };

  const overlayLeftX  = num(settings?.hero_overlay_left_x,  8);
  const overlayLeftY  = num(settings?.hero_overlay_left_y,  20);
  const overlayRightX = num(settings?.hero_overlay_right_x, 8);
  const overlayRightY = num(settings?.hero_overlay_right_y, 16);

  return (
    <main style={{background:bgColor,color:'var(--primary)',fontFamily:'Inter,SF Pro Display,system-ui,sans-serif'}}>
      <section ref={sectionRef} style={{position:'relative',height:skipped?'100vh':`${scrollHeightVh}vh`,background:bgColor}}>
        <div style={{position:'sticky',top:0,height:'100vh',width:'100%',overflow:'hidden',display:'flex',alignItems:'center',justifyContent:'center'}}>
          <canvas ref={canvasRef} style={{width:'100%',height:'100%',background:bgColor}}/>

          {/* Loading progress bar — disappears when fully loaded */}
          {loadProgress < 100 && (
            <div style={{position:'absolute',bottom:0,left:0,right:0,height:2,background:'rgba(43,159,216,0.15)',zIndex:20,pointerEvents:'none'}}>
              <div style={{height:'100%',background:'var(--primary)',transition:'width 0.3s ease',width:`${loadProgress}%`}}/>
            </div>
          )}

          {/* Gradients */}
          {gradientVisible && <>
            <div style={{pointerEvents:'none',position:'absolute',inset:0,background:`radial-gradient(ellipse at 50% 0%,rgba(43,159,216,${0.2*gradientStrength}),transparent 56%)`}}/>
            <div style={{pointerEvents:'none',position:'absolute',inset:0,background:`linear-gradient(125deg,rgba(43,159,216,${0.14*gradientStrength}) 0%,transparent 40%,rgba(43,159,216,${0.08*gradientStrength}) 100%)`}}/>
          </>}

          {/* Intro block — outer div positions, inner motion.div animates only */}
          {introVisible && (
            <div
              style={{
                position: 'absolute',
                zIndex: 3,
                left: isMobile ? '50%' : `${introX}%`,
                top: `${introYPct}%`,
                /* CSS transform handles centering — no conflict with Framer Motion */
                transform: `translate(-50%, -50%) translateY(${introYOffset}px)`,
                width: '100%',
                maxWidth: `${introMaxW}px`,
                pointerEvents: 'none',
              }}
            >
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
                style={{
                  textAlign: introAlign as 'left' | 'center' | 'right',
                  padding: isMobile ? '0 16px' : '0 24px',
                  opacity: introOpacity,
                  y: introY,
                }}
              >
              {eyebrowVisible && (
                <p style={{marginBottom:isMobile?8:16,fontSize:eyebrowSize,textTransform:'uppercase',
                  letterSpacing:'0.28em',color:txt(settings?.hero_overlay_color,'var(--primary)')}}>
                  {txt(settings?.hero_eyebrow,'Aether 01')}
                </p>
              )}
              {headlineVisible && (
                <h1 style={{
                  fontSize:`clamp(${introFontSz}rem,${isMobile?'7':'8'}vw,${introFontSz+2.5}rem)`,
                  fontWeight:600, letterSpacing:'-0.04em',
                  color:txt(settings?.hero_text_color,'var(--primary)'),
                  lineHeight:isMobile?1.15:1.1,
                }}>
                  {txt(settings?.hero_headline,'Step Into')}{' '}
                  {txt(settings?.hero_highlight,'Premium')}{' '}
                  {txt(settings?.hero_headline2,'Comfort')}
                </h1>
              )}
              {subVisible && !isMobile && (
                <p style={{margin:'22px auto 0',maxWidth:620,fontSize:`${subSize}rem`,
                  lineHeight:1.6,color:txt(settings?.hero_sub_color,'var(--text-muted)')}}>
                  {txt(settings?.hero_sub,'Precision-crafted components. Built to disappear into motion.')}
                </p>
              )}
              {subVisible && isMobile && bool(settings?.hero_m_sub_visible,false) && (
                <p style={{margin:'10px auto 0',maxWidth:300,fontSize:`${subSize}rem`,
                  lineHeight:1.5,color:txt(settings?.hero_sub_color,'var(--text-muted)')}}>
                  {txt(settings?.hero_sub,'Precision-crafted components.')}
                </p>
              )}
              </motion.div>
            </div>
          )}

          {/* Desktop Left overlay — unchanged */}
          {!isMobile && bool(settings?.hero_overlay_left_visible, true) && (
            <motion.div style={{y:overlayY1,opacity:overlayOpacity}} className="overlay-left" aria-hidden>
              <p style={{fontSize:12,textTransform:'uppercase',letterSpacing:'0.26em',
                color:txt(settings?.hero_overlay_color,'var(--primary)')}}>
                {txt(settings?.hero_overlay_left_label,'Exploded Architecture')}
              </p>
              <h2 style={{marginTop:12,fontSize:'clamp(2rem,5vw,4rem)',
                fontWeight:600,letterSpacing:'-0.03em',
                color:txt(settings?.hero_text_color,'var(--primary)')}}>
                {txt(settings?.hero_overlay_left_title,'Step Into')}
              </h2>
            </motion.div>
          )}

          {/* Desktop Right overlay — unchanged */}
          {!isMobile && bool(settings?.hero_overlay_right_visible, true) && (
            <motion.div style={{y:overlayY2,opacity:overlayOpacity}} className="overlay-right" aria-hidden>
              <p style={{fontSize:12,textTransform:'uppercase',letterSpacing:'0.26em',
                color:txt(settings?.hero_overlay_color,'var(--primary)')}}>
                {txt(settings?.hero_overlay_right_label,'Cushion + Structure')}
              </p>
              <h2 style={{marginTop:12,fontSize:'clamp(2rem,5vw,4rem)',
                fontWeight:600,letterSpacing:'-0.03em',
                color:txt(settings?.hero_text_color,'var(--primary)')}}>
                {txt(settings?.hero_overlay_right_title,'Premium Comfort')}
              </h2>
            </motion.div>
          )}

          {/* ── Mobile-only Left overlay — completely independent ── */}
          {isMobile && bool(settings?.hero_m_left_visible, false) && (
            <motion.div
              style={{
                y: overlayY1,
                opacity: overlayOpacity,
                pointerEvents: 'none',
                position: 'absolute',
                left: `${num(settings?.hero_m_left_x_pct, 4)}%`,
                top:  `${num(settings?.hero_m_left_y_pct, 18)}%`,
                maxWidth: '44vw',
                zIndex: 4,
              }}
              aria-hidden
            >
              {txt(settings?.hero_m_left_label,'') && (
                <p style={{
                  fontSize: num(settings?.hero_m_left_label_size, 8),
                  textTransform: 'uppercase', letterSpacing: '0.22em',
                  color: txt(settings?.hero_m_left_label_color,'var(--primary)'),
                  marginBottom: 4,
                }}>
                  {txt(settings?.hero_m_left_label, 'Cushion')}
                </p>
              )}
              <h2 style={{
                fontSize: `${num(settings?.hero_m_left_title_size, 1.1)}rem`,
                fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1,
                color: txt(settings?.hero_m_left_title_color,'var(--primary)'),
              }}>
                {txt(settings?.hero_m_left_title, 'Step Into')}
              </h2>
            </motion.div>
          )}

          {/* ── Mobile-only Right overlay — completely independent ── */}
          {isMobile && bool(settings?.hero_m_right_visible, false) && (
            <motion.div
              style={{
                y: overlayY2,
                opacity: overlayOpacity,
                pointerEvents: 'none',
                position: 'absolute',
                right: `${num(settings?.hero_m_right_x_pct, 4)}%`,
                bottom: `${num(settings?.hero_m_right_y_pct, 18)}%`,
                maxWidth: '44vw',
                textAlign: 'right',
                zIndex: 4,
              }}
              aria-hidden
            >
              {txt(settings?.hero_m_right_label,'') && (
                <p style={{
                  fontSize: num(settings?.hero_m_right_label_size, 8),
                  textTransform: 'uppercase', letterSpacing: '0.22em',
                  color: txt(settings?.hero_m_right_label_color,'var(--primary)'),
                  marginBottom: 4,
                }}>
                  {txt(settings?.hero_m_right_label, 'Structure')}
                </p>
              )}
              <h2 style={{
                fontSize: `${num(settings?.hero_m_right_title_size, 1.1)}rem`,
                fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1,
                color: txt(settings?.hero_m_right_title_color,'var(--primary)'),
              }}>
                {txt(settings?.hero_m_right_title, 'Premium Comfort')}
              </h2>
            </motion.div>
          )}

          {/* Scroll prompt */}
          {promptVisible && (
            <motion.div style={{opacity:promptOpacity,left:`${promptX}%`,bottom:`${promptY}px`}} className="scroll-prompt">
              <span style={{fontSize:`${promptSize}px`,textTransform:'uppercase',letterSpacing:'0.24em',color:'var(--primary)'}}>
                {txt(settings?.hero_prompt_text,'Scroll to Explore')}
              </span>
              <span style={{position:'relative',width:isMobile?12:16,height:isMobile?20:28,
                borderRadius:999,border:'1px solid rgba(43,159,216,0.35)'}}>
                <motion.span
                  style={{position:'absolute',left:'50%',top:3,
                    width:isMobile?4:6,height:isMobile?4:6,
                    marginLeft:isMobile?-2:-3,borderRadius:'50%',background:'var(--primary)'}}
                  animate={{y:[0,isMobile?8:12,0],opacity:[0.9,0.35,0.9]}}
                  transition={{duration:1.45,repeat:Infinity,ease:'easeInOut'}}/>
              </span>
            </motion.div>
          )}

          {/* Spinning star */}
          {starVisible && (()=>{
            const pts = starPolygon(starSize);
            return (
              <motion.div style={{position:'absolute',left:`${starX}%`,top:`${starY}%`,
                transform:'translate(-50%,-50%)',zIndex:6,pointerEvents:'none',opacity:persistentOpacity}}
                animate={{rotate:360}} transition={{duration:starSpeed,repeat:Infinity,ease:'linear'}}>
                <svg width={starSize} height={starSize} viewBox={`0 0 ${starSize} ${starSize}`} fill={starColor}>
                  <polygon points={pts}/>
                </svg>
              </motion.div>
            );
          })()}

          {/* Offer tag */}
          {offerVisible && (
            <motion.div style={{position:'absolute',left:`${offerX}%`,top:`${offerY}%`,
              zIndex:8,opacity:persistentOpacity,width:offerWidth,pointerEvents:'auto'}}>
              <a href={offerLink} style={{textDecoration:'none',display:'block'}}>
                <div style={{background:offerBg,borderRadius:isMobile?8:10,
                  padding:isMobile?'8px 10px':'12px 14px',
                  boxShadow:'0 8px 32px rgba(0,0,0,0.12)',
                  border:`1px solid ${offerAccent}22`,cursor:'pointer',transition:'transform 0.2s'}}
                  onMouseEnter={e=>(e.currentTarget.style.transform='translateY(-3px)')}
                  onMouseLeave={e=>(e.currentTarget.style.transform='translateY(0)')}>
                  <div style={{display:'inline-flex',alignItems:'center',gap:4,background:offerAccent,
                    color:'#fff',fontSize:isMobile?'0.5rem':'0.58rem',fontWeight:800,
                    padding:'2px 6px',borderRadius:4,letterSpacing:'0.08em',
                    textTransform:'uppercase',marginBottom:isMobile?4:7}}>
                    {offerTag}
                  </div>
                  <div style={{fontSize:isMobile?'0.72rem':'0.82rem',fontWeight:700,lineHeight:1.25,
                    color:offerTextCol,marginBottom:offerPrice?isMobile?4:8:0}}>
                    {offerTitle}
                  </div>
                  {offerPrice && (
                    <div style={{display:'flex',alignItems:'center',gap:5,flexWrap:'wrap'}}>
                      <span style={{fontSize:isMobile?'0.76rem':'0.88rem',fontWeight:800,color:offerAccent}}>
                        {offerPrice}
                      </span>
                      {offerDiscount && (
                        <span style={{fontSize:'0.6rem',fontWeight:800,background:'#fff0f0',color:'#e53e3e',padding:'1px 4px',borderRadius:4}}>
                          {offerDiscount}
                        </span>
                      )}
                    </div>
                  )}
                  {!isMobile && (
                    <div style={{marginTop:8,fontSize:'0.62rem',fontWeight:700,color:offerAccent}}>
                      Shop now →
                    </div>
                  )}
                </div>
              </a>
            </motion.div>
          )}

          {/* Skip button */}
          {skipVisible && !skipped && (
            <motion.button onClick={handleSkip}
              style={{
                position:'absolute',
                left:mobileSkipCenter?'50%':`${skipX}%`,
                bottom:skipY,
                transform:mobileSkipCenter?'translateX(-50%)':'none',
                zIndex:8, opacity:persistentOpacity as any,
                background:skipBg, border:`1px solid ${skipColor}44`,
                borderRadius:20, padding:isMobile?'5px 11px':'7px 14px',
                cursor:'pointer', display:'flex', alignItems:'center', gap:5,
                backdropFilter:'blur(8px)',
              }}
              whileHover={{scale:1.04}} whileTap={{scale:0.97}}>
              <svg width={isMobile?9:12} height={isMobile?9:12} viewBox="0 0 12 12" fill="none">
                <path d="M2 3l4 3-4 3V3zM7 3h1.5v6H7V3z" fill={skipColor}/>
              </svg>
              <span style={{fontSize:skipSize,fontWeight:700,color:skipColor,
                letterSpacing:'0.06em',textTransform:'uppercase',fontFamily:'inherit'}}>
                {skipText}
              </span>
            </motion.button>
          )}
        </div>
      </section>

      <style>{`
        .scroll-prompt{position:absolute;left:50%;transform:translateX(-50%);z-index:2;display:flex;flex-direction:column;align-items:center;gap:10px;}
        .overlay-left{pointer-events:none;position:absolute;left:${overlayLeftX}%;top:${overlayLeftY}%;max-width:320px;}
        .overlay-right{pointer-events:none;position:absolute;right:${overlayRightX}%;bottom:${overlayRightY}%;max-width:320px;text-align:right;}
        @media(max-width:767px){
          .overlay-left{left:16px;top:12%;max-width:45vw;}
          .overlay-right{right:16px;bottom:14%;max-width:45vw;}
        }
      `}</style>
    </main>
  );
}
