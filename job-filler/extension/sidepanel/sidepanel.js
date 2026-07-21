// Side panel UI logic. Talks to background.js; never calls the agent server directly.

const $ = (id) => document.getElementById(id);
let resumeText = ""; // raw resume text kept in panel memory
let parsedResume = null; // structured resume (from agent /parse)
let currentFields = []; // last extracted fields for the active tab
let currentPlan = []; // last plan from agent

const status = (s) => ($("status").textContent = s);
const err = (e) => ($("err").textContent = e || "");

function send(type, payload = {}) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ type, ...payload }, (res) => {
      if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
      if (!res) return reject(new Error("no response"));
      if (!res.ok) return reject(new Error(res.error || "unknown error"));
      resolve(res);
    });
  });
}

// --- 1. Resume ---
async function loadResumeFile(file) {
  resumeText = await file.text();
  $("resume-text").value = resumeText.slice(0, 4000);
  status("resume loaded (raw)");
}

$("parse-resume").addEventListener("click", async () => {
  const text = $("resume-text").value || resumeText;
  if (!text.trim()) return err("简历文本为空");
  err("");
  status("parsing resume...");
  try {
    const res = await send("AGENT_PARSE_RESUME", { resumeText: text });
    parsedResume = res.resume;
    await chrome.storage.local.set({ resume: parsedResume, resumeText: text });
    $("resume-preview").textContent = JSON.stringify(parsedResume, null, 2).slice(0, 800);
    status("resume parsed & saved");
  } catch (e) {
    err(e.message);
    status("parse failed");
  }
});

// --- 2. Extract fields ---
$("extract-btn").addEventListener("click", async () => {
  err("");
  status("extracting fields...");
  try {
    const res = await send("EXTRACT_FIELDS");
    currentFields = res.fields || [];
    $("field-count").textContent = `找到 ${currentFields.length} 个字段`;
    status(`extracted ${currentFields.length} fields`);
  } catch (e) {
    err(e.message);
    status("extract failed");
  }
});

// --- 3. Plan ---
$("plan-btn").addEventListener("click", async () => {
  if (!currentFields.length) return err("先扫描字段");
  if (!parsedResume) {
    const stored = await chrome.storage.local.get("resume");
    parsedResume = stored.resume;
  }
  if (!parsedResume) return err("先导入并解析简历");
  err("");
  status("asking agent for plan...");
  try {
    const res = await send("AGENT_FILL_PLAN", { fields: currentFields, resume: parsedResume });
    currentPlan = res.plan || [];
    renderPlan(currentPlan);
    $("apply-btn").disabled = currentPlan.length === 0;
    status(`plan ready: ${currentPlan.length} steps`);
  } catch (e) {
    err(e.message);
    status("plan failed");
  }
});

function renderPlan(plan) {
  $("plan-list").innerHTML = "";
  for (const step of plan) {
    const div = document.createElement("div");
    div.className = "plan-item" + (step.action === "skip" ? " skipped" : "");
    const valPreview = typeof step.value === "string" ? step.value.slice(0, 60) : JSON.stringify(step.value);
    div.innerHTML = `<span class="action">[${step.action}]</span> <span class="label">${escapeHtml(step.label || step.selector)}</span> → ${escapeHtml(valPreview)}`;
    div.title = step.selector;
    div.addEventListener("click", () => {
      // toggle skip on click — quick review affordance
      step.action = step.action === "skip" ? (step._prevAction || "text") : (step._prevAction = step.action, "skip");
      renderPlan(plan);
    });
    $("plan-list").appendChild(div);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

// --- Apply ---
$("apply-btn").addEventListener("click", async () => {
  err("");
  status("applying...");
  try {
    const res = await send("APPLY_PLAN", { plan: currentPlan });
    const failed = (res.result || []).filter((r) => !r.ok);
    status(`applied: ${res.result.length - failed.length} ok, ${failed.length} failed`);
    if (failed.length) err("失败项:\n" + JSON.stringify(failed, null, 2));
  } catch (e) {
    err(e.message);
    status("apply failed");
  }
});

// wire file input
$("resume-file").addEventListener("change", (e) => {
  const f = e.target.files[0];
  if (f) loadResumeFile(f);
});

// restore resume from storage on open
chrome.storage.local.get(["resume", "resumeText"], (d) => {
  if (d.resume) {
    parsedResume = d.resume;
    $("resume-preview").textContent = JSON.stringify(parsedResume, null, 2).slice(0, 800);
  }
  if (d.resumeText) {
    resumeText = d.resumeText;
    $("resume-text").value = resumeText.slice(0, 4000);
  }
});
