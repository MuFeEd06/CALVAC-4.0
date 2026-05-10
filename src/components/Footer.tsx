import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer style={{
      background: 'var(--surface)',
      borderTop: '1px solid var(--border)',
      padding: '50px 5% 30px',
      marginTop: 60,
    }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 40,
        marginBottom: 30,
      }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)', fontSize: '1.4rem', fontWeight: 800, marginBottom: 8 }}>CALVAC</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.7, marginBottom: 16 }}>Quality sneakers delivered across India.</p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <a href="https://wa.me/919645087584" target="_blank" rel="noopener"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: '#25D366', borderRadius: '50%', transition: 'transform 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
              <img src="https://ik.imagekit.io/yocxectr4/logos/whatsapp.png?tr=w-22,h-22,f-webp" alt="WhatsApp" style={{ width: 22, height: 22 }} />
            </a>
            <a href="https://www.instagram.com/clc.india__?igsh=MTNvbDhseWQ0dzc0aA==" target="_blank" rel="noopener"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: 'linear-gradient(135deg,#f09433,#dc2743,#bc1888)', borderRadius: '50%', transition: 'transform 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><circle cx="12" cy="12" r="4"/>
                <circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none"/>
              </svg>
            </a>
          </div>
        </div>

        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)', marginBottom: 12, fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Support</h3>
          {[
            { to: '/privacy', label: 'Privacy Policy' },
            { to: '/return', label: 'Return Policy' },
            { to: '/shipping', label: 'Shipping Policy' },
            { to: '/contact', label: 'Contact Us' },
          ].map(({ to, label }) => (
            <Link key={to} to={to} style={{ display: 'block', color: 'var(--text-muted)', marginBottom: 8, fontSize: '0.9rem', transition: 'color 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
              {label}
            </Link>
          ))}
        </div>

        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', color: 'var(--primary)', marginBottom: 12, fontSize: '0.9rem', letterSpacing: '1px', textTransform: 'uppercase' }}>Newsletter</h3>
          <input type="email" placeholder="Your email" style={{
            width: '100%', padding: '10px 14px',
            background: 'var(--surface-2)', border: '1.5px solid var(--border)',
            borderRadius: 8, color: 'var(--text)', fontSize: '0.88rem',
            outline: 'none', marginBottom: 10, fontFamily: 'var(--font-body)',
          }} />
          <button style={{
            padding: '10px 20px', background: 'var(--primary)',
            color: '#fff', border: 'none', borderRadius: 8,
            fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-body)',
            transition: 'background 0.2s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--primary-dark)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'var(--primary)')}>
            Subscribe
          </button>
        </div>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        © 2026 CALVAC — Premium Sneakers
      </p>
    </footer>
  );
}
