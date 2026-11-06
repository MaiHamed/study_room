const express = require("express");
const { authenticate } = require("../middleware/auth");
const controller = require("../controllers/adminController");

const router = express.Router();
router.get("/", authenticate, controller.activity);

module.exports = router;
