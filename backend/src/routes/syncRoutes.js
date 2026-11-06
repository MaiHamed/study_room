const express = require("express");
const controller = require("../controllers/syncController");
const { authenticate } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");
const { validate } = require("../middleware/validate");
const { validatePull, validatePush } = require("../validators/sync");

const router = express.Router();
router.use(authenticate, rateLimit({ name: "sync", max: 120, windowMs: 60 * 1000, key: (req) => req.user._id.toString() }));
router.post("/push", validate(validatePush), controller.push);
router.post("/pull", validate(validatePull), controller.pull);

module.exports = router;
