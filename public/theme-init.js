(function () {
  var HEX_RE = /^#[0-9a-fA-F]{6}$/;
  var DEFAULT_THEME = {
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
  function color(value, fallback) {
    return typeof value === 'string' && HEX_RE.test(value.trim())
      ? value.trim().toUpperCase()
      : fallback;
  }
  function rgb(hex) {
    var h = hex.replace('#', '');
    return [
      parseInt(h.slice(0, 2), 16),
      parseInt(h.slice(2, 4), 16),
      parseInt(h.slice(4, 6), 16),
    ];
  }
  function toHex(r, g, b) {
    return '#' + [r, g, b].map(function (v) {
      return Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
    }).join('').toUpperCase();
  }
  function mix(hex, target, amount) {
    var a = rgb(hex);
    var b = rgb(target);
    return toHex(
      a[0] + (b[0] - a[0]) * amount,
      a[1] + (b[1] - a[1]) * amount,
      a[2] + (b[2] - a[2]) * amount
    );
  }
  function rgba(hex, alpha) {
    var c = rgb(hex);
    return 'rgba(' + c[0] + ', ' + c[1] + ', ' + c[2] + ', ' + alpha + ')';
  }
  function buttonRadius(style) {
    if (style === 'pill') return '999px';
    if (style === 'square') return '4px';
    return '10px';
  }
  function normalize(raw) {
    var src = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    var theme = Object.assign({}, DEFAULT_THEME);
    var saved = src.theme_settings && typeof src.theme_settings === 'object' ? src.theme_settings : {};
    Object.keys(DEFAULT_THEME).forEach(function (key) {
      if (key.indexOf('Color') !== -1) theme[key] = color(saved[key], theme[key]);
    });
    if (!(typeof saved.primaryColor === 'string' && HEX_RE.test(saved.primaryColor.trim()))) {
      theme.primaryColor = color(src.primary_color, theme.primaryColor);
    }
    if (saved.buttonStyle === 'rounded' || saved.buttonStyle === 'pill' || saved.buttonStyle === 'square') {
      theme.buttonStyle = saved.buttonStyle;
    }
    if (saved.themeMode === 'light' || saved.themeMode === 'dark' || saved.themeMode === 'custom') {
      theme.themeMode = saved.themeMode;
    }
    return theme;
  }
  function readSettings() {
    try {
      var keys = ['calvac_settings_v4', 'calvac_settings_v5'];
      var newest = null;
      for (var i = 0; i < keys.length; i += 1) {
        var raw = localStorage.getItem(keys[i]);
        if (!raw) continue;
        var parsed = JSON.parse(raw);
        if (parsed && parsed.data && (!newest || parsed.ts > newest.ts)) newest = parsed;
      }
      return newest ? newest.data : null;
    } catch (_) {
      return null;
    }
  }
  var theme = normalize(readSettings());
  var root = document.documentElement;
  var vars = {
    '--primary': theme.primaryColor,
    '--primary-rgb': rgb(theme.primaryColor).join(', '),
    '--primary-dark': mix(theme.primaryColor, '#000000', 0.22),
    '--primary-light': rgba(theme.primaryColor, 0.1),
    '--secondary': theme.secondaryColor,
    '--accent': theme.accentColor,
    '--accent-rgb': rgb(theme.accentColor).join(', '),
    '--bg': theme.backgroundColor,
    '--surface': theme.surfaceColor,
    '--surface-2': mix(theme.surfaceColor, theme.backgroundColor, 0.68),
    '--text': theme.textColor,
    '--text-muted': theme.mutedTextColor,
    '--text-light': mix(theme.mutedTextColor, theme.surfaceColor, 0.42),
    '--border': theme.borderColor,
    '--button-radius': buttonRadius(theme.buttonStyle),
    '--shadow': '0 4px 24px ' + rgba(theme.primaryColor, 0.1),
    '--shadow-hover': '0 8px 32px ' + rgba(theme.primaryColor, 0.22),
  };
  Object.keys(vars).forEach(function (key) {
    root.style.setProperty(key, vars[key]);
  });
  root.setAttribute('data-theme-mode', theme.themeMode);
  root.setAttribute('data-button-style', theme.buttonStyle);
})();
