const { ApiError } = require("../utils/errors");
const { requireObject, onlyKeys, string } = require("../middleware/validate");

function validateRole(value) {
  const body = requireObject(value);
  onlyKeys(body, ["role"]);
  if (!['user', 'admin'].includes(body.role)) throw new ApiError(400, "INVALID_ROLE", "Role must be user or admin.");
  return { role: body.role };
}

function validateDisabled(value) {
  const body = requireObject(value);
  onlyKeys(body, ["disabled"]);
  if (typeof body.disabled !== "boolean") throw new ApiError(400, "INVALID_FIELD", "disabled must be boolean.");
  return { disabled: body.disabled };
}

function validateUsersQuery(query) {
  const limit = query.limit === undefined ? 25 : Number(query.limit);
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(400, "INVALID_LIMIT", "User page limit must be between 1 and 100.");
  const cursor = query.cursor === undefined ? null : string(query.cursor, "cursor", { min: 1, max: 512 });
  return { limit, cursor };
}

function validateStatsQuery(query) {
  const days = query.days === undefined ? 30 : Number(query.days);
  if (!Number.isInteger(days) || days < 1 || days > 365) throw new ApiError(400, "INVALID_RANGE", "days must be between 1 and 365.");
  return { days };
}

module.exports = { validateRole, validateDisabled, validateUsersQuery, validateStatsQuery };
