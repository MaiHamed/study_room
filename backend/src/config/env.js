const path = require("node:path");
require("dotenv").config({ path: path.resolve(process.cwd(), ".env") });

function env(name, fallback = "") {
  return String(process.env[name] ?? fallback).trim();
}

function allowedOrigins() {
  return env("FRONTEND_URL", "http://localhost:5500")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function jwtSecret() {
  const value = env("JWT_SECRET");
  if (value.length < 32 && process.env.NODE_ENV !== "test") {
    throw new Error("JWT_SECRET must contain at least 32 characters.");
  }
  return value || "test-only-studyroom-secret-not-for-production";
}

module.exports = {
  env,
  allowedOrigins,
  jwtSecret,
  mongoUri: () => env("MONGODB_URI"),
  databaseName: () => env("MONGODB_DB_NAME", "studyroom"),
  jwtExpiresIn: () => env("JWT_EXPIRES_IN", "7d"),
  frontendAppUrl: () => env("FRONTEND_APP_URL"),
  googleClientId: () => env("GOOGLE_CLIENT_ID"),
  googleClientSecret: () => env("GOOGLE_CLIENT_SECRET"),
  googleRedirectUri: () => env("GOOGLE_REDIRECT_URI"),
  port: () => Number(env("PORT", "3000")) || 3000,
};
