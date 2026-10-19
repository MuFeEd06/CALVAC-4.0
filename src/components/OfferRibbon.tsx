import { motion } from 'framer-motion';
import type { Offer } from '@/types';
import { useColorMode } from '@/theme';
import { normalizeHexColor,readable,rgb } from '@/themeCore';

const LOGO_URL = 'https://ik.imagekit.io/yocxectr4/logos/logo.png?tr=w-28,h-28,f-webp';

export default function OfferRibbon({ offer }: { offer: Offer }) {
  const mode=useColorMode();
  if (!offer.active || !offer.text) return null;
  const background=normalizeHexColor(offer.bg_color,'#EBE9E5'),channels=rgb(background);
  const neutral=Math.max(...channels)-Math.min(...channels)<20;
  const ribbonBackground=neutral?'var(--surface-2)':background;
  const foreground=neutral?'var(--text)':readable(normalizeHexColor(offer.text_color,'#151514'),[background]);

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
            mixBlendMode: 'normal',
            filter:neutral&&mode==='dark'?'invert(1) grayscale(1)':'none',
            opacity: 0.85,
            flexShrink: 0,
          }}
        />
      )}
      <span style={{
        fontSize: '0.86rem', fontWeight: 700,
        letterSpacing: '0.3px', color: foreground,
      }}>
        {offer.text}
      </span>
      <span aria-hidden="true" style={{ opacity: 0.3, fontSize: '0.7rem', color: foreground }}>✦</span>
    </span>
  );

  /* Enough repetitions to guarantee seamless loop at any viewport width */
  const REPS = 10;

  return (
    <div style={{
      background: ribbonBackground,
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
