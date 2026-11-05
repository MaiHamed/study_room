// Application entry point. Feature modules are loaded before this script.
setInterval(() => {
  const timer = $("#timer");
  if (!timer) return;
  const total = Number(timer.dataset.minutes) * 60;
  const remain = Math.max(
    0,
    total - Math.floor((Date.now() - Number(timer.dataset.start)) / 1000),
  );
  const minutes = Math.floor(remain / 60);
  const seconds = remain % 60;
  timer.textContent = `⏱ ${minutes}:${String(seconds).padStart(2, "0")}`;
  if (!remain) submitAttempt(currentAttempt());
}, 1000);

render();
