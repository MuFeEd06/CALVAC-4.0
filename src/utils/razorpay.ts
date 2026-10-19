import { customerRequest } from '@/api/customer';
import type { Address } from '@/types';
import type { ConfirmedOrder } from '@/types/api';

type Checkout = { open(): void; on(event: string, callback: () => void): void };
declare global { interface Window { Razorpay?: new(options: Record<string,unknown>) => Checkout; } }
let scriptPromise: Promise<void> | null = null;
function loadGateway() {
  if (window.Razorpay) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve,reject) => {
    const script = document.createElement('script');
    const timer = setTimeout(() => failed(),15000);
    const failed = () => { clearTimeout(timer); script.remove(); scriptPromise=null; reject(new Error('Payment checkout could not load. Please retry.')); };
    script.src='https://checkout.razorpay.com/v1/checkout.js'; script.async=true;
    script.onload=() => { clearTimeout(timer); window.Razorpay ? resolve() : failed(); };
    script.onerror=failed; document.head.appendChild(script);
  });
  return scriptPromise;
}

export async function payOnline(order: ConfirmedOrder, address?: Address) {
  await loadGateway();
  const provider = await customerRequest<{id:string;amount:number;currency:string;keyId:string}>('/api/razorpay/create-order',{
    method:'POST',body:JSON.stringify({orderId:order.id}),
  });
  return new Promise<void>((resolve,reject) => {
    let settled=false;
    const fail = (message: string) => { if (!settled) { settled=true; reject(new Error(message)); } };
    const checkout = new window.Razorpay!({
      key:provider.keyId,order_id:provider.id,amount:provider.amount,currency:provider.currency,
      name:'CALVAC',description:`Order #${order.id}`,prefill:{name:address?.name,contact:address?.phone},
      theme:{color:'#2B9FD8'},
      handler:async (result:Record<string,string>) => {
        if (settled) return;
        try {
          await customerRequest('/api/razorpay/verify',{method:'POST',body:JSON.stringify({...result,orderId:order.id})});
          settled=true; resolve();
        } catch (error) { fail(error instanceof Error ? error.message : 'Could not verify payment. Check your order before retrying.'); }
      },
      modal:{ondismiss:() => fail('Checkout closed. Your order remains unpaid. You can resume it from your account.')},
    });
    // Razorpay supports retrying inside the same checkout; do not treat a failed
    // attempt as a paid order or discard the reserved application order.
    checkout.open();
  });
}
