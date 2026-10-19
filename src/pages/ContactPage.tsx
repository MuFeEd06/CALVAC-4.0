import { motion } from 'framer-motion';
import { WhatsAppIcon, InstagramIcon } from '@/components/BrandIcons';

const cards = [
  { icon: '📦', title: 'Track Your Order', desc: 'Got your order ID? WhatsApp us for a real-time delivery update.', link: null },
  { icon: '↩️', title: 'Returns & Exchanges', desc: 'Not the right fit? We accept returns within 7 days.', link: { label: '→ Return Policy', href: '/return' } },
  { icon: '📏', title: 'Size Help', desc: 'Send us your foot length in cm and we\'ll recommend the right fit.', link: null },
  { icon: '🚚', title: 'Shipping Info', desc: 'We ship across India. Free shipping on all orders. 3–7 business days.', link: { label: '→ Shipping Policy', href: '/shipping' } },
];

const hours = [
  { day: 'Monday – Friday', time: '9:00 AM – 8:00 PM', closed: false },
  { day: 'Saturday', time: '10:00 AM – 6:00 PM', closed: false },
  { day: 'Sunday', time: 'WhatsApp only', closed: true },
];

export default function ContactPage() {
  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '48px 5% 80px' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 48 }}>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: '2.2rem', fontWeight: 800, marginBottom: 10 }}>Get in Touch</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '1rem', maxWidth: 480, margin: '0 auto', lineHeight: 1.7 }}>
          We're here to help with sizing, orders, returns — or just to chat about kicks.
        </p>
      </motion.div>

      {/* WhatsApp */}
      <motion.a href="https://wa.me/919645087584" target="_blank" rel="noopener noreferrer"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(37,211,102,0.3)' }}
        style={{ display: 'flex', alignItems: 'center', gap: 24, background: 'var(--surface)', border:'1px solid var(--border)', borderRadius: 18, padding: '36px 32px', textDecoration: 'none', marginBottom: 24 }}>
        <span className="social-mark social-mark-whatsapp"><WhatsAppIcon width={36} height={36}/></span>
        <div>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4, fontFamily: 'var(--font-display)' }}>Chat on WhatsApp</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', lineHeight: 1.5, marginBottom: 10 }}>
            Fastest way to reach us. Ask about stock, sizing, custom orders, or track your delivery.
          </p>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.2)', color: 'var(--text)', fontWeight: 700, fontSize: '0.88rem', padding: '8px 18px', borderRadius: 'var(--button-radius)' }}>
            💬 Start Chat →
          </span>
        </div>
      </motion.a>

      {/* Instagram */}
      <motion.a href="https://www.instagram.com/clc.india__?igsh=MTNvbDhseWQ0dzc0aA==" target="_blank" rel="noopener noreferrer"
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(220,39,67,0.3)' }}
        style={{ display: 'flex', alignItems: 'center', gap: 24, background: 'var(--surface)', border:'1px solid var(--border)', borderRadius: 18, padding: '28px 32px', textDecoration: 'none', marginBottom: 32 }}>
        <span className="social-mark social-mark-instagram"><InstagramIcon width={36} height={36}/></span>
        <div>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1.1rem', fontWeight: 800, color: 'var(--text)', marginBottom: 4 }}>Follow us on Instagram</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 6 }}>Stay updated with new drops & exclusive offers.</p>
          <span style={{ fontWeight: 700, color: 'var(--text)', fontSize: '0.9rem' }}>@clc.india__</span>
        </div>
      </motion.a>

      {/* Info cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 24, marginBottom: 32 }}>
        {cards.map((c, i) => (
          <motion.div key={c.title}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }}
            whileHover={{ y: -4, borderColor: 'var(--primary)', boxShadow: 'var(--shadow-hover)' }}
            style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 18, padding: '32px 28px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, boxShadow: 'var(--shadow)' }}>
            <div style={{ width: 56, height: 56, borderRadius: 16, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem' }}>{c.icon}</div>
            <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700 }}>{c.title}</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>{c.desc}</p>
            {c.link && <a href={c.link.href} style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>{c.link.label}</a>}
          </motion.div>
        ))}
      </div>

      {/* Hours */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
        style={{ background: 'var(--surface)', border: '1.5px solid var(--border)', borderRadius: 18, padding: 28, boxShadow: 'var(--shadow)' }}>
        <h3 style={{ fontFamily: 'var(--font-display)', fontSize: '1rem', fontWeight: 700, marginBottom: 16 }}>⏰ Response Hours</h3>
        {hours.map(h => (
          <div key={h.day} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: '0.9rem' }}>
            <span style={{ fontWeight: 600 }}>{h.day}</span>
            <span style={{ color: h.closed ? 'var(--text-muted)' : 'var(--primary)', fontWeight: h.closed ? 400 : 700 }}>{h.time}</span>
          </div>
        ))}
      </motion.div>
    </main>
  );
}
