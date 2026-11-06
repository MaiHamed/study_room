// Workspace administration for the data this local-first app actually stores.
  let adminRange = "30";

  function adminWindow() {
    const days = adminRange === "all" ? Infinity : Number(adminRange),
      since = days === Infinity ? 0 : Date.now() - days * 86400000;
    return {
      days,
      since,
      activity: (db.activity || []).filter((item) => new Date(item.date).getTime() >= since),
      attempts: (db.attempts || []).filter((item) => item.submittedAt && new Date(item.submittedAt).getTime() >= since),
    };
  }

  function adminSeries(days) {
    const monthly = days === Infinity,
      count = monthly ? 12 : days,
      start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    if (monthly) start.setUTCDate(1);
    else start.setUTCDate(start.getUTCDate() - count + 1);
    return Array.from({ length: count }, (_, index) => {
      const day = new Date(start);
      if (monthly) day.setUTCMonth(start.getUTCMonth() - count + 1 + index);
      else day.setUTCDate(start.getUTCDate() + index);
      const key = day.toISOString().slice(0, monthly ? 7 : 10),
        sessions = (db.activity || []).filter((item) => String(item.date || "").slice(0, monthly ? 7 : 10) === key).length,
        exams = (db.attempts || []).filter((item) => item.submittedAt && String(item.submittedAt).slice(0, monthly ? 7 : 10) === key).length;
      return { day, key, value: sessions + exams };
    });
  }

  function adminChart(series) {
    const max = Math.max(1, ...series.map((point) => point.value)),
      bars = series.map((point, index) => {
        const width = 100 / series.length,
          height = point.value ? Math.max(5, (point.value / max) * 74) : 2,
          x = index * width + width * .18;
        return `<rect x="${x.toFixed(2)}" y="${(84 - height).toFixed(2)}" width="${(width * .64).toFixed(2)}" height="${height.toFixed(2)}" rx="2" class="admin-chart-bar"><title>${esc(point.day.toLocaleDateString(undefined, { month: "short", day: "numeric" }))}: ${point.value} study events</title></rect>`;
      }).join(""),
      labels = series.map((point, index) => index % Math.max(1, Math.ceil(series.length / 6)) === 0
        ? `<text x="${(index / series.length * 100 + 1).toFixed(2)}" y="99">${esc(point.day.toLocaleDateString(undefined, { month: "short", ...(series.length <= 12 ? {} : { day: "numeric" }) }))}</text>` : "").join("");
    return `<svg class="admin-chart" viewBox="0 0 100 104" preserveAspectRatio="none" role="img" aria-label="Recorded study activity">${[25, 45, 65, 85].map((y) => `<line x1="0" x2="100" y1="${y}" y2="${y}" class="admin-chart-grid"/>`).join("")}${bars}${labels}</svg>`;
  }

  function adminPage() {
    const { days, activity, attempts } = adminWindow(),
      series = adminSeries(days),
      recent = [
        ...(db.activity || []).map((item) => ({ date: item.date, text: item.text || "Study activity", kind: "Study" })),
        ...(db.attempts || []).filter((item) => item.submittedAt).map((item) => ({ date: item.submittedAt, text: `Completed ${item.name || "an exam"}`, kind: "Exam" })),
      ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 8),
      profile = db.profile || {},
      rangeLabel = days === Infinity ? "all time" : `last ${days} days`;
    return `${pageHead("STUDYROOM · LOCAL WORKSPACE", "Workspace admin", "A clear view of the study data saved in this browser.", `<label class="admin-range-label" for="admin-range">Date range</label><select class="field admin-range" id="admin-range"><option value="7" ${adminRange === "7" ? "selected" : ""}>Last 7 days</option><option value="30" ${adminRange === "30" ? "selected" : ""}>Last 30 days</option><option value="90" ${adminRange === "90" ? "selected" : ""}>Last 90 days</option><option value="all" ${adminRange === "all" ? "selected" : ""}>All time</option></select><button class="btn" type="button" data-action="admin-export">Export activity CSV</button>`)}
      <section class="admin-notice"><span class="admin-notice-icon"><i data-lucide="hard-drive"></i></span><div><b>Local browser workspace</b><p>This app stores one learner’s data on this device. There is no server, shared user directory, role system, or infrastructure monitoring connected.</p></div><span class="admin-local-badge">DEVICE ONLY</span></section>
      <div class="grid stats-grid admin-stats">${stat("Recorded events", activity.length + attempts.length, `in ${rangeLabel}`, "◷")}${stat("Completed exams", attempts.length, `in ${rangeLabel}`, "▤")}${stat("Questions in bank", db.questions.length, `${db.subjects.length} subjects`, "☷")}${stat("Flashcards", db.cards.length, "saved in this browser", "▱")}</div>
      <div class="grid admin-main-grid"><section class="panel admin-chart-panel"><div class="panel-head"><div><h2 class="panel-title">Study activity</h2><p class="page-sub">Recorded study events${days === Infinity ? " · monthly view, last 12 months" : " · daily view"} · ${esc(rangeLabel)}</p></div><span class="admin-period">${series.reduce((sum, point) => sum + point.value, 0)} events</span></div>${activity.length || attempts.length ? adminChart(series) : `<div class="admin-chart-empty"><span>◷</span><b>No activity in this period</b><small>Study sessions and completed exams will appear here.</small></div>`}<div class="admin-legend"><span><i></i> Study and exam events</span><span>${days === Infinity ? "Monthly totals" : "Daily totals"}</span></div></section>
      <section class="panel admin-profile-panel"><div class="panel-head"><h2 class="panel-title">Local profile</h2><button class="panel-link" data-page="profile">EDIT →</button></div><div class="admin-profile">${avatarMarkup(profile)}<div><b>${esc([profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Profile not set")}</b><small>${esc(profile.email || "No email saved")}</small></div></div><p class="admin-profile-note">This profile belongs to this browser’s study workspace. Account sign-in and multi-user administration are not configured.</p><button class="btn" data-page="settings">Workspace settings</button></section></div>
      <div class="grid admin-bottom-grid"><section class="panel admin-activity-panel"><div class="panel-head"><div><h2 class="panel-title">Recent activity</h2><p class="page-sub">Study activity keeps up to 30 events; some app actions are not logged.</p></div><span class="admin-count">${recent.length} shown</span></div>${recent.length ? `<div class="admin-activity-list">${recent.map((item) => `<div class="admin-activity-row"><span class="admin-activity-mark">${item.kind === "Exam" ? "▤" : "◷"}</span><div><b>${esc(item.text)}</b><small>${esc(item.kind)} · ${item.date ? esc(new Date(item.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })) : "Date unavailable"}</small></div></div>`).join("")}</div>` : `<div class="empty">Your study activity will appear here when you begin a session.</div>`}</section>
      <section class="panel admin-manage-panel"><div class="panel-head"><h2 class="panel-title">Manage your study space</h2></div><p class="page-sub">Jump into the tools connected to your saved data.</p><div class="admin-links"><button data-page="subjects"><span>▦</span><b>Subjects &amp; topics</b><i>→</i></button><button data-page="questions"><span>☷</span><b>Question bank</b><i>→</i></button><button data-page="exams"><span>▤</span><b>Exam history</b><i>→</i></button><button data-page="statistics"><span>▥</span><b>Learning statistics</b><i>→</i></button><button data-page="settings"><span>⚙</span><b>Appearance &amp; backups</b><i>→</i></button></div></section></div>
      <section class="admin-capabilities"><div><span class="eyebrow">PLATFORM CONTROLS</span><h2>Not connected in this version</h2><p>Registered users, permissions, moderation reports, announcements, shared content, security events, API health, and server metrics require a backend and authenticated administrator accounts. No data for those features is available in this browser app.</p></div></section>`;
  }

  function exportAdminActivity() {
    const rows = [["timestamp", "event", "type"],
      ...(db.activity || []).map((item) => [item.date || "", item.text || "Study activity", "Study"]),
      ...(db.attempts || []).filter((item) => item.submittedAt).map((item) => [item.submittedAt, `Completed ${item.name || "an exam"}`, "Exam"])];
    const csv = rows.map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(",")).join("\r\n"),
      url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })),
      link = document.createElement("a");
    link.href = url;
    link.download = "studyroom-activity.csv";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    notify("Activity CSV exported.");
  }

  document.addEventListener("change", (event) => {
    if (!event.target.matches("#admin-range")) return;
    adminRange = event.target.value;
    render();
  });

  document.addEventListener("click", (event) => {
    if (event.target.closest('[data-action="admin-export"]')) exportAdminActivity();
  });
