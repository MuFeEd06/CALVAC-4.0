import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Resets scroll position to top on every route change.
 * Prevents the "white screen" when navigating back to Home,
 * which has a 420vh hero section that would leave the user
 * mid-scroll inside the canvas.
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);
  return null;
}
