const sessions = new Map();

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;
  if (message.type === "PING") {
    sendResponse({ ok: true, version: chrome.runtime.getManifest().version });
    return;
  }
  if (message.type === "GET_TAB") {
    chrome.tabs.query({ active: true, currentWindow: true }).then(tabs => {
      const tab = tabs && tabs[0];
      sendResponse({ ok: true, tab: tab ? { id: tab.id, url: tab.url || "", title: tab.title || "" } : null });
    });
    return true;
  }
});