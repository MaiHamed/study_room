const { appendActivity } = require("./activity");

const USER_DATA_COLLECTIONS = ["subjects", "questions", "cards", "exams", "attempts", "reviews", "importHashes"];

async function clearUserData(db, mongoClient, user) {
  // Delete outside a transaction so clearing a large account does not create one
  // oversized/long-running transaction. Keep the marker unchanged until all data
  // collections have been deleted; retrying after a partial failure is safe.
  for (const name of USER_DATA_COLLECTIONS) {
    await db.collection(name).deleteMany({ ownerId: user._id });
  }
  await db.collection("passwordResets").deleteMany({ ownerId: user._id });
  const session = mongoClient.startSession();
  let clearedAt;
  try {
    await session.withTransaction(async () => {
      clearedAt = new Date();
      await db.collection("users").updateOne({ _id: user._id }, { $set: { clearedAt, updatedAt: clearedAt } }, { session });
      await db.collection("activityLog").insertOne({
        ownerId: user._id,
        eventType: "account.data_cleared",
        description: "User cleared synced study data",
        resourceType: "user",
        resourceId: user._id.toString(),
        metadata: {},
        createdAt: clearedAt,
      }, { session });
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally {
    await session.endSession();
  }
  return { clearedAt };
}

async function listOwnActivity(db, user, { cursor, limit }) {
  const filter = { ownerId: user._id };
  if (cursor) filter._id = { $lt: require("mongodb").ObjectId.createFromHexString(cursor) };
  const rows = await db.collection("activityLog").find(filter, {
    projection: { ownerId: 0 },
  }).sort({ _id: -1 }).limit(limit + 1).toArray();
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { rows: page, nextCursor: hasMore ? page.at(-1)._id.toString() : null };
}

module.exports = { clearUserData, listOwnActivity, USER_DATA_COLLECTIONS };
