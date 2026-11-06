const express = require("express");
const controller = require("../controllers/adminController");
const { authenticate } = require("../middleware/auth");
const { requireAdmin } = require("../middleware/requireAdmin");
const { validate } = require("../middleware/validate");
const validators = require("../validators/admin");

const router = express.Router();
router.use(authenticate, requireAdmin);
router.get("/stats", validateQuery(validators.validateStatsQuery), controller.stats);
router.get("/users", validateQuery(validators.validateUsersQuery), controller.users);
router.patch("/users/:id/role", validate(validators.validateRole), controller.setRole);
router.patch("/users/:id/disabled", validate(validators.validateDisabled), controller.setDisabled);

function validateQuery(validator) {
  return (req, _res, next) => {
    try { req.validated = validator(req.query); next(); }
    catch (error) { next(error); }
  };
}

module.exports = router;
