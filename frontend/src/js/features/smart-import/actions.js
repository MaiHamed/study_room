// Studyroom action handlers.
function handleProfileImportAction(el, ev, act, id) {
    if (act === "profile-cancel") {
      page = "dashboard";
      profilePhotoDraft = null;
      render();
      return;
    }
    if (act === "profile-remove-photo") {
      profilePhotoDraft = "";
      $("#profile-photo-preview").innerHTML = avatarMarkup({
        ...db.profile,
        photo: "",
      });
      return;
    }
    if (act === "analyze-import") {
      analyzeImport();
      return;
    }
    if (act === "import-cancel") {
      importDraft = {
        raw: "",
        questions: [],
        subjectId: "",
        topic: "",
        type: "auto",
        hash: "",
        duplicate: false,
      };
      delete db.importDraft;
      save();
      page = "questions";
      render();
      return;
    }
    if (act === "import-back") {
      page = "smart-import";
      render();
      return;
    }
    if (act === "import-all") {
      commitImported(true);
      return;
    }
    if (act === "import-selected") {
      commitImported(false);
      return;
    }
    if (act === "import-add-question") {
      let q = {
        id: uid(),
        number: String(importDraft.questions.length + 1),
        sourceNumber: "",
        text: "",
        type: "mcq",
        options: ["", ""],
        labels: ["A", "B"],
        correct: null,
        explanation: "",
        warnings: [
          "Question added manually. Add question text and choices, then choose the correct answer.",
        ],
        selected: true,
      };
      importDraft.questions.push(q);
      refreshImportWarnings(q, importDraft.questions.length - 1);
      persistImportDraft();
      render();
      return;
    }
    if (act === "import-remove-question") {
      importDraft.questions.splice(+el.dataset.index, 1);
      persistImportDraft();
      render();
      return;
    }
    if (act === "import-add-option") {
      let i = +el.dataset.index,
        q = importDraft.questions[i];
      q.options.push("");
      refreshImportWarnings(q, i);
      persistImportDraft();
      render();
      return;
    }
    if (act === "import-remove-option") {
      let q = importDraft.questions[+el.dataset.index],
        n = +el.dataset.option;
      q.options.splice(n, 1);
      q.labels.splice(n, 1);
      if (q.correct === n) q.correct = null;
      else if (Number.isInteger(q.correct) && q.correct > n) q.correct--;
      q.warnings = q.warnings.filter((w) => !w.includes("fewer than two"));
      if (q.options.length < 2)
        q.warnings.push(
          "This multiple-choice question has fewer than two choices.",
        );
      refreshImportWarnings(q, +el.dataset.index);
      persistImportDraft();
      render();
      return;
    }
}
