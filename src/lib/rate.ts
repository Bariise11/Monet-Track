import { getDb } from "./db";

const MAX_AGE_MS = 6 * 60 * 60 * 1000; // refresh the live rate at most every 6 hours
const RETRY_MS = 30 * 60 * 1000; // after a failed attempt (e.g. offline), wait before trying again

function put(key: string, value: string) {
  getDb()
    .prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    )
    .run(key, value);
}

function ageOf(key: string): number {
  const row = getDb().prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row ? Date.now() - new Date(row.value).getTime() : Infinity;
}

let inFlight: Promise<void> | null = null;

/** Fetch the live USD→KES rate. Keeps the last saved rate if the request fails. */
export function refreshRate(force = false): Promise<void> {
  if (!force && (ageOf("rate_updated_at") < MAX_AGE_MS || ageOf("rate_checked_at") < RETRY_MS)) {
    return Promise.resolve();
  }
  if (inFlight) return inFlight;
  inFlight = (async () => {
    // remember the attempt first, so a slow or failing network can't make every page wait
    put("rate_checked_at", new Date().toISOString());
    try {
      const res = await fetch("https://open.er-api.com/v6/latest/USD", {
        signal: AbortSignal.timeout(5000),
        cache: "no-store",
      });
      const data = (await res.json()) as { result?: string; rates?: { KES?: number } };
      const kes = data.rates?.KES;
      if (data.result === "success" && typeof kes === "number" && kes > 10 && kes < 1000) {
        put("usd_to_kes", String(kes));
        put("rate_updated_at", new Date().toISOString());
      }
    } catch {
      // offline or API down: keep using the last saved rate
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Start a refresh without making the page wait for it. */
export function refreshRateInBackground(): void {
  void refreshRate().catch(() => {});
}
