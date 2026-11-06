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
  if (process.env.NODE_ENV !== "production") console.error(error);
  req.log?.error?.({ error: error.message, path: req.path }, "unhandled API error");
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Something went wrong." } });
}

module.exports = { errorHandler };
