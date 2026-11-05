// Studyroom module; loaded in order by index.html.
  function createExam() {
    let scope = examSetup.scope || "general",
      subject = db.subjects.find((s) => s.id === examSetup.subjectId),
      locked = scope !== "general";
    let context =
      scope === "topic"
        ? `Topic exam · ${subject?.name || ""} · ${examSetup.topic}`
        : scope === "subject"
          ? `Subject exam · ${subject?.name || ""}`
          : "Choose subject, topics, types, and exam length.";
    let subjectField = locked
      ? `<input type="hidden" name="subject" value="${esc(examSetup.subjectId || "")}"><div class="form-field full"><span>Subject</span><div class="scope-chip">${esc(subject?.name || "Choose a subject")}${scope === "topic" ? ` <span>› ${esc(examSetup.topic)}</span>` : ""}</div></div>`
      : `<div class="form-field full"><span id="exam-subject-label">Subject</span><div class="subject-picker" data-subject-picker><select class="subject-picker-native" name="subject" tabindex="-1" aria-hidden="true"><option value="">Choose a subject</option>${db.subjects.map((s) => `<option value="${s.id}" ${examSetup.subjectId === s.id ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select><button class="subject-picker-trigger" type="button" role="combobox" aria-required="true" aria-labelledby="exam-subject-label" aria-haspopup="listbox" aria-controls="exam-subject-options" aria-expanded="false"><span>${esc(subject?.name || "Choose a subject")}</span><i aria-hidden="true">⌄</i></button><div class="subject-picker-menu" id="exam-subject-options" role="listbox" aria-labelledby="exam-subject-label" hidden>${[{ id: "", name: "Choose a subject" }, ...db.subjects].map((s, i) => `<button type="button" class="subject-picker-option${(s.id || "") === (examSetup.subjectId || "") ? " is-selected" : ""}" role="option" data-value="${esc(s.id || "")}" aria-selected="${(s.id || "") === (examSetup.subjectId || "")}" id="exam-subject-option-${i}"><span>${esc(s.name)}</span><b aria-hidden="true">✓</b></button>`).join("")}</div></div></div>`;
    let countControl =
      scope === "subject"
        ? `<div id="exam-topic-choices" class="exam-topic-counts"><span class="page-sub">Choose topics and set a question count for each.</span></div>`
        : `<div class="form-field"><span>Exam size</span><input class="field" type="number" min="1" name="count" value="20"></div>`;
    return (
      pageHead(
        scope === "topic"
          ? "TOPIC EXAM"
          : scope === "subject"
            ? "SUBJECT EXAM"
            : "CUSTOM PRACTICE",
        scope === "topic"
          ? `Exam: ${examSetup.topic}`
          : scope === "subject"
            ? `Exam: ${subject?.name || "Subject"}`
            : "Create an exam",
        context,
        `<button class="btn" data-page="${scope === "topic" || scope === "subject" ? "subjects" : "exams"}">Cancel</button>`,
      ) +
      `<div class="panel exam-builder"><form id="exam-form" data-scope="${scope}"><div class="form-grid"><label class="form-field full">Exam name<input required class="field" name="name" value="${esc(scope === "topic" ? `${examSetup.topic} practice` : scope === "subject" ? `${subject?.name || "Subject"} practice` : "Practice exam")}"></label>${subjectField}<div class="form-field full ${scope === "topic" ? "hidden" : ""}" id="exam-topic-area"><span>${scope === "subject" ? "Question count by topic" : "Topics to include"}</span>${scope === "subject" ? countControl : `<div id="topic-choices" class="exam-topic-choices"><span class="page-sub">Choose a subject to load topics.</span></div>`}</div>${scope === "topic" || scope === "general" ? countControl : ""}<div class="form-field full exam-types-field"><span>Question types</span><div class="exam-types"><label class="exam-type-option"><input type="checkbox" name="qtype" value="mcq" checked><span>Multiple Choice</span></label><label class="exam-type-option"><input type="checkbox" name="qtype" value="tf" checked><span>True / False</span></label><label class="exam-type-option"><input type="checkbox" name="qtype" value="short"><span>Short Answer</span></label></div></div><label class="form-field exam-setting-field">Difficulty<select class="field" name="difficulty"><option value="all">Any difficulty</option><option value="New">New</option><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option></select></label><div class="form-field exam-setting-field"><span>Question selection</span><label class="exam-setting-option"><input type="checkbox" name="manual"><span>Choose questions manually</span></label></div><div class="form-field full manual-questions hidden" id="manual-question-area"><span>Available questions</span><div id="manual-question-list"></div></div><div class="exam-options form-field full"><label class="exam-setting-option"><input type="checkbox" name="randomize" checked><span>Randomize question order</span></label><label class="exam-setting-option"><input type="checkbox" name="shuffleChoices"><span>Randomize answer choices</span></label><label class="exam-setting-option"><input type="checkbox" name="allQuestions"><span>Include all eligible questions</span></label></div><label class="form-field">Time limit in minutes<input type="number" min="1" class="field" name="minutes" placeholder="No limit"></label><label class="form-field">Passing score (%)<input type="number" min="1" max="100" class="field" name="pass" placeholder="No pass mark"></label><label class="form-field full">Instructions<textarea class="field" name="instructions" placeholder="Optional note before you begin"></textarea></label></div><div id="exam-availability" class="exam-availability"></div><div class="modal-actions"><button class="btn primary" type="submit">Generate exam →</button></div></form></div>`
    );
  }
