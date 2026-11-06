const express = require("express");
const cookieParser = require("cookie-parser");
const cors = require("cors");
const helmet = require("helmet");
const { getClient, getDb, ensureIndexes } = require("./config/database");
const { allowedOrigins } = require("./config/env");
const { ApiError } = require("./utils/errors");
const { errorHandler } = require("./middleware/errorHandler");

function originAllowed(req, origin) {
  if (!origin) return true;
  if (allowedOrigins().includes(origin)) return true;
  if (process.env.NODE_ENV !== "production") {
    try {
      const parsed = new URL(origin);
      if (parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname)) return true;
    } catch {}
  }
  try {
    const parsed = new URL(origin),
      host = req.get("x-forwarded-host") || req.get("host"),
      protocol = req.get("x-forwarded-proto") || req.protocol;
    return parsed.host === host && parsed.protocol.replace(":", "") === protocol;
  } catch { return false; }
}

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({
  credentials: true,
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "X-Requested-With"],
  origin(origin, callback) {
    if (!origin) return callback(null, true);
    let localDev = false;
    if (process.env.NODE_ENV !== "production") {
      try { const parsed = new URL(origin); localDev = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname); } catch {}
    }
    const accepted = allowedOrigins().includes(origin) || localDev;
    if (accepted) return callback(null, true);
    return callback(null, false);
  },
}));
app.use((req, _res, next) => {
  const origin = req.get("origin");
  if (origin && !originAllowed(req, origin)) return next(new ApiError(403, "ORIGIN_DENIED", "This website is not allowed to call the API."));
  next();
});
app.use(express.json({ limit: "5mb", strict: true }));
app.use(cookieParser());
app.use(async (req, _res, next) => {
  try {
    if (app.locals.db) {
      req.db = app.locals.db;
      req.mongoClient = app.locals.mongoClient;
    } else {
      const client = await getClient();
      req.mongoClient = client;
      req.db = await getDb();
    }
    await ensureIndexes(req.db);
    next();
  } catch (error) { next(error); }
});

app.use("/api/health", require("./routes/healthRoutes"));
app.use("/api/auth", require("./routes/authRoutes"));
app.use("/api/sync", require("./routes/syncRoutes"));
app.use("/api/admin", require("./routes/adminRoutes"));
app.use("/api/account", require("./routes/accountRoutes"));
app.use("/api/activity", require("./routes/activityRoutes"));

app.use((req, _res, next) => next(new ApiError(404, "NOT_FOUND", `No API route for ${req.method} ${req.path}.`)));
app.use(errorHandler);

module.exports = app;
