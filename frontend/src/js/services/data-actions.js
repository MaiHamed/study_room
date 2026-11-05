// Studyroom action handlers.
function handleDataAction(el, ev, act, id) {
    if (act === "import") {
      importData();
      return;
    }
    if (act === "export") {
      exportData();
      return;
    }
    if (act === "clear-data") {
      if (
        confirm(
          "Delete all Studyroom data from this browser? This cannot be undone.",
        )
      ) {
        db = blank();
        save();
        page = "dashboard";
        render();
        notify("Studyroom data cleared.");
      }
      return;
    }
}
