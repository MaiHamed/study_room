// Studyroom module; loaded in order by index.html.
  function topicOptions(subjectId, selected = "") {
    let s = db.subjects.find((x) => x.id === subjectId);
    return `<option value="">Unassigned</option>${topicList(s)
      .map(
        (t) =>
          `<option value="${esc(t)}" ${selected === t ? "selected" : ""}>${esc(t)}</option>`,
      )
      .join("")}`;
  }
  function updateMaterialTopics(form, subjectId) {
    let select = form?.querySelector("[name=topic]"),
      previous = select?.value || "";
    if (!select) return;
    select.innerHTML = topicOptions(subjectId, previous);
    if (
      previous &&
      !topicList(db.subjects.find((s) => s.id === subjectId)).includes(previous)
    )
      select.value = "";
  }
  function updateImportTopics(subjectId) {
    let select = $("#import-topic"),
      previous = select?.value || importDraft.topic;
    if (!select) return;
    select.innerHTML = `<option value="">Unassigned</option>${topicList(
      db.subjects.find((s) => s.id === subjectId),
    )
      .map(
        (t) =>
          `<option value="${esc(t)}" ${t === previous ? "selected" : ""}>${esc(t)}</option>`,
      )
      .join("")}<option value="__add_topic__">＋ Add topic</option>`;
    if (
      !topicList(db.subjects.find((s) => s.id === subjectId)).includes(previous)
    )
      select.value = "";
    importDraft.topic = select.value;
    persistImportDraft();
  }
  function subjectOptions(selected = "") {
    return `<option value="">Unsorted</option>${db.subjects.map((s) => `<option value="${s.id}" ${selected === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}`;
  }
  function questionForm(q) {
    q = q || { type: "mcq", options: ["", "", "", ""], correct: 0 };
    let options = `<div class="form-field full" id="options-wrap" style="${q.type !== "mcq" ? "display:none" : ""}"><span>Answer choices <small>LaTeX is rendered in each preview and in the exam.</small></span>${(q.options?.length ? q.options : ["", "", "", ""]).map((o, i) => `<div class="option-row"><input type="radio" name="correct" value="${i}" ${q.correct === i ? "checked" : ""} aria-label="Mark option ${i + 1} as correct"><input class="field" name="option" value="${esc(o)}" placeholder="Option ${i + 1}" ${q.type === "mcq" ? "required" : ""}><div class="math-preview" ${hasMath(o) ? "" : "hidden"}><b>Choice ${String.fromCharCode(65 + i)} preview</b><div data-math-preview="option-${i}">${mathHtml(o)}</div></div></div>`).join("")}</div>`;
    return `<div class="form-grid"><label class="form-field full">Question<textarea required class="field" name="text">${esc(q.text || "")}</textarea><div class="math-preview" ${hasMath(q.text || "") ? "" : "hidden"}><b>Math preview</b><div data-math-preview="question">${mathHtml(q.text || "")}</div></div></label><label class="form-field">Type<select class="field" name="type"><option value="mcq" ${q.type === "mcq" ? "selected" : ""}>Multiple choice</option><option value="tf" ${q.type === "tf" ? "selected" : ""}>True / False</option><option value="short" ${q.type === "short" ? "selected" : ""}>Short answer</option></select></label><label class="form-field">Subject<select class="field" required name="subjectId">${subjectOptions(q.subjectId)}</select></label><label class="form-field full">Topic<select class="field" required name="topic">${topicOptions(q.subjectId, q.topic)}</select></label>${options}<label class="form-field full" id="tf-wrap" style="${q.type === "tf" ? "" : "display:none"}">Correct answer<select name="tfcorrect" class="field"><option value="" ${q.correct === null ? "selected" : ""}>Not provided</option><option value="true" ${q.correct === true ? "selected" : ""}>True</option><option value="false" ${q.correct === false ? "selected" : ""}>False</option></select></label><label class="form-field full" id="short-wrap" style="${q.type === "short" ? "" : "display:none"}">Expected answer<input name="shortcorrect" class="field" value="${esc(q.correct ?? "")}" placeholder="Leave blank if not known"><div class="math-preview" ${hasMath(q.correct ?? "") ? "" : "hidden"}><b>Math preview</b><div data-math-preview="correct">${mathHtml(q.correct ?? "")}</div></div></label><label class="form-field full">Explanation<textarea class="field" name="explanation">${esc(q.explanation || "")}</textarea><div class="math-preview" ${hasMath(q.explanation || "") ? "" : "hidden"}><b>Math preview</b><div data-math-preview="explanation">${mathHtml(q.explanation || "")}</div></div></label></div>`;
  }
  function cardForm(c = {}) {
    return `<div class="form-grid"><label class="form-field full">Front<textarea required class="field" name="front">${esc(c.front || "")}</textarea></label><label class="form-field full">Back<textarea required class="field" name="back">${esc(c.back || "")}</textarea></label><label class="form-field">Subject<select class="field" required name="subjectId">${subjectOptions(c.subjectId)}</select></label><label class="form-field">Topic<select class="field" required name="topic">${topicOptions(c.subjectId, c.topic)}</select></label></div>`;
  }
  function subjectForm(s = {}) {
    return `<div class="form-grid"><label class="form-field full">Subject name<input required class="field" name="name" value="${esc(s.name || "")}"></label><label class="form-field full">Description<textarea class="field" name="description">${esc(s.description || "")}</textarea></label><label class="form-field">Accent color<select class="field" name="color"><option value="#8565b5" ${s.color === "#8565b5" ? "selected" : ""}>Violet</option><option value="#c08078" ${s.color === "#c08078" ? "selected" : ""}>Rose</option><option value="#6486a5" ${s.color === "#6486a5" ? "selected" : ""}>Blue</option><option value="#bd9558" ${s.color === "#bd9558" ? "selected" : ""}>Amber</option></select></label><label class="form-field full">Topics <small>Separate initial topics with commas. Manage individual topics from the subject page.</small><input class="field" name="topics" value="${esc((s.topics || []).join(", "))}"></label></div>`;
  }
  function topicForm(name = "", description = "") {
    return `<div class="form-grid"><label class="form-field full">Topic name<input required class="field" name="topicName" value="${esc(name)}"></label><label class="form-field full">Description<textarea class="field" name="topicDescription">${esc(description)}</textarea></label></div>`;
  }
