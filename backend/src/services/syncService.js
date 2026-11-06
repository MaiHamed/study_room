const { ObjectId } = require("mongodb");
const { appendActivity } = require("./activity");
const { FIELDS } = require("../validators/sync");

const OVERLAP_MS = 2000;
const COLLECTIONS = Object.keys(FIELDS);
const IMPORT_HASH_NAMESPACE = "importHashes";

function documentKey(collection, ownerId, id) {
  if (collection === IMPORT_HASH_NAMESPACE) return `${ownerId.toString()}:${id}`;
  return new ObjectId();
}

function fieldsFromRow(collection, row) {
  const fields = {};
  for (const key of FIELDS[collection]) {
    if (row[key] !== undefined) fields[key] = row[key];
  }
  fields.deletedAt = row.deletedAt ? new Date(row.deletedAt) : null;
  if (["questions", "cards", "attempts"].includes(collection) && fields.subjectId === "") fields.subjectId = null;
  if (collection === "cards" && fields.sourceQuestionId === "") fields.sourceQuestionId = null;
  if (collection === "attempts" && fields.examId === "") fields.examId = null;
  if (collection === "importHashes") {
    fields.hash = row.hash;
    fields.clientId = row.hash;
  }
  return fields;
}

function makeConflict(collection, id, current) {
  return { collection, id, serverUpdatedAt: current?.updatedAt || null };
}

async function pushSync(db, mongoClient, user, payload) {
  const conflicts = [], versions = {};
  let synced = 0;
  const session = mongoClient.startSession();
  try {
    await session.withTransaction(async () => {
      conflicts.length = 0;
      synced = 0;
      for (const collection of COLLECTIONS) {
        for (const row of payload[collection] || []) {
          const current = await db.collection(collection).findOne(
            { ownerId: user._id, clientId: row.id },
            { session, projection: { updatedAt: 1 } },
          );
          const baseUpdatedAt = row.baseUpdatedAt ? new Date(row.baseUpdatedAt) : null;
          if ((current && (!baseUpdatedAt || current.updatedAt > baseUpdatedAt)) || (!current && baseUpdatedAt)) {
            conflicts.push(makeConflict(collection, row.id, current));
          }
        }
      }
      if (payload.profile) {
        const current = await db.collection("users").findOne(
          { _id: user._id }, { session, projection: { updatedAt: 1 } },
        );
        const base = payload.profile.baseUpdatedAt ? new Date(payload.profile.baseUpdatedAt) : null;
        if (!current || !base || current.updatedAt > base) conflicts.push(makeConflict("profile", user._id.toString(), current));
      }
      if (conflicts.length) return;

      if (payload.profile) {
        const { baseUpdatedAt, ...profileFields } = payload.profile;
        const allowedProfileFields = {};
        for (const key of ["firstName", "lastName", "settings", "streak", "lastStudy"]) {
          if (profileFields[key] !== undefined) allowedProfileFields[key] = profileFields[key];
        }
        const write = await db.collection("users").updateOne(
          { _id: user._id, updatedAt: { $lte: new Date(baseUpdatedAt) } },
          { $set: { ...allowedProfileFields, updatedAt: new Date() } },
          { session },
        );
        if (!write.matchedCount) throw new Error("SYNC_CONFLICT_RETRY");
        synced++;
      }

      for (const collection of COLLECTIONS) {
        const rows = payload[collection] || [];
        if (!rows.length) continue;
        const now = new Date();
        const operations = rows.map((row) => {
          const fields = fieldsFromRow(collection, row),
            base = row.baseUpdatedAt ? new Date(row.baseUpdatedAt) : null,
            filter = { ownerId: user._id, clientId: row.id };
          const update = {
            $set: { ...fields, updatedAt: now },
            $setOnInsert: {
              _id: documentKey(collection, user._id, row.id),
              ownerId: user._id,
              clientId: collection === "importHashes" ? row.hash : row.id,
              createdAt: now,
            },
          };
          if (base) filter.updatedAt = { $lte: base };
          return { updateOne: { filter, update, upsert: !base } };
        });
        const result = await db.collection(collection).bulkWrite(operations, { ordered: true, session });
        const matched = result.matchedCount + result.upsertedCount;
        if (matched !== rows.length) throw new Error("SYNC_CONFLICT_RETRY");
        synced += rows.length;
      }
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } catch (error) {
    if (error.message === "SYNC_CONFLICT_RETRY" || error.code === 11000) {
      return { conflicts: [{ collection: "batch", id: "", serverUpdatedAt: null }], synced: 0, versions: {} };
    }
    throw error;
  } finally {
    await session.endSession();
  }
  if (conflicts.length) return { conflicts, synced: 0, versions: {} };

  for (const collection of COLLECTIONS) {
    const ids = (payload[collection] || []).map((row) => collection === "importHashes" ? row.hash : row.id);
    if (!ids.length) continue;
    const rows = await db.collection(collection).find({ ownerId: user._id, clientId: { $in: ids } }, { projection: { clientId: 1, updatedAt: 1 } }).toArray();
    versions[collection] = Object.fromEntries(rows.map((row) => [row.clientId, row.updatedAt]));
  }
  if (payload.profile) {
    const profile = await db.collection("users").findOne({ _id: user._id }, { projection: { updatedAt: 1 } });
    versions.profile = profile?.updatedAt || null;
  }
  await appendActivity(db, {
    ownerId: user._id,
    eventType: "sync.push",
    description: "Study data synchronized",
    metadata: { rowCount: synced },
  });
  return { conflicts: [], synced, versions };
}

function serializeDocument(collection, document) {
  const result = {};
  for (const key of FIELDS[collection]) if (document[key] !== undefined) result[key] = document[key];
  if (collection === "importHashes") result.hash = document.hash;
  return {
    id: document.clientId,
    ...result,
    updatedAt: document.updatedAt,
    createdAt: document.createdAt,
    deletedAt: document.deletedAt || null,
  };
}

function cursorFilter(cursor) {
  if (!cursor) return null;
  const time = new Date(cursor.updatedAt);
  return { $or: [
    { updatedAt: { $gt: time } },
    { updatedAt: time, clientId: { $gt: cursor.clientId } },
  ] };
}

async function pullSync(db, user, { cursors, pageTokens, limit }) {
  const collections = {};
  const nextCursors = {};
  const pageTokenResults = {};
  let hasMore = false;
  for (const collection of COLLECTIONS) {
    const saved = cursors[collection] || null,
      pageToken = pageTokens[collection] || null;
    let after = pageToken;
    if (!after && saved) after = {
      updatedAt: new Date(new Date(saved.updatedAt).getTime() - OVERLAP_MS).toISOString(),
      clientId: "",
    };
    const afterFilter = cursorFilter(after),
      query = { ownerId: user._id, ...(afterFilter || {}) };
    const docs = await db.collection(collection).find(query)
      .sort({ updatedAt: 1, clientId: 1 })
      .limit(limit + 1)
      .toArray();
    const more = docs.length > limit,
      page = more ? docs.slice(0, limit) : docs;
    collections[collection] = page.map((doc) => serializeDocument(collection, doc));
    const last = page.at(-1);
    nextCursors[collection] = last ? { updatedAt: last.updatedAt, clientId: last.clientId } : saved;
    if (more) {
      hasMore = true;
      pageTokenResults[collection] = nextCursors[collection];
    }
  }
  return {
    collections,
    profile: {
      email: user.email,
      firstName: user.firstName || "",
      lastName: user.lastName || "",
      settings: user.settings || { theme: "midnight", dark: false },
      streak: user.streak || 0,
      lastStudy: user.lastStudy || null,
      role: user.role,
      clearedAt: user.clearedAt || null,
      updatedAt: user.updatedAt,
    },
    nextCursors,
    pageTokens: pageTokenResults,
    hasMore,
  };
}

module.exports = { COLLECTIONS, OVERLAP_MS, pushSync, pullSync, serializeDocument, fieldsFromRow };
