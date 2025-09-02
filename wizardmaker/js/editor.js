// ================= MODAL ELEMENTS =================
const modalBackdrop = document.getElementById("modalBackdrop");
const modalText = document.getElementById("modalText");
const modalColor = document.getElementById("modalColor");
const colorTargetSel = document.getElementById("colorTarget");
const imageUrl = document.getElementById("imageUrl");
const imageFile = document.getElementById("imageFile");
const cancelBtn = document.getElementById("cancelBtn");
const saveBtn = document.getElementById("saveBtn");

// ================= OPEN EDITOR (Message Listener) =================
window.addEventListener("message", (event) => {
  const d = event.data || {};
  if (d.type === "OPEN_EDITOR") {
    modalTarget = {
      page: d.page,
      id: d.id,
      hasText: !!d.hasText,
      hasPlaceholder: !!d.hasPlaceholder,
    };
    modalText.value = d.hasPlaceholder ? d.placeholder || "" : (d.text || "");
    modalColor.value = "#000000";
    originalSnapshot = d;
    modalBackdrop.style.display = "flex";
    document.getElementById("textSection").style.display =
      d.hasText || d.hasPlaceholder ? "block" : "none";
  }
});

// ================= INPUT HANDLERS =================

// Text input → update iframe element
modalText.addEventListener("input", () => {
  const { page, id } = modalTarget;
  iframeRefs[page].contentWindow.postMessage(
    { type: "APPLY_TEXT", id, text: modalText.value },
    "*"
  );
});

// Color input → update iframe element
modalColor.addEventListener("input", () => {
  const { page, id, hasText } = modalTarget;
  const target =
    colorTargetSel.value === "auto"
      ? hasText
        ? "color"
        : "background"
      : colorTargetSel.value;
  iframeRefs[page].contentWindow.postMessage(
    { type: "APPLY_COLOR", id, color: modalColor.value, target },
    "*"
  );
});

// Image URL input → update iframe element
imageUrl.addEventListener("input", () => {
  const { page, id } = modalTarget;
  iframeRefs[page].contentWindow.postMessage(
    { type: "APPLY_IMAGE", id, src: imageUrl.value },
    "*"
  );
});

// Image File input → update iframe element
imageFile.addEventListener("change", (e) => {
  const file = e.target.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const { page, id } = modalTarget;
    iframeRefs[page].contentWindow.postMessage(
      { type: "APPLY_IMAGE", id, src: reader.result },
      "*"
    );
  };
  reader.readAsDataURL(file);
});

// ================= SAVE & CANCEL =================

// Save → serialize page and close modal
saveBtn.onclick = () => {
  const { page } = modalTarget;
  const iframe = iframeRefs[page];
  if (iframe.contentDocument) {
    const html =
      "<!DOCTYPE html>" + iframe.contentDocument.documentElement.outerHTML;
    editedContents[page] = html;
  }
  modalBackdrop.style.display = "none";
};

// Cancel → restore original snapshot and close modal
cancelBtn.onclick = () => {
  const { page, id } = modalTarget;
  const iframe = iframeRefs[page];
  if (iframe?.contentWindow && originalSnapshot) {
    iframe.contentWindow.postMessage(
      { type: "RESTORE_ELEMENT", id, snapshot: originalSnapshot },
      "*"
    );
  }
  modalBackdrop.style.display = "none";
};
