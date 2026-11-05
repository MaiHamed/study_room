// Studyroom module; loaded in order by index.html.
  function questionCard(q, selectable = false) {
    let r = db.reviews[q.id] || { wrong: 0, correct: 0 },
      d = difficulty(q);
    return `<div class="table-item ${selectable ? `question-bank-row ${selectedQuestionIds.has(q.id) ? "is-selected" : ""}` : ""}">${selectable ? `<label class="row-select" aria-label="Select question"><input type="checkbox" class="question-select" value="${esc(q.id)}" ${selectedQuestionIds.has(q.id) ? "checked" : ""}></label>` : ""}<div class="question-text">${mathHtml(q.text)}${q.explanation ? `<small class="question-explanation">${mathHtml(q.explanation)}</small>` : ""}</div><div>${esc(subjectName(q.subjectId))}</div><div><span class="badge ${d === "Hard" ? "rose" : d === "Medium" ? "warn" : ""}">${d}${r.wrong ? ` · ${r.wrong} misses` : ""}</span></div><div class="row-actions"><button class="icon-btn" data-action="question-edit" data-id="${q.id}" title="Edit">✎</button><button class="icon-btn" data-action="question-duplicate" data-id="${q.id}" title="Duplicate">⧉</button></div></div>`;
  }
  function questions() {
    let qs = db.questions.filter(
        (q) =>
          q.text.toLowerCase().includes(searchText.toLowerCase()) &&
          (filters.type === "all" || q.type === filters.type) &&
          (filters.subject === "all" || q.subjectId === filters.subject),
      ),
      visibleIds = qs.map((q) => q.id),
      allSelected =
        visibleIds.length > 0 &&
        visibleIds.every((id) => selectedQuestionIds.has(id));
    selectedQuestionIds = new Set(
      [...selectedQuestionIds].filter((id) =>
        db.questions.some((q) => q.id === id),
      ),
    );
    return (
      pageHead(
        "BUILD YOUR BANK",
        "Question bank",
        "Create a reliable library of practice questions.",
        `<button class="btn" data-page="smart-import">Smart import</button>${db.questions.length ? `<button class="btn danger" data-action="delete-all-questions">Delete all</button>` : ""}<button class="btn primary" data-action="question-add">＋ Add question</button>`,
      ) +
      `<div class="toolbar"><input id="q-search" class="search" placeholder="Search questions…" value="${esc(searchText)}"><select id="q-type" class="field select"><option value="all">All types</option><option value="mcq" ${filters.type === "mcq" ? "selected" : ""}>Multiple choice</option><option value="tf" ${filters.type === "tf" ? "selected" : ""}>True / False</option><option value="short" ${filters.type === "short" ? "selected" : ""}>Short answer</option></select><select id="q-subject" class="field select"><option value="all">All subjects</option>${db.subjects.map((s) => `<option value="${s.id}" ${filters.subject === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select></div>${selectedQuestionIds.size ? `<div class="selection-bar"><b>${selectedQuestionIds.size} question${selectedQuestionIds.size === 1 ? "" : "s"} selected</b><button class="btn danger" data-action="delete-selected-questions"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2m-6 0 1 11h6l1-11"/></svg>Delete selected</button><button class="btn" data-action="clear-question-selection">Clear selection</button></div>` : ""}<div class="panel table-card">${qs.length ? `<div class="table-head question-table-head"><label><input type="checkbox" id="select-all-questions" ${allSelected ? "checked" : ""} aria-label="Select all displayed questions"></label><div>QUESTION</div><div>SUBJECT</div><div>DIFFICULTY</div><div></div></div>${qs.map((q) => questionCard(q, true)).join("")}` : `<div class="empty">${db.questions.length ? "No questions match those filters." : "Your bank is ready for its first question."}</div>`}</div>`
    );
  }
