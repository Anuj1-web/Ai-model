// ================= LIBRARY SIDEBAR =================

// Fetch library data from localStorage
function getLibraryData() {
  try {
    return JSON.parse(localStorage.getItem("sitegenLibrary") || "[]");
  } catch {
    return [];
  }
}

// Filter out templates (templates are handled on homepage)
let allAssets = getLibraryData().filter((item) => item.type !== "template");

// Elements
const libraryContainer = document.getElementById("libraryContainer");
const previewModal = document.getElementById("libraryPreviewModal");
const previewContent = document.getElementById("libraryPreviewContent");
const insertBtn = document.getElementById("insertLibraryPreview");
const cancelBtnLib = document.getElementById("cancelLibraryPreview");

let currentPreviewItem = null;

// Render Sidebar Assets
function renderLibraryAssets(filter = "") {
  libraryContainer.innerHTML = "";

  const categories = {};
  allAssets.forEach((item) => {
    const cat = item.type; // page, section, block, element, etc.
    const sub = item.subcategory || "General";
    if (!categories[cat]) categories[cat] = {};
    if (!categories[cat][sub]) categories[cat][sub] = [];
    categories[cat][sub].push(item);
  });

  Object.keys(categories).forEach((cat) => {
    const catDiv = document.createElement("div");
    catDiv.className = "library-category";
    catDiv.textContent = cat.charAt(0).toUpperCase() + cat.slice(1);
    libraryContainer.appendChild(catDiv);

    Object.keys(categories[cat]).forEach((sub) => {
      const subDiv = document.createElement("div");
      subDiv.className = "library-subcategory";
      subDiv.textContent = sub.charAt(0).toUpperCase() + sub.slice(1);
      libraryContainer.appendChild(subDiv);

      categories[cat][sub].forEach((item) => {
        if (filter && !item.name.toLowerCase().includes(filter.toLowerCase()))
          return;

        const div = document.createElement("div");
        div.className = "library-item";

        const thumb = document.createElement("div");
        thumb.className = "library-thumb";
        if (item.thumbnail) {
          const img = document.createElement("img");
          img.src = item.thumbnail;
          thumb.appendChild(img);
        } else {
          const preview = document.createElement("div");
          preview.innerHTML = item.content || "";
          preview.style.transform = "scale(0.4)";
          preview.style.transformOrigin = "top left";
          preview.style.height = "80px";
          preview.style.overflow = "hidden";
          thumb.appendChild(preview);
        }

        const title = document.createElement("div");
        title.className = "library-title";
        title.innerText = item.name.replace(/[_-]/g, " ");

        div.appendChild(thumb);
        div.appendChild(title);

        // Open preview modal on click
        div.addEventListener("click", () => {
          currentPreviewItem = item;
          previewContent.innerHTML = item.content || "<p>No content available</p>";
          previewModal.style.display = "flex";
        });

        libraryContainer.appendChild(div);
      });
    });
  });
}

// Search field
document.getElementById("librarySearch").addEventListener("input", (e) => {
  renderLibraryAssets(e.target.value);
});

// Open/close sidebar
document.getElementById("openLibraryBtn").onclick = () => {
  document.getElementById("librarySidebar").style.display = "flex";
};
document.getElementById("closeLibraryBtn").onclick = () => {
  document.getElementById("librarySidebar").style.display = "none";
};

// Preview modal buttons
cancelBtnLib.onclick = () => {
  previewModal.style.display = "none";
  currentPreviewItem = null;
};
insertBtn.onclick = () => {
  if (!currentPreviewItem) return;

  if (currentPreviewItem.type === "page") {
    // Add full page
    const filename =
      currentPreviewItem.name.toLowerCase().replace(/\s+/g, "_") + ".html";
    pages.push(filename);
    pageContents[filename] = currentPreviewItem.content;
    editedContents[filename] = currentPreviewItem.content;
    activePage = filename;
    renderTabs();
    renderIframes();
  } else {
    // Insert into active page
    const iframe = iframeRefs[activePage];
    if (iframe) {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      let insertTarget =
        doc.activeElement && doc.body.contains(doc.activeElement)
          ? doc.activeElement
          : doc.body;
      const temp = document.createElement("div");
      temp.innerHTML = currentPreviewItem.content;
      insertTarget.appendChild(temp.firstChild);
      editedContents[activePage] =
        "<!DOCTYPE html>" + doc.documentElement.outerHTML;
    }
  }

  previewModal.style.display = "none";
  currentPreviewItem = null;
};

// Add blank page (fallback)
document.getElementById("addPageBtnSidebar").onclick = () => {
  const name = prompt("Enter new page name:");
  if (!name) return;
  const filename = name.replace(/\s+/g, "_").toLowerCase() + ".html";
  const html = `<!DOCTYPE html><html><head><title>${name}</title></head><body><h1>${name}</h1></body></html>`;
  pages.push(filename);
  pageContents[filename] = html;
  editedContents[filename] = html;
  activePage = filename;
  renderTabs();
  renderIframes();
};

// Initial render
renderLibraryAssets();
