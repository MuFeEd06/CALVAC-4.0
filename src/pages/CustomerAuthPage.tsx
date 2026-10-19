import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { localRedirect } from '@/lib/customerAuth';

export default function CustomerAuthPage() {
  const location=useLocation(),navigate=useNavigate(),[search]=useSearchParams();
  const mode=location.pathname.slice(1),redirect=localRedirect(search.get('redirect'));
  const [email,setEmail]=useState(''),[name,setName]=useState(''),[password,setPassword]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  useEffect(()=>{setError('');setNotice('');setPassword('');},[mode]);
  const title=mode==='signup'?'Create your account':mode==='forgot-password'?'Reset your password':mode==='reset-password'?'Choose a new password':'Sign in';
  return <main className="account-shell auth-shell"><h1>{title}</h1><p>Shop, save your delivery details, and follow your orders.</p>
    <form className="account-card" onSubmit={async event=>{
      event.preventDefault();if(busy)return;setBusy(true);setError('');setNotice('');
      try {
        if(!supabase)throw new Error('Customer sign-in is not configured yet.');
        if(mode==='signup'){
          const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:name.trim()},emailRedirectTo:`${locationOrigin()}/auth/callback?redirect=${encodeURIComponent(redirect)}`}});
          if(error)throw error;
          if(!data.session){setNotice('Check your email to confirm your account, then sign in.');return;}
        } else if(mode==='forgot-password'){
          const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${locationOrigin()}/reset-password`});
          if(error)throw error;setNotice('If an account matches this email, you will receive a password reset link.');return;
        } else if(mode==='reset-password'){
          const {data}=await supabase.auth.getSession(); if(!data.session)throw new Error('Open the password reset link from your email.');
          const {error}=await supabase.auth.updateUser({password});if(error)throw error;
        } else {
          const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;
        }
        navigate(redirect,{replace:true});
      }catch(error){setError(mode==='login'?'Unable to sign in. Check your email, password, and email confirmation.':error instanceof Error?error.message:'Unable to complete this request.');}
      finally{setBusy(false);}
    }}>
      {mode==='signup'&&<label className="account-field">Full name<input autoComplete="name" value={name} maxLength={100} required onChange={event=>setName(event.target.value)}/></label>}
      {mode!=='reset-password'&&<label className="account-field">Email<input type="email" autoComplete="email" value={email} maxLength={254} required onChange={event=>setEmail(event.target.value)}/></label>}
      {mode!=='forgot-password'&&<label className="account-field">Password<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} value={password} minLength={mode==='login'?1:8} maxLength={128} required onChange={event=>setPassword(event.target.value)}/></label>}
      {error&&<p role="alert" className="load-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
      <button className="primary-link" disabled={busy}>{busy?'Please wait…':title}</button>
    </form>
    <p><Link to={`${mode==='signup'?'/login':'/signup'}?redirect=${encodeURIComponent(redirect)}`}>{mode==='signup'?'Already registered? Sign in':'Create an account'}</Link></p>
    {mode==='login'&&<p><Link to="/forgot-password">Forgot your password?</Link></p>}
  </main>;
}
const locationOrigin=()=>window.location.origin;

export function AuthCallback() {
  const [error,setError]=useState('');const [search]=useSearchParams();const navigate=useNavigate();
  useEffect(()=>{let active=true;(async()=>{
    try {if(!supabase)throw new Error('Sign-in is not configured.');
      const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw new Error('This confirmation link could not be completed. Please sign in or request a new link.');
      if(active)navigate(localRedirect(search.get('redirect')),{replace:true});
    }catch(error){if(active)setError(error instanceof Error?error.message:'Could not complete sign-in.');}
  })();return()=>{active=false;};},[]);
  return <main className="account-shell">{error?<><p role="alert">{error}</p><Link to="/login">Sign in</Link></>:<p role="status">Completing sign-in…</p>}</main>;
}
