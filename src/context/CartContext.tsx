import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { CartItem, Address } from '@/types';
import { migrateCart, sameCartItem, MAX_QTY, MAX_LINE_ITEMS } from '@/utils/cart';
import { cleanStr, validateAddress } from '@/utils/validation';

interface CartCtx {
  cart: CartItem[];
  addItem: (item: Omit<CartItem, 'qty'>, available?: number) => boolean;
  removeItem: (idx: number) => void; changeQty: (idx: number, delta: number) => void; clearCart: () => void;
  totalItems: number; totalPrice: number; address: Address | null; saveAddress: (a: Address) => void;
}
const CartContext = createContext<CartCtx>({} as CartCtx);
function readAddress(): Address | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem('calvac_address') || 'null');
    if (saved?.ts > Date.now() - 86_400_000 && saved.data && !validateAddress(saved.data)) return saved.data;
    localStorage.removeItem('claxxic_address');
  } catch {}
  return null;
}
export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return migrateCart(JSON.parse(localStorage.getItem('calvac_cart') || '[]')); } catch { return []; }
  });
  const current = useRef(cart);
  const [address, setAddress] = useState<Address | null>(readAddress);
  useEffect(()=>{const clear=()=>setAddress(null);window.addEventListener('calvac:signout',clear);return()=>window.removeEventListener('calvac:signout',clear);},[]);
  const update = useCallback((next: CartItem[]) => { current.current = next; setCart(next); }, []);
  useEffect(() => { try { localStorage.setItem('calvac_cart', JSON.stringify(cart)); } catch {} }, [cart]);
  const addItem = useCallback((item: Omit<CartItem, 'qty'>, available = MAX_QTY) => {
    const prev = current.current;
    const existing = prev.find(row => sameCartItem(row, item));
    const limit = Math.min(MAX_QTY, Math.max(0, Math.floor(available)));
    if ((existing && existing.qty >= limit) || (!existing && (prev.length >= MAX_LINE_ITEMS || limit < 1))) return false;
    update(existing ? prev.map(row => row === existing ? { ...row, qty: row.qty + 1 } : row) : [...prev, { ...item, qty: 1 }]);
    return true;
  }, [update]);
  const removeItem = useCallback((idx: number) => update(current.current.filter((_, i) => i !== idx)), [update]);
  const changeQty = useCallback((idx: number, delta: number) => {
    if (!Number.isInteger(delta)) return;
    update(current.current.map((row, i) => i === idx ? { ...row, qty: Math.min(MAX_QTY, row.qty + delta) } : row).filter(row => row.qty > 0));
  }, [update]);
  const clearCart = useCallback(() => update([]), [update]);
  const saveAddress = useCallback((a: Address) => {
    const normalized = Object.fromEntries(Object.entries(a).map(([key, value]) => [key, cleanStr(value, ['line1', 'line2', 'landmark'].includes(key) ? 200 : 100)])) as unknown as Address;
    const error = validateAddress(normalized); if (error) throw new Error(error);
    setAddress(normalized);
    try { sessionStorage.setItem('calvac_address', JSON.stringify({ ts: Date.now(), data: normalized })); localStorage.removeItem('claxxic_address'); } catch {}
  }, []);
  return <CartContext.Provider value={{ cart, addItem, removeItem, changeQty, clearCart,
    totalItems: cart.reduce((sum, row) => sum + row.qty, 0), totalPrice: cart.reduce((sum, row) => sum + row.price * row.qty, 0), address, saveAddress }}>{children}</CartContext.Provider>;
}
export const useCart = () => useContext(CartContext);
