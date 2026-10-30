"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { localDate, showNotification } from "@/lib/notify";

const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      // storage unavailable: reminders still work, just may repeat
    }
  },
};

/**
 * Daily "did you record today's money?" reminder.
 * After the chosen time, if nothing is recorded for today, shows a banner and
 * (once a day, if allowed) a browser notification. Works while the app is open in a tab.
 */
export default function ReminderManager({ enabled, time }: { enabled: boolean; time: string }) {
  const pathname = usePathname();
  const [due, setDue] = useState(false);

  const check = useCallback(async () => {
    if (!enabled) return setDue(false);
    const now = new Date();
    const today = localDate(now);
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (hhmm < time || store.get("mt-dismissed") === today) return setDue(false);
    try {
      const res = await fetch(`/api/reminder?today=${today}`, { cache: "no-store" });
      if (!res.ok) return;
      const { count } = (await res.json()) as { count: number };
      if (count > 0) return setDue(false);
      setDue(true);
      if (store.get("mt-notified") !== today) {
        store.set("mt-notified", today);
        await showNotification(
          "Money Track reminder",
          "You haven't recorded any money today. Tap to add what you spent, sent or received.",
          "/#add-transaction",
        );
      }
    } catch {
      // offline: try again at the next check
    }
  }, [enabled, time]);

  useEffect(() => {
    check();
    const id = setInterval(check, 60_000);
    const onVisible = () => document.visibilityState === "visible" && check();
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [check, pathname]);

  if (!enabled || !due) return null;
  return (
    <div className="reminder-banner no-print" role="status">
      <span>🔔 You haven&apos;t recorded any money today.</span>
      <span className="row-actions">
        <Link href="/#add-transaction" className="btn sm primary">
          Record now
        </Link>
        <button
          className="btn sm"
          onClick={() => {
            store.set("mt-dismissed", localDate());
            setDue(false);
          }}
        >
          Nothing to record today
        </button>
      </span>
    </div>
  );
}
