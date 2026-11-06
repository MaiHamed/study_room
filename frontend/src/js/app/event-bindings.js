// Studyroom list, navigation, and input event bindings.
  document.addEventListener("change", (e) => {
    if (e.target.matches("#select-all-questions")) {
      let qs = db.questions.filter(questionMatchesFilters);
      qs.forEach((q) =>
        e.target.checked
          ? selectedQuestionIds.add(q.id)
          : selectedQuestionIds.delete(q.id),
      );
      render();
    }
    if (e.target.matches(".question-select")) {
      e.target.checked
        ? selectedQuestionIds.add(e.target.value)
        : selectedQuestionIds.delete(e.target.value);
      render();
    }
    if (e.target.matches("#select-all-exams")) {
      db.attempts
        .filter((a) => a.submittedAt)
        .forEach((a) =>
          e.target.checked
            ? selectedAttemptIds.add(a.id)
            : selectedAttemptIds.delete(a.id),
        );
      render();
    }
    if (e.target.matches(".attempt-select")) {
      e.target.checked
        ? selectedAttemptIds.add(e.target.value)
        : selectedAttemptIds.delete(e.target.value);
      render();
    }
  });
  document.addEventListener("click", (e) => {
    const profileWrap = e.target.closest(".profile-menu-wrap"),
      profileMenu = $("#profile-menu"), profileAvatar = $(".avatar");
    if (!profileWrap && profileMenu?.classList.contains("is-open")) {
      profileMenu.classList.remove("is-open");
      profileAvatar?.setAttribute("aria-expanded", "false");
      setTimeout(() => { if (!profileMenu.classList.contains("is-open")) profileMenu.hidden = true; }, 160);
    }
    if (e.target.closest(".avatar")) {
      e.preventDefault();
      const open = !profileMenu.classList.contains("is-open");
      profileMenu.hidden = false;
      requestAnimationFrame(() => profileMenu.classList.toggle("is-open", open));
      profileAvatar.setAttribute("aria-expanded", String(open));
      if (!open) setTimeout(() => { if (!profileMenu.classList.contains("is-open")) profileMenu.hidden = true; }, 160);
      return;
    }
    let pageBtn = e.target.closest("[data-page]");
    if (pageBtn) {
      if (profileMenu?.classList.contains("is-open")) profileMenu.classList.remove("is-open");
      profileAvatar?.setAttribute("aria-expanded", "false");
      if (profileMenu) setTimeout(() => { if (!profileMenu.classList.contains("is-open")) profileMenu.hidden = true; }, 160);
      page = pageBtn.dataset.page;
      profilePhotoDraft = null;
      modal = null;
      if (page === "exams") {
        examRun = null;
        resultTopicFilter = "";
      }
      if (page === "create-exam") {
        examSetup = { scope: "general", subjectId: "", topic: "" };
        examManualIds.clear();
      }
      render();
      return;
    }
    let el = e.target.closest("[data-action]");
    if (el) {
      if (profileMenu?.classList.contains("is-open")) profileMenu.classList.remove("is-open");
      profileAvatar?.setAttribute("aria-expanded", "false");
      if (profileMenu) setTimeout(() => { if (!profileMenu.classList.contains("is-open")) profileMenu.hidden = true; }, 160);
      handleAction(el, e);
      return;
    }
    if (e.target.closest("#theme-toggle")) {
      db.settings.dark = !db.settings.dark;
      save();
      render();
    }
    if (e.target.closest("#mobile-menu"))
      $("#nav").closest(".sidebar").classList.toggle("open");
  });
  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    const menu = $("#profile-menu");
    if (!menu || menu.hidden) return;
    menu.classList.remove("is-open");
    $(".avatar")?.setAttribute("aria-expanded", "false");
    setTimeout(() => { if (!menu.classList.contains("is-open")) menu.hidden = true; }, 160);
  });
  document.addEventListener("click", (e) => {
    const modeButton = e.target.closest("[data-mode-choice]"),
      themeButton = e.target.closest("[data-theme-choice]");
    if (!modeButton && !themeButton) return;
    if (modeButton) db.settings.dark = modeButton.dataset.modeChoice === "dark";
    if (themeButton) db.settings.theme = themeButton.dataset.themeChoice;
    save();
    applyTheme();
    if (page === "settings") render();
  });
  document.addEventListener("change", (e) => {
    if (e.target.matches("#q-type")) {
      filters.type = e.target.value;
      render();
    }
    if (e.target.matches("#q-subject")) {
      filters.subject = e.target.value;
      filters.topic = "all";
      render();
    }
    if (e.target.matches("#q-topic")) {
      filters.topic = e.target.value;
      render();
    }
    if (e.target.matches("#topic-question-filter")) {
      topicQuestionFilter = e.target.value;
      render();
    }
    if (e.target.matches("#dark-setting")) {
      db.settings.dark = e.target.checked;
      save();
      render();
    }
    if (e.target.matches("#exam-form [name=subject]")) {
      examSetup.subjectId = e.target.value;
      examManualIds.clear();
      updateExamTopicChoices(e.target.value);
    }
    if (e.target.matches("#modal-form [name=subjectId]"))
      updateMaterialTopics(e.target.form, e.target.value);
    if (e.target.matches("#import-subject") && e.target.value === "__add_subject__") {
      showModal("Add a subject", subjectForm());
      $("#modal-form").dataset.importSubject = "true";
      e.target.value = importDraft.subjectId || "";
      return;
    }
    if (e.target.matches("#import-subject")) updateImportTopics(e.target.value);
    if (e.target.matches("#import-topic") && e.target.value === "__add_topic__") {
      let subjectId = $("#import-subject")?.value || "";
      if (!subjectId) {
        notify("Choose a subject before adding a topic.");
        e.target.value = "";
        return;
      }
      showModal("Add a topic", topicForm());
      $("#modal-form").dataset.subject = subjectId;
      $("#modal-form").dataset.importTopic = "true";
      e.target.value = importDraft.topic || "";
      return;
    }
    if (e.target.matches(".exam-topic-choice")) updateExamAvailability();
    if (e.target.matches("input[name=manual]")) {
      examManualIds.clear();
      updateExamAvailability();
    }
    if (e.target.matches(".manual-question-check")) {
      e.target.checked
        ? examManualIds.add(e.target.value)
        : examManualIds.delete(e.target.value);
      updateExamAvailability();
    }
    if (e.target.matches("input[name=answer]")) {
      let a = currentAttempt();
      a.answers[a.current || 0] =
        e.target.value === "true"
          ? true
          : e.target.value === "false"
            ? false
            : +e.target.value;
      save();
      render();
    }
    if (e.target.matches("[name=type]")) {
      let type = e.target.value,
        opts = $("#options-wrap"),
        tf = $("#tf-wrap"),
        sh = $("#short-wrap");
      if (opts) {
        opts.style.display = type === "mcq" ? "" : "none";
        $$("input[name=option]", opts).forEach(
          (x) => (x.required = type === "mcq"),
        );
      }
      if (tf) tf.style.display = type === "tf" ? "" : "none";
      if (sh) sh.style.display = type === "short" ? "" : "none";
    }
    if (e.target.matches(".imp-selected")) {
      importDraft.questions[+e.target.dataset.index].selected =
        e.target.checked;
      let count = importDraft.questions.filter((q) => q.selected).length;
      $(".import-toolbar span").textContent = `${count} selected`;
      $(".import-bottom [data-action=import-selected]").textContent =
        `Import ${count} selected`;
    }
    if (e.target.matches(".imp-type")) {
      let q = importDraft.questions[+e.target.dataset.index],
        next = e.target.value;
      if (next !== q.type) {
        q.type = next;
        q.correct = null;
        q.options =
          next === "mcq" ? (q.options.length ? q.options : ["", ""]) : [];
        refreshImportWarnings(q, +e.target.dataset.index);
        render();
      }
    }
    if (e.target.matches(".imp-correct")) {
      let q = importDraft.questions[+e.target.dataset.index],
        v = e.target.value;
      q.correct = v === "" ? null : q.type === "mcq" ? +v : v === "true";
      refreshImportWarnings(q, +e.target.dataset.index);
    }
    if (e.target.matches("#exam-form .exam-topic-choice"))
      updateExamAvailability();
    if (
      e.target.matches(
        "#exam-form [name=manual],#exam-form [name=allQuestions],#exam-form [name=qtype],#exam-form [name=difficulty]",
      )
    )
      updateExamAvailability();
    if (e.target.matches("#import-select-all")) {
      importDraft.questions.forEach((q) => (q.selected = e.target.checked));
      $$(".imp-selected").forEach((x) => (x.checked = e.target.checked));
      $(".import-toolbar span").textContent =
        `${importDraft.questions.filter((q) => q.selected).length} selected`;
      $(".import-bottom [data-action=import-selected]").textContent =
        `Import ${importDraft.questions.filter((q) => q.selected).length} selected`;
    }
  });
  document.addEventListener("input", (e) => {
    if (
      e.target.matches(
        "#modal-form textarea[name=text],#modal-form textarea[name=explanation],#modal-form input[name=shortcorrect],#modal-form input[name=option]",
      )
    ) {
      let name = e.target.name,
        index =
          e.target.name === "option"
            ? [...$$("#modal-form input[name=option]")].indexOf(e.target)
            : null,
        key =
          name === "text"
            ? "question"
            : name === "explanation"
              ? "explanation"
              : name === "shortcorrect"
                ? "correct"
                : `option-${index}`,
        preview = $(`[data-math-preview="${key}"]`);
      if (preview) {
        updateMathPreview(preview, e.target.value);
      }
    }
    if (e.target.matches("#import-raw")) {
      importDraft.raw = e.target.value;
      persistImportDraft();
    }
    if (e.target.matches("#import-subject")) {
      importDraft.subjectId = e.target.value;
      persistImportDraft();
    }
    if (e.target.matches("#import-topic")) {
      importDraft.topic = e.target.value;
      persistImportDraft();
    }
    if (e.target.matches("#import-type")) {
      importDraft.type = e.target.value;
      persistImportDraft();
    }
    if (e.target.matches(".imp-text")) {
      let i = +e.target.dataset.index;
      importDraft.questions[i].text = e.target.value;
      refreshImportWarnings(importDraft.questions[i], i);
      let preview = $(`[data-math-preview="text-${i}"]`);
      if (preview) {
        updateMathPreview(preview, e.target.value);
      }
    }
    if (e.target.matches(".imp-option")) {
      let i = +e.target.dataset.index;
      importDraft.questions[i].options[+e.target.dataset.option] =
        e.target.value;
      let preview = $(
        `[data-math-preview="import-option-${i}-${e.target.dataset.option}"]`,
      );
      if (preview) {
        updateMathPreview(preview, e.target.value);
      }
      refreshImportWarnings(importDraft.questions[i], i);
    }
    if (e.target.matches(".imp-explanation")) {
      let i = +e.target.dataset.index;
      importDraft.questions[i].explanation = e.target.value;
      let preview = $(`[data-math-preview="explanation-${i}"]`);
      if (preview) {
        updateMathPreview(preview, e.target.value);
      }
    }
    if (e.target.matches(".imp-correct-text")) {
      let i = +e.target.dataset.index;
      importDraft.questions[i].correct = e.target.value.trim() || null;
      refreshImportWarnings(importDraft.questions[i], i);
    }
    if (e.target.matches("#q-search")) {
      searchText = e.target.value;
      let focus = e.target.selectionStart;
      $("#view").innerHTML = questions();
      renderMath($("#view"));
      let n = $("#q-search");
      n.focus();
      n.setSelectionRange(focus, focus);
    }
    if (e.target.matches("#card-search")) {
      $$(".table-item").forEach(
        (row) =>
          (row.style.display = row.textContent
            .toLowerCase()
            .includes(e.target.value.toLowerCase())
            ? ""
            : "none"),
      );
    }
    if (e.target.closest(".import-preview-list")) persistImportDraft();
  });
