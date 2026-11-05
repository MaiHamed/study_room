// Studyroom module; loaded in order by index.html.
  document.addEventListener("submit", (e) => {
    if (e.target.id === "profile-form") {
      e.preventDefault();
      const form = e.target,
        values = new FormData(form),
        previous = db.profile || {};
      const next = {
        firstName: String(values.get("firstName") || "").trim(),
        lastName: String(values.get("lastName") || "").trim(),
        email: String(values.get("email") || "").trim(),
        photo:
          profilePhotoDraft === null ? previous.photo || "" : profilePhotoDraft,
      };
      if (
        !next.firstName ||
        (next.email && !form.elements.email.validity.valid)
      ) {
        notify(
          next.firstName
            ? "Enter a valid email address or leave the field blank."
            : "Enter a first name.",
        );
        return;
      }
      db.profile = next;
      try {
        save();
      } catch {
        db.profile = previous;
        notify(
          "Could not save your profile. The photo may be too large for browser storage.",
        );
        return;
      }
      profilePhotoDraft = null;
      page = "dashboard";
      render();
      notify("Profile changes saved.");
      return;
    }
    if (e.target.id === "modal-form") {
      e.preventDefault();
      let f = new FormData(e.target),
        edit = e.target.dataset.edit;
      if (e.target.querySelector("[name=topicName]")) {
        let s = db.subjects.find((x) => x.id === e.target.dataset.subject),
          old = e.target.dataset.oldTopic || "",
          name = f.get("topicName").trim(),
          description = f.get("topicDescription").trim();
        if (!s) {
          notify("Subject could not be found.");
          return;
        }
        s.topics = s.topics || [];
        if (!name) {
          notify("Enter a topic name.");
          return;
        }
        if (s.topics.includes(name) && name !== old) {
          notify("This topic already exists in the subject.");
          return;
        }
        if (old) {
          let i = s.topics.indexOf(old);
          if (i >= 0) s.topics[i] = name;
          s.topicDescriptions = s.topicDescriptions || {};
          delete s.topicDescriptions[old];
          if (description) s.topicDescriptions[name] = description;
          else delete s.topicDescriptions[name];
          s.topicAliases = s.topicAliases || [];
          s.topicAliases.forEach((x) => {
            if (x.to === old) x.to = name;
          });
          s.topicAliases.push({ from: old, to: name });
          db.questions.forEach((q) => {
            if (q.subjectId === s.id && q.topic === old) q.topic = name;
          });
          db.cards.forEach((c) => {
            if (c.subjectId === s.id && c.topic === old) c.topic = name;
          });
          db.attempts.forEach((a) => {
            if (a.subjectId === s.id && a.topicName === old) a.topicName = name;
          });
          if (topicViewName === old) topicViewName = name;
        } else {
          s.topics = s.topics || [];
          s.topics.push(name);
          s.topicDescriptions = s.topicDescriptions || {};
          if (description) s.topicDescriptions[name] = description;
        }
      } else if (e.target.querySelector("[name=topics]")) {
        let value = {
          name: f.get("name").trim(),
          description: f.get("description").trim(),
          color: f.get("color"),
          topics: [
            ...new Set(
              f
                .get("topics")
                .split(",")
                .map((x) => x.trim())
                .filter(Boolean),
            ),
          ],
        };
        if (edit) {
          let subject = db.subjects.find((s) => s.id === edit),
            removed = (subject.topics || []).filter(
              (t) => !value.topics.includes(t),
            );
          removed.forEach((t) => {
            db.questions.forEach((q) => {
              if (q.subjectId === edit && q.topic === t) q.topic = "";
            });
            db.cards.forEach((c) => {
              if (c.subjectId === edit && c.topic === t) c.topic = "";
            });
            if (subject.topicDescriptions) delete subject.topicDescriptions[t];
          });
          Object.assign(subject, value);
        } else db.subjects.push({ id: uid(), ...value });
      } else if (e.target.querySelector("[name=front]")) {
        let value = {
          front: f.get("front").trim(),
          back: f.get("back").trim(),
          subjectId: f.get("subjectId"),
          topic: f.get("topic").trim(),
        };
        if (edit)
          Object.assign(
            db.cards.find((c) => c.id === edit),
            value,
          );
        else db.cards.push({ id: uid(), ...value, due: today(), interval: 0 });
      } else {
        let type = f.get("type"),
          options =
            type === "mcq" ? f.getAll("option").map((x) => x.trim()) : [],
          correct =
            type === "mcq"
              ? f.has("correct")
                ? +f.get("correct")
                : null
              : type === "tf"
                ? f.get("tfcorrect") === ""
                  ? null
                  : f.get("tfcorrect") === "true"
                : f.get("shortcorrect").trim() || null;
        if (
          type === "mcq" &&
          (correct === null || !options.length || options.some((x) => !x))
        ) {
          notify("Fill in every answer option and select the correct one.");
          return;
        }
        let value = {
          text: f.get("text").trim(),
          type,
          subjectId: f.get("subjectId"),
          topic: f.get("topic").trim(),
          options,
          correct,
          explanation: f.get("explanation").trim(),
        };
        if (edit)
          Object.assign(
            db.questions.find((q) => q.id === edit),
            value,
          );
        else db.questions.push({ id: uid(), ...value });
      }
      save();
      modal = null;
      render();
      notify(edit ? "Changes saved." : "Added successfully.");
      return;
    }
    if (e.target.id === "exam-form") {
      e.preventDefault();
      generateConfiguredExam(e.target);
      return;
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.matches("#profile-photo")) {
      const file = e.target.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        notify("Choose an image file.");
        e.target.value = "";
        return;
      }
      if (file.size > 1.5 * 1024 * 1024) {
        notify("Choose an image smaller than 1.5 MB.");
        e.target.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        profilePhotoDraft = String(reader.result);
        $("#profile-photo-preview").innerHTML =
          `<img src="${profilePhotoDraft}" alt="Profile photo preview">`;
        $('[data-action="profile-remove-photo"]')?.removeAttribute("disabled");
      };
      reader.onerror = () => notify("Could not read that image.");
      reader.readAsDataURL(file);
    }
  });
  document.addEventListener("input", (e) => {
    if (
      e.target.closest("#exam-form") &&
      e.target.matches(
        "input[name=count],input[name=minutes],input[name=pass],input[name=topicCount],select[name=difficulty]",
      )
    )
      updateExamAvailability();
  });
  document.addEventListener("change", (e) => {
    if (e.target.matches("#import-type")) {
      importDraft.type = e.target.value;
      persistImportDraft();
    }
  });
  document.addEventListener("change", (e) => {
    if (e.target.matches("#modal-form input[name=correct]")) {
      const options = $$("#modal-form input[name=option]"),
        selected = options[+e.target.value]?.value || "",
        preview = $('[data-math-preview="selected-correct"]');
      if (preview) {
        updateMathPreview(preview, selected);
      }
    }
  });
  document.addEventListener("input", (e) => {
    if (e.target.matches("input[name=answer-text]")) {
      let a = currentAttempt();
      if (a) {
        a.answers[a.current || 0] = e.target.value || null;
        save();
      }
    }
  });
  document.addEventListener("dragstart", (e) => {
    let card = e.target.closest(".import-question");
    if (card) {
      e.dataTransfer.setData("text/plain", card.dataset.importIndex);
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("dragging");
    }
  });
  document.addEventListener("dragend", (e) =>
    e.target.closest(".import-question")?.classList.remove("dragging"),
  );
  document.addEventListener("dragover", (e) => {
    let card = e.target.closest(".import-question");
    if (card) {
      e.preventDefault();
      card.classList.add("drag-over");
    }
  });
  document.addEventListener("dragleave", (e) =>
    e.target.closest(".import-question")?.classList.remove("drag-over"),
  );
  document.addEventListener("drop", (e) => {
    let card = e.target.closest(".import-question");
    if (!card) return;
    e.preventDefault();
    let from = +e.dataTransfer.getData("text/plain"),
      to = +card.dataset.importIndex;
    if (from === to) return;
    let [item] = importDraft.questions.splice(from, 1);
    importDraft.questions.splice(to, 0, item);
    persistImportDraft();
    render();
  });
  document.addEventListener("keydown", (e) => {
    if (page === "study-cards" && flashRun) {
      if (e.code === "Space") {
        e.preventDefault();
        flashRun.flipped = true;
        render();
      }
      if (flashRun.flipped && ["1", "2", "3", "4"].includes(e.key)) {
        let key = ["again", "hard", "good", "easy"][+e.key - 1];
        $(`[data-action=rate][data-rating=${key}]`)?.click();
      }
    }
    if (page === "run-exam" && ["ArrowRight", "ArrowLeft"].includes(e.key)) {
      e.preventDefault();
      $(
        `[data-action=exam-${e.key === "ArrowRight" ? "next" : "prev"}]`,
      )?.click();
    }
  });
