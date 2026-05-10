import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { safeMd } from '@/utils/sanitize';

type PolicyType = 'privacy' | 'return' | 'shipping';

const POLICY_LABELS: Record<PolicyType, string> = {
  privacy:  'Privacy Policy',
  return:   'Return Policy',
  shipping: 'Shipping Policy',
};

const DEFAULT_CONTENT: Record<PolicyType, string> = {
  privacy:  '# Privacy Policy\n\nYour privacy is important to us. We do not share your personal data with third parties.',
  return:   '# Return Policy\n\nWe accept returns within 7 days of delivery. Items must be unused and in original packaging.',
  shipping: '# Shipping Policy\n\nWe ship across India. Standard delivery takes 3–7 business days. Free shipping on all orders.',
};

function renderMarkdown(md: string): string {
  // Sanitize INPUT first — strip any HTML the admin may have saved
  const stripped = md.replace(/<[^>]*>/g, '');
  return stripped
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/gs, '<ul>$&</ul>')
    .replace(/\n\n/g, '</p><p>');
}

export default function PolicyPage() {
  const { type } = useParams<{ type: string }>();
  const policyType = (type as PolicyType) || 'privacy';
  const [content, setContent] = useState('');

  useEffect(() => {
    fetch('/api/site-settings').then(r => r.json()).then((s: Record<string, string>) => {
      const key = `policy_${policyType}`;
      setContent(s[key] || DEFAULT_CONTENT[policyType] || '');
    }).catch(() => setContent(DEFAULT_CONTENT[policyType] || ''));
  }, [policyType]);

  const tabs: PolicyType[] = ['privacy', 'return', 'shipping'];
  // Render markdown then sanitize the output
  const safeHtml = safeMd('<p>' + renderMarkdown(content) + '</p>');

  return (
    <main style={{ maxWidth: 760, margin: '40px auto 80px', padding: '0 5%' }}>
      <nav style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {tabs.map(t => (
          <Link key={t} to={`/policy/${t}`}
            style={{
              padding: '7px 18px', borderRadius: 20, fontSize: '0.85rem', fontWeight: 600,
              textDecoration: 'none', border: '1.5px solid var(--border)',
              background: policyType === t ? 'var(--primary)' : 'transparent',
              color: policyType === t ? '#fff' : 'var(--text-muted)',
              borderColor: policyType === t ? 'var(--primary)' : 'var(--border)',
              transition: 'all 0.2s',
            }}>
            {POLICY_LABELS[t]}
          </Link>
        ))}
      </nav>

      <motion.div key={policyType} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 16, padding: '36px 40px', boxShadow: 'var(--shadow)',
          lineHeight: 1.8, color: 'var(--text)',
        }}>
        <style>{`
          .policy-body h1{font-size:1.6rem;font-weight:800;margin-bottom:20px;color:var(--primary);font-family:var(--font-display)}
          .policy-body h2{font-size:1.15rem;font-weight:700;margin:24px 0 10px;font-family:var(--font-display)}
          .policy-body h3{font-size:1rem;font-weight:700;margin:18px 0 8px}
          .policy-body p{margin-bottom:14px}
          .policy-body ul{margin:10px 0 14px 24px}
          .policy-body li{margin-bottom:6px}
          @media(max-width:600px){.policy-body{padding:20px 16px}}
        `}</style>
        <div className="policy-body" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </motion.div>
    </main>
  );
}
