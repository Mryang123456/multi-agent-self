// Content script: apply a fill plan produced by the agent.
// Exposed as window.__jobFillerApply(plan).
//
// plan: Array<{ selector, action, value }>
//   action: "text" | "select" | "check" | "radio" | "skip"
//
// The text filler uses the native value setter + synthetic input event so that
// React / Vue controlled components pick up the change.

(() => {
  function setNativeValue(el, value) {
    const proto = el.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(proto, "value") &&
      Object.getOwnPropertyDescriptor(proto, "value").set;
    if (setter) setter.call(el, value);
    else el.value = value; // fallback (non-standard)
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function findOne(selector) {
    try {
      return document.querySelector(selector);
    } catch {
      return null;
    }
  }

  function applyOne(step) {
    const el = findOne(step.selector);
    if (!el) return { ok: false, selector: step.selector, reason: "not found" };

    switch (step.action) {
      case "text":
        setNativeValue(el, step.value ?? "");
        return { ok: true, selector: step.selector };
      case "select": {
        // match by value first, then by visible text
        const match =
          Array.from(el.options || []).find((o) => o.value === step.value) ||
          Array.from(el.options || []).find(
            (o) => o.text.trim().toLowerCase() === String(step.value).trim().toLowerCase()
          );
        if (!match) return { ok: false, selector: step.selector, reason: "option not found" };
        el.value = match.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        return { ok: true, selector: step.selector };
      }
      case "check":
        el.checked = !!step.value;
        el.dispatchEvent(new Event("change", { bubbles: true }));
        el.dispatchEvent(new Event("click", { bubbles: true }));
        return { ok: true, selector: step.selector };
      case "radio": {
        // step.value is the option value to select within the group
        const group = document.querySelectorAll(`input[type="radio"][name="${CSS.escape(el.name)}"]`);
        let picked = null;
        group.forEach((r) => {
          if (r.value === step.value || r.value.toLowerCase() === String(step.value).toLowerCase()) {
            r.checked = true;
            picked = r;
            r.dispatchEvent(new Event("change", { bubbles: true }));
            r.dispatchEvent(new Event("click", { bubbles: true }));
          }
        });
        return picked
          ? { ok: true, selector: step.selector }
          : { ok: false, selector: step.selector, reason: "radio option not found" };
      }
      case "skip":
        return { ok: true, selector: step.selector, skipped: true };
      default:
        return { ok: false, selector: step.selector, reason: `unknown action ${step.action}` };
    }
  }

  window.__jobFillerApply = function apply(plan) {
    return (plan || []).map(applyOne);
  };
})();
