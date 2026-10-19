import { useEffect, useRef } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Header from './Header';
import Footer from './Footer';
import { fetchSiteSettings } from '@/api';
import { applyThemeSettings } from '@/theme';

/** Apply normalized theme settings to CSS variables. */
function useTheme() {
  const { pathname } = useLocation();
  useEffect(() => {
    let cancelled = false;
    fetchSiteSettings()
      .then(s => { if (!cancelled) applyThemeSettings(s.theme_settings); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [pathname]);
}

function CustomCursor() {
  const dotRef  = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let raf: number | undefined;
    let rx = 0, ry = 0, tx = 0, ty = 0, initialized = false;
    const place = (element: HTMLDivElement | null, x: number, y: number) => {
      if (element) element.style.transform = `translate3d(${x}px,${y}px,0) translate(-50%,-50%)`;
    };
    const tick = () => {
      raf = undefined;
      rx += (tx - rx) * .2; ry += (ty - ry) * .2;
      place(ringRef.current, rx, ry);
      if (Math.abs(rx - tx) + Math.abs(ry - ty) > .2) raf = requestAnimationFrame(tick);
    };
    const move = (event: MouseEvent) => {
      if (document.hidden) return;
      tx = event.clientX; ty = event.clientY;
      if (!initialized) { rx = tx; ry = ty; initialized = true; }
      if (dotRef.current) dotRef.current.style.opacity = '1';
      if (ringRef.current) ringRef.current.style.opacity = '.5';
      place(dotRef.current, tx, ty);
      if (raf === undefined) raf = requestAnimationFrame(tick);
    };
    const over = (event: MouseEvent) => {
      const interactive = event.target instanceof Element && event.target.closest('a,button,[role="button"]');
      if (ringRef.current) Object.assign(ringRef.current.style, { width: interactive ? '48px' : '32px', height: interactive ? '48px' : '32px' });
    };
    const visibility = () => { if (document.hidden && raf !== undefined) { cancelAnimationFrame(raf); raf = undefined; } };
    document.addEventListener('mousemove', move, { passive: true });
    document.addEventListener('mouseover', over);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      document.removeEventListener('mousemove', move); document.removeEventListener('mouseover', over);
      document.removeEventListener('visibilitychange', visibility);
      if (raf !== undefined) cancelAnimationFrame(raf);
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
  useTheme();

  return (
    <>
      <CustomCursor />
      <Header />
      <div key={location.pathname} className="page-content"><Outlet /></div>
      <Footer />

      {/* WhatsApp float button */}
      <a href="https://wa.me/919645087584" target="_blank" rel="noopener noreferrer" className="wa-float" aria-label="Chat on WhatsApp">
        <img src="https://ik.imagekit.io/yocxectr4/logos/whatsapp.png?tr=w-55,q-80,f-webp" alt="WhatsApp" />
      </a>
    </>
  );
}
