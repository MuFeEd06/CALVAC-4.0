# CALVAC — React + TypeScript Frontend

A full React + TypeScript + Framer Motion upgrade of the CALVAC sneaker store.

## Stack

| Layer | Tech |
|---|---|
| Framework | React 18 + TypeScript |
| Routing | React Router v6 |
| Animations | Framer Motion |
| 3D Model | Three.js (dynamic import, same as before) |
| Build | Vite 5 |
| Styling | CSS Variables (design tokens) — no extra CSS library |
| Icons | Lucide React |

## Project Structure

```
src/
├── api/          — fetch helpers with localStorage TTL cache
├── context/      — CartContext, ToastContext
├── components/   — Header, Footer, Layout, ProductCard, HeroSection,
│                   OfferRibbon, HorizontalScroll, HomeSections
├── pages/        — HomePage, ShopPage, ProductPage, CartPage,
│                   ContactPage, PolicyPage
├── types/        — TypeScript interfaces (Product, Cart, Address, etc.)
├── utils/        — brands, ratings, pricing, size helpers
└── styles/       — globals.css with CSS custom properties
```

## What's upgraded vs original

- **Page transitions** — Framer Motion `AnimatePresence` fade/slide between routes
- **Custom animated cursor** — dot + ring that follows mouse
- **Animated cart badge** — springs in when qty changes
- **Product card hover** — lift + shadow via `whileHover`
- **Hero 3D** — same Three.js scene, dynamically loaded, no bundle bloat
- **Offer ribbon** — CSS scroll replaced with Framer Motion infinite animation
- **Color swatch transitions** — image fades with `AnimatePresence`
- **Collapsible specs** — smooth height animation
- **Search dropdown** — animated open/close
- **Mobile nav** — animated hamburger lines + slide-down menu
- **Skeleton loaders** — pulse animation while products load
- **Toast system** — stack-based animated toasts

## API Proxy

The `vite.config.ts` proxies `/api/*` → `https://calvac.in` during dev.

## Getting started

```bash
npm install
npm run dev       # http://localhost:5173
npm run build     # production dist/
```

## Deploying (Vercel)

1. Push this repo to GitHub
2. Import on vercel.com → Framework: Vite
3. Set Environment Variables if needed (none required for frontend-only)
4. Vercel auto-detects `dist/` output

## Flask backend — no changes needed

The React app talks to the same `/api/*` endpoints.  
Your Flask + Supabase backend at `calvac.in` is unchanged.

## Routing map

| React Route | Old Flask Route |
|---|---|
| `/` | `/` |
| `/shop?brand=Nike` | `/brand?brand=Nike` |
| `/shop?tag=new` | `/brand?tag=new` |
| `/shop?q=jordan` | `/brand?q=jordan` |
| `/product/:id` | `/product?id=…` (localStorage) |
| `/cart` | `/cart` |
| `/contact` | `/contact` |
| `/policy/privacy` | `/privacy` |
| `/policy/return` | `/return` |
| `/policy/shipping` | `/shipping` |
