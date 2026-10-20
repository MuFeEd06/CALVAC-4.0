import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { googleSignInAvailable, supabase } from '@/lib/supabase';
import { localRedirect } from '@/lib/customerAuth';
import { GoogleIcon } from '@/components/BrandIcons';

function resendDeadline(email:string,key:string) {
  try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');return saved?.email===email.trim().toLowerCase()?Math.min(Date.now()+60000,Number(saved.until)||0):0;}catch{return 0;}
}
function saveDeadline(email:string,until:number,key:string) {
  try{sessionStorage.setItem(key,JSON.stringify({email:email.trim().toLowerCase(),until}));}catch{/* Supabase also enforces its own delivery limits. */}
}
const callbackUrl=(redirect:string)=>`${window.location.origin}/auth/callback?redirect=${encodeURIComponent(redirect)}`;

export default function CustomerAuthPage() {
  const location=useLocation(),navigate=useNavigate(),[search]=useSearchParams();
  const mode=location.pathname.slice(1),redirect=localRedirect(search.get('redirect')),verify=mode==='verify-email';
  const recovery=mode==='forgot-password',cooldownKey=recovery?'calvac_recovery_resend':'calvac_verification_resend';
  const [email,setEmail]=useState<string>(()=>typeof location.state?.email==='string'?location.state.email:''),[name,setName]=useState(''),[password,setPassword]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[google,setGoogle]=useState<boolean|null>(null);
  const [deadline,setDeadline]=useState(()=>resendDeadline(email,cooldownKey)),[now,setNow]=useState(Date.now),working=useRef(false);
  const remaining=Math.max(0,Math.ceil((deadline-now)/1000)),social=mode==='login'||mode==='signup';
  const verifyLink=`/verify-email?redirect=${encodeURIComponent(redirect)}`;
  useEffect(()=>{setError('');setNotice('');setPassword('');},[mode]);
  useEffect(()=>{let active=true;if(social){setGoogle(null);googleSignInAvailable().then(value=>{if(active)setGoogle(value);}).catch(()=>{if(active)setGoogle(false);});}return()=>{active=false;};},[social]);
  useEffect(()=>{setDeadline(resendDeadline(email,cooldownKey));setNow(Date.now());},[email,cooldownKey]);
  useEffect(()=>{if(!deadline)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[deadline]);
  const coolDown=()=>{const until=Date.now()+60000;saveDeadline(email,until,cooldownKey);setDeadline(until);setNow(Date.now());};
  const title=mode==='signup'?'Create your account':verify?'Verify your email':mode==='forgot-password'?'Reset your password':mode==='reset-password'?'Choose a new password':'Sign in';
  const failure=(err:unknown)=>{
    const authError=err as {status?:number;code?:string};
    if(authError.status===429){coolDown();setError('Too many requests. Please wait a minute and try again.');}
    else if(mode==='login')setError(authError.code==='email_not_confirmed'?'Confirm your email before signing in. You can request a new verification email below.':'Unable to sign in. Check your email and password.');
    else if(verify)setError('Could not send a verification email. Please wait a minute and try again.');
    else setError(err instanceof Error?err.message:'Unable to complete this request.');
  };
  return <main className="account-shell auth-shell"><h1>{title}</h1><p>{verify?'Enter your registration email to request a new confirmation link.':'Shop, save your delivery details, and follow your orders.'}</p>
    {social&&<div className="social-auth">
      <button type="button" className="google-signin" disabled={busy||google!==true} onClick={async()=>{
        if(working.current)return;working.current=true;setBusy(true);setError('');setNotice('');
        try{
          if(!supabase||!await googleSignInAvailable())throw new Error('Google sign-in is currently unavailable. Please use email.');
          const {error}=await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:callbackUrl(redirect),queryParams:{prompt:'select_account'}}});
          if(error)throw error;
        }catch(err){setError(err instanceof Error?err.message:'Unable to start Google sign-in.');}
        finally{working.current=false;setBusy(false);}
      }}><GoogleIcon/>Continue with Google</button>
      {google===false&&<p className="auth-help">Google sign-in is currently unavailable. You can continue with email.</p>}
      <div className="auth-divider"><span>or continue with email</span></div>
    </div>}
    <form className="account-card" onSubmit={async event=>{
      event.preventDefault();if(working.current||((verify||recovery)&&remaining>0))return;working.current=true;setBusy(true);setError('');setNotice('');
      try {
        if(!supabase)throw new Error('Customer sign-in is not configured yet.');
        if(verify){
          const {error}=await supabase.auth.resend({type:'signup',email:email.trim(),options:{emailRedirectTo:callbackUrl(redirect)}});
          if(error)throw error;coolDown();setNotice('If this email has an account awaiting confirmation, a new verification link has been sent. Check your inbox and spam folder.');return;
        }else if(mode==='signup'){
          const {data,error}=await supabase.auth.signUp({email:email.trim(),password,options:{data:{full_name:name.trim()},emailRedirectTo:callbackUrl(redirect)}});
          if(error)throw error;
          if(!data.session){coolDown();setNotice('Check your email to confirm your account, then sign in.');return;}
        }else if(mode==='forgot-password'){
          const {error}=await supabase.auth.resetPasswordForEmail(email.trim(),{redirectTo:`${window.location.origin}/reset-password`});
          if(error)throw error;coolDown();setNotice('If an account matches this email, you will receive a password reset link.');return;
        }else if(mode==='reset-password'){
          const {data}=await supabase.auth.getSession();if(!data.session)throw new Error('Open the password reset link from your email.');
          const {error}=await supabase.auth.updateUser({password});if(error)throw error;
        }else{
          const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)throw error;
        }
        navigate(redirect,{replace:true});
      }catch(err){failure(err);}
      finally{working.current=false;setBusy(false);}
    }}>
      {mode==='signup'&&<label className="account-field">Full name<input autoComplete="name" value={name} maxLength={100} required onChange={event=>setName(event.target.value)}/></label>}
      {mode!=='reset-password'&&<label className="account-field">Email<input type="email" autoComplete="email" value={email} maxLength={254} required onChange={event=>setEmail(event.target.value)}/></label>}
      {!verify&&mode!=='forgot-password'&&<label className="account-field">Password<input type="password" autoComplete={mode==='login'?'current-password':'new-password'} value={password} minLength={mode==='login'?1:8} maxLength={128} required onChange={event=>setPassword(event.target.value)}/></label>}
      {error&&<p role="alert" className="load-error">{error}</p>}{notice&&<p role="status">{notice}</p>}
      <button className="primary-link" disabled={busy||((verify||recovery)&&remaining>0)}>{busy?'Please wait…':(verify||recovery)&&remaining>0?`Resend available in ${remaining}s`:verify?'Resend verification email':title}</button>
    </form>
    {social&&<p><Link to={verifyLink} state={{email}}>Resend verification email</Link></p>}
    <p><Link to={`${mode==='signup'||verify?'/login':'/signup'}?redirect=${encodeURIComponent(redirect)}`}>{mode==='signup'||verify?'Already registered? Sign in':'Create an account'}</Link></p>
    {mode==='login'&&<p><Link to="/forgot-password">Forgot your password?</Link></p>}
  </main>;
}

export function AuthCallback() {
  const [error,setError]=useState('');const [search]=useSearchParams();const navigate=useNavigate();
  const [providerError]=useState(()=>{const url=new URL(window.location.href),hash=new URLSearchParams(url.hash.slice(1));return url.searchParams.has('error')||hash.has('error')||hash.has('error_description');});
  useEffect(()=>{let active=true;(async()=>{
    try{
      if(providerError)throw new Error('Sign-in was cancelled or the verification link has expired. Please try again.');
      if(!supabase)throw new Error('Sign-in is not configured.');
      // The browser SDK exchanges PKCE codes once during initialization.
      const initialized=await supabase.auth.initialize();if(initialized.error)throw new Error('This sign-in link could not be completed. Please request a new link or try signing in again.');
      const {data,error}=await supabase.auth.getSession();if(error||!data.session)throw new Error('This link could not complete sign-in. If your email is confirmed, sign in below; otherwise request a new verification email.');
      if(active)navigate(localRedirect(search.get('redirect')),{replace:true});
    }catch(err){if(active)setError(err instanceof Error?err.message:'Could not complete sign-in.');}
  })();return()=>{active=false;};},[]);
  return <main className="account-shell">{error?<><p role="alert">{error}</p><p><Link to="/login">Sign in</Link></p><p><Link to="/verify-email">Resend verification email</Link></p></>:<p role="status">Completing sign-in…</p>}</main>;
}
