import { getDb } from "./db";
import { shiftMonth } from "./format";
import { convExpr, factor, getSettings } from "./settings";
import type { Category, Transaction, TxType } from "./types";

export function getCategories(uid: number): Category[] {
  return getDb()
    .prepare("SELECT * FROM categories WHERE user_id = ? ORDER BY kind, name")
    .all(uid) as Category[];
}

export interface TxFilter {
  month?: string;
  from?: string;
  to?: string;
  type?: string;
  categoryId?: number;
  q?: string;
  limit?: number;
}

export function getTransactions(uid: number, f: TxFilter = {}): Transaction[] {
  const where: string[] = ["t.user_id = ?"];
  const args: (string | number)[] = [uid];
  if (f.from || f.to) {
    if (f.from) {
      where.push("t.date >= ?");
      args.push(f.from);
    }
    if (f.to) {
      where.push("t.date <= ?");
      args.push(f.to);
    }
  } else if (f.month) {
    where.push("t.date >= ? AND t.date < ?");
    args.push(`${f.month}-01`, `${shiftMonth(f.month, 1)}-01`);
  }
  if (f.type) {
    where.push("t.type = ?");
    args.push(f.type);
  }
  if (f.categoryId) {
    where.push("t.category_id = ?");
    args.push(f.categoryId);
  }
  if (f.q) {
    where.push("(t.note LIKE ? OR t.person LIKE ?)");
    args.push(`%${f.q}%`, `%${f.q}%`);
  }
  const sql = `
    SELECT t.*, ${convExpr(getSettings(uid), "t.amount", "t.currency")} AS converted, c.name AS category_name, c.emoji AS category_emoji, c.color AS category_color
    FROM transactions t LEFT JOIN categories c ON c.id = t.category_id AND c.user_id = t.user_id
    WHERE ${where.join(" AND ")}
    ORDER BY t.date DESC, t.id DESC
    ${f.limit ? "LIMIT " + Math.floor(f.limit) : ""}`;
  return getDb().prepare(sql).all(...args) as Transaction[];
}

function sumByType(uid: number, from: string, to: string): Record<TxType, number> {
  const rows = getDb()
    .prepare(
      `SELECT type, SUM(${convExpr(getSettings(uid))}) AS total FROM transactions WHERE user_id = ? AND date >= ? AND date < ? GROUP BY type`,
    )
    .all(uid, from, to) as { type: TxType; total: number }[];
  const out: Record<TxType, number> = {
    income: 0, expense: 0, lent: 0, borrowed: 0, repay_in: 0, repay_out: 0,
  };
  rows.forEach((r) => (out[r.type] = r.total));
  return out;
}

export type Cur = "KES" | "USD";
const CURS: Cur[] = ["KES", "USD"];
const SIGNED = `CASE WHEN type IN ('income','borrowed','repay_in') THEN amount ELSE -amount END`;

/** Opening balance for one currency: explicit value, else carried from the latest earlier explicit value. */
export function getOpeningFor(uid: number, month: string, cur: Cur): { value: number; explicit: boolean } {
  const db = getDb();
  const own = db
    .prepare("SELECT amount AS v FROM opening_balances WHERE user_id = ? AND month = ? AND currency = ?")
    .get(uid, month, cur) as { v: number } | undefined;
  if (own) return { value: own.v, explicit: true };
  const prev = db
    .prepare(
      "SELECT month, amount AS v FROM opening_balances WHERE user_id = ? AND month < ? AND currency = ? ORDER BY month DESC LIMIT 1",
    )
    .get(uid, month, cur) as { month: string; v: number } | undefined;
  const from = prev ? `${prev.month}-01` : "0000-01-01";
  const { n } = db
    .prepare(
      `SELECT COALESCE(SUM(${SIGNED}), 0) AS n FROM transactions WHERE user_id = ? AND currency = ? AND date >= ? AND date < ?`,
    )
    .get(uid, cur, from, `${month}-01`) as { n: number };
  return { value: (prev ? prev.v : 0) + n, explicit: false };
}

/** Combined opening balance in the display currency. */
export function getOpening(uid: number, month: string): { value: number; explicit: boolean } {
  const st = getSettings(uid);
  let value = 0;
  let explicit = false;
  for (const c of CURS) {
    const o = getOpeningFor(uid, month, c);
    value += o.value * factor(c, st);
    explicit = explicit || o.explicit;
  }
  return { value, explicit };
}

export interface CurBalance {
  opening: number;
  explicit: boolean;
  moneyIn: number;
  moneyOut: number;
  closing: number;
}

function getPerCurrency(uid: number, month: string): Record<Cur, CurBalance> {
  const rows = getDb()
    .prepare(
      `SELECT currency, type, SUM(amount) AS total FROM transactions
       WHERE user_id = ? AND date >= ? AND date < ? GROUP BY currency, type`,
    )
    .all(uid, `${month}-01`, `${shiftMonth(month, 1)}-01`) as { currency: Cur; type: TxType; total: number }[];
  const out = {} as Record<Cur, CurBalance>;
  for (const c of CURS) {
    const o = getOpeningFor(uid, month, c);
    let moneyIn = 0;
    let moneyOut = 0;
    for (const r of rows.filter((x) => x.currency === c)) {
      if (r.type === "income" || r.type === "borrowed" || r.type === "repay_in") moneyIn += r.total;
      else moneyOut += r.total;
    }
    out[c] = {
      opening: o.value,
      explicit: o.explicit,
      moneyIn,
      moneyOut,
      closing: o.value + moneyIn - moneyOut,
    };
  }
  return out;
}

export interface Slice {
  name: string;
  value: number;
  color: string;
  emoji: string;
}

export interface MonthSummary {
  month: string;
  opening: number;
  openingExplicit: boolean;
  totals: Record<TxType, number>;
  moneyIn: number;
  moneyOut: number;
  /** what was actually spent: expenses + loan repayments I made (lending is not spending) */
  spent: number;
  closing: number;
  breakdown: Slice[];
  perCurrency: Record<Cur, CurBalance>;
  daily: { day: string; in: number; out: number }[];
}

export function getMonthSummary(uid: number, month: string): MonthSummary {
  const db = getDb();
  const from = `${month}-01`;
  const to = `${shiftMonth(month, 1)}-01`;
  const totals = sumByType(uid, from, to);
  const op = getOpening(uid, month);
  const st = getSettings(uid);
  const moneyIn = totals.income + totals.borrowed + totals.repay_in;
  const moneyOut = totals.expense + totals.lent + totals.repay_out;

  const breakdown = db
    .prepare(
      `SELECT c.name, c.color, c.emoji, SUM(${convExpr(st, "t.amount", "t.currency")}) AS value
       FROM transactions t JOIN categories c ON c.id = t.category_id
       WHERE t.user_id = ? AND t.type = 'expense' AND t.date >= ? AND t.date < ?
       GROUP BY c.id ORDER BY value DESC`,
    )
    .all(uid, from, to) as Slice[];
  if (totals.repay_out > 0)
    breakdown.push({ name: "Loan repayments", value: totals.repay_out, color: "#0ea5e9", emoji: "↩️" });
  breakdown.sort((a, b) => b.value - a.value);

  const rows = db
    .prepare(
      `SELECT date AS day,
        SUM(CASE WHEN type IN ('income','borrowed','repay_in') THEN ${convExpr(st)} ELSE 0 END) AS inn,
        SUM(CASE WHEN type IN ('expense','repay_out') THEN ${convExpr(st)} ELSE 0 END) AS out
       FROM transactions WHERE user_id = ? AND date >= ? AND date < ? GROUP BY date ORDER BY date`,
    )
    .all(uid, from, to) as { day: string; inn: number; out: number }[];
  const map = new Map(rows.map((r) => [r.day, r]));
  const [y, m] = month.split("-").map(Number);
  const days = new Date(y, m, 0).getDate();
  const daily = Array.from({ length: days }, (_, i) => {
    const d = `${month}-${String(i + 1).padStart(2, "0")}`;
    const r = map.get(d);
    return { day: String(i + 1), in: r?.inn ?? 0, out: r?.out ?? 0 };
  });

  return {
    month,
    opening: op.value,
    openingExplicit: op.explicit,
    totals,
    moneyIn,
    moneyOut,
    spent: totals.expense + totals.repay_out,
    closing: op.value + moneyIn - moneyOut,
    breakdown,
    perCurrency: getPerCurrency(uid, month),
    daily,
  };
}

/** Last 6 months of in/out for a trend chart. */
export function getTrend(uid: number, month: string) {
  return Array.from({ length: 6 }, (_, i) => {
    const m = shiftMonth(month, i - 5);
    const t = sumByType(uid, `${m}-01`, `${shiftMonth(m, 1)}-01`);
    return {
      month: m.slice(2),
      in: t.income + t.borrowed + t.repay_in,
      out: t.expense + t.repay_out,
    };
  });
}

export interface PersonLoan {
  person: string;
  /** positive = they owe me, negative = I owe them */
  net: number;
  lent: number;
  repaidToMe: number;
  borrowed: number;
  repaidByMe: number;
}

export function getLoansByPerson(uid: number): PersonLoan[] {
  const rows = getDb()
    .prepare(
      `SELECT TRIM(person) AS person, type, SUM(${convExpr(getSettings(uid))}) AS total
       FROM transactions WHERE user_id = ? AND type IN ('lent','borrowed','repay_in','repay_out')
       GROUP BY LOWER(TRIM(person)), type`,
    )
    .all(uid) as { person: string | null; type: TxType; total: number }[];
  const map = new Map<string, PersonLoan>();
  for (const r of rows) {
    const name = r.person || "Unknown";
    const key = name.toLowerCase();
    const p =
      map.get(key) ?? { person: name, net: 0, lent: 0, repaidToMe: 0, borrowed: 0, repaidByMe: 0 };
    if (r.type === "lent") p.lent += r.total;
    if (r.type === "repay_in") p.repaidToMe += r.total;
    if (r.type === "borrowed") p.borrowed += r.total;
    if (r.type === "repay_out") p.repaidByMe += r.total;
    map.set(key, p);
  }
  return [...map.values()]
    .map((p) => ({ ...p, net: p.lent - p.repaidToMe - (p.borrowed - p.repaidByMe) }))
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));
}

export interface CurrencySpend {
  currency: "KES" | "USD";
  /** original (unconverted) amounts */
  expense: number;
  loans: number;
  total: number;
}

/** Money out in each currency's own units, no conversion. */
export function getSpendByCurrency(uid: number, month: string): CurrencySpend[] {
  const rows = getDb()
    .prepare(
      `SELECT currency, type, SUM(amount) AS total FROM transactions
       WHERE user_id = ? AND date >= ? AND date < ? AND type IN ('expense','repay_out')
       GROUP BY currency, type`,
    )
    .all(uid, `${month}-01`, `${shiftMonth(month, 1)}-01`) as {
    currency: "KES" | "USD";
    type: string;
    total: number;
  }[];
  return (["KES", "USD"] as const).map((currency) => {
    const mine = rows.filter((r) => r.currency === currency);
    const expense = mine.filter((r) => r.type === "expense").reduce((a, r) => a + r.total, 0);
    const loans = mine.filter((r) => r.type !== "expense").reduce((a, r) => a + r.total, 0);
    return { currency, expense, loans, total: expense + loans };
  });
}

export function getTransaction(uid: number, id: number): Transaction | undefined {
  return getTransactions(uid).find((t) => t.id === id);
}
