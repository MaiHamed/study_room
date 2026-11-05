// Studyroom module; loaded in order by index.html.
  let customSelectId = 0,
    appSelectSearch = "",
    appSelectSearchTimer;
  function refreshCustomSelect(select) {
    if (!select || select.matches(".subject-picker-native, [multiple], [size]"))
      return;
    let host = select.parentElement,
      wrapper = select.closest(".app-select");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.className = "app-select";
      select.before(wrapper);
      wrapper.append(select);
      let trigger = document.createElement("button");
      trigger.type = "button";
      trigger.className = "app-select-trigger";
      trigger.setAttribute("role", "combobox");
      trigger.setAttribute("aria-haspopup", "listbox");
      trigger.setAttribute("aria-expanded", "false");
      let selectId = ++customSelectId,
        label = select.labels?.[0],
        labelId = label?.id;
      if (!labelId && label) {
        labelId = `app-select-label-${selectId}`;
        label.id = labelId;
      }
      if (labelId) trigger.setAttribute("aria-labelledby", labelId);
      else
        trigger.setAttribute(
          "aria-label",
          select.getAttribute("aria-label") ||
            select.name ||
            "Choose an option",
        );
      let menu = document.createElement("div");
      menu.className = "app-select-menu";
      menu.setAttribute("role", "listbox");
      if (labelId) menu.setAttribute("aria-labelledby", labelId);
      menu.hidden = true;
      let menuId = `app-select-list-${selectId}`;
      menu.id = menuId;
      trigger.setAttribute("aria-controls", menuId);
      wrapper.append(trigger, menu);
      select.classList.add("app-select-native");
      select.tabIndex = -1;
      select.setAttribute("aria-hidden", "true");
    }
    let trigger = $(".app-select-trigger", wrapper),
      menu = $(".app-select-menu", wrapper),
      signature = [...select.options]
        .map((o) => `${o.value}\u0000${o.textContent}\u0000${o.disabled}`)
        .join("\u0001");
    if (menu.dataset.signature !== signature) {
      menu.replaceChildren();
      [...select.options].forEach((option, index) => {
        let item = document.createElement("button");
        item.type = "button";
        item.className = "app-select-option";
        item.setAttribute("role", "option");
        item.dataset.index = index;
        item.disabled = option.disabled;
        item.id = `${menu.id}-option-${index}`;
        item.setAttribute(
          "aria-selected",
          String(option === select.selectedOptions[0]),
        );
        let text = document.createElement("span");
        text.textContent = option.textContent;
        let check = document.createElement("b");
        check.textContent = "✓";
        check.setAttribute("aria-hidden", "true");
        item.append(text, check);
        menu.append(item);
      });
      menu.dataset.signature = signature;
    }
    let selected = select.selectedOptions[0],
      current = selected?.textContent || "";
    $("span", trigger)?.remove();
    let value = document.createElement("span");
    value.textContent = current;
    trigger.prepend(value);
    $$(".app-select-option", menu).forEach((item, index) => {
      let isSelected = select.options[index] === selected;
      item.classList.toggle("is-selected", isSelected);
      item.setAttribute("aria-selected", String(isSelected));
    });
  }
  function refreshCustomSelects(root = document) {
    $$("select", root).forEach(refreshCustomSelect);
  }
  function closeAppSelect(wrapper) {
    if (!wrapper) return;
    wrapper.classList.remove("is-open", "opens-up");
    $(".app-select-trigger", wrapper)?.setAttribute("aria-expanded", "false");
    $(".app-select-menu", wrapper)?.setAttribute("hidden", "");
    $(".app-select-trigger", wrapper)?.removeAttribute("aria-activedescendant");
  }
  function openAppSelect(wrapper, activeIndex) {
    let trigger = $(".app-select-trigger", wrapper),
      menu = $(".app-select-menu", wrapper),
      items = $$(".app-select-option:not(:disabled)", menu),
      selected = items.findIndex(
        (item) => item.getAttribute("aria-selected") === "true",
      );
    wrapper.classList.add("is-open");
    menu.removeAttribute("hidden");
    let roomBelow = innerHeight - trigger.getBoundingClientRect().bottom;
    wrapper.classList.toggle(
      "opens-up",
      roomBelow < Math.min(menu.scrollHeight, 280) &&
        trigger.getBoundingClientRect().top > roomBelow,
    );
    trigger.setAttribute("aria-expanded", "true");
    let index = Math.max(
      0,
      Math.min(items.length - 1, activeIndex ?? Math.max(0, selected)),
    );
    items.forEach((item, i) => item.classList.toggle("is-active", i === index));
    trigger.setAttribute("aria-activedescendant", items[index]?.id || "");
    items[index]?.scrollIntoView({ block: "nearest" });
  }
  document.addEventListener("click", (e) => {
    let wrapper = e.target.closest(".app-select");
    if (!wrapper) {
      closeAppSelect($(".app-select.is-open"));
      return;
    }
    let trigger = e.target.closest(".app-select-trigger"),
      item = e.target.closest(".app-select-option");
    if (trigger)
      wrapper.classList.contains("is-open")
        ? closeAppSelect(wrapper)
        : openAppSelect(wrapper);
    if (item) {
      let select = $("select", wrapper),
        index = +item.dataset.index,
        triggerButton = $(".app-select-trigger", wrapper);
      select.selectedIndex = index;
      refreshCustomSelect(select);
      closeAppSelect(wrapper);
      triggerButton?.focus();
      select.dispatchEvent(new Event("change", { bubbles: true }));
    }
  });
  document.addEventListener("keydown", (e) => {
    let trigger = e.target.closest?.(".app-select-trigger");
    if (!trigger) return;
    let wrapper = trigger.closest(".app-select"),
      items = $$(".app-select-option:not(:disabled)", wrapper),
      active = Math.max(
        0,
        items.findIndex((item) => item.classList.contains("is-active")),
      );
    if (e.key === "Tab") {
      closeAppSelect(wrapper);
      return;
    }
    if (e.key === "Escape") {
      closeAppSelect(wrapper);
      return;
    }
    if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
      e.preventDefault();
      let next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? items.length - 1
            : (active + (e.key === "ArrowDown" ? 1 : -1) + items.length) %
              items.length;
      openAppSelect(wrapper, next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!wrapper.classList.contains("is-open")) openAppSelect(wrapper);
      else items[active]?.click();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      appSelectSearch += e.key.toLocaleLowerCase();
      clearTimeout(appSelectSearchTimer);
      appSelectSearchTimer = setTimeout(() => {
        appSelectSearch = "";
      }, 650);
      let index = items.findIndex((item) =>
        $("span", item)
          .textContent.toLocaleLowerCase()
          .startsWith(appSelectSearch),
      );
      if (index >= 0) openAppSelect(wrapper, index);
    }
  });
  document.addEventListener(
    "invalid",
    (e) => {
      if (e.target.matches("select.app-select-native")) {
        e.preventDefault();
        $(".app-select-trigger", e.target.closest(".app-select"))?.focus();
      }
    },
    true,
  );
  document.addEventListener("change", (e) => {
    if (e.target.matches("select:not(.subject-picker-native)")) {
      requestAnimationFrame(() => refreshCustomSelects($("#view")));
      requestAnimationFrame(() => refreshCustomSelects($("#modal-root")));
    }
  });
