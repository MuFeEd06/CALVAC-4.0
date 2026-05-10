import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { CartItem, Address } from '@/types';

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

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>(() => {
    try { return JSON.parse(localStorage.getItem('calvac_cart') || '[]'); } catch { return []; }
  });
  const [address, setAddress] = useState<Address | null>(() => {
    try { return JSON.parse(localStorage.getItem('claxxic_address') || 'null'); } catch { return null; }
  });

  useEffect(() => {
    localStorage.setItem('calvac_cart', JSON.stringify(cart));
  }, [cart]);

  const addItem = useCallback((item: Omit<CartItem, 'qty'>) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id && i.size === item.size && i.color === item.color);
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
