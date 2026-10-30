import nodemailer from "nodemailer";

/**
 * Sends email through the SMTP account configured in .env.local (see .env.example).
 * When SMTP is not configured (local development), the message is printed to the
 * server terminal instead so the app can still be tried without an email account.
 */
export function mailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

export async function sendMail(to: string, subject: string, text: string, html?: string) {
  if (!mailConfigured()) {
    console.log(
      `\n[mail not configured — printing instead]\nTo: ${to}\nSubject: ${subject}\n${text}\n`,
    );
    return;
  }
  const port = Number(process.env.SMTP_PORT ?? 587);
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    // Gmail shows app passwords in groups separated by spaces; the spaces aren't part of it
    auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS ?? "").replace(/\s+/g, "") },
  });
  const name = process.env.MAIL_FROM;
  await transport.sendMail({
    from: name?.includes("<") ? name : `${name || "Money Track"} <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
    html,
  });
}
