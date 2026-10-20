import { Diamond, Flame, Search, ShoppingBag, Sparkles, Tag, IndianRupee } from 'lucide-react';

/** Theme-aware vectors; collection headers need no image download. */
export default function CollectionIcon({ kind = 'all', size = 36 }: { kind?: string; size?: number }) {
  const Icon = kind === 'search' ? Search : kind === 'sale' ? Tag : kind === 'new' ? Sparkles
    : kind === 'trending' ? Flame : ['premium', 'luxury'].includes(kind) ? Diamond
    : kind.startsWith('under') || kind === 'price' ? IndianRupee : kind === 'bag' ? ShoppingBag : null;
  if (Icon) return <Icon size={size} strokeWidth={1.6} aria-hidden="true" />;
  return <svg width={size} height={size} viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {kind === 'boots' ? <>
      <path d="M8 3h10l-1 13 8 4c3 1 4 3 4 6H6V15H8V3Z" />
      <path d="M6 22h8m3-6-4 3m3-6-4 2M7 26v3h21v-3M11 4v8" />
    </> : kind === 'crocs' ? <>
      <path d="M4 21c0-6 5-10 12-10 7 0 12 4 13 9v6H3v-5h1Z" />
      <path d="M5 20c-3-6-1-10 3-11l5 3M3 22h26" />
      <circle cx="13" cy="16" r=".7" /><circle cx="18" cy="15" r=".7" /><circle cx="23" cy="17" r=".7" />
    </> : <>
      <path d="m3 12 6 3 6-6 6 9 7 3c2 1 2 3 2 6H2V16l1-4Z" />
      <path d="M2 23h28M16 13l-4 2m7 2-4 2M7 15v5h5" />
    </>}
  </svg>;
}
