import { ChevronDown } from 'lucide-react';
import type { Product } from '@/types';
import { productSpecifications } from '@/utils/productDetails';

export default function ProductSpecifications({product}:{product:Product}) {
  return <details key={product.id} className="product-specifications" open>
    <summary>Specifications<ChevronDown size={18} aria-hidden="true"/></summary>
    <dl>{productSpecifications(product).map((row,index)=><div className={row.label?'specification-row':'specification-note'} key={index}>
      {row.label&&<dt>{row.label}</dt>}<dd>{row.value}</dd>
    </div>)}</dl>
    {!product.specs?.trim()&&<p className="specifications-help">For material, fit or care details, <a href="/contact">contact us</a>.</p>}
  </details>;
}
