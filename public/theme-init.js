// Generated from src/themeCore.ts by scripts/build-theme.mjs
(function(){
const DEFAULT_THEME_SETTINGS = {
    primaryColor: '#151514', secondaryColor: '#62615E', accentColor: '#151514',
    backgroundColor: '#EBE9E5', surfaceColor: '#F8F7F4', textColor: '#151514',
    mutedTextColor: '#62615E', borderColor: '#CCCAC4', buttonStyle: 'pill', themeMode: 'light',
};
function normalizeHexColor(value, fallback) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim().toUpperCase() : fallback;
}
function normalizeThemeSettings(value, legacyPrimary) {
    const raw = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    const theme = { ...DEFAULT_THEME_SETTINGS };
    for (const key of Object.keys(theme)) {
        if (key.endsWith('Color'))
            theme[key] = normalizeHexColor(raw[key], theme[key]);
    }
    if (!raw.primaryColor)
        theme.primaryColor = normalizeHexColor(legacyPrimary, theme.primaryColor);
    if (raw.buttonStyle && ['rounded', 'pill', 'square'].includes(raw.buttonStyle))
        theme.buttonStyle = raw.buttonStyle;
    if (raw.themeMode && ['light', 'dark', 'custom'].includes(raw.themeMode))
        theme.themeMode = raw.themeMode;
    return theme;
}
function rgb(hex) { return [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); }
function mix(a, b, t) {
    const x = rgb(a), y = rgb(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('').toUpperCase();
}
function contrast(a, b) {
    const luminance = (hex) => rgb(hex).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((s, v, i) => s + v * [.2126, .7152, .0722][i], 0);
    const x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + .05) / (Math.min(x, y) + .05);
}
function readable(color, backgrounds, minimum = 4.5) {
    const target = ['#151514', '#FFFFFF'].sort((a, b) => Math.min(...backgrounds.map(bg => contrast(b, bg))) - Math.min(...backgrounds.map(bg => contrast(a, bg))))[0];
    for (let i = 0; i <= 100; i++) {
        const next = mix(color, target, i / 100);
        if (backgrounds.every(bg => contrast(next, bg) >= minimum))
            return next;
    }
    return target;
}
function themeToCssVars(input, mode) {
    const raw = normalizeThemeSettings(input), dark = (mode || raw.themeMode) === 'dark';
    const theme = dark ? { ...raw, backgroundColor: '#111110', surfaceColor: '#1C1C1A', textColor: '#F1EFEA', mutedTextColor: '#B7B6B0', borderColor: '#3D3D38' } : raw;
    const bg = theme.backgroundColor;
    const surface = contrast(bg, theme.surfaceColor) > 1.7 ? mix(bg, contrast(bg, '#FFFFFF') > contrast(bg, '#151514') ? '#FFFFFF' : '#151514', .06) : theme.surfaceColor;
    const grounds = [bg, surface];
    const text = readable(theme.textColor, grounds), muted = readable(theme.mutedTextColor, grounds);
    const primary = readable(dark && raw.primaryColor === DEFAULT_THEME_SETTINGS.primaryColor ? '#F1EFEA' : raw.primaryColor, grounds);
    const secondary = readable(raw.secondaryColor, grounds);
    const accent = readable(dark && raw.accentColor === DEFAULT_THEME_SETTINGS.accentColor ? '#F1EFEA' : raw.accentColor, grounds);
    const onPrimary = contrast(primary, '#FFFFFF') >= contrast(primary, '#151514') ? '#FFFFFF' : '#151514';
    return { '--primary': primary, '--primary-rgb': rgb(primary).join(', '), '--primary-dark': primary, '--primary-light': `rgba(${rgb(primary).join(', ')}, .08)`,
        '--on-primary': onPrimary, '--secondary': secondary, '--accent': accent, '--accent-rgb': rgb(accent).join(', '),
        '--bg': bg, '--surface': surface, '--surface-2': mix(bg, surface, .45), '--text': text, '--text-muted': muted, '--text-light': muted,
        '--border': theme.borderColor, '--button-radius': raw.buttonStyle === 'pill' ? '999px' : raw.buttonStyle === 'square' ? '4px' : '12px',
        '--shadow': dark ? '0 8px 30px rgba(0,0,0,.18)' : '0 8px 30px rgba(21,21,20,.04)',
        '--shadow-hover': dark ? '0 16px 40px rgba(0,0,0,.3)' : '0 16px 40px rgba(21,21,20,.09)',
        '--inverse': text, '--on-inverse': bg, '--danger': dark ? '#FFABAB' : '#A51D2D', '--danger-bg': dark ? '#3A2022' : '#FFF0F0',
        '--success': dark ? '#9EE3B5' : '#17633A', '--success-bg': dark ? '#193527' : '#EAF6EE',
        '--warning': dark ? '#F3D196' : '#80511A', '--warning-bg': dark ? '#382F20' : '#FFF4DF' };
}

let saved={},mode;
try { saved=JSON.parse(localStorage.getItem('calvac_settings_v8')||'null')?.data||{};mode=localStorage.getItem('calvac_color_mode'); }catch{}
const theme=normalizeThemeSettings(saved.theme_settings,saved.primary_color);
mode=mode==='light'||mode==='dark'?mode:theme.themeMode==='dark'?'dark':'light';
const root=document.documentElement;
Object.entries(themeToCssVars(theme,mode)).forEach(([key,value])=>root.style.setProperty(key,value));
root.dataset.themeMode=mode;root.dataset.buttonStyle=theme.buttonStyle;root.style.colorScheme=mode;
})();
