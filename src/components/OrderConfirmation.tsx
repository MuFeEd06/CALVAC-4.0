import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import type { ConfirmedOrder } from '@/types/api';
import { formatPrice } from '@/utils';
import { orderWhatsAppUrl } from '@/utils/whatsapp';

export default function OrderConfirmation({order:initial,onChange,autoPoll=false}:{order:ConfirmedOrder;onChange?:(order:ConfirmedOrder)=>void;autoPoll?:boolean}) {
  const [order,setOrder]=useState(initial),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState('');
  const [paymentSubmitted,setPaymentSubmitted]=useState(false);
  useEffect(()=>setOrder(initial),[initial]);
  const online=order.payment_method==='razorpay';
  const paid=order.payment_status==='paid';
  const eligible=online&&order.status==='Pending'&&['pending','failed'].includes(order.payment_status||'pending');
  const update=(next:ConfirmedOrder)=>{const value={...order,...next,customer:order.customer};setOrder(value);onChange?.(value);};
  const refresh=async()=>{
    const {fetchCustomerOrder}=await import('@/api/customer');const next=await fetchCustomerOrder(order.id);update(next);return next;
  };
  useEffect(()=>{
    if((!autoPoll&&!paymentSubmitted)||!online||paid||order.status==='Cancelled')return;
    let stopped=false,attempts=0,timer:ReturnType<typeof setTimeout>;
    const poll=async()=>{
      if(document.hidden){if(!stopped)timer=setTimeout(poll,5000);return;}
      try{const {fetchCustomerOrder}=await import('@/api/customer');const next=await fetchCustomerOrder(order.id);
        if(stopped)return;update(next);if(next.payment_status==='paid'||next.status==='Cancelled')return;
      }catch{/* Keep the saved order visible; the customer can retry status explicitly. */}
      if(!stopped&&++attempts<12)timer=setTimeout(poll,2500);
    };
    timer=setTimeout(poll,2500);return()=>{stopped=true;clearTimeout(timer);};
  },[order.id,online,paid,order.status,autoPoll,paymentSubmitted]);
  const run=async(action:()=>Promise<unknown>)=>{if(busy)return;setBusy(true);setError('');try{await action();}catch(error){setError(error instanceof Error?error.message:'Could not complete this request.');}finally{setBusy(false);}};
  return <section className="account-card order-confirmation">
    <h1>{online?(paid?'Payment confirmed':order.status==='Cancelled'?'Order cancelled':'Payment pending'):'Order received'}</h1>
    <p>Order #{order.id} · {formatPrice(Number(order.total))} · {online?'Online payment':order.payment_method==='cod'?'Cash on delivery':'WhatsApp'}</p>
    <p>{online?(paid?'Your payment has been confirmed by the payment provider.':order.status==='Cancelled'?'This order is closed.':'Your order is saved. Payment will be confirmed after the provider verifies it.'):'Your order has been saved. You can reopen the WhatsApp message without placing another order.'}</p>
    {order.payment_status==='refund_required'&&<p role="alert">A payment was received for this cancelled order. Contact CALVAC for a refund review.</p>}
    {eligible&&<>
      {order.payment_expires_at&&<p>Complete payment before {new Date(order.payment_expires_at).toLocaleTimeString('en-IN',{hour:'2-digit',minute:'2-digit'})}.</p>}
      <button className="primary-link" disabled={busy} onClick={()=>void run(async()=>{
        const {payOnline}=await import('@/utils/razorpay');await payOnline(order,order.customer);setPaymentSubmitted(true);setMessage('Payment submitted. Checking confirmation…');await refresh();
      })}>{busy?'Please wait…':'Pay online'}</button>{' '}
      <button disabled={busy} onClick={()=>void run(async()=>{
        const {customerRequest}=await import('@/api/customer');await customerRequest('/api/account',{method:'POST',body:JSON.stringify({action:'cancel-unpaid',orderId:order.id})});await refresh();
      })}>Cancel unpaid order</button>
    </>}
    {online&&!paid&&<p><button disabled={busy} onClick={()=>void run(refresh)}>Check payment status</button></p>}
    {!online&&<a className="primary-link" href={orderWhatsAppUrl(order,window.location.origin)} target="_blank" rel="noopener noreferrer">Confirm Order in WhatsApp</a>}
    {error&&<p role="alert" className="load-error">{error}</p>}{message&&<p role="status">{message}</p>}
    <p><Link to="/account/orders">My orders</Link> · <Link to="/shop">Continue shopping</Link></p>
  </section>;
}
