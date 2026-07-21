// Content script: extract form fields from the page into a serializable list.
// Exposed as window.__jobFillerExtract so background.js can invoke it via executeScript.

(() => {
  const VISUAL_TAGS = ["INPUT", "TEXTAREA", "SELECT"];

  function isVisible(el) {
    if (!el || !el.getBoundingClientRect) return false;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return false;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  }

  // Try to find a human label for a field element.
  function labelFor(el) {
    // <label for=id>
    if (el.id) {
      const lab = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (lab) return lab.innerText.trim();
    }
    // aria-label / aria-labelledby
    if (el.getAttribute("aria-label")) return el.getAttribute("aria-label").trim();
    const labelledBy = el.getAttribute("aria-labelledby");
    if (labelledBy) {
      const ref = document.getElementById(labelledBy);
      if (ref) return ref.innerText.trim();
    }
    // wrapped by a <label>
    const wrapping = el.closest("label");
    if (wrapping) return wrapping.innerText.trim();
    // placeholder
    if (el.placeholder) return el.placeholder.trim();
    // nearest preceding text node (rough heuristic)
    let prev = el.previousElementSibling;
    let hops = 0;
    while (prev && hops < 3) {
      const t = prev.innerText && prev.innerText.trim();
      if (t) return t.slice(0, 80);
      prev = prev.previousElementSibling;
      hops++;
    }
    return "";
  }

  // A selector stable enough to re-find the element after extraction.
  function selectorFor(el) {
    if (el.id) return `#${CSS.escape(el.id)}`;
    const name = el.getAttribute("name");
    if (name) {
      const path = buildPath(el);
      return path; // path includes name attr
    }
    return buildPath(el);
  }

  function buildPath(el) {
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      let part = cur.tagName.toLowerCase();
      if (cur.id) {
        parts.unshift(`#${CSS.escape(cur.id)}`);
        break;
      }
      const name = cur.getAttribute("name");
      if (name) part += `[name="${name}"]`;
      // nth-of-type among same-tag siblings
      const sibs = Array.from(cur.parentNode ? cur.parentNode.children : []).filter(
        (s) => s.tagName === cur.tagName
      );
      if (sibs.length > 1) {
        part += `:nth-of-type(${sibs.indexOf(cur) + 1})`;
      }
      parts.unshift(part);
      cur = cur.parentNode;
    }
    return parts.join(" > ");
  }

  function optionsOf(sel) {
    return Array.from(sel.options || []).map((o) => ({
      value: o.value,
      text: o.text.trim(),
    }));
  }

  function fieldFromEl(el) {
    const base = {
      selector: selectorFor(el),
      tag: el.tagName,
      type: el.type || "",
      name: el.getAttribute("name") || "",
      label: labelFor(el),
      required: el.required || el.getAttribute("aria-required") === "true",
      value: el.value || "",
    };
    if (el.tagName === "SELECT") {
      base.options = optionsOf(el);
      base.kind = "select";
    } else if (el.tagName === "INPUT" && (el.type === "radio" || el.type === "checkbox")) {
      base.kind = el.type;
      base.groupName = el.name;
      base.checked = el.checked;
    } else {
      base.kind = "text";
    }
    return base;
  }

  function extract() {
    const els = Array.from(document.querySelectorAll(VISUAL_TAGS.join(","))).filter(isVisible);
    // For radio/checkbox, dedupe by name+value keeps individual options; group by name for the LLM.
    return els.map(fieldFromEl).filter((f) => f.tag === "SELECT" || f.type !== "hidden");
  }

  window.__jobFillerExtract = extract;
})();
