// Studyroom action dispatcher.
// Action dispatcher; feature-specific behavior lives in the feature handlers.
function handleAction(el, ev) {
  const act = el.dataset.action, id = el.dataset.id;
  if (["subject-export", "subject-import", "subject-transfer-cancel", "subject-transfer-all", "subject-transfer-none", "subject-transfer-export-all", "subject-transfer-export-selected", "subject-transfer-commit"].includes(act)) return handleSubjectTransferAction(el, ev, act);
  if (["profile-cancel", "profile-remove-photo", "analyze-import", "import-cancel", "import-back", "import-all", "import-selected", "import-add-question", "import-remove-question", "import-add-option", "import-remove-option"].includes(act)) return handleProfileImportAction(el, ev, act, id);
  if (["modal-cancel", "modal-close", "ask-delete-question", "ask-delete-exam", "delete-selected-questions", "delete-selected-exams", "delete-all-questions", "delete-all-questions-step2", "delete-questions-confirm", "delete-exams-confirm", "delete-all-questions-final", "clear-question-selection", "clear-exam-selection"].includes(act)) return handleDialogAction(el, ev, act, id);
  if (["subject-open", "topic-open", "subject-exam", "topic-exam", "topic-add", "topic-edit", "topic-delete", "topic-up", "topic-down", "topic-question-add", "topic-card-add", "topic-study-all", "topic-study-selected", "subject-add", "subject-edit", "subject-delete", "question-add", "question-edit", "question-duplicate", "question-delete", "card-add", "card-edit", "card-delete"].includes(act)) return handleContentAction(el, ev, act, id);
  if (["import", "export", "clear-data"].includes(act)) return handleDataAction(el, ev, act, id);
  if (["exam-submit", "exam-next", "exam-prev", "exam-jump", "exam-mark", "result-view", "retake-all", "retake-wrong", "review-only"].includes(act)) return handleExamAction(el, ev, act, id);
  if (["card-study", "smart-revision", "flip-card", "rate", "mistake-master", "mistake-dismiss", "mistake-practice"].includes(act)) return handleStudyAction(el, ev, act, id);
}
