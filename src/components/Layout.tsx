import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import Header from './Header';
import Footer from './Footer';

function CustomCursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let raf: number;
    let rx = 0, ry = 0, tx = 0, ty = 0;

    const onMove = (e: MouseEvent) => { tx = e.clientX; ty = e.clientY; };
    document.addEventListener('mousemove', onMove);

    const tick = () => {
      rx += (tx - rx) * 0.15;
      ry += (ty - ry) * 0.15;
      if (dotRef.current)  { dotRef.current.style.left  = `${tx}px`; dotRef.current.style.top  = `${ty}px`; }
      if (ringRef.current) { ringRef.current.style.left = `${rx}px`; ringRef.current.style.top = `${ry}px`; }
      raf = requestAnimationFrame(tick);
    };
    tick();

    // Grow ring on clickable elements
    const grow = () => { ringRef.current && Object.assign(ringRef.current.style, { width: '48px', height: '48px', opacity: '0.3' }); };
    const shrink = () => { ringRef.current && Object.assign(ringRef.current.style, { width: '32px', height: '32px', opacity: '0.5' }); };
    document.querySelectorAll('a, button, [role="button"]').forEach(el => {
      el.addEventListener('mouseenter', grow);
      el.addEventListener('mouseleave', shrink);
    });

    return () => {
      document.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <div id="cursor-dot" ref={dotRef} />
      <div id="cursor-ring" ref={ringRef} />
    </>
  );
}

export default function Layout() {
  const location = useLocation();

  return (
    <>
      <CustomCursor />
      <Header />
      <AnimatePresence mode="wait">
        <motion.div key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}>
          <Outlet />
        </motion.div>
      </AnimatePresence>
      <Footer />

      {/* WhatsApp float button */}
      <a href="https://wa.me/919645087584" target="_blank" rel="noopener" className="wa-float" aria-label="Chat on WhatsApp">
        <img src="https://ik.imagekit.io/yocxectr4/logos/whatsapp.png?tr=w-55,q-80,f-webp" alt="WhatsApp" />
      </a>
    </>
  );
}
