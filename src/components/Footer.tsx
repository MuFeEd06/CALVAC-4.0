import { Link } from 'react-router-dom';
import { WhatsAppIcon, InstagramIcon } from './BrandIcons';

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
            <a href="https://wa.me/919645087584" target="_blank" rel="noopener noreferrer" aria-label="WhatsApp"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: '#25D366', borderRadius: '50%', transition: 'transform 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
              <WhatsAppIcon width={22} height={22} color="#fff"/>
            </a>
            <a href="https://www.instagram.com/clc.india__?igsh=MTNvbDhseWQ0dzc0aA==" target="_blank" rel="noopener noreferrer" aria-label="Instagram"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, background: 'linear-gradient(135deg,#f09433,#dc2743,#bc1888)', borderRadius: '50%', transition: 'transform 0.2s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.1)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}>
              <InstagramIcon width={22} height={22} color="#fff"/>
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
          <h3 style={{ marginBottom: 12 }}>Stay connected</h3>
          <p style={{ color: 'var(--text-muted)', lineHeight: 1.7 }}>Follow our latest arrivals or contact us about sizing and availability.</p>
          <a className="primary-link" href="https://www.instagram.com/clc.india__" target="_blank" rel="noopener noreferrer">Follow on Instagram</a>
        </div>
      </div>

      <p style={{ textAlign: 'center', color: 'var(--text-light)', fontSize: '0.85rem', borderTop: '1px solid var(--border)', paddingTop: 20 }}>
        © 2026 CALVAC — Premium Sneakers
      </p>
    </footer>
  );
}
