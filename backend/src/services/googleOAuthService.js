const crypto = require("node:crypto");
const { ApiError } = require("../utils/errors");
const { googleClientId, googleClientSecret, googleRedirectUri } = require("../config/env");
const { appendActivity } = require("./activity");

let jwksCache = null;

function googleConfigured() {
  return !!(googleClientId() && googleClientSecret() && googleRedirectUri());
}

function base64url(value) { return Buffer.from(value).toString("base64url"); }

async function googleKeys(force = false) {
  if (!force && jwksCache?.expiresAt > Date.now()) return jwksCache.keys;
  const response = await fetch("https://www.googleapis.com/oauth2/v3/certs", { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new ApiError(503, "GOOGLE_UNAVAILABLE", "Google sign-in is temporarily unavailable.");
  const body = await response.json();
  const maxAge = Number(/max-age=(\d+)/i.exec(response.headers.get("cache-control") || "")?.[1] || 3600);
  jwksCache = { keys: body.keys || [], expiresAt: Date.now() + Math.min(maxAge, 21600) * 1000 };
  return jwksCache.keys;
}

async function verifyGoogleIdToken(token, expectedNonce) {
  if (typeof token !== "string" || token.length > 10000) throw new ApiError(401, "INVALID_GOOGLE_TOKEN", "Google could not verify this sign-in.");
  const parts = token.split(".");
  if (parts.length !== 3) throw new ApiError(401, "INVALID_GOOGLE_TOKEN", "Google could not verify this sign-in.");
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
    claims = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  } catch { throw new ApiError(401, "INVALID_GOOGLE_TOKEN", "Google could not verify this sign-in."); }
  if (header.alg !== "RS256" || !header.kid) throw new ApiError(401, "INVALID_GOOGLE_TOKEN", "Google could not verify this sign-in.");
  let key = (await googleKeys()).find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA");
  if (!key) key = (await googleKeys(true)).find((candidate) => candidate.kid === header.kid && candidate.kty === "RSA");
  if (!key) throw new ApiError(401, "INVALID_GOOGLE_TOKEN", "Google could not verify this sign-in.");
  let signatureValid = false;
  try {
    const publicKey = crypto.createPublicKey({ key, format: "jwk" });
    signatureValid = crypto.verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), publicKey, Buffer.from(parts[2], "base64url"));
  } catch {}
  const now = Math.floor(Date.now() / 1000), audience = claims.aud;
  const audienceValid = (Array.isArray(audience) ? audience.includes(googleClientId()) : audience === googleClientId()) && (!claims.azp || claims.azp === googleClientId());
  const email = typeof claims.email === "string" ? claims.email.trim().toLowerCase() : "";
  if (!signatureValid || !["https://accounts.google.com", "accounts.google.com"].includes(claims.iss) || !audienceValid ||
      !Number.isFinite(claims.exp) || claims.exp <= now || (claims.iat && claims.iat > now + 60) ||
      claims.nonce !== expectedNonce || claims.email_verified !== true || typeof claims.sub !== "string" || !claims.sub || claims.sub.length > 255 || email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(401, "INVALID_GOOGLE_TOKEN", "Google could not verify this sign-in.");
  }
  return { sub: claims.sub, email, name: typeof claims.name === "string" ? claims.name.slice(0, 120) : "" };
}

async function exchangeCode(code, verifier) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
    body: new URLSearchParams({
      code,
      client_id: googleClientId(),
      client_secret: googleClientSecret(),
      redirect_uri: googleRedirectUri(),
      grant_type: "authorization_code",
      code_verifier: verifier,
    }),
  });
  if (!response.ok) throw new ApiError(401, "GOOGLE_EXCHANGE_FAILED", "Google sign-in could not be completed.");
  const tokens = await response.json();
  if (!tokens.id_token) throw new ApiError(401, "GOOGLE_EXCHANGE_FAILED", "Google did not return an identity token.");
  return tokens.id_token;
}

async function findOrCreateGoogleUser(db, identity, linkUserId = null) {
  let user = await db.collection("users").findOne({ googleSub: identity.sub });
  const now = new Date();
  if (linkUserId) {
    const { ObjectId } = require("mongodb"), accountId = ObjectId.isValid(linkUserId) ? new ObjectId(linkUserId) : null;
    if (!accountId) throw new ApiError(400, "INVALID_ACCOUNT", "The account selected for linking is invalid.");
    const account = await db.collection("users").findOne({ _id: accountId });
    if (!account || account.disabled) throw new ApiError(403, "ACCOUNT_DISABLED", "This account cannot be linked.");
    if (account.email !== identity.email) throw new ApiError(409, "GOOGLE_EMAIL_MISMATCH", "Sign in to Google with the same email address as your Studyroom account.");
    if (user && !user._id.equals(account._id)) throw new ApiError(409, "GOOGLE_ACCOUNT_LINKED", "This Google account is already linked to another Studyroom account.");
    if (account.googleSub && account.googleSub !== identity.sub) throw new ApiError(409, "GOOGLE_ACCOUNT_LINKED", "A different Google account is already linked to this Studyroom account.");
    await db.collection("users").updateOne({ _id: account._id }, { $set: { googleSub: identity.sub, emailVerified: true, updatedAt: now, lastActivityAt: now } });
    account.googleSub = identity.sub; account.emailVerified = true; account.updatedAt = now; account.lastActivityAt = now;
    await appendActivity(db, { ownerId: account._id, eventType: "auth.google_linked", description: "Google account linked" });
    return account;
  }
  if (!user) {
    user = await db.collection("users").findOne({ email: identity.email });
    if (user?.googleSub && user.googleSub !== identity.sub) throw new ApiError(409, "GOOGLE_ACCOUNT_LINKED", "This email is already linked to another Google account.");
    if (user?.passwordHash && !user.googleSub) throw new ApiError(409, "GOOGLE_LINK_REQUIRED", "An account already uses this email. Sign in with your password, then link Google from your account page.");
    if (user) {
      await db.collection("users").updateOne({ _id: user._id }, { $set: {
        googleSub: identity.sub,
        emailVerified: true,
        firstName: user.firstName || identity.name.split(/\s+/)[0] || "",
        lastName: user.lastName || identity.name.split(/\s+/).slice(1).join(" "),
        updatedAt: now,
        lastActivityAt: now,
      } });
      user.googleSub = identity.sub;
      user.firstName ||= identity.name.split(/\s+/)[0] || "";
      user.lastName ||= identity.name.split(/\s+/).slice(1).join(" ");
      user.updatedAt = now;
    } else {
      const parts = identity.name.trim().split(/\s+/).filter(Boolean);
      user = {
        email: identity.email,
        emailVerified: true,
        googleSub: identity.sub,
        passwordHash: null,
        firstName: parts[0] || "",
        lastName: parts.slice(1).join(" "),
        settings: { theme: "midnight", dark: false },
        streak: 0,
        lastStudy: null,
        role: "user",
        disabled: false,
        clearedAt: null,
        createdAt: now,
        updatedAt: now,
        lastActivityAt: now,
      };
      try {
        const inserted = await db.collection("users").insertOne(user);
        user._id = inserted.insertedId;
        await appendActivity(db, { ownerId: user._id, eventType: "auth.google_register", description: "Account created with Google" });
        return user;
      } catch (error) {
        if (error.code !== 11000) throw error;
        user = await db.collection("users").findOne({ $or: [{ googleSub: identity.sub }, { email: identity.email }] });
        if (!user || (user.googleSub && user.googleSub !== identity.sub)) throw new ApiError(409, "GOOGLE_ACCOUNT_LINKED", "This Google account could not be linked. Sign in with your email and password first.");
        if (user.passwordHash && !user.googleSub) throw new ApiError(409, "GOOGLE_LINK_REQUIRED", "An account already uses this email. Sign in with your password, then link Google from your account page.");
        if (!user.googleSub) {
          await db.collection("users").updateOne({ _id: user._id }, { $set: { googleSub: identity.sub, updatedAt: now } });
          user.googleSub = identity.sub;
        }
      }
    }
  }
  if (user.disabled) {
    await appendActivity(db, { ownerId: user._id, eventType: "auth.google_disabled", description: "Google sign-in rejected for disabled account" });
    throw new ApiError(403, "ACCOUNT_DISABLED", "This account is disabled.");
  }
  await db.collection("users").updateOne({ _id: user._id }, { $set: { lastActivityAt: now } });
  user.lastActivityAt = now;
  await appendActivity(db, { ownerId: user._id, eventType: "auth.google_login", description: "Signed in with Google" });
  return user;
}

module.exports = { googleConfigured, base64url, googleKeys, verifyGoogleIdToken, exchangeCode, findOrCreateGoogleUser };
