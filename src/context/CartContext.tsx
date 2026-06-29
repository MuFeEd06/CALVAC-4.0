import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CartItem, Address } from '@/types';
import { cleanSizeLabel, normalizeSizeUnit } from '@/utils/sizeUnits';

interface CartCtx {
  cart: CartItem[];
  addItem: (item: Omit<CartItem, 'qty'>) => void;
  removeItem: (idx: number) => void;
  changeQty: (idx: number, delta: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  address: Address | null;
  saveAddress: (a: Address) => void;
}

const CartContext = createContext<CartCtx>({} as CartCtx);

function migrateCart(raw: unknown): CartItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => {
    const rawSize = String(item?.size || '').trim();
    const unit = normalizeSizeUnit(item?.size_unit || item?.sizeUnit || rawSize);
    const size = cleanSizeLabel(rawSize);
    const id = Number(item?.id);
    const price = Number(item?.price);
    const qty = Math.max(1, Math.min(10, Number(item?.qty) || 1));
    if (!Number.isFinite(id) || !Number.isFinite(price) || !size) return null;
    return {
      id,
      name: String(item?.name || '').slice(0, 200),
      brand: String(item?.brand || '').slice(0, 100),
      price,
      image: String(item?.image || ''),
      size,
      size_unit: unit,
      color: item?.color ? String(item.color).slice(0, 80) : undefined,
      colorHex: item?.colorHex ? String(item.colorHex).slice(0, 20) : undefined,
      qty,
    } satisfies CartItem;
  }).filter(Boolean) as CartItem[];
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return migrateCart(JSON.parse(localStorage.getItem('calvac_cart') || '[]')); } catch { return []; }
  });
  const [address, setAddress] = useState<Address | null>(() => {
    try { return JSON.parse(localStorage.getItem('claxxic_address') || 'null'); } catch { return null; }
  });

  useEffect(() => {
    localStorage.setItem('calvac_cart', JSON.stringify(cart));
  }, [cart]);

  const addItem = useCallback((item: Omit<CartItem, 'qty'>) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id && i.size === item.size && i.size_unit === item.size_unit && i.color === item.color);
      if (existing) return prev.map(i => i === existing ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { ...item, qty: 1 }];
    });
  }, []);

  const removeItem = useCallback((idx: number) => {
    setCart(prev => prev.filter((_, i) => i !== idx));
  }, []);

  const changeQty = useCallback((idx: number, delta: number) => {
    setCart(prev => {
      const next = prev.map((item, i) => i === idx ? { ...item, qty: item.qty + delta } : item);
      return next.filter(item => item.qty > 0);
    });
  }, []);

  const clearCart = useCallback(() => setCart([]), []);

  const saveAddress = useCallback((a: Address) => {
    setAddress(a);
    localStorage.setItem('claxxic_address', JSON.stringify(a));
  }, []);

  const totalItems = cart.reduce((s, i) => s + i.qty, 0);
  const totalPrice = cart.reduce((s, i) => s + i.price * i.qty, 0);

  return (
    <CartContext.Provider value={{ cart, addItem, removeItem, changeQty, clearCart, totalItems, totalPrice, address, saveAddress }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
