// Usage: npm run mail:test -- you@example.com
// Checks the SMTP settings in .env.local and sends one test email.
import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM } = process.env;
const to = process.argv[2] || SMTP_USER;

if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) {
  console.log("✗ Not configured. Open .env.local and fill in SMTP_USER and SMTP_PASS, then run this again.");
  process.exit(1);
}

const port = Number(SMTP_PORT ?? 587);
const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port,
  secure: port === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS.replace(/\s+/g, "") },
});

try {
  await transport.verify();
  console.log("✓ Logged in to", SMTP_HOST, "as", SMTP_USER);
  await transport.sendMail({
    from: MAIL_FROM?.includes("<") ? MAIL_FROM : `${MAIL_FROM ?? "Money Track"} <${SMTP_USER}>`,
    to,
    subject: "Money Track test email",
    text: "If you can read this, password-reset codes will arrive.",
  });
  console.log("✓ Test email sent to", to, "- check the inbox (and Spam).");
} catch (e) {
  console.log("✗ Failed:", e.code ?? "", e.responseCode ?? "", e.message);
  if (e.responseCode === 535 || e.code === "EAUTH")
    console.log(
      "\nGmail rejected the login. Use a 16-letter App password (https://myaccount.google.com/apppasswords),\nnot your normal password. 2-Step Verification must be ON for that page to appear.",
    );
  process.exit(1);
}
