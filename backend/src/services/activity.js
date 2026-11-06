const { BSON } = require("mongodb");
const { ApiError } = require("../utils/errors");

const MAX_METADATA_BYTES = 16 * 1024;

async function appendActivity(db, event, options = {}) {
  const metadata = event.metadata || {};
  if (!metadata || Array.isArray(metadata) || typeof metadata !== "object" || BSON.calculateObjectSize(metadata) > MAX_METADATA_BYTES) {
    throw new ApiError(400, "INVALID_ACTIVITY", "Activity metadata must be an object no larger than 16 KB.");
  }
  const record = {
    ownerId: event.ownerId || null,
    eventType: event.eventType,
    description: event.description || "",
    resourceType: event.resourceType || null,
    resourceId: event.resourceId || null,
    metadata,
    createdAt: new Date(),
  };
  await db.collection("activityLog").insertOne(record, options);
  return record;
}

module.exports = { appendActivity, MAX_METADATA_BYTES };
