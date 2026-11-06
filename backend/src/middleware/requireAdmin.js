const { ApiError } = require("../utils/errors");

function requireAdmin(req, _res, next) {
  if (!req.user || req.user.role !== "admin") {
    return next(new ApiError(403, "FORBIDDEN", "Administrator access is required."));
  }
  next();
}

module.exports = { requireAdmin };
