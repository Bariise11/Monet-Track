/** Browser-side helpers for showing a notification (works in a tab or on a phone). */

export const notificationsSupported = () => typeof window !== "undefined" && "Notification" in window;

export async function registerWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js");
  } catch {
    return null;
  }
}

export async function showNotification(title: string, body: string, url = "/"): Promise<boolean> {
  if (!notificationsSupported() || Notification.permission !== "granted") return false;
  try {
    const reg = (await registerWorker()) && (await navigator.serviceWorker.ready);
    if (reg) {
      await reg.showNotification(title, { body, tag: "money-track", data: { url } });
      return true;
    }
  } catch {
    // fall through to the plain Notification API
  }
  try {
    const n = new Notification(title, { body, tag: "money-track" });
    n.onclick = () => {
      window.focus();
      window.location.href = url;
    };
    return true;
  } catch {
    return false;
  }
}

export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
