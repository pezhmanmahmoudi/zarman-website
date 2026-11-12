/* ZarmanEx service worker: web push notifications only. It does not cache pages or data. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", event => event.waitUntil(self.clients.claim()));

self.addEventListener("push", event => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { body: event.data ? event.data.text() : "" }; }
  // Notifications are written in English only.
  event.waitUntil(self.registration.showNotification(data.title || "ZarmanEx", {
    body: data.body || "",
    icon: "/images/icon-192.png",
    // Monochrome mark for the Android status bar (without it Android shows a generic bell).
    badge: "/images/notification-badge.png",
    // When the update happened, not when the phone came back online.
    timestamp: typeof data.timestamp === "number" ? data.timestamp : Date.now(),
    // One notification per transfer: a newer update replaces the older one and alerts again.
    tag: data.tag || undefined,
    renotify: Boolean(data.tag),
    lang: "en",
    dir: "ltr",
    data: { url: typeof data.url === "string" ? data.url : "/en/dashboard" },
  }));
});

self.addEventListener("notificationclick", event => {
  event.notification.close();
  let target;
  try { target = new URL(event.notification.data && event.notification.data.url || "/", self.location.origin); }
  catch { target = new URL("/", self.location.origin); }
  if (target.origin !== self.location.origin) return;
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const exact = windows.find(client => client.url === target.href);
    if (exact) return exact.focus();
    const sameSite = windows.find(client => new URL(client.url).origin === target.origin && "navigate" in client);
    if (sameSite) {
      try { await sameSite.focus(); return await sameSite.navigate(target.href); } catch { /* fall through to a new window */ }
    }
    return self.clients.openWindow(target.href);
  })());
});
