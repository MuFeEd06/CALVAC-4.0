import type { BrandConfig } from '@/types';

export const BRANDS: BrandConfig[] = [
  { name: 'Nike',          slug: 'Nike',          color: '#FF6B35', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/nike.png?tr=w-80,q-80,f-webp' },
  { name: 'Adidas',        slug: 'Adidas',        color: '#00B4D8', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/adidas.png?tr=w-80,q-80,f-webp' },
  { name: 'New Balance',   slug: 'New Balance',   color: '#4CAF50', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/newbalance.png?tr=w-80,q-80,f-webp' },
  { name: 'Vans',          slug: 'Vans',          color: '#FF3CAC', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/vans.png?tr=w-80,q-80,f-webp' },
  { name: 'Converse',      slug: 'Converse',      color: '#F72585', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/converse.png?tr=w-80,q-80,f-webp' },
  { name: 'Puma',          slug: 'Puma',          color: '#FFD60A', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/puma.png?tr=w-80,q-80,f-webp' },
  { name: 'Reebok',        slug: 'Reebok',        color: '#7B2FBE', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/reebok.png?tr=w-80,q-80,f-webp' },
  { name: 'Asics',         slug: 'Asics',         color: '#E63946', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/asics.png?tr=w-80,q-80,f-webp' },
  { name: 'Sketchers',     slug: 'Sketchers',     color: '#2EC4B6', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/sketchers.png?tr=w-80,q-80,f-webp' },
  { name: 'On',            slug: 'On',            color: '#F4A261', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/on.png?tr=w-80,q-80,f-webp' },
  { name: 'Onitsuka',      slug: 'Onitsuka',      color: '#C77DFF', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/onitsuka.png?tr=w-80,q-80,f-webp' },
  { name: 'Lacoste',       slug: 'Lacoste',       color: '#52B788', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/lacoste.png?tr=w-80,q-80,f-webp' },
  { name: 'Brooks',        slug: 'Brooks',        color: '#FF6B6B', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/brooks.png?tr=w-80,q-80,f-webp' },
  { name: 'Timb',          slug: 'Timb',          color: '#D4A373', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/timb.png?tr=w-80,q-80,f-webp' },
  { name: 'Brik',          slug: 'Brik',          color: '#ADB5BD', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/brik.png?tr=w-80,q-80,f-webp' },
  { name: 'Alo',           slug: 'Alo',           color: '#9BF5C8', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/alo.png?tr=w-80,q-80,f-webp' },
  { name: 'Louis Vuitton', slug: 'Louis Vuitton', color: '#C9A84C', logo: 'https://ik.imagekit.io/yocxectr4/logos/brands/louisvuitton.png?tr=w-80,q-80,f-webp' },
];

export function getBrandConfig(name: string): BrandConfig {
  const found = BRANDS.find(b => b.slug.toLowerCase() === name.toLowerCase());
  return found || { name, slug: name, color: '#2B9FD8', logo: '' };
}

export function getRating(id: number): { score: number; count: number } {
  const seed = (id * 9301 + 49297) % 233280;
  const rand = seed / 233280;
  const score = Math.round((3.5 + rand * 1.5) * 10) / 10;
  const count = 18 + Math.floor(((id * 6271 + 28411) % 233280) / 233280 * 402);
  return { score, count };
}

export function formatPrice(num: number): string {
  return '₹' + num.toLocaleString('en-IN');
}

export interface Deal {
  dealPrice: number;
  origPrice: number;
  pct: number;
}

export function getDeal(price: number, original_price?: number): Deal | null {
  if (!original_price || original_price <= price) return null;
  const pct = Math.round(((original_price - price) / original_price) * 100);
  return { dealPrice: price, origPrice: original_price, pct };
}

export const UK_TO_EU: Record<string, string> = {
  'UK 3': 'EU 35', 'UK 3.5': 'EU 36', 'UK 4': 'EU 37',
  'UK 5': 'EU 38', 'UK 6': 'EU 39',  'UK 6.5': 'EU 40',
  'UK 7': 'EU 41', 'UK 8': 'EU 42',  'UK 9': 'EU 43',
  'UK 10': 'EU 44','UK 11': 'EU 45', 'UK 11.5': 'EU 46','UK 12': 'EU 47',
};

export function getSizeLabel(size: string, unit: 'uk' | 'euro'): string {
  if (unit === 'euro') return UK_TO_EU[size] || size;
  return size;
}

export const WHATSAPP_NUMBER = '919645087584';

export const CATEGORIES = [
  { label: 'Boots',      slug: 'boots',     emoji: '👢', path: '/shop?tag=boots'       },
  { label: 'Crocs',      slug: 'crocs',     emoji: '🥿', path: '/shop?tag=crocs'       },
  { label: 'Girls',      slug: 'girls',     emoji: '👟', path: '/shop?tag=girls'       },
  { label: 'Sale',       slug: 'sale',      emoji: '🏷️', path: '/shop?sale=1'          },
  { label: 'Under 1000', slug: 'under1000', emoji: '💰', path: '/shop?max_price=1000'  },
  { label: 'Under 1500', slug: 'under1500', emoji: '💸', path: '/shop?max_price=1500'  },
  { label: 'Under 2500', slug: 'under2500', emoji: '🛍️', path: '/shop?max_price=2500'  },
  { label: 'New',        slug: 'new',       emoji: '✨', path: '/shop?tag=new'          },
  { label: 'Premium',    slug: 'premium',   emoji: '💎', path: '/shop?min_price=2500'  },
  { label: 'All Shoes',  slug: 'all',       emoji: '👟', path: '/shop'                 },
];

const DESC_TEMPLATES = {
  comfort: [
    'engineered with responsive foam cushioning that absorbs impact and returns energy',
    'built on a plush midsole that cradles your foot in cloud-like comfort all day long',
    'featuring a padded collar and cushioned insole that keep fatigue at bay',
    'designed with multi-zone cushioning that adapts to your stride for a personalised fit',
  ],
  material: [
    'crafted from premium full-grain leather upper that ages beautifully',
    'made with engineered mesh that offers superior breathability while keeping its structure',
    'constructed from high-abrasion rubber on the outsole for lasting grip on any surface',
    'assembled with vulcanised rubber and canvas that deliver timeless durability',
  ],
  style: [
    'Its clean silhouette and tonal colourway make it an effortless match for any outfit.',
    'The bold profile and contrasting sole unit command attention on the street and off it.',
    'A minimalist design language keeps it versatile enough to pair with casual or smart looks.',
    'Retro-inspired lines and modern proportions give it a timeless appeal.',
  ],
};

function seededPick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length];
}

export function getProductDescription(id: number, name: string): string {
  const s1 = (id * 7919) % 233280;
  const s2 = (id * 6271 + 1000) % 233280;
  const s3 = (id * 9301 + 49297) % 233280;
  const comfort = seededPick(DESC_TEMPLATES.comfort, s1);
  const material = seededPick(DESC_TEMPLATES.material, s2);
  const style = seededPick(DESC_TEMPLATES.style, s3);
  return `The ${name} is ${comfort}, while ${material}. ${style}`;
}
