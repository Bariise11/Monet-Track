import { getDb } from "./db";
import type { Currency } from "./currency";

export interface Settings {
  display: Currency;
  /** How many KES one USD is worth (shared by all users) */
  rate: number;
  /** ISO time the rate was last fetched, if ever */
  updatedAt: string | null;
}

export function getSettings(userId: number): Settings {
  const db = getDb();
  const rows = db.prepare("SELECT key, value FROM settings").all() as { key: string; value: string }[];
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const mine = db
    .prepare("SELECT value FROM user_settings WHERE user_id = ? AND key = 'display_currency'")
    .get(userId) as { value: string } | undefined;
  const rate = Number(m.get("usd_to_kes"));
  return {
    display: mine?.value === "USD" ? "USD" : "KES",
    rate: Number.isFinite(rate) && rate > 0 ? rate : 129,
    updatedAt: m.get("rate_updated_at") ?? null,
  };
}

/** Multiplier turning an amount in `from` into the display currency. */
export function factor(from: string, s: Settings): number {
  if (from === s.display) return 1;
  return from === "USD" ? s.rate : 1 / s.rate;
}

/** SQL expression: amount converted into the display currency. */
export function convExpr(s: Settings, col = "amount", cur = "currency"): string {
  return `(${col} * CASE ${cur} WHEN 'USD' THEN ${factor("USD", s)} ELSE ${factor("KES", s)} END)`;
}

export interface Reminder {
  enabled: boolean;
  /** local time of day, HH:MM */
  time: string;
}

export function getReminder(userId: number): Reminder {
  const rows = getDb()
    .prepare("SELECT key, value FROM user_settings WHERE user_id = ? AND key LIKE 'reminder_%'")
    .all(userId) as { key: string; value: string }[];
  const m = new Map(rows.map((r) => [r.key, r.value]));
  const time = m.get("reminder_time") ?? "";
  return {
    enabled: m.get("reminder_enabled") === "1",
    time: /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : "20:00",
  };
}
