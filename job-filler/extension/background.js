// Background service worker.
// Responsibilities:
//  - open the side panel when the toolbar icon is clicked
//  - relay messages between the side panel UI and the active tab's content script
//  - proxy requests to the local agent server (keeps the API key off the page)

const AGENT_SERVER = "http://localhost:8787";

// Clicking the toolbar icon opens the side panel in the active window.
chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId }).catch(console.error);
});

// Allow the side panel to stay open across this window's tabs.
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg?.type === "AGENT_PARSE_RESUME") {
    callAgent("/parse", { resumeText: msg.resumeText })
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true; // async
  }

  if (msg?.type === "AGENT_FILL_PLAN") {
    callAgent("/fill", { fields: msg.fields, resume: msg.resume })
      .then(sendResponse)
      .catch((e) => sendResponse({ ok: false, error: String(e) }));
    return true;
  }

  if (msg?.type === "EXTRACT_FIELDS") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) return sendResponse({ ok: false, error: "no active tab" });
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          func: () => window.__jobFillerExtract && window.__jobFillerExtract(),
        });
        sendResponse({ ok: true, fields: result });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    });
    return true;
  }

  if (msg?.type === "APPLY_PLAN") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabId = tabs[0]?.id;
      if (!tabId) return sendResponse({ ok: false, error: "no active tab" });
      try {
        const [{ result }] = await chrome.scripting.executeScript({
          target: { tabId },
          args: [msg.plan],
          func: (plan) => window.__jobFillerApply && window.__jobFillerApply(plan),
        });
        sendResponse({ ok: true, result });
      } catch (e) {
        sendResponse({ ok: false, error: String(e) });
      }
    });
    return true;
  }
});

async function callAgent(path, body) {
  const res = await fetch(AGENT_SERVER + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`agent ${path} ${res.status}: ${await res.text()}`);
  return await res.json();
}
