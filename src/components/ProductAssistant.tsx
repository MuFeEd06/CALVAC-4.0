import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {MessageCircle,Send,X,RotateCcw} from 'lucide-react';
import {ApiError,ikResize,requestJson} from '@/api';
import {formatPrice} from '@/utils';
import {FALLBACK_IMAGE,imageFallback} from '@/utils/images';
import type {Product} from '@/types';
import CompanionCharacter from './CompanionCharacter';

interface Match {id:number;name:string;brand:string;price:number;image:string;sizeUnit:string;sizes:string[];unavailable:boolean;color?:string}
interface Answer {reply:string;products:Match[]}
interface Message {role:'user'|'assistant';text:string;products?:Match[]}
export default function ProductAssistant({product,selectedSize,selectedColor}:{product:Product;selectedSize:string;selectedColor:string}) {
  const [messages,setMessages]=useState<Message[]>([{role:'assistant',text:`Hi! I’m your CALVAC guide. Ask about ${product.name}, choosing a size, or finding a pair by brand and budget.`}]);
  const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[pulse,setPulse]=useState(0),[retry,setRetry]=useState('');
  const [isOpen,setOpen]=useState(false);
  const dialog=useRef<HTMLDialogElement>(null),field=useRef<HTMLTextAreaElement>(null),scroll=useRef<HTMLDivElement>(null),launcher=useRef<HTMLButtonElement>(null),pending=useRef<AbortController|null>(null);
  useEffect(()=>()=>{pending.current?.abort();dialog.current?.close();},[]);
  useEffect(()=>{scroll.current?.scrollTo({top:scroll.current.scrollHeight,behavior:'instant'});},[messages,busy,error]);
  const open=()=>{if(!dialog.current?.open){dialog.current?.showModal();setOpen(true);setPulse(value=>value+1);requestAnimationFrame(()=>field.current?.focus());}};
  const send=async(value:string,retrying=false)=>{
    const question=value.trim();if(!question||busy||pending.current)return;
    const controller=new AbortController();pending.current=controller;setBusy(true);setError('');setRetry('');setInput('');setPulse(number=>number+1);
    const previousQuestions=messages.filter(message=>message.role==='user').map(message=>message.text);
    if(retrying&&previousQuestions[previousQuestions.length-1]===question)previousQuestions.pop();
    if(!retrying)setMessages(previous=>[...previous,{role:'user',text:question}]);
    try{
      const answer=await requestJson<Answer>('/api/assistant',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,productId:product.id,selectedColor,previousQuestions:previousQuestions.slice(-3)}),signal:controller.signal},45000);
      if(typeof answer.reply!=='string'||!Array.isArray(answer.products))throw new Error('The guide could not complete that reply.');
      const products=answer.products.filter(match=>Number.isSafeInteger(match.id)&&match.id>0).slice(0,4);
      setMessages(previous=>[...previous,{role:'assistant',text:answer.reply,products}]);setPulse(number=>number+1);
    }catch(err){if(!controller.signal.aborted){setError(err instanceof ApiError&&err.status===429?'You’ve sent several questions. Please wait a moment before trying again.':'The guide is temporarily unavailable. Please try again.');setRetry(question);}}
    finally{if(pending.current===controller)pending.current=null;setBusy(false);}
  };
  return <>
    <button ref={launcher} type="button" className="product-guide-launcher" aria-label="Open CALVAC product guide" aria-haspopup="dialog" onClick={open}>
      <CompanionCharacter pulse={pulse} active={!isOpen}/><span><MessageCircle size={14} aria-hidden="true"/>Ask CALVAC</span><small>Size & style help</small>
    </button>
    <dialog ref={dialog} className="product-guide-dialog" aria-labelledby="product-guide-title" onClose={()=>{setOpen(false);launcher.current?.focus();}} onClick={event=>{if(event.target===dialog.current){const bounds=dialog.current.getBoundingClientRect();if(event.clientX<bounds.left||event.clientX>bounds.right||event.clientY<bounds.top||event.clientY>bounds.bottom)dialog.current.close();}}}>
      <header className="product-guide-header">{isOpen?<CompanionCharacter pulse={pulse}/>:<img src="/companion/character-poster.webp" width="48" height="48" alt=""/>}<div><h2 id="product-guide-title">CALVAC Guide</h2><p>Product & sizing questions</p></div><button type="button" aria-label="Close product guide" onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
      <div ref={scroll} className="product-guide-messages" role="log" aria-label="Product conversation" aria-live="polite" aria-relevant="additions text">
        {messages.map((message,index)=><div key={index} className={`guide-message guide-message-${message.role}`}><p>{message.text}</p>
          {message.products?.map(match=><Link key={match.id} className="guide-product" to={`/product/${match.id}`} onClick={()=>dialog.current?.close()}>
            <img src={ikResize(match.image,160,80)||FALLBACK_IMAGE} onError={imageFallback} width="64" height="64" alt="" loading="lazy"/>
            <span><strong>{match.name}</strong><b>{formatPrice(match.price)}</b>{match.color&&<small>{match.color}</small>}<small>{match.unavailable?'Currently unavailable':match.sizes.length?`${match.sizeUnit} ${match.sizes.join(', ')}`:'Open product to check sizes'}</small></span><span aria-hidden="true">↗</span>
          </Link>)}
        </div>)}
        {busy&&<p role="status" className="guide-thinking">Looking through the catalog<span aria-hidden="true">…</span></p>}
        {error&&<p role="alert" className="guide-error">{error} {retry&&<button type="button" className="text-button" onClick={()=>void send(retry,true)}><RotateCcw size={12} aria-hidden="true"/>Try again</button>}</p>}
      </div>
      {messages.length===1&&<div className="guide-suggestions">{['Help me choose a size',selectedSize?`Is ${product.size_unit} ${selectedSize} in stock?`:'Which sizes are available?','Similar shoes under ₹2500'].map(question=><button type="button" key={question} disabled={busy} onClick={()=>void send(question)}>{question}</button>)}</div>}
      <form className="guide-compose" onSubmit={event=>{event.preventDefault();void send(input);}}><label className="sr-only" htmlFor="product-guide-question">Ask about products or shoe sizes</label><textarea ref={field} id="product-guide-question" value={input} maxLength={600} rows={2} placeholder="Find shoes, ask about fit…" onChange={event=>setInput(event.target.value)} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();void send(input);}}}/><button type="submit" disabled={busy||!input.trim()} aria-label="Send product question"><Send size={18}/></button></form>
      <p className="guide-footnote">Catalog details only. Fit varies by brand and model.</p>
    </dialog>
  </>;
}
