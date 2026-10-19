import type { Address, ProductSizeUnit } from './index';

export interface Page<T> { items: T[]; nextCursor: string | null; }
export interface OrderSnapshot {
  product_id: number; name: string; brand: string; qty: number;
  size: string; size_unit: ProductSizeUnit; color: string;
  price: number | string; image: string;
}
export interface ConfirmedOrder {
  id: number | string; total: number | string; status: string;
  items: OrderSnapshot[]; customer?: Address;
  payment_method?: 'whatsapp'|'cod'|'razorpay'|'legacy';
  payment_status?: string; payment_expires_at?: string|null; created_at?: string;
}
export type PaymentMethod = 'whatsapp'|'cod'|'razorpay';
