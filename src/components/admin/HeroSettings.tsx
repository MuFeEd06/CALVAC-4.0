import { useState } from 'react';
import { DEFAULT_PARTICLES,SHOES,particleSettings,shoeImage,type HeroView } from '@/hero';
import { getAdminAuthHeaders } from '@/lib/adminAuth';
import { requestJson } from '@/api';
import { prepareHeroUpload } from '@/utils/heroUpload';
import { useColorMode } from '@/theme';
export default function HeroSettings({settings,setField,onSave}:{settings:Record<string,unknown>;setField:(key:string,value:unknown)=>void;onSave:()=>void}){
  const config=particleSettings(settings.particle_hero),mode=String(settings.hero_type||'particles');
  const colorMode=useColorMode();
  const [uploading,setUploading]=useState(''),[error,setError]=useState('');
  const update=(key:string,value:unknown)=>setField('particle_hero',(previous:unknown)=>({...particleSettings(previous),[key]:value}));
  const view=(device:'desktop'|'mobile',key:keyof HeroView,value:string|number)=>setField('particle_hero',(previous:unknown)=>{
    const current=particleSettings(previous);return {...current,[device]:{...current[device],[key]:value}};
  });
  async function upload(device:'desktop'|'mobile',file:File|undefined){
    if(!file)return;
    if(!['image/png','image/webp','image/jpeg'].includes(file.type)||file.size>4*1024*1024){setError('Choose a PNG, WebP or JPEG under 4 MB.');return;}
    setError('');setUploading(device);
    try{const body=new FormData();body.append('image',await prepareHeroUpload(file),'hero.webp');const result=await requestJson<{url:string}>('/api/x9k2/upload',{method:'POST',headers:await getAdminAuthHeaders(),body},30000);view(device,'image',result.url);}
    catch(error){setError(error instanceof Error?error.message:'Image upload failed.');}finally{setUploading('');}
  }
  return <div className="hero-settings account-card">
    <h2>Homepage hero</h2><p>Choose the experience visitors see. Scroll-animation settings remain saved when you switch.</p>
    <label className="account-field">Hero experience<select aria-label="Hero experience" value={mode} onChange={event=>setField('hero_type',event.target.value)}>
      <option value="particles">Particles</option><option value="scroll">Scroll animation</option><option value="hidden">Hidden</option>
    </select></label>
    {mode==='particles'&&<>
      <div className="hero-copy-fields">{(['eyebrow','headline','accent','body'] as const).map(key=><label className="account-field" key={key}>
        {{eyebrow:'Eyebrow',headline:'Headline (one line per paragraph)',accent:'Italic phrase',body:'Supporting text'}[key]}
        <textarea rows={key==='headline'||key==='body'?3:1} maxLength={key==='body'?600:200} value={config[key]} onChange={event=>update(key,event.target.value)}/>
      </label>)}</div>
      <div className="hero-device-grid">{(['desktop','mobile'] as const).map(device=><fieldset key={device} className="hero-device-card" disabled={!!uploading}>
        <legend>{device==='desktop'?'Laptop / desktop':'Mobile / tablet'}</legend>
        <div className="hero-shoe-preview"><img src={shoeImage(config[device],device==='mobile',colorMode==='dark')} alt={`${device} shoe preview`} style={{width:'100%',height:'100%',objectFit:'contain',transform:`translate(${config[device].x}%,${config[device].y}%) scale(${config[device].scale})`}}/></div>
        <label className="account-field">{device==='desktop'?'Desktop shoe':'Mobile shoe'}<select aria-label={device==='desktop'?'Desktop shoe':'Mobile shoe'} value={config[device].shoe} onChange={event=>{update(device,{...config[device],shoe:event.target.value,image:'',darkImage:''});}}>{SHOES.map(shoe=><option key={shoe.id} value={shoe.id}>{shoe.name}</option>)}</select></label>
        <label className="account-field">Custom image URL<input type="url" placeholder="https://ik.imagekit.io/…" maxLength={500} value={config[device].image} onChange={event=>view(device,'image',event.target.value)}/></label>
        <label className="account-field">Upload custom shoe<input type="file" accept="image/png,image/jpeg,image/webp" onChange={event=>void upload(device,event.target.files?.[0])}/></label>
        <label className="account-field">Dark-mode image URL (optional)<input type="url" maxLength={500} value={config[device].darkImage} onChange={event=>view(device,'darkImage',event.target.value)}/></label>
        {(['scale','x','y'] as const).map(key=><label className="account-field" key={key}>{key==='scale'?'Shoe scale':key==='x'?'Horizontal offset (%)':'Vertical offset (%)'}<input aria-label={`${device} ${key}`} type="range" min={key==='scale'?.5:-25} max={key==='scale'?1.5:25} step={key==='scale'?.05:1} value={config[device][key]} onChange={event=>view(device,key,Number(event.target.value))}/><output>{config[device][key]}</output></label>)}
        <button type="button" className="secondary-button" onClick={()=>update(device,{...DEFAULT_PARTICLES[device]})}>Reset {device} view</button>
      </fieldset>)}</div>
      <p>Use transparent or plain-background images. Device layouts switch at 1024 px. Touch, reduced-motion and data-saving preferences are respected.</p>
    </>}
    {error&&<p role="alert" className="load-error">{error}</p>}{uploading&&<p role="status">Uploading {uploading} image…</p>}
    <button type="button" className="admin-primary-btn" disabled={!!uploading} onClick={onSave}>Save hero experience</button>
  </div>;
}
