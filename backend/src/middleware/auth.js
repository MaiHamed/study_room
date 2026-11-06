const jwt = require("jsonwebtoken");
const { jwtSecret } = require("../config/env");
const { ApiError } = require("../utils/errors");

const COOKIE_NAME = "studyroom_session";

function issueToken(user, rememberMe = false) {
  return jwt.sign({ sub: user._id.toString() }, jwtSecret(), { expiresIn: rememberMe ? "30d" : require("../config/env").jwtExpiresIn() });
}

function cookieOptions(rememberMe = false) {
  const production = process.env.NODE_ENV === "production";
  return {
    httpOnly: true,
    secure: production,
    sameSite: process.env.COOKIE_SAME_SITE || "lax",
    path: "/api",
    maxAge: rememberMe ? 30 * 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000,
  };
}

function setSessionCookie(res, user, rememberMe = false) {
  res.cookie(COOKIE_NAME, issueToken(user, rememberMe), cookieOptions(rememberMe));
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

async function authenticate(req, _res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) throw new ApiError(401, "UNAUTHENTICATED", "Sign in to continue.");
    let claims;
    try { claims = jwt.verify(token, jwtSecret()); }
    catch { throw new ApiError(401, "INVALID_SESSION", "Your session has expired. Sign in again."); }
    const { ObjectId } = require("mongodb");
    if (!ObjectId.isValid(claims.sub)) throw new ApiError(401, "INVALID_SESSION", "Your session is invalid.");
    const user = await req.db.collection("users").findOne({ _id: new ObjectId(claims.sub) });
    if (!user) throw new ApiError(401, "INVALID_SESSION", "Your account could not be found.");
    if (user.disabled) throw new ApiError(403, "ACCOUNT_DISABLED", "This account is disabled.");
    req.user = user;
    next();
  } catch (error) { next(error); }
}

async function optionalAuthenticate(req, _res, next) {
  try {
    const token = req.cookies?.[COOKIE_NAME];
    if (!token) return next();
    const claims = jwt.verify(token, jwtSecret());
    const { ObjectId } = require("mongodb");
    if (ObjectId.isValid(claims.sub)) {
      const user = await req.db.collection("users").findOne({ _id: new ObjectId(claims.sub) });
      if (user && !user.disabled) req.user = user;
    }
    next();
  } catch { next(); }
}

module.exports = { COOKIE_NAME, issueToken, cookieOptions, setSessionCookie, clearSessionCookie, authenticate, optionalAuthenticate };
