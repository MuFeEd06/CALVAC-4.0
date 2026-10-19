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

export const WHATSAPP_NUMBER = '919645087584';

export const CATEGORIES = [
  { label: 'Boots',      slug: 'boots',     emoji: '👢', path: '/shop?category=boots'  },
  { label: 'Crocs',      slug: 'crocs',     emoji: '🥿', path: '/shop?category=crocs'  },
  { label: 'Girls',      slug: 'girls',     emoji: '👟', path: '/shop?category=girls'  },
  { label: 'Sale',       slug: 'sale',      emoji: '🏷️', path: '/shop?sale=1'          },
  { label: 'Under 1000', slug: 'under1000', emoji: '💰', path: '/shop?max_price=1000'  },
  { label: 'Under 1500', slug: 'under1500', emoji: '💸', path: '/shop?max_price=1500'  },
  { label: 'Under 2500', slug: 'under2500', emoji: '🛍️', path: '/shop?max_price=2500'  },
  { label: 'New',        slug: 'new',       emoji: '✨', path: '/shop?tag=new'          },
  { label: 'Premium',    slug: 'premium',   emoji: '💎', path: '/shop?min_price=2500'  },
  { label: 'All Shoes',  slug: 'all',       emoji: '👟', path: '/shop'                 },
];
