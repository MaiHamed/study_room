// Studyroom module; loaded in order by index.html.
  const nav = [
    ["dashboard", "layout-dashboard", "Dashboard"],
    ["subjects", "book-open", "My Subjects"],
    ["questions", "library", "Question Bank"],
    ["smart-import", "upload", "Smart Import"],
    ["create-exam", "file-plus-2", "Create Exam"],
    ["exams", "clipboard-list", "My Exams"],
    ["flashcards", "layers-3", "Flashcards"],
    ["mistakes", "brain", "My Mistakes"],
    ["statistics", "bar-chart-3", "Statistics"],
    ["settings", "settings-2", "Settings"],
  ];
  const themes = [
    {
      id: "midnight",
      name: "Midnight Purple",
      note: "Calm charcoal with a violet glow.",
      light: ["#f5f2f8", "#fff", "#302b38", "#76609b", "#eae3f3"],
      dark: ["#19171f", "#24212c", "#f3eef9", "#c5a9f4", "#373043"],
    },
    {
      id: "ocean",
      name: "Ocean Blue",
      note: "Deep navy and refreshing blue.",
      light: ["#eff5f8", "#fff", "#263640", "#397e9c", "#dcecf3"],
      dark: ["#111d25", "#1b2a34", "#edf6fa", "#78c5e3", "#263c49"],
    },
    {
      id: "emerald",
      name: "Emerald",
      note: "Forest greens with mint highlights.",
      light: ["#f0f6f1", "#fff", "#2c3b31", "#3e8460", "#deeee2"],
      dark: ["#152019", "#202d24", "#eef7ef", "#76d49b", "#2d4435"],
    },
    {
      id: "rose",
      name: "Rose",
      note: "Soft blush with muted burgundy.",
      light: ["#faf1f2", "#fff", "#433136", "#a6536c", "#f3e1e6"],
      dark: ["#24191e", "#332329", "#f8edf0", "#e89bb2", "#493039"],
    },
    {
      id: "sunset",
      name: "Sunset",
      note: "Warm cocoa, caramel, and soft sand.",
      light: ["#f4ede3", "#fff9f0", "#38291f", "#966b45", "#e4d5c4"],
      dark: ["#211812", "#30231b", "#f4e9db", "#d0a16f", "#49372b"],
    },
    {
      id: "mono",
      name: "Monochrome",
      note: "Quiet, precise, and beautifully neutral.",
      light: ["#f2f2f2", "#fff", "#292929", "#555", "#e5e5e5"],
      dark: ["#171717", "#242424", "#f3f3f3", "#d1d1d1", "#363636"],
    },
  ];
  function applyTheme() {
    const root = document.documentElement,
      id = themes.some((t) => t.id === db.settings.theme)
        ? db.settings.theme
        : "midnight";
    root.dataset.theme = id;
    root.dataset.mode = db.settings.dark ? "dark" : "light";
    document.body.classList.toggle("dark", !!db.settings.dark);
  }
