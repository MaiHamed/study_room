// Studyroom action handlers.
function handleContentAction(el, ev, act, id) {
    if (act === "subject-open") {
      subjectViewId = id;
      page = "subject-detail";
      render();
      return;
    }
    if (act === "topic-open") {
      subjectViewId = id || subjectViewId;
      topicViewName = el.dataset.topic;
      topicQuestionFilter = "all";
      page = "topic-detail";
      render();
      return;
    }
    if (act === "subject-exam") {
      examSetup = { scope: "subject", subjectId: id, topic: "" };
      page = "create-exam";
      render();
      return;
    }
    if (act === "topic-exam") {
      examSetup = { scope: "topic", subjectId: id, topic: el.dataset.topic };
      page = "create-exam";
      render();
      return;
    }
    if (act === "topic-add") {
      showModal("Add a topic", topicForm());
      $("#modal-form").dataset.subject = id;
      return;
    }
    if (act === "topic-edit") {
      let s = db.subjects.find((x) => x.id === id),
        t = el.dataset.topic;
      showModal("Edit topic", topicForm(t, s?.topicDescriptions?.[t] || ""));
      $("#modal-form").dataset.subject = id;
      $("#modal-form").dataset.oldTopic = t;
      return;
    }
    if (act === "topic-delete") {
      let s = db.subjects.find((x) => x.id === id),
        t = el.dataset.topic;
      if (
        confirm(
          `Delete “${t}”? Its questions and flashcards will move to Unsorted. Past exam attempts remain saved.`,
        )
      ) {
        s.topics = s.topics.filter((x) => x !== t);
        if (s.topicDescriptions) delete s.topicDescriptions[t];
        db.questions.forEach((q) => {
          if (q.subjectId === id && q.topic === t) q.topic = "";
        });
        db.cards.forEach((c) => {
          if (c.subjectId === id && c.topic === t) c.topic = "";
        });
        save();
        render();
      }
      return;
    }
    if (act === "topic-up" || act === "topic-down") {
      let s = db.subjects.find((x) => x.id === id),
        i = s?.topics.indexOf(el.dataset.topic),
        j = i + (act === "topic-up" ? -1 : 1);
      if (s && j >= 0 && j < s.topics.length) {
        [s.topics[i], s.topics[j]] = [s.topics[j], s.topics[i]];
        save();
        render();
      }
      return;
    }
    if (act === "topic-question-add") {
      showModal(
        "Add a question",
        questionForm({
          type: "mcq",
          options: ["", "", "", ""],
          correct: 0,
          subjectId: id,
          topic: el.dataset.topic,
        }),
      );
      return;
    }
    if (act === "topic-card-add") {
      showModal(
        "Create a flashcard",
        cardForm({ subjectId: id, topic: el.dataset.topic }),
      );
      return;
    }
    if (act === "topic-study-all" || act === "topic-study-selected") {
      let ids =
        act === "topic-study-all"
          ? db.cards
              .filter((c) => c.subjectId === id && c.topic === el.dataset.topic)
              .map((c) => c.id)
          : $$(".topic-card-select:checked").map((x) => x.value);
      if (!ids.length) {
        notify("Select or add flashcards for this topic first.");
        return;
      }
      flashRun = { ids, index: 0, flipped: false, rated: 0 };
      page = "study-cards";
      render();
      return;
    }
    if (act === "subject-add") {
      showModal("Create a subject", subjectForm());
      return;
    }
    if (act === "subject-edit") {
      let s = db.subjects.find((x) => x.id === id);
      showModal("Edit subject", subjectForm(s));
      $("#modal-form").dataset.edit = id;
      return;
    }
    if (act === "subject-delete") {
      if (
        confirm(
          "Delete this subject? Its questions and cards will be kept and moved to Unsorted.",
        )
      ) {
        db.subjects = db.subjects.filter((s) => s.id !== id);
        db.questions.forEach((q) => {
          if (q.subjectId === id) q.subjectId = "";
        });
        db.cards.forEach((c) => {
          if (c.subjectId === id) c.subjectId = "";
        });
        save();
        render();
      }
      return;
    }
    if (act === "question-add") {
      showModal("Add a question", questionForm());
      return;
    }
    if (act === "question-edit") {
      let q = db.questions.find((x) => x.id === id);
      showModal("Edit question", questionForm(q));
      $("#modal-form").dataset.edit = id;
      return;
    }
    if (act === "question-duplicate") {
      let q = db.questions.find((x) => x.id === id);
      db.questions.push({
        ...JSON.parse(JSON.stringify(q)),
        id: uid(),
        text: q.text + " (copy)",
      });
      save();
      render();
      notify("Question duplicated.");
      return;
    }
    if (act === "question-delete") {
      showDeleteDialog("questions", [id]);
      return;
    }
    if (act === "card-add") {
      showModal("Create a flashcard", cardForm());
      return;
    }
    if (act === "card-edit") {
      let c = db.cards.find((x) => x.id === id);
      showModal("Edit flashcard", cardForm(c));
      $("#modal-form").dataset.edit = id;
      return;
    }
    if (act === "card-delete") {
      if (confirm("Delete this flashcard?")) {
        db.cards = db.cards.filter((c) => c.id !== id);
        save();
        render();
      }
      return;
    }
}
