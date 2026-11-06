const adminService = require("../services/adminService");
const { ApiError } = require("../utils/errors");

async function stats(req, res, next) {
  try { res.json(await adminService.adminStats(req.db, req.validated.days)); }
  catch (error) { next(error); }
}

async function users(req, res, next) {
  try { res.json(await adminService.listUsers(req.db, req.validated)); }
  catch (error) { next(error); }
}

async function setRole(req, res, next) {
  try {
    const user = await adminService.changeRole(req.db, req.user, req.params.id, req.validated.role, req.mongoClient);
    res.json({ user });
  } catch (error) { next(error); }
}

async function setDisabled(req, res, next) {
  try {
    const user = await adminService.setDisabled(req.db, req.user, req.params.id, req.validated.disabled, req.mongoClient);
    res.json({ user });
  } catch (error) { next(error); }
}

async function activity(req, res, next) {
  try {
    const { listOwnActivity } = require("../services/accountService");
    const limit = req.query.limit === undefined ? 50 : Number(req.query.limit);
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new ApiError(400, "INVALID_LIMIT", "Activity limit must be between 1 and 100.");
    const cursor = req.query.cursor || null;
    if (cursor && !/^[a-f\d]{24}$/i.test(cursor)) throw new ApiError(400, "INVALID_CURSOR", "Activity cursor is invalid.");
    res.json(await listOwnActivity(req.db, req.user, { cursor, limit }));
  } catch (error) { next(error); }
}

module.exports = { stats, users, setRole, setDisabled, activity };
