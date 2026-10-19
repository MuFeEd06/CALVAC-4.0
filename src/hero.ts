export const SHOES = [
  {id:'retro-court-hi',name:'Retro Court Hi',folder:'shoes',stem:'retro-court-hi',dark:true,credit:''},
  {id:'pulse-runner',name:'Pulse Runner',folder:'shoe',stem:'shoe',dark:true,credit:'Materials Variants Shoe © 2021 Shopify · CC BY 4.0'},
  {id:'cloud-knit',name:'Cloud Knit',folder:'shoes',stem:'cloud-knit',credit:'Photo: EpicFireworks · CC BY 2.0'},
  {id:'air-cushion-trainer',name:'Air Cushion Trainer',folder:'shoes',stem:'air-cushion-trainer',credit:'Photo: buyeasyshop.com · CC BY 2.0'},
  {id:'suede-chelsea',name:'Suede Chelsea',folder:'shoes',stem:'suede-chelsea',credit:'Photo: spera.de · CC BY 2.0'},
  {id:'polished-brogue',name:'Polished Brogue',folder:'shoes',stem:'polished-brogue',credit:'Photo: spera.de · CC BY 2.0'},
  {id:'heritage-derby',name:'Heritage Derby',folder:'shoes',stem:'heritage-derby',credit:'Photo: Menswear Market · CC BY 2.0'},
];
export interface HeroView {shoe:string;image:string;darkImage:string;scale:number;x:number;y:number}
export interface ParticleSettings {eyebrow:string;headline:string;accent:string;body:string;desktop:HeroView;mobile:HeroView}
export const DEFAULT_PARTICLES: ParticleSettings = {
  eyebrow:'CALVAC — FOOTWEAR WITH CHARACTER',headline:'Form that\nmoves you.',accent:'moves you.',
  body:'Find your next everyday favourite. Explore distinctive footwear, considered details and a fresh perspective on every step.',
  desktop:{shoe:'retro-court-hi',image:'',darkImage:'',scale:1,x:0,y:0},
  mobile:{shoe:'retro-court-hi',image:'',darkImage:'',scale:1,x:0,y:0},
};
export function particleSettings(value:unknown):ParticleSettings {
  const data=value&&typeof value==='object'?value as Partial<ParticleSettings>:{};
  return {...DEFAULT_PARTICLES,...data,desktop:{...DEFAULT_PARTICLES.desktop,...data.desktop},mobile:{...DEFAULT_PARTICLES.mobile,...data.mobile}};
}
export function shoeImage(view:HeroView,mobile:boolean,dark:boolean) {
  const shoe=SHOES.find(shoe=>shoe.id===view.shoe)||SHOES[0];
  if(dark && view.darkImage)return view.darkImage;
  if(view.image)return view.image;
  const device=mobile?'mobile':'desktop';
  const suffix=shoe.id==='pulse-runner'?`${device}-${dark?'beach':'street'}`:`${device}${dark&&shoe.dark&&!mobile?'-dark':''}`;
  return `/hero/${shoe.folder}/${shoe.stem}-${suffix}.webp`;
}
