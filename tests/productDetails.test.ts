import {test} from 'node:test';
import assert from 'node:assert/strict';
import {productSpecifications,relatedProducts} from '../src/utils/productDetails';
import type {Product} from '../src/types';

const product:Product={id:33,name:'Sparse brand shoe',brand:'Rare brand',category:'boots',price:100,image:'',size_unit:'UK',sizes:['7','8'],colors:[{name:'Black',hex:'#000000'}]};
test('specifications preserve authored content and provide known catalog facts for blank products',()=>{
  const rows=productSpecifications({...product,specs:'Brand: Custom brand\r\nMaterial: Leather\nCare instructions without a colon\nEmpty: '});
  assert.equal(rows.filter(row=>row.label.toLowerCase()==='brand').length,1);
  assert.ok(rows.some(row=>row.label==='Material'&&row.value==='Leather'));
  assert.ok(rows.some(row=>!row.label&&row.value==='Care instructions without a colon'));
  const fallback=productSpecifications(product);
  assert.ok(fallback.some(row=>row.label==='Available sizes'&&row.value==='7, 8'));
  assert.equal(fallback.some(row=>row.label==='Material'),false);
});
test('related products deduplicate, exclude the viewed product and fill sparse brands from collections',async()=>{
  const calls:unknown[]=[];
  const rows=await relatedProducts(product,async filters=>{
    calls.push(filters);
    if(filters.brand)return [product,{...product,id:34}];
    if(filters.category)return [{...product,id:34},{...product,id:35}];
    return [{...product,id:35},{...product,id:36}];
  },3);
  assert.deepEqual(rows.map(row=>row.id),[34,35,36]);
  assert.equal(calls.length,3);
});
test('related products recover from a failed filter and do not download an entire catalog',async()=>{
  const rows=await relatedProducts(product,async filters=>{
    assert.equal(filters.limit,3);
    if(filters.brand)throw new Error('Temporary failure');
    return [{...product,id:34},{...product,id:35}];
  },2);
  assert.equal(rows.length,2);
  await assert.rejects(()=>relatedProducts(product,async()=>{throw new Error('Offline');}));
});
