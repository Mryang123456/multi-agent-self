# Job Filler — Architecture Reference

Companion to SKILL.md. Read this before non-trivial changes.

## Goal
Agent-driven Chrome extension that auto-fills job application forms on **any** recruitment site. Half-automatic: agent proposes a fill plan, user reviews, extension fills, **human submits**.

## Data flow

```
┌─────────────────────────────────────────────────────┐
│  Chrome Extension (MV3)                             │
│  sidepanel/  ── import resume, scan, review, apply  │
│  content/    ── extract.js (scan DOM)               │
│               ── fill.js (apply, controlled-comp)   │
│  background  ── relays msgs, proxies to local srv   │
│        │  (hides API key — page never sees it)      │
│        ▼  http://localhost:8787                      │
│  Local agent server (Node, http)                    │
│    /parse ── resume text  → structured JSON         │
│    /fill  ── fields+resume → fill plan              │
│    mock.js ── key-free heuristics (default)         │
│    server.js inline prompts ── real LLM (with key)  │
└─────────────────────────────────────────────────────┘
```

## File map

| Path | Role |
|------|------|
| `extension/manifest.json` | MV3: permissions storage/sidePanel/activeTab/scripting; host `<all_urls>`+`localhost`; content scripts extract+fill |
| `extension/background.js` | service worker: open side panel on action click; relay `AGENT_PARSE_RESUME`/`AGENT_FILL_PLAN`/`EXTRACT_FIELDS`/`APPLY_PLAN`; proxy fetch to agent server |
| `extension/content/extract.js` | `window.__jobFillerExtract()`: scan INPUT/TEXTAREA/SELECT, label via `<label for>`/aria/wrapping-label/placeholder/preceding-text, build stable selector (id→name→path), classify kind text/select/radio/checkbox |
| `extension/content/fill.js` | `window.__jobFillerApply(plan)`: actions text/select/check/radio/skip; native value-setter + synthetic input/change events for React/Vue |
| `extension/sidepanel/` | UI: import/paste resume → parse; scan fields; generate plan; review (click item to toggle skip); apply. Stores resume in chrome.storage |
| `agent-server/server.js` | http server; `/parse`,`/fill`; mock when no key, LLM (dotenv) when `ANTHROPIC_API_KEY` set; permissive CORS for local dev |
| `agent-server/mock.js` | `parseResumeMock` (email/phone/name/skills regex) + `fillPlanMock` (label keyword → value heuristics; agree→check; ambiguous→skip) |
| `test-form.html` | local test form: text/select/checkbox/radio/textarea fields |

## Key design decisions

- **API key isolation**: key lives only in the local Node server; the extension and page never see it. background.js proxies all LLM calls.
- **Mock-first**: no key required to develop/test. Mock heuristics (`mock.js`) parallel the LLM prompts (`PARSE_SYSTEM`/`FILL_SYSTEM` in server.js) — keep schemas in sync.
- **Controlled components**: `fill.js` uses `Object.getOwnPropertyDescriptor(proto,'value').set` + dispatching `input`/`change` so React/Vue state updates. Naive `.value=` assignment fails silently on these.
- **Selector stability**: `extract.js` builds selectors that re-find elements after extraction (id → name attr → nth-of-type path). Fill re-queries by these selectors.
- **Safety boundary**: never auto-submit; agent skips ambiguous/open-ended/legally-sensitive questions. Preserved across heuristics changes.

## Test harness (the source of truth)
- agent server: `http://localhost:8787`
- static server (test form + content scripts): `http://localhost:8099`
- Playwright MCP drives: load test form → `fetch` extract.js+fill.js → `eval` → `__jobFillerExtract()` → POST `/parse` → POST `/fill` → `__jobFillerApply(plan)` → read back form values.
- A change to extraction/filling/server is not done until this pipeline passes against `test-form.html`.

## Known gaps (Next)
- PDF/DOCX resume parsing (pdf.js / mammoth.js)
- custom dropdowns / date pickers / file upload (need new fill actions)
- multi-step forms / pagination (extraction per step, state across navigations)
- open-ended question drafting (cover-letter style)
- per-site field-mapping cache
