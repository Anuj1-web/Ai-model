(() => {
  if (window.__SGWM_PRO_THEME_IFRAME_RUNNING__) return;
  window.__SGWM_PRO_THEME_IFRAME_RUNNING__ = true;

  // -------------------------
  // Utilities: color, contrast
  // -------------------------
  const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
  const toHex = n => Math.round(clamp(n, 0, 255)).toString(16).padStart(2, '0');

  function parseColor(input) {
    if (!input) return null;
    const s = String(input).trim();
    // Hex
    let m = s.match(/^#([0-9a-f]{3,8})$/i);
    if (m) {
      let h = m[1];
      if (h.length === 3) h = h.split('').map(ch => ch + ch).join('');
      const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
      return { r, g, b };
    }
    // rgb/rgba
    m = s.match(/^rgba?\(([^)]+)\)$/i);
    if (m) {
      const parts = m[1].split(',').map(p => parseFloat(p));
      return { r: parts[0], g: parts[1], b: parts[2] };
    }
    // fallback: can't parse
    return null;
  }
  function rgbToHex({ r, g, b }) { return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toLowerCase(); }
  function hex(v) { const c = parseColor(v); return c ? rgbToHex(c) : null; }

  function luminance(c) {
    const srgb = [c.r / 255, c.g / 255, c.b / 255].map(v => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * srgb[0] + 0.7152 * srgb[1] + 0.0722 * srgb[2];
  }
  function contrastRatioHex(aHex, bHex) {
    try {
      const a = parseColor(aHex), b = parseColor(bHex);
      if (!a || !b) return 1;
      const A = luminance(a) + 0.05, B = luminance(b) + 0.05;
      return Math.max(A, B) / Math.min(A, B);
    } catch { return 1; }
  }
  function ensureReadableTextColor(bgHex, preferredHex) {
    const bg = parseColor(bgHex) || { r: 255, g: 255, b: 255 };
    const pref = parseColor(preferredHex) || parseColor('#111111') || { r: 17, g: 17, b: 17 };
    const black = { r: 0, g: 0, b: 0 }, white = { r: 255, g: 255, b: 255 };
    const choices = [pref, black, white].map(c => ({ c, cr: (luminance(c) + 0.05) / (luminance(bg) + 0.05) }));
    choices.sort((x, y) => y.cr - x.cr);
    return rgbToHex(choices[0].c);
  }
  function lightenHex(hexIn, amt = 0.08) {
    const c = parseColor(hexIn) || { r: 0, g: 0, b: 0 };
    // convert to HSL approx via RGB->HSL
    const r = c.r / 255, g = c.g / 255, b = c.b / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;
    if (max != min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    // increase lightness
    l = clamp(l + amt, 0, 1);
    // HSL -> RGB
    function hue2rgb(p, q, t) {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    }
    let r1, g1, b1;
    if (s === 0) { r1 = g1 = b1 = l; } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r1 = hue2rgb(p, q, h + 1 / 3);
      g1 = hue2rgb(p, q, h);
      b1 = hue2rgb(p, q, h - 1 / 3);
    }
    return rgbToHex({ r: Math.round(r1 * 255), g: Math.round(g1 * 255), b: Math.round(b1 * 255) });
  }

  // -------------------------
  // 20+ Presets (diverse)
  // -------------------------
  const PRESETS = [
    { id: 'classic-light', name: 'Classic Light', palette: { primary: '#2563eb', secondary: '#10b981', background: '#ffffff', text: '#111827', muted: '#6b7280', surface: '#ffffff', card: '#ffffff', hero: '#f1f9ff', footer: '#0f172a' } },
    { id: 'elegant-dark', name: 'Elegant Dark', palette: { primary: '#9333ea', secondary: '#f59e0b', background: '#0b1020', text: '#f8fafc', muted: '#9ca3af', surface: '#0f172a', card: '#111827', hero: '#11121b', footer: '#05060a' } },
    { id: 'modern-minimal', name: 'Modern Minimal', palette: { primary: '#3b82f6', secondary: '#64748b', background: '#f8fafc', text: '#0f172a', muted: '#94a3b8', surface: '#ffffff', card: '#ffffff', hero: '#f1f5f9', footer: '#111827' } },
    { id: 'corporate-blue', name: 'Corporate Blue', palette: { primary: '#004aad', secondary: '#00bcd4', background: '#ffffff', text: '#212121', muted: '#757575', surface: '#ffffff', card: '#ffffff', hero: '#f1f8ff', footer: '#072146' } },
    { id: 'creative-orange', name: 'Creative Orange', palette: { primary: '#ff5722', secondary: '#ff9800', background: '#fff8f1', text: '#3e2723', muted: '#a1887f', surface: '#fff7f0', card: '#fff7f0', hero: '#fff2e6', footer: '#3b1f16' } },
    { id: 'fresh-green', name: 'Fresh Green', palette: { primary: '#2e7d32', secondary: '#81c784', background: '#f1f8f6', text: '#1b4332', muted: '#6c757d', surface: '#ffffff', card: '#ffffff', hero: '#eaf6ec', footer: '#052e16' } },
    { id: 'luxury-gold', name: 'Luxury Gold', palette: { primary: '#bfa14a', secondary: '#d4af37', background: '#0a0a0a', text: '#f8f5ef', muted: '#666666', surface: '#111111', card: '#121212', hero: '#0f0f0f', footer: '#000000' } },
    { id: 'pastel-dream', name: 'Pastel Dream', palette: { primary: '#a78bfa', secondary: '#f9a8d4', background: '#faf5ff', text: '#374151', muted: '#e9d5ff', surface: '#fff9ff', card: '#fff8ff', hero: '#fbf5ff', footer: '#8b5cf6' } },
    { id: 'warm-coffee', name: 'Warm Coffee', palette: { primary: '#6b4226', secondary: '#d6a36c', background: '#fefae0', text: '#3b2f2f', muted: '#d6ccc2', surface: '#faedcd', card: '#faedcd', hero: '#fff3d6', footer: '#4a342e' } },
    { id: 'retro-vintage', name: 'Retro Vintage', palette: { primary: '#b45309', secondary: '#f59e0b', background: '#fffbeb', text: '#3b2f2f', muted: '#d6d3d1', surface: '#fff7ed', card: '#fff7ed', hero: '#fff4e1', footer: '#5a2d08' } },
    { id: 'cyberpunk', name: 'Cyberpunk', palette: { primary: '#ff00cc', secondary: '#00ffff', background: '#0b0b12', text: '#e6e6e6', muted: '#707070', surface: '#111121', card: '#111121', hero: '#1b1530', footer: '#000000' } },
    { id: 'minimal-white', name: 'Minimal White', palette: { primary: '#111827', secondary: '#4b5563', background: '#ffffff', text: '#111827', muted: '#e5e7eb', surface: '#ffffff', card: '#ffffff', hero: '#f8fafc', footer: '#e5e7eb' } },
    { id: 'sunset-glow', name: 'Sunset Glow', palette: { primary: '#f97316', secondary: '#fb923c', background: '#fff7ed', text: '#431407', muted: '#fed7aa', surface: '#fff7ed', card: '#fff7ed', hero: '#fff1e0', footer: '#7c2d12' } },
    { id: 'forest-mist', name: 'Forest Mist', palette: { primary: '#166534', secondary: '#4ade80', background: '#f0fdf4', text: '#064e3b', muted: '#bbf7d0', surface: '#ecfdf5', card: '#ffffff', hero: '#ddfbe8', footer: '#052e16' } },
    { id: 'space-nebula', name: 'Space Nebula', palette: { primary: '#7c3aed', secondary: '#2563eb', background: '#0f172a', text: '#f1f5f9', muted: '#94a3b8', surface: '#111827', card: '#0f172a', hero: '#2e1a5f', footer: '#0b1020' } },
    { id: 'peach-sorbet', name: 'Peach Sorbet', palette: { primary: '#fb923c', secondary: '#fdba74', background: '#fff7ed', text: '#3a1d0b', muted: '#fed7aa', surface: '#ffedd5', card: '#ffffff', hero: '#fff0e0', footer: '#6b2d12' } },
    { id: 'royal-elegance', name: 'Royal Elegance', palette: { primary: '#6d28d9', secondary: '#8b5cf6', background: '#f5f3ff', text: '#1e1b4b', muted: '#c7b3ff', surface: '#ede9fe', card: '#ffffff', hero: '#efeaff', footer: '#2e1065' } },
    { id: 'aqua-tech', name: 'Aqua Tech', palette: { primary: '#06b6d4', secondary: '#67e8f9', background: '#ecfeff', text: '#054e5b', muted: '#bae6fd', surface: '#d1fae5', card: '#ffffff', hero: '#e6fcff', footer: '#08303a' } },
    { id: 'earthy-tones', name: 'Earthy Tones', palette: { primary: '#92400e', secondary: '#d97706', background: '#fffbeb', text: '#3b2f2f', muted: '#d6cdbb', surface: '#fff7ed', card: '#fff7ed', hero: '#fff8e6', footer: '#3a1d04' } },
    { id: 'vivid-royal', name: 'Vivid Royal', palette: { primary: '#7c3aed', secondary: '#22d3ee', background: '#071029', text: '#e6eefb', muted: '#3a3f55', surface: '#0b1220', card: '#0b1220', hero: '#16213a', footer: '#071029' } },
    { id: 'slate-sky', name: 'Slate Sky', palette: { primary: '#2563eb', secondary: '#94a3b8', background: '#f8fafc', text: '#0f172a', muted: '#cbd5e1', surface: '#f1f5f9', card: '#ffffff', hero: '#e2e8f0', footer: '#0f172a' } },
    { id: 'rose-garden', name: 'Rose Garden', palette: { primary: '#be123c', secondary: '#fb7185', background: '#fff1f2', text: '#3f0a1a', muted: '#fecdd3', surface: '#ffe4e6', card: '#ffffff', hero: '#ffe4e6', footer: '#7f1d1d' } }
  ];

  // -------------------------
  // State
  // -------------------------
  let CURRENT = { presetId: null, palette: null, tweaked: false, sectionOverrides: {} };
  let lastFocused = null;

  // -------------------------
  // Build full CSS (very broad coverage)
  // -------------------------
  function buildFullThemeCss(palette = {}, sectionOverrides = {}) {
    // map tokens (robust naming)
    const t = {
      '--sg-primary': palette.primary || palette['--primary'] || palette['--sg-primary'] || '#2563eb',
      '--sg-secondary': palette.secondary || palette['--secondary'] || palette['--sg-secondary'] || '#10b981',
      '--sg-accent': palette.accent || palette['--accent'] || '#f59e0b',
      '--sg-bg': palette.background || palette['--background'] || '#ffffff',
      '--sg-surface': palette.surface || palette['--surface'] || palette.background || '#ffffff',
      '--sg-text': palette.text || palette['--text'] || '#111827',
      '--sg-muted': palette.muted || palette['--muted'] || '#6b7280',
      '--sg-hero': palette.hero || palette['--hero'] || palette['--sg-surface'] || '#f6fbff',
      '--sg-footer': palette.footer || palette['--footer'] || '#0b1020',
      '--sg-card': palette.card || palette['--card'] || palette.surface || palette.background || '#ffffff'
    };

    // textual convenience values
    const textOnPrimary = ensureReadableTextColor(t['--sg-primary'], t['--sg-text']);
    const textOnSecondary = ensureReadableTextColor(t['--sg-secondary'], t['--sg-text']);
    const textOnAccent = ensureReadableTextColor(t['--sg-accent'], t['--sg-text']);

    const rootVars = `:root{\n  ${Object.entries(t).map(([k, v]) => `${k}: ${v};`).join('\n  ')}\n}\n`;

    // mapping rules — wide coverage. This is the heart of "not just a few tokens"
    const mapping = `
/* --- Core utilities --- */
html,body { background: var(--sg-bg) !important; color: var(--sg-text) !important; }
a, a:visited { color: var(--sg-primary) !important; }
h1,h2,h3,h4,h5,h6,p,span,li,blockquote { color: var(--sg-text) !important; }

/* --- Header / Nav --- */
header, .site-header, .navbar, .nav-bar, .topbar, [role="navigation"], .global-header, .appbar, [data-sgwm="nav"], .sgwm-nav {
  background: var(--sg-primary) !important;
  color: ${textOnPrimary} !important;
  border-bottom: 1px solid var(--sg-muted) !important;
}
header a, .navbar a, .nav-bar a, .topbar a, [role="navigation"] a, .sgwm-nav a { color: ${textOnPrimary} !important; }

/* --- Hero / Banner --- */
.hero, .hero-section, .jumbotron, .page-hero, .banner, .page-banner, .masthead-hero, .cover, .splash, [data-sgwm="hero"], .sgwm-hero {
  background: var(--sg-hero) !important;
  color: var(--sg-text) !important;
}

/* --- Sections & Blocks --- */
section, .section, .content-section, .block, .feature, .features, .module, .panel, main > *, [data-sgwm="section"], .sgwm-section {
  background: var(--sg-surface) !important;
  color: var(--sg-text) !important;
}

/* --- Cards --- */
.card, .panel, .tile, .box, .well, .portlet, .card-body, .card-inner, .feature-card, .service-card, [class*="card"], [data-sgwm="card"], .sgwm-card {
  background: var(--sg-card) !important;
  color: var(--sg-text) !important;
  border: 1px solid var(--sg-muted) !important;
  border-radius: 8px !important;
}

/* --- Buttons --- */
button, .btn, a.button, a.btn, [role="button"], input[type="button"], input[type="submit"], .badge, .chip, .tag, .cta, [data-sgwm="btn"], .sgwm-btn {
  background: var(--sg-primary) !important;
  color: ${textOnPrimary} !important;
  border: 1px solid var(--sg-primary) !important;
  box-shadow: none !important;
}
button.secondary, .btn.secondary, .button.secondary, .btn-secondary { background: var(--sg-secondary) !important; color: ${textOnSecondary} !important; border-color: var(--sg-secondary) !important; }
button.accent, .btn.accent, .button.accent { background: var(--sg-accent) !important; color: ${textOnAccent} !important; border-color: var(--sg-accent) !important; }

/* --- Forms --- */
input, textarea, select, label, fieldset, legend, .form, .form-control, .input, [class*="field"], [data-sgwm="form"], .sgwm-form {
  background: var(--sg-surface) !important;
  color: var(--sg-text) !important;
  border: 1px solid var(--sg-muted) !important;
}
input::placeholder, textarea::placeholder { color: color-mix(in srgb, var(--sg-muted) 85%, var(--sg-text) 15%) !important; }

/* --- Tables --- */
table, .table, th, td, thead, tbody, tfoot { color: var(--sg-text) !important; border-color: var(--sg-muted) !important; }

/* --- Footer --- */
footer, .site-footer, .page-footer, [role="contentinfo"], .footbar, [data-sgwm="footer"], .sgwm-footer {
  background: var(--sg-footer) !important;
  color: ${ensureReadableTextColor(t['--sg-footer'], t['--sg-text'])} !important;
  border-top: 1px solid var(--sg-muted) !important;
}

/* --- Micro elements --- */
.badge, .chip, .tag, .pill, .label, small, code, kbd, [data-sgwm="micro"], .sgwm-micro {
  background: color-mix(in srgb, var(--sg-surface) 85%, var(--sg-bg) 15%) !important;
  color: var(--sg-text) !important;
  border: 1px solid var(--sg-muted) !important;
}

/* --- Card-contained actions --- */
.card button, .card .btn, .card a.button { background: var(--sg-primary) !important; color: ${textOnPrimary} !important; }

/* --- transitions --- */
* { transition: background-color .12s ease, color .12s ease !important; }
`;

    // section fine-grained overrides
    let sectionCss = '';
    for (const sel in sectionOverrides) {
      const vars = sectionOverrides[sel];
      if (!vars) continue;
      const entries = Object.entries(vars).map(([k, v]) => `${k}:${v};`).join(' ');
      sectionCss += `${sel} { ${entries} }\n`;
    }

    return rootVars + mapping + sectionCss;
  }

  // -------------------------
  // Scan & Tag elements (called by iframe UI before preview commit)
  // -------------------------
  function scanAndTagElements(doc) {
    try {
      if (!doc) return;
      const tagIf = (nodeList, tagName) => {
        Array.from(nodeList || []).forEach(el => {
          try {
            if (!(el instanceof HTMLElement)) return;
            if (el.hasAttribute('data-sgwm')) return;
            el.setAttribute('data-sgwm', tagName);
            el.classList.add(`sgwm-${tagName}`);
          } catch (e) { /* ignore */ }
        });
      };

      tagIf(doc.querySelectorAll('header, .site-header, .global-header, [role="banner"]'), 'header');
      tagIf(doc.querySelectorAll('footer, .site-footer, [role="contentinfo"]'), 'footer');
      tagIf(doc.querySelectorAll('.hero, .hero-section, .jumbotron, .page-hero, .banner, .masthead-hero, [data-sgwm-region="hero"]'), 'hero');
      tagIf(doc.querySelectorAll('button, .btn, a.button, a.btn, [role="button"], input[type="button"], input[type="submit"]'), 'btn');
      tagIf(doc.querySelectorAll('.card, .panel, .tile, .box, .well, [class*="card"], [class*="tile"]'), 'card');
      tagIf(doc.querySelectorAll('form, .form, .form-group, label, input, textarea, select'), 'form');
      tagIf(doc.querySelectorAll('nav, .nav, .navbar, .main-menu, [role="navigation"]'), 'nav');
      tagIf(doc.querySelectorAll('section, .section, [data-sgwm-region], [data-block]'), 'section');
      tagIf(doc.querySelectorAll('.badge, .chip, .tag, .pill, .label, small, code, kbd'), 'micro');

      // ensure cards flagged
      Array.from(doc.querySelectorAll('.card, .panel')).forEach(card => {
        if (!card.hasAttribute('data-sgwm')) card.setAttribute('data-sgwm', 'card');
        if (!card.classList.contains('sgwm-card')) card.classList.add('sgwm-card');
      });
    } catch (e) {
      console.error('scanAndTagElements', e);
    }
  }

  // -------------------------
  // Inline fallbacks (apply final inline styles to stubborn elements)
  // -------------------------
  function applyInlineFallbacks(doc, palette) {
    try {
      if (!doc) return;
      const p = {
        primary: palette.primary || palette['--primary'] || '#2563eb',
        text: palette.text || palette['--text'] || '#111827',
        bg: palette.background || palette['--background'] || '#ffffff',
        surface: palette.surface || palette['--surface'] || palette.background || '#ffffff',
        card: palette.card || palette['--card'] || palette.surface || '#ffffff',
        muted: palette.muted || palette['--muted'] || '#6b7280'
      };

      // helper for computed style
      const comp = el => (el && el.ownerDocument && el.ownerDocument.defaultView) ? el.ownerDocument.defaultView.getComputedStyle(el) : null;

      const applyTo = (sel, cb) => {
        Array.from(doc.querySelectorAll(sel)).forEach(el => {
          try { cb(el); } catch (e) { }
        });
      };

      // Buttons
      applyTo('button, .btn, a.button, a.btn, [role="button"], input[type="button"], input[type="submit"]', el => {
        const cs = comp(el) || {};
        // if computed background is transparent or blank, set inline
        const bgc = cs.backgroundColor || '';
        if (!bgc || bgc === 'transparent' || bgc === 'rgba(0, 0, 0, 0)') el.style.background = p.primary;
        // ensure readable color
        const chosen = ensureReadableTextColor(el.style.background || p.primary, el.style.color || cs.color || p.text);
        el.style.color = chosen;
        if (!el.style.borderColor) el.style.borderColor = p.primary;
      });

      // Cards
      applyTo('.card, .panel, .tile, .box, [class*="card"]', el => {
        const cs = comp(el) || {};
        const bgc = cs.backgroundColor || '';
        if (!bgc || bgc === 'transparent') el.style.background = p.card;
        if (!el.style.color) el.style.color = p.text;
        if (!el.style.border) el.style.border = `1px solid ${p.muted}`;
      });

      // Header/Footer
      applyTo('header, .site-header, footer, .site-footer', el => {
        const cs = comp(el) || {};
        const bgc = cs.backgroundColor || '';
        if (!bgc || bgc === 'transparent') el.style.background = p.primary;
        el.style.color = ensureReadableTextColor(el.style.background || p.primary, el.style.color || cs.color || p.text);
      });

      // Forms
      applyTo('input, textarea, select', el => {
        const cs = comp(el) || {};
        const bgc = cs.backgroundColor || '';
        if (!bgc || bgc === 'transparent') el.style.background = p.surface;
        if (!el.style.color) el.style.color = p.text;
      });

    } catch (e) {
      console.error('applyInlineFallbacks', e);
    }
  }

  // -------------------------
  // Post messages to parent for preview/commit flow
  // -------------------------
  function sendPreview(payload) {
    window.parent.postMessage({ type: 'APPLY_THEME_PREVIEW', payload }, '*');
  }
  function sendClearPreview() {
    window.parent.postMessage({ type: 'CLEAR_THEME_PREVIEW' }, '*');
  }
  function sendCommit(payload) {
    window.parent.postMessage({ type: 'COMMIT_THEME', payload }, '*');
  }
  function sendClose() {
    window.parent.postMessage({ type: 'CLOSE_THEME_TOOL' }, '*');
  }

  // -------------------------
  // UI: build and mount
  // -------------------------
  function mountUI() {
    const host = document.getElementById('sgwm-theme-host') || document.body;
    host.innerHTML = ''; // clean host

    // Container
    const wrap = document.createElement('div');
    wrap.style.fontFamily = 'system-ui, -apple-system, "Segoe UI", Roboto, Inter, Arial, sans-serif';
    wrap.style.padding = '12px';
    wrap.style.boxSizing = 'border-box';
    wrap.style.maxWidth = '920px';
    wrap.style.margin = '10px auto';
    wrap.style.color = '#071024';

    // Header
    const titleEl = document.createElement('div');
    titleEl.style.display = 'flex';
    titleEl.style.justifyContent = 'space-between';
    titleEl.style.alignItems = 'center';
    titleEl.innerHTML = `<div><h2 style="margin:0;font-size:18px">SGWM Pro — Universal Theme Engine</h2><div style="font-size:12px;color:#415165">Preview → tweak → save • per-section overrides • fallback-safe</div></div>`;
    wrap.appendChild(titleEl);

    // Presets grid
    const grid = document.createElement('div');
    grid.style.display = 'grid';
    grid.style.gridTemplateColumns = 'repeat(auto-fill, minmax(220px, 1fr))';
    grid.style.gap = '10px';
    grid.style.marginTop = '12px';
    PRESETS.forEach(preset => {
      const card = document.createElement('button');
      card.type = 'button';
      card.style.display = 'block';
      card.style.textAlign = 'left';
      card.style.padding = '10px';
      card.style.border = '1px solid rgba(10,20,40,0.06)';
      card.style.borderRadius = '10px';
      card.style.background = '#fff';
      card.style.cursor = 'pointer';
      card.style.boxShadow = '0 6px 16px rgba(11,22,40,0.04)';
      card.setAttribute('aria-label', `Pick ${preset.name}`);
      const pal = preset.palette;
      const swatches = ['primary', 'secondary', 'accent', 'background', 'text'].map(k => `<div style="height:18px;border-radius:6px;background:${pal[k]};flex:1;border:1px solid rgba(0,0,0,0.04)"></div>`).join('');
      card.innerHTML = `<div style="font-weight:700;margin-bottom:8px">${preset.name}</div><div style="display:flex;gap:6px">${swatches}</div>`;
      card.onclick = () => {
        CURRENT.presetId = preset.id;
        CURRENT.palette = Object.assign({}, preset.palette);
        CURRENT.tweaked = false;
        CURRENT.sectionOverrides = {};
        // Send preview payload (themeVars + overrides)
        sendPreview({ themeVars: mapPaletteToVars(CURRENT.palette), sectionOverrides: {} });
        // reflect in tweak UI
        populateTweakers(CURRENT.palette);
        persistLocal();
      };
      grid.appendChild(card);
    });
    wrap.appendChild(grid);

    // Tweak controls
    const tweakWrap = document.createElement('div');
    tweakWrap.style.marginTop = '14px';
    tweakWrap.style.display = 'flex';
    tweakWrap.style.gap = '12px';
    tweakWrap.style.flexWrap = 'wrap';
    tweakWrap.innerHTML = `
      <div style="min-width:160px">
        <div style="font-size:12px;color:#445">Primary</div>
        <input id="sgwm-pick-primary" type="color" style="width:100%;height:36px;border-radius:8px;border:1px solid #ddd"/>
      </div>
      <div style="min-width:160px">
        <div style="font-size:12px;color:#445">Secondary</div>
        <input id="sgwm-pick-secondary" type="color" style="width:100%;height:36px;border-radius:8px;border:1px solid #ddd"/>
      </div>
      <div style="min-width:160px">
        <div style="font-size:12px;color:#445">Background</div>
        <input id="sgwm-pick-bg" type="color" style="width:100%;height:36px;border-radius:8px;border:1px solid #ddd"/>
      </div>
      <div style="min-width:160px">
        <div style="font-size:12px;color:#445">Text</div>
        <input id="sgwm-pick-text" type="color" style="width:100%;height:36px;border-radius:8px;border:1px solid #ddd"/>
      </div>
      <div style="min-width:160px">
        <div style="font-size:12px;color:#445">Muted</div>
        <input id="sgwm-pick-muted" type="color" style="width:100%;height:36px;border-radius:8px;border:1px solid #ddd"/>
      </div>
    `;
    wrap.appendChild(tweakWrap);

    // Per-section quick map
    const sectionRow = document.createElement('div');
    sectionRow.style.marginTop = '12px';
    sectionRow.style.display = 'flex';
    sectionRow.style.flexWrap = 'wrap';
    sectionRow.style.gap = '8px';
    ['nav', 'hero', 'card', 'button', 'section', 'footer', 'micro'].forEach(k => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = k.charAt(0).toUpperCase() + k.slice(1);
      b.style.padding = '6px 10px';
      b.style.borderRadius = '999px';
      b.style.border = '1px solid rgba(11,22,40,0.06)';
      b.style.cursor = 'pointer';
      b.onclick = () => {
        // quick map: request parent to run quick map? We'll send APPLY_THEME_PREVIEW with sectionOverrides that target this selector
        if (!CURRENT.palette) return alert('Pick a preset first');
        const overrides = {};
        // create small override for that selector (map keys to CSS variables used by parent)
        const mapSel = {
          nav: 'header, nav, .site-header, [data-sgwm="nav"]',
          hero: '.hero, .hero-section, [data-sgwm="hero"]',
          card: '.card, .panel, .tile, [data-sgwm="card"]',
          button: 'button, .btn, a.button, a.btn, [data-sgwm="btn"]',
          section: 'section, .section, [data-sgwm="section"]',
          footer: 'footer, .site-footer, [data-sgwm="footer"]',
          micro: '.badge, .chip, .tag, .pill, .label, .sgwm-micro'
        }[k] || 'section';
        overrides[mapSel] = {
          '--sg-primary': CURRENT.palette.primary,
          '--sg-secondary': CURRENT.palette.secondary,
          '--sg-bg': CURRENT.palette.background,
          '--sg-text': CURRENT.palette.text
        };
        // send preview with section override
        sendPreview({ themeVars: mapPaletteToVars(CURRENT.palette), sectionOverrides: overrides, quickMap: k });
      };
      sectionRow.appendChild(b);
    });
    wrap.appendChild(sectionRow);

    // Actions
    const actions = document.createElement('div');
    actions.style.marginTop = '14px';
    actions.style.display = 'flex';
    actions.style.justifyContent = 'space-between';
    actions.style.alignItems = 'center';

    const info = document.createElement('div');
    info.style.fontSize = '12px';
    info.style.color = '#556';
    info.textContent = 'Preview is non-destructive. Save commits theme to exported ZIP.';
    actions.appendChild(info);

    const buttons = document.createElement('div');
    buttons.style.display = 'flex';
    buttons.style.gap = '8px';

    const btnClear = document.createElement('button');
    btnClear.type = 'button';
    btnClear.textContent = 'Clear Preview';
    btnClear.style.padding = '8px 12px';
    btnClear.onclick = () => {
      sendClearPreview();
      // also reset local CURRENT? not necessary
    };

    const btnSave = document.createElement('button');
    btnSave.type = 'button';
    btnSave.textContent = 'Save Theme';
    btnSave.style.padding = '8px 12px';
    btnSave.style.background = '#0b61ff';
    btnSave.style.color = '#fff';
    btnSave.style.border = 'none';
    btnSave.style.borderRadius = '8px';
    btnSave.onclick = () => {
      if (!CURRENT.palette) return alert('Pick a preset first.');
      // build payload: themeVars & overrides, scope selection prompt
      const scope = prompt('Apply theme to (type: all / page):', 'all') || 'all';
      const payload = { themeVars: mapPaletteToVars(CURRENT.palette), sectionOverrides: CURRENT.sectionOverrides || {}, scope: scope === 'page' ? 'page' : 'all', page: scope === 'page' ? getActivePageName() : undefined, finalPalette: CURRENT.palette };
      // request commit
      sendCommit(payload);
      // parent will respond with THEME_COMMIT_DONE; we can close or keep open
    };

    buttons.appendChild(btnClear);
    buttons.appendChild(btnSave);
    actions.appendChild(buttons);
    wrap.appendChild(actions);

    // Footer small actions
    const foot = document.createElement('div');
    foot.style.marginTop = '12px';
    foot.style.display = 'flex';
    foot.style.justifyContent = 'space-between';
    foot.style.alignItems = 'center';
    foot.style.fontSize = '12px';
    foot.style.color = '#667';

    const btnExport = document.createElement('button');
    btnExport.type = 'button';
    btnExport.textContent = 'Get CSS';
    btnExport.style.padding = '6px 10px';
    btnExport.onclick = () => {
      const css = getActiveCss();
      // show in prompt for now
      const w = window.open('', '_blank', 'noopener');
      w.document.write(`<pre style="white-space:pre-wrap">${escapeHtml(css)}</pre>`);
    };

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.textContent = 'Close';
    btnClose.style.padding = '6px 10px';
    btnClose.onclick = () => {
      sendClearPreview();
      sendClose();
    };

    foot.appendChild(btnExport);
    foot.appendChild(btnClose);
    wrap.appendChild(foot);

    host.appendChild(wrap);

    // hookup tweak inputs
    const ipPrimary = document.getElementById('sgwm-pick-primary') || wrap.querySelector('#sgwm-pick-primary');
    const ipSecondary = document.getElementById('sgwm-pick-secondary') || wrap.querySelector('#sgwm-pick-secondary');
    const ipBg = document.getElementById('sgwm-pick-bg') || wrap.querySelector('#sgwm-pick-bg');
    const ipText = document.getElementById('sgwm-pick-text') || wrap.querySelector('#sgwm-pick-text');
    const ipMuted = document.getElementById('sgwm-pick-muted') || wrap.querySelector('#sgwm-pick-muted');

    function mapPaletteToVars(pal) {
      return {
        '--sg-primary': hex(pal.primary || pal['primary'] || pal['--primary'] || pal['--sg-primary']),
        '--sg-secondary': hex(pal.secondary || pal['secondary'] || pal['--secondary'] || pal['--sg-secondary']),
        '--sg-accent': hex(pal.accent || pal['accent'] || pal['--accent'] || '#f59e0b'),
        '--sg-bg': hex(pal.background || pal['background'] || pal['--background'] || pal['--sg-bg']),
        '--sg-surface': hex(pal.surface || pal['surface'] || pal['--surface'] || pal['--sg-surface']),
        '--sg-text': hex(pal.text || pal['text'] || pal['--text'] || '#111827'),
        '--sg-muted': hex(pal.muted || pal['muted'] || pal['--muted'] || '#6b7280'),
        '--sg-hero': hex(pal.hero || pal['hero'] || pal['--hero'] || '#f6fbff'),
        '--sg-footer': hex(pal.footer || pal['footer'] || pal['--footer'] || '#0b1020'),
        '--sg-card': hex(pal.card || pal['card'] || pal['--card'] || pal.surface || pal['--sg-surface'] || '#ffffff')
      };
    }

    function populateTweakers(palette) {
      try {
        if (!palette) return;
        ipPrimary.value = hex(palette.primary || palette['primary'] || palette['--primary'] || '#2563eb') || '#2563eb';
        ipSecondary.value = hex(palette.secondary || palette['secondary'] || palette['--secondary'] || '#10b981') || '#10b981';
        ipBg.value = hex(palette.background || palette['background'] || palette['--background'] || '#ffffff') || '#ffffff';
        ipText.value = hex(palette.text || palette['text'] || palette['--text'] || '#111827') || '#111827';
        ipMuted.value = hex(palette.muted || palette['muted'] || palette['--muted'] || '#6b7280') || '#6b7280';
      } catch (e) { }
    }

    function readTweakers() {
      const pal = {
        primary: ipPrimary.value,
        secondary: ipSecondary.value,
        background: ipBg.value,
        text: ipText.value,
        muted: ipMuted.value,
        surface: ipBg.value, // surface defaults to background unless user tweaks more UI later
        card: ipBg.value
      };
      CURRENT.palette = pal;
      CURRENT.tweaked = true;
      return pal;
    }

    // live update when tweakers change
    [ipPrimary, ipSecondary, ipBg, ipText, ipMuted].forEach(ip => {
      ip.addEventListener('input', () => {
        const pal = readTweakers();
        sendPreview({ themeVars: mapPaletteToVars(pal), sectionOverrides: CURRENT.sectionOverrides || {} });
        persistLocal();
      });
    });

    // helpers
    function escapeHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

    // restore local state if present
    try {
      const saved = JSON.parse(localStorage.getItem('sgwm_pro_theme_saved') || 'null');
      if (saved && saved.palette) {
        CURRENT = saved;
        populateTweakers(CURRENT.palette);
        // auto preview the saved palette
        sendPreview({ themeVars: mapPaletteToVars(CURRENT.palette), sectionOverrides: CURRENT.sectionOverrides || {} });
      }
    } catch (e) { /* ignore */ }

    // persist to local
    function persistLocal() {
      try {
        localStorage.setItem('sgwm_pro_theme_saved', JSON.stringify(CURRENT));
      } catch (e) { }
    }

    // small helper to attempt getting active page name from parent via messaging
    function getActivePageName() {
      // we can ask parent for active page via postMessage and wait for reply; simple synchronous approach not reliable
      // return undefined; parent may attach active page in COMMIT payload if scope=page
      return undefined;
    }

  } // end mountUI

  // -------------------------
  // Exporter: let parent call getActiveCss
  // -------------------------
  function makeCssFromCurrent() {
    if (!CURRENT || !CURRENT.palette) {
      // if no current pick, return an empty / default css
      return buildFullThemeCss({}, {});
    }
    return buildFullThemeCss(CURRENT.palette, CURRENT.sectionOverrides || {});
  }
  window.SGWM_PRO_THEME_EXPORTER = {
    getActiveCss: () => makeCssFromCurrent(),
    ensureThemeInFiles(files, cssPath = 'css/sgwm-theme.css') {
      // files: array-like of {path, content} or object map. We'll support both.
      const css = makeCssFromCurrent();
      // If files is array of {path, content}
      if (Array.isArray(files)) {
        const updated = [];
        let added = false;
        for (const f of files) {
          if (f.path && /\.css$/i.test(f.path) && f.path.endsWith(cssPath.split('/').pop())) {
            // replace
            updated.push({ path: cssPath, content: css });
            added = true;
          } else if (f.path && /\.html?$/i.test(f.path)) {
            // ensure link injection (dedup)
            let cont = f.content || '';
            if (!/id=["']sgwm-theme-css["']/.test(cont) && !/sgwm-theme\.css/.test(cont)) {
              // inject before </head>
              if (/<\/head>/i.test(cont)) cont = cont.replace(/<\/head>/i, `  <link id="sgwm-theme-css" rel="stylesheet" href="${cssPath}">\n</head>`);
              else cont = `<link id="sgwm-theme-css" rel="stylesheet" href="${cssPath}">\n${cont}`;
            }
            updated.push({ path: f.path, content: cont });
          } else {
            updated.push(f);
          }
        }
        if (!added) updated.push({ path: cssPath, content: css });
        return updated;
      } else if (typeof files === 'object') {
        // map: path -> content. We'll ensure cssPath set
        const out = Object.assign({}, files);
        out[cssPath] = css;
        // add link injection for html files in map
        Object.keys(out).forEach(k => {
          if (/\.html?$/i.test(k)) {
            let cont = out[k] || '';
            if (!/id=["']sgwm-theme-css["']/.test(cont) && !/sgwm-theme\.css/.test(cont)) {
              if (/<\/head>/i.test(cont)) cont = cont.replace(/<\/head>/i, `  <link id="sgwm-theme-css" rel="stylesheet" href="${cssPath}">\n</head>`);
              else cont = `<link id="sgwm-theme-css" rel="stylesheet" href="${cssPath}">\n${cont}`;
            }
            out[k] = cont;
          }
        });
        return out;
      } else {
        return files;
      }
    }
  };

  // -------------------------
  // Incoming messages from parent (optional feedback)
  // -------------------------
  window.addEventListener('message', (e) => {
    const d = e.data;
    if (!d) return;
    // parent might notify 'preview failed due cross-origin' or similar; we can show alerts or UI feedback (not implemented heavy)
    if (d && d.type === 'THEME_COMMIT_DONE') {
      // parent committed theme; can show a toast or save state
      try {
        CURRENT && (CURRENT.committedAt = new Date().toISOString());
        localStorage.setItem('sgwm_pro_theme_saved', JSON.stringify(CURRENT || {}));
        // simple user feedback:
        try { alert('Theme committed successfully.'); } catch (_) { }
      } catch (err) { /* ignore */ }
    }
    if (d && d.type === 'CLOSE_THEME_TOOL') {
      // parent asked to close; optional cleanup
      try { /* cleanup if needed */ } catch (e) { }
    }
  });

  // -------------------------
  // Start UI
  // -------------------------
  try {
    mountUI();
  } catch (err) {
    console.error('Failed to mount theme UI', err);
    // fallback: minimal UI
    try {
      const host = document.getElementById('sgwm-theme-host') || document.body;
      host.innerHTML = `<div style="padding:16px">Theme tool failed to load. See console.</div>`;
    } catch { }
  }

})();
