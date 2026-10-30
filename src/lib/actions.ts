"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "./auth";
import { getDb } from "./db";
import { refreshRate } from "./rate";
import { LOAN_TYPES, TX_TYPES, type TxType } from "./types";

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v.trim() : "");

function parseTx(uid: number, fd: FormData) {
  const type = str(fd.get("type")) as TxType;
  const amount = Number(str(fd.get("amount")));
  const date = str(fd.get("date"));
  const currency = str(fd.get("currency")) === "USD" ? "USD" : "KES";
  const person = str(fd.get("person")).slice(0, 80) || null;
  const note = str(fd.get("note")).slice(0, 300) || null;

  if (!TX_TYPES.some((t) => t.value === type)) throw new Error("Invalid type");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than 0");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("Invalid date");
  const isLoan = LOAN_TYPES.includes(type);
  if (isLoan && !person) throw new Error("Enter the person for a loan");

  const db = getDb();
  let categoryId: number | null = null;
  if (isLoan) {
    const row = db
      .prepare("SELECT id FROM categories WHERE user_id = ? AND kind = 'loan' LIMIT 1")
      .get(uid) as { id: number } | undefined;
    categoryId = row?.id ?? null;
  } else {
    const wanted = Number(str(fd.get("category_id"))) || null;
    if (!wanted) throw new Error("Choose a category");
    // the category must belong to this user
    const own = db
      .prepare("SELECT id FROM categories WHERE id = ? AND user_id = ?")
      .get(wanted, uid) as { id: number } | undefined;
    if (!own) throw new Error("Choose a category");
    categoryId = own.id;
  }
  return { type, amount: Math.round(amount * 100) / 100, date, currency, person, note, categoryId };
}

export async function addTransaction(fd: FormData) {
  const user = await requireUser();
  const t = parseTx(user.id, fd);
  getDb()
    .prepare(
      "INSERT INTO transactions (user_id, date, type, amount, currency, category_id, person, note) VALUES (?,?,?,?,?,?,?,?)",
    )
    .run(user.id, t.date, t.type, t.amount, t.currency, t.categoryId, t.person, t.note);
  revalidatePath("/", "layout");
}

export async function updateTransaction(id: number, fd: FormData) {
  const user = await requireUser();
  const t = parseTx(user.id, fd);
  const r = getDb()
    .prepare(
      "UPDATE transactions SET date=?, type=?, amount=?, currency=?, category_id=?, person=?, note=? WHERE id=? AND user_id=?",
    )
    .run(t.date, t.type, t.amount, t.currency, t.categoryId, t.person, t.note, id, user.id);
  if (r.changes === 0) throw new Error("Transaction not found");
  revalidatePath("/", "layout");
}

export async function deleteTransaction(id: number) {
  const user = await requireUser();
  getDb().prepare("DELETE FROM transactions WHERE id = ? AND user_id = ?").run(id, user.id);
  revalidatePath("/", "layout");
}

export async function setOpeningBalance(fd: FormData) {
  const user = await requireUser();
  const month = str(fd.get("month"));
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Invalid month");
  const db = getDb();
  for (const cur of ["KES", "USD"]) {
    const raw = str(fd.get(`opening_${cur}`));
    if (raw === "") {
      db.prepare("DELETE FROM opening_balances WHERE user_id = ? AND month = ? AND currency = ?").run(
        user.id,
        month,
        cur,
      );
      continue;
    }
    const v = Number(raw);
    if (!Number.isFinite(v)) throw new Error("Invalid amount");
    db.prepare(
      "INSERT INTO opening_balances (user_id, month, currency, amount) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, month, currency) DO UPDATE SET amount = excluded.amount",
    ).run(user.id, month, cur, v);
  }
  revalidatePath("/", "layout");
}

export async function addCategory(fd: FormData) {
  const user = await requireUser();
  const name = str(fd.get("name")).slice(0, 40);
  const kind = str(fd.get("kind"));
  const emoji = str(fd.get("emoji")).slice(0, 8) || "📦";
  const color = str(fd.get("color")) || "#64748b";
  if (!name) throw new Error("Name required");
  if (kind !== "income" && kind !== "expense") throw new Error("Invalid kind");
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) throw new Error("Invalid color");
  getDb()
    .prepare("INSERT OR IGNORE INTO categories (user_id, name, kind, emoji, color) VALUES (?,?,?,?,?)")
    .run(user.id, name, kind, emoji, color);
  revalidatePath("/", "layout");
}

export async function deleteCategory(id: number) {
  const user = await requireUser();
  const db = getDb();
  const used = db
    .prepare("SELECT COUNT(*) AS n FROM transactions WHERE category_id = ? AND user_id = ?")
    .get(id, user.id) as { n: number };
  const cat = db.prepare("SELECT kind FROM categories WHERE id = ? AND user_id = ?").get(id, user.id) as
    | { kind: string }
    | undefined;
  if (!cat || cat.kind === "loan" || used.n > 0) return; // protected: in use / loan category
  db.prepare("DELETE FROM categories WHERE id = ? AND user_id = ?").run(id, user.id);
  revalidatePath("/", "layout");
}

export async function saveSettings(fd: FormData) {
  const user = await requireUser();
  const display = str(fd.get("display")) === "USD" ? "USD" : "KES";
  getDb()
    .prepare(
      "INSERT INTO user_settings (user_id, key, value) VALUES (?, 'display_currency', ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value",
    )
    .run(user.id, display);
  revalidatePath("/", "layout");
}

export async function refreshRateNow() {
  await requireUser();
  await refreshRate(true);
  revalidatePath("/", "layout");
}

export async function saveReminder(fd: FormData) {
  const user = await requireUser();
  const enabled = str(fd.get("enabled")) === "on" ? "1" : "0";
  const time = str(fd.get("time"));
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new Error("Choose a valid time");
  const up = getDb().prepare(
    "INSERT INTO user_settings (user_id, key, value) VALUES (?, ?, ?) ON CONFLICT(user_id, key) DO UPDATE SET value = excluded.value",
  );
  up.run(user.id, "reminder_enabled", enabled);
  up.run(user.id, "reminder_time", time);
  revalidatePath("/", "layout");
}
