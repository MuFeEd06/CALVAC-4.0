import { useEffect,useRef } from 'react';
export default function OrderCooldown({remaining,onClose}:{remaining:number;onClose:()=>void}){
  const dialog=useRef<HTMLDialogElement>(null);
  useEffect(()=>{const element=dialog.current;element?.showModal();return()=>element?.close();},[]);
  return <dialog ref={dialog} className="cooldown-dialog" aria-labelledby="cooldown-title" aria-describedby="cooldown-message" onCancel={onClose}>
    <h2 id="cooldown-title">Your order is already on its way to us.</h2>
    <p id="cooldown-message">A WhatsApp order with these items and sizes was placed recently using this phone number. Check your confirmation or WhatsApp chat before ordering again.</p>
    <p role="status">{remaining>0?`You can place the same order again in ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}.`:'The cooldown has ended.'}</p>
    <button type="button" className="primary-link" autoFocus onClick={onClose}>Got it</button>
  </dialog>;
}
