// Studyroom module; loaded in order by index.html.
  function exams() {
    let arr = db.attempts.filter((a) => a.submittedAt),
      ids = arr.map((a) => a.id),
      allSelected =
        ids.length > 0 && ids.every((id) => selectedAttemptIds.has(id));
    selectedAttemptIds = new Set(
      [...selectedAttemptIds].filter((id) => arr.some((a) => a.id === id)),
    );
    return (
      pageHead(
        "YOUR PRACTICE HISTORY",
        "My exams",
        "Review your attempts and see how your practice is progressing.",
        `<button class="btn primary" data-page="create-exam">＋ Create exam</button>`,
      ) +
      (arr.length
        ? `${selectedAttemptIds.size ? `<div class="selection-bar"><b>${selectedAttemptIds.size} exam${selectedAttemptIds.size === 1 ? "" : "s"} selected</b><button class="btn danger" data-action="delete-selected-exams"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2m-6 2 1 11h6l1-11"/></svg>Delete selected</button><button class="btn" data-action="clear-exam-selection">Clear selection</button></div>` : ""}<div class="panel table-card"><div class="table-head exam-history-head"><label><input type="checkbox" id="select-all-exams" ${allSelected ? "checked" : ""} aria-label="Select all exams"></label><div>EXAM</div><div>COMPLETED</div><div>SCORE</div><div></div></div>${arr.map((a) => `<div class="table-item exam-history-row ${selectedAttemptIds.has(a.id) ? "is-selected" : ""}"><label class="row-select" aria-label="Select exam"><input type="checkbox" class="attempt-select" value="${esc(a.id)}" ${selectedAttemptIds.has(a.id) ? "checked" : ""}></label><div class="row-main"><b>${esc(a.name)}</b><small>${a.questions.length} question${a.questions.length === 1 ? "" : "s"} · ${a.topicName ? esc(a.topicName) : a.scope === "subject" ? "Subject-wide" : "Custom exam"}</small></div><div>${fmtDate(a.submittedAt)}</div><div><span class="badge ${a.score / a.questions.length < 0.6 ? "warn" : ""}">${Math.round((a.score / a.questions.length) * 100)}%</span></div><div class="row-actions"><button class="btn small" data-action="result-view" data-id="${a.id}">Review</button><button class="icon-btn danger-icon" data-action="ask-delete-exam" data-id="${a.id}" title="Delete exam" aria-label="Delete ${esc(a.name)}"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2m-6 2 1 11h6l1-11"/></svg></button></div></div>`).join("")}</div>`
        : `<div class="panel empty">No completed exams yet. Your saved attempts will live here.</div>`)
    );
  }
