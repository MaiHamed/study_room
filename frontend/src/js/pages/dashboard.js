// Studyroom module; loaded in order by index.html.
  function dashboard() {
    let m = metrics(),
      done = db.attempts.filter((a) => a.submittedAt),
      recent = done.slice(0, 4);
    return `${`<div class="welcome"><div><div class="eyebrow">A LITTLE PROGRESS ADDS UP</div><h1>Welcome to your studyroom.</h1><p>Your calm corner to learn, practice, and feel prepared.</p></div><button class="btn primary" data-page="create-exam">＋ Create an exam</button></div>`}<div class="grid stats-grid">${stat("Subjects", db.subjects.length, "Your learning spaces", "▦")}${stat("Questions", db.questions.length, "In your question bank", "☷")}${stat("Flashcards", db.cards.length, "Ready when you are", "▱")}${stat("Exam average", m.avg + "%", `${done.length} attempts completed`, "◌")}</div><div class="grid dashboard-grid"><div class="panel"><div class="panel-head"><h2 class="panel-title">Recent exams</h2><button class="panel-link" data-page="exams">VIEW ALL →</button></div>${recent.length ? recent.map((a) => `<div class="activity-row"><span class="dot" style="background:${a.score / a.questions.length >= 0.7 ? "#9479c6" : "#c5964b"}"></span><div class="row-main"><b>${esc(a.name)}</b><small>${fmtDate(a.submittedAt)} · ${a.questions.length} questions</small></div><div class="row-meta">${Math.round((a.score / a.questions.length) * 100)}%</div></div>`).join("") : `<div class="empty"><div class="empty-icon">◌</div>No exams yet. Your first practice session starts here.</div>`}</div><div class="panel"><div class="panel-head"><h2 class="panel-title">A quick next step</h2></div><div class="quick-grid"><button class="quick" data-page="questions"><span>✎</span><div><b>Add questions</b><small>Build your question bank</small></div></button><button class="quick" data-page="flashcards"><span>▱</span><div><b>Study cards</b><small>Review at your own pace</small></div></button><button class="quick" data-page="mistakes"><span>↗</span><div><b>Review weak spots</b><small>${mistakeCount()} questions to revisit</small></div></button></div></div></div><div class="grid dashboard-grid" style="margin-top:15px"><div class="panel"><div class="panel-head"><h2 class="panel-title">Your subjects</h2><button class="panel-link" data-page="subjects">EXPLORE →</button></div>${
      db.subjects.length
        ? db.subjects
            .slice(0, 4)
            .map(
              (s) =>
                `<div class="activity-row"><span class="dot"></span><div class="row-main"><b>${esc(s.name)}</b><small>${db.questions.filter((q) => q.subjectId === s.id).length} questions · ${db.cards.filter((c) => c.subjectId === s.id).length} cards</small></div><span class="row-meta">→</span></div>`,
            )
            .join("")
        : `<div class="empty">Your subjects will appear here when you create one.</div>`
    }</div><div class="panel"><div class="panel-head"><h2 class="panel-title">Ready for a reset?</h2></div><p class="page-sub" style="margin:0 0 17px">Short, steady practice makes a difference. Generate a balanced 20-question exam from the topics you choose.</p><button class="btn primary" data-page="create-exam">Set up a practice exam →</button></div></div>`;
  }
