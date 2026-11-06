const { requireObject, onlyKeys, email, string } = require("../middleware/validate");
const { ApiError } = require("../utils/errors");

function validateRegister(value) {
  const body = requireObject(value);
  onlyKeys(body, ["email", "password", "firstName", "lastName"]);
  return {
    email: email(body.email),
    password: string(body.password, "password", { min: 10, max: 128, trim: false }),
    firstName: string(body.firstName ?? "", "firstName", { max: 60 }),
    lastName: string(body.lastName ?? "", "lastName", { max: 60 }),
  };
}

function validateLogin(value) {
  const body = requireObject(value);
  onlyKeys(body, ["email", "password", "rememberMe"]);
  if (body.rememberMe !== undefined && typeof body.rememberMe !== "boolean") throw new ApiError(400, "INVALID_FIELD", "rememberMe must be boolean.");
  return { email: email(body.email), password: string(body.password, "password", { min: 1, max: 128, trim: false }), rememberMe: body.rememberMe === true };
}

function validateForgotPassword(value) {
  const body = requireObject(value);
  onlyKeys(body, ["email"]);
  return { email: email(body.email) };
}

function validateResetPassword(value) {
  const body = requireObject(value);
  onlyKeys(body, ["token", "password"]);
  return {
    token: string(body.token, "token", { min: 40, max: 256 }),
    password: string(body.password, "password", { min: 10, max: 128, trim: false }),
  };
}

module.exports = { validateRegister, validateLogin, validateForgotPassword, validateResetPassword };
