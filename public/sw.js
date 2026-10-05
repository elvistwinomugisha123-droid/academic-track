/* global self, caches */
const CACHE = "ate-shell-v1";
const PUBLIC_SHELL = ["/offline.html", "/icons/ate.svg", "/icons/ate-maskable.svg"];

self.addEventListener("install", (event) => { event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_SHELL))); });
self.addEventListener("activate", (event) => { event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))])); });
self.addEventListener("message", (event) => { if (event.data?.type === "SKIP_WAITING") self.skipWaiting(); });
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === "navigate") event.respondWith(fetch(event.request).catch(() => caches.match("/offline.html")));
  else if (PUBLIC_SHELL.includes(url.pathname)) event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
self.addEventListener("push", (event) => {
  let payload = { title: "ATE", body: "Open ATE to review your teaching day.", deepLink: "/workspace", tag: "ate-update" };
  try { payload = { ...payload, ...event.data.json() }; } catch { /* privacy-safe fallback */ }
  const deepLink = typeof payload.deepLink === "string" && /^\/workspace(?:\/|$)/.test(payload.deepLink) ? payload.deepLink : "/workspace";
  event.waitUntil(self.registration.showNotification(String(payload.title).slice(0, 80), { body: String(payload.body).slice(0, 180), tag: String(payload.tag || "ate-notification"), data: { deepLink }, renotify: false }));
});
self.addEventListener("notificationclick", (event) => {
  event.notification.close(); const deepLink = /^\/workspace(?:\/|$)/.test(event.notification.data?.deepLink || "") ? event.notification.data.deepLink : "/workspace";
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(async (clients) => { for (const client of clients) { if ("focus" in client) { await client.navigate(deepLink); return client.focus(); } } return self.clients.openWindow(deepLink); }));
});
