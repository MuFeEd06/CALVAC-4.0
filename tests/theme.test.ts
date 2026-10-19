import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runInNewContext} from 'node:vm';
import {DEFAULT_THEME_SETTINGS,contrast,themeToCssVars} from '../src/themeCore';
import {particleSettings,shoeImage} from '../src/hero';

test('light/dark palettes keep text and controls readable, including bright admin primary colors',()=>{
  for(const mode of ['light','dark'] as const)for(const primaryColor of ['#151514','#FFFFFF','#1FF939','#FFFF00','#FF0000','#2B9FD8']){
    const vars=themeToCssVars({...DEFAULT_THEME_SETTINGS,primaryColor},mode);
    for(const foreground of ['--text','--text-muted','--text-light','--primary'])for(const background of ['--bg','--surface'])
      assert.ok(contrast(vars[foreground],vars[background])>=4.5,`${mode} ${primaryColor} ${foreground} on ${background}`);
    assert.ok(contrast(vars['--on-primary'],vars['--primary'])>=4.5);
  }
});

test('first paint and React use the same palette for a saved dark preference and custom primary',async()=>{
  const code=await readFile(new URL('../public/theme-init.js',import.meta.url),'utf8');
  const theme={...DEFAULT_THEME_SETTINGS,primaryColor:'#1FF939'};
  const values:Record<string,string>={};const root={style:{setProperty:(key:string,value:string)=>values[key]=value,colorScheme:''},dataset:{themeMode:''}};
  runInNewContext(code,{document:{documentElement:root},localStorage:{getItem:(key:string)=>key==='calvac_color_mode'?'dark':key==='calvac_settings_v8'?JSON.stringify({data:{theme_settings:theme}}):null}});
  assert.deepEqual(values,themeToCssVars(theme,'dark'));assert.equal(root.dataset.themeMode,'dark');
});

test('desktop and mobile shoe selection and dark assets are independent',()=>{
  const settings=particleSettings({desktop:{shoe:'retro-court-hi'},mobile:{shoe:'cloud-knit'}});
  assert.match(shoeImage(settings.desktop,false,true),/retro-court-hi-desktop-dark/);
  assert.match(shoeImage(settings.mobile,true,true),/cloud-knit-mobile/);
  assert.equal(shoeImage({...settings.mobile,image:'https://ik.imagekit.io/custom.webp'},true,true),'https://ik.imagekit.io/custom.webp');
});
