// Studyroom module; loaded in order by index.html.
  function render() {
    shell();
    let out =
      page === "dashboard"
        ? dashboard()
        : page === "profile"
          ? profilePage()
          : page === "subjects"
            ? subjects()
            : page === "subject-detail"
              ? subjectDetail()
              : page === "topic-detail"
                ? topicDetail()
                : page === "questions"
                  ? questions()
                  : page === "smart-import"
                    ? smartImport()
                    : page === "import-preview"
                      ? previewImport()
                      : page === "import-working"
                        ? `<div class="panel import-progress"><div class="import-icon">✦</div><h2 class="panel-title">Organizing your questions…</h2><p class="page-sub">Checking lines, choices, answer keys, and possible formatting issues.</p><div class="progress"><i></i></div></div>`
                        : page === "create-exam"
                          ? createExam()
                          : page === "exams"
                            ? exams()
                            : page === "flashcards"
                              ? cardsPage()
                              : page === "mistakes"
                                ? mistakes()
                                : page === "statistics"
                                  ? statistics()
                                  : page === "settings"
                                    ? settings()
                                    : page === "run-exam"
                                      ? runExam()
                                      : page === "result"
                                        ? resultLookup()
                                        : page === "study-cards"
                                          ? studyCards()
                                          : settings();
    $("#view").innerHTML = out;
    $("#modal-root").innerHTML = modal || "";
    refreshCustomSelects($("#view"));
    refreshCustomSelects($("#modal-root"));
    renderMath($("#view"));
    renderMath($("#modal-root"));
    if (page === "create-exam") refreshExamBuilder();
  }
  function notify(s) {
    let t = $("#toast");
    t.textContent = s;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2300);
  }
  function analyzeImport() {
    let raw = $("#import-raw")?.value || importDraft.raw;
    if (!raw.trim()) {
      notify("Paste some question text first.");
      return;
    }
    if (!$("#import-subject")?.value || !$("#import-topic")?.value) {
      notify("Choose a subject and topic before analyzing these questions.");
      return;
    }
    importDraft.raw = raw;
    importDraft.subjectId = $("#import-subject")?.value || "";
    importDraft.topic = $("#import-topic")?.value.trim() || "";
    importDraft.hash = textHash(raw.trim().replace(/\s+/g, " "));
    importDraft.duplicate = (db.importHashes || []).includes(importDraft.hash);
    db.importDraft = JSON.parse(JSON.stringify(importDraft));
    save();
    let mode = $("#import-type")?.value || "auto";
    importDraft.type = mode;
    page = "import-working";
    render();
    setTimeout(() => {
      let found = parseBulkQuestions(raw);
      if (mode !== "auto")
        found.forEach((q) => {
          let previous = q.type;
          q.type = mode;
          if (mode === "mcq") {
            q.options = q.options.length ? q.options : ["", ""];
            if (previous !== "mcq") q.correct = null;
            if (
              q.options.length < 2 &&
              !q.warnings.some((w) => w.includes("fewer than"))
            )
              q.warnings.push(
                "This multiple-choice question has fewer than two choices.",
              );
            if (
              q.options.some((x) => !x.trim()) &&
              !q.warnings.some((w) => w.includes("choices are empty"))
            )
              q.warnings.push("One or more answer choices are empty.");
          } else {
            q.options = [];
            if (previous !== mode) q.correct = null;
          }
          if (
            q.correct === null &&
            !q.warnings.some((w) => w.includes("No correct answer"))
          )
            q.warnings.push(
              "No correct answer was detected. Confirm or add it before using this question in an exam.",
            );
        });
      const seenText = new Set();
      found.forEach((q) => {
        let normalized = q.text.trim().toLowerCase();
        if (normalized && seenText.has(normalized))
          q.warnings.push(
            "This question text duplicates another question in this import.",
          );
        if (normalized) seenText.add(normalized);
        if (
          normalized &&
          db.questions.some(
            (old) => old.text.trim().toLowerCase() === normalized,
          )
        )
          q.warnings.push(
            "A question with matching text is already in your bank.",
          );
      });
      importDraft.questions = found;
      db.importDraft = JSON.parse(JSON.stringify(importDraft));
      save();
      page = "import-preview";
      render();
    }, 80);
  }
  function commitImported(all = false) {
    let selected = all
      ? importDraft.questions
      : importDraft.questions.filter((q) => q.selected);
    if (!selected.length) {
      notify("Select at least one question to import.");
      return;
    }
    let repeats = selected.filter((q) =>
      q.warnings.some(
        (w) =>
          w.includes("matching text is already in your bank") ||
          w.includes("duplicates another question"),
      ),
    ).length;
    if (
      (importDraft.duplicate || repeats) &&
      !confirm(
        `${importDraft.duplicate ? "This pasted text was imported before. " : ""}${repeats ? `${repeats} selected question${repeats === 1 ? "" : "s"} match existing question text. ` : ""}Import anyway?`,
      )
    )
      return;
    const imported = selected.map((q) => ({
      id: uid(),
      text: q.text.trim(),
      type: q.type,
      options: q.type === "mcq" ? q.options.map((x) => x.trim()) : [],
      correct: q.correct,
      explanation: q.explanation.trim(),
      subjectId: importDraft.subjectId,
      topic: importDraft.topic,
      sourceNumber: q.sourceNumber || q.number,
      importWarnings: q.warnings,
    }));
    db.questions.push(...imported);
    delete db.importDraft;
    if (selected.length === importDraft.questions.length) {
      db.importHashes = db.importHashes || [];
      if (!db.importHashes.includes(importDraft.hash))
        db.importHashes.push(importDraft.hash);
    }
    save();
    searchText = "";
    filters = { type: "all", subject: "all" };
    page = "questions";
    notify(
      `${imported.length} question${imported.length === 1 ? "" : "s"} added to your question bank.`,
    );
    render();
  }
