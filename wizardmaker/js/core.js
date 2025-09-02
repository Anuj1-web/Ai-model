// ================= CORE LOGIC =================

// Global state
let pages = [];                 // array of page filenames
let pageContents = {};          // original contents from zip
let editedContents = {};        // working edits per page
let activePage = null;          // currently active page filename
let iframeRefs = {};            // map page->iframe element
let otherFiles = {};            // non-HTML files from zip

// Editor modal elements
const editorModal = document.getElementById("editorModal");
const editorTextInput = document.getElementById("editorTextInput");
const editorPlaceholderInput = document.getElementById("editorPlaceholderInput");
const editorColorInput = document.getElementById("editorColorInput");
const editorImageInput = document.getElementById("editorImageInput");
const saveEditBtn = document.getElementById("saveEditBtn");
const cancelEditBtn = document.getElementById("cancelEditBtn");

let currentEdit = null;

// ================= ZIP Import =================
document.getElementById("importZip").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const zip = await JSZip.loadAsync(file);
  pages = [];
  pageContents = {};
  editedContents = {};
  otherFiles = {};
  const entries = Object.keys(zip.files);

  for (const filename of entries) {
    const entry = zip.files[filename];
    if (entry.dir) continue;
    const content = await entry.async("string");
    if (filename.endsWith(".html")) {
      pages.push(filename);
      pageContents[filename] = content;
      editedContents[filename] = content;
    } else {
      otherFiles[filename] = await entry.async("uint8array");
    }
  }
  if (pages.length) {
    activePage = pages[0];
    renderTabs();
    renderIframes();
  }
});

// ================= ZIP Export =================
document.getElementById("exportZip").addEventListener("click", async () => {
  const zip = new JSZip();
  // Add edited html
  pages.forEach((p) => {
    zip.file(p, editedContents[p] || pageContents[p] || "");
  });
  // Add other files
  Object.entries(otherFiles).forEach(([filename, content]) => {
    zip.file(filename, content);
  });
  const blob = await zip.generateAsync({ type: "blob" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "edited-site.zip";
  a.click();
});

// ================= Tabs =================
function renderTabs() {
  const tabBar = document.getElementById("tabBar");
  tabBar.innerHTML = "";
  pages.forEach((p) => {
    const tab = document.createElement("div");
    tab.className = "tab" + (p === activePage ? " active" : "");
    tab.textContent = p;
    tab.onclick = () => {
      activePage = p;
      renderTabs();
      renderIframes();
    };
    tabBar.appendChild(tab);
  });
}

// ================= Iframe Rendering =================
function renderIframes() {
  const preview = document.getElementById("preview");
  preview.innerHTML = "";
  iframeRefs = {};
  if (!activePage) return;

  const iframe = document.createElement("iframe");
  iframe.srcdoc = editedContents[activePage] || pageContents[activePage] || "";
  preview.appendChild(iframe);
  iframeRefs[activePage] = iframe;

  iframe.onload = () => {
    // Inject bridge script
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(
      injectEditingBridge(
        editedContents[activePage] || pageContents[activePage],
        activePage
      )
    );
    doc.close();
  };
}

// ================= Editing Bridge =================
function injectEditingBridge(html, pageName) {
  const bridge = `<script>(function(){
    var EDIT_ATTR='data-edit-id';
    var clickTimers={};
    function ensureId(el){
      if(!el.getAttribute(EDIT_ATTR)) 
        el.setAttribute(EDIT_ATTR,'e'+Math.random().toString(36).slice(2,9));
      return el.getAttribute(EDIT_ATTR);
    }
    function buildSnapshot(el){
      return {
        html: el.innerHTML || '',
        text: el.innerText || '',
        placeholder: ('placeholder' in el ? el.placeholder || undefined : undefined),
        src: (el.tagName==='IMG'?(el.getAttribute('src')||el.src||''):undefined),
        inline:{color:el.style.color,backgroundColor:el.style.backgroundColor}
      };
    }

    // Existing edit click/dblclick behavior
    document.addEventListener('click',function(e){
      var el=e.target;if(!el)return;
      var tn=(el.tagName||'').toUpperCase();
      if(tn==='A'||tn==='BUTTON'||tn==='INPUT'||tn==='TEXTAREA'){
        var id=ensureId(el);
        e.preventDefault();e.stopPropagation();
        if(clickTimers[id]){
          clearTimeout(clickTimers[id]);clickTimers[id]=null;
          var snap=buildSnapshot(el);
          parent.postMessage({type:'OPEN_EDITOR',page:'${pageName}',id:id,
            hasText:!!el.innerText,
            hasPlaceholder:('placeholder' in el),
            ...snap},'*');
        }else{
          clickTimers[id]=setTimeout(function(){
            clickTimers[id]=null;
            var href=(el.tagName==='A'&&el.href)?el.href:null;
            if(href) window.location.href=href; else el.click();
          },300);
        }
      }
    },true);

    document.addEventListener('dblclick',function(e){
      var el=e.target;if(!el)return;
      e.preventDefault();e.stopPropagation();
      var id=ensureId(el);
      var snap=buildSnapshot(el);
      parent.postMessage({type:'OPEN_EDITOR',page:'${pageName}',id:id,
        hasText:!!el.innerText,
        hasPlaceholder:('placeholder' in el),
        ...snap},'*');
    },true);

    // Message receiver (text/color/image + theme messages)
    window.addEventListener('message',function(ev){
      var d=ev.data||{};
      // existing handlers
      var el=document.querySelector('['+EDIT_ATTR+'="'+d.id+'"]');
      if(el && d.type==='APPLY_TEXT'){
        if('placeholder' in el) el.placeholder=d.text||''; else el.innerText=d.text||'';
      }
      if(el && d.type==='APPLY_COLOR'){ if(d.target==='background') el.style.backgroundColor=d.color; else el.style.color=d.color; }
      if(el && d.type==='APPLY_IMAGE'&&el.tagName==='IMG') el.src=d.src;
      if(el && d.type==='RESTORE_ELEMENT'&&d.snapshot){
        if(d.snapshot.html!==undefined && !('placeholder' in el)) el.innerHTML=d.snapshot.html;
        if(d.snapshot.placeholder!==undefined && 'placeholder' in el) el.placeholder=d.snapshot.placeholder;
        if(d.snapshot.src!==undefined&&el.tagName==='IMG') el.src=d.snapshot.src;
        if(d.snapshot.inline){ el.style.color=d.snapshot.inline.color||''; el.style.backgroundColor=d.snapshot.inline.backgroundColor||''; }
      }

      // THEME PREVIEW: inject or update a non-destructive preview style element in the page
      if(d.type === 'THEME_PREVIEW' && typeof d.css === 'string') {
        var id = 'sgwm-theme-preview';
        var s = document.getElementById(id);
        if(!s){
          s = document.createElement('style');
          s.id = id;
          s.setAttribute('data-sgwm-preview','true');
          document.head.appendChild(s);
        }
        s.textContent = d.css;
      }

      // THEME_CLEAR_PREVIEW: remove preview style
      if(d.type === 'THEME_CLEAR_PREVIEW') {
        var s2 = document.getElementById('sgwm-theme-preview');
        if(s2) s2.parentNode.removeChild(s2);
      }

      // THEME_COMMIT: apply permanent theme CSS into the document head (inline style tag)
      if(d.type === 'THEME_COMMIT' && typeof d.css === 'string') {
        // Add a permanent style (data-sgwm-theme) so it persists when serializing outerHTML
        var existing = document.querySelector('style[data-sgwm-theme]');
        if(existing) existing.textContent = d.css;
        else {
          var el2 = document.createElement('style');
          el2.setAttribute('data-sgwm-theme','true');
          el2.textContent = d.css;
          document.head.appendChild(el2);
        }
        // return the updated HTML snapshot to parent for saving if requested
        parent.postMessage({ type: 'THEME_COMMIT_DONE', page: '${pageName}', html: '<!DOCTYPE html>' + document.documentElement.outerHTML }, '*');
      }
    });
  })();<\/script>`;
  return html.replace(/<\/body>/i, bridge + "</body>");
}

// ================= Editor Modal Handling =================
window.addEventListener("message", (e) => {
  const d = e.data || {};
  if (d.type === "OPEN_EDITOR") {
    currentEdit = d;
    editorModal.style.display = "flex";
    editorTextInput.style.display = d.hasText ? "block" : "none";
    editorPlaceholderInput.style.display = d.hasPlaceholder ? "block" : "none";
    editorColorInput.value = d.inline?.color || "#000000";
    editorTextInput.value = d.text || "";
    editorPlaceholderInput.value = d.placeholder || "";
    editorImageInput.style.display = d.src !== undefined ? "block" : "none";
    if (d.src !== undefined) editorImageInput.value = d.src;
  } else if (d.type === "THEME_COMMIT_DONE" && d.page && d.html) {
    // Save updated html after commit
    editedContents[d.page] = d.html;
  }
});

saveEditBtn.onclick = () => {
  if (!currentEdit) return;
  const iframe = iframeRefs[currentEdit.page];
  if (!iframe) return;
  if (editorTextInput.style.display === "block") {
    iframe.contentWindow.postMessage(
      { type: "APPLY_TEXT", id: currentEdit.id, text: editorTextInput.value },
      "*"
    );
  }
  if (editorPlaceholderInput.style.display === "block") {
    iframe.contentWindow.postMessage(
      { type: "APPLY_TEXT", id: currentEdit.id, text: editorPlaceholderInput.value },
      "*"
    );
  }
  if (editorImageInput.style.display === "block") {
    iframe.contentWindow.postMessage(
      { type: "APPLY_IMAGE", id: currentEdit.id, src: editorImageInput.value },
      "*"
    );
  }
  iframe.contentWindow.postMessage(
    {
      type: "APPLY_COLOR",
      id: currentEdit.id,
      color: editorColorInput.value,
      target: "text",
    },
    "*"
  );
  // Save back
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  editedContents[currentEdit.page] =
    "<!DOCTYPE html>" + doc.documentElement.outerHTML;
  editorModal.style.display = "none";
  currentEdit = null;
};
cancelEditBtn.onclick = () => {
  editorModal.style.display = "none";
  currentEdit = null;
};
