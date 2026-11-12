// Studyroom module; loaded in order by index.html.
  const KEY = "studyroom.v1";
  const blank = () => ({
    subjects: [],
    questions: [],
    cards: [],
    exams: [],
    attempts: [],
    reviews: {},
    importHashes: [],
    settings: { theme: "midnight", dark: false },
    activity: [],
    streak: 0,
    lastStudy: null,
  });
  let db;
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || "{}");
    db = { ...blank(), ...saved };
    db.settings = { ...blank().settings, ...(saved.settings || {}) };
    if (saved.settings?.dark === undefined) {
      const landingTheme = localStorage.getItem("studyroom.landing.theme");
      db.settings.dark = landingTheme
        ? landingTheme === "dark"
        : !!window.matchMedia?.("(prefers-color-scheme: dark)")?.matches;
    }
  } catch {
    db = blank();
  }
  let page = "account",
    modal = null,
    profilePhotoDraft = null,
    selectedQuestionIds = new Set(),
    selectedAttemptIds = new Set(),
    pendingDeletion = null,
    deleteBusy = false,
    examRun = null,
    flashRun = null,
    searchText = "",
    questionSort = "default",
    filters = { type: "all", subject: "all", topic: "all" },
    toastTimer,
    subjectViewId = null,
    topicViewName = "",
    topicQuestionFilter = "all",
    resultTopicFilter = "",
    examSetup = { scope: "general", subjectId: "", topic: "" },
    examManualIds = new Set(),
    importDraft = {
      raw: "",
      questions: [],
      subjectId: "",
      topic: "",
      type: "auto",
      hash: "",
      duplicate: false,
      ...(db.importDraft || {}),
    },
    importSaveTimer,
    subjectPickerSearch = "",
    subjectPickerSearchTimer;
