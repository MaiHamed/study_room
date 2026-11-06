const { ApiError } = require("../utils/errors");
const { requireObject, onlyKeys, string, array } = require("../middleware/validate");

const COMMON = ["id", "baseUpdatedAt", "deletedAt"];
const FIELDS = {
  subjects: ["name", "topics", "topicAliases", "topicDescriptions"],
  questions: ["subjectId", "topic", "questionType", "text", "options", "correct", "explanation", "sourceNumber", "importWarnings"],
  cards: ["front", "back", "subjectId", "topic", "sourceQuestionId", "due", "interval", "lastRating", "generatedForRevision"],
  exams: ["definition"],
  attempts: ["examId", "name", "subjectId", "topicName", "scope", "topicCounts", "questions", "answers", "marked", "startedAt", "minutes", "pass", "instructions", "submittedAt", "score"],
  reviews: ["wrong", "correct", "mastered", "dismissed"],
  importHashes: ["hash"],
};
const PROFILE_FIELDS = ["firstName", "lastName", "settings", "streak", "lastStudy"];

function jsonValue(value, name, maxBytes = 256 * 1024) {
  let encoded;
  try { encoded = JSON.stringify(value); }
  catch { throw new ApiError(400, "INVALID_FIELD", `${name} must contain valid JSON data.`); }
  if (Buffer.byteLength(encoded || "null", "utf8") > maxBytes) throw new ApiError(400, "INVALID_FIELD", `${name} is too large.`);
  const visit = (item, depth = 0) => {
    if (depth > 16) throw new ApiError(400, "INVALID_FIELD", `${name} is nested too deeply.`);
    if (!item || typeof item !== "object") return;
    if (Array.isArray(item)) {
      if (item.length > 2000) throw new ApiError(400, "INVALID_FIELD", `${name} has too many items.`);
      item.forEach((child) => visit(child, depth + 1));
      return;
    }
    for (const [key, child] of Object.entries(item)) {
      if (key.startsWith("$") || key.includes(".")) throw new ApiError(400, "INVALID_FIELD", `${name} contains an invalid key.`);
      visit(child, depth + 1);
    }
  };
  visit(value);
  return value;
}

function validateTimestamp(value, name, optional = true) {
  if (value === null && optional) return null;
  if (value === undefined && optional) return null;
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) throw new ApiError(400, "INVALID_FIELD", `${name} must be a valid timestamp.`);
  return new Date(value).toISOString();
}

function validateRow(collection, input) {
  const row = requireObject(input, `${collection} row`);
  onlyKeys(row, [...COMMON, ...FIELDS[collection]], `${collection} row`);
  const result = {
    id: string(row.id, `${collection}.id`, { min: 1, max: collection === "importHashes" ? 256 : 128 }),
    baseUpdatedAt: validateTimestamp(row.baseUpdatedAt, "baseUpdatedAt"),
    deletedAt: validateTimestamp(row.deletedAt, "deletedAt"),
  };
  const text = (key, max, optional = false) => {
    if (row[key] === undefined && optional) return undefined;
    return string(row[key], `${collection}.${key}`, { max });
  };
  const int = (key, min, max, optional = false) => {
    if (row[key] === undefined && optional) return undefined;
    if (!Number.isInteger(row[key]) || row[key] < min || row[key] > max) throw new ApiError(400, "INVALID_FIELD", `${collection}.${key} is outside its allowed range.`);
    return row[key];
  };
  const bool = (key, fallback = false) => {
    if (row[key] === undefined) return fallback;
    if (typeof row[key] !== "boolean") throw new ApiError(400, "INVALID_FIELD", `${collection}.${key} must be boolean.`);
    return row[key];
  };
  const json = (key, fallback, max) => jsonValue(row[key] === undefined ? fallback : row[key], `${collection}.${key}`, max);
  switch (collection) {
    case "subjects":
      result.name = text("name", 200);
      result.topics = json("topics", [], 128 * 1024);
      result.topicAliases = json("topicAliases", [], 128 * 1024);
      if (!Array.isArray(result.topics) || !Array.isArray(result.topicAliases)) throw new ApiError(400, "INVALID_FIELD", "Subject topics and topicAliases must be arrays.");
      result.topicDescriptions = row.topicDescriptions === undefined ? {} : jsonValue(row.topicDescriptions, "subjects.topicDescriptions", 64 * 1024);
      if (!result.topicDescriptions || Array.isArray(result.topicDescriptions) || typeof result.topicDescriptions !== "object" || Object.values(result.topicDescriptions).some((value) => typeof value !== "string" || value.length > 2000)) throw new ApiError(400, "INVALID_FIELD", "Subject topic descriptions are invalid.");
      break;
    case "questions":
      result.subjectId = text("subjectId", 128, true) ?? "";
      result.topic = text("topic", 300) ?? "";
      result.questionType = text("questionType", 8);
      if (!["mcq", "tf", "short"].includes(result.questionType)) throw new ApiError(400, "INVALID_FIELD", "Question type must be mcq, tf, or short.");
      result.text = text("text", 20000);
      result.options = json("options", [], 64 * 1024);
      if (!Array.isArray(result.options) || result.options.length > 20 || result.options.some((entry) => typeof entry !== "string" || entry.length > 4000)) throw new ApiError(400, "INVALID_FIELD", "Question options are invalid.");
      result.correct = jsonValue(row.correct ?? null, "questions.correct", 12000);
      result.explanation = text("explanation", 20000) ?? "";
      result.sourceNumber = row.sourceNumber === undefined ? null : string(String(row.sourceNumber), "questions.sourceNumber", { max: 40 });
      result.importWarnings = row.importWarnings === undefined ? [] : json(row.importWarnings, [], 16 * 1024);
      if (!Array.isArray(result.importWarnings) || result.importWarnings.length > 30 || result.importWarnings.some((warning) => typeof warning !== "string" || warning.length > 500)) throw new ApiError(400, "INVALID_FIELD", "Question import warnings are invalid.");
      break;
    case "cards":
      result.front = text("front", 20000);
      result.back = text("back", 20000);
      result.subjectId = text("subjectId", 128, true) ?? "";
      result.topic = text("topic", 300) ?? "";
      result.sourceQuestionId = text("sourceQuestionId", 128, true) ?? "";
      result.due = text("due", 30, true) ?? null;
      result.interval = int("interval", 0, 36500) ?? 0;
      result.lastRating = row.lastRating ?? null;
      if (result.lastRating !== null && !["again", "hard", "good", "easy"].includes(result.lastRating)) throw new ApiError(400, "INVALID_FIELD", "Card rating is invalid.");
      result.generatedForRevision = bool("generatedForRevision");
      break;
    case "exams":
      result.definition = json("definition", {}, 256 * 1024);
      if (!result.definition || Array.isArray(result.definition) || typeof result.definition !== "object") throw new ApiError(400, "INVALID_FIELD", "Exam definition must be an object.");
      break;
    case "attempts":
      result.examId = text("examId", 128, true) ?? "";
      result.name = text("name", 300) ?? "";
      result.subjectId = text("subjectId", 128, true) ?? "";
      result.topicName = text("topicName", 300) ?? "";
      result.scope = text("scope", 100) ?? "";
      result.topicCounts = row.topicCounts == null ? {} : json("topicCounts", {}, 32 * 1024);
      result.questions = json("questions", [], 1024 * 1024);
      result.answers = json("answers", [], 256 * 1024);
      result.marked = json("marked", [], 32 * 1024);
      if (!Array.isArray(result.questions) || !Array.isArray(result.answers) || !Array.isArray(result.marked) || !result.topicCounts || Array.isArray(result.topicCounts) || typeof result.topicCounts !== "object") throw new ApiError(400, "INVALID_FIELD", "Attempt snapshots have an invalid shape.");
      result.startedAt = validateTimestamp(row.startedAt, "startedAt");
      result.minutes = int("minutes", 0, 1440, true) ?? null;
      result.pass = int("pass", 0, 100, true) ?? null;
      result.instructions = text("instructions", 10000) ?? "";
      result.submittedAt = validateTimestamp(row.submittedAt, "submittedAt");
      result.score = int("score", 0, 100000, true) ?? null;
      break;
    case "reviews":
      result.wrong = int("wrong", 0, 100000000) ?? 0;
      result.correct = int("correct", 0, 100000000) ?? 0;
      result.mastered = bool("mastered");
      result.dismissed = bool("dismissed");
      break;
    case "importHashes":
      result.hash = string(row.hash, "importHashes.hash", { min: 1, max: 256 });
      if (result.id !== result.hash) throw new ApiError(400, "INVALID_FIELD", "Import hash id must equal its hash.");
      break;
  }
  return result;
}

function validatePush(value) {
  const body = requireObject(value);
  onlyKeys(body, ["profile", ...Object.keys(FIELDS)]);
  const result = {};
  if (body.profile !== undefined) {
    const profile = requireObject(body.profile, "profile");
    onlyKeys(profile, ["baseUpdatedAt", ...PROFILE_FIELDS], "profile");
    result.profile = {
      baseUpdatedAt: validateTimestamp(profile.baseUpdatedAt, "profile.baseUpdatedAt"),
      firstName: profile.firstName === undefined ? undefined : string(profile.firstName, "profile.firstName", { max: 60 }),
      lastName: profile.lastName === undefined ? undefined : string(profile.lastName, "profile.lastName", { max: 60 }),
      settings: profile.settings === undefined ? undefined : jsonValue(profile.settings, "profile.settings", 16 * 1024),
      streak: profile.streak === undefined ? undefined : profile.streak,
      lastStudy: profile.lastStudy === undefined ? undefined : profile.lastStudy,
    };
    if (result.profile.settings && (Array.isArray(result.profile.settings) || typeof result.profile.settings !== "object")) throw new ApiError(400, "INVALID_FIELD", "Profile settings must be an object.");
    if (result.profile.streak !== undefined && (!Number.isInteger(result.profile.streak) || result.profile.streak < 0 || result.profile.streak > 1000000)) throw new ApiError(400, "INVALID_FIELD", "Profile streak is invalid.");
    if (result.profile.lastStudy !== undefined && result.profile.lastStudy !== null && (typeof result.profile.lastStudy !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(result.profile.lastStudy))) throw new ApiError(400, "INVALID_FIELD", "Profile lastStudy is invalid.");
  }
  for (const collection of Object.keys(FIELDS)) {
    if (body[collection] !== undefined) result[collection] = array(body[collection], collection, 500).map((row) => validateRow(collection, row));
  }
  const encoded = JSON.stringify(result);
  if (Buffer.byteLength(encoded, "utf8") > 4 * 1024 * 1024) throw new ApiError(413, "SYNC_TOO_LARGE", "Sync batch exceeds 4 MB.");
  return result;
}

function validatePull(value) {
  const body = requireObject(value);
  onlyKeys(body, ["cursors", "pageTokens", "limit"]);
  const limit = body.limit === undefined ? 100 : body.limit;
  if (!Number.isInteger(limit) || limit < 1 || limit > 250) throw new ApiError(400, "INVALID_LIMIT", "Pull limit must be between 1 and 250.");
  const cursors = requireObject(body.cursors || {}, "cursors");
  const pageTokens = requireObject(body.pageTokens || {}, "pageTokens");
  for (const source of [cursors, pageTokens]) {
    onlyKeys(source, Object.keys(FIELDS), "cursor map");
    for (const [collection, cursor] of Object.entries(source)) {
      if (cursor === null) continue;
      requireObject(cursor, `${collection} cursor`);
      onlyKeys(cursor, ["updatedAt", "clientId"]);
      validateTimestamp(cursor.updatedAt, `${collection}.updatedAt`, false);
      string(cursor.clientId, `${collection}.clientId`, { max: 256 });
    }
  }
  return { cursors, pageTokens, limit };
}

module.exports = { validatePush, validatePull, FIELDS, PROFILE_FIELDS };
