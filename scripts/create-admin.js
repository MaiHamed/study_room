require("dotenv").config();
const { getDb, getClient, ensureIndexes } = require("../backend/src/config/database");
const { appendActivity } = require("../backend/src/services/activity");

async function main() {
  const email = String(process.argv[2] || "").trim().toLowerCase();
  if (!email) throw new Error("Usage: npm run create-admin -- user@example.com");
  const client = await getClient(), db = await getDb();
  try {
    await ensureIndexes(db);
    const user = await db.collection("users").findOne({ email });
    if (!user) throw new Error(`No account exists for ${email}. Register through Studyroom first.`);
    if (user.role === "admin") {
      process.stdout.write(`${email} is already an administrator.\n`);
      return;
    }
    const now = new Date();
    await db.collection("users").updateOne({ _id: user._id }, { $set: { role: "admin", updatedAt: now } });
    await appendActivity(db, {
      ownerId: user._id,
      eventType: "admin.bootstrap",
      description: "Administrator role granted by the deployment operator",
      resourceType: "user",
      resourceId: user._id.toString(),
      metadata: {},
    });
    process.stdout.write(`Granted administrator access to ${email}.\n`);
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
