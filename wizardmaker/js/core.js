// ================= CORE STATE & VARIABLES =================

const zipInput = document.getElementById("zipInput");
const exportBtn = document.getElementById("exportBtn");
const tabsEl = document.getElementById("tabs");
const iframeContainer = document.getElementById("iframeContainer");

let pages = [];
let pageContents = {};
let editedContents = {};
let otherFiles = {};
let activePage = "";
let iframeRefs = {};

let modalTarget = { page: "", id: "", hasText: false, hasPlaceholder: false };
let originalSnapshot = null;

// Web Worker for heavy tasks
const zipWorker = new Worker("js/zipWorker.js");

// ================= ZIP LOADING =================

zipInput.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  zipWorker.postMessage({ type: "unpack-zip", file });
});

zipWorker.onmessage = (e) => {
  const d = e.data;
  if (d.type === "unpack-done") {
    pages = d.pages;
    pageContents = d.pageContents;
    editedContents = { ...d.pageContents };
    otherFiles = d.otherFiles;
    activePage = pages[0] || "";

    renderTabs();
    renderIframes();
  }
  if (d.type === "error") {
    console.error("Worker error:", d.message);
  }
};

// ================= TAB RENDERING =================

function renderTabs() {
  tabsEl.innerHTML = "";
  pages.forEach((p) => {
    const tab = document.createElement("div");
    tab.className = "tab" + (p === activePage ? " active" : "");
    tab.textContent = p;
    tab.onclick = () => {
      activePage = p;
      renderTabs();
      renderIframes();
    };
    tabsEl.appendChild(tab);
  });
}

// ================= IFRAME RENDERING =================

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
    window.addEventListener('message',function(ev){
      var d=ev.data||{};
      var el=document.querySelector('['+EDIT_ATTR+'="'+d.id+'"]');
      if(!el)return;
      if(d.type==='APPLY_TEXT'){
        if('placeholder' in el) el.placeholder=d.text||''; 
        else el.innerText=d.text||'';
      }
      if(d.type==='APPLY_COLOR'){
        if(d.target==='background')el.style.backgroundColor=d.color;
        else el.style.color=d.color;
      }
      if(d.type==='APPLY_IMAGE'&&el.tagName==='IMG')el.src=d.src;
      if(d.type==='RESTORE_ELEMENT'&&d.snapshot){
        if(d.snapshot.html!==undefined && !('placeholder' in el)) 
          el.innerHTML=d.snapshot.html;
        if(d.snapshot.placeholder!==undefined && 'placeholder' in el) 
          el.placeholder=d.snapshot.placeholder;
        if(d.snapshot.src!==undefined&&el.tagName==='IMG')el.src=d.snapshot.src;
        if(d.snapshot.inline){
          el.style.color=d.snapshot.inline.color||'';
          el.style.backgroundColor=d.snapshot.inline.backgroundColor||'';
        }
      }
    });
  })();<\/script>`;
  return html.replace(/<\/body>/i, bridge + "</body>");
}

function renderIframes() {
  iframeContainer.innerHTML = "";
  if (!activePage) return;
  const iframe = document.createElement("iframe");
  iframe.srcdoc = injectEditingBridge(
    editedContents[activePage] || pageContents[activePage] || "",
    activePage
  );
  iframeContainer.appendChild(iframe);
  iframeRefs[activePage] = iframe;
}

// ================= EXPORT =================

exportBtn.addEventListener("click", async () => {
  const zip = new JSZip();
  pages.forEach((filename) => {
    const html = editedContents[filename] || pageContents[filename] || "";
    zip.file(filename, html);
  });
  Object.entries(otherFiles).forEach(([filename, data]) => {
    zip.file(filename, data);
  });
  const blob = await zip.generateAsync({ type: "blob" });
  saveAs(blob, "custom-site.zip");
});

// ================= AUTO-LOAD TEMPLATE (localStorage) =================

function autoLoadTemplate() {
  const templateData = localStorage.getItem("wizardTemplate");
  if (!templateData) return;

  try {
    const binary = atob(templateData.split(",")[1]);
    const array = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      array[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([array], { type: "application/zip" });
    const file = new File([blob], "template.zip", { type: "application/zip" });

    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    zipInput.files = dataTransfer.files;

    zipInput.dispatchEvent(new Event("change", { bubbles: true }));

    localStorage.removeItem("wizardTemplate");
  } catch (err) {
    console.error("Template auto-load failed:", err);
  }
}
autoLoadTemplate();
