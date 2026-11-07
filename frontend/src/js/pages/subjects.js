// Studyroom module; loaded in order by index.html.
  function subjects() {
    return (
      pageHead(
        "YOUR LEARNING SPACES",
        "My subjects",
        "Choose a subject to explore its topics, materials, and progress.",
        `<button class="btn" data-action="subject-import"><i data-lucide="upload"></i> Import subject</button><button class="btn primary" data-action="subject-add">＋ New subject</button>`,
      ) +
      (db.subjects.length
        ? `<div class="grid subject-grid">${db.subjects
            .map((s, i) => {
              let qs = db.questions.filter((q) => q.subjectId === s.id),
                cards = db.cards.filter((c) => c.subjectId === s.id),
                attempts = db.attempts.filter(
                  (a) => a.submittedAt && a.subjectId === s.id,
                ),
                avg = attempts.length
                  ? Math.round(
                      attempts.reduce(
                        (n, a) => n + (a.score / a.questions.length) * 100,
                        0,
                      ) / attempts.length,
                    )
                  : null,
                studied = qs.filter(
                  (q) =>
                    (db.reviews[q.id]?.correct || 0) +
                      (db.reviews[q.id]?.wrong || 0) >
                    0,
                ).length;
              return `<article class="card subject-card subject-open" data-action="subject-open" data-id="${s.id}" style="--subject-accent:${esc(s.color || ["#8565b5", "#c08078", "#6486a5", "#bd9558"][i % 4])}"><div class="subject-art"><span>${esc(s.name.slice(0, 1).toUpperCase())}</span><div class="subject-card-actions"><button class="icon-btn" data-action="subject-export" data-id="${s.id}" title="Export subject" aria-label="Export ${esc(s.name)}"><i data-lucide="download"></i></button><button class="icon-btn" data-action="subject-edit" data-id="${s.id}" title="Edit subject">✎</button><button class="icon-btn" data-action="subject-delete" data-id="${s.id}" title="Delete subject">×</button></div></div><div class="subject-card-meta"><span>${topicList(s).length} topics</span><span>${qs.length} questions</span></div><h3>${esc(s.name)}</h3><p>${esc(s.description || "A space for your study materials.")}</p><div class="subject-progress"><div class="progress"><i style="width:${qs.length ? Math.round((studied / qs.length) * 100) : 0}%"></i></div><small>${qs.length ? Math.round((studied / qs.length) * 100) : 0}% questions practiced</small></div><div class="subject-foot"><span>${cards.length} flashcards</span><span>${avg === null ? "No exams" : `${avg}% exam average`}</span></div><button class="subject-open-link" data-action="subject-open" data-id="${s.id}">Open subject <span>→</span></button></article>`;
            })
            .join("")}</div>`
        : `<div class="panel empty"><div class="empty-icon">▦</div>No subjects yet. Add your first subject to organize study materials.</div>`)
    );
  }
  function topicAttemptStats(subject, topic) {
    return db.attempts
      .filter((a) => a.submittedAt && a.subjectId === subject.id)
      .map((a) => {
        let items = a.questions
          .map((q, i) => ({ q, i }))
          .filter(({ q }) => topicMatches(q, subject, topic));
        if (!items.length) return null;
        let correct = items.filter(({ q, i }) =>
          isCorrect(q, a.answers[i]),
        ).length;
        return {
          attempt: a,
          score: Math.round((correct / items.length) * 100),
          count: items.length,
        };
      })
      .filter(Boolean);
  }
  function topicProgress(subject, topic) {
    let qs = db.questions.filter((q) => topicMatches(q, subject, topic));
    let studied = qs.filter((q) => {
      let r = db.reviews[q.id] || {};
      return (r.correct || 0) + (r.wrong || 0) > 0;
    }).length;
    return qs.length ? Math.round((studied / qs.length) * 100) : 0;
  }
  function breadcrumbs(s, topic = "") {
    return `<div class="breadcrumbs"><button data-page="subjects">My Subjects</button><span>›</span><button data-action="subject-open" data-id="${s.id}">${esc(s.name)}</button>${topic ? `<span>›</span><b>${esc(topic)}</b>` : ""}</div>`;
  }
  function subjectDetail() {
    let s = db.subjects.find((x) => x.id === subjectViewId);
    if (!s) {
      page = "subjects";
      return subjects();
    }
    let qs = db.questions.filter((q) => q.subjectId === s.id),
      cards = db.cards.filter((c) => c.subjectId === s.id),
      attempts = db.attempts.filter(
        (a) => a.submittedAt && a.subjectId === s.id,
      ),
      avg = attempts.length
        ? Math.round(
            attempts.reduce(
              (n, a) => n + (a.score / a.questions.length) * 100,
              0,
            ) / attempts.length,
          )
        : null;
    let buttons = `<button class="btn" data-action="topic-add" data-id="${s.id}">＋ Add topic</button><button class="btn primary" data-action="subject-exam" data-id="${s.id}">Take subject exam →</button>`;
    return (
      pageHead(
        "SUBJECT OVERVIEW",
        s.name,
        s.description || "Explore topics, materials, and your progress.",
        buttons,
      ) +
      breadcrumbs(s) +
      `<div class="grid stats-grid">${stat("Topics", topicList(s).length, "Organized in this subject", "▦")}${stat("Questions", qs.length, "In this subject", "☷")}${stat("Flashcards", cards.length, "Across all topics", "▱")}${stat("Exam average", avg === null ? "—" : avg + "%", `${attempts.length} attempts`, "◌")}</div><div class="panel topic-section"><div class="panel-head"><div><h2 class="panel-title">Topics</h2><p class="page-sub">Each topic has its own question bank, cards, and exam history.</p></div><button class="panel-link" data-action="topic-add" data-id="${s.id}">＋ ADD TOPIC</button></div>${
        topicList(s).length
          ? `<div class="grid topic-grid">${topicList(s)
              .map((t, i) => {
                let tq = db.questions.filter((q) => topicMatches(q, s, t)),
                  tc = db.cards.filter(
                    (c) => c.subjectId === s.id && c.topic === t,
                  ),
                  ta = topicAttemptStats(s, t),
                  latest = ta[0],
                  progress = topicProgress(s, t);
                return `<article class="card topic-card" data-action="topic-open" data-topic="${esc(t)}"><div class="topic-card-top"><span class="topic-number">${String(i + 1).padStart(2, "0")}</span><div class="topic-order"><button class="icon-btn" data-action="topic-up" data-topic="${esc(t)}" data-id="${s.id}" ${i === 0 ? "disabled" : ""} aria-label="Move topic up">↑</button><button class="icon-btn" data-action="topic-down" data-topic="${esc(t)}" data-id="${s.id}" ${i === topicList(s).length - 1 ? "disabled" : ""} aria-label="Move topic down">↓</button></div></div><button class="topic-open-title" data-action="topic-open" data-topic="${esc(t)}">${esc(t)} <span>↗</span></button><p>${esc(s.topicDescriptions?.[t] || "Study questions and flashcards for this topic.")}</p><div class="topic-metrics"><span><b>${tq.length}</b> Questions</span><span><b>${tc.length}</b> Cards</span><span><b>${ta.length}</b> Exams</span></div><div class="progress"><i style="width:${progress}%"></i></div><div class="topic-card-foot"><small>${progress}% practiced · ${latest ? `Latest ${latest.score}%` : "No exam yet"}</small><span><button class="icon-btn" data-action="topic-edit" data-id="${s.id}" data-topic="${esc(t)}" title="Edit topic">✎</button><button class="icon-btn" data-action="topic-delete" data-id="${s.id}" data-topic="${esc(t)}" title="Delete topic">×</button></span></div></article>`;
              })
              .join("")}</div>`
          : `<div class="empty">No topics yet. Add a topic to start organizing this subject.</div>`
      }</div><div class="panel subject-history"><div class="panel-head"><h2 class="panel-title">Recent subject exams</h2><button class="panel-link" data-page="exams">ALL EXAMS →</button></div>${
        attempts.length
          ? attempts
              .slice(0, 5)
              .map(
                (a) =>
                  `<div class="activity-row"><span class="dot"></span><div class="row-main"><b>${esc(a.name)}</b><small>${fmtDate(a.submittedAt)} · ${a.topicName ? esc(a.topicName) : "Subject-wide"} · ${a.questions.length} questions</small></div><span class="row-meta">${Math.round((a.score / a.questions.length) * 100)}%</span></div>`,
              )
              .join("")
          : `<div class="empty">No completed exams for this subject yet.</div>`
      }</div>`
    );
  }
  function topicDetail() {
    let s = db.subjects.find((x) => x.id === subjectViewId),
      t = topicViewName;
    if (!s || !topicList(s).includes(t)) {
      page = "subjects";
      return subjects();
    }
    let qs = db.questions.filter((q) => topicMatches(q, s, t)),
      cards = db.cards.filter((c) => c.subjectId === s.id && c.topic === t),
      attempts = topicAttemptStats(s, t),
      avg = attempts.length
        ? Math.round(
            attempts.reduce((n, x) => n + x.score, 0) / attempts.length,
          )
        : null,
      latest = attempts[0],
      filtered = qs.filter(
        (q) => topicQuestionFilter === "all" || q.type === topicQuestionFilter,
      );
    return (
      pageHead(
        "TOPIC STUDY SPACE",
        t,
        s.topicDescriptions?.[t] ||
          `Questions, flashcards, and exam results for ${t}.`,
        `<button class="btn" data-action="topic-study-all" data-id="${s.id}" data-topic="${esc(t)}">Study flashcards</button><button class="btn primary" data-action="topic-exam" data-id="${s.id}" data-topic="${esc(t)}">Take Exam →</button>`,
      ) +
      breadcrumbs(s, t) +
      `<div class="grid stats-grid">${stat("Questions", qs.length, "In this topic", "☷")}${stat("Flashcards", cards.length, "Ready to study", "▱")}${stat("Exams", attempts.length, "Containing this topic", "▤")}${stat("Average score", avg === null ? "—" : avg + "%", latest ? `Latest ${latest.score}%` : "No exam yet", "◌")}</div><div class="grid dashboard-grid topic-materials"><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Question bank</h2><p class="page-sub">Only questions assigned to ${esc(t)}.</p></div><button class="btn small" data-action="topic-question-add" data-id="${s.id}" data-topic="${esc(t)}">＋ Add question</button></div><div class="toolbar topic-filter"><select id="topic-question-filter" class="field select"><option value="all">All question types</option><option value="mcq" ${topicQuestionFilter === "mcq" ? "selected" : ""}>Multiple choice</option><option value="tf" ${topicQuestionFilter === "tf" ? "selected" : ""}>True / False</option><option value="short" ${topicQuestionFilter === "short" ? "selected" : ""}>Short answer</option></select></div>${filtered.length ? `<div class="topic-question-list">${filtered.map(questionCard).join("")}</div>` : `<div class="empty">No ${topicQuestionFilter === "all" ? "" : "matching "}questions in this topic yet.</div>`}</div><div class="panel"><div class="panel-head"><div><h2 class="panel-title">Flashcards</h2><p class="page-sub">${cards.length} cards in this topic.</p></div><button class="btn small" data-action="topic-card-add" data-id="${s.id}" data-topic="${esc(t)}">＋ Add</button></div><div class="topic-card-actions"><button class="btn small" data-action="topic-study-all" data-id="${s.id}" data-topic="${esc(t)}">Study whole deck</button><button class="btn small" data-action="topic-study-selected" data-id="${s.id}" data-topic="${esc(t)}">Study selected</button></div><div class="topic-flashcards">${cards.length ? cards.map((c) => `<div class="topic-flashcard"><label><input type="checkbox" class="topic-card-select" value="${c.id}"><span>${esc(c.front)}</span></label><button class="icon-btn" data-action="card-edit" data-id="${c.id}" title="Edit">✎</button></div>`).join("") : `<div class="empty">No flashcards for this topic yet.</div>`}</div></div></div><div class="panel subject-history"><div class="panel-head"><h2 class="panel-title">Topic exam history</h2><span class="page-sub">Scores count only questions from this topic.</span></div>${
        attempts.length
          ? attempts
              .slice()
              .reverse()
              .map(
                (x) =>
                  `<div class="activity-row"><span class="dot"></span><div class="row-main"><b>${esc(x.attempt.name)}</b><small>${fmtDate(x.attempt.submittedAt)} · ${x.count} topic questions${x.attempt.topicName ? ` · Topic exam` : " · Subject exam"}</small></div><span class="row-meta">${x.score}%</span><button class="btn small" data-action="result-view" data-id="${x.attempt.id}" data-topic="${esc(t)}">Review</button></div>`,
              )
              .join("")
          : `<div class="empty">No exam attempts include this topic yet.</div>`
      }</div>`
    );
  }
