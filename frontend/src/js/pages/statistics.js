// Studyroom module; loaded in order by index.html.
  function statistics() {
    let done = db.attempts.filter((a) => a.submittedAt),
      bySubject = db.subjects.map((s) => {
        let as = done.filter((a) => a.subjectId === s.id),
          pct = as.length
            ? Math.round(
                as.reduce(
                  (x, a) => x + (a.score / a.questions.length) * 100,
                  0,
                ) / as.length,
              )
            : 0;
        return [s.name, pct, as.length];
      });
    let total = Object.values(db.reviews).reduce(
        (a, r) => a + r.wrong + r.correct,
        0,
      ),
      wrong = Object.values(db.reviews).reduce((a, r) => a + r.wrong, 0);
    return (
      pageHead(
        "A CLEARER PICTURE",
        "Statistics",
        "Use your practice history to decide what to study next.",
      ) +
      `<div class="grid stats-grid">${stat("Exam average", metrics().avg + "%", `${done.length} completed exams`, "◌")}${stat("Questions answered", total, "Across all saved attempts", "☷")}${stat("Incorrect answers", wrong, `${total ? Math.round((wrong / total) * 100) : 0}% of tracked responses`, "↗")}${stat("Study streak", `${db.streak || 0} days`, "Keep your rhythm gentle", "✦")}</div><div class="grid dashboard-grid"><div class="panel"><div class="panel-head"><h2 class="panel-title">Performance by subject</h2></div>${bySubject.length ? bySubject.map(([name, pct, n]) => `<div class="bar-row"><span>${esc(name)}</span><div class="progress"><i style="width:${pct}%"></i></div><b>${n ? pct + "%" : "—"}</b></div>`).join("") : `<div class="empty">Add subjects and complete an exam to see performance here.</div>`}</div><div class="panel"><div class="panel-head"><h2 class="panel-title">Topics to revisit</h2></div>${
        db.questions
          .map((q) => ({ q, r: db.reviews[q.id] || { wrong: 0 } }))
          .filter((x) => x.r.wrong)
          .sort((a, b) => b.r.wrong - a.r.wrong)
          .slice(0, 5)
          .map(
            ({ q, r }) =>
              `<div class="activity-row"><span class="dot" style="background:#bf766d"></span><div class="row-main"><b>${mathHtml(q.text)}</b><small>${esc(subjectName(q.subjectId))}</small></div><span class="row-meta">${r.wrong}×</span></div>`,
          )
          .join("") ||
        `<div class="empty">Question patterns will appear after your first exam.</div>`
      }</div></div>`
    );
  }
