async function health(req, res, next) {
  try {
    await req.db.command({ ping: 1 });
    res.json({ status: "ok", database: "connected", timestamp: new Date().toISOString() });
  } catch (error) { next(error); }
}

module.exports = { health };
