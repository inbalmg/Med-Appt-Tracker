/**
 * Med-Appt PWA service worker (Netlify-hardened)
 * - Precached app shell for offline / fast repeat visits
 * - Navigation: network-first → fallback to cached index.html (SPA)
 * - Hashed assets (/assets/*): cache-first + background refresh
 * - Same-origin GET: network-first, cache fallback (no stale API caching)
 * - Push + notificationclick preserved (RTL)
 */
const CACHE_VERSION = "med-appt-v2";
const CACHE_SHELL = `med-appt-shell-${CACHE_VERSION}`;
const CACHE_RUNTIME = `med-appt-runtime-${CACHE_VERSION}`;

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/placeholder.svg",
  "/icon-512.png",
];

function isSameOrigin(url) {
  return url.origin === self.location.origin;
}

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.headers.get("accept")?.includes("text/html");
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_SHELL)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => Promise.resolve())
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_SHELL && k !== CACHE_RUNTIME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (!isSameOrigin(url)) return;

  // HTML navigations: always try network first (fresh deploys), then SPA shell
  if (isNavigationRequest(request)) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_SHELL).then((cache) => cache.put("/index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("/index.html"))
    );
    return;
  }

  // Vite hashed assets: cache-first, update cache in background
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.open(CACHE_RUNTIME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((response) => {
              if (response && response.ok) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch(() => cached);
          return cached || networkFetch;
        })
      )
    );
    return;
  }

  // Other same-origin GET: network-first, cache fallback
  event.respondWith(
    caches.open(CACHE_RUNTIME).then((cache) =>
      fetch(request)
        .then((response) => {
          if (response && response.ok) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(() => cache.match(request).then((hit) => hit || caches.match("/index.html")))
    )
  );
});

// Push notifications (RTL / Hebrew aware)
self.addEventListener("push", (event) => {
  let data = { title: "תזכורת", body: "", icon: "/icon-512.png", type: "med" };
  if (event.data) {
    try {
      const parsed = event.data.json();
      data = { ...data, ...parsed };
    } catch {
      data.body = event.data.text() || "יש לך תזכורת חדשה";
    }
  }
  const isMed = data.type === "med";
  const options = {
    body: data.body,
    icon: data.icon || "/icon-512.png",
    badge: "/icon-512.png",
    vibrate: isMed ? [200, 100, 200] : [300, 150, 300],
    tag: data.tag || "default",
    requireInteraction: true,
    dir: "rtl",
    lang: "he",
    data: { ...(data.data || {}), type: data.type },
    actions: isMed ? [{ action: "taken", title: "✅ נלקחה" }] : [{ action: "navigate", title: "📍 ניווט" }],
  };
  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) return clientList[0].focus();
      return clients.openWindow("/");
    })
  );
});
