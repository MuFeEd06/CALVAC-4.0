import {useEffect,useRef} from 'react';

export default function CompanionCharacter({pulse=0,active=true}:{pulse?:number;active?:boolean}) {
  const host=useRef<HTMLDivElement>(null),scene=useRef<Awaited<ReturnType<typeof import('./companionScene').mountCharacter>>|null>(null);
  useEffect(()=>{
    if(!active||!host.current||matchMedia('(prefers-reduced-motion: reduce)').matches||(navigator as Navigator&{connection?:{saveData?:boolean}}).connection?.saveData)return;
    const controller=new AbortController();let started=false;
    const observer=new IntersectionObserver(entries=>{
      if(started||!entries.some(entry=>entry.isIntersecting))return;started=true;
      import('./companionScene').then(module=>{if(controller.signal.aborted||!host.current)return;return module.mountCharacter(host.current,controller.signal);})
        .then(value=>{if(value)scene.current=value;}).catch(()=>{/* The supplied character poster remains visible when 3D is unavailable. */});
    });observer.observe(host.current);
    return()=>{observer.disconnect();controller.abort();scene.current?.dispose();scene.current=null;};
  },[active]);
  useEffect(()=>{if(pulse)scene.current?.pulse();},[pulse]);
  return <div className="companion-character" ref={host} aria-hidden="true" onPointerMove={event=>{const box=event.currentTarget.getBoundingClientRect();scene.current?.look((event.clientX-box.left)/box.width-.5);}} onPointerLeave={()=>scene.current?.look(0)}>
    <img src="/companion/character-poster.webp" alt="" width="160" height="160" loading="lazy"/>
  </div>;
}
