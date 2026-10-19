import { useSyncExternalStore } from 'react';
import type { SiteSettings,ThemeSettings } from '@/types';
import { DEFAULT_THEME_SETTINGS,normalizeThemeSettings,themeToCssVars } from './themeCore';
export { DEFAULT_THEME_SETTINGS,normalizeThemeSettings,normalizeHexColor,themeToCssVars,contrast } from './themeCore';
let current: ThemeSettings={...DEFAULT_THEME_SETTINGS};
export function normalizeSiteSettings(raw: unknown): SiteSettings & Record<string,unknown> {
  const data=raw && typeof raw==='object' && !Array.isArray(raw)?raw as SiteSettings:{} as SiteSettings;
  const theme=normalizeThemeSettings(data.theme_settings,data.primary_color);
  return {...data,theme_settings:theme,primary_color:theme.primaryColor} as SiteSettings & Record<string,unknown>;
}
export function getColorMode(): 'light'|'dark' {
  if(typeof document==='undefined')return 'light';
  return document.documentElement.dataset.themeMode==='dark'?'dark':'light';
}
export function applyThemeSettings(theme: ThemeSettings,root: HTMLElement=document.documentElement): void {
  current=normalizeThemeSettings(theme);
  let mode: 'light'|'dark'=current.themeMode==='dark'?'dark':'light';
  try {const preference=localStorage.getItem('calvac_color_mode');if(preference==='light'||preference==='dark')mode=preference;}catch{}
  Object.entries(themeToCssVars(current,mode)).forEach(([key,value])=>root.style.setProperty(key,value));
  root.dataset.themeMode=mode;root.dataset.buttonStyle=current.buttonStyle;root.style.colorScheme=mode;
  window.dispatchEvent(new Event('calvac:theme'));
}
export function setColorMode(mode: 'light'|'dark') {
  try{localStorage.setItem('calvac_color_mode',mode);}catch{}
  applyThemeSettings({...current,themeMode:mode});
}
const subscribe=(listener:()=>void)=>{window.addEventListener('calvac:theme',listener);return()=>window.removeEventListener('calvac:theme',listener);};
export function useColorMode(){return useSyncExternalStore(subscribe,getColorMode,()=> 'light' as const);}
