const { env } = require("../config/env");

async function sendPasswordReset(email, url) {
  const apiKey = env("RESEND_API_KEY");
  const from = env("MAIL_FROM");
  if (!apiKey || !from) return false;
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Reset your Studyroom password",
      text: `Use this link within one hour to reset your Studyroom password:\n\n${url}\n\nIf you did not request this, you can ignore this email.`,
    }),
  });
  if (!response.ok) throw new Error("Password reset email could not be sent.");
  return true;
}

module.exports = { sendPasswordReset };
