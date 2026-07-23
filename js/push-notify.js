/**
 * LivrExpress — Notifications téléphone (sonnerie système)
 * - Service Worker + Notification API (bannière + son OS)
 * - Écoute arrière-plan automatique (flux ntfy via le SW, sans abonnement manuel)
 * - Pont ntfy pour délivrer l’alerte même hors écran de l’app
 */
(function (global) {
  const PREF_KEY = "livrexpress_push_prefs_v1";
  const TOPICS_KEY = "livrexpress_push_topics_v1";
  const ACTIVE_USER_KEY = "livrexpress_push_active_user_v1";

  let pageStream = null;
  let pageStreamTopic = null;
  let pageStreamUserId = null;
  let reconnectTimer = null;

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

  const setActiveUser = (userId) => {
    try {
      if (userId) localStorage.setItem(ACTIVE_USER_KEY, String(userId));
      else localStorage.removeItem(ACTIVE_USER_KEY);
    } catch (_) {
      /* ignore */
    }
  };

  const getActiveUser = () => {
    try {
      return localStorage.getItem(ACTIVE_USER_KEY) || null;
    } catch {
      return null;
    }
  };

  const isSupported = () =>
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator;

  const permission = () =>
    isSupported() ? Notification.permission : "denied";

  /**
   * Topic déterministe par userId (même canal admin ↔ client, multi-appareils).
   * Sans partie aléatoire : l’expéditeur et le destinataire convergent.
   */
  const getTopicForUser = (userId) => {
    if (!userId) return null;
    const clean = String(userId).replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
    const topic = ("livrexpress" + (clean || "guest")).slice(0, 48);
    const map = readTopics();
    // Migrer d’anciens topics aléatoires vers le topic stable
    if (map[userId] !== topic) {
      map[userId] = topic;
      writeTopics(map);
    }
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

  /** Demande au SW d’écouter le canal en arrière-plan (app fermée / en fond) */
  const tellSwStartListen = async (topic, userId) => {
    if (!topic || !("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const msg = {
        type: "START_BACKGROUND_LISTEN",
        topic,
        userId: userId || null,
      };
      if (reg.active) reg.active.postMessage(msg);
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
      }
    } catch (e) {
      console.warn("LivrExpress SW listen:", e);
    }
  };

  const tellSwStopListen = async () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const reg = await navigator.serviceWorker.ready;
      const msg = { type: "STOP_BACKGROUND_LISTEN" };
      if (reg.active) reg.active.postMessage(msg);
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.controller.postMessage(msg);
      }
    } catch (_) {
      /* ignore */
    }
  };

  /**
   * Flux page (secours) : EventSource tant que l’onglet / PWA est en mémoire
   * (y compris en arrière-plan si le navigateur ne tue pas le process).
   */
  const startPageStream = (topic, userId) => {
    if (!topic || typeof EventSource === "undefined") return;
    if (pageStream && pageStreamTopic === topic) return;

    stopPageStream();
    pageStreamTopic = topic;
    pageStreamUserId = userId || null;

    try {
      const url = `https://ntfy.sh/${encodeURIComponent(topic)}/json`;
      pageStream = new EventSource(url);

      pageStream.onmessage = (ev) => {
        try {
          const msg = JSON.parse(ev.data || "{}");
          if (!msg || (msg.event && msg.event !== "message")) return;
          const title = msg.title || "LivrExpress";
          const message = msg.message || msg.body || "Mise à jour LivrExpress";
          // Le SW affiche déjà la notif via son flux ; on n’affiche ici que
          // si le SW n’est pas controller (première visite / fallback).
          if (!navigator.serviceWorker?.controller) {
            showSystemNotification({
              id: msg.id || "ntfy-" + Date.now(),
              title,
              message,
              renotify: true,
              url: msg.click || undefined,
            });
          }
        } catch (_) {
          /* ignore parse */
        }
      };

      pageStream.onerror = () => {
        // Reconnexion auto navigateur ; si fermé, on relance plus tard
        if (pageStream && pageStream.readyState === EventSource.CLOSED) {
          stopPageStream();
          if (reconnectTimer) clearTimeout(reconnectTimer);
          reconnectTimer = setTimeout(() => {
            if (pageStreamTopic) startPageStream(pageStreamTopic, pageStreamUserId);
          }, 4000);
        }
      };
    } catch (e) {
      console.warn("LivrExpress page stream:", e);
    }
  };

  const stopPageStream = () => {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
    if (pageStream) {
      try {
        pageStream.close();
      } catch (_) {
        /* ignore */
      }
    }
    pageStream = null;
    pageStreamTopic = null;
  };

  /**
   * Démarre l’écoute arrière-plan pour un utilisateur (SW + secours page).
   * Aucune action manuelle « canal d’alertes » requise.
   */
  const startBackgroundAlerts = async (userId) => {
    if (!userId || permission() !== "granted") {
      return { ok: false, reason: "permission" };
    }
    const allPrefs = readPrefs();
    const prefs = allPrefs[userId];
    if (!prefs || !prefs.enabled) {
      return { ok: false, reason: "disabled" };
    }

    const topic = getTopicForUser(userId);
    if (!topic) return { ok: false, reason: "no-topic" };

    // Aligner le topic stocké (migration anciens topics aléatoires)
    if (prefs.topic !== topic) {
      allPrefs[userId] = { ...prefs, topic };
      writePrefs(allPrefs);
    }

    setActiveUser(userId);
    await registerServiceWorker();
    await tellSwStartListen(topic, userId);
    startPageStream(topic, userId);

    // Relancer le SW si la page redevient visible
    return { ok: true, topic };
  };

  const stopBackgroundAlerts = async (userId) => {
    stopPageStream();
    await tellSwStopListen();
    if (userId && getActiveUser() === String(userId)) {
      setActiveUser(null);
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
      ...(prefs[userId] || {}),
      enabled: true,
      topic,
      phoneBridge: true,
      background: true,
      enabledAt: new Date().toISOString(),
    };
    writePrefs(prefs);

    // Écoute auto en arrière-plan (sans abonnement canal manuel)
    await startBackgroundAlerts(userId);

    // Notification de confirmation (teste sonnerie système)
    await showSystemNotification({
      id: "welcome-" + Date.now(),
      userId,
      title: "Notifications LivrExpress activées",
      message:
        "Vous serez alerté à chaque évolution de colis — même en arrière-plan.",
      icon: "✅",
      renotify: true,
      requireInteraction: false,
    });

    return {
      ok: true,
      permission: perm,
      topic,
    };
  };

  const disablePhoneNotifications = (userId) => {
    const prefs = readPrefs();
    if (prefs[userId]) {
      prefs[userId].enabled = false;
      prefs[userId].phoneBridge = false;
      prefs[userId].background = false;
      writePrefs(prefs);
    }
    stopBackgroundAlerts(userId);
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
      background: Boolean(p.background !== false && p.enabled),
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
   * Pont hors-site : envoie l’alerte via ntfy (côté expéditeur).
   * Le destinataire reçoit via le flux SW en arrière-plan (auto, sans abonnement UI).
   */
  const sendPhoneBridge = async (userId, payload = {}) => {
    const prefs = readPrefs()[userId];
    // Toujours le topic stable dérivé de l’userId (pas besoin d’abonnement local)
    const topic = getTopicForUser(userId);
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
      : payload.url
        ? new URL(payload.url, window.location.href).href
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

    // Pont distant → réveillé par le SW du destinataire en arrière-plan
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

  /**
   * Reprend l’écoute si les notifs étaient déjà activées
   * (chargement page, retour au premier plan).
   */
  const resumeIfEnabled = async () => {
    if (permission() !== "granted") return;

    let userId = getActiveUser();
    if (!userId) {
      try {
        const Auth = global.Auth || global.LivrExpressAuth;
        const u = Auth?.getCurrentUser?.();
        if (u?.id && isEnabledForUser(u.id)) userId = u.id;
      } catch (_) {
        /* ignore */
      }
    }

    // Fallback : premier user enabled dans les prefs
    if (!userId) {
      const prefs = readPrefs();
      userId = Object.keys(prefs).find((id) => prefs[id] && prefs[id].enabled) || null;
    }

    if (userId && isEnabledForUser(userId)) {
      await startBackgroundAlerts(userId);
    }
  };

  // Enregistrement SW précoce + reprise écoute arrière-plan
  if (typeof window !== "undefined" && "serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      registerServiceWorker()
        .then(() => resumeIfEnabled())
        .catch(() => undefined);
    });

    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        resumeIfEnabled().catch(() => undefined);
      }
    });

    window.addEventListener("focus", () => {
      resumeIfEnabled().catch(() => undefined);
    });

    // Persiste un signal de vie pour le SW (client encore en mémoire)
    setInterval(() => {
      if (navigator.serviceWorker?.controller && pageStreamTopic) {
        try {
          navigator.serviceWorker.controller.postMessage({
            type: "CLIENT_HEARTBEAT",
            topic: pageStreamTopic,
            at: Date.now(),
          });
        } catch (_) {
          /* ignore */
        }
      }
    }, 25000);
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
      if (msg.type === "BACKGROUND_LISTEN_STATUS") {
        try {
          global.dispatchEvent(
            new CustomEvent("livrexpress:bg-listen", { detail: msg })
          );
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
    startBackgroundAlerts,
    stopBackgroundAlerts,
    resumeIfEnabled,
  };
})(typeof window !== "undefined" ? window : globalThis);
