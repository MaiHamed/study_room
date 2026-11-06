const express = require("express");
const controller = require("../controllers/accountController");
const { authenticate } = require("../middleware/auth");
const { rateLimit } = require("../middleware/rateLimit");

const router = express.Router();
router.post("/clear", authenticate, rateLimit({ name: "clear", max: 3, windowMs: 60 * 60 * 1000, key: (req) => req.user._id.toString() }), controller.clear);

module.exports = router;
