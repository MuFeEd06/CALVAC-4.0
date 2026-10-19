import { requestJson } from './index';
import { customerAuthHeaders } from '@/lib/customerAuth';
import type { Address } from '@/types';
import type { ConfirmedOrder, Page } from '@/types/api';

export async function customerRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  return requestJson<T>(path, { ...init, headers: { ...await customerAuthHeaders(), 'Content-Type': 'application/json', ...init.headers } },30000);
}
export interface CustomerAccount {
  user: {id: string; email: string};
  profile: { full_name: string; phone: string; address: Address | null };
}
export const fetchAccount = () => customerRequest<CustomerAccount>('/api/account');
export const fetchCustomerOrders = (after?: string | null) => customerRequest<Page<ConfirmedOrder>>('/api/account?resource=orders' + (after ? `&after=${encodeURIComponent(after)}` : ''));
export async function fetchCustomerOrder(id: number | string) {
  const page = await customerRequest<Page<ConfirmedOrder>>(`/api/account?resource=orders&id=${encodeURIComponent(id)}`);
  if (!page.items[0]) throw new Error('Order not found.');
  return page.items[0];
}
export const saveProfile = (address: Address) => customerRequest('/api/account', { method: 'POST', body: JSON.stringify({ full_name: address.name, phone: address.phone, address }) });
