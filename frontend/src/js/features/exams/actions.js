// Studyroom action handlers.
function handleExamAction(el, ev, act, id) {
    if (act === "exam-submit") {
      submitAttempt(currentAttempt());
      return;
    }
    if (act === "exam-next" || act === "exam-prev" || act === "exam-jump") {
      let a = currentAttempt();
      if (act === "exam-next") {
        if (a.current === a.questions.length - 1) {
          submitAttempt(a);
          return;
        }
        a.current = (a.current || 0) + 1;
      } else if (act === "exam-prev")
        a.current = Math.max(0, (a.current || 0) - 1);
      else a.current = +el.dataset.index;
      save();
      render();
      return;
    }
    if (act === "exam-mark") {
      let a = currentAttempt(),
        i = a.current || 0;
      a.marked.includes(i)
        ? (a.marked = a.marked.filter((x) => x !== i))
        : a.marked.push(i);
      save();
      render();
      return;
    }
    if (act === "result-view") {
      examRun = id;
      resultTopicFilter = el.dataset.topic || "";
      page = "result";
      render();
      return;
    }
    if (act === "retake-all") {
      let old = db.attempts.find((a) => a.id === id);
      startAttempt(old.name, old.subjectId, old.questions, {
        examId: old.examId,
        scope: old.scope,
        topicName: old.topicName,
        topicCounts: old.topicCounts,
        minutes: old.minutes,
        pass: old.pass,
        instructions: old.instructions,
      });
      return;
    }
    if (act === "retake-wrong") {
      let old = db.attempts.find((a) => a.id === id),
        subject = db.subjects.find((s) => s.id === old.subjectId),
        qs = old.questions.filter(
          (q, i) =>
            !isCorrect(q, old.answers[i]) &&
            (!resultTopicFilter || topicMatches(q, subject, resultTopicFilter)),
        );
      startAttempt(old.name + " · Incorrect questions", old.subjectId, qs, {
        pass: old.pass,
        scope: resultTopicFilter ? "topic" : old.scope,
        topicName: resultTopicFilter || old.topicName,
        topicCounts: old.topicCounts,
      });
      return;
    }
    if (act === "review-only") {
      let old = db.attempts.find((a) => a.id === id),
        subject = db.subjects.find((s) => s.id === old.subjectId),
        reviewQs = old.questions.filter(
          (q) =>
            !resultTopicFilter || topicMatches(q, subject, resultTopicFilter),
        );
      flashRun = {
        ids: reviewQs.map((q, i) => {
          let c = db.cards.find((c) => c.sourceQuestionId === q.id);
          if (c) return c.id;
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
          };
          db.cards.push(c);
          return c.id;
        }),
        index: 0,
        flipped: false,
        rated: 0,
      };
      save();
      page = "study-cards";
      render();
      return;
    }
}
