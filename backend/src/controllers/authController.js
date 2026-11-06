const authService = require("../services/authService");
const mailer = require("../services/mailer");
const activity = require("../services/activity");
const { setSessionCookie, clearSessionCookie } = require("../middleware/auth");
const { env, allowedOrigins } = require("../config/env");
const googleOAuth = require("../services/googleOAuthService");

const GOOGLE_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/api/auth/google",
  maxAge: 10 * 60 * 1000,
};

function clearGoogleCookies(res) {
  for (const name of ["studyroom_google_state", "studyroom_google_nonce", "studyroom_google_verifier", "studyroom_google_return", "studyroom_google_link"]) {
    res.clearCookie(name, { ...GOOGLE_COOKIE_OPTIONS, maxAge: undefined });
  }
}

function returnOriginAllowed(origin) {
  if (!origin) return false;
  if (allowedOrigins().includes(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    try { const parsed = new URL(origin); return parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname); } catch {}
  }
  return false;
}

function landingBase(origin) {
  try {
    const parsed = new URL(origin);
    if (process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(parsed.hostname)) return `${parsed.origin}/public`;
    return parsed.origin;
  } catch { return "http://localhost:5500/public"; }
}

function landingRedirect(error, returnOrigin) {
  const origin = returnOriginAllowed(returnOrigin) ? returnOrigin : allowedOrigins()[0] || "http://localhost:5500";
  return `${landingBase(origin)}/?authError=${encodeURIComponent(error)}`;
}

function appRedirect(returnOrigin) {
  if (process.env.NODE_ENV !== "production" && returnOriginAllowed(returnOrigin)) return `${returnOrigin}/public/app.html`;
  const origin = allowedOrigins()[0] || "http://localhost:5500";
  return env("FRONTEND_APP_URL") || `${origin}/public/app.html`;
}

function safeEqual(left, right) {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const a = Buffer.from(left), b = Buffer.from(right);
  return a.length === b.length && require("node:crypto").timingSafeEqual(a, b);
}

function googleStatus(_req, res) {
  res.set("Cache-Control", "no-store").json({ configured: googleOAuth.googleConfigured() });
}

function googleStart(req, res, next) {
  if (!googleOAuth.googleConfigured()) return res.status(503).json({ error: { code: "GOOGLE_NOT_CONFIGURED", message: "Google sign-in is not configured. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI on the backend." } });
  const crypto = require("node:crypto"),
    state = crypto.randomBytes(32).toString("base64url"),
    nonce = crypto.randomBytes(32).toString("base64url"),
    verifier = crypto.randomBytes(48).toString("base64url"),
    challenge = crypto.createHash("sha256").update(verifier).digest("base64url"),
    url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  let returnOrigin = "";
  try { returnOrigin = new URL(req.get("referer") || "").origin; } catch {}
  for (const [name, value] of [["studyroom_google_state", state], ["studyroom_google_nonce", nonce], ["studyroom_google_verifier", verifier]]) res.cookie(name, value, GOOGLE_COOKIE_OPTIONS);
  if (returnOriginAllowed(returnOrigin)) res.cookie("studyroom_google_return", returnOrigin, GOOGLE_COOKIE_OPTIONS);
  if (req.user) {
    const jwt = require("jsonwebtoken"), { jwtSecret } = require("../config/env");
    res.cookie("studyroom_google_link", jwt.sign({ sub: req.user._id.toString(), state }, jwtSecret(), { expiresIn: "10m" }), GOOGLE_COOKIE_OPTIONS);
  }
  url.search = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: env("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: "openid email profile",
    state,
    nonce,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  }).toString();
  try { res.redirect(302, url.toString()); }
  catch (error) { next(error); }
}

async function googleCallback(req, res) {
  const state = req.cookies?.studyroom_google_state,
    nonce = req.cookies?.studyroom_google_nonce,
    verifier = req.cookies?.studyroom_google_verifier,
    returnOrigin = req.cookies?.studyroom_google_return,
    linkToken = req.cookies?.studyroom_google_link;
  clearGoogleCookies(res);
  if (req.query.error || !safeEqual(req.query.state, state) || !nonce || !verifier || typeof req.query.code !== "string" || req.query.code.length > 2048) {
    return res.redirect(302, landingRedirect("google_failed", returnOrigin));
  }
  try {
    let linkUserId = null;
    if (linkToken) {
      const jwt = require("jsonwebtoken"), { jwtSecret } = require("../config/env");
      const claims = jwt.verify(linkToken, jwtSecret());
      if (!safeEqual(claims.state, state)) throw new Error("Invalid account link state.");
      linkUserId = claims.sub;
    }
    const idToken = await googleOAuth.exchangeCode(req.query.code, verifier),
      identity = await googleOAuth.verifyGoogleIdToken(idToken, nonce),
      user = await googleOAuth.findOrCreateGoogleUser(req.db, identity, linkUserId),
      { setSessionCookie } = require("../middleware/auth");
    setSessionCookie(res, user);
    const destination = new URL(appRedirect(returnOrigin));
    destination.searchParams.set("authSuccess", "google");
    return res.redirect(302, destination.toString());
  } catch (error) {
    if (error.code === "GOOGLE_LINK_REQUIRED") return res.redirect(302, landingRedirect("google_link_required", returnOrigin));
    if (error.code === "GOOGLE_EMAIL_MISMATCH") return res.redirect(302, landingRedirect("google_email_mismatch", returnOrigin));
    if (error.code === "GOOGLE_ACCOUNT_LINKED") return res.redirect(302, landingRedirect("google_already_linked", returnOrigin));
    if (error.code === "GOOGLE_NOT_CONFIGURED") return res.redirect(302, landingRedirect("google_not_configured", returnOrigin));
    req.log?.warn?.({ code: error.code || "GOOGLE_LOGIN_FAILED" }, "Google sign-in failed");
    return res.redirect(302, landingRedirect(error.code === "GOOGLE_NOT_CONFIGURED" ? "google_not_configured" : "google_failed", returnOrigin));
  }
}

async function register(req, res, next) {
  try {
    const user = await authService.register(req.db, req.validated);
    setSessionCookie(res, user);
    res.status(201).json({ user: authService.publicUser(user) });
  } catch (error) { next(error); }
}

async function login(req, res, next) {
  try {
    const user = await authService.login(req.db, req.validated);
    setSessionCookie(res, user, req.validated.rememberMe);
    res.json({ user: authService.publicUser(user) });
  } catch (error) { next(error); }
}

async function logout(req, res, next) {
  try {
    const token = req.cookies?.studyroom_session;
    if (token) {
      const jwt = require("jsonwebtoken"), { jwtSecret } = require("../config/env");
      const claims = jwt.verify(token, jwtSecret());
      await activity.appendActivity(req.db, { ownerId: require("mongodb").ObjectId.createFromHexString(claims.sub), eventType: "auth.logout", description: "Signed out" });
    }
    clearSessionCookie(res);
    res.json({ ok: true });
  } catch (error) {
    clearSessionCookie(res);
    if (error.status) return next(error);
    res.json({ ok: true });
  }
}

async function me(req, res) {
  res.json({ user: authService.publicUser(req.user) });
}

async function forgotPassword(req, res, next) {
  try {
    const requestOrigin = req.get("origin"),
      frontendUrl = landingBase(returnOriginAllowed(requestOrigin) ? requestOrigin : allowedOrigins()[0] || env("FRONTEND_URL", "http://localhost:5500"));
    await authService.requestPasswordReset(req.db, req.validated.email, req.app.locals.mailer || mailer, frontendUrl);
    res.status(202).json({ message: "If an account matches that address, a reset link will be sent." });
  } catch (error) { next(error); }
}

async function resetPassword(req, res, next) {
  try {
    await authService.resetPassword(req.db, req.validated);
    res.json({ ok: true, message: "Password updated. You can now sign in." });
  } catch (error) { next(error); }
}

module.exports = { register, login, logout, me, forgotPassword, resetPassword, googleStatus, googleStart, googleCallback };
