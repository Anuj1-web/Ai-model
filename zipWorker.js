// zipWorker.js
importScripts("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js");

self.onmessage = async (e) => {
  const { type, file, pages, pageContents } = e.data;

  if (type === "unpack-zip") {
    try {
      const zip = await JSZip.loadAsync(file);
      const newPages = [];
      const newContents = {};
      const other = {};

      await Promise.all(
        Object.keys(zip.files).map(async (filename) => {
          const entry = zip.files[filename];
          if (entry.dir) return;
          if (filename.toLowerCase().endsWith(".html")) {
            const data = await entry.async("string");
            newPages.push(filename);
            newContents[filename] = data;
          } else {
            const data = await entry.async("uint8array");
            other[filename] = data;
          }
        })
      );

      newPages.sort((a, b) => {
        const ai = /(^|\/)index\.html$/i.test(a);
        const bi = /(^|\/)index\.html$/i.test(b);
        if (ai && !bi) return -1;
        if (!ai && bi) return 1;
        return a.localeCompare(b);
      });

      self.postMessage({
        type: "unpack-done",
        pages: newPages,
        pageContents: newContents,
        otherFiles: other,
      });
    } catch (err) {
      self.postMessage({ type: "error", message: err.message });
    }
  }

  if (type === "serialize-page") {
    try {
      const html = "<!DOCTYPE html>" + pageContents;
      self.postMessage({ type: "serialize-done", page: pages, html });
    } catch (err) {
      self.postMessage({ type: "error", message: err.message });
    }
  }
};
