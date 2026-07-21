# Job Filler

Agent-driven Chrome extension that auto-fills job application forms on **any** recruitment site. Half-automatic: the agent proposes a fill plan, you review it, then it fills (never auto-submits).

## Architecture

```
Chrome Extension (MV3)
  sidepanel/   ── import resume, scan fields, review plan, apply
  content/     ── extract.js (scan DOM) + fill.js (apply, handles React)
  background   ── relays messages, proxies to local agent server (hides API key)
        │
        ▼  http://localhost:8787
Local agent server (Node)
  /parse  ── resume text  → structured JSON  (Claude)
  /fill   ── fields+resume → fill plan       (Claude)
```

## Setup

### 1. Agent server
```bash
cd agent-server
export ANTHROPIC_API_KEY=sk-ant-...        # your key
npm start                                   # http://localhost:8787
```

### 2. Load the extension
- Chrome → `chrome://extensions` → enable Developer mode → **Load unpacked** → select `extension/`
- Pin the Job Filler icon. Click it to open the side panel.

## Use
1. **简历** — paste text or load a `.txt/.md/.json` → **解析并保存**.
2. Open any job application form page → **扫描本页字段**.
3. **生成填充计划** — agent returns a per-field plan. Click any item to toggle skip.
4. **应用填充(不提交)** — fills the form. You submit manually.

## MVP scope (done)
- [x] text resume → structured resume
- [x] DOM field extraction (label/aria/placeholder/path heuristics)
- [x] agent fill plan (text/select/check/radio/skip)
- [x] controlled-component filling (React/Vue native setter + events)
- [x] review UI, manual submit

## Next
- [ ] PDF/DOCX resume parsing (pdf.js / mammoth.js in popup)
- [ ] custom dropdowns / date pickers / file upload
- [ ] multi-step forms (pagination)
- [ ] open-ended question drafting (cover-letter style)
- [ ] per-site caching of field mappings
