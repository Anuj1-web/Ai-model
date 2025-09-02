// ================ Theme Tool (parent controller) ===================

// Elements already present in your HTML
const themeBtn = document.getElementById('open-theme-tool');
const themeFrame = document.getElementById('sgwm-theme-frame'); // iframe element (theme.html)

// Utility: compute relative luminance and contrast to avoid invisible elements
function hexToRgb(hex){
  if(!hex) return null;
  hex = hex.replace('#','');
  if(hex.length===3) hex = hex.split('').map(c=>c+c).join('');
  const int = parseInt(hex,16);
  return { r:(int>>16)&255, g:(int>>8)&255, b:int&255 };
}
function lum(c){
  // c: {r,g,b}
  const srgb = [c.r/255,c.g/255,c.b/255].map(v => v<=0.03928 ? v/12.92 : Math.pow((v+0.055)/1.055,2.4));
  return 0.2126*srgb[0] + 0.7152*srgb[1] + 0.0722*srgb[2];
}
function contrastRatio(hex1, hex2){
  const a = lum(hexToRgb(hex1));
  const b = lum(hexToRgb(hex2));
  const L1 = Math.max(a,b), L2 = Math.min(a,b);
  return (L1+0.05)/(L2+0.05);
}
// Adjust a color slightly to improve contrast (basic approach)
function adjustColorForContrast(fgHex, bgHex, minRatio){
  try {
    const fg = hexToRgb(fgHex);
    const bg = hexToRgb(bgHex);
    if(!fg || !bg) return fgHex;
    let ratio = contrastRatio(fgHex, bgHex);
    if(ratio >= minRatio) return fgHex;
    // simple approach: nudge fg towards black or white whichever increases contrast faster
    const towardsWhite = { r: Math.min(255, fg.r + 24), g: Math.min(255, fg.g + 24), b: Math.min(255, fg.b + 24) };
    const towardsBlack = { r: Math.max(0, fg.r - 24), g: Math.max(0, fg.g - 24), b: Math.max(0, fg.b - 24) };
    const wHex = '#' + ((1<<24) + (towardsWhite.r<<16) + (towardsWhite.g<<8) + towardsWhite.b).toString(16).slice(1);
    const bHex = '#' + ((1<<24) + (towardsBlack.r<<16) + (towardsBlack.g<<8) + towardsBlack.b).toString(16).slice(1);
    return contrastRatio(wHex, bgHex) > contrastRatio(bHex, bgHex) ? wHex : bHex;
  } catch(e){
    return fgHex;
  }
}

// Scan active page (heuristics) and produce sections/elements array
function scanActivePage() {
  const result = { page: activePage, sections: [] };
  if (!activePage || !iframeRefs[activePage]) return result;
  try {
    const doc = iframeRefs[activePage].contentDocument || iframeRefs[activePage].contentWindow.document;
    // priority selectors for likely major regions
    const topSelectors = ['header','[role="banner"]','.hero','.header','.site-header','nav','main','footer','[role="contentinfo"]','section'];
    const found = new Set();
    topSelectors.forEach(sel => {
      doc.querySelectorAll(sel).forEach(el => {
        if(!el || found.has(el)) return;
        found.add(el);
        // build a friendly object
        const id = el.id || el.getAttribute('data-edit-id') || ('sec_' + Math.random().toString(36).slice(2,8));
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : { width:0, height:0 };
        const outer = el.outerHTML || el.innerHTML || '';
        // try to capture a small preview HTML (sanitized minimal)
        const preview = outer.slice(0, 3000);
        // detect type
        const type = (sel.includes('footer') || sel.includes('contentinfo')) ? 'footer' : (sel.includes('header') ? 'header' : (sel.includes('hero') ? 'hero' : 'section'));
        result.sections.push({
          id,
          selector: (el.id ? '#'+el.id : (el.className ? '.'+String(el.className).split(' ').filter(Boolean)[0] : null)),
          type,
          width: rect.width,
          height: rect.height,
          previewHtml: preview
        });
      });
    });

    // Fallback: if not found, add body as single section
    if(result.sections.length===0){
      const body = doc.body;
      result.sections.push({
        id: 'body',
        selector: 'body',
        type: 'body',
        width: body.clientWidth,
        height: body.clientHeight,
        previewHtml: (body && body.innerHTML) ? body.innerHTML.slice(0,2000) : ''
      });
    }

    // Find some common element groups (buttons/cards/typography)
    const buttons = Array.from(doc.querySelectorAll('button, .btn, [role="button"]')).slice(0,20).map((b,i)=>({
      id: b.id || ('btn_'+i+'_'+Math.random().toString(36).slice(2,6)),
      tag: b.tagName,
      text: (b.innerText||'').slice(0,60)
    }));
    const texts = Array.from(doc.querySelectorAll('p,h1,h2,h3,span')).slice(0,30).map((t,i)=>({
      id: t.id || ('txt_'+i+'_'+Math.random().toString(36).slice(2,6)),
      tag: t.tagName,
      snippet: (t.innerText||'').slice(0,120)
    }));

    result.buttons = buttons;
    result.texts = texts;
  } catch (err) {
    console.error('scanActivePage failed', err);
  }
  return result;
}

// Build CSS string from variables + sectionOverrides
function buildCssFromTheme(themeVars = {}, sectionOverrides = {}) {
  // themeVars: { '--sg-primary': '#123456', '--sg-bg': '#fff', ... }
  // sectionOverrides: { selector: { '--sg-primary': '#f00', ... }, ... }
  let rootVars = ':root{';
  Object.keys(themeVars).forEach(k => {
    rootVars += `${k}:${themeVars[k]};`;
  });
  rootVars += '} \n';

  let sectionCss = '';
  Object.keys(sectionOverrides || {}).forEach(sel => {
    let vars = sectionOverrides[sel];
    let block = `${sel}{`;
    Object.keys(vars).forEach(k => block += `${k}:${vars[k]};`);
    block += '}\n';
    sectionCss += block;
  });

  // Basic utility: map common tokens to actual properties so theme can affect many things
  // E.g. primary color variable applied to buttons, links, etc.
  const mapping = `
/* Generated convenience rules so variables actually style elements */
button, .btn, [role="button"] { color: var(--sg-button-text, #fff); background: var(--sg-button-bg, var(--sg-primary)); border-color: var(--sg-button-border, transparent); }
a { color: var(--sg-link, var(--sg-primary)); }
body { background: var(--sg-bg, #fff); color: var(--sg-text, #111); }
.card, .card * { color: var(--sg-card-text, var(--sg-text)); background: var(--sg-card-bg, #fff); }
`;

  return rootVars + mapping + sectionCss;
}

// Open theme iframe and send INIT payload
themeBtn.addEventListener('click', () => {
  // show iframe (create if necessary)
  themeFrame.style.display = 'block';
  try {
    // scan active page
    const scan = scanActivePage();
    // attempt to fetch currently active CSS (via global exporter if available)
    let currentCss = '';
    try { currentCss = themeFrame.contentWindow?.SGWM_PRO_THEME_EXPORTER?.getActiveCss?.() || ''; } catch(e){}
    // Send INIT to theme.html
    themeFrame.contentWindow.postMessage({ type: 'THEME_INIT', payload: { scan, currentCss } }, '*');
  } catch(e){
    console.error('failed to init theme frame', e);
  }
  try{ themeFrame.contentWindow && themeFrame.contentWindow.postMessage('sgwm-preview-changed','*'); }catch{}
});

// Listen for messages from theme.html (child) for preview/apply/commit actions
window.addEventListener('message', (e) => {
  const d = e.data || {};
  // Preview -> apply preview CSS to active page only (non-destructive)
  if (d && d.type === 'APPLY_THEME_PREVIEW') {
    // d.payload = { themeVars: {...}, sectionOverrides: {...} }
    const css = buildCssFromTheme(d.payload.themeVars || {}, d.payload.sectionOverrides || {});
    // ensure contrast for some common variable pairs (basic safety)
    // If user sets --sg-text same as --sg-bg we nudge text color
    const tv = d.payload.themeVars || {};
    if(tv['--sg-text'] && tv['--sg-bg']) {
      const ratio = contrastRatio(tv['--sg-text'], tv['--sg-bg']);
      if(ratio < 3.5) {
        tv['--sg-text'] = adjustColorForContrast(tv['--sg-text'], tv['--sg-bg'], 4.5);
      }
    }
    // Send preview css into the active page iframe (bridge listens for THEME_PREVIEW)
    try {
      if(activePage && iframeRefs[activePage] && iframeRefs[activePage].contentWindow) {
        iframeRefs[activePage].contentWindow.postMessage({ type: 'THEME_PREVIEW', css }, '*');
      }
    } catch(err){ console.error('preview send failed', err); }
  }

  // Clear preview
  if (d && d.type === 'CLEAR_THEME_PREVIEW') {
    try {
      if(activePage && iframeRefs[activePage] && iframeRefs[activePage].contentWindow) {
        iframeRefs[activePage].contentWindow.postMessage({ type: 'THEME_CLEAR_PREVIEW' }, '*');
      }
    } catch(err){}
  }

  // Commit theme: generate theme.css, add to otherFiles, and inject link/committed style to pages
  if (d && d.type === 'COMMIT_THEME') {
    // payload: { themeVars, sectionOverrides, scope: 'all'|'page', pageId(optional) }
    const payload = d.payload || {};
    const css = buildCssFromTheme(payload.themeVars || {}, payload.sectionOverrides || {});
    // Save theme.css into otherFiles so export includes it
    // otherFiles can accept string content as value for zip.file; keep consistent
    otherFiles['sgwm-theme.css'] = css; // core export will add it into ZIP

    // Add link or inline style to pages depending on scope
    if (payload.scope === 'page' && payload.page) {
      // apply to only active page
      try {
        const p = payload.page;
        const iframe = iframeRefs[p];
        if (iframe && iframe.contentWindow) {
          // Tell the iframe to commit (it will post back THEME_COMMIT_DONE with updated html)
          iframe.contentWindow.postMessage({ type: 'THEME_COMMIT', css }, '*');
        }
      } catch(e){ console.error(e); }
    } else {
      // Apply to all pages: iterate over page names and inject <link rel="stylesheet" href="sgwm-theme.css"> if not present
      pages.forEach((pg) => {
        let html = editedContents[pg] || pageContents[pg] || '';
        // if link exists, replace; otherwise insert in head
        if (/<link[^>]*sgwm-theme\.css[^>]*>/i.test(html) || /data-sgwm-theme/.test(html)) {
          // remove existing and we'll add a link below to keep single source
          html = html.replace(/<link[^>]*sgwm-theme\.css[^>]*>/ig, '');
          html = html.replace(/<style[^>]*data-sgwm-theme[^>]*>.*?<\/style>/igs, '');
        }
        // prefer adding link to css file
        if (/<head[^>]*>/i.test(html)) {
          html = html.replace(/<head([^>]*)>/i, `<head$1>\n<link rel="stylesheet" href="sgwm-theme.css">`);
        } else {
          // fallback: insert at start of document
          html = `<!DOCTYPE html><html><head><link rel="stylesheet" href="sgwm-theme.css"></head>` + html.replace(/<!DOCTYPE html>/i,'').replace(/<html>/i,'');
        }
        // save back
        editedContents[pg] = html;
      });
      // Also update live active iframe to reflect committed style
      if(activePage && iframeRefs[activePage] && iframeRefs[activePage].contentWindow) {
        iframeRefs[activePage].contentWindow.postMessage({ type: 'THEME_COMMIT', css }, '*');
      }
    }

    // Notify theme.html that commit succeeded (it should close or show success)
    try {
      themeFrame.contentWindow.postMessage({ type: 'THEME_COMMIT_DONE', payload: { success: true } }, '*');
    } catch(e){}
  }

  // When iframe posts THEME_COMMIT_DONE with updated HTML (per-page commit), update editedContents
  if (d && d.type === 'THEME_COMMIT_DONE' && d.page && d.html) {
    try {
      editedContents[d.page] = d.html;
      // Also ensure otherFiles has our theme.css (already set above)
    } catch(e){}
  }

  // Allow theme iframe to ask to close the tool
  if (d && d === 'close-theme' || (d && d.type === 'CLOSE_THEME_TOOL')) {
    themeFrame.style.display = 'none';
  }
});
