const { ApiError } = require("../utils/errors");

function errorHandler(error, req, res, _next) {
  if (res.headersSent) return;
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ error: { code: "BODY_TOO_LARGE", message: "Request body is too large." } });
  }
  if (error instanceof SyntaxError && error.status === 400 && "body" in error) {
    return res.status(400).json({ error: { code: "INVALID_JSON", message: "Request body must be valid JSON." } });
  }
  if (error?.code === 11000) {
    return res.status(409).json({ error: { code: "DUPLICATE", message: "A record with that value already exists." } });
  }
  if (error instanceof ApiError) {
    const body = { code: error.code, message: error.message };
    if (error.details !== undefined) body.details = error.details;
    return res.status(error.status).json({ error: body });
  }
  const logDetails = {
    name: error?.name || "Error",
    code: error?.code || null,
    message: error?.message || "Unknown API error",
    method: req.method,
    path: req.path,
  };
  if (req.log?.error) req.log.error(logDetails, "unhandled API error");
  else console.error("Studyroom unhandled API error", logDetails);
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });
}

module.exports = { errorHandler };
