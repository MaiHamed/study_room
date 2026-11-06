const { MongoClient } = require("mongodb");
const { mongoUri, databaseName } = require("./env");

const indexedDatabases = new WeakMap();

async function getClient() {
  if (globalThis.__studyroomMongoClientPromise) return globalThis.__studyroomMongoClientPromise;
  const uri = mongoUri();
  if (!uri) throw new Error("MONGODB_URI is not configured.");
  const client = new MongoClient(uri, {
    maxPoolSize: 5,
    minPoolSize: 0,
    maxIdleTimeMS: 30000,
    serverSelectionTimeoutMS: 8000,
  });
  globalThis.__studyroomMongoClientPromise = client.connect().catch((error) => {
    globalThis.__studyroomMongoClientPromise = null;
    throw error;
  });
  return globalThis.__studyroomMongoClientPromise;
}

async function getDb() {
  const client = await getClient();
  return client.db(databaseName());
}

function ensureIndexes(db) {
  if (!indexedDatabases.has(db)) {
    indexedDatabases.set(db, Promise.all([
      db.collection("users").createIndex({ email: 1 }, { unique: true, name: "email_unique" }),
      db.collection("users").createIndex({ googleSub: 1 }, { unique: true, sparse: true, name: "google_sub_unique" }),
      db.collection("users").createIndex({ createdAt: -1, _id: -1 }, { name: "users_created_cursor" }),
      db.collection("passwordResets").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "password_reset_ttl" }),
      db.collection("rateLimits").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0, name: "rate_limit_ttl" }),
      ...["subjects", "questions", "cards", "exams", "attempts", "reviews", "importHashes"].flatMap((name) => [
        db.collection(name).createIndex({ ownerId: 1, clientId: 1 }, { unique: true, name: "owner_client_unique" }),
        db.collection(name).createIndex({ ownerId: 1, updatedAt: 1, clientId: 1 }, { name: "sync_cursor" }),
      ]),
      db.collection("importHashes").createIndex({ ownerId: 1, hash: 1 }, { unique: true, name: "owner_hash_unique" }),
      db.collection("activityLog").createIndex({ ownerId: 1, createdAt: -1, _id: -1 }, { name: "owner_activity_recent" }),
      db.collection("activityLog").createIndex({ createdAt: -1 }, { name: "activity_recent" }),
    ]).catch((error) => {
      indexedDatabases.delete(db);
      throw error;
    }));
  }
  return indexedDatabases.get(db);
}

function resetDbCacheForTests() {
  globalThis.__studyroomMongoClientPromise = null;
}

module.exports = { getClient, getDb, ensureIndexes, resetDbCacheForTests };
