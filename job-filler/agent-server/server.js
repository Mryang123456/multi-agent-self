// Local agent server. Keeps the Anthropic API key off the extension/page.
// Endpoints:
//   POST /parse  { resumeText }           -> { ok, resume }            (text -> structured)
//   POST /fill   { fields, resume }       -> { ok, plan }              (fields -> fill plan)
//
// Run: node server.js
// Modes:
//   - If ANTHROPIC_API_KEY is set (or USE_LLM=1 with key), uses the real Claude model.
//   - Otherwise falls back to MOCK mode (no key, deterministic heuristics)
//     so the full extension -> server -> fill pipeline can be verified for free.

require("dotenv").config(); // loads .env if present

const http = require("http");
const { Anthropic } = require("@anthropic-ai/sdk");
const { parseResumeMock, fillPlanMock } = require("./mock");

const PORT = process.env.PORT || 8787;
const MODEL = process.env.MODEL || "claude-sonnet-4-6";
const USE_LLM = !!process.env.ANTHROPIC_API_KEY || process.env.USE_LLM === "1";
console.log(USE_LLM ? `[agent] using LLM (${MODEL})` : "[agent] MOCK mode (no API key)");

let client = null;
function getClient() {
  if (!client) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error("ANTHROPIC_API_KEY not set");
    client = new Anthropic({ apiKey: key });
  }
  return client;
}

async function ask(system, userText) {
  const msg = await getClient().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userText }],
  });
  return msg.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

// --- /parse: turn resume text into structured JSON ---
const PARSE_SYSTEM = `You parse a resume into strict JSON matching this schema:
{
  "name": string,
  "email": string,
  "phone": string,
  "location": string,
  "linkedin": string,
  "summary": string,
  "education": [{ "school": string, "degree": string, "field": string, "start": string, "end": string }],
  "experience": [{ "company": string, "title": string, "start": string, "end": string, "bullets": [string] }],
  "skills": [string],
  "projects": [{ "name": string, "description": string }]
}
Fill missing fields with "". Output ONLY the JSON object, no prose.`;

// --- /fill: map form fields to fill actions ---
const FILL_SYSTEM = `You are filling out a job application form using a candidate's resume.
You receive:
  - "fields": an array of form field descriptors, each with {selector, tag, type, name, label, kind, options?, required, value}
  - "resume": the candidate's structured resume JSON

Produce a JSON array "plan". Each entry maps a field to an action:
  { "selector": <copy from field>, "label": <field label>, "action": "text"|"select"|"check"|"radio"|"skip", "value": <string|boolean> }

Rules:
  - "text": plain text input (value = string)
  - "select": <select> dropdown — value must EXACTLY match one of the field's options.value, OR the option text
  - "radio": radio group — value = the option value to select
  - "check": single checkbox (value = true/false). For "I agree"/consent questions, default true. For EEO/are-you-authorized questions you are unsure about, "skip".
  - "skip": use for anything ambiguous, illegal-to-ask, or requiring the human's decision (salary expectations, visa sponsorship questions, "why do you want this job", custom open-ended questions). Do NOT guess.
  - Map resume data to the closest matching field label. Prefer concise values.
  - Only output the JSON array, no prose.`;

function readBody(req) {
  return new Promise((resolve, reject) => {
    let buf = "";
    req.on("data", (c) => (buf += c));
    req.on("end", () => {
      try {
        resolve(buf ? JSON.parse(buf) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

function stripJson(text) {
  // pull the first {...} or [...] block out of a possibly fenced response
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1];
  const start = text.search(/[\[{]/);
  if (start === -1) throw new Error("no JSON in model response: " + text.slice(0, 200));
  return text.slice(start).trim();
}

const server = http.createServer(async (req, res) => {
  // permissive CORS for local dev (extension SW has host_permissions anyway;
  // this also lets a browser page call the server directly for testing)
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  if (req.method === "OPTIONS") { res.writeHead(204).end(); return; }
  if (req.method !== "POST") {
    res.writeHead(405).end("method not allowed");
    return;
  }
  try {
    const body = await readBody(req);
    if (req.url === "/parse") {
      const resume = USE_LLM
        ? JSON.parse(stripJson(await ask(PARSE_SYSTEM, body.resumeText || "")))
        : parseResumeMock(body.resumeText || "");
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, resume }));
    } else if (req.url === "/fill") {
      const plan = USE_LLM
        ? JSON.parse(
            stripJson(
              await ask(
                FILL_SYSTEM,
                "FIELDS:\n" + JSON.stringify(body.fields) + "\n\nRESUME:\n" + JSON.stringify(body.resume)
              )
            )
          )
        : fillPlanMock(body.fields || [], body.resume || {});
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true, plan }));
    } else {
      res.writeHead(404).end("not found");
    }
  } catch (e) {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: false, error: String(e && e.message || e) }));
  }
});

server.listen(PORT, () => {
  console.log(`job-filler agent server on http://localhost:${PORT} (model ${MODEL})`);
});
