import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, LayoutGrid, MessageCircle, Package, Search, ShoppingBag, Sparkles, Tag, TrendingUp, UserRound, X } from 'lucide-react';
import './sidebar-5.css';

const shopLinks = [
  { to: '/shop', label: 'All Shoes', icon: LayoutGrid },
  { to: '/shop?tag=new', label: 'New Arrivals', icon: Sparkles },
  { to: '/shop?tag=trending', label: 'Trending', icon: TrendingUp },
  { to: '/shop?sale=1', label: 'Sale', icon: Tag },
];
const accountLinks = [
  { to: '/account', label: 'Profile', icon: UserRound },
  { to: '/account/orders', label: 'My Orders', icon: Package },
  { to: '/cart', label: 'Shopping Bag', icon: ShoppingBag },
];
const filterKeys = ['brand', 'tag', 'category', 'q', 'sale', 'min_price', 'max_price'];

/** Storefront adaptation of the supplied Sidebar 5 layout. */
export default function Sidebar5({ onClose, triggerRef, totalItems }: {
  onClose: () => void; triggerRef: RefObject<HTMLButtonElement>; totalItems: number;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const location = useLocation(), navigate = useNavigate();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const trigger = triggerRef.current;
    const bodyOverflow = document.body.style.overflow;
    const rootOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = bodyOverflow;
      document.documentElement.style.overflow = rootOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [triggerRef]);

  const isActive = (to: string) => {
    const [path, search = ''] = to.split('?');
    if (location.pathname !== path) return false;
    const current = new URLSearchParams(location.search), target = new URLSearchParams(search);
    return filterKeys.every(key => (current.get(key) || '') === (target.get(key) || ''));
  };

  const renderLinks = (links: typeof shopLinks) => <ul className="store-drawer-links">
    {links.map(({ to, label, icon: Icon }) => <li key={to}>
      <Link to={to} className="store-drawer-link" aria-current={isActive(to) ? 'page' : undefined} onClick={onClose}>
        <Icon size={20} strokeWidth={1.7} aria-hidden="true" />
        <span>{label}</span>
        {to === '/cart' && totalItems > 0 && <span className="store-drawer-count" aria-label={`${totalItems} items`}>{totalItems}</span>}
        <ArrowUpRight className="store-drawer-link-arrow" size={16} aria-hidden="true" />
      </Link>
    </li>)}
  </ul>;

  return createPortal(<dialog ref={dialogRef} id="store-navigation" className="store-drawer" aria-labelledby="store-menu-title"
    onCancel={event => { event.preventDefault(); onClose(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const dialog = event.currentTarget;
      const controls = Array.from(dialog.querySelectorAll<HTMLElement>('a[href],button,input,[tabindex]'))
        .filter(element => element.tabIndex >= 0 && !element.matches(':disabled') && element.getClientRects().length > 0);
      const first = controls[0], last = controls[controls.length - 1];
      if (!first || !last) return;
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
        event.preventDefault(); last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || document.activeElement === dialog)) {
        event.preventDefault(); first.focus();
      }
    }}
    onClick={event => {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
    }}>
    <div className="store-drawer-panel">
      <div className="store-drawer-header">
        <div className="store-drawer-heading">
          <Link to="/" className="store-drawer-brand" onClick={onClose} aria-label="CALVAC home">
            <span className="store-drawer-monogram" aria-hidden="true">C</span>
            <span><span id="store-menu-title">CALVAC<span className="sr-only"> menu</span></span><small>Footwear with character</small></span>
          </Link>
          <button type="button" className="store-drawer-close" aria-label="Close menu" onClick={onClose} autoFocus><X size={20} aria-hidden="true" /></button>
        </div>
        <form className="store-drawer-search" role="search" onSubmit={event => {
          event.preventDefault();
          const value = query.trim();
          if (value) { navigate(`/shop?q=${encodeURIComponent(value)}`); onClose(); }
        }}>
          <Search size={18} aria-hidden="true" />
          <input type="search" aria-label="Search shoes" placeholder="Find your next pair…" maxLength={100} value={query} onChange={event => setQuery(event.target.value)} required />
          <button type="submit" aria-label="Search collection" disabled={!query.trim()}><ArrowRight size={18} aria-hidden="true" /></button>
        </form>
      </div>

      <nav className="store-drawer-content" aria-label="Store navigation">
        <section className="store-drawer-group" aria-labelledby="store-shop-label">
          <h2 id="store-shop-label">Explore</h2>
          {renderLinks(shopLinks)}
        </section>
        <section className="store-drawer-group" aria-labelledby="store-account-label">
          <h2 id="store-account-label">Your CALVAC</h2>
          {renderLinks(accountLinks)}
        </section>
        <div className="store-drawer-help">
          <MessageCircle size={21} strokeWidth={1.6} aria-hidden="true" />
          <h2>A little help, a better fit.</h2>
          <p>Questions about a pair? We’re here to help you choose.</p>
          <Link to="/contact" onClick={onClose}>Contact CALVAC <ArrowUpRight size={16} aria-hidden="true" /></Link>
        </div>
      </nav>

      <div className="store-drawer-footer"><span className="store-drawer-status" aria-hidden="true" /><span>Considered style. Everyday comfort.</span></div>
    </div>
  </dialog>, document.body);
}
