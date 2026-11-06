const crypto = require("node:crypto");
const { ApiError } = require("../utils/errors");

function rateLimit({ name, max, windowMs, key = (req) => req.ip }) {
  return async (req, _res, next) => {
    try {
      const bucket = `${name}:${key(req)}`;
      const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
      const id = crypto.createHash("sha256").update(`${bucket}:${windowStart.toISOString()}`).digest("hex");
      const result = await req.db.collection("rateLimits").findOneAndUpdate(
        { _id: id },
        { $setOnInsert: { bucket, windowStart, expiresAt: new Date(windowStart.getTime() + windowMs * 2) }, $inc: { count: 1 } },
        { upsert: true, returnDocument: "after" },
      );
      const document = result?.value || result;
      if (document.count > max) throw new ApiError(429, "RATE_LIMITED", "Too many requests. Try again later.");
      next();
    } catch (error) { next(error); }
  };
}

module.exports = { rateLimit };
