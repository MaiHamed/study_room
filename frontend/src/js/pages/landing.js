(() => {
  const $ = (selector, root = document) => root.querySelector(selector),
    $$ = (selector, root = document) => [...root.querySelectorAll(selector)],
    dialog = $("#auth-dialog"), form = $("#auth-form"), message = $("#auth-message");
  let authMode = "login", toastTimer;

  function apiUrl(path) {
    const isLocalStudyroom = ["localhost", "127.0.0.1"].includes(window.location.hostname),
      configuredBase = String(window.STUDYROOM_API_BASE || "").replace(/\/$/, ""),
      base = configuredBase || (isLocalStudyroom ? "http://localhost:3000" : "");
    return `${base}${path}`;
  }

  async function apiRequest(path, options = {}) {
    let response;
    try {
      response = await fetch(apiUrl(path), {
        ...options,
        credentials: "include",
        cache: "no-store",
        headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) },
      });
    } catch {
      throw new Error(`Can’t connect to Studyroom’s API at ${apiUrl(path)}. Start the backend with “npm start” and make sure MongoDB is reachable.`);
    }
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(body?.error?.message || body?.message || `Studyroom’s API returned HTTP ${response.status} for ${path}. Check that the backend is running and the frontend is pointing to the correct API.`);
      error.code = body?.error?.code;
      error.fields = body?.error?.details?.fields || [];
      error.status = response.status;
      throw error;
    }
    if (!body) throw new Error("Studyroom’s API returned an unreadable response. Check the backend logs for details.");
    return body;
  }

  function toast(text, error = false) {
    const node = $("#site-toast");
    node.textContent = text;
    node.classList.toggle("error", error);
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 4300);
  }

  function syncAuthMode() {
    const signup = authMode === "signup", forgot = authMode === "forgot";
    $("#auth-eyebrow").textContent = forgot ? "ACCOUNT RECOVERY" : signup ? "A FRESH START" : "WELCOME BACK";
    $("#auth-title").textContent = forgot ? "Let’s get you back in." : signup ? "Make room to grow." : "Make room to grow.";
    $("#auth-subtitle").textContent = forgot ? "We’ll email you a secure link to reset your password." : signup ? "Create your study space in just a moment." : "Sign in to pick up where you left off.";
    $("#name-fields").hidden = !signup;
    $("#confirm-field").hidden = !signup;
    $("#terms-check").hidden = !signup;
    $("#login-options").hidden = signup || forgot;
    $(".auth-tabs").hidden = forgot;
    $(".google-button").hidden = forgot;
    $(".auth-divider").hidden = forgot;
    $("#auth-submit").innerHTML = forgot ? "Send reset link <span>↗</span>" : signup ? "Create account <span>↗</span>" : "Sign in <span>↗</span>";
    $("#auth-switch").innerHTML = forgot ? `Remembered your password? <button type="button" data-auth-tab="login">Back to sign in</button>` : signup ? `Already have an account? <button type="button" data-auth-tab="login">Log in</button>` : `New to Studyroom? <button type="button" data-auth-tab="signup">Create an account</button>`;
    const password = form.elements.password;
    password.closest("label").hidden = forgot;
    form.elements.confirmPassword.closest("label").hidden = !signup;
    form.elements.firstName.required = signup;
    form.elements.lastName.required = signup;
    form.elements.password.required = !forgot;
    form.elements.password.minLength = signup ? 10 : 1;
    form.elements.confirmPassword.required = signup;
    form.elements.email.required = true;
    $$("[data-auth-tab]", $(".auth-tabs")).forEach((tab) => {
      const active = tab.dataset.authTab === authMode;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    message.textContent = "";
    message.classList.remove("success");
  }

  function openAuth(mode = "login") {
    authMode = mode;
    form.reset();
    syncAuthMode();
    if (!dialog.open) dialog.showModal();
    document.body.classList.add("dialog-open");
    setTimeout(() => $("input[name=email]", form)?.focus(), 30);
  }

  function closeAuth() {
    dialog.close();
    document.body.classList.remove("dialog-open");
  }

  function showDemo(name) {
    const panel = $("#demo-content"), templates = {
      organize: `<div class="demo-greeting"><div><small>YOUR STUDY SPACE</small><h3>Good afternoon, Maya</h3></div><span class="demo-streak">✦ 7 day streak</span></div><div class="demo-subjects"><div class="demo-subject"><span>▦</span><b>Biology</b><small>8 topics · 24 questions</small></div><div class="demo-subject"><span style="background:#f8eee4;color:#bb815d">◈</span><b>Chemistry</b><small>6 topics · 18 questions</small></div><div class="demo-subject"><span style="background:#e6f1ea;color:#568367">⌁</span><b>Psychology</b><small>4 topics · 12 questions</small></div><div class="demo-subject"><span style="background:#e6edf6;color:#5f83a4">✧</span><b>History</b><small>5 topics · 16 questions</small></div></div>`,
      practice: `<div class="demo-question"><span class="demo-kicker">QUICK PRACTICE · BIOLOGY</span><h3>Which structure controls what enters and leaves the cell?</h3><button class="demo-choice" data-answer="wrong"><span>A</span> Cell wall</button><button class="demo-choice" data-answer="correct"><span>B</span> Cell membrane</button><button class="demo-choice" data-answer="wrong"><span>C</span> Nucleus</button><div class="demo-feedback" id="demo-feedback" aria-live="polite">Choose an answer to try it.</div></div>`,
      revise: `<div class="demo-kicker" style="text-align:center">YOUR REVISION DECK · 03 CARDS DUE</div><button class="demo-flashcard" id="demo-flashcard" aria-label="Flip the sample flashcard"><span class="demo-flash-inner"><span class="demo-flash-side"><small>QUESTION · TAP TO FLIP</small>What is the role of the cell membrane?</span><span class="demo-flash-side demo-flash-back"><small>ANSWER</small>It regulates what enters and leaves the cell.</span></span></button><p class="demo-flash-hint">A little review goes a long way.</p>`,
      progress: `<div class="demo-progress"><div class="demo-stat"><small>STUDY STREAK</small><b>7 days</b></div><div class="demo-stat"><small>QUESTIONS PRACTICED</small><b>128</b></div><div class="demo-chart" role="img" aria-label="Weekly study consistency chart"><span style="height:30%"></span><span style="height:48%"></span><span style="height:41%"></span><span style="height:68%"></span><span style="height:56%"></span><span style="height:85%"></span><span style="height:72%"></span></div><div class="demo-chart-labels"><span>MON</span><span>TUE</span><span>WED</span><span>THU</span><span>FRI</span><span>SAT</span><span>SUN</span></div></div>`,
    };
    panel.classList.remove("demo-enter");
    panel.innerHTML = templates[name] || templates.organize;
    requestAnimationFrame(() => panel.classList.add("demo-enter"));
    $$(".showcase-tab").forEach((tab) => {
      const active = tab.dataset.demo === name;
      tab.classList.toggle("active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });
  }

  function legalContent(kind) {
    const copy = {
      privacy: `<h3>What Studyroom stores</h3><p>Studyroom stores your account email, name, and study materials to provide sign-in and synchronization. Synced records are associated with your account. The app also keeps a working copy and preferences in this browser so your session can load quickly.</p><h3>Google sign-in</h3><p>If you choose Google sign-in, Google shares your verified account email, account identifier, and basic profile name with Studyroom to sign you in. Studyroom does not receive your Google password.</p><h3>Your choices</h3><p>You can export your study backup in the app. The account page can clear synced study data; it does not delete the account. Local browser data can be cleared in Settings. Password reset email is sent only when email delivery is configured.</p><p>Studyroom does not sell personal data or use it for advertising. This summary describes the current product behavior; publish a jurisdiction-specific policy before public commercial use.</p>`,
      terms: `<h3>Using Studyroom</h3><p>Studyroom is a study organization and practice tool. You are responsible for the content you add and for keeping access to your account secure.</p><h3>Your materials</h3><p>You retain rights to materials you provide. You give Studyroom permission to store and process them only to operate syncing, backups, and study features.</p><h3>Availability</h3><p>We work to keep Studyroom available, but online services can be interrupted. Keep a backup of important study materials. Do not use the service to store sensitive personal or confidential information.</p><p>These starter terms need review and adaptation to the operator’s legal entity and jurisdiction before public commercial use.</p>`,
    };
    $("#legal-eyebrow").textContent = kind === "privacy" ? "YOUR INFORMATION" : "USING STUDYROOM";
    $("#legal-title").textContent = kind === "privacy" ? "Privacy at a glance" : "Terms of use";
    $("#legal-copy").innerHTML = copy[kind] || copy.privacy;
    $("#legal-dialog").showModal();
  }

  document.addEventListener("click", async (event) => {
    const authButton = event.target.closest("[data-auth]");
    if (authButton) { event.preventDefault(); openAuth(authButton.dataset.auth); return; }
    const authTab = event.target.closest("[data-auth-tab]");
    if (authTab) { authMode = authTab.dataset.authTab; syncAuthMode(); return; }
    const legal = event.target.closest("[data-legal]");
    if (legal) { event.preventDefault(); legalContent(legal.dataset.legal); return; }
    if (event.target.closest("[data-close-legal]")) { $("#legal-dialog").close(); return; }
    if (event.target.closest("#auth-close")) { closeAuth(); return; }
    const tab = event.target.closest("[data-demo]");
    if (tab) { showDemo(tab.dataset.demo); return; }
    const answer = event.target.closest("[data-answer]");
    if (answer) {
      $$(".demo-choice").forEach((choice) => choice.classList.remove("correct", "wrong"));
      answer.classList.add(answer.dataset.answer);
      $("#demo-feedback").textContent = answer.dataset.answer === "correct" ? "That’s right — the membrane regulates what enters and leaves." : "Not quite. Think about the boundary around the cell.";
      return;
    }
    if (event.target.closest("#demo-flashcard") || event.target.closest("#hero-flashcard")) {
      event.target.closest("#demo-flashcard, #hero-flashcard").classList.toggle("flipped");
      return;
    }
    if (event.target.closest("#mobile-nav-toggle")) {
      const button = $("#mobile-nav-toggle"), open = button.getAttribute("aria-expanded") === "true";
      button.setAttribute("aria-expanded", String(!open));
      button.setAttribute("aria-label", open ? "Open navigation" : "Close navigation");
      $("#primary-nav").classList.toggle("open", !open);
      return;
    }
    if (event.target.closest("#theme-toggle")) {
      const root = document.documentElement, theme = root.dataset.theme === "dark" ? "light" : "dark";
      root.dataset.theme = theme;
      try { localStorage.setItem("studyroom.landing.theme", theme); } catch {}
      return;
    }
    if (event.target.closest("#back-to-top")) { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (event.target.closest("#forgot-password")) { authMode = "forgot"; syncAuthMode(); $("input[name=email]", form).focus(); return; }
    if (event.target.closest("#google-auth")) {
      const button = $("#google-auth"); button.disabled = true; button.querySelector("span:last-child").textContent = "Checking Google sign-in…";
      try {
        const status = await apiRequest("/api/auth/google/status");
        if (!status.configured) {
          message.textContent = "Google sign-in isn’t configured yet. Add GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI to the backend environment.";
          return;
        }
        window.location.assign(apiUrl("/api/auth/google"));
      } catch (error) {
        message.textContent = error.status === 404
          ? "Google sign-in is unavailable on this backend version. Stop the server and restart it from this project with “npm run dev”."
          : error.message || "Could not reach the sign-in service.";
      }
      finally { button.disabled = false; button.querySelector("span:last-child").textContent = "Continue with Google"; }
    }
  });

  document.addEventListener("submit", async (event) => {
    if (event.target !== form) return;
    event.preventDefault();
    const values = Object.fromEntries(new FormData(form).entries()), submit = $("#auth-submit");
    message.textContent = "";
    if (authMode === "signup" && values.password !== values.confirmPassword) { message.textContent = "Those passwords don’t match."; return; }
    if (authMode === "signup" && !values.agreeTerms) { message.textContent = "Please agree to the Terms and Privacy Policy to create an account."; return; }
    const original = submit.innerHTML; submit.disabled = true; submit.textContent = authMode === "forgot" ? "Sending…" : "Please wait…";
    try {
      if (authMode === "forgot") {
        await apiRequest("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email: values.email }) });
        message.classList.add("success"); message.textContent = "If an account matches that email, a reset link will be sent.";
        return;
      }
      const path = authMode === "signup" ? "/api/auth/register" : "/api/auth/login",
        payload = authMode === "signup"
          ? { firstName: values.firstName, lastName: values.lastName, email: values.email, password: values.password }
          : { email: values.email, password: values.password, ...(values.rememberMe ? { rememberMe: true } : {}) };
      try {
        await apiRequest(path, { method: "POST", body: JSON.stringify(payload) });
      } catch (error) {
        if (authMode !== "login" || !payload.rememberMe || !error.fields.includes("rememberMe")) throw error;
        await apiRequest(path, { method: "POST", body: JSON.stringify({ email: payload.email, password: payload.password }) });
      }
      closeAuth();
      window.location.assign("/public/app.html");
    } catch (error) { message.classList.remove("success"); message.textContent = error.message || "Sign-in failed. Please try again."; }
    finally { submit.disabled = false; submit.innerHTML = original; }
  });

  $("#auth-dialog").addEventListener("close", () => document.body.classList.remove("dialog-open"));
  $("#legal-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) event.currentTarget.close(); });
  $("#auth-dialog").addEventListener("click", (event) => { if (event.target === event.currentTarget) closeAuth(); });
  $("#auth-form").addEventListener("click", (event) => {
    if (!event.target.matches(".show-password")) return;
    const input = event.target.parentElement.querySelector("input"), showing = input.type === "password";
    input.type = showing ? "text" : "password";
    event.target.textContent = showing ? "Hide" : "Show";
    event.target.setAttribute("aria-label", showing ? "Hide password" : "Show password");
  });

  $$("[data-demo]").forEach((tab) => {
    tab.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      event.preventDefault();
      const tabs = $$("[data-demo]"), index = tabs.indexOf(tab), delta = event.key === "ArrowRight" ? 1 : -1,
        next = tabs[(index + delta + tabs.length) % tabs.length];
      next.focus(); next.click();
    });
  });

  const observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) { entry.target.classList.add("is-visible"); observer.unobserve(entry.target); } });
  }, { threshold: .12 }) : null;
  $$(".reveal").forEach((element, index) => {
    element.style.transitionDelay = `${Math.min(index % 3, 2) * 75}ms`;
    if (observer) observer.observe(element); else element.classList.add("is-visible");
  });

  const sections = ["features", "how", "about"].map((id) => $("#" + id)).filter(Boolean),
    navItems = $$(".nav-link");
  if ("IntersectionObserver" in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        navItems.forEach((item) => item.classList.toggle("active", item.getAttribute("href") === `#${entry.target.id}`));
      });
    }, { rootMargin: "-25% 0px -65% 0px" });
    sections.forEach((section) => sectionObserver.observe(section));
  }
  let scrollQueued = false;
  window.addEventListener("scroll", () => {
    if (scrollQueued) return;
    scrollQueued = true;
    requestAnimationFrame(() => { $(".site-header").classList.toggle("scrolled", window.scrollY > 12); scrollQueued = false; });
  }, { passive: true });
  const heroArt = $(".hero-art");
  if (window.matchMedia("(hover: hover) and (pointer: fine)").matches && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    heroArt.addEventListener("pointermove", (event) => {
      const bounds = heroArt.getBoundingClientRect(), x = (event.clientX - bounds.left) / bounds.width - .5, y = (event.clientY - bounds.top) / bounds.height - .5;
      $$(".float-card", heroArt).forEach((card, index) => {
        const depth = (index % 4 + 1) * 3;
        card.style.setProperty("--px", `${(-x * depth).toFixed(1)}px`);
        card.style.setProperty("--py", `${(-y * depth).toFixed(1)}px`);
      });
    });
    heroArt.addEventListener("pointerleave", () => $$(".float-card", heroArt).forEach((card) => { card.style.removeProperty("--px"); card.style.removeProperty("--py"); }));
  }
  $$(".nav-link").forEach((link) => link.addEventListener("click", () => { $("#primary-nav").classList.remove("open"); $("#mobile-nav-toggle").setAttribute("aria-expanded", "false"); }));
  $("#copyright-year").textContent = new Date().getFullYear();
  showDemo("organize");

  const query = new URLSearchParams(location.search);
  if (query.has("resetToken")) window.location.replace("/public/app.html?resetToken=" + encodeURIComponent(query.get("resetToken")));
  if (query.get("authError") === "google_not_configured") { openAuth("login"); message.textContent = "Google sign-in isn’t configured. Add the Google OAuth environment variables to the backend."; }
  if (query.get("authError") === "google_link_required") { openAuth("login"); message.textContent = "An account already uses this email. Sign in with your password, then link Google from your account page."; }
  if (query.get("authError") === "google_email_mismatch") { openAuth("login"); message.textContent = "Choose the same Google email address as your Studyroom account to link them."; }
  if (query.get("authError") === "google_already_linked") { openAuth("login"); message.textContent = "This Google account is already linked to another Studyroom account."; }
  if (query.get("authError") === "google_failed") { openAuth("login"); message.textContent = "Google sign-in could not be completed. Please try again."; }
  if (query.get("authSuccess") === "google") { toast("Signed in with Google. Welcome to Studyroom!"); history.replaceState({}, "", location.pathname); }
})();
