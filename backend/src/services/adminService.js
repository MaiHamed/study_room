const { ObjectId } = require("mongodb");
const { ApiError } = require("../utils/errors");
const { appendActivity } = require("./activity");
const { publicUser } = require("./authService");

const CONTENT_COLLECTIONS = ["subjects", "questions", "cards", "exams", "attempts"];

function encodeCursor(user) {
  return Buffer.from(JSON.stringify({ createdAt: user.createdAt.toISOString(), id: user._id.toString() })).toString("base64url");
}

function decodeCursor(cursor) {
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (!value.createdAt || !ObjectId.isValid(value.id) || Number.isNaN(Date.parse(value.createdAt))) throw new Error();
    return { createdAt: new Date(value.createdAt), id: new ObjectId(value.id) };
  } catch {
    throw new ApiError(400, "INVALID_CURSOR", "User pagination cursor is invalid.");
  }
}

async function listUsers(db, { limit, cursor }) {
  const query = {};
  if (cursor) {
    const decoded = decodeCursor(cursor);
    query.$or = [
      { createdAt: { $lt: decoded.createdAt } },
      { createdAt: decoded.createdAt, _id: { $lt: decoded.id } },
    ];
  }
  const docs = await db.collection("users").find(query, {
    projection: { passwordHash: 0, resetTokenHash: 0 },
  }).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).toArray();
  const hasMore = docs.length > limit,
    users = hasMore ? docs.slice(0, limit) : docs,
    ids = users.map((user) => user._id),
    counts = {};
  for (const collection of CONTENT_COLLECTIONS) {
    counts[collection] = await db.collection(collection).aggregate([
      { $match: { ownerId: { $in: ids }, deletedAt: null } },
      { $group: { _id: "$ownerId", count: { $sum: 1 } } },
    ]).toArray();
  }
  const countMap = Object.fromEntries(Object.entries(counts).map(([collection, rows]) => [
    collection, Object.fromEntries(rows.map((row) => [row._id.toString(), row.count])),
  ]));
  return {
    users: users.map((user) => ({
      ...publicUser(user),
      contentCounts: Object.fromEntries(CONTENT_COLLECTIONS.map((collection) => [collection, countMap[collection][user._id.toString()] || 0])),
    })),
    nextCursor: hasMore ? encodeCursor(users.at(-1)) : null,
  };
}

async function adminStats(db, days = 30) {
  const since = new Date(Date.now() - days * 86400000),
    userCount = await db.collection("users").countDocuments({}),
    activeUsers = await db.collection("users").countDocuments({ disabled: { $ne: true } }),
    disabledUsers = await db.collection("users").countDocuments({ disabled: true }),
    content = {};
  await Promise.all(CONTENT_COLLECTIONS.map(async (collection) => {
    content[collection] = await db.collection(collection).countDocuments({ deletedAt: null });
  }));
  const [newUsers, activityByDay, mostActive, recent] = await Promise.all([
    db.collection("users").aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]).toArray(),
    db.collection("activityLog").aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, events: { $sum: 1 }, users: { $addToSet: "$ownerId" } } },
      { $project: { date: "$_id", events: 1, activeUsers: { $size: "$users" }, _id: 0 } },
      { $sort: { date: 1 } },
    ]).toArray(),
    db.collection("activityLog").aggregate([
      { $match: { createdAt: { $gte: since }, ownerId: { $ne: null } } },
      { $group: { _id: "$ownerId", events: { $sum: 1 }, lastActivityAt: { $max: "$createdAt" } } },
      { $sort: { events: -1 } }, { $limit: 5 },
      { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
      { $unwind: "$user" },
      { $project: { _id: 0, userId: "$_id", email: "$user.email", firstName: "$user.firstName", lastName: "$user.lastName", events: 1, lastActivityAt: 1 } },
    ]).toArray(),
    db.collection("activityLog").aggregate([
      { $match: { createdAt: { $gte: since } } },
      { $sort: { createdAt: -1, _id: -1 } }, { $limit: 12 },
      { $lookup: { from: "users", localField: "ownerId", foreignField: "_id", as: "user" } },
      { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
      { $project: { ownerId: 1, eventType: 1, description: 1, resourceType: 1, resourceId: 1, metadata: 1, createdAt: 1, email: "$user.email", firstName: "$user.firstName", lastName: "$user.lastName" } },
    ]).toArray(),
  ]);
  return {
    users: { total: userCount, active: activeUsers, disabled: disabledUsers },
    content,
    newUsers,
    activityByDay,
    mostActive,
    recentActivity: recent,
    rangeDays: days,
  };
}

async function changeRole(db, actor, id, role, mongoClient) {
  const targetId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!targetId) throw new ApiError(404, "USER_NOT_FOUND", "User was not found.");
  if (targetId.equals(actor._id)) throw new ApiError(409, "SELF_ROLE_CHANGE", "You cannot change your own role.");
  const session = mongoClient.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const target = await db.collection("users").findOne({ _id: targetId }, { session });
      if (!target) throw new ApiError(404, "USER_NOT_FOUND", "User was not found.");
      if (target.role === "admin" && role !== "admin") {
        const admins = await db.collection("users").countDocuments({ role: "admin" }, { session });
        if (admins <= 1) throw new ApiError(409, "LAST_ADMIN", "The last administrator cannot be demoted.");
      }
      updated = await db.collection("users").findOneAndUpdate(
        { _id: targetId }, { $set: { role, updatedAt: new Date() } },
        { session, returnDocument: "after", projection: { passwordHash: 0 } },
      );
      await appendActivity(db, { ownerId: actor._id, eventType: "admin.role_changed", description: "Administrator changed an account role", resourceType: "user", resourceId: targetId.toString(), metadata: { role } }, { session });
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally { await session.endSession(); }
  return publicUser(updated?.value || updated);
}

async function setDisabled(db, actor, id, disabled, mongoClient) {
  const targetId = ObjectId.isValid(id) ? new ObjectId(id) : null;
  if (!targetId) throw new ApiError(404, "USER_NOT_FOUND", "User was not found.");
  if (targetId.equals(actor._id)) throw new ApiError(409, "SELF_DISABLE", "You cannot disable your own account.");
  const session = mongoClient.startSession();
  let updated;
  try {
    await session.withTransaction(async () => {
      const target = await db.collection("users").findOne({ _id: targetId }, { session });
      if (!target) throw new ApiError(404, "USER_NOT_FOUND", "User was not found.");
      if (target.role === "admin" && !disabled) {
        const availableAdmins = await db.collection("users").countDocuments({ role: "admin", disabled: { $ne: true }, _id: { $ne: targetId } }, { session });
        if (!availableAdmins) throw new ApiError(409, "LAST_ADMIN", "The last active administrator cannot be disabled.");
      }
      updated = await db.collection("users").findOneAndUpdate(
        { _id: targetId }, { $set: { disabled, updatedAt: new Date() } },
        { session, returnDocument: "after", projection: { passwordHash: 0 } },
      );
      await appendActivity(db, { ownerId: actor._id, eventType: disabled ? "admin.user_disabled" : "admin.user_enabled", description: disabled ? "Administrator disabled an account" : "Administrator enabled an account", resourceType: "user", resourceId: targetId.toString() }, { session });
    }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" } });
  } finally { await session.endSession(); }
  return publicUser(updated?.value || updated);
}

module.exports = { listUsers, adminStats, changeRole, setDisabled, CONTENT_COLLECTIONS };
