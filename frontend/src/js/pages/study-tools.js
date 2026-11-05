// Studyroom module; loaded in order by index.html.
  function cardsPage() {
    return (
      pageHead(
        "SMALL CARDS, STEADY PROGRESS",
        "Flashcards",
        "Review difficult cards sooner with simple spaced repetition.",
        `<button class="btn" data-action="smart-revision">Smart revision</button><button class="btn" data-action="card-study">Study due cards</button><button class="btn primary" data-action="card-add">＋ Add card</button>`,
      ) +
      `<div class="toolbar"><input class="search" id="card-search" placeholder="Search cards…"><span class="page-sub">${db.cards.filter((c) => !c.due || c.due <= today()).length} due now · ${db.cards.length} total</span></div>${db.cards.length ? `<div class="panel table-card">${db.cards.map((c) => `<div class="table-item" style="grid-template-columns:2fr 1fr 100px 100px"><div class="question-text">${esc(c.front)}</div><div>${esc(subjectName(c.subjectId))}</div><div><span class="badge">${esc(c.interval || 0)} day interval</span></div><div class="row-actions"><button class="icon-btn" data-action="card-edit" data-id="${c.id}">✎</button><button class="icon-btn" data-action="card-delete" data-id="${c.id}">×</button></div></div>`).join("")}</div>` : `<div class="panel empty">No cards yet. Add a card to start building your review deck.</div>`}`
    );
  }
  function mistakeCount() {
    return Object.entries(db.reviews).filter(
      ([id, r]) =>
        db.questions.some((q) => q.id === id) &&
        r.wrong > 0 &&
        !r.mastered &&
        !r.dismissed,
    ).length;
  }
  function mistakes() {
    let qs = db.questions
      .filter((q) => {
        let r = db.reviews[q.id] || {};
        return r.wrong > 0 && !r.mastered && !r.dismissed;
      })
      .sort(
        (a, b) =>
          (db.reviews[b.id]?.wrong || 0) - (db.reviews[a.id]?.wrong || 0),
      );
    return (
      pageHead(
        "LEARN FROM THE MISSES",
        "My mistakes",
        "Questions you’ve missed, with the original answer history kept intact.",
        qs.length
          ? `<button class="btn primary" data-action="mistake-practice">Practice ${qs.length} questions</button>`
          : "",
      ) +
      (qs.length
        ? `<div class="panel table-card">${qs
            .map((q) => {
              let r = db.reviews[q.id];
              return `<div class="table-item" style="grid-template-columns:2fr 1fr 100px 140px"><div class="question-text">${mathHtml(q.text)}</div><div>${esc(subjectName(q.subjectId))}</div><div><span class="badge rose">${r.wrong} ${r.wrong === 1 ? "miss" : "misses"}</span></div><div class="row-actions"><button class="icon-btn" data-action="mistake-master" data-id="${q.id}">✓ Master</button><button class="icon-btn" data-action="mistake-dismiss" data-id="${q.id}">×</button></div></div>`;
            })
            .join("")}</div>`
        : `<div class="panel empty"><div class="empty-icon">✦</div>No open mistakes. Keep going at your own pace.</div>`)
    );
  }
