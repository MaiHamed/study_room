// Studyroom module; loaded in order by index.html.
  const $ = (s, r = document) => r.querySelector(s),
    $$ = (s, r = document) => [...r.querySelectorAll(s)],
    esc = (s) =>
      String(s ?? "").replace(
        /[&<>"']/g,
        (c) =>
          ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
          })[c],
      );
  // Keep the stored value as the editable source; only create escaped display HTML here.
  function mathHtml(value) {
    let source = String(value ?? "");
    // Convert only recognizable plain-text math patterns. A lone underscore/caret is left alone.
    if (!source.includes("\\(") && !source.includes("\\["))
      source = source.replace(
        /(^|[^\\\w])((?:gcd|lcm|sin|cos|tan|log|lim)\s*\([^\n()]*\)\s*(?:=|≤|≥|<|>)\s*[^\n,;]+|[A-Za-zΑ-Ωα-ω][A-Za-zΑ-Ωα-ω0-9]*\s*(?:\^\{[^}]+\}|\^\w+|_\{[^}]+\}|_[A-Za-z0-9]+)(?:\s*(?:[+−=×*\/<>≤≥]|mod)\s*[A-Za-z0-9{}()]+)*|sqrt\([^\n()]+\)|\d+\s*[×*]\s*\d+\s*mod\s*\d+|\b\w+\s*\/\s*\w+)(?=$|[^\\\w])/g,
        (all, before, expr) =>
          before + `\\(${expr.trim().replace(/\s+/g, " ")}\\)`,
      );
    // Keep each TeX expression in one text node so MathJax can recognize delimiters
    // even when a pasted display equation spans several lines.
    return esc(source)
      .split(/(\\\[[\s\S]*?\\\]|\\\([\s\S]*?\\\))/g)
      .map((part, i) => (i % 2 ? part : part.replace(/\n/g, "<br>")))
      .join("");
  }
  function hasUnbalancedMathDelimiters(value) {
    const source = String(value ?? "");
    return (
      (source.match(/\\\(/g) || []).length !==
        (source.match(/\\\)/g) || []).length ||
      (source.match(/\\\[/g) || []).length !==
        (source.match(/\\\]/g) || []).length
    );
  }
  function hasMath(value) {
    const source = String(value ?? ""),
      plain = esc(source).replace(/\n/g, "<br>");
    return (
      /\\\(|\\\[|\\(?:frac|sqrt|sum|prod|int|lim|cdot|times|div|pm|leq|geq|neq|alpha|beta|theta|pi)\b/.test(
        source,
      ) || mathHtml(source) !== plain
    );
  }
  function updateMathPreview(preview, value) {
    window.MathJax?.typesetClear?.([preview]);
    preview.innerHTML = mathHtml(value);
    const box = preview.closest(".math-preview");
    if (box) box.hidden = !hasMath(value);
    if (hasMath(value)) renderMath(preview);
  }
  function renderMath(root = document) {
    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetClear?.([root]);
      window.MathJax.typesetPromise([root]).catch(() => {});
    }
  }
  window.addEventListener("load", () => renderMath($("#view")));
  const uid = () => Math.random().toString(36).slice(2, 10),
    save = () => localStorage.setItem(KEY, JSON.stringify(db)),
    today = () => new Date().toISOString().slice(0, 10),
    fmtDate = (s) =>
      new Date(s).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
  function touch() {
    const t = today();
    if (db.lastStudy !== t) {
      let y = new Date();
      y.setDate(y.getDate() - 1);
      db.streak =
        db.lastStudy === y.toISOString().slice(0, 10)
          ? (db.streak || 0) + 1
          : 1;
      db.lastStudy = t;
    }
    db.activity.unshift({
      date: new Date().toISOString(),
      text: "Studied in Studyroom",
    });
    db.activity = db.activity.slice(0, 30);
    save();
  }
  function persistImportDraft() {
    db.importDraft = JSON.parse(JSON.stringify(importDraft));
    clearTimeout(importSaveTimer);
    importSaveTimer = setTimeout(save, 250);
  }
  const subjectName = (id) =>
    db.subjects.find((s) => s.id === id)?.name || "Unsorted";
  const topicList = (subject) => (subject?.topics || []).filter(Boolean);
  const topicAliases = (subject) =>
    (subject?.topicAliases || [])
      .filter((x) => x.to === topicViewName)
      .map((x) => x.from);
  const topicMatches = (q, subject, topic) =>
    q.subjectId === subject?.id &&
    (q.topic === topic ||
      (subject?.topicAliases || []).some(
        (x) => x.from === q.topic && x.to === topic,
      ));
  function metrics() {
    const done = db.attempts.filter((a) => a.submittedAt),
      scores = done.map((a) => (a.score / a.questions.length) * 100);
    return {
      avg: scores.length
        ? Math.round(scores.reduce((x, y) => x + y, 0) / scores.length)
        : 0,
      answered: done.reduce((n, a) => n + a.questions.length, 0),
      cards: db.cards.length,
    };
  }
  function difficulty(q) {
    const r = db.reviews[q.id] || { wrong: 0, correct: 0 };
    let n = r.wrong + r.correct;
    if (!n) return "New";
    if (r.wrong >= 3 || r.wrong / n >= 0.6) return "Hard";
    if (r.wrong / n >= 0.3) return "Medium";
    return "Easy";
  }
