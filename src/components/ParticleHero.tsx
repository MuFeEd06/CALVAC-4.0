import { useEffect,useState } from 'react';
import Sculpture from './ParticleSculpture';
import { particleSettings,shoeImage,SHOES } from '@/hero';
import { useColorMode } from '@/theme';
export default function ParticleHero({settings}:{settings:Record<string,unknown>}) {
  const mode=useColorMode();const [mobile,setMobile]=useState(()=>matchMedia('(max-width: 1023px)').matches);
  useEffect(()=>{const mq=matchMedia('(max-width: 1023px)'),change=()=>setMobile(mq.matches);mq.addEventListener('change',change);return()=>mq.removeEventListener('change',change);},[]);
  const config=particleSettings(settings.particle_hero),view=mobile?config.mobile:config.desktop;
  const shoe=SHOES.find(shoe=>shoe.id===view.shoe)||SHOES[0];
  const light=shoeImage(view,mobile,false),dark=shoeImage(view,mobile,true);
  const background=getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()||(mode==='dark'?'#111110':'#EBE9E5');
  return <div className="particle-hero" data-device={mobile?'mobile':'desktop'} data-shoe={view.shoe}>
    <Sculpture showNav={false} theme={mode} themeToggle={false} showCredit={false} loadFonts={false}
      src={light} darkSrc={dark} mobileSrc={light} mobileDarkSrc={dark} imageAlt={view.image?'Featured footwear':shoe.name}
      background={background} darkBackground={background}
      textColor="var(--text)" accentColor="var(--primary)"
      eyebrow={config.eyebrow} headline={config.headline} headlineAccent={config.accent} body={config.body}
      primaryCta={{label:'Explore the collection',href:'/shop'}} secondaryCta={{label:'New arrivals',href:'/shop?tag=new'}}
      headingFont="var(--font-display)" accentFont="var(--font-accent)" bodyFont="var(--font-body)"
      sculptureScale={view.scale} mobileSculptureScale={view.scale} sculptureX={view.x} sculptureY={view.y}
      particleDensity={mobile?.4:.7} height="max(720px, calc(100svh - var(--header-h)))" intro={false} ambient={false}/>
    {shoe.credit&&!view.image&&<a className="particle-attribution" href="/hero/CREDITS.txt">{shoe.credit} · Image credits</a>}
  </div>;
}
