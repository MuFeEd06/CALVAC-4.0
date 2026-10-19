import ts from 'typescript';
import { readFile,writeFile } from 'node:fs/promises';
const source=(await readFile('src/themeCore.ts','utf8')).replace(/^export /gm,'');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
const startup=`
let saved={},mode;
try { saved=JSON.parse(localStorage.getItem('calvac_settings_v8')||'null')?.data||{};mode=localStorage.getItem('calvac_color_mode'); }catch{}
const theme=normalizeThemeSettings(saved.theme_settings,saved.primary_color);
mode=mode==='light'||mode==='dark'?mode:theme.themeMode==='dark'?'dark':'light';
const root=document.documentElement;
Object.entries(themeToCssVars(theme,mode)).forEach(([key,value])=>root.style.setProperty(key,value));
root.dataset.themeMode=mode;root.dataset.buttonStyle=theme.buttonStyle;root.style.colorScheme=mode;
`;
await writeFile('public/theme-init.js','// Generated from src/themeCore.ts by scripts/build-theme.mjs\n(function(){\n'+compiled+startup+'})();\n');
