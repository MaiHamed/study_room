process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-secret-with-more-than-thirty-two-characters";
process.env.FRONTEND_URL = "http://localhost:5500";
process.env.MONGOMS_IP = "127.0.0.1";

const { before, after, beforeEach, test } = require("node:test");
const assert = require("node:assert/strict");
const request = require("supertest");
const { MongoMemoryReplSet } = require("mongodb-memory-server");
const { MongoClient } = require("mongodb");
const app = require("../src/app");
const { ensureIndexes } = require("../src/config/database");

let replicaSet;
let mongoClient;
let db;

before(async () => {
  replicaSet = await MongoMemoryReplSet.create({ replSet: { count: 1 }, instanceOpts: [{ ip: "127.0.0.1" }] });
  mongoClient = new MongoClient(replicaSet.getUri(), { maxPoolSize: 4 });
  await mongoClient.connect();
  db = mongoClient.db("studyroom_api_test");
  app.locals.db = db;
  app.locals.mongoClient = mongoClient;
  app.locals.mailer = { async sendPasswordReset() { return true; } };
  await ensureIndexes(db);
});

after(async () => {
  delete app.locals.db;
  delete app.locals.mongoClient;
  delete app.locals.mailer;
  await mongoClient?.close();
  await replicaSet?.stop();
});

beforeEach(async () => {
  for (const name of ["users", "subjects", "questions", "cards", "exams", "attempts", "reviews", "importHashes", "activityLog", "passwordResets", "rateLimits"]) {
    await db.collection(name).deleteMany({});
  }
});

async function register(email) {
  const agent = request.agent(app);
  const response = await agent.post("/api/auth/register").send({ email, password: "correct horse battery", firstName: "Study", lastName: "User" });
  assert.equal(response.status, 201, JSON.stringify(response.body));
  return { agent, user: response.body.user };
}

function subject(id, name, extra = {}) {
  return { id, baseUpdatedAt: null, name, topics: [], topicAliases: [], deletedAt: null, ...extra };
}

test("registration stores bcrypt hashes and returns no password hash", async () => {
  const { user } = await register("hash@example.test");
  const stored = await db.collection("users").findOne({ email: "hash@example.test" });
  assert.equal(user.role, "user");
  assert.equal(user.disabled, false);
  assert.equal("passwordHash" in user, false);
  assert.notEqual(stored.passwordHash, "correct horse battery");
  assert.match(stored.passwordHash, /^\$2[aby]\$/);
});

test("invalid credentials are rejected", async () => {
  await register("login@example.test");
  const response = await request(app).post("/api/auth/login").send({ email: "login@example.test", password: "wrong password" });
  assert.equal(response.status, 401);
  assert.equal(response.body.error.code, "INVALID_CREDENTIALS");
});

test("owner scoping prevents cross-user reads and writes", async () => {
  const a = await register("owner-a@example.test"),
    b = await register("owner-b@example.test");
  await b.agent.post("/api/sync/push").send({ subjects: [subject("same-id", "B private")] }).expect(200);
  await a.agent.post("/api/sync/push").send({ subjects: [subject("same-id", "A private")] }).expect(200);
  const aRows = await a.agent.post("/api/sync/pull").send({}).expect(200),
    bRows = await b.agent.post("/api/sync/pull").send({}).expect(200);
  assert.equal(aRows.body.collections.subjects[0].name, "A private");
  assert.equal(bRows.body.collections.subjects[0].name, "B private");
  await a.agent.post("/api/sync/push").send({ subjects: [{ ...subject("forbidden", "nope"), ownerId: b.user.id }] }).expect(400);
  assert.equal(await db.collection("subjects").countDocuments({ ownerId: require("mongodb").ObjectId.createFromHexString(b.user.id), name: "nope" }), 0);
});

test("role and disabled fields cannot be changed through sync; admins are required for admin endpoints", async () => {
  const { agent, user } = await register("regular@example.test");
  await agent.post("/api/sync/push").send({ profile: { baseUpdatedAt: user.updatedAt, role: "admin" } }).expect(400);
  await agent.patch(`/api/admin/users/${user.id}/role`).send({ role: "admin" }).expect(403);
  await agent.patch(`/api/admin/users/${user.id}/disabled`).send({ disabled: true }).expect(403);
  const saved = await db.collection("users").findOne({ email: user.email });
  assert.equal(saved.role, "user");
  assert.equal(saved.disabled, false);
});

test("tombstones remain available to the owning account for sync", async () => {
  const { agent } = await register("tombstone@example.test");
  const deletedAt = new Date().toISOString();
  await agent.post("/api/sync/push").send({ subjects: [subject("gone", "Removed locally", { deletedAt })] }).expect(200);
  const pulled = await agent.post("/api/sync/pull").send({}).expect(200);
  assert.equal(pulled.body.collections.subjects[0].deletedAt, deletedAt);
});

test("sync uses updatedAt conflicts and never overwrites a newer server row", async () => {
  const { agent, user } = await register("conflict@example.test");
  await agent.post("/api/sync/push").send({ subjects: [subject("conflicted", "initial")] }).expect(200);
  const ownerId = require("mongodb").ObjectId.createFromHexString(user.id),
    pulled = await agent.post("/api/sync/pull").send({}).expect(200),
    baseUpdatedAt = pulled.body.collections.subjects[0].updatedAt;
  await db.collection("subjects").updateOne({ ownerId, clientId: "conflicted" }, { $set: { name: "server latest", updatedAt: new Date(Date.now() + 5000) } });
  const response = await agent.post("/api/sync/push").send({ subjects: [subject("conflicted", "stale local", { baseUpdatedAt })] });
  assert.equal(response.status, 409);
  assert.equal(response.body.error.code, "SYNC_CONFLICT");
  assert.equal((await db.collection("subjects").findOne({ ownerId, clientId: "conflicted" })).name, "server latest");
});

test("duplicate import hashes are scoped and do not create duplicate documents", async () => {
  const { agent, user } = await register("hashes@example.test"),
    row = { id: "abc123", hash: "abc123", baseUpdatedAt: null, deletedAt: null };
  await agent.post("/api/sync/push").send({ importHashes: [row] }).expect(200);
  const retry = await agent.post("/api/sync/push").send({ importHashes: [row] });
  assert.equal(retry.status, 409);
  assert.equal(await db.collection("importHashes").countDocuments({ ownerId: require("mongodb").ObjectId.createFromHexString(user.id), hash: "abc123" }), 1);
});

test("activity is append-only through client APIs", async () => {
  const { agent } = await register("activity@example.test");
  const listing = await agent.get("/api/activity").expect(200);
  assert.ok(listing.body.rows.some((row) => row.eventType === "auth.register"));
  await agent.patch(`/api/activity/${listing.body.rows[0]._id}`).send({ description: "mutated" }).expect(404);
  await agent.delete(`/api/activity/${listing.body.rows[0]._id}`).expect(404);
});

test("disabled accounts cannot use protected sync endpoints", async () => {
  const { agent, user } = await register("disabled@example.test");
  await db.collection("users").updateOne({ _id: require("mongodb").ObjectId.createFromHexString(user.id) }, { $set: { disabled: true } });
  const response = await agent.post("/api/sync/pull").send({});
  assert.equal(response.status, 403);
  assert.equal(response.body.error.code, "ACCOUNT_DISABLED");
});

test("admin aggregates and account management are server-gated", async () => {
  const admin = await register("admin@example.test"),
    target = await register("target@example.test");
  await db.collection("users").updateOne({ email: admin.user.email }, { $set: { role: "admin" } });
  const stats = await admin.agent.get("/api/admin/stats?days=30").expect(200);
  assert.equal(stats.body.users.total, 2);
  const users = await admin.agent.get("/api/admin/users?limit=10").expect(200);
  assert.equal(users.body.users.length, 2);
  const roleChange = await admin.agent.patch(`/api/admin/users/${target.user.id}/role`).send({ role: "admin" }).expect(200);
  assert.equal(roleChange.body.user.role, "admin");
  await admin.agent.patch(`/api/admin/users/${target.user.id}/disabled`).send({ disabled: true }).expect(200);
  const blocked = await target.agent.post("/api/sync/pull").send({});
  assert.equal(blocked.status, 403);
});

test("oversized and unknown sync fields are rejected", async () => {
  const { agent } = await register("validation@example.test");
  await agent.post("/api/sync/push").send({ subjects: [subject("too-big", "x".repeat(201))] }).expect(400);
  await agent.post("/api/sync/push").send({ subjects: [subject("operator", "bad", { "$where": "true" })] }).expect(400);
});

test("clear-data removes study documents and advances clearedAt", async () => {
  const { agent, user } = await register("clear@example.test");
  await agent.post("/api/sync/push").send({ subjects: [subject("will-clear", "study data")] }).expect(200);
  const cleared = await agent.post("/api/account/clear").send({}).expect(200);
  assert.ok(cleared.body.clearedAt);
  const ownerId = require("mongodb").ObjectId.createFromHexString(user.id);
  assert.equal(await db.collection("subjects").countDocuments({ ownerId }), 0);
  assert.equal((await db.collection("users").findOne({ _id: ownerId })).clearedAt.toISOString(), cleared.body.clearedAt);
});
