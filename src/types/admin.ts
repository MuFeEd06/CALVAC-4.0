import type { Product } from './index';
import type { ProductSizeUnit } from './index';

export interface AdminUser {
  id: string;
  email?: string;
}

export interface OrderItem {
  name: string;
  size?: string;
  size_unit?: ProductSizeUnit;
  sizeUnit?: ProductSizeUnit;
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
  user_id?:string|null; payment_method?:string; payment_status?:string; razorpay_order_id?:string; razorpay_payment_id?:string;
}

export type AdminProductPayload = Omit<Product, 'id'>;
