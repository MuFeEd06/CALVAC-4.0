import type { Product } from '@/types';

export interface Specification {label:string;value:string}
export function productSpecifications(product:Product):Specification[] {
  const rows=(product.specs||'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean).map(line=>{
    const colon=line.indexOf(':');
    return colon>0?{label:line.slice(0,colon).trim(),value:line.slice(colon+1).trim()}:{label:'',value:line};
  }).filter(row=>row.value);
  const fallback=[{label:'Brand',value:product.brand},{label:'Collection',value:product.category||''},
    {label:'Size system',value:product.size_unit},
    {label:'Available sizes',value:product.sizes.join(', ')},
    {label:'Colours',value:product.colors.map(color=>color.name).join(', ')}];
  const labels=new Set(rows.map(row=>row.label.toLowerCase()));
  return [...rows,...fallback.filter(row=>row.value&&!labels.has(row.label.toLowerCase()))];
}

/** Prefer the current brand and collection; fill sparse matches from the catalog. */
export async function relatedProducts(product:Product,load:(filters:{brand?:string;category?:string;limit:number})=>Promise<Product[]>,limit=8):Promise<Product[]> {
  const picks=new Map<number,Product>();let successes=0;
  const add=(items:Product[])=>items.forEach(item=>{if(item.id!==product.id&&!picks.has(item.id))picks.set(item.id,item);});
  for(const filters of [product.brand?{brand:product.brand}:null,product.category?{category:product.category}:null,{}]){
    if(!filters)continue;
    try{add(await load({...filters,limit:limit+1}));successes++;}catch{/* Try the next source when one filter request fails. */}
    if(picks.size>=limit)break;
  }
  if(!successes)throw new Error('Could not load related products.');
  return [...picks.values()].slice(0,limit);
}
