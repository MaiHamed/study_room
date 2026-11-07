// Versioned, local-first import/export for one subject or selected topics.
function subjectTransferQuestionRecord(question) {
  return {
    type: question.type,
    prompt: String(question.text || ""),
    choices: Array.isArray(question.options) ? [...question.options] : [],
    answer: question.correct ?? null,
    explanation: String(question.explanation || ""),
    sourceNumber: question.sourceNumber ?? null,
    importNotes: Array.isArray(question.importWarnings)
      ? [...question.importWarnings]
      : question.importWarnings ? [String(question.importWarnings)] : [],
  };
}

function createSubjectExport(subject, questions, selectedTopicNames = null) {
  const topics = (subject.topics || []).filter(Boolean),
    selected = selectedTopicNames === null ? new Set(topics) : new Set(selectedTopicNames),
    aliases = subject.topicAliases || [],
    topicRecords = topics.filter((name) => selected.has(name)).map((name) => {
      const oldNames = aliases.filter((alias) => alias?.to === name && typeof alias.from === "string").map((alias) => alias.from),
        topicQuestions = questions.filter((q) => q.subjectId === subject.id && (q.topic === name || oldNames.includes(q.topic)));
      return {
        name,
        aliases: [...new Set(oldNames)],
        description: String(subject.topicDescriptions?.[name] || ""),
        questions: topicQuestions.map(subjectTransferQuestionRecord),
      };
    }),
    assigned = new Set(topicRecords.flatMap((topic) => [topic.name, ...topic.aliases]));
  const unassignedQuestions = selectedTopicNames === null
    ? questions.filter((q) => q.subjectId === subject.id && !assigned.has(q.topic || "")).map(subjectTransferQuestionRecord)
    : [];
  return {
    format: "studyroom-subject",
    version: 1,
    exportedAt: new Date().toISOString(),
    subject: {
      name: String(subject.name || ""),
      description: String(subject.description || ""),
      color: /^#[\da-f]{6}$/i.test(subject.color || "") ? subject.color : "",
      topics: topicRecords,
      questions: unassignedQuestions,
    },
  };
}

function validateSubjectExport(value) {
  const fail = (message) => { throw new Error(message); },
    stringField = (value, field, max = 100000) => {
      if (typeof value !== "string" || value.length > max) fail(`${field} must be text under ${max} characters.`);
      return value;
    };
  if (!value || typeof value !== "object" || Array.isArray(value) || value.format !== "studyroom-subject") fail("This is not a Studyroom subject export file.");
  if (!Number.isInteger(value.version) || value.version < 1 || value.version > 1) fail(`Subject export version ${value.version} is not supported.`);
  if (value.exportedAt !== undefined && (typeof value.exportedAt !== "string" || Number.isNaN(Date.parse(value.exportedAt)))) fail("The export date is invalid.");
  const source = value.subject;
  if (!source || typeof source !== "object" || Array.isArray(source)) fail("The export is missing its subject data.");
  const name = stringField(source.name, "Subject name", 120).trim();
  if (!name) fail("The export needs a subject name.");
  if (!Array.isArray(source.topics) || source.topics.length > 500) fail("The export must contain no more than 500 topics.");
  const questionCount = source.topics.reduce((n, t) => n + (Array.isArray(t?.questions) ? t.questions.length : 0), 0) + (Array.isArray(source.questions) ? source.questions.length : 0);
  if (questionCount > 20000) fail("The export contains too many questions (maximum 20,000).");
  const seenTopics = new Set();
  const parseQuestion = (q, index) => {
    if (!q || typeof q !== "object" || Array.isArray(q)) fail(`Question ${index + 1} is malformed.`);
    const type = q.type;
    if (!["mcq", "tf", "short"].includes(type)) fail(`Question ${index + 1} has an unsupported type.`);
    const prompt = stringField(q.prompt ?? q.text, `Question ${index + 1} prompt`).trim();
    if (!prompt) fail(`Question ${index + 1} has no prompt.`);
    const choices = q.choices ?? q.options ?? [];
    if (!Array.isArray(choices) || choices.length > 20 || choices.some((item) => typeof item !== "string" || item.length > 10000)) fail(`Question ${index + 1} has invalid choices.`);
    let answer = q.answer === undefined ? q.correct ?? null : q.answer;
    if (type === "mcq" && typeof answer === "string") {
      if (!answer.trim()) answer = null;
    }
    if (type === "mcq" && typeof answer === "string") {
      const label = answer.trim().match(/^\(?([A-T])\)?$/i)?.[1]?.toUpperCase();
      const byLabel = label ? label.charCodeAt(0) - 65 : -1,
        byText = choices.findIndex((choice) => choice.trim().toLocaleLowerCase() === answer.trim().toLocaleLowerCase());
      answer = byLabel >= 0 && byLabel < choices.length ? byLabel : byText >= 0 ? byText : answer;
    }
    if (type === "mcq" && answer !== null && (!Number.isInteger(answer) || answer < 0 || answer >= choices.length)) fail(`Question ${index + 1} has an answer that does not match its choices.`);
    if (type === "tf" && answer !== null && typeof answer !== "boolean") fail(`Question ${index + 1} must have a True/False answer.`);
    if (type === "short" && answer !== null && typeof answer !== "string") fail(`Question ${index + 1} has an invalid short answer.`);
    const notes = q.importNotes ?? q.importWarnings ?? [];
    if (!(typeof notes === "string" || (Array.isArray(notes) && notes.every((item) => typeof item === "string")))) fail(`Question ${index + 1} has invalid import notes.`);
    const sourceNumber = q.sourceNumber == null ? null : typeof q.sourceNumber === "string" || typeof q.sourceNumber === "number" ? String(q.sourceNumber).slice(0, 100) : fail(`Question ${index + 1} has an invalid source number.`);
    return { type, prompt, choices: [...choices], answer, explanation: stringField(q.explanation === undefined ? "" : q.explanation, `Question ${index + 1} explanation`), importNotes: Array.isArray(notes) ? [...notes] : notes ? [notes] : [], sourceNumber };
  };
  const topics = source.topics.map((topic, topicIndex) => {
    if (!topic || typeof topic !== "object" || Array.isArray(topic)) fail(`Topic ${topicIndex + 1} is malformed.`);
    const topicName = stringField(topic.name, `Topic ${topicIndex + 1} name`, 160).trim();
    if (!topicName || seenTopics.has(topicName.toLocaleLowerCase())) fail("Topic names must be non-empty and unique in the export.");
    seenTopics.add(topicName.toLocaleLowerCase());
    const aliases = topic.aliases ?? [];
    if (!Array.isArray(aliases) || aliases.length > 100 || aliases.some((alias) => typeof alias !== "string" || alias.length > 160)) fail(`Topic ${topicIndex + 1} has invalid aliases.`);
    if (!Array.isArray(topic.questions)) fail(`Topic ${topicIndex + 1} is missing its questions list.`);
    return { name: topicName, aliases: [...aliases], description: stringField(topic.description === undefined ? "" : topic.description, `Topic ${topicIndex + 1} description`, 10000), questions: topic.questions.map(parseQuestion) };
  });
  if (source.questions !== undefined && !Array.isArray(source.questions)) fail("Unassigned subject questions must be a list.");
  const questions = (source.questions || []).map((q, i) => parseQuestion(q, questionCount - (source.questions || []).length + i));
  const color = source.color === undefined || source.color === "" ? "" : typeof source.color === "string" && /^#[\da-f]{6}$/i.test(source.color) ? source.color : fail("Subject color is invalid.");
  return { format: "studyroom-subject", version: 1, subject: { name, description: stringField(source.description === undefined ? "" : source.description, "Subject description", 10000), color, topics, questions } };
}

function subjectTransferQuestionSignature(q) {
  return JSON.stringify([q.topic || "", q.type, String(q.text || "").trim().toLocaleLowerCase(), q.options || [], q.correct ?? null, String(q.explanation || "").trim()]);
}

function subjectTransferBuildPlan(file, currentSubjects, currentQuestions, options, makeId) {
  const selected = new Set(options.selectedTopics || []),
    selectedTopics = file.subject.topics.filter((topic) => selected.has(topic.name)),
    unassigned = options.includeUnassigned ? file.subject.questions : [],
    sourceQuestions = [...selectedTopics.flatMap((topic) => topic.questions.map((question) => ({ topic, question }))), ...unassigned.map((question) => ({ topic: null, question }))];
  if (!sourceQuestions.length && !selectedTopics.length && file.subject.topics.length) throw new Error("Select at least one topic or unassigned question to import.");
  let subject, isNew = options.mode !== "merge";
  if (isNew) {
    const name = String(options.newName || "").trim();
    if (!name || name.length > 120) throw new Error("Enter a subject name up to 120 characters.");
    subject = { id: makeId(), name, description: file.subject.description, color: file.subject.color || "", topics: [], topicDescriptions: {}, topicAliases: [] };
  } else {
    subject = currentSubjects.find((item) => item.id === options.targetId);
    if (!subject) throw new Error("Choose an existing subject to merge into.");
    subject = { ...subject, topics: [...(subject.topics || [])], topicDescriptions: { ...(subject.topicDescriptions || {}) }, topicAliases: [...(subject.topicAliases || [])] };
    if (!subject.description) subject.description = file.subject.description;
    if (!subject.color) subject.color = file.subject.color || "";
  }
  const existingTopicNames = new Map(subject.topics.map((name) => [name.toLocaleLowerCase(), name])), topicMap = new Map();
  for (const topic of selectedTopics) {
    const existingName = existingTopicNames.get(topic.name.toLocaleLowerCase());
    let destination = existingName || topic.name;
    if (!existingName) { subject.topics.push(destination); existingTopicNames.set(destination.toLocaleLowerCase(), destination); }
    if (!subject.topicDescriptions[destination] && topic.description) subject.topicDescriptions[destination] = topic.description;
    for (const alias of topic.aliases) {
      if (!subject.topicAliases.some((item) => item.from === alias && item.to === destination)) subject.topicAliases.push({ from: alias, to: destination });
    }
    topicMap.set(topic.name, destination);
  }
  const knownIds = new Set([...currentSubjects, ...currentQuestions].map((item) => item.id));
  knownIds.add(subject.id);
  const freshId = () => { let id; do { id = makeId(); } while (!id || knownIds.has(id)); knownIds.add(id); return id; },
    signatures = new Set(options.duplicatePolicy === "skip" && !isNew
      ? currentQuestions.filter((q) => q.subjectId === subject.id).map(subjectTransferQuestionSignature)
      : []),
    questions = [];
  let skipped = 0;
  for (const entry of sourceQuestions) {
    const q = entry.question,
      mappedTopic = entry.topic ? topicMap.get(entry.topic.name) : "",
      signature = subjectTransferQuestionSignature({ topic: mappedTopic, type: q.type, text: q.prompt, options: q.choices, correct: q.answer, explanation: q.explanation });
    if (options.duplicatePolicy === "skip" && signatures.has(signature)) { skipped++; continue; }
    signatures.add(signature);
    questions.push({ id: freshId(), subjectId: subject.id, topic: mappedTopic, type: q.type, text: q.prompt, options: [...q.choices], correct: q.answer, explanation: q.explanation, importWarnings: [...q.importNotes], sourceNumber: q.sourceNumber });
  }
  return { subject, isNew, questions, skipped, selectedTopicCount: selectedTopics.length };
}

let subjectTransferState = null,
  subjectTransferBusy = false;

function subjectTransferQuestionCount(subject, topicName) {
  const aliases = (subject.topicAliases || []).filter((item) => item.to === topicName).map((item) => item.from);
  return db.questions.filter((q) => q.subjectId === subject.id && (q.topic === topicName || aliases.includes(q.topic))).length;
}

function subjectTransferOpenExport(subjectId) {
  const subject = db.subjects.find((item) => item.id === subjectId);
  if (!subject) return notify("Subject could not be found.");
  subjectTransferState = { mode: "export", subjectId, selected: new Set(topicList(subject)), search: "" };
  subjectTransferRender();
}

function subjectTransferStartImport() {
  const input = document.createElement("input");
  input.type = "file"; input.accept = ".json,application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return notify("Choose a subject export smaller than 10 MB.");
    try {
      const parsed = validateSubjectExport(JSON.parse(await file.text()));
      subjectTransferState = { mode: "import", file: parsed, selected: new Set(parsed.subject.topics.map((topic) => topic.name)), includeUnassigned: true, search: "", importMode: "create", newName: parsed.subject.name, targetId: db.subjects[0]?.id || "", duplicatePolicy: "skip" };
      subjectTransferRender();
    } catch (error) { notify(error.message || "That subject export file could not be read."); }
  };
  input.click();
}

function subjectTransferCounts() {
  const state = subjectTransferState;
  if (state.mode === "export") {
    const subject = db.subjects.find((item) => item.id === state.subjectId), topics = topicList(subject || {}), selectedTopics = topics.filter((name) => state.selected.has(name));
    return { topics: selectedTopics.length, questions: selectedTopics.reduce((n, name) => n + subjectTransferQuestionCount(subject, name), 0) };
  }
  const topics = state.file.subject.topics.filter((topic) => state.selected.has(topic.name)),
    selectedQuestions = topics.reduce((n, topic) => n + topic.questions.length, 0) + (state.includeUnassigned ? state.file.subject.questions.length : 0);
  return { topics: topics.length, questions: selectedQuestions };
}

function subjectTransferTopicRows(topics, selected, countFor, mode) {
  return topics.length ? topics.map((topic, index) => {
    const name = typeof topic === "string" ? topic : topic.name,
      count = countFor(topic), checked = selected.has(name);
    return `<label class="subject-transfer-topic" data-transfer-topic-row="${esc(name.toLocaleLowerCase())}"><input type="checkbox" data-transfer-topic="${esc(name)}" ${checked ? "checked" : ""}><span><b>${esc(name)}</b><small>${count} question${count === 1 ? "" : "s"}</small></span></label>`;
  }).join("") : `<p class="subject-transfer-empty">No topics in this subject.</p>`;
}

function subjectTransferRender() {
  const state = subjectTransferState;
  if (!state) return;
  const counts = subjectTransferCounts(), isExport = state.mode === "export",
    subject = isExport ? db.subjects.find((item) => item.id === state.subjectId) : state.file.subject,
    topics = isExport ? topicList(subject) : state.file.subject.topics,
    topicRows = subjectTransferTopicRows(topics, state.selected, (topic) => isExport ? subjectTransferQuestionCount(subject, topic) : topic.questions.length, state.mode),
    selection = `<div class="subject-transfer-selection"><button class="panel-link" type="button" data-action="subject-transfer-all">Select all</button><button class="panel-link" type="button" data-action="subject-transfer-none">Deselect all</button><label class="subject-transfer-search"><i data-lucide="search"></i><input type="search" data-transfer-search placeholder="Search topics" value="${esc(state.search)}" aria-label="Search topics"></label></div><div class="subject-transfer-topic-list">${topicRows}</div><p class="subject-transfer-summary" data-transfer-summary>${counts.topics} topic${counts.topics === 1 ? "" : "s"} · ${counts.questions} question${counts.questions === 1 ? "" : "s"} selected</p>`;
  if (isExport) {
    const selectedQuestions = counts.questions,
      entireQuestions = db.questions.filter((q) => q.subjectId === subject.id).length,
      assignedTopicNames = new Set(topics.flatMap((name) => [name, ...(subject.topicAliases || []).filter((alias) => alias?.to === name).map((alias) => alias.from)])),
      unassignedCount = db.questions.filter((q) => q.subjectId === subject.id && !assignedTopicNames.has(q.topic || "")).length;
    modal = `<div class="modal-backdrop" data-action="modal-close"><section class="modal subject-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="subject-transfer-title"><div class="eyebrow">SUBJECT EXPORT</div><h2 id="subject-transfer-title">Export ${esc(subject.name)}</h2><p class="page-sub">Choose topics to include. Your original subject and questions will not be changed.</p>${topics.length ? `${selection}${unassignedCount ? `<p class="page-sub">${unassignedCount} question${unassignedCount === 1 ? " is" : "s are"} not assigned to a topic; included when exporting the entire subject.</p>` : ""}` : `<div class="subject-transfer-summary">${entireQuestions} question${entireQuestions === 1 ? "" : "s"} · no topics</div>`}<div class="modal-actions subject-transfer-actions"><button type="button" class="btn" data-action="subject-transfer-cancel">Cancel</button>${topics.length ? `<button type="button" class="btn" data-action="subject-transfer-export-all" ${subjectTransferBusy ? "disabled" : ""}>Export entire subject</button><button type="button" class="btn primary" data-action="subject-transfer-export-selected" ${subjectTransferBusy || !counts.topics ? "disabled" : ""}>Export selected topics</button>` : `<button type="button" class="btn primary" data-action="subject-transfer-export-all" ${subjectTransferBusy ? "disabled" : ""}>Export subject</button>`}</div></section></div>`;
  } else {
    const wholeQuestionCount = state.file.subject.topics.reduce((n, topic) => n + topic.questions.length, 0) + state.file.subject.questions.length,
      loose = state.file.subject.questions.length,
      importChoices = `<fieldset class="subject-transfer-fieldset"><legend>Import destination</legend><label><input type="radio" name="transfer-mode" value="create" ${state.importMode === "create" ? "checked" : ""}> Create as a new subject</label><label><input type="radio" name="transfer-mode" value="merge" ${state.importMode === "merge" ? "checked" : ""} ${db.subjects.length ? "" : "disabled"}> Merge with an existing subject</label>${state.importMode === "create" ? `<label class="form-field">Subject name<input class="field" data-transfer-name maxlength="120" value="${esc(state.newName)}" autocomplete="off"></label>` : `<label class="form-field">Merge into<select class="field" data-transfer-target>${db.subjects.map((item) => `<option value="${esc(item.id)}" ${state.targetId === item.id ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select></label>`}<div class="subject-transfer-duplicate"><span>Questions already in this subject</span><label><input type="radio" name="transfer-duplicates" value="skip" ${state.duplicatePolicy === "skip" ? "checked" : ""}> Skip exact duplicates</label><label><input type="radio" name="transfer-duplicates" value="keep" ${state.duplicatePolicy === "keep" ? "checked" : ""}> Keep both</label></div></fieldset>`;
    modal = `<div class="modal-backdrop" data-action="modal-close"><section class="modal subject-transfer-modal" role="dialog" aria-modal="true" aria-labelledby="subject-transfer-title"><div class="eyebrow">SUBJECT IMPORT PREVIEW</div><h2 id="subject-transfer-title">Import ${esc(subject.name)}</h2><p class="page-sub">${state.file.subject.topics.length} topics · ${wholeQuestionCount} questions in this export. Choose what to bring in.</p>${topics.length ? selection : `<div class="subject-transfer-summary">This subject has no topics.</div>`}${loose ? `<label class="subject-transfer-loose"><input type="checkbox" data-transfer-loose ${state.includeUnassigned ? "checked" : ""}> Include ${loose} question${loose === 1 ? "" : "s"} not assigned to a topic</label>` : ""}${importChoices}<div class="modal-actions subject-transfer-actions"><button type="button" class="btn" data-action="subject-transfer-cancel">Cancel</button><button type="button" class="btn primary" data-action="subject-transfer-commit" ${subjectTransferBusy || (state.file.subject.topics.length > 0 && !counts.topics && !state.includeUnassigned) ? "disabled" : ""}>${subjectTransferBusy ? "Importing…" : `Import ${counts.topics} topics · ${counts.questions} questions`}</button></div></section></div>`;
  }
  render();
}

function subjectTransferUpdateSummary() {
  const summary = document.querySelector("[data-transfer-summary]"), state = subjectTransferState;
  if (!summary || !state) return;
  const counts = subjectTransferCounts();
  summary.textContent = `${counts.topics} topic${counts.topics === 1 ? "" : "s"} · ${counts.questions} question${counts.questions === 1 ? "" : "s"} selected`;
  const selectedButton = document.querySelector('[data-action="subject-transfer-export-selected"]');
  if (selectedButton) { selectedButton.disabled = !counts.topics || subjectTransferBusy; selectedButton.textContent = `Export selected topics`; }
  const importButton = document.querySelector('[data-action="subject-transfer-commit"]');
  if (importButton) { importButton.disabled = subjectTransferBusy || (state.file.subject.topics.length > 0 && !counts.topics && !state.includeUnassigned); importButton.textContent = subjectTransferBusy ? "Importing…" : `Import ${counts.topics} topics · ${counts.questions} questions`; }
}

function subjectTransferDownload(subjectId, topicNames = null) {
  const subject = db.subjects.find((item) => item.id === subjectId),
    data = createSubjectExport(subject, db.questions, topicNames),
    questions = data.subject.topics.reduce((n, topic) => n + topic.questions.length, 0) + data.subject.questions.length;
  if (questions > 500 && !confirm(`Export ${questions} questions?`)) return;
  subjectTransferBusy = true;
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    url = URL.createObjectURL(blob), anchor = document.createElement("a"),
    suffix = topicNames === null ? "" : "-selected-topics";
  anchor.href = url; anchor.download = `${subject.name.trim().replace(/[^\p{L}\p{N}-]+/gu, "-").replace(/^-|-$/g, "") || "subject"}${suffix}.studyroom-subject.json`;
  anchor.click(); URL.revokeObjectURL(url);
  subjectTransferBusy = false; subjectTransferState = null; modal = null; render(); notify("Subject export downloaded.");
}

function subjectTransferCommit() {
  if (!subjectTransferState || subjectTransferState.mode !== "import" || subjectTransferBusy) return;
  const state = subjectTransferState, counts = subjectTransferCounts();
  if (counts.questions > 500 && !confirm(`Import ${counts.questions} questions?`)) return;
  subjectTransferBusy = true; subjectTransferRender();
  setTimeout(() => {
    const beforeSubjects = db.subjects, beforeQuestions = db.questions;
    try {
      const plan = subjectTransferBuildPlan(state.file, db.subjects, db.questions, {
        selectedTopics: [...state.selected], includeUnassigned: state.includeUnassigned,
        mode: state.importMode, newName: state.newName, targetId: state.targetId,
        duplicatePolicy: state.duplicatePolicy,
      }, uid);
      db.subjects = plan.isNew ? [...db.subjects, plan.subject] : db.subjects.map((item) => item.id === plan.subject.id ? plan.subject : item);
      db.questions = [...db.questions, ...plan.questions];
      save();
      subjectTransferState = null; subjectTransferBusy = false; modal = null; render();
      notify(`Imported ${plan.questions.length} question${plan.questions.length === 1 ? "" : "s"}${plan.skipped ? ` · skipped ${plan.skipped} exact duplicate${plan.skipped === 1 ? "" : "s"}` : ""}.`);
    } catch (error) {
      db.subjects = beforeSubjects; db.questions = beforeQuestions;
      subjectTransferBusy = false;
      notify(error.message || "Could not import this subject. Your existing data was not changed.");
      subjectTransferRender();
    }
  }, 0);
}

function handleSubjectTransferAction(el, ev, action) {
  if (action === "subject-export") { ev?.stopPropagation(); subjectTransferOpenExport(el.dataset.id); return true; }
  if (action === "subject-import") { subjectTransferStartImport(); return true; }
  if (action === "subject-transfer-cancel") { subjectTransferState = null; subjectTransferBusy = false; modal = null; render(); return true; }
  if (action === "subject-transfer-all" || action === "subject-transfer-none") {
    const state = subjectTransferState, subject = state?.mode === "export" ? db.subjects.find((item) => item.id === state.subjectId) : state?.file.subject;
    state.selected = new Set(action === "subject-transfer-all" ? (state.mode === "export" ? topicList(subject) : subject.topics.map((topic) => topic.name)) : []);
    subjectTransferRender(); return true;
  }
  if (action === "subject-transfer-export-all") { subjectTransferDownload(subjectTransferState.subjectId, null); return true; }
  if (action === "subject-transfer-export-selected") { subjectTransferDownload(subjectTransferState.subjectId, [...subjectTransferState.selected]); return true; }
  if (action === "subject-transfer-commit") { subjectTransferCommit(); return true; }
  return false;
}

document.addEventListener("change", (event) => {
  const state = subjectTransferState;
  if (!state) return;
  if (event.target.matches("[data-transfer-topic]")) {
    const name = event.target.dataset.transferTopic;
    if (event.target.checked) state.selected.add(name); else state.selected.delete(name);
    subjectTransferUpdateSummary();
  } else if (event.target.matches("[data-transfer-loose]")) {
    state.includeUnassigned = event.target.checked; subjectTransferUpdateSummary();
  } else if (event.target.matches('[name="transfer-mode"]')) {
    state.importMode = event.target.value; subjectTransferRender();
  } else if (event.target.matches('[name="transfer-duplicates"]')) {
    state.duplicatePolicy = event.target.value;
  } else if (event.target.matches("[data-transfer-target]")) {
    state.targetId = event.target.value;
  }
});

document.addEventListener("input", (event) => {
  if (!subjectTransferState) return;
  if (event.target.matches("[data-transfer-search]")) {
    const query = event.target.value.trim().toLocaleLowerCase();
    subjectTransferState.search = event.target.value;
    document.querySelectorAll("[data-transfer-topic-row]").forEach((row) => { row.hidden = !row.dataset.transferTopicRow.includes(query); });
  } else if (event.target.matches("[data-transfer-name]")) subjectTransferState.newName = event.target.value;
});
