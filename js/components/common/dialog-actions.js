// Studyroom action handlers.
function handleDialogAction(el, ev, act, id) {
    if (act === "modal-cancel" || (act === "modal-close" && el === ev.target)) {
      modal = null;
      pendingDeletion = null;
      render();
      return;
    }
    if (act === "ask-delete-question") {
      showDeleteDialog("questions", [id]);
      return;
    }
    if (act === "ask-delete-exam") {
      showDeleteDialog("exams", [id]);
      return;
    }
    if (act === "delete-selected-questions") {
      let ids = [...selectedQuestionIds].filter((qid) =>
        db.questions.some((q) => q.id === qid),
      );
      if (ids.length) showDeleteDialog("questions", ids);
      return;
    }
    if (act === "delete-selected-exams") {
      let ids = [...selectedAttemptIds].filter((aid) =>
        db.attempts.some((a) => a.id === aid && a.submittedAt),
      );
      if (ids.length) showDeleteDialog("exams", ids);
      return;
    }
    if (act === "delete-all-questions") {
      if (!db.questions.length) {
        notify("The Question Bank is already empty.");
        return;
      }
      showDeleteDialog(
        "all-questions",
        db.questions.map((q) => q.id),
        1,
      );
      return;
    }
    if (act === "delete-all-questions-step2") {
      showDeleteDialog(
        "all-questions",
        db.questions.map((q) => q.id),
        2,
      );
      return;
    }
    if (act === "delete-questions-confirm" || act === "delete-exams-confirm") {
      if (!pendingDeletion || deleteBusy) return;
      commitDeletion(
        act === "delete-questions-confirm" ? "questions" : "exams",
        pendingDeletion.ids,
      );
      return;
    }
    if (act === "delete-all-questions-final") {
      if (!pendingDeletion || deleteBusy) return;
      commitDeletion(
        "all-questions",
        db.questions.map((q) => q.id),
      );
      return;
    }
    if (act === "clear-question-selection") {
      selectedQuestionIds.clear();
      render();
      return;
    }
    if (act === "clear-exam-selection") {
      selectedAttemptIds.clear();
      render();
      return;
    }
}
