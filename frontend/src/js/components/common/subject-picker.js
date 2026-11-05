// Studyroom module; loaded in order by index.html.
  function closeSubjectPicker(picker) {
    if (!picker) return;
    picker.classList.remove("is-open", "opens-up");
    let trigger = $(".subject-picker-trigger", picker),
      menu = $(".subject-picker-menu", picker);
    trigger?.setAttribute("aria-expanded", "false");
    menu?.setAttribute("hidden", "");
    trigger?.removeAttribute("aria-activedescendant");
  }
  function openSubjectPicker(picker, activeIndex) {
    let trigger = $(".subject-picker-trigger", picker),
      menu = $(".subject-picker-menu", picker),
      options = $$(".subject-picker-option", picker);
    if (!trigger || !menu) return;
    let selectedIndex = Math.max(
      0,
      options.findIndex(
        (option) => option.getAttribute("aria-selected") === "true",
      ),
    );
    picker.classList.add("is-open");
    menu.removeAttribute("hidden");
    let roomBelow = innerHeight - trigger.getBoundingClientRect().bottom;
    picker.classList.toggle(
      "opens-up",
      roomBelow < Math.min(menu.scrollHeight, 280) &&
        trigger.getBoundingClientRect().top > roomBelow,
    );
    trigger.setAttribute("aria-expanded", "true");
    let index = Math.max(
      0,
      Math.min(options.length - 1, activeIndex ?? selectedIndex),
    );
    options.forEach((option, i) =>
      option.classList.toggle("is-active", i === index),
    );
    trigger.setAttribute("aria-activedescendant", options[index]?.id || "");
    options[index]?.scrollIntoView({ block: "nearest" });
  }
  document.addEventListener("click", (e) => {
    let picker = e.target.closest("[data-subject-picker]");
    if (!picker) {
      closeSubjectPicker($("[data-subject-picker].is-open"));
      return;
    }
    let trigger = e.target.closest(".subject-picker-trigger"),
      option = e.target.closest(".subject-picker-option");
    if (trigger) {
      if (picker.classList.contains("is-open")) closeSubjectPicker(picker);
      else openSubjectPicker(picker);
    }
    if (option) {
      let select = $(".subject-picker-native", picker),
        value = option.dataset.value;
      if (select.value !== value) {
        select.value = value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
      $(".subject-picker-trigger span", picker).textContent = $(
        "span",
        option,
      ).textContent;
      $$(".subject-picker-option", picker).forEach((item) => {
        let selected = item === option;
        item.classList.toggle("is-selected", selected);
        item.setAttribute("aria-selected", String(selected));
      });
      closeSubjectPicker(picker);
      $(".subject-picker-trigger", picker)?.focus();
    }
  });
  document.addEventListener("keydown", (e) => {
    let trigger = e.target.closest?.(".subject-picker-trigger");
    if (!trigger) return;
    let picker = trigger.closest("[data-subject-picker]"),
      options = $$(".subject-picker-option", picker),
      active = Math.max(
        0,
        options.findIndex((option) => option.classList.contains("is-active")),
      );
    if (e.key === "Tab") {
      closeSubjectPicker(picker);
      return;
    }
    if (e.key === "Escape") {
      closeSubjectPicker(picker);
      return;
    }
    if (
      e.key === "ArrowDown" ||
      e.key === "ArrowUp" ||
      e.key === "Home" ||
      e.key === "End"
    ) {
      e.preventDefault();
      let next =
        e.key === "Home"
          ? 0
          : e.key === "End"
            ? options.length - 1
            : (active + (e.key === "ArrowDown" ? 1 : -1) + options.length) %
              options.length;
      openSubjectPicker(picker, next);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      if (!picker.classList.contains("is-open")) openSubjectPicker(picker);
      else options[active]?.click();
    } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      subjectPickerSearch += e.key.toLocaleLowerCase();
      clearTimeout(subjectPickerSearchTimer);
      subjectPickerSearchTimer = setTimeout(() => {
        subjectPickerSearch = "";
      }, 650);
      let match = options.findIndex((option) =>
        $("span", option)
          .textContent.toLocaleLowerCase()
          .startsWith(subjectPickerSearch),
      );
      if (match >= 0) openSubjectPicker(picker, match);
    }
  });
