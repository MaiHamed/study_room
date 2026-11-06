const { clearUserData } = require("../services/accountService");

async function clear(req, res, next) {
  try { res.json(await clearUserData(req.db, req.mongoClient, req.user)); }
  catch (error) { next(error); }
}

module.exports = { clear };
