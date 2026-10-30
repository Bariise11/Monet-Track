"use client";

import { useEffect, useState } from "react";
import SubmitButton from "@/components/SubmitButton";
import { saveReminder } from "@/lib/actions";
import { notificationsSupported, showNotification } from "@/lib/notify";

export default function ReminderSettings({ enabled, time }: { enabled: boolean; time: string }) {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    setPerm(notificationsSupported() ? Notification.permission : "unsupported");
  }, []);

  async function allow() {
    if (!notificationsSupported()) return;
    setPerm(await Notification.requestPermission());
  }

  async function test() {
    const ok = await showNotification(
      "Money Track reminder",
      "This is how your daily reminder will look.",
      "/#add-transaction",
    );
    setMsg(
      ok
        ? "Test sent — check your notifications."
        : "Could not show a notification. Click “Allow notifications” first.",
    );
  }

  return (
    <form action={saveReminder} className="card inline-form">
      <label style={{ flex: "0 0 auto", minWidth: 0, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <input type="checkbox" name="enabled" defaultChecked={enabled} style={{ width: "auto" }} />
        <span style={{ color: "var(--text)", fontSize: "0.95rem" }}>🔔 Daily reminder to record my money</span>
      </label>
      <label style={{ maxWidth: 150 }}>
        Remind me at
        <input type="time" name="time" defaultValue={time} required />
      </label>
      <SubmitButton pendingText="Saving…">Save</SubmitButton>
      <button
        type="button"
        className="btn"
        onClick={allow}
        disabled={perm === "granted" || perm === "unsupported" || perm === "denied"}
      >
        {perm === "granted"
          ? "✓ Notifications allowed"
          : perm === "denied"
            ? "Blocked in browser"
            : "Allow notifications"}
      </button>
      <button type="button" className="btn" onClick={test}>
        Send test
      </button>
      <span className="muted" style={{ fontSize: "0.8rem", flexBasis: "100%" }}>
        {msg ||
          (perm === "denied"
            ? "Notifications are blocked. Enable them for this site in your browser settings; the in-app banner still works."
            : perm === "unsupported"
              ? "This browser can't show notifications; you'll still see the banner in the app."
              : "If nothing is recorded for today by that time, you get a banner and a notification. Works while Money Track is open in a browser tab.")}
      </span>
    </form>
  );
}
