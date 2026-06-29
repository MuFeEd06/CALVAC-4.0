import type { SiteSettings, ThemeSettings } from '@/types';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
  primaryColor: '#2B9FD8',
  secondaryColor: '#1A7AB0',
  accentColor: '#FF6B35',
  backgroundColor: '#F4F8FB',
  surfaceColor: '#FFFFFF',
  textColor: '#1A1A2E',
  mutedTextColor: '#5A6A7A',
  borderColor: '#D0E6F5',
  buttonStyle: 'rounded',
  themeMode: 'light',
};

const COLOR_KEYS: Array<keyof Pick<
  ThemeSettings,
  | 'primaryColor'
  | 'secondaryColor'
  | 'accentColor'
  | 'backgroundColor'
  | 'surfaceColor'
  | 'textColor'
  | 'mutedTextColor'
  | 'borderColor'
>> = [
  'primaryColor',
  'secondaryColor',
  'accentColor',
  'backgroundColor',
  'surfaceColor',
  'textColor',
  'mutedTextColor',
  'borderColor',
];

export function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const color = value.trim();
  return HEX_RE.test(color) ? color.toUpperCase() : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    Number.parseInt(clean.slice(0, 2), 16),
    Number.parseInt(clean.slice(2, 4), 16),
    Number.parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

function mix(hex: string, target: string, amount: number): string {
  const [r, g, b] = hexToRgb(hex);
  const [tr, tg, tb] = hexToRgb(target);
  return rgbToHex(
    r + (tr - r) * amount,
    g + (tg - g) * amount,
    b + (tb - b) * amount,
  );
}

function rgba(hex: string, alpha: number): string {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function normalizeThemeSettings(value: unknown, legacyPrimary?: unknown): ThemeSettings {
  const raw = value && typeof value === 'object' && !Array.isArray(value)
    ? value as Partial<ThemeSettings>
    : {};

  const theme: ThemeSettings = { ...DEFAULT_THEME_SETTINGS };
  COLOR_KEYS.forEach(key => {
    theme[key] = normalizeHexColor(raw[key], theme[key]);
  });
  if (!HEX_RE.test(String(raw.primaryColor ?? '').trim())) {
    theme.primaryColor = normalizeHexColor(legacyPrimary, theme.primaryColor);
  }

  if (raw.buttonStyle === 'rounded' || raw.buttonStyle === 'pill' || raw.buttonStyle === 'square') {
    theme.buttonStyle = raw.buttonStyle;
  }
  if (raw.themeMode === 'light' || raw.themeMode === 'dark' || raw.themeMode === 'custom') {
    theme.themeMode = raw.themeMode;
  }

  return theme;
}

export function normalizeSiteSettings<T extends Partial<SiteSettings> & Record<string, unknown>>(settings: T): T & { theme_settings: ThemeSettings; primary_color: string } {
  const theme = normalizeThemeSettings(settings.theme_settings, settings.primary_color);
  return {
    ...settings,
    theme_settings: theme,
    primary_color: theme.primaryColor,
  };
}

export function buttonRadius(style: ThemeSettings['buttonStyle']): string {
  if (style === 'pill') return '999px';
  if (style === 'square') return '4px';
  return '10px';
}

export function themeToCssVars(theme: ThemeSettings): Record<string, string> {
  const [primaryR, primaryG, primaryB] = hexToRgb(theme.primaryColor);
  const [accentR, accentG, accentB] = hexToRgb(theme.accentColor);
  return {
    '--primary': theme.primaryColor,
    '--primary-rgb': `${primaryR}, ${primaryG}, ${primaryB}`,
    '--primary-dark': mix(theme.primaryColor, '#000000', 0.22),
    '--primary-light': rgba(theme.primaryColor, 0.1),
    '--secondary': theme.secondaryColor,
    '--accent': theme.accentColor,
    '--accent-rgb': `${accentR}, ${accentG}, ${accentB}`,
    '--bg': theme.backgroundColor,
    '--surface': theme.surfaceColor,
    '--surface-2': mix(theme.surfaceColor, theme.backgroundColor, 0.68),
    '--text': theme.textColor,
    '--text-muted': theme.mutedTextColor,
    '--text-light': mix(theme.mutedTextColor, theme.surfaceColor, 0.42),
    '--border': theme.borderColor,
    '--button-radius': buttonRadius(theme.buttonStyle),
    '--shadow': `0 4px 24px ${rgba(theme.primaryColor, 0.1)}`,
    '--shadow-hover': `0 8px 32px ${rgba(theme.primaryColor, 0.22)}`,
  };
}

export function applyThemeSettings(theme: ThemeSettings, root: HTMLElement = document.documentElement): void {
  const vars = themeToCssVars(theme);
  Object.entries(vars).forEach(([key, value]) => root.style.setProperty(key, value));
  root.dataset.themeMode = theme.themeMode;
  root.dataset.buttonStyle = theme.buttonStyle;
}
