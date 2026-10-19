import { useState } from 'react';
import type { Address } from '@/types';
import { cleanInput, validateAddress } from '@/utils/validation';

const fields: Array<[keyof Address,string,number]> = [
  ['name','Full Name *',100],['phone','Phone Number * (10 digits)',14],
  ['line1','House / Flat / Building *',200],['line2','Street / Area / Locality',200],
  ['city','City *',100],['state','State *',100],['pin','PIN Code *',6],['landmark','Landmark (optional)',200],
];
export default function AddressForm({existing,onSave,label='Save Address'}:{existing:Address|null;onSave:(address:Address)=>void|Promise<void>;label?:string}) {
  const [form,setForm]=useState<Address>(existing || {name:'',phone:'',line1:'',city:'',state:'',pin:''});
  const [error,setError]=useState(''); const [saving,setSaving]=useState(false);
  return <form className="address-form" onSubmit={async event => {
    event.preventDefault(); const problem=validateAddress(form); if(problem){setError(problem);return;}
    setSaving(true);setError('');
    try {await onSave(form);} catch(error){setError(error instanceof Error?error.message:'Could not save the address.');}
    finally {setSaving(false);}
  }}>
    {fields.map(([key,placeholder,maxLength])=><label key={key} className="account-field">
      <span>{placeholder.replace(' *','')}</span>
      <input type={key==='phone'||key==='pin'?'tel':'text'} placeholder={placeholder} value={form[key]||''}
        maxLength={maxLength} disabled={saving} autoComplete={key==='name'?'name':key==='phone'?'tel':key==='pin'?'postal-code':undefined}
        onChange={event=>setForm(prev=>({...prev,[key]:cleanInput(event.target.value,maxLength)}))}/>
    </label>)}
    {error&&<p role="alert" className="load-error">{error}</p>}
    <button className="primary-link" disabled={saving} type="submit">{saving?'Saving…':label}</button>
  </form>;
}
