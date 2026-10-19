import {NodeIO} from '@gltf-transform/core';
import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,quantize,textureCompress} from '@gltf-transform/functions';
import sharp from 'sharp';
import {mkdir,stat,readFile} from 'node:fs/promises';

const input=process.argv[2];
if(!input)throw new Error('Usage: node scripts/optimize-companion.mjs path/to/character.glb');
const raw=await readFile(input),jsonLength=raw.readUInt32LE(12),source=JSON.parse(raw.subarray(20,20+jsonLength).toString('utf8'));
if(source.buffers?.some(buffer=>buffer.uri)||source.images?.some(image=>image.uri))throw new Error('The companion must be a self-contained GLB.');
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.readBinary(raw);
await doc.transform(dedup(),prune(),textureCompress({encoder:sharp,targetFormat:'webp',resize:[512,512],quality:88}),quantize({quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12}));
await mkdir('public/companion',{recursive:true});
const output='public/companion/character-v1.glb';await io.write(output,doc);
console.log(JSON.stringify({inputBytes:raw.length,outputBytes:(await stat(output)).size,animations:doc.getRoot().listAnimations().length}));
