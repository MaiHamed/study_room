// Studyroom module; loaded in order by index.html.
  function textHash(text) {
    let h = 2166136261;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0).toString(16);
  }
  function refreshImportWarnings(q, index) {
    q.warnings = q.warnings.filter(
      (w) =>
        !w.includes("Question text is missing") &&
        !w.includes("No correct answer was detected") &&
        !w.includes("fewer than two choices") &&
        !w.includes("choices are empty") &&
        !w.includes("may be a statement"),
    );
    if (!q.text.trim()) q.warnings.push("Question text is missing.");
    if (q.type === "mcq") {
      if (q.options.length < 2)
        q.warnings.push(
          "This multiple-choice question has fewer than two choices.",
        );
      if (q.options.some((x) => !x.trim()))
        q.warnings.push("One or more answer choices are empty.");
    }
    if (q.correct === null || q.correct === "")
      q.warnings.push(
        "No correct answer was detected. Confirm or add it before using this question in an exam.",
      );
    if (q.type === "short" && !/[?؟]$/.test(q.text.trim()) && !q.correct)
      q.warnings.push(
        "This may be a statement or an incompletely parsed question.",
      );
    let card = $(`[data-import-index="${index}"]`),
      warning = $(`[data-import-warning="${index}"]`);
    if (card) {
      card.classList.toggle("has-warning", q.warnings.length > 0);
      if (warning) {
        warning.style.display = q.warnings.length ? "" : "none";
        warning.innerHTML = q.warnings.length
          ? `⚑ ${q.warnings.map(esc).join(" · ")}`
          : "";
      }
    }
  }
  function parseBulkQuestions(raw) {
    const lines = raw.replace(/\r/g, "").split("\n"),
      segments = [],
      answerLines = [];
    let current = null,
      keyMode = false,
      blankBefore = false,
      currentSection = "main",
      lastQuestionNumber = null,
      numberingSet = 1;
    const add = (number, text) => {
      let value = (text || "").trim(),
        marker =
          /\(\s*(?:true\s*\/\s*false|true\s+or\s+false|t\s*\/\s*f)\s*\)/i;
      if (marker.test(value)) {
        value = value.replace(marker, "").trim();
        current = {
          number: number ? String(number) : "",
          section: currentSection,
          text: value,
          prompt: value,
          unlabeled: [],
          options: [],
          labels: [],
          correct: null,
          explanation: "",
          explanationSections: [],
          type: "tf",
          warnings: [],
          selected: true,
        };
      } else
        current = {
          number: number ? String(number) : "",
          section: currentSection,
          text: value,
          prompt: value,
          unlabeled: [],
          options: [],
          labels: [],
          correct: null,
          explanation: "",
          explanationSections: [],
          type: "short",
          warnings: [],
          selected: true,
        };
      segments.push(current);
    };
    const addExplanation = (label, text) => {
      const canonical = label
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
      current.explanationSections.push({
        label: canonical,
        text: (text || "").trim(),
      });
      current.activeExplanation = current.explanationSections.length - 1;
      current.inExplanation = true;
    };
    const startMatch = (line) => {
      let m = line.match(
        /^\s*(?:\*\*)?(?:(?:question|q)\s*)?(\d{1,3})\s*\\?[.)\]:-]\s*(?:\*\*)?\s*(.*)$/i,
      );
      if (!m) m = line.match(/^\s*(?:question|q)\s*(\d{1,3})\s+(.*)$/i);
      if (!m)
        m = line.match(
          /^\s*(i{1,3}|iv|v(?:i{1,3})?|viii|ix|x)\s*[.)\]:-]\s*(.*)$/i,
        );
      return m;
    };
    const optionMatch = (line) =>
      line.match(
        /^\s*(?:[-*•]\s*)?(?:\(([A-H])\)|([A-H])\s*[).:-])\s*(.*?)\s*$/i,
      );
    for (let rawLine of lines) {
      // Pasted Markdown often uses a trailing backslash as a hard line break.
      // Remove it before matching options so it cannot join the next choice.
      let line = rawLine.trim().replace(/\\+$/, "").trim();
      if (!line) {
        blankBefore = true;
        continue;
      }
      if (
        /^(?:answer\s*key|answers|correct\s*answers|solutions)\s*:??\s*$/i.test(
          line,
        )
      ) {
        keyMode = true;
        blankBefore = false;
        continue;
      }
      if (keyMode) {
        answerLines.push(line);
        continue;
      }
      const heading = line.replace(/^#+\s*/, "").trim();
      const section = heading.match(/^part\s*(\d+)\s*:/i);
      if (section) currentSection = `part-${section[1]}`;
      if (
        /^(?:page\s*)?\d{1,4}(?:\s*(?:of|\/)\s*\d{1,4})?$/i.test(heading) ||
        /^(?:exam|practice questions?|multiple choice questions?|submit (?:mcq|multiple choice) answers|part\s*\d+\s*[:—-]?\s*(?:true\s*(?:or|and|\/)\s*false|mcq|multiple choice)(?:\s*\(\d+\))?|your true or false test|\d+\s*\/\s*\d+\s*answered)$/i.test(
          heading,
        )
      ) {
        blankBefore = false;
        continue;
      }
      let numbered = startMatch(line);
      if (numbered) {
        const number = Number(numbered[1]),
          numberingRestart = number === 1 && lastQuestionNumber > 1,
          explicitQuestion = /^\s*(?:\*\*)?(?:question|q)\s*\d/i.test(line),
          explanationSubsection =
            current?.inExplanation &&
            !numberingRestart &&
            !explicitQuestion &&
            Number.isFinite(+numbered[1]) &&
            Number.isFinite(+current.number) &&
            +numbered[1] <= +current.number;
        if (explanationSubsection) {
          let section = current.explanationSections[current.activeExplanation];
          if (section) section.text += (section.text ? " " : "") + line;
          blankBefore = false;
          continue;
        }
        if (numberingRestart) {
          numberingSet++;
          currentSection = `${currentSection}-set-${numberingSet}`;
        }
        add(numbered[1], numbered[2]);
        lastQuestionNumber = number;
        blankBefore = false;
        continue;
      }
      let keyInline = line.match(
        /^(?:answer\s*key|answers|correct\s+answers)\s*:\s*(.+)$/i,
      );
      if (keyInline) {
        keyMode = true;
        answerLines.push(keyInline[1]);
        continue;
      }
      if (!current) {
        add("", line);
        blankBefore = false;
        continue;
      }
      let tfAnswerLine = line.match(
        /^\s*(?:\*\*)?(?:(?:correct(?:\s+answer)?|answer)\s*(?::|is)\s*)?(true|false|t|f)(?:\s*[.!])?(?:\*\*)?\s*(.*)$/i,
      );
      if (
        tfAnswerLine &&
        !/^(?:or|\/)\s*(?:true|false)\b/i.test(tfAnswerLine[2])
      ) {
        current.type = "tf";
        current.answerDeclarations = current.answerDeclarations || [];
        current.answerDeclarations.push(tfAnswerLine[1]);
        current.inlineAnswer = tfAnswerLine[1];
        current.inExplanation = false;
        if (tfAnswerLine[2].trim())
          addExplanation("Explanation", tfAnswerLine[2]);
        blankBefore = false;
        continue;
      }
      let boldInlineAnswer = line.match(
        /^\s*\*\*\s*(?:correct(?:\s+answer)?|answer)\s*(?::|is)\s*(.*?)\s*\*\*\s*(.*)$/i,
      );
      if (boldInlineAnswer) {
        current.answerDeclarations = current.answerDeclarations || [];
        current.answerDeclarations.push(boldInlineAnswer[1].trim());
        current.inlineAnswer = boldInlineAnswer[1].trim();
        current.inExplanation = false;
        if (boldInlineAnswer[2].trim())
          addExplanation("Explanation", boldInlineAnswer[2]);
        blankBefore = false;
        continue;
      }
      let inlineAnswer = line.match(
        /^(?:correct(?:\s+answer)?|answer)\s*(?::|is)\s*(.+)$/i,
      );
      if (inlineAnswer) {
        current.answerDeclarations = current.answerDeclarations || [];
        current.answerDeclarations.push(inlineAnswer[1].trim());
        current.inlineAnswer = inlineAnswer[1].trim();
        current.inExplanation = false;
        blankBefore = false;
        continue;
      }
      let expectedAnswer = line.match(/^expected\s+answer\s*:\s*(.+)$/i);
      if (expectedAnswer) {
        current.expectedAnswer = expectedAnswer[1].trim();
        current.inExplanation = false;
        blankBefore = false;
        continue;
      }
      // Many pasted True/False exams put the answer alone on the line after the statement.
      // Capture it before the generic continuation logic can append it to the question text.
      if (
        /^(?:true|false)$/i.test(line) &&
        current.options.length === 0 &&
        !current.inExplanation &&
        !current.inlineAnswer
      ) {
        current.type = "tf";
        current.inlineAnswer = line;
        current.answerDeclarations = [line];
        blankBefore = false;
        continue;
      }
      let explanation = line.match(
        /^(explanation|why|reason|note|additional\s+information|correction)\s*(?::|[-–—])\s*(.*)$/i,
      );
      if (explanation) {
        addExplanation(explanation[1].replace(/\s+/g, " "), explanation[2]);
        blankBefore = false;
        continue;
      }
      let opt = optionMatch(line);
      if (opt) {
        current.type = "mcq";
        current.inExplanation = false;
        let label = (opt[1] || opt[2]).toUpperCase(),
          choice = opt[3] || "",
          marked =
            /^\s*\*|(?:\(\s*correct\s*\)|\[\s*correct\s*\]|✓|✔|—\s*correct)\s*$/i.test(
              choice,
            );
        choice = choice
          .replace(/^\s*\*\s*/, "")
          .replace(
            /(?:\(\s*correct\s*\)|\[\s*correct\s*\]|✓|✔|—\s*correct)\s*$/i,
            "",
          )
          .trim();
        if (marked) current.inlineLabel = label;
        current.labels.push(label);
        current.options.push(choice);
        blankBefore = false;
        continue;
      }
      const tfMarker =
        /\(\s*(?:true\s*\/\s*false|true\s+or\s+false|t\s*\/\s*f)\s*\)/i;
      if (tfMarker.test(line)) {
        line = line.replace(tfMarker, "").trim();
        current.type = "tf";
        current.text += (current.text ? " " : "") + line;
        blankBefore = false;
        continue;
      }
      if (
        (!current.inExplanation &&
          current.options.length &&
          /[?？]\s*$/.test(line) &&
          blankBefore) ||
        (!current.inExplanation && current.type === "tf" && blankBefore)
      ) {
        add("", line);
        blankBefore = false;
        continue;
      }
      if (
        current.inExplanation &&
        current.explanationSections[current.activeExplanation]
      ) {
        let section = current.explanationSections[current.activeExplanation];
        section.text += (section.text ? " " : "") + line;
      } else if (current.options.length) {
        current.options[current.options.length - 1] +=
          (current.options[current.options.length - 1] ? " " : "") + line;
      } else if (
        blankBefore &&
        current.text &&
        /[?？]\s*$/.test(current.text) &&
        /[?？]$/.test(line)
      ) {
        add("", line);
      } else {
        current.text += (current.text ? " " : "") + line;
        current.unlabeled.push(line);
      }
      blankBefore = false;
    }
    const answerMap = new Map(),
      duplicates = new Set();
    for (const line of answerLines) {
      let re =
          /(?:^|\s)(?:Q\s*)?(\d{1,3})\s*[.):\-]?\s*(?:[-=]>?\s*)?([A-H]|true|false|t|f)\b/gi,
        m;
      while ((m = re.exec(line))) {
        let n = m[1];
        if (answerMap.has(n)) duplicates.add(n);
        answerMap.set(n, m[2]);
      }
    }
    const seen = new Set();
    segments.forEach((q, i) => {
      q.explanation = (q.explanationSections || [])
        .map((part) => `${part.label}: ${part.text}`.trim())
        .join("\n\n");
      if (!q.options.length && q.unlabeled?.length) {
        const plain = q.unlabeled.map((x) => x.trim()).filter(Boolean);
        if (
          plain.length === 2 &&
          /^true$/i.test(plain[0]) &&
          /^false$/i.test(plain[1])
        ) {
          q.type = "tf";
          q.text = q.prompt;
        } else if (plain.length >= 2 && plain.length <= 8) {
          q.type = "mcq";
          q.options = plain;
          q.labels = plain.map((_, j) => String.fromCharCode(65 + j));
          q.text = q.prompt;
        }
      }
      q.sourceNumber = q.number;
      if (!q.sourceNumber)
        q.warnings.push("Question number could not be identified.");
      q.number = q.number || String(i + 1);
      let scopedNumber = `${q.section}:${q.number}`;
      if (seen.has(scopedNumber))
        q.warnings.push(
          `Question number ${q.number} is duplicated in this section.`,
        );
      seen.add(scopedNumber);
      if (!q.text) q.warnings.push("Question text is missing.");
      if (q.options.length) {
        q.type = "mcq";
        if (q.inlineLabel) {
          let markedIndex = q.labels.indexOf(q.inlineLabel);
          if (markedIndex >= 0) q.correct = markedIndex;
        }
        if (q.options.length < 2)
          q.warnings.push(
            "This multiple-choice question has fewer than two choices.",
          );
        if (q.options.some((x) => !x.trim()))
          q.warnings.push("One or more answer choices are empty.");
      }
      const inline = q.inlineAnswer;
      const answer = inline || q.expectedAnswer || answerMap.get(q.number);
      if (answer) {
        // Keep a closing parenthesis when it belongs to a label such as “(a)”.
        const clean = String(answer).trim().replace(/\.$/, "");
        if (q.type === "short" && /^(true|false|t|f)$/i.test(clean)) {
          q.type = "tf";
          q.correct = /^(true|t)$/i.test(clean);
        } else if (q.type === "mcq") {
          const labeledAnswer = clean.match(
              /^(?:\(\s*([A-H])\s*\)|option\s+([A-H])\b|([A-H])\s*[).:])(?:\s*(.*))?$/i,
            ),
            bareLabel = clean.match(/^([A-H])$/i)?.[1],
            label = (labeledAnswer?.[1] || labeledAnswer?.[2] || labeledAnswer?.[3] || bareLabel)?.toUpperCase(),
            answerText = labeledAnswer?.[4]?.trim(),
            normalizedAnswer = (answerText || clean).toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
          let idx = label
            ? q.labels.indexOf(label)
            : q.options.findIndex((option) =>
                option.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim() === normalizedAnswer,
              );
          if (idx < 0 && Number.isInteger(+clean)) idx = +clean - 1;
          if (idx >= 0 && idx < q.options.length) q.correct = idx;
          else
            q.warnings.push(
              `Answer “${clean}” does not match a listed answer choice. Select the intended choice or edit the options.`,
            );
        } else if (q.type === "tf") {
          if (/^(true|t)$/i.test(clean)) q.correct = true;
          else if (/^(false|f)$/i.test(clean)) q.correct = false;
          else q.warnings.push("The True/False answer was unclear.");
        } else q.correct = clean;
      } else if (q.type === "tf" && /\b(?:true|false)\b/i.test(q.text)) {
        let m = q.text.match(/\b(true|false)\b\s*$/i);
        if (m) {
          q.correct = /true/i.test(m[1]);
          q.text = q.text.replace(/\s*\b(?:true|false)\b\s*$/i, "").trim();
        }
      }
      if (q.type === "short" && q.correct === null) {
        let expected = q.text.match(
          /(?:expected\s+answer|answer)\s*:\s*(.+)$/i,
        );
        if (expected) {
          q.correct = expected[1].trim();
          q.text = q.text.slice(0, expected.index).trim();
        }
      }
      if (q.correct === null)
        q.warnings.push(
          "No correct answer was detected. Confirm or add it before using this question in an exam.",
        );
      if (
        !q.text.includes("?") &&
        !/[؟]$/.test(q.text) &&
        q.type === "short" &&
        !q.expectedAnswer &&
        q.correct === null
      )
        q.warnings.push(
          "This may be a statement or an incompletely parsed question.",
        );
      if (duplicates.has(q.number))
        q.warnings.push(
          `Answer key contains duplicate entries for ${q.number}.`,
        );
      if (q.answerDeclarations?.length > 1) {
        const labels = q.answerDeclarations
          .map((a) => {
            const match = a.match(/^\(\s*([A-H])\s*\)|^option\s+([A-H])\b|^([A-H])\s*[).:]|^([A-H])$/i);
            return (match?.[1] || match?.[2] || match?.[3] || match?.[4])?.toUpperCase();
          })
          .filter(Boolean);
        if (new Set(labels).size > 1)
          q.warnings.push(
            "Repeated correct-answer declarations disagree. The final declaration is selected; review it before importing.",
          );
      }
      if (
        hasUnbalancedMathDelimiters(
          q.text + " " + q.options.join(" ") + " " + q.explanation,
        )
      )
        q.warnings.push(
          "A LaTeX math delimiter may be unmatched. Check the expression in the preview.",
        );
      q.id = uid();
      q.options = q.options.map((x) => x.trim());
    });
    if (!segments.length && raw.trim()) {
      add("", raw.trim());
      current.warnings.push(
        "Could not confidently split this text into questions. Review and split it manually.",
      );
      current.id = uid();
      current.number = "1";
    }
    return segments;
  }
