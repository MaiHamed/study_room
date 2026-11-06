const { ApiError } = require("../utils/errors");

function validate(validator) {
  return (req, _res, next) => {
    try {
      req.validated = validator(req.body || {});
      next();
    } catch (error) {
      next(error);
    }
  };
}

function requireObject(value, name = "body") {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(400, "INVALID_BODY", `${name} must be an object.`);
  }
  return value;
}

function onlyKeys(value, keys, name = "body") {
  const unknown = Object.keys(value).filter((key) => !keys.includes(key));
  if (unknown.length) throw new ApiError(400, "UNKNOWN_FIELDS", `${name} contains unsupported fields.`, { fields: unknown });
}

function string(value, name, { min = 0, max = 500, optional = false, trim = true } = {}) {
  if (optional && (value === undefined || value === null)) return undefined;
  if (typeof value !== "string") throw new ApiError(400, "INVALID_FIELD", `${name} must be text.`);
  const result = trim ? value.trim() : value;
  if (result.length < min || result.length > max) throw new ApiError(400, "INVALID_FIELD", `${name} must be between ${min} and ${max} characters.`);
  return result;
}

function email(value) {
  const result = string(value, "email", { min: 3, max: 254 }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result)) throw new ApiError(400, "INVALID_EMAIL", "Enter a valid email address.");
  return result;
}

function array(value, name, max = 1000) {
  if (!Array.isArray(value) || value.length > max) throw new ApiError(400, "INVALID_FIELD", `${name} must be an array with at most ${max} items.`);
  return value;
}

function integer(value, name, { min = 0, max = Number.MAX_SAFE_INTEGER, optional = false } = {}) {
  if (optional && value === undefined) return undefined;
  if (!Number.isInteger(value) || value < min || value > max) throw new ApiError(400, "INVALID_FIELD", `${name} is outside its allowed range.`);
  return value;
}

module.exports = { validate, requireObject, onlyKeys, string, email, array, integer };
