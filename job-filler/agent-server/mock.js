// Mock "agent": deterministic, key-free stand-in for the LLM so the whole
// pipeline (extension -> server -> fill) can be verified end-to-end without
// an Anthropic API key. Swap back to the real model by setting USE_LLM=1
// (see server.js).

// Very small text-based resume parser: scan for email / phone / a name guess.
function parseResumeMock(text) {
  const email = (text.match(/[\w.+-]+@[\w-]+\.[\w.-]+/) || [""])[0];
  const phone = (text.match(/(\+?\d[\d\s\-()]{7,}\d)/) || [""])[0].trim();
  const firstLine = text.split("\n").map((l) => l.trim()).find(Boolean) || "";
  const name = firstLine.replace(/[|·•\-].*$/, "").trim().slice(0, 60) || "Candidate";
  const skills = (text.match(/(skills|技能)[:：\s]*([^\n]+)/i) || [])[2] || "";
  return {
    name,
    email,
    phone,
    location: "",
    linkedin: "",
    summary: "",
    education: [],
    experience: [],
    skills: skills.split(/[,，、\s]+/).filter(Boolean),
    projects: [],
  };
}

// Build a fill plan from fields + parsed resume using simple keyword heuristics.
function fillPlanMock(fields, resume) {
  const r = resume || {};
  const pick = (label, ...keywords) =>
    keywords.some((k) => label.toLowerCase().includes(k));

  return fields.map((f) => {
    const label = (f.label || "").toLowerCase();
    const step = { selector: f.selector, label: f.label || f.selector, action: "text", value: "" };

    if (f.kind === "select") {
      // choose first non-empty option if any
      const opt = (f.options || []).find((o) => o.value && o.value !== "");
      step.action = "select";
      step.value = opt ? opt.value : "";
      return step;
    }
    if (f.kind === "radio") {
      step.action = "radio";
      step.value = f.value || "";
      return step;
    }
    if (f.kind === "checkbox") {
      step.action = "check";
      step.value = false;
      // agree/consent checkboxes -> true
      if (/agree|consent|确认|同意/.test(label)) step.value = true;
      return step;
    }

    // text-like: guess by label
    if (pick(label, "first name", "名")) step.value = (r.name || "").split(/\s+/)[0] || "";
    else if (pick(label, "last name", "姓")) step.value = (r.name || "").split(/\s+/).slice(-1)[0] || "";
    else if (pick(label, "full name", "name", "姓名", "名字")) step.value = r.name || "";
    else if (pick(label, "email", "邮箱", "邮件")) step.value = r.email || "";
    else if (pick(label, "phone", "mobile", "电话", "手机")) step.value = r.phone || "";
    else if (pick(label, "linkedin")) step.value = r.linkedin || "";
    else if (pick(label, "location", "address", "城市", "地址")) step.value = r.location || "";
    else if (pick(label, "skill", "技能")) step.value = (r.skills || []).join(", ");
    else {
      step.action = "skip"; // mock can't guess -> leave to human
    }
    return step;
  });
}

module.exports = { parseResumeMock, fillPlanMock };
