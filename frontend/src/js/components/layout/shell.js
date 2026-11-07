// Studyroom module; loaded in order by index.html.
  function renderLucideIcons(root = document) {
    window.lucide?.createIcons({
      root,
      attrs: { "stroke-width": 1.8, "aria-hidden": "true" },
    });
  }
  document.addEventListener("DOMContentLoaded", () => renderLucideIcons());
  function shell() {
    let inSubjects = page === "subject-detail" || page === "topic-detail";
    $("#nav").innerHTML = nav
      .map(
        ([id, icon, label]) =>
          `<button data-page="${id}" class="${page === id || (id === "subjects" && inSubjects) ? "active" : ""}" ${page === id || (id === "subjects" && inSubjects) ? 'aria-current="page"' : ""}><span class="nav-icon"><i data-lucide="${icon}"></i></span><span class="nav-label">${label}</span>${id === "mistakes" && mistakeCount() ? `<span class="nav-count">${mistakeCount()}</span>` : ""}</button>`,
      )
      .join("");
    renderLucideIcons($("#nav"));
    $("#side-streak").textContent = `${db.streak || 0} day streak`;
    $("#today").textContent = new Date().toLocaleDateString(undefined, {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    let subj = db.subjects.find((s) => s.id === subjectViewId);
    $("#crumb").textContent =
      page === "topic-detail"
        ? `My Subjects · ${subj?.name || ""} · ${topicViewName}`
        : page === "subject-detail"
          ? `My Subjects · ${subj?.name || ""}`
          : page === "account"
            ? "Account & Sync"
          : page === "profile"
            ? "Edit Profile"
            : nav.find((n) => n[0] === page)?.[2] || "Study session";
    const avatar = $(".avatar");
    avatar.innerHTML = avatarMarkup();
    avatar.setAttribute("aria-label", db.profile?.firstName
      ? `Open ${db.profile.firstName}’s profile menu`
      : "Open profile menu");
  }
  function avatarMarkup(profile = db.profile || {}) {
    const name = (profile.firstName || "").trim();
    return profile.photo
      ? `<img src="${profile.photo}" alt="">`
      : name
        ? esc([...name][0].toLocaleUpperCase())
        : `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5 20c.5-3.6 3.1-5.5 7-5.5s6.5 1.9 7 5.5"/></svg>`;
  }
  function profilePage() {
    const p = db.profile || {},
      initials = avatarMarkup(p);
    return (
      pageHead(
        "YOUR ACCOUNT",
        "Edit profile",
        "Update the details and photo saved with this Studyroom browser.",
      ) +
      `<form id="profile-form" class="panel profile-panel"><div class="profile-photo-block"><div class="profile-photo" id="profile-photo-preview">${initials}</div><div><b>Profile picture</b><p class="page-sub">Choose a square or portrait photo. Images up to 1.5 MB are supported.</p><div class="profile-photo-actions"><label class="btn" for="profile-photo">Upload photo</label><input class="sr-only" id="profile-photo" type="file" accept="image/*"><button class="btn" type="button" data-action="profile-remove-photo" ${p.photo ? "" : "disabled"}>Remove photo</button></div></div></div><div class="form-grid profile-fields"><label class="form-field">First name<input required maxlength="60" autocomplete="given-name" class="field" name="firstName" value="${esc(p.firstName || "")}"></label><label class="form-field">Last name<input maxlength="60" autocomplete="family-name" class="field" name="lastName" value="${esc(p.lastName || "")}"></label><label class="form-field full">Email address<input type="email" maxlength="254" autocomplete="email" class="field" name="email" value="${esc(p.email || "")}"></label></div><div class="profile-actions"><button class="btn" type="button" data-action="profile-cancel">Cancel</button><button class="btn primary" type="submit">Save Changes</button></div>${cloudProfileSettings()}</form>`
    );
  }
  function pageHead(eyebrow, title, sub, buttons = "") {
    return `<div class="page-head"><div><div class="eyebrow">${esc(eyebrow)}</div><h1 class="page-title">${esc(title)}</h1><p class="page-sub">${esc(sub)}</p></div><div class="actions">${buttons}</div></div>`;
  }
  function stat(label, value, note, mark) {
    return `<div class="stat"><div class="stat-label">${label}</div><div class="stat-value">${value}</div><div class="stat-note">${mark || "✦"} &nbsp;${note}</div></div>`;
  }
