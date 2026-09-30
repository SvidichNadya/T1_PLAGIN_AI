(() => {
  if (window.__WORK_COPILOT_CONTENT__) return;
  window.__WORK_COPILOT_CONTENT__ = true;

  function visible(el) {
    const s = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return s.display !== "none" && s.visibility !== "hidden" && r.width > 0 && r.height > 0;
  }

  function textOf(el) {
    return (el.innerText || el.textContent || "").replace(/\\u00a0/g, " ").replace(/[ \\t]+\\n/g, "\\n").replace(/\\n{3,}/g, "\\n\\n").trim();
  }

  function extract() {
    const root = document.body;
    if (!root) return { title: document.title, url: location.href, text: "" };
    const clone = root.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,template,svg,canvas").forEach(x => x.remove());
    const candidates = Array.from(clone.querySelectorAll("main,article,[role='main'],section")).filter(visible);
    const main = candidates.sort((a,b) => textOf(b).length - textOf(a).length)[0] || clone;
    return {
      title: document.title || "Без названия",
      url: location.href,
      text: textOf(main),
      selection: String(window.getSelection ? window.getSelection() : "").trim()
    };
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === "EXTRACT_PAGE") {
      try { sendResponse({ ok: true, data: extract() }); }
      catch (e) { sendResponse({ ok: false, error: String(e) }); }
    }
    if (msg.type === "EXTRACT_SELECTION") {
      sendResponse({ ok: true, text: String(window.getSelection ? window.getSelection() : "").trim() });
    }
    if (msg.type === "CALENDAR_HEURISTIC") {
      sendResponse({ ok: true, page: extract() });
    }
  });
})();