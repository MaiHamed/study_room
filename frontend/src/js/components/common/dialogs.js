// Studyroom module; loaded in order by index.html.
  function showModal(title, body, submitLabel = "Save") {
    modal = `<div class="modal-backdrop" data-action="modal-close"><form class="modal" id="modal-form"><h2>${title}</h2>${body}<div class="modal-actions"><button type="button" class="btn" data-action="modal-cancel">Cancel</button><button class="btn primary" type="submit">${submitLabel}</button></div></form></div>`;
    render();
  }
  function showDeleteDialog(kind, ids, stage = 1) {
    const questionDelete = kind === "questions",
      examDelete = kind === "exams",
      allQuestions = kind === "all-questions";
    const count = ids.length,
      names = ids
        .map((id) => db.attempts.find((a) => a.id === id)?.name)
        .filter(Boolean);
    pendingDeletion = { kind, ids: [...ids] };
    let title = allQuestions
      ? stage === 1
        ? "Delete the entire question bank?"
        : "Permanently delete all questions?"
      : questionDelete
        ? `Delete ${count} question${count === 1 ? "" : "s"}?`
        : count === 1
          ? `Delete “${esc(names[0] || "this exam")}”?`
          : `Delete ${count} exams?`;
    let detail = allQuestions
      ? stage === 1
        ? `<p>This will permanently delete all ${db.questions.length} questions from your Question Bank. Past exam attempts keep their saved question snapshots.</p><p class="delete-warning">This cannot be undone.</p>`
        : `<p>You are about to permanently delete all <b>${db.questions.length}</b> questions and their question review history.</p><p class="delete-warning">This action cannot be undone. Existing exam attempts keep their saved question snapshots.</p>`
      : questionDelete
        ? `<p>${count} question${count === 1 ? "" : "s"} will be removed from the Question Bank. Past attempts keep their saved copies.</p>`
        : count === 1
          ? `<p>This removes the saved attempt and its result for <b>${esc(names[0] || "this exam")}</b>. Questions in your bank will not be deleted.</p>`
          : `<p>This removes <b>${count}</b> saved exam attempts and results. Questions in your bank will not be deleted.</p>`;
    let action = allQuestions
      ? stage === 1
        ? "delete-all-questions-step2"
        : "delete-all-questions-final"
      : questionDelete
        ? "delete-questions-confirm"
        : "delete-exams-confirm";
    let label =
      allQuestions && stage === 1
        ? "Continue"
        : allQuestions
          ? "Permanently delete all"
          : questionDelete
            ? `Delete ${count} question${count === 1 ? "" : "s"}`
            : `Delete ${count} exam${count === 1 ? "" : "s"}`;
    modal = `<div class="modal-backdrop" data-action="modal-close"><section class="modal delete-modal" role="alertdialog" aria-modal="true" aria-labelledby="delete-dialog-title"><div class="delete-modal-icon"><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 6h12M8 6V4h4v2m-6 2 1 11h6l1-11"/></svg></div><h2 id="delete-dialog-title">${title}</h2>${detail}<div class="modal-actions"><button type="button" class="btn" data-action="modal-cancel">Cancel</button><button type="button" class="btn danger" data-action="${action}" ${deleteBusy ? "disabled" : ""}>${label}</button></div></section></div>`;
    render();
  }
  function commitDeletion(kind, ids) {
    if (deleteBusy) return;
    deleteBusy = true;
    const oldQuestions = db.questions,
      oldAttempts = db.attempts,
      oldReviews = db.reviews;
    try {
      if (kind === "questions") {
        const remove = new Set(ids);
        db.questions = db.questions.filter((q) => !remove.has(q.id));
        db.reviews = { ...db.reviews };
        ids.forEach((id) => {
          delete db.reviews[id];
          selectedQuestionIds.delete(id);
        });
      } else if (kind === "all-questions") {
        db.questions = [];
        db.reviews = {};
        selectedQuestionIds.clear();
      } else {
        const remove = new Set(ids);
        db.attempts = db.attempts.filter((a) => !remove.has(a.id));
        ids.forEach((id) => selectedAttemptIds.delete(id));
        if (ids.includes(examRun)) {
          examRun = null;
          page = "exams";
        }
      }
      save();
      modal = null;
      pendingDeletion = null;
      deleteBusy = false;
      render();
      notify(
        kind === "all-questions"
          ? "All questions deleted."
          : `${ids.length} ${kind === "questions" ? "question" : "exam"}${ids.length === 1 ? "" : "s"} deleted.`,
      );
    } catch (err) {
      db.questions = oldQuestions;
      db.attempts = oldAttempts;
      db.reviews = oldReviews;
      deleteBusy = false;
      notify("Could not save the deletion. Your data was restored.");
      showDeleteDialog(
        kind === "all-questions" ? "all-questions" : kind,
        ids,
        kind === "all-questions" ? 2 : 1,
      );
    }
  }
