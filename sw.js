/**
 * LivrExpress — Service Worker
 * Notifications système (sonnerie / bannière téléphone) même hors onglet.
 */
/* eslint-disable no-restricted-globals */
const CACHE = "livrexpress-v1";
const PRECACHE = [
  "./",
  "./index.html",
  "./espace-client.html",
  "./css/style.css",
  "./js/auth.js",
  "./js/livraison.js",
  "./js/push-notify.js",
  "./js/main.js",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/badge-96.png",
  "./manifest.webmanifest",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.ok && req.url.startsWith(self.location.origin)) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

/** Affiche une notification système (utilise la sonnerie OS si silent:false) */
async function showSystemNotification(data = {}) {
  const title = data.title || "LivrExpress";
  const trackingId = data.trackingId || "";
  const tag =
    data.tag ||
    (trackingId
      ? `lx-${trackingId}-${data.statusKey || "update"}`
      : `lx-${data.id || Date.now()}`);

  const options = {
    body: data.message || data.body || "Mise à jour de votre colis",
    icon: data.iconUrl || "./images/icon-192.png",
    badge: "./images/badge-96.png",
    image: data.image || undefined,
    tag,
    renotify: data.renotify !== false, // rejoue la sonnerie à chaque MAJ
    silent: false, // sonnerie / vibration de notification du téléphone
    vibrate: data.vibrate || [200, 100, 200, 100, 200],
    requireInteraction: Boolean(
      data.requireInteraction ||
        data.statusKey === "delivery" ||
        data.statusKey === "delivered"
    ),
    data: {
      url:
        data.url ||
        (trackingId
          ? `./suivi.html?id=${encodeURIComponent(trackingId)}`
          : "./espace-client.html"),
      trackingId,
      notificationId: data.id || null,
      statusKey: data.statusKey || null,
    },
    actions: trackingId
      ? [
          { action: "open", title: "Voir le suivi" },
          { action: "dismiss", title: "OK" },
        ]
      : [{ action: "open", title: "Ouvrir" }],
  };

  await self.registration.showNotification(title, options);
}

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "SHOW_NOTIFICATION") {
    event.waitUntil(showSystemNotification(msg.payload || {}));
  }
  if (msg.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/** Push réseau (si un push service envoie un payload JSON) */
self.addEventListener("push", (event) => {
  let payload = {};
  try {
    if (event.data) {
      payload = event.data.json();
    }
  } catch (_) {
    payload = { title: "LivrExpress", message: event.data?.text?.() || "" };
  }
  event.waitUntil(showSystemNotification(payload));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  if (event.action === "dismiss") return;

  const rawUrl =
    (event.notification.data && event.notification.data.url) ||
    "./espace-client.html";
  const targetUrl = new URL(rawUrl, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ("focus" in client) {
            if (client.url.includes(self.location.origin)) {
              client.postMessage({
                type: "NOTIFICATION_CLICK",
                url: targetUrl,
              });
              return client.focus().then((c) => {
                if (c && "navigate" in c) {
                  try {
                    return c.navigate(targetUrl);
                  } catch (_) {
                    /* ignore */
                  }
                }
                return c;
              });
            }
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
        return undefined;
      })
  );
});

self.addEventListener("notificationclose", () => {
  /* no-op */
});
