import { motion } from 'framer-motion';
import type { Offer } from '@/types';

const LOGO_URL = 'https://ik.imagekit.io/yocxectr4/logos/logo.png?tr=w-28,h-28,f-webp';

export default function OfferRibbon({ offer }: { offer: Offer }) {
  if (!offer.active || !offer.text) return null;

  const showLogo = offer.show_logo !== false; // default ON

  /* One repeating unit = logo (optional) + text + divider */
  const Unit = ({ dupKey }: { dupKey?: string }) => (
    <span
      key={dupKey}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        padding: '0 28px', whiteSpace: 'nowrap', flexShrink: 0,
      }}
    >
      {showLogo && (
        <img
          src={LOGO_URL}
          alt="CALVAC"
          style={{
            height: 20, width: 'auto',
            objectFit: 'contain',
            // Blend with any bg — multiply keeps dark logos visible on light bg,
            // and looks clean on dark backgrounds too
            mixBlendMode: 'multiply',
            opacity: 0.85,
            flexShrink: 0,
          }}
        />
      )}
      <span style={{
        fontSize: '0.86rem', fontWeight: 700,
        letterSpacing: '0.3px', color: offer.text_color,
      }}>
        {offer.text}
      </span>
      <span style={{ opacity: 0.3, fontSize: '0.7rem', color: offer.text_color }}>✦</span>
    </span>
  );

  /* Enough repetitions to guarantee seamless loop at any viewport width */
  const REPS = 10;

  return (
    <div style={{
      background: offer.bg_color,
      padding: '7px 0',
      overflow: 'hidden',
      position: 'relative',
      zIndex: 50,
      boxShadow: '0 2px 8px rgba(0,0,0,0.07)',
    }}>
      <motion.div
        animate={{ x: [0, '-50%'] }}
        transition={{ repeat: Infinity, duration: 28, ease: 'linear' }}
        style={{ display: 'inline-flex', width: 'max-content', alignItems: 'center' }}
      >
        {Array.from({ length: REPS }).map((_, i) => <Unit key={i} />)}
        {/* Exact duplicate so the loop is perfectly seamless */}
        {Array.from({ length: REPS }).map((_, i) => <Unit key={`d-${i}`} dupKey={`d-${i}`} />)}
      </motion.div>
    </div>
  );
}
