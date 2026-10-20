import assert from 'node:assert/strict';
import {readFile,readdir,stat} from 'node:fs/promises';
import {resolve} from 'node:path';
import {gzipSync} from 'node:zlib';

const manifest=JSON.parse(await readFile('dist/.vite/manifest.json','utf8'));
async function graphBudget(entry,maxGzip){
  const seen=new Set();
  function visit(key){if(seen.has(key))return;seen.add(key);for(const dep of manifest[key].imports||[])visit(dep);}
  visit(entry);
  let gzipBytes=0;
  for(const key of seen){
    const file=manifest[key].file;
    assert.doesNotMatch(file,/Admin|admin-|supabase-|companionScene/i,`${entry} eagerly imports ${file}`);
    gzipBytes+=gzipSync(await readFile(resolve('dist',file))).length;
  }
  assert.ok(gzipBytes<=maxGzip,`${entry} gzip ${gzipBytes} exceeds ${maxGzip}`);
  return gzipBytes;
}
async function folderBytes(path){
  let bytes=0;
  for(const entry of await readdir(path,{withFileTypes:true})){
    const file=resolve(path,entry.name);
    bytes+=entry.isDirectory()?await folderBytes(file):(await stat(file)).size;
  }
  return bytes;
}
const sizes={
  initialJsGzip:await graphBudget('index.html',160*1024),
  homepageJsGzip:await graphBudget('src/pages/HomePage.tsx',180*1024),
  mobileScrollFrames:await folderBytes('public/frames/v2/mobile'),
  desktopScrollFrames:await folderBytes('public/frames/v2/desktop'),
  companionModel:(await stat('public/companion/character-v1.glb')).size,
  allPublicAssets:await folderBytes('public'),
};
assert.ok(sizes.mobileScrollFrames<800*1024,'Mobile scroll sequence exceeds 800 KiB');
assert.ok(sizes.desktopScrollFrames<1400*1024,'Desktop scroll sequence exceeds 1,400 KiB');
assert.ok(sizes.companionModel<900*1024,'Optional character exceeds 900 KiB');
assert.ok(sizes.allPublicAssets<6*1024*1024,'Public media exceeds 6 MiB');
console.log(JSON.stringify(sizes,null,2));
