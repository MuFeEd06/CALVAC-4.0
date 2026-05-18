import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './styles/globals.css'
import './styles/admin.css'
import { fetchProducts, fetchSiteSettings, fetchOffer } from './api'

// Warm up Vercel Python serverless functions immediately on load
// (prevents cold-start blank screens when user navigates to product pages)
fetch('/api/ping').catch(() => {});

// Prefetch core data in background so it's cached before user navigates
setTimeout(() => {
  fetchProducts().catch(() => {});
  fetchSiteSettings().catch(() => {});
  fetchOffer().catch(() => {});
}, 100);

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
