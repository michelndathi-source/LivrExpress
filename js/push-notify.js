/**
 * LivrExpress — Notifications téléphone (sonnerie système)
 * - Service Worker + Notification API (bannière + son OS)
 * - Pont ntfy.sh pour recevoir l’alerte même si le site est fermé
 */
(function (global) {
  const PREF_KEY = "livrexpress_push_prefs_v1";
  const TOPICS_KEY = "livrexpress_push_topics_v1";

  const readPrefs = () => {
    try {
      return JSON.parse(localStorage.getItem(PREF_KEY) || "{}") || {};
    } catch {
      return {};
    }
  };

  const writePrefs = (prefs) => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch (_) {
      /* ignore */
    }
  };

  const readTopics = () => {
    try {
      return JSON.parse(localStorage.getItem(TOPICS_KEY) || "{}") || {};
    } catch {
      return {};
    }
  };

  const writeTopics = (map) => {
    try {
      localStorage.setItem(TOPICS_KEY, JSON.stringify(map));
    } catch (_) {
      /* ignore */
    }
  };

  const isSupported = () =>
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator;

  const permission = () =>
    isSupported() ? Notification.permission : "denied";

  const getTopicForUser = (userId) => {
    if (!userId) return null;
    const map = readTopics();
    if (map[userId]) return map[userId];
    const topic =
      "lx" +
      String(userId).replace(/[^a-zA-Z0-9]/g, "").slice(-8) +
      Math.random().toString(36).slice(2, 10);
    map[userId] = topic;
    writeTopics(map);
    return topic;
  };

  /** Enregistre le SW (requis pour notifs fiables + hors onglet) */
  const registerServiceWorker = async () => {
    if (!("serviceWorker" in navigator)) {
      return { ok: false, error: "Service Worker non supporté sur ce navigateur." };
    }
    try {
      const reg = await navigator.serviceWorker.register("./sw.js", {
        scope: "./",
      });
      await navigator.serviceWorker.ready;
      return { ok: true, registration: reg };
    } catch (e) {
      console.warn("LivrExpress SW:", e);
      return {
        ok: false,
        error:
          e?.message ||
          "Impossible d’enregistrer le Service Worker (HTTPS ou localhost requis).",
      };
    }
  };

  /**
   * Demande l’autorisation + active les alertes téléphone pour un client.
   * Doit être appelé suite à un clic utilisateur.
   */
  const enablePhoneNotifications = async (userId) => {
    if (!isSupported()) {
      return {
        ok: false,
        error:
          "Les notifications ne sont pas supportées. Utilisez Chrome/Edge/Safari récent.",
      };
    }

    const sw = await registerServiceWorker();
    if (!sw.ok) return sw;

    // Popup design LivrExpress avant le dialogue natif
    let perm = Notification.permission;
    if (perm === "default") {
      const Perm = global.LivrExpressPerm;
      if (Perm?.requestNotifications) {
        const r = await Perm.requestNotifications();
        perm = r.permission || Notification.permission;
        if (r.permission === "dismissed") {
          return {
            ok: false,
            error: "Activation des notifications reportée.",
          };
        }
      } else {
        perm = await Notification.requestPermission();
      }
    }
    if (perm !== "granted") {
      return {
        ok: false,
        error:
          "Permission refusée. Activez les notifications dans les réglages du navigateur / du téléphone.",
      };
    }

    const topic = getTopicForUser(userId);
    const prefs = readPrefs();
    prefs[userId] = {
      enabled: true,
      topic,
      phoneBridge: true,
      enabledAt: new Date().toISOString(),
    };
    writePrefs(prefs);

    // Notification de confirmation (teste sonnerie système)
    await showSystemNotification({
      id: "welcome-" + Date.now(),
      userId,
      title: "Notifications LivrExpress activées",
      message:
        "Vous serez alerté à chaque évolution de colis — avec la sonnerie de votre téléphone.",
      icon: "✅",
      renotify: true,
      requireInteraction: false,
    });

    return {
      ok: true,
      permission: perm,
      topic,
      ntfyUrl: topic ? `https://ntfy.sh/${topic}` : null,
    };
  };

  const disablePhoneNotifications = (userId) => {
    const prefs = readPrefs();
    if (prefs[userId]) {
      prefs[userId].enabled = false;
      prefs[userId].phoneBridge = false;
      writePrefs(prefs);
    }
    return { ok: true };
  };

  const isEnabledForUser = (userId) => {
    if (!userId) return false;
    if (permission() !== "granted") return false;
    const p = readPrefs()[userId];
    return Boolean(p && p.enabled);
  };

  const getStatus = (userId) => {
    const p = (userId && readPrefs()[userId]) || {};
    return {
      supported: isSupported(),
      permission: permission(),
      enabled: isEnabledForUser(userId),
      topic: p.topic || (userId ? readTopics()[userId] : null) || null,
      phoneBridge: Boolean(p.phoneBridge),
      sw: "serviceWorker" in navigator,
    };
  };

  /**
   * Affiche une notification système (bannière + sonnerie OS).
   * Fonctionne via Service Worker (recommandé) ou Notification API.
   */
  const showSystemNotification = async (payload = {}) => {
    if (!isSupported() || Notification.permission !== "granted") {
      return { ok: false, reason: "permission" };
    }

    const data = {
      id: payload.id,
      title: payload.title || "LivrExpress",
      message: payload.message || "",
      trackingId: payload.trackingId || null,
      statusKey: payload.statusKey || null,
      icon: payload.icon,
      iconUrl: payload.iconUrl || "./images/icon-192.png",
      renotify: payload.renotify !== false,
      requireInteraction: payload.requireInteraction,
      url: payload.url,
      vibrate: payload.vibrate,
    };

    try {
      const reg = await navigator.serviceWorker.getRegistration();
      const readyReg = reg || (await navigator.serviceWorker.ready.catch(() => null));

      if (readyReg) {
        // Une seule notif système (sonnerie OS via silent:false + renotify)
        await readyReg.showNotification(data.title, {
          body: data.message,
          icon: data.iconUrl,
          badge: "./images/badge-96.png",
          tag: data.trackingId
            ? `lx-${data.trackingId}-${data.statusKey || data.id || "u"}`
            : `lx-${data.id || Date.now()}`,
          renotify: true,
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
              (data.trackingId
                ? `./suivi.html?id=${encodeURIComponent(data.trackingId)}`
                : data.orderId
                  ? "./admin.html"
                  : "./espace-client.html"),
            trackingId: data.trackingId,
            orderId: data.orderId,
            notificationId: data.id,
          },
        });
        return { ok: true, via: "service-worker" };
      }
    } catch (e) {
      console.warn("SW notification failed, fallback", e);
    }

    try {
      const n = new Notification(data.title, {
        body: data.message,
        icon: data.iconUrl,
        tag: data.trackingId
          ? `lx-${data.trackingId}-${data.statusKey || "u"}`
          : undefined,
        renotify: true,
        silent: false,
        vibrate: [200, 100, 200],
        data: data,
      });
      n.onclick = () => {
        try {
          window.focus();
          if (data.trackingId) {
            window.location.href = `suivi.html?id=${encodeURIComponent(data.trackingId)}`;
          } else {
            window.location.href = "espace-client.html";
          }
        } catch (_) {
          /* ignore */
        }
        n.close();
      };
      return { ok: true, via: "notification-api" };
    } catch (e) {
      return { ok: false, error: e?.message || "Notification impossible" };
    }
  };

  /**
   * Pont hors-site : envoie l’alerte via ntfy.sh (gratuit).
   * Le client doit s’abonner une fois au topic (lien fourni à l’activation).
   * → Sonnerie native même si le navigateur / site est fermé.
   */
  const sendPhoneBridge = async (userId, payload = {}) => {
    const prefs = readPrefs()[userId];
    const topic = (prefs && prefs.topic) || readTopics()[userId];
    if (!topic) return { ok: false, reason: "no-topic" };
    if (prefs && prefs.phoneBridge === false) {
      return { ok: false, reason: "bridge-off" };
    }

    const title = payload.title || "LivrExpress";
    const message = payload.message || "Mise à jour de votre colis";
    const clickUrl = payload.trackingId
      ? new URL(
          `suivi.html?id=${encodeURIComponent(payload.trackingId)}`,
          window.location.href
        ).href
      : new URL("espace-client.html", window.location.href).href;

    try {
      const res = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
        method: "POST",
        body: message,
        headers: {
          Title: title.slice(0, 100),
          Priority: payload.statusKey === "delivered" ? "high" : "default",
          Tags: "package,truck",
          Click: clickUrl,
          // Icône affichée dans l’app ntfy / certains clients
          Icon: new URL("images/icon-192.png", window.location.href).href,
        },
      });
      if (!res.ok) {
        return { ok: false, status: res.status };
      }
      return { ok: true, via: "ntfy", topic };
    } catch (e) {
      console.warn("LivrExpress ntfy:", e);
      return { ok: false, error: e?.message || "ntfy failed" };
    }
  };

  /**
   * Point d’entrée global : notif système + pont téléphone.
   * Appelé à chaque changement de statut.
   */
  const notifyClientDevice = async (userId, payload = {}) => {
    if (!userId) return { ok: false };

    const results = { system: null, bridge: null };

    // URL par défaut selon le type (admin = dashboard, client = suivi)
    const enriched = {
      ...payload,
      url:
        payload.url ||
        (payload.type === "new_order" || payload.type === "admin_order"
          ? "./admin.html"
          : payload.trackingId
            ? `./suivi.html?id=${encodeURIComponent(payload.trackingId)}`
            : undefined),
    };

    // Afficher la bannière OS uniquement si CET appareil appartient au destinataire
    // (évite d’alerter le client quand on notifie les admins, et inversement)
    const prefs = readPrefs()[userId];
    const deviceBoundToUser = Boolean(prefs && prefs.enabled);
    let isLoggedAsTarget = false;
    try {
      const Auth = global.Auth || global.LivrExpressAuth;
      const sessionUser = Auth?.getCurrentUser?.();
      isLoggedAsTarget = Boolean(sessionUser && sessionUser.id === userId);
    } catch (_) {
      /* ignore */
    }

    if (
      permission() === "granted" &&
      (deviceBoundToUser || isLoggedAsTarget)
    ) {
      results.system = await showSystemNotification(enriched);
    }

    // Pont distant (topic ntfy du destinataire — même site fermé)
    results.bridge = await sendPhoneBridge(userId, enriched);

    try {
      global.dispatchEvent(
        new CustomEvent("livrexpress:device-notify", {
          detail: { userId, payload: enriched, results },
        })
      );
    } catch (_) {
      /* ignore */
    }

    return { ok: true, results };
  };

  /** Joue un court bip de secours (si le navigateur bloque la notif OS) */
  const playFallbackSound = () => {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = 880;
      gain.gain.value = 0.0001;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = ctx.currentTime;
      gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
      osc.start(t);
      osc.stop(t + 0.4);
      setTimeout(() => ctx.close().catch(() => undefined), 600);
    } catch (_) {
      /* ignore */
    }
  };

  // Enregistrement SW précoce (si déjà autorisé)
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      registerServiceWorker().catch(() => undefined);
    });
  }

  // Clic sur notification → navigation
  if (typeof navigator !== "undefined" && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener("message", (event) => {
      const msg = event.data || {};
      if (msg.type === "NOTIFICATION_CLICK" && msg.url) {
        try {
          window.location.href = msg.url;
        } catch (_) {
          /* ignore */
        }
      }
    });
  }

  global.LivrExpressPush = {
    isSupported,
    permission,
    registerServiceWorker,
    enablePhoneNotifications,
    disablePhoneNotifications,
    isEnabledForUser,
    getStatus,
    getTopicForUser,
    showSystemNotification,
    sendPhoneBridge,
    notifyClientDevice,
    playFallbackSound,
  };
})(typeof window !== "undefined" ? window : globalThis);
