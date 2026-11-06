const express = require("express");
const controller = require("../controllers/authController");
const { validate } = require("../middleware/validate");
const { authenticate, optionalAuthenticate } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const validators = require("../validators/auth");

const router = express.Router();
router.post("/register", rateLimit({ name: "register", max: 5, windowMs: 60 * 60 * 1000 }), validate(validators.validateRegister), controller.register);
router.post("/login", rateLimit({ name: "login", max: 10, windowMs: 15 * 60 * 1000, key: (req) => `${req.ip}:${String(req.body?.email || "").toLowerCase()}` }), validate(validators.validateLogin), controller.login);
router.post("/logout", controller.logout);
router.post("/forgot-password", rateLimit({ name: "forgot-password", max: 4, windowMs: 60 * 60 * 1000 }), validate(validators.validateForgotPassword), controller.forgotPassword);
router.post("/reset-password", rateLimit({ name: "reset-password", max: 8, windowMs: 60 * 60 * 1000 }), validate(validators.validateResetPassword), controller.resetPassword);
router.get("/google/status", controller.googleStatus);
router.get("/google", rateLimit({ name: "google-oauth-start", max: 20, windowMs: 15 * 60 * 1000 }), optionalAuthenticate, controller.googleStart);
router.get("/google/callback", rateLimit({ name: "google-oauth-callback", max: 20, windowMs: 15 * 60 * 1000 }), controller.googleCallback);
router.get("/me", authenticate, controller.me);

module.exports = router;
