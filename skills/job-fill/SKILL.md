---
name: job-fill
description: Develop and maintain the Job Filler project — an agent-driven Chrome extension + local Node server that auto-fills job application forms on any recruitment site (review-before-submit). Use when the user wants to work on Job Filler: scaffolding/adding features, fixing the extension (manifest/content/background/sidepanel), the agent server (/parse /fill endpoints, mock vs LLM mode), the resume-parsing or DOM-extraction/filling logic, adding site adapters, or running the end-to-end test harness. Also use when the user mentions "job filler", "job-fill", auto-filling job applications, or the recruitment-form-filling extension.
---

# job-fill

Develop and maintain the **Job Filler** project: a Chrome extension (Manifest V3) + local Node agent server that auto-fills job application forms on any recruitment site. Half-automatic — it fills, the human reviews, then submits manually. The LLM can be swapped for a key-free mock so the pipeline verifies for free.

## Where the project lives
Default: `~/job-filler/`. If the user points elsewhere, use that. Read `reference.md` for the full architecture, file map, and design rationale before making non-trivial changes — it has the details so this file stays lean.

## When to use
- User wants to add/fix features in the extension or agent server.
- User mentions resume parsing, DOM field extraction, controlled-component filling, or site adapters.
- User wants to switch between mock mode and real LLM.
- User wants to run the end-to-end test (extract → /parse → /fill → apply) against the test form.
- User asks "how does job-filler work" or wants to extend it.

## When NOT to use
- User wants to actually fill a live form right now from this session (no browser context) → suggest they use the loaded extension in their Chrome, or set up Playwright separately. This skill is for *developing* the tool, not driving it live.
- A general Chrome-extension or Node question unrelated to this project → answer directly.

## Steps

1. **Locate and orient.** Confirm the project dir (default `~/job-filler`). If you haven't this session, `Read reference.md` here for the architecture + file map. Skim the relevant file before editing.

2. **The three layers — know which one you're touching:**
   - **Extension** (`extension/`): `manifest.json`, `background.js` (message relay + proxy to server), `content/extract.js` (scan DOM fields), `content/fill.js` (apply plan, handles React controlled components), `sidepanel/` (review UI). Runs in Chrome.
   - **Agent server** (`agent-server/server.js`): HTTP `/parse` (resume→JSON) and `/fill` (fields+resume→plan). Mock mode by default (no key); real LLM when `ANTHROPIC_API_KEY` is set. Heuristics live in `agent-server/mock.js`. Prompts for the LLM live inline in `server.js` (`PARSE_SYSTEM`, `FILL_SYSTEM`).
   - **Test harness**: `test-form.html` served on `:8099`, agent server on `:8787`. The Playwright MCP drives the browser to run extract→parse→fill→apply in-page.

3. **Common tasks:**
   - **Add a site adapter / better extraction**: edit `content/extract.js` (label heuristics, selector building). Real sites have custom dropdowns, iframes, shadow DOM — extend here.
   - **Fix filling for a widget type** (custom dropdown, date picker, file upload, rich text): add an `action` case in `content/fill.js` and a corresponding rule in `mock.js` + the `FILL_SYSTEM` prompt.
   - **Improve resume parsing**: edit `PARSE_SYSTEM` (LLM) and `parseResumeMock` (mock) — keep their output schemas in sync.
   - **Switch mock ↔ LLM**: `mock` runs when no `ANTHROPIC_API_KEY`. Set the key in `agent-server/.env` (dotenv) and restart → LLM mode. The `.env` is gitignored; never commit keys.
   - **Multi-step forms / pagination**: this is a known gap — extraction must run per step and state must persist across navigations. Plan before coding.

4. **Test end-to-end before claiming done.** This is mandatory for any change to extraction/filling/server:
   - Agent server up? `curl -s -X POST http://localhost:8787/parse -H 'Content-Type: application/json' -d '{"resumeText":"x"}'` → expect `{"ok":true,...}`.
   - Static server up? `curl -s -o /dev/null -w "%{http_code}" http://localhost:8099/test-form.html` → 200.
   - If down, restart: `agent-server` → `cd ~/job-filler/agent-server && node server.js` (background); static → `cd ~/job-filler && python3 -m http.server 8099` (background).
   - Drive the full pipeline with the Playwright MCP: load `http://localhost:8099/test-form.html`, inject `extension/content/extract.js` + `fill.js` via `fetch(base+file).then(r=>r.text())` then `eval`, run `__jobFillerExtract()` → POST `/parse` → POST `/fill` → `__jobFillerApply(plan)` → read back form values. Assert the expected fields filled correctly.
   - Report pass/fail with the actual read-back values, not "should work".

5. **Keep the safety boundary.** Filling is half-automatic: the extension *never* auto-submits, and the agent `skip`s ambiguous/open-ended questions (salary, visa, "why this job"). Don't add auto-submit. When improving heuristics, preserve skip-on-uncertainty.

6. **Update docs.** After structural changes, update `reference.md` (architecture) and the project `README.md` (setup/Next list).

## Notes
- Mock mode is the default and the test harness uses it — never break mock parity with the LLM schema, or testing silently diverges from production.
- `content/fill.js` uses the native value-setter + synthetic `input`/`change` events so React/Vue controlled components react. Don't replace with naive `el.value = x`.
- CORS is permissive on the agent server (`*`) for local dev only — it's localhost-bound; don't ship it exposed.
- The extension's `host_permissions` includes `<all_urls>` and `http://localhost/*` so it can read any form page and call the local server.
