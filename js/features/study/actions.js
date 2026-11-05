// Studyroom action handlers.
function handleStudyAction(el, ev, act, id) {
    if (act === "card-study") {
      let due = db.cards.filter((c) => !c.due || c.due <= today());
      if (!due.length) {
        notify(
          db.cards.length
            ? "You’re all caught up."
            : "Add a flashcard to start studying.",
        );
        return;
      }
      flashRun = {
        ids: due.map((c) => c.id),
        index: 0,
        flipped: false,
        rated: 0,
      };
      page = "study-cards";
      render();
      return;
    }
    if (act === "smart-revision") {
      let ids = db.cards
        .filter((c) => ["again", "hard"].includes(c.lastRating))
        .map((c) => c.id);
      db.questions
        .filter((q) => {
          let r = db.reviews[q.id] || {};
          return r.wrong > 0 && !r.mastered && !r.dismissed;
        })
        .forEach((q) => {
          let c = db.cards.find((x) => x.sourceQuestionId === q.id);
          if (!c) {
            c = {
              id: uid(),
              front: q.text,
              back:
                answerLabel(q, q.correct) +
                (q.explanation ? " — " + q.explanation : ""),
              subjectId: q.subjectId,
              topic: q.topic,
              sourceQuestionId: q.id,
              due: today(),
              interval: 0,
              generatedForRevision: true,
            };
            db.cards.push(c);
          }
          if (!ids.includes(c.id)) ids.push(c.id);
        });
      if (!ids.length) {
        notify(
          "Nothing to revise yet. Missed questions and Again or Hard cards will collect here.",
        );
        return;
      }
      save();
      flashRun = { ids, index: 0, flipped: false, rated: 0 };
      page = "study-cards";
      render();
      return;
    }
    if (act === "flip-card") {
      if (flashRun) {
        flashRun.flipped = !flashRun.flipped;
        render();
      }
      return;
    }
    if (act === "rate") {
      if (!flashRun) return;
      let c = db.cards.find((x) => x.id === flashRun.ids[flashRun.index]);
      let rates = {
          again: [0, 10],
          hard: [1, 25],
          good: [3, 65],
          easy: [7, 90],
        },
        [days, score] = rates[el.dataset.rating];
      c.interval = Math.max(
        days,
        Math.round(
          (c.interval || 0) *
            { again: 0.2, hard: 1.2, good: 2, easy: 3 }[el.dataset.rating],
        ),
      );
      c.due = new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
      c.lastRating = el.dataset.rating;
      c.lastScore = score;
      flashRun.index++;
      flashRun.flipped = false;
      flashRun.rated++;
      touch();
      page = "study-cards";
      render();
      return;
    }
    if (act === "mistake-master") {
      db.reviews[id].mastered = true;
      save();
      render();
      notify("Marked as mastered.");
      return;
    }
    if (act === "mistake-dismiss") {
      db.reviews[id].dismissed = true;
      save();
      render();
      return;
    }
    if (act === "mistake-practice") {
      let qs = db.questions.filter((q) => {
        let r = db.reviews[q.id] || {};
        return r.wrong && !r.mastered && !r.dismissed;
      });
      startAttempt("Mistake practice", qs[0]?.subjectId || "", qs);
      return;
    }
}
