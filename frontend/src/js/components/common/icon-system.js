// Converts legacy presentation glyphs in the UI to consistent inline SVG icons.
// User content and the Studyroom brand mark are intentionally left untouched.
(() => {
  const icons = {
    0x2726: ["brand-mark", '<path d="M12 2V22M2 12H22M4.93 4.93L19.07 19.07M19.07 4.93L4.93 19.07"/>'],
    0x2727: ["brand-mark", '<path d="M12 2V22M2 12H22M4.93 4.93L19.07 19.07M19.07 4.93L4.93 19.07"/>'],
    0x2733: ["brand-mark", '<path d="M12 2V22M2 12H22M4.93 4.93L19.07 19.07M19.07 4.93L4.93 19.07"/>'],
    0x270E: ["pencil", '<path d="m15 5 4 4M4 20l4-.8L19 8a2.8 2.8 0 0 0-4-4L4 15l-0 5Z"/>'],
    0x27C9: ["copy", '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>'],
    0x23F1: ["timer", '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 1.5M9 2h6M12 5V3"/>'],
    0x25CC: ["circle-gauge", '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
    0x2637: ["list", '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>'],
    0x2197: ["arrow-up-right", '<path d="M7 17 17 7M8 7h9v9"/>'],
    0x21BB: ["rotate-cw", '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9A7 7 0 0 1 18 6l2 2M4 16l2 2a7 7 0 0 0 12.5-3"/>'],
    0x25A6: ["layout-grid", '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/>'],
    0x25A4: ["rows-3", '<path d="M4 5h16M4 12h16M4 19h16"/>'],
    0x25A5: ["chart", '<path d="M4 19V5M4 19h17M8 16v-5m4 5V7m4 9v-8m4 8v-4"/>'],
    0x25B1: ["cards", '<rect x="4" y="4" width="14" height="16" rx="2"/><path d="M8 2h10a2 2 0 0 1 2 2v12"/>'],
    0x25F7: ["clock", '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'],
    0x2659: ["user", '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-3.6 3.1-5.5 7-5.5s6.5 1.9 7 5.5"/>'],
    0x2699: ["settings", '<circle cx="12" cy="12" r="3"/><path d="m19.4 15 .1.1 1.2 2.1-2 2-2.2-1.2-.2.1a8 8 0 0 1-2 .8l-.7 2.3h-2.8l-.7-2.3a8 8 0 0 1-2-.8l-.2-.1L6 19.2l-2-2 1.2-2.1.1-.1a8 8 0 0 1-.8-2L2.2 12v-2.8l2.3-.7a8 8 0 0 1 .8-2l-.1-.2L4 4.2l2-2 2.1 1.2.1.1a8 8 0 0 1 2-.8l.7-2.3h2.8l.7 2.3a8 8 0 0 1 2 .8l.2-.1L18.7 2l2 2-1.2 2.1-.1.1a8 8 0 0 1 .8 2l2.3.7v2.8l-2.3.7a8 8 0 0 1-.8 2Z"/>'],
    0x2600: ["sun", '<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'],
    0x263E: ["moon", '<path d="M20.9 13A9 9 0 0 1 11 3.1 9 9 0 1 0 20.9 13Z"/>'],
    0x25C8: ["diamond", '<path d="m12 3 9 9-9 9-9-9 9-9Z"/><path d="m8 12 2.5 2.5 5.5-5.5"/>'],
    0x2301: ["activity", '<path d="M3 12h4l3-8 4 16 3-8h4"/>'],
    0x25C9: ["circle-dot", '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/>'],
    0x2304: ["chevron-down", '<path d="m6 9 6 6 6-6"/>'],
    0xFF0B: ["plus", '<path d="M12 5v14M5 12h14"/>'],
    0x2713: ["check", '<path d="m5 12 4 4L19 6"/>'],
    0x2714: ["check", '<path d="m5 12 4 4L19 6"/>'],
    0x2691: ["flag", '<path d="M5 21V5m0 0c5-4 9 4 14 0v11c-5 4-9-4-14 0"/>'],
    0x280B: ["grip", '<circle cx="8" cy="6" r="1"/><circle cx="16" cy="6" r="1"/><circle cx="8" cy="12" r="1"/><circle cx="16" cy="12" r="1"/><circle cx="8" cy="18" r="1"/><circle cx="16" cy="18" r="1"/>'],
    0x2605: ["brand-mark", '<path d="M12 2V22M2 12H22M4.93 4.93L19.07 19.07M19.07 4.93L4.93 19.07"/>'],
    0x2606: ["brand-mark", '<path d="M12 2V22M2 12H22M4.93 4.93L19.07 19.07M19.07 4.93L4.93 19.07"/>'],
    0x00D7: ["x", '<path d="m18 6-12 12M6 6l12 12"/>'],
    0x2190: ["arrow-left", '<path d="m12 19-7-7 7-7M5 12h14"/>'],
    0x2192: ["arrow-right", '<path d="M5 12h14m-7-7 7 7-7 7"/>'],
    0x2191: ["arrow-up", '<path d="M12 19V5m-7 7 7-7 7 7"/>'],
    0x2193: ["arrow-down", '<path d="M12 5v14m7-7-7 7-7-7"/>'],
    0x2194: ["arrow-left-right", '<path d="M8 3 4 7l4 4M4 7h16m-4 14 4-4-4-4m4 4H4"/>'],
  };
  const omitted = new Set(["SCRIPT", "STYLE", "TEXTAREA", "INPUT", "OPTION"]);
  const protectedContent = ".brand-mark, .brand-icon, .question-text, .exam-question, .answer-option, .flashcard, [data-user-content]";

  function iconFor(codePoint, label, className) {
    const [name, paths] = icons[codePoint];
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", `studyroom-icon icon-${name}${className ? ` ${className}` : ""}`);
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("fill", "none");
    svg.setAttribute("stroke", "currentColor");
    svg.setAttribute("stroke-width", "1.8");
    svg.setAttribute("stroke-linecap", "round");
    svg.setAttribute("stroke-linejoin", "round");
    if (label) svg.setAttribute("aria-label", label);
    else svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
    svg.innerHTML = paths;
    return svg;
  }

  function convertTextNode(node) {
    const parent = node.parentElement;
    if (!parent || omitted.has(parent.tagName) || parent.closest(protectedContent)) return;
    const value = node.nodeValue;
    if (![...value].some((char) => icons[char.codePointAt(0)])) return;
    const fragment = document.createDocumentFragment();
    let text = "";
    for (const char of value) {
      const def = icons[char.codePointAt(0)];
      if (!def) { text += char; continue; }
      if (text) { fragment.append(document.createTextNode(text)); text = ""; }
      fragment.append(iconFor(char.codePointAt(0), "", ""));
    }
    if (text) fragment.append(document.createTextNode(text));
    node.replaceWith(fragment);
  }

  function replace(root = document.body) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(convertTextNode);
  }

  window.StudyroomIcons = Object.freeze({ replace });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => replace());
  else replace();
  new MutationObserver((records) => {
    records.forEach((record) => {
      record.addedNodes.forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) convertTextNode(node);
        else if (node.nodeType === Node.ELEMENT_NODE) replace(node);
      });
    });
  }).observe(document.documentElement, { childList: true, subtree: true });
})();
