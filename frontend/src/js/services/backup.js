// Studyroom module; loaded in order by index.html.
  function exportData() {
    let b = new Blob([JSON.stringify(db, null, 2)], {
        type: "application/json",
      }),
      u = URL.createObjectURL(b),
      a = document.createElement("a");
    a.href = u;
    a.download = "studyroom-backup.json";
    a.click();
    URL.revokeObjectURL(u);
    notify("Backup downloaded.");
  }
  function importData() {
    let input = document.createElement("input");
    input.type = "file";
    input.accept = "application/json";
    input.onchange = () => {
      let f = input.files[0];
      if (!f) return;
      let rd = new FileReader();
      rd.onload = () => {
        try {
          let d = JSON.parse(rd.result);
          if (
            !Array.isArray(d.subjects) ||
            !Array.isArray(d.questions) ||
            !Array.isArray(d.attempts)
          )
            throw Error();
          if (
            confirm("Replace this browser’s Studyroom data with this backup?")
          ) {
            db = { ...blank(), ...d };
            save();
            render();
            notify("Backup restored.");
          }
        } catch {
          notify("That backup file could not be read.");
        }
      };
      rd.readAsText(f);
    };
    input.click();
  }
