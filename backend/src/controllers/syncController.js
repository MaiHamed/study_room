const { pushSync, pullSync } = require("../services/syncService");
const { ApiError } = require("../utils/errors");

async function push(req, res, next) {
  try {
    const result = await pushSync(req.db, req.mongoClient, req.user, req.validated);
    if (result.conflicts.length) {
      return res.status(409).json({ error: { code: "SYNC_CONFLICT", message: "Some records changed in the cloud. Pull the latest versions before retrying.", details: { conflicts: result.conflicts } } });
    }
    res.json(result);
  } catch (error) { next(error); }
}

async function pull(req, res, next) {
  try { res.json(await pullSync(req.db, req.user, req.validated)); }
  catch (error) { next(error); }
}

module.exports = { push, pull };
