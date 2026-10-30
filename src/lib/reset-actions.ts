"use server";

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { hashPassword } from "./auth";
import { getDb } from "./db";
import { sendMail } from "./mail";

export interface ResetState {
  error?: string;
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_TTL_MS = 15 * 60 * 1000;
const MAX_CODE_TRIES = 5;
const MAX_CODES_PER_HOUR = 3;

const sha = (salt: string, code: string) =>
  createHash("sha256").update(salt + ":" + code).digest();

// In-memory brake per client address so one machine can't spam the form.
const hits = new Map<string, { count: number; resetAt: number }>();
async function limited(kind: string, max: number): Promise<boolean> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${kind}|${ip}`;
  const now = Date.now();
  const e = hits.get(key);
  if (!e || e.resetAt <= now) {
    hits.set(key, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return false;
  }
  e.count++;
  return e.count > max;
}

/** Step 1: email a 6-digit code. Always behaves the same, so nobody can probe which emails have accounts. */
export async function requestReset(_prev: ResetState, fd: FormData): Promise<ResetState> {
  const email = str(fd.get("email")).trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 120) return { error: "Enter a valid email address" };
  if (await limited("forgot", 10)) return { error: "Too many requests. Try again later." };

  const db = getDb();
  const user = db.prepare("SELECT id, name FROM users WHERE email = ?").get(email) as
    | { id: number; name: string }
    | undefined;

  if (user) {
    const now = Date.now();
    const recent = db
      .prepare("SELECT COUNT(*) AS n, MAX(created_at) AS last FROM password_resets WHERE user_id = ? AND created_at > ?")
      .get(user.id, now - 60 * 60 * 1000) as { n: number; last: number | null };
    const tooSoon = recent.last !== null && now - recent.last < 45_000;
    if (recent.n < MAX_CODES_PER_HOUR && !tooSoon) {
      const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
      const salt = randomBytes(16).toString("hex");
      db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(user.id);
      db.prepare(
        "INSERT INTO password_resets (user_id, code_hash, salt, expires_at, attempts, created_at) VALUES (?, ?, ?, ?, 0, ?)",
      ).run(user.id, sha(salt, code).toString("hex"), salt, now + CODE_TTL_MS, now);
      // not awaited, so response time doesn't reveal whether the account exists
      void sendMail(
        email,
        "Your Money Track password reset code",
        `Hi ${user.name},\n\nYour password reset code is: ${code}\n\nIt expires in 15 minutes. If you didn't ask for this, ignore this email — your password stays the same.\n\nMoney Track`,
        `<p>Hi ${user.name.replace(/[<>&"]/g, "")},</p><p>Your password reset code is:</p><p style="font-size:28px;letter-spacing:6px;font-weight:700">${code}</p><p>It expires in 15 minutes. If you didn't ask for this, ignore this email — your password stays the same.</p>`,
      ).catch((e) => console.error("Could not send reset email:", e));
    }
  }
  redirect(`/reset-password?email=${encodeURIComponent(email)}`);
}

/** Step 2: check the code and set the new password. */
export async function resetPassword(_prev: ResetState, fd: FormData): Promise<ResetState> {
  const email = str(fd.get("email")).trim().toLowerCase();
  const code = str(fd.get("code")).replace(/\s/g, "");
  const password = str(fd.get("password"));
  const confirm = str(fd.get("confirm"));

  if (!/^\d{6}$/.test(code)) return { error: "Enter the 6-digit code from your email" };
  if (password.length < 8) return { error: "Password must be at least 8 characters" };
  if (password.length > 200) return { error: "Password is too long" };
  if (password !== confirm) return { error: "Passwords do not match" };
  if (await limited("reset", 30)) return { error: "Too many attempts. Try again later." };

  const db = getDb();
  const invalid = { error: "That code is wrong or has expired. Request a new one." };
  const user = db.prepare("SELECT id FROM users WHERE email = ?").get(email) as { id: number } | undefined;
  if (!user) return invalid;
  const row = db
    .prepare("SELECT id, code_hash, salt, expires_at, attempts FROM password_resets WHERE user_id = ?")
    .get(user.id) as
    | { id: number; code_hash: string; salt: string; expires_at: number; attempts: number }
    | undefined;
  if (!row || row.expires_at < Date.now()) return invalid;
  if (row.attempts >= MAX_CODE_TRIES) {
    db.prepare("DELETE FROM password_resets WHERE id = ?").run(row.id);
    return { error: "Too many wrong codes. Request a new code." };
  }

  const ok = timingSafeEqual(sha(row.salt, code), Buffer.from(row.code_hash, "hex"));
  if (!ok) {
    db.prepare("UPDATE password_resets SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    const left = MAX_CODE_TRIES - row.attempts - 1;
    return {
      error: left > 0 ? `Wrong code. ${left} ${left === 1 ? "try" : "tries"} left.` : "Too many wrong codes. Request a new code.",
    };
  }

  const hash = await hashPassword(password);
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hash, user.id);
    db.prepare("DELETE FROM password_resets WHERE user_id = ?").run(user.id);
    // anyone logged in with the old password is signed out
    db.prepare("DELETE FROM sessions WHERE user_id = ?").run(user.id);
  })();
  redirect("/login?reset=1");
}
