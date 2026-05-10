import type { Product } from './index';

export interface AdminUser {
  id: string;
  email?: string;
}

export interface OrderItem {
  name: string;
  size?: string;
  color?: string;
  qty: number;
  price: number;
  image?: string;
}

export interface AdminOrder {
  id: number;
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pin: string;
  landmark?: string;
  total: number;
  status: 'Pending' | 'Confirmed' | 'Shipped' | 'Delivered' | 'Cancelled';
  notes?: string;
  created_at?: string;
  items: OrderItem[];
}

export type AdminProductPayload = Omit<Product, 'id'>;

