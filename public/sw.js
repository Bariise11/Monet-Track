// Service worker for Money Track:
//  1. offline support: caches only static files (icons, scripts, styles) and shows /offline.html when
//     a page can't be reached. Pages, API responses and anything with money data are NEVER cached,
//     so another person on the same device can't see them after you log out.
//  2. reminders: shows real notifications (also on phones) and opens the app when one is tapped.
// Bump CACHE_VERSION to throw away old caches after changing the list below.
const CACHE_VERSION = "v1";
const STATIC_CACHE = `money-track-static-${CACHE_VERSION}`;
const PRECACHE = [
  "/offline.html",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/icon-maskable-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .catch(() => {}) // never block installing (and reminders) on a failed precache
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("money-track-") && k !== STATIC_CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const isStaticAsset = (url) =>
  url.pathname.startsWith("/_next/static/") ||
  url.pathname.startsWith("/icons/") ||
  url.pathname === "/manifest.json" ||
  url.pathname === "/favicon.ico";

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // saving data (server actions) always goes straight to the server
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Page loads: always from the network (fresh, per-user). Only if that fails, show the offline page.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")));
    return;
  }

  // Static files: network first (always current, also during development), cache as the offline backup.
  if (isStaticAsset(url)) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req).then((hit) => hit || Response.error())),
    );
  }
  // everything else (/api/*, page data) is left alone and never cached
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const c of list) {
        if ("focus" in c) {
          c.navigate(url);
          return c.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
