process.env.NODE_ENV = "test";
process.env.GOOGLE_CLIENT_ID = "studyroom-test-client.apps.googleusercontent.com";
process.env.GOOGLE_CLIENT_SECRET = "test-google-secret";
process.env.GOOGLE_REDIRECT_URI = "http://localhost:3000/api/auth/google/callback";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { ObjectId } = require("mongodb");
const { verifyGoogleIdToken } = require("../src/services/googleOAuthService");
const { findOrCreateGoogleUser } = require("../src/services/googleOAuthService");

function tokenFor(privateKey, claims) {
  const head = Buffer.from(JSON.stringify({ alg: "RS256", kid: "test-key" })).toString("base64url"),
    payload = Buffer.from(JSON.stringify(claims)).toString("base64url"),
    signingInput = `${head}.${payload}`,
    signature = crypto.sign("RSA-SHA256", Buffer.from(signingInput), privateKey).toString("base64url");
  return `${signingInput}.${signature}`;
}

test("Google ID token validation verifies signature and required identity claims", async () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 }),
    jwk = { ...publicKey.export({ format: "jwk" }), kid: "test-key", kty: "RSA", alg: "RS256", use: "sig" },
    originalFetch = global.fetch;
  global.fetch = async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200, headers: { "cache-control": "public, max-age=300", "content-type": "application/json" } });
  const nonce = "test-nonce", now = Math.floor(Date.now() / 1000),
    claims = { iss: "https://accounts.google.com", aud: process.env.GOOGLE_CLIENT_ID, sub: "google-user-123", email: "student@example.test", email_verified: true, nonce, iat: now, exp: now + 300, name: "Study Student" };
  try {
    const identity = await verifyGoogleIdToken(tokenFor(privateKey, claims), nonce);
    assert.deepEqual(identity, { sub: "google-user-123", email: "student@example.test", name: "Study Student" });
    await assert.rejects(() => verifyGoogleIdToken(tokenFor(privateKey, { ...claims, aud: "another-client" }), nonce), { code: "INVALID_GOOGLE_TOKEN" });
    await assert.rejects(() => verifyGoogleIdToken(tokenFor(privateKey, claims), "wrong-nonce"), { code: "INVALID_GOOGLE_TOKEN" });
  } finally { global.fetch = originalFetch; }
});

test("existing password accounts require an authenticated, matching-email link", async () => {
  const account = { _id: new ObjectId(), email: "student@example.test", passwordHash: "bcrypt-hash", googleSub: null, role: "user", disabled: false },
    identity = { sub: "google-user-123", email: account.email, name: "Study Student" };
  let linked = false;
  const db = {
    collection(name) {
      if (name === "users") return {
        async findOne(filter) {
          if (filter.googleSub) return null;
          if (filter.email) return account;
          if (filter._id) return account;
          return null;
        },
        async updateOne(_filter, update) { linked = update.$set.googleSub === identity.sub; },
      };
      if (name === "activityLog") return { async insertOne() {} };
      throw new Error(`Unexpected collection ${name}`);
    },
  };
  await assert.rejects(() => findOrCreateGoogleUser(db, identity), { code: "GOOGLE_LINK_REQUIRED" });
  assert.equal(linked, false);
  const result = await findOrCreateGoogleUser(db, identity, account._id.toString());
  assert.equal(result._id.toString(), account._id.toString());
  assert.equal(linked, true);
});
