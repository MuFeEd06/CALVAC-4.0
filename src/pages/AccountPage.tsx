import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ApiError } from '@/api';
import { fetchAccount, fetchCustomerOrders, saveProfile, type CustomerAccount } from '@/api/customer';
import { customerSignOut } from '@/lib/customerAuth';
import AddressForm from '@/components/AddressForm';
import OrderConfirmation from '@/components/OrderConfirmation';
import type { ConfirmedOrder } from '@/types/api';

export default function AccountPage() {
  const navigate=useNavigate();const [account,setAccount]=useState<CustomerAccount|null>(null);
  const orderHistory=useLocation().pathname.endsWith('/orders');
  const [orders,setOrders]=useState<ConfirmedOrder[]>([]),[cursor,setCursor]=useState<string|null>(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const load=async()=>{setLoading(true);setError('');try{
    const [user,page]=await Promise.all([fetchAccount(),fetchCustomerOrders()]);setAccount(user);setOrders(page.items);setCursor(page.nextCursor);
  }catch(error){if(error instanceof ApiError&&error.status===401)navigate('/login?redirect=/account',{replace:true});else setError(error instanceof Error?error.message:'Could not load your account.');}
  finally{setLoading(false);}};
  useEffect(()=>{void load();},[]);
  return <main className="account-shell"><h1>{orderHistory?'My orders':'My account'}</h1>
    {loading&&<p role="status">Loading your account…</p>}
    {error&&<p role="alert" className="load-error">{error} <button onClick={()=>void load()}>Try again</button></p>}
    {account&&<>
      <p>{account.user.email}</p><button onClick={async()=>{try{await customerSignOut();navigate('/login',{replace:true});}catch(error){setError(error instanceof Error?error.message:'Could not sign out.');}}}>Sign out</button>
      {!orderHistory&&<section className="account-card"><h2>Saved delivery details</h2><p>Save an address to use on future orders.</p>
        <AddressForm existing={account.profile.address} label="Save delivery details" onSave={async address=>{await saveProfile(address);setNotice('Delivery details saved.');}}/>
        {notice&&<p role="status">{notice}</p>}
      </section>}
      <p><Link to={orderHistory?'/account':'/account/orders'}>{orderHistory?'Account details':'Order history'}</Link></p>
      {!orderHistory&&<h2>My orders</h2>}{orders.length===0&&<p>No orders are linked to this account yet. <Link to="/shop">Browse shoes</Link></p>}
      {orders.map(order=><OrderConfirmation key={order.id} order={order} onChange={next=>setOrders(prev=>prev.map(row=>row.id===next.id?next:row))}/>)}
      {cursor&&<button disabled={loading} onClick={async()=>{setLoading(true);try{const page=await fetchCustomerOrders(cursor);setOrders(prev=>[...prev,...page.items]);setCursor(page.nextCursor);}catch(error){setError(error instanceof Error?error.message:'Could not load more orders.');}finally{setLoading(false);}}}>Load more orders</button>}
    </>}
  </main>;
}
