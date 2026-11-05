// Studyroom module; loaded in order by index.html.
  function startAttempt(name, subjectId, questions, opts = {}) {
    resultTopicFilter = "";
    let a = {
      id: uid(),
      examId: opts.examId || null,
      name,
      subjectId,
      topicName: opts.topicName || null,
      scope: opts.scope || "general",
      topicCounts: opts.topicCounts || null,
      questions: questions.map((q) => JSON.parse(JSON.stringify(q))),
      answers: Array(questions.length).fill(null),
      marked: [],
      startedAt: new Date().toISOString(),
      minutes: opts.minutes || null,
      pass: opts.pass || null,
      instructions: opts.instructions || "",
      submittedAt: null,
      score: 0,
    };
    db.attempts.unshift(a);
    save();
    examRun = a.id;
    page = "run-exam";
    render();
  }
  function currentAttempt() {
    return db.attempts.find((a) => a.id === examRun);
  }
  function answerLabel(q, a) {
    if (a === null || a === undefined || a === "") return "No answer";
    return q.type === "mcq"
      ? q.options[a]
      : q.type === "tf"
        ? a
          ? "True"
          : "False"
        : String(a);
  }
  function isCorrect(q, answer) {
    if (answer === null || answer === undefined || answer === "") return false;
    if (q.type === "short")
      return (
        String(answer).trim().toLocaleLowerCase() ===
        String(q.correct ?? "")
          .trim()
          .toLocaleLowerCase()
      );
    return answer === q.correct;
  }
  function attemptScore(a) {
    return a.questions.reduce(
      (n, q, i) => n + (isCorrect(q, a.answers[i]) ? 1 : 0),
      0,
    );
  }
  function runExam() {
    let a = currentAttempt();
    if (!a) {
      page = "exams";
      return exams();
    }
    let i = a.current || 0,
      q = a.questions[i],
      val = a.answers[i];
    return `<div class="page-head"><div><div class="eyebrow">${esc(a.name)}</div><h1 class="page-title">Question ${i + 1} <span style="color:var(--muted);font:16px var(--sans)">of ${a.questions.length}</span></h1><p class="page-sub">${esc(subjectName(a.subjectId))}${a.instructions ? " · " + esc(a.instructions) : ""}</p></div><button class="btn" data-action="exam-submit">Submit exam</button></div><div class="progress" style="margin:-12px 0 17px"><i style="width:${((i + 1) / a.questions.length) * 100}%"></i></div><div class="exam-layout"><div class="panel exam-card"><span class="badge">${q.type === "mcq" ? "MULTIPLE CHOICE" : q.type === "tf" ? "TRUE / FALSE" : "SHORT ANSWER"}${q.topic ? " · " + esc(q.topic) : ""}</span><div class="exam-question">${mathHtml(q.text)}</div>${q.type === "mcq" ? q.options.map((o, j) => `<label class="answer-option ${val === j ? "selected" : ""}"><input type="radio" name="answer" value="${j}" ${val === j ? "checked" : ""}>${mathHtml(o)}</label>`).join("") : q.type === "tf" ? [true, false].map((x) => `<label class="answer-option ${val === x ? "selected" : ""}"><input type="radio" name="answer" value="${x}" ${val === x ? "checked" : ""}>${x ? "True" : "False"}</label>`).join("") : `<label class="form-field">Your answer<input class="field" name="answer-text" value="${esc(val || "")}" autocomplete="off"></label>`}<div class="exam-nav"><button class="btn" data-action="exam-prev" ${i === 0 ? "disabled" : ""}>← Previous</button><button class="btn" data-action="exam-mark">${a.marked.includes(i) ? "★ Marked" : "☆ Mark for review"}</button><button class="btn primary" data-action="exam-next">${i === a.questions.length - 1 ? "Finish" : "Next →"}</button></div></div><div class="panel exam-side"><div class="panel-head"><h2 class="panel-title" style="font-size:17px">Question map</h2></div><div class="q-grid">${a.questions.map((_, j) => `<button class="q-num ${j === i ? "current" : ""} ${a.answers[j] !== null ? "done" : ""}" data-action="exam-jump" data-index="${j}">${j + 1}${a.marked.includes(j) ? "★" : ""}</button>`).join("")}</div><p class="page-sub" style="margin-top:15px">${a.answers.filter((x) => x !== null).length} answered · ${a.questions.length - a.answers.filter((x) => x !== null).length} remaining</p>${a.minutes ? `<span class="badge warn" id="timer" data-start="${new Date(a.startedAt).getTime()}" data-minutes="${a.minutes}">⏱ ${a.minutes}:00</span>` : ""}</div></div>`;
  }
  function resultPage(a) {
    let indices = a.questions.map((q, i) => i);
    if (resultTopicFilter) {
      const subject = db.subjects.find((s) => s.id === a.subjectId);
      indices = indices.filter((i) =>
        topicMatches(a.questions[i], subject, resultTopicFilter),
      );
    }
    if (!indices.length) indices = a.questions.map((q, i) => i);
    const flagged = new Set(
      Array.isArray(a.reviewFlags)
        ? a.reviewFlags
        : Array.isArray(a.marked)
          ? a.marked
          : [],
    );
    const flaggedCount = indices.filter((i) => flagged.has(i)).length,
      unflaggedCount = indices.length - flaggedCount;
    let correct = indices.filter((i) =>
        isCorrect(a.questions[i], a.answers[i]),
      ).length,
      unanswered = indices.filter(
        (i) =>
          a.answers[i] === null ||
          a.answers[i] === undefined ||
          a.answers[i] === "",
      ).length,
      wrong = indices.length - correct - unanswered,
      pct = indices.length ? Math.round((correct / indices.length) * 100) : 0;
    const bookmarkIcon =
      '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 2.5h8v11l-4-2.7-4 2.7z"/></svg>';
    return `<div style="text-align:center;margin:10px 0 26px"><div class="eyebrow">${resultTopicFilter ? "TOPIC RESULT" : "ATTEMPT COMPLETE"}</div><h1 class="page-title" style="margin-bottom:20px">${esc(a.name)}</h1>${resultTopicFilter ? `<p class="page-sub">${esc(resultTopicFilter)} · ${indices.length} questions in this topic</p>` : ""}<div class="result-review-summary flag-summary"><div><b>${indices.length}</b><span>Total questions</span></div><div class="is-flagged"><b>${flaggedCount}</b><span>Marked for review</span></div><div><b>${unflaggedCount}</b><span>Not marked for review</span></div></div><div class="result-score" style="--score:${pct * 3.6}deg"><b>${pct}%</b></div><p class="page-sub" style="margin-top:13px">${correct} correct · ${wrong} incorrect · ${unanswered} unanswered${a.pass && !resultTopicFilter ? ` · ${pct >= a.pass ? "Passed" : "Passing score: " + a.pass + "%"}` : ""}</p><div class="actions" style="justify-content:center;margin-top:18px"><button class="btn" data-action="retake-all" data-id="${a.id}">Retake entire exam</button>${wrong ? `<button class="btn" data-action="retake-wrong" data-id="${a.id}">Retry incorrect only</button>` : ""}<button class="btn primary" data-page="exams">Exam history</button></div></div><div class="panel"><div class="panel-head"><h2 class="panel-title">Answer review</h2><button class="panel-link" data-action="review-only" data-id="${a.id}">STUDY ANSWERS</button></div><nav class="review-question-nav" aria-label="Flagged questions">${indices
      .map((i, n) => {
        let isFlagged = flagged.has(i);
        return `<a class="review-nav-item ${isFlagged ? "is-flagged" : "is-unflagged"}" href="#review-question-${i}" aria-label="Question ${n + 1}${isFlagged ? ": Marked for review" : ""}"><span>${n + 1}</span>${isFlagged ? `<i>${bookmarkIcon}</i>` : ""}</a>`;
      })
      .join("")}</nav>${indices
      .map((i) => {
        let q = a.questions[i],
          unanswered =
            a.answers[i] === null ||
            a.answers[i] === undefined ||
            a.answers[i] === "",
          ok = isCorrect(q, a.answers[i]),
          isFlagged = flagged.has(i);
        return `<article id="review-question-${i}" class="review-item review-question ${isFlagged ? "is-flagged" : "is-unflagged"}"><div class="review-status-row">${isFlagged ? `<span class="review-status is-flagged">${bookmarkIcon}Marked for Review</span>` : ""}<span class="badge ${ok ? "" : unanswered ? "warn" : "rose"}">${ok ? "Correct" : unanswered ? "Unanswered" : "Wrong"}</span></div><h4>${mathHtml(q.text)}</h4><p><b>Your answer:</b> ${mathHtml(answerLabel(q, a.answers[i]))}</p><p><b>Correct answer:</b> ${mathHtml(answerLabel(q, q.correct))}</p>${q.explanation ? `<p class="page-sub answer-explanation">${mathHtml(q.explanation)}</p>` : ""}</article>`;
      })
      .join("")}</div>`;
  }
  function resultLookup() {
    let a = db.attempts.find((a) => a.id === examRun);
    return a ? resultPage(a) : exams();
  }
  function studyCards() {
    if (!flashRun)
      return `<div class="panel empty">No active study session.<br><button class="btn primary" data-action="card-study">Start studying</button></div>`;
    let s = flashRun,
      c = db.cards.find((x) => x.id === s.ids[s.index]);
    if (!c)
      return `<div class="panel empty"><div class="empty-icon">✦</div>Session complete. ${s.rated} cards rated.<br><button class="btn primary" data-page="flashcards">Back to flashcards</button></div>`;
    return (
      pageHead(
        "FLASHCARD STUDY",
        `Card ${s.index + 1} of ${s.ids.length}`,
        `${subjectName(c.subjectId)}${c.topic ? " · " + c.topic : ""}`,
      ) +
      `<div class="panel flashcard" data-action="flip-card"><div class="flashcard-inner ${s.flipped ? "flashcard-back" : ""}">${esc(s.flipped ? c.back : c.front)}<div class="page-sub" style="margin-top:22px;font:11px var(--sans)">${s.flipped ? "Rate how well you knew this" : "Tap card or press Space to reveal"}</div></div></div>${s.flipped ? `<div class="flash-controls"><button class="rate again" data-action="rate" data-rating="again">Again</button><button class="rate hard" data-action="rate" data-rating="hard">Hard</button><button class="rate good" data-action="rate" data-rating="good">Good</button><button class="rate easy" data-action="rate" data-rating="easy">Easy</button></div>` : `<div class="flash-controls"><button class="btn" data-action="flip-card">Reveal answer · Space</button></div>`}<div class="progress"><i style="width:${(s.index / s.ids.length) * 100}%"></i></div>`
    );
  }
  function submitAttempt(a) {
    if (!a) return;
    const unanswered = a.answers.filter((x) => x === null).length;
    if (
      unanswered &&
      !confirm(
        `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}. Submit anyway?`,
      )
    )
      return;
    a.reviewFlags = [...(Array.isArray(a.marked) ? a.marked : [])];
    a.grades = a.questions.map((q, i) => ({
      awarded: isCorrect(q, a.answers[i]) ? 1 : 0,
      total: 1,
      gradedAt: new Date().toISOString(),
      source: "automatic",
    }));
    a.score = attemptScore(a);
    a.submittedAt = new Date().toISOString();
    a.duration = Math.max(
      0,
      Math.round((Date.now() - new Date(a.startedAt).getTime()) / 60000),
    );
    a.questions.forEach((q, i) => {
      if (a.answers[i] === null) return;
      let r =
        db.reviews[q.id] ||
        (db.reviews[q.id] = {
          wrong: 0,
          correct: 0,
          streak: 0,
          mastered: false,
          dismissed: false,
        });
      if (isCorrect(q, a.answers[i])) {
        r.correct++;
        r.streak++;
        if (r.streak >= 3) r.mastered = true;
      } else {
        r.wrong++;
        r.streak = 0;
        r.mastered = false;
        r.dismissed = false;
      }
    });
    touch();
    examRun = a.id;
    page = "result";
    render();
  }
