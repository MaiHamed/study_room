// Studyroom module; loaded in order by index.html.
  function settings() {
    const active = themes.find((t) => t.id === db.settings.theme) || themes[0],
      dark = !!db.settings.dark;
    return (
      pageHead(
        "YOUR STUDYROOM",
        "Settings",
        "Make your study space feel like yours and keep your data safe.",
      ) +
      `<section class="theme-section"><div class="theme-section-head"><div><div class="eyebrow">PERSONALIZE YOUR SPACE</div><h2 class="panel-title">Appearance &amp; Themes</h2><p class="page-sub">Choose a palette, then switch between its light and dark appearance.</p></div><div class="mode-switch" role="group" aria-label="Color mode"><button type="button" data-mode-choice="light" aria-pressed="${!dark}"><span>☀</span> Light</button><button type="button" data-mode-choice="dark" aria-pressed="${dark}"><span>☾</span> Dark</button></div></div><div class="theme-grid">${themes
        .map((theme) => {
          const colors = dark ? theme.dark : theme.light,
            selected = theme.id === active.id;
          return `<button type="button" class="theme-card ${selected ? "is-selected" : ""}" data-theme-choice="${theme.id}" aria-pressed="${selected}" aria-label="${theme.name}${selected ? ", selected" : ""}"><span class="theme-preview" style="--pv-bg:${colors[0]};--pv-paper:${colors[1]};--pv-ink:${colors[2]};--pv-accent:${colors[3]};--pv-line:${colors[4]}"><span class="pv-sidebar"><i></i><i></i><i></i></span><span class="pv-main"><i class="pv-top"></i><i class="pv-title"></i><i class="pv-card"><b></b><b></b><em></em></i><i class="pv-input"></i><i class="pv-button"></i></span><span class="theme-check">✓</span></span><span class="theme-info"><span><b>${theme.name}</b><small>${theme.note}</small></span><span class="theme-swatches" aria-hidden="true"><i style="--sw:${colors[3]}"></i><i style="--sw:${colors[4]}"></i><i style="--sw:${colors[2]}"></i></span></span></button>`;
        })
        .join(
          "",
        )}</div><p class="theme-current" aria-live="polite">Currently using <b>${active.name} · ${dark ? "Dark" : "Light"}</b></p></section><div class="panel settings-data-panel"><h2 class="panel-title">Your data</h2><p class="page-sub" style="margin:8px 0 18px">Your materials and study history are stored in this browser.</p><div class="actions"><button class="btn" data-action="export">Export backup</button><button class="btn" data-action="import">Restore backup</button><button class="btn danger" data-action="clear-data">Clear all data</button></div></div>`
    );
  }
