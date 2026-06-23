const CACHE = "milobolo-v3";
const PRECACHE = ["/", "/offline.html", "/manifest.webmanifest", "/icons/icon-192.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(PRECACHE.map((url) => c.add(url))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);

  // Never intercept: API calls, signaling, auth, Supabase, external resources
  if (
    e.request.method !== "GET" ||
    url.hostname !== self.location.hostname ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/") ||
    url.pathname.startsWith("/profile") ||
    url.pathname.startsWith("/history") ||
    url.pathname.startsWith("/admin") ||
    url.pathname.includes("socket.io") ||
    url.pathname.includes("supabase") ||
    url.pathname.includes("_next/static/chunks") // let Next.js handle its own chunks
  ) return;

  // Cache-first for static assets, network-first for pages
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    e.respondWith(
      caches.match(e.request).then((cached) => cached || fetch(e.request).then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      }).catch(() => cached || new Response("Offline", { status: 503 })))
    );
    return;
  }

  // Network-first for pages (/, /chat, /spy, /terms, /privacy)
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) caches.open(CACHE).then((c) => c.put(e.request, res.clone()));
        return res;
      })
      .catch(() => caches.match(e.request).then((cached) => cached || caches.match("/offline.html") || new Response("Offline", { status: 503 })))
  );
});

self.addEventListener("push", (e) => {
  const data = e.data?.json() || {};
  e.waitUntil(
    self.registration.showNotification(data.title || "MiloBolo", {
      body: data.body || "Someone wants to chat!",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-72.png",
      tag: "milobolo-notification",
      data: { url: data.url || "/chat" },
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(clients.openWindow(e.notification.data?.url || "/chat"));
});
