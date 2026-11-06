const crypto = require("node:crypto");
const bcrypt = require("bcrypt");
const { ObjectId } = require("mongodb");
const { ApiError } = require("../utils/errors");
const { appendActivity } = require("./activity");

function publicUser(user) {
  if (!user) return null;
  return {
    id: user._id.toString(),
    email: user.email,
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    settings: user.settings || { theme: "midnight", dark: false },
    streak: user.streak || 0,
    lastStudy: user.lastStudy || null,
    role: user.role,
    disabled: !!user.disabled,
    clearedAt: user.clearedAt || null,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    lastActivityAt: user.lastActivityAt || null,
  };
}

async function register(db, input) {
  const now = new Date();
  const user = {
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, 12),
    firstName: input.firstName,
    lastName: input.lastName,
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
  try { await db.collection("users").insertOne(user); }
  catch (error) {
    if (error.code === 11000) throw new ApiError(409, "EMAIL_IN_USE", "An account with that email already exists.");
    throw error;
  }
  await appendActivity(db, { ownerId: user._id, eventType: "auth.register", description: "Account created" });
  return user;
}

async function login(db, input) {
  const user = await db.collection("users").findOne({ email: input.email });
  const valid = user?.passwordHash ? await bcrypt.compare(input.password, user.passwordHash) : await bcrypt.compare(input.password, "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy");
  if (!user || !valid) throw new ApiError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  if (user.disabled) {
    await appendActivity(db, { ownerId: user._id, eventType: "auth.login_disabled", description: "Sign-in rejected for disabled account" });
    throw new ApiError(403, "ACCOUNT_DISABLED", "This account is disabled.");
  }
  const now = new Date();
  await db.collection("users").updateOne({ _id: user._id }, { $set: { lastActivityAt: now } });
  await appendActivity(db, { ownerId: user._id, eventType: "auth.login", description: "Signed in" });
  user.lastActivityAt = now;
  return user;
}

async function requestPasswordReset(db, email, mailer, frontendUrl) {
  const user = await db.collection("users").findOne({ email }, { projection: { _id: 1, email: 1 } });
  if (!user) return;
  const token = crypto.randomBytes(32).toString("base64url"),
    tokenHash = crypto.createHash("sha256").update(token).digest("hex"),
    expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  await db.collection("passwordResets").deleteMany({ ownerId: user._id });
  await db.collection("passwordResets").insertOne({ ownerId: user._id, tokenHash, expiresAt, createdAt: new Date() });
  try {
    await mailer.sendPasswordReset(user.email, `${frontendUrl}/?resetToken=${encodeURIComponent(token)}`);
  } catch (error) {
    await db.collection("passwordResets").deleteOne({ tokenHash });
    // Keep the public response identical for existing and unknown addresses.
    process.stderr.write(`Studyroom password reset email failed: ${error.message}\n`);
  }
}

async function resetPassword(db, input) {
  const tokenHash = crypto.createHash("sha256").update(input.token).digest("hex"),
    reset = await db.collection("passwordResets").findOne({ tokenHash, expiresAt: { $gt: new Date() } });
  if (!reset) throw new ApiError(400, "INVALID_RESET_TOKEN", "This password reset link is invalid or expired.");
  const passwordHash = await bcrypt.hash(input.password, 12), now = new Date();
  await db.collection("users").updateOne({ _id: reset.ownerId }, { $set: { passwordHash, updatedAt: now } });
  await db.collection("passwordResets").deleteMany({ ownerId: reset.ownerId });
  await appendActivity(db, { ownerId: reset.ownerId, eventType: "auth.password_reset", description: "Password reset completed" });
}

async function updateLastActivity(db, ownerId) {
  const user = await db.collection("users").findOne({ _id: new ObjectId(ownerId) }, { projection: { lastActivityAt: 1 } });
  if (!user?.lastActivityAt || Date.now() - user.lastActivityAt.getTime() > 5 * 60 * 1000) {
    await db.collection("users").updateOne({ _id: new ObjectId(ownerId) }, { $set: { lastActivityAt: new Date() } });
  }
}

module.exports = { publicUser, register, login, requestPasswordReset, resetPassword, updateLastActivity };
