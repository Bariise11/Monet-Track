"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import {
  createSession,
  destroySession,
  hashPassword,
  verifyPassword,
} from "./auth";
import { claimLegacyData, ensureUserCategories, getDb } from "./db";

export interface AuthState {
  error?: string;
  /** values to put back in the form after an error (never the password) */
  email?: string;
  name?: string;
}

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Very small in-memory brake against password guessing: 8 failures / 15 min per email+ip.
let dummyHash: string | undefined;
const attempts = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;

function tooMany(key: string) {
  const a = attempts.get(key);
  return !!a && a.resetAt > Date.now() && a.count >= MAX_FAILS;
}
function fail(key: string) {
  const a = attempts.get(key);
  if (!a || a.resetAt <= Date.now()) attempts.set(key, { count: 1, resetAt: Date.now() + WINDOW_MS });
  else a.count++;
}

async function clientKey(email: string) {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  return `${email}|${ip}`;
}

export async function signup(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const name = str(fd.get("name")).trim().slice(0, 60);
  const email = str(fd.get("email")).trim().toLowerCase();
  const password = str(fd.get("password"));
  const confirm = str(fd.get("confirm"));

  const keep = { name, email };
  if (!name) return { error: "Enter your name", ...keep };
  if (!EMAIL_RE.test(email) || email.length > 120) return { error: "Enter a valid email address", ...keep };
  if (password.length < 8) return { error: "Password must be at least 8 characters", ...keep };
  if (password.length > 200) return { error: "Password is too long", ...keep };
  if (password !== confirm) return { error: "Passwords do not match", ...keep };

  const db = getDb();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(email))
    return { error: "An account with this email already exists", ...keep };

  const hash = await hashPassword(password);
  const isFirst = (db.prepare("SELECT COUNT(*) AS n FROM users").get() as { n: number }).n === 0;
  const info = db
    .prepare("INSERT INTO users (email, name, password_hash) VALUES (?, ?, ?)")
    .run(email, name, hash);
  const userId = Number(info.lastInsertRowid);

  // the very first account takes over any data recorded before accounts existed
  if (isFirst) claimLegacyData(db, userId);
  ensureUserCategories(db, userId);

  await createSession(userId);
  redirect("/");
}

export async function login(_prev: AuthState, fd: FormData): Promise<AuthState> {
  const email = str(fd.get("email")).trim().toLowerCase();
  const password = str(fd.get("password"));
  const key = await clientKey(email);
  if (tooMany(key)) return { error: "Too many attempts. Try again in a few minutes.", email };

  const row = getDb()
    .prepare("SELECT id, password_hash FROM users WHERE email = ?")
    .get(email) as { id: number; password_hash: string } | undefined;

  // always run a full-cost hash comparison so timing doesn't reveal whether the email exists
  dummyHash ??= await hashPassword("not-a-real-password");
  const ok = await verifyPassword(password, row ? row.password_hash : dummyHash);
  if (!row || !ok) {
    fail(key);
    return { error: "Wrong email or password", email };
  }
  attempts.delete(key);
  await createSession(row.id);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login?loggedout=1");
}
