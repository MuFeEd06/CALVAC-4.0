import {chromium} from '@playwright/test';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';

const artifact=resolve('test-results/auth-emails');await mkdir(artifact,{recursive:true});
const payload=JSON.parse(await readFile('supabase/templates/auth-email-templates.json','utf8'));
assert.deepEqual(Object.keys(payload).sort(),['mailer_subjects_confirmation','mailer_subjects_recovery','mailer_templates_confirmation_content','mailer_templates_recovery_content']);
const browser=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE}:{})});
const results=[];
try{
  for(const [file,type,action] of [['confirm-signup','confirmation','Verify email'],['reset-password','recovery','Reset password']]){
    const html=await readFile(`supabase/templates/${file}.html`,'utf8');
    assert.equal(payload[`mailer_templates_${type}_content`].replaceAll('\r\n','\n'),html.replaceAll('\r\n','\n'));
    assert.ok(Buffer.byteLength(html)<30000,'Keep authentication emails well below clipping limits');
    assert.equal((html.match(/{{\s*\.ConfirmationURL\s*}}/g)||[]).length,3,'Button and visible fallback must keep the Supabase link');
    assert.equal(/<script\b|<iframe\b|<form\b|\bonclick\s*=|url\s*\(|<img\b/i.test(html),false,'Email must not require scripts, forms, remote assets or tracking pixels');
    const url=`https://jjyysdxkoarjlxwttiak.supabase.co/auth/v1/verify?token=${'preview-only-not-valid-'.repeat(5)}&type=${type==='recovery'?'recovery':'signup'}&redirect_to=https%3A%2F%2Fcalvac.in%2F${type==='recovery'?'reset-password':'auth%2Fcallback'}`;
    const rendered=html.replaceAll('{{ .ConfirmationURL }}',url.replaceAll('&','&amp;'));
    assert.equal(rendered.includes('{{'),false);
    await writeFile(resolve(artifact,file+'.html'),rendered);
    for(const width of [800,390,320])for(const mode of ['light','dark']){
      const context=await browser.newContext({viewport:{width,height:1000},colorScheme:mode});
      await context.route('**/*',route=>route.abort());
      const page=await context.newPage();await page.setContent(rendered);
      assert.equal(await page.locator('h1').count(),1);
      assert.ok((await page.locator('title').innerText()).includes('CALVAC'));
      const button=page.locator('[data-auth-action]');assert.ok((await button.innerText()).includes(action));
      assert.equal(await button.getAttribute('href'),url);
      assert.equal(await page.locator('[data-auth-fallback]').getAttribute('href'),url);
      assert.equal(await page.locator('[data-auth-fallback]').innerText(),url);
      await button.focus();assert.equal(await button.evaluate(el=>el===document.activeElement),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`${file} must fit ${width}px`);
      const issues=await page.evaluate(()=>{
        const parse=color=>{const n=color.match(/[\d.]+/g).map(Number);return n.length===3?[...n,1]:n;};
        const lum=rgb=>rgb.slice(0,3).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);
        const issues=[];
        for(const el of document.querySelectorAll('body *')){
          if(!el.getClientRects().length||!Array.from(el.childNodes).some(node=>node.nodeType===3&&node.textContent.trim()))continue;
          const style=getComputedStyle(el);if(style.display==='none'||style.opacity==='0')continue;
          let background=[255,255,255,1];for(let parent=el;parent;parent=parent.parentElement){const bg=parse(getComputedStyle(parent).backgroundColor);if(bg[3]===1){background=bg;break;}}
          const a=lum(parse(style.color)),b=lum(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
          const large=parseFloat(style.fontSize)>=24||(parseFloat(style.fontSize)>=18.66&&parseInt(style.fontWeight)>=700);
          if(ratio<(large?3:4.5)-.03)issues.push({text:el.textContent.trim().slice(0,50),ratio});
        }return issues;
      });
      assert.deepEqual(issues,[],`${file} ${mode} contrast at ${width}px`);
      await button.evaluate(el=>el.blur());
      await page.screenshot({path:resolve(artifact,`${file}-${width}-${mode}.png`),fullPage:true});
      results.push({template:file,width,mode,overflow:false,contrast:true,authLinkPreserved:true});
      await context.close();
    }
  }
  await writeFile(resolve(artifact,'results.json'),JSON.stringify(results,null,2));
  console.log(JSON.stringify({templates:2,renderedLayouts:results.length,authLinksPreserved:true,remoteAssets:false,contrast:true,mobileOverflow:false},null,2));
}finally{await browser.close();}
