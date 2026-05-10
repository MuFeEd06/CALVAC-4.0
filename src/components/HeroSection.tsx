import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { SiteSettings } from '@/types';

declare global {
  interface Window {
    THREE: typeof import('three');
    MeshoptDecoder: unknown;
  }
}

interface Props { settings: SiteSettings; }

export default function HeroSection({ settings }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Load THREE + GLTFLoader dynamically
    const scripts: HTMLScriptElement[] = [];
    const loadScript = (src: string) => new Promise<void>(resolve => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = () => resolve();
      document.head.appendChild(s);
      scripts.push(s);
    });

    let animId: number;
    let renderer: import('three').WebGLRenderer | undefined;

    async function init() {
      if (!window.THREE) {
        await loadScript('https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js');
        await loadScript('https://cdn.jsdelivr.net/npm/meshoptimizer@0.18.1/meshopt_decoder.js');
        await loadScript('https://cdn.jsdelivr.net/npm/three@0.128/examples/js/loaders/GLTFLoader.js');
      }

      const THREE = window.THREE;
      if (!THREE || !container) return;

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(75, container.clientWidth / container.clientHeight, 0.1, 1000);
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
      renderer.setSize(container.clientWidth, container.clientHeight);
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      container.appendChild(renderer.domElement);

      scene.add(new THREE.AmbientLight(0xffffff, 1.4));
      const dir = new THREE.DirectionalLight(0xffffff, 1.2);
      dir.position.set(5, 5, 5);
      scene.add(dir);

      const MODEL_SCALE = settings.model_scale || 3;
      const MODEL_Y     = settings.model_y || 0.8;
      const MODEL_SPEED = settings.model_speed || 0.006;
      camera.position.set(0, MODEL_Y, 12);

      let sneaker: import('three').Object3D | undefined;
      let introProgress = 0;
      let introAnim = true;
      let floatTime = 0;
      let mouseX = 0, mouseY = 0;

      const loader = new (window as any).THREE.GLTFLoader();
      loader.load(
        'https://ik.imagekit.io/yocxectr4/models/sneaker.glb',
        (gltf: any) => {
          sneaker = gltf.scene;
          sneaker!.scale.set(MODEL_SCALE, MODEL_SCALE, MODEL_SCALE);
          scene.add(sneaker!);
        },
        undefined,
        (err: unknown) => console.warn('Model error:', err)
      );

      const onMouse = (e: MouseEvent) => {
        const rect = container.getBoundingClientRect();
        mouseX = (e.clientX - rect.left) / rect.width - 0.5;
        mouseY = (e.clientY - rect.top)  / rect.height - 0.5;
      };
      document.addEventListener('mousemove', onMouse);

      function animate() {
        animId = requestAnimationFrame(animate);
        if (sneaker) {
          if (introAnim) {
            introProgress += 0.02;
            camera.position.z = 12 - introProgress * 8;
            sneaker.rotation.y += MODEL_SPEED;
            if (camera.position.z <= 4) { camera.position.z = 4; introAnim = false; }
          } else {
            sneaker.rotation.y += MODEL_SPEED * 0.17 + mouseX * 0.02;
            sneaker.rotation.x = -mouseY * 0.2;
            floatTime += 0.03;
            sneaker.position.y = Math.sin(floatTime) * 0.15;
          }
        }
        renderer?.render(scene, camera);
      }
      animate();

      const onResize = () => {
        if (!container || !renderer) return;
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
      };
      window.addEventListener('resize', onResize);

      return () => {
        document.removeEventListener('mousemove', onMouse);
        window.removeEventListener('resize', onResize);
      };
    }

    const cleanupPromise = init();
    return () => {
      cancelAnimationFrame(animId);
      renderer?.dispose();
      if (container.firstChild) container.removeChild(container.firstChild);
      cleanupPromise.then(fn => fn?.());
      scripts.forEach(s => s.remove());
    };
  }, [settings]);

  const tags = [
    { icon: settings['tag1_icon' as keyof SiteSettings] as string || '☁️', title: settings['tag1_title' as keyof SiteSettings] as string || 'Ultra Comfort', sub: settings['tag1_sub' as keyof SiteSettings] as string || 'Cloud-foam cushioning' },
    { icon: settings['tag2_icon' as keyof SiteSettings] as string || '⚡', title: settings['tag2_title' as keyof SiteSettings] as string || 'Lightweight', sub: settings['tag2_sub' as keyof SiteSettings] as string || 'Barely-there feel' },
    { icon: settings['tag3_icon' as keyof SiteSettings] as string || '🎨', title: settings['tag3_title' as keyof SiteSettings] as string || 'Smart Design', sub: settings['tag3_sub' as keyof SiteSettings] as string || 'Modern sportswear style' },
    { icon: settings['tag4_icon' as keyof SiteSettings] as string || '🔒', title: settings['tag4_title' as keyof SiteSettings] as string || 'Maximum Grip', sub: settings['tag4_sub' as keyof SiteSettings] as string || 'Advanced traction sole' },
  ];

  return (
    <section style={{ position: 'relative', minHeight: '80vh', overflow: 'hidden' }}>
      {/* 3D Canvas */}
      <div ref={containerRef} style={{ position: 'absolute', inset: 0, zIndex: 0 }} />

      {/* Gradient overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'linear-gradient(to right, rgba(5,5,15,0.78) 0%, rgba(5,5,15,0.4) 40%, transparent 70%)',
      }} />

      {/* Hero content */}
      <div style={{ position: 'relative', zIndex: 2, minHeight: '80vh', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: '60px 6%' }}>
        <div style={{ maxWidth: 380 }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6 }}
            style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '3px', textTransform: 'uppercase', color: 'var(--primary)', marginBottom: 14 }}>
            {(settings as any).hero_eyebrow || 'New Collection 2026'}
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.6 }}
            style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.4rem, 5vw, 3.8rem)', fontWeight: 900, lineHeight: 1.05, letterSpacing: '-1.5px', color: '#fff', marginBottom: 20, textShadow: '0 2px 40px rgba(0,0,0,0.4)' }}>
            {(settings as any).hero_headline || 'Step Into'}<br />
            <span style={{ color: 'var(--primary)' }}>{(settings as any).hero_highlight || 'Premium'}</span><br />
            {(settings as any).hero_headline2 || 'Comfort'}
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.6 }}
            style={{ fontSize: '1rem', lineHeight: 1.7, color: 'rgba(255,255,255,0.72)', marginBottom: 36, maxWidth: 300 }}>
            {(settings as any).hero_sub || 'Handpicked sneakers from the world\'s top brands. Delivered across India.'}
          </motion.p>

          <motion.a
            href="/shop"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55, duration: 0.6 }}
            whileHover={{ scale: 1.04 }}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '14px 28px', background: 'var(--primary)', color: '#fff',
              fontSize: '0.88rem', fontWeight: 700, letterSpacing: '0.5px',
              borderRadius: 50, textDecoration: 'none', fontFamily: 'var(--font-display)',
            }}>
            {(settings as any).hero_cta || 'Shop Now'}
            <span style={{ background: 'rgba(255,255,255,0.2)', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</span>
          </motion.a>

          {/* Stat pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7, duration: 0.6 }}
            style={{ display: 'flex', gap: 12, marginTop: 40, flexWrap: 'wrap' }}>
            {[
              { num: (settings as any).stat1_num || '56+', label: (settings as any).stat1_label || 'Styles' },
              { num: (settings as any).stat2_num || '17',  label: (settings as any).stat2_label || 'Brands' },
              { num: (settings as any).stat3_num || 'Free',label: (settings as any).stat3_label || 'Shipping' },
            ].map(p => (
              <div key={p.label} style={{
                background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.14)',
                backdropFilter: 'blur(8px)', borderRadius: 50, padding: '8px 16px',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
              }}>
                <span style={{ fontSize: '1rem', fontWeight: 800, color: '#fff', lineHeight: 1, fontFamily: 'var(--font-display)' }}>{p.num}</span>
                <span style={{ fontSize: '0.62rem', letterSpacing: '0.8px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>{p.label}</span>
              </div>
            ))}
          </motion.div>
        </div>
      </div>

      {/* Floating feature tags — desktop right */}
      <div style={{ position: 'absolute', right: '6%', top: '50%', transform: 'translateY(-50%)', display: 'flex', flexDirection: 'column', gap: 14, zIndex: 5 }}
        className="hero-tags-desktop">
        {tags.map((t, i) => (
          <motion.div key={i}
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.2, duration: 0.5 }}
            style={{
              background: 'rgba(10,10,20,0.55)', border: '1px solid rgba(255,255,255,0.12)',
              backdropFilter: 'blur(12px)', borderRadius: 12, padding: '10px 16px',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(43,159,216,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>{t.icon}</div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', fontFamily: 'var(--font-display)' }}>{t.title}</div>
              <div style={{ fontSize: '0.66rem', color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>{t.sub}</div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Scroll hint */}
      <div style={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 5 }}>
        <span style={{ fontSize: '0.62rem', letterSpacing: '2px', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)' }}>Scroll</span>
        <div style={{ width: 4, height: 24, border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
          <motion.div animate={{ y: [3, 14, 3] }} transition={{ repeat: Infinity, duration: 1.6 }}
            style={{ width: 2, height: 6, background: 'var(--primary)', borderRadius: 2, margin: '0 auto' }} />
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) { .hero-tags-desktop { display: none !important; } }
      `}</style>
    </section>
  );
}
