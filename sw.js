/**
 * LivrExpress — Service Worker
 * Notifications système (sonnerie / bannière téléphone) même hors onglet / app en fond.
 * Écoute un flux d’alertes en arrière-plan (sans abonnement manuel à un canal).
 */
/* eslint-disable no-restricted-globals */
const CACHE = "livrexpress-v4";
const PRECACHE = [
  "./",
  "./index.html",
  "./login.html",
  "./espace-client.html",
  "./espace-livreur.html",
  "./suivi.html",
  "./css/style.css",
  "./css/mobile-first.css",
  "./js/auth.js",
  "./js/livraison.js",
  "./js/push-notify.js",
  "./js/permission-modal.js",
  "./js/geo-live.js",
  "./js/profile.js",
  "./js/pwa-install.js",
  "./js/main.js",
  "./images/icon-192.png",
  "./images/icon-512.png",
  "./images/badge-96.png",
  "./manifest.webmanifest",
];

/** État écoute arrière-plan */
let bgTopic = null;
let bgUserId = null;
let bgAbort = null;
let bgLoopRunning = false;
const seenMsgIds = new Set();

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
  // Ne pas intercepter le flux d’alertes distant
  if (req.url.includes("ntfy.sh")) return;

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
    renotify: data.renotify !== false,
    silent: false,
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

function stopBackgroundListen() {
  if (bgAbort) {
    try {
      bgAbort.abort();
    } catch (_) {
      /* ignore */
    }
  }
  bgAbort = null;
  bgLoopRunning = false;
  bgTopic = null;
  bgUserId = null;
}

/**
 * Boucle d’écoute longue (ntfy JSON stream) dans le SW.
 * Continue tant que le navigateur laisse le SW actif — typiquement
 * app en arrière-plan / PWA installée, sans ouvrir de « canal » manuellement.
 */
async function backgroundListenLoop(topic, userId) {
  if (!topic) return;
  bgTopic = topic;
  bgUserId = userId || null;
  bgAbort = new AbortController();
  const signal = bgAbort.signal;
  bgLoopRunning = true;

  const sleep = (ms) =>
    new Promise((resolve) => {
      const t = setTimeout(resolve, ms);
      signal.addEventListener(
        "abort",
        () => {
          clearTimeout(t);
          resolve();
        },
        { once: true }
      );
    });

  while (!signal.aborted && bgTopic === topic) {
    try {
      const res = await fetch(
        `https://ntfy.sh/${encodeURIComponent(topic)}/json`,
        {
          method: "GET",
          signal,
          headers: { Accept: "application/x-ndjson, application/json" },
          cache: "no-store",
        }
      );
      if (!res.ok || !res.body) {
        await sleep(4000);
        continue;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (!signal.aborted && bgTopic === topic) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let msg;
          try {
            msg = JSON.parse(trimmed);
          } catch {
            continue;
          }
          // keep-alive / open events
          if (msg.event && msg.event !== "message") continue;
          if (!msg.message && !msg.body && !msg.title) continue;

          const mid = String(msg.id || msg.message || Date.now());
          if (seenMsgIds.has(mid)) continue;
          seenMsgIds.add(mid);
          if (seenMsgIds.size > 200) {
            const first = seenMsgIds.values().next().value;
            seenMsgIds.delete(first);
          }

          let clickUrl = msg.click || "./espace-client.html";
          try {
            // Si URL absolue hors site, garder ; sinon résoudre
            if (clickUrl.startsWith("http")) {
              /* ok */
            } else {
              clickUrl = new URL(clickUrl, self.location.origin).href;
            }
          } catch {
            clickUrl = new URL("./espace-client.html", self.location.origin).href;
          }

          await showSystemNotification({
            id: mid,
            title: msg.title || "LivrExpress",
            message: msg.message || msg.body || "Mise à jour LivrExpress",
            url: clickUrl,
            renotify: true,
            iconUrl: msg.icon || "./images/icon-192.png",
          });
        }
      }
    } catch (e) {
      if (signal.aborted) break;
      // Réseau coupé / SW suspendu — réessayer
      await sleep(5000);
    }
  }

  bgLoopRunning = false;
}

function startBackgroundListen(topic, userId) {
  if (!topic) return;
  if (bgLoopRunning && bgTopic === topic) {
    bgUserId = userId || bgUserId;
    return;
  }
  stopBackgroundListen();
  // Ne pas await ici : boucle longue dans le SW
  backgroundListenLoop(topic, userId);
}

self.addEventListener("message", (event) => {
  const msg = event.data || {};

  if (msg.type === "SHOW_NOTIFICATION") {
    event.waitUntil(showSystemNotification(msg.payload || {}));
  }

  if (msg.type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (msg.type === "START_BACKGROUND_LISTEN" && msg.topic) {
    startBackgroundListen(msg.topic, msg.userId || null);
    if (event.source && event.source.postMessage) {
      try {
        event.source.postMessage({
          type: "BACKGROUND_LISTEN_STATUS",
          listening: true,
          topic: msg.topic,
        });
      } catch (_) {
        /* ignore */
      }
    }
  }

  if (msg.type === "STOP_BACKGROUND_LISTEN") {
    stopBackgroundListen();
  }

  if (msg.type === "CLIENT_HEARTBEAT") {
    // Si le flux est tombé, le relancer quand un client est encore vivant
    if (msg.topic && (!bgLoopRunning || bgTopic !== msg.topic)) {
      startBackgroundListen(msg.topic, bgUserId);
    }
  }
});

/** Push réseau (Web Push standard si un push service envoie un payload JSON) */
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
