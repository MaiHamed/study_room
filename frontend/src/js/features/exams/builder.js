// Studyroom module; loaded in order by index.html.
  function eligibleExamQuestion(q, types, difficultyLevel) {
    return (
      q.correct !== null &&
      q.correct !== undefined &&
      types.includes(q.type) &&
      (difficultyLevel === "all" || difficulty(q) === difficultyLevel)
    );
  }
  function getExamTopics() {
    if (examSetup.scope === "topic") return [examSetup.topic];
    return $$(".exam-topic-choice:checked").map((x) => x.value);
  }
  function examCandidates() {
    let form = $("#exam-form");
    if (!form) return [];
    let sid = form.elements.subject?.value || examSetup.subjectId,
      topics = getExamTopics(),
      types = $$("input[name=qtype]:checked", form).map((x) => x.value),
      level = form.elements.difficulty?.value || "all";
    return db.questions.filter((q) => {
      let inTopic =
        examSetup.scope === "topic"
          ? q.topic === examSetup.topic
          : topics.length
            ? topics.includes(q.topic)
            : examSetup.scope === "subject"
              ? false
              : q.topic === "";
      return (
        q.subjectId === sid && inTopic && eligibleExamQuestion(q, types, level)
      );
    });
  }
  function updateExamTopicChoices(subjectId) {
    let subject = db.subjects.find((s) => s.id === subjectId),
      box = $("#topic-choices"),
      counts = $("#exam-topic-choices");
    if (box) {
      box.innerHTML =
        subject && topicList(subject).length
          ? topicList(subject)
              .map(
                (t) =>
                  `<label class="exam-topic-chip"><input type="checkbox" class="exam-topic-choice" value="${esc(t)}" checked> ${esc(t)}</label>`,
              )
              .join("")
          : `<span class="page-sub">This subject has no topics. Questions without a topic remain available in custom practice.</span>`;
    }
    if (counts) {
      counts.innerHTML =
        subject && topicList(subject).length
          ? topicList(subject)
              .map((t) => {
                let available = db.questions.filter(
                  (q) =>
                    topicMatches(q, subject, t) &&
                    q.correct !== null &&
                    q.correct !== undefined,
                ).length;
                return `<label class="exam-topic-count-row"><input type="checkbox" class="exam-topic-choice" value="${esc(t)}" checked><span>${esc(t)} <small>${available} available</small></span><input class="field topic-count-input" type="number" min="1" max="${Math.max(1, available)}" name="topicCount" data-topic="${esc(t)}" value="${Math.min(5, available) || 1}" aria-label="Questions from ${esc(t)}"></label>`;
              })
              .join("")
          : `<span class="page-sub">Add topics and questions before setting up a subject exam.</span>`;
    }
    updateExamAvailability();
  }
  function refreshExamBuilder() {
    let form = $("#exam-form");
    if (!form) return;
    if (examSetup.scope === "general" && form.elements.subject.value)
      updateExamTopicChoices(form.elements.subject.value);
    else if (examSetup.scope === "subject")
      updateExamTopicChoices(examSetup.subjectId);
    updateExamAvailability();
  }
  function updateExamAvailability() {
    let form = $("#exam-form"),
      box = $("#exam-availability");
    if (!form || !box) return;
    let pool = examCandidates(),
      scope = examSetup.scope,
      all = form.elements.allQuestions?.checked,
      amount =
        scope === "subject"
          ? $$(".exam-topic-count-row")
              .filter((x) => $(".exam-topic-choice", x)?.checked)
              .reduce(
                (n, row) =>
                  n +
                  (all
                    ? db.questions.filter(
                        (q) =>
                          q.subjectId === examSetup.subjectId &&
                          topicMatches(
                            q,
                            db.subjects.find(
                              (s) => s.id === examSetup.subjectId,
                            ),
                            row.querySelector("[name=topicCount]").dataset
                              .topic,
                          ) &&
                          eligibleExamQuestion(
                            q,
                            $$("input[name=qtype]:checked", form).map(
                              (x) => x.value,
                            ),
                            form.elements.difficulty.value,
                          ),
                      ).length
                    : +row.querySelector("[name=topicCount]").value || 0),
                0,
              )
          : all
            ? pool.length
            : +form.elements.count?.value || 20;
    let manual = form.elements.manual?.checked,
      selected = manual
        ? pool.filter((q) => examManualIds.has(q.id)).length
        : null;
    let typeCounts =
      ["mcq", "tf", "short"]
        .map(
          (type) =>
            `${pool.filter((q) => q.type === type).length} ${type === "mcq" ? "MCQ" : type === "tf" ? "True/False" : "short answer"}`,
        )
        .filter((x) => !x.startsWith("0 "))
        .join(" · ") || "No answerable questions";
    box.innerHTML = `<div><b>${pool.length}</b> eligible questions · ${typeCounts}</div><small>${manual ? `${selected} manually selected${selected < amount ? ` · choose ${amount - selected} more or lower the exam size` : ""}` : `Exam size: ${amount} questions`}${amount > pool.length && !manual ? " · Not enough questions for this size." : ""}</small>`;
    let list = $("#manual-question-list"),
      area = $("#manual-question-area");
    if (area) area.classList.toggle("hidden", !manual);
    if (list && manual)
      list.innerHTML = pool.length
        ? pool
            .map(
              (q) =>
                `<label class="manual-question"><input type="checkbox" class="manual-question-check" value="${q.id}" ${examManualIds.has(q.id) ? "checked" : ""}><span>${mathHtml(q.text)}</span><small>${q.type === "mcq" ? "MCQ" : q.type === "tf" ? "T/F" : "Short"} · ${esc(q.topic || "Unsorted")} · ${difficulty(q)}</small></label>`,
            )
            .join("")
        : `<span class="page-sub">No eligible questions in this selection.</span>`;
  }
  function generateConfiguredExam(form) {
    const f = new FormData(form),
      sid = f.get("subject"),
      types = f.getAll("qtype"),
      scope = examSetup.scope,
      level = f.get("difficulty") || "all",
      randomize = f.has("randomize"),
      manual = f.has("manual"),
      all = f.has("allQuestions"),
      shuffle = (a) =>
        a
          .map((x) => [Math.random(), x])
          .sort((x, y) => x[0] - y[0])
          .map((x) => x[1]),
      pool = examCandidates();
    if (!sid) {
      notify("Choose a subject first.");
      return;
    }
    if (!types.length) {
      notify("Select at least one question type.");
      return;
    }
    if (!pool.length) {
      notify(
        "No questions with answers match this subject, topic, type, and difficulty.",
      );
      return;
    }
    const pick = (items, count) => {
      let set = manual ? items.filter((q) => examManualIds.has(q.id)) : items;
      if (set.length < count) return null;
      if (manual || types.length < 2)
        return (randomize ? shuffle(set) : set).slice(0, count);
      let groupTypes = randomize ? shuffle(types) : types,
        groups = groupTypes.map((type) => {
          let group = set.filter((q) => q.type === type);
          return randomize ? shuffle(group) : group;
        }),
        out = [];
      while (out.length < count) {
        let moved = false;
        for (const group of groups) {
          if (group.length) {
            out.push(group.shift());
            moved = true;
            if (out.length === count) break;
          }
        }
        if (!moved) break;
      }
      return out.length === count ? out : null;
    };
    let picked = [],
      topicCounts = {};
    if (scope === "subject") {
      const subject = db.subjects.find((s) => s.id === sid),
        chosen = getExamTopics();
      if (!chosen.length) {
        notify("Select at least one topic for this subject exam.");
        return;
      }
      for (const topic of chosen) {
        const row = $$(".exam-topic-count-row").find(
            (x) => x.querySelector(".exam-topic-choice")?.value === topic,
          ),
          input = row?.querySelector("[name=topicCount]"),
          topicPool = pool.filter((q) => topicMatches(q, subject, topic)),
          selected = manual
            ? topicPool.filter((q) => examManualIds.has(q.id))
            : topicPool,
          n = manual
            ? all
              ? selected.length
              : +(input?.value || 0)
            : all
              ? topicPool.length
              : +(input?.value || 0);
        if (!n) {
          notify(`Enter a question count for ${topic}.`);
          return;
        }
        let slice = pick(selected, n);
        if (!slice) {
          notify(
            `${topic} has ${selected.length} selected eligible questions, but ${n} are requested.`,
          );
          return;
        }
        topicCounts[topic] = n;
        picked.push(...slice);
      }
    } else {
      const requested = manual
        ? all
          ? pool.filter((q) => examManualIds.has(q.id)).length
          : +f.get("count")
        : all
          ? pool.length
          : +f.get("count");
      if (!Number.isInteger(requested) || requested < 1) {
        notify("Enter a valid number of questions.");
        return;
      }
      let slice = pick(pool, requested);
      if (!slice) {
        notify(
          manual
            ? `Only ${pool.filter((q) => examManualIds.has(q.id)).length} questions are selected. Select more or reduce the exam size.`
            : `Only ${pool.length} eligible questions are available. Lower the question count or add more matching questions.`,
        );
        return;
      }
      picked = slice;
    }
    if (!picked.length) {
      notify("No questions were selected for this exam.");
      return;
    }
    if (scope === "subject" && randomize) picked = shuffle(picked);
    picked = picked.map((q) => {
      let snapshot = JSON.parse(JSON.stringify(q));
      if (f.has("shuffleChoices") && snapshot.type === "mcq") {
        let order = shuffle(snapshot.options.map((_, i) => i));
        snapshot.options = order.map((i) => q.options[i]);
        snapshot.correct = order.indexOf(q.correct);
      }
      return snapshot;
    });
    startAttempt(f.get("name").trim(), sid, picked, {
      scope,
      topicName: scope === "topic" ? examSetup.topic : null,
      topicCounts,
      minutes: +f.get("minutes") || null,
      pass: +f.get("pass") || null,
      instructions: f.get("instructions").trim(),
    });
  }
