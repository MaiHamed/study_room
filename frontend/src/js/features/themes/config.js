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
    { id: "midnight", name: "Midnight Purple", note: "Calm charcoal with a violet glow.", light: ["#f5f2f8", "#fff", "#302b38", "#76609b", "#eae3f3"], dark: ["#191821", "#24222d", "#f3f0f7", "#b29adf", "#3a3745"] },
    { id: "midnight-blue-lavender", name: "Midnight Blue + Lavender", note: "Clear blue with a calm lavender accent.", light: ["#F8FAFC", "#FFFFFF", "#1E293B", "#6366F1", "#E2E8F0"], dark: ["#0F172A", "#1E293B", "#F1F5F9", "#818CF8", "#334155"] },
    { id: "ocean", name: "Ocean Blue", note: "Deep navy and refreshing blue.", light: ["#eff5f8", "#fff", "#263640", "#397e9c", "#dcecf3"], dark: ["#111d25", "#1b2a34", "#edf6fa", "#78c5e3", "#263c49"] },
    { id: "emerald", name: "Emerald", note: "Forest greens with mint highlights.", light: ["#f0f6f1", "#fff", "#2c3b31", "#3e8460", "#deeee2"], dark: ["#152019", "#202d24", "#eef7ef", "#76d49b", "#2d4435"] },
    { id: "rose", name: "Rose", note: "Soft blush with muted burgundy.", light: ["#faf1f2", "#fff", "#433136", "#a6536c", "#f3e1e6"], dark: ["#24191e", "#332329", "#f8edf0", "#e89bb2", "#493039"] },
    { id: "warm-beige-chocolate", name: "Warm Beige + Chocolate", note: "Minimal · Cozy · Sophisticated.", light: ["#FAF7F2", "#FFFFFF", "#30251F", "#8B5E3C", "#E9DED2"], dark: ["#191512", "#28211C", "#F5EDE5", "#D6A77A", "#493B31"] },
    { id: "mono", name: "Monochrome", note: "Quiet, precise, and beautifully neutral.", light: ["#f2f2f2", "#fff", "#292929", "#555", "#e5e5e5"], dark: ["#171717", "#242424", "#f3f3f3", "#d1d1d1", "#363636"] },
  ];
  function applyTheme() {
    const root = document.documentElement,
      dark = !!db.settings.dark,
      savedPalette = db.settings.theme === "sunset"
        ? "warm-beige-chocolate"
        : db.settings.theme,
      palette = themes.some((theme) => theme.id === savedPalette)
        ? savedPalette
        : "midnight";
    db.settings.theme = palette;
    root.dataset.theme = dark ? "dark" : "light";
    root.dataset.palette = palette;
  }
