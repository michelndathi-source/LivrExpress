/**
 * LivrExpress — Moteur de livraison & suivi
 * Numéros de suivi, fiches produit, pipeline de statuts (style transporteurs mondiaux)
 * Persistance : localStorage
 */
(function (global) {
  const STORAGE_KEY = "livrexpress_shipments_v1";
  const ORDERS_KEY = "livrexpress_order_requests_v1";
  const NOTIF_KEY = "livrexpress_notifications_v1";
  const WHATSAPP = "221770000000";

  /** Pipeline de livraison (ordre strict) */
  const PIPELINE = [
    {
      key: "confirmed",
      label: "Enregistrée",
      icon: "📝",
      badge: "Enregistrée",
      statusClass: "track__status--prep",
      title: "Commande enregistrée",
      descDone: "Votre course a été enregistrée dans le système.",
      descActive: "Enregistrement de la commande en cours.",
      descPending: "En attente d’enregistrement.",
      eventCode: "ORD_CREATED",
      progress: 8,
      live: false,
      liveText: "En attente",
      guide:
        "Votre commande est bien enregistrée. Un numéro de suivi a été généré.",
    },
    {
      key: "prepared",
      label: "Préparé",
      icon: "📋",
      badge: "Préparé",
      statusClass: "track__status--prep",
      title: "Colis préparé",
      descDone: "Le colis est emballé et prêt pour l’enlèvement.",
      descActive: "Préparation et contrôle du colis en cours.",
      descPending: "Préparation pas encore démarrée.",
      eventCode: "PKG_READY",
      progress: 22,
      live: false,
      liveText: "En attente",
      guide: "Le colis est en préparation chez l’expéditeur.",
    },
    {
      key: "picked",
      label: "Enlevé",
      icon: "📦",
      badge: "Enlevé",
      statusClass: "",
      title: "Enlevé par le livreur",
      descDone: "Le livreur a récupéré le colis au point de départ.",
      descActive: "Le livreur récupère le colis.",
      descPending: "En attente d’enlèvement.",
      eventCode: "PICKED_UP",
      progress: 40,
      live: true,
      liveText: "Live",
      guide: "Le colis a été enlevé. Il rejoint le circuit de livraison.",
    },
    {
      key: "transit",
      label: "Transit",
      icon: "🏢",
      badge: "En transit",
      statusClass: "",
      title: "En transit / hub",
      descDone: "Le colis a quitté le hub de tri.",
      descActive: "Colis au hub de tri LivrExpress ou en transfert.",
      descPending: "Pas encore passé par le hub.",
      eventCode: "IN_TRANSIT",
      progress: 58,
      live: true,
      liveText: "Live",
      guide: "Votre colis est en transit dans le réseau LivrExpress.",
    },
    {
      key: "delivery",
      label: "Livraison",
      icon: "🛵",
      badge: "En route",
      statusClass: "",
      title: "En cours de livraison",
      descDone: "La tournée de livraison est terminée.",
      descActive: "Le livreur est en route vers la destination finale.",
      descPending: "Livraison finale pas encore démarrée.",
      eventCode: "OUT_FOR_DELIVERY",
      progress: 78,
      live: true,
      liveText: "Live",
      guide:
        "Votre colis est en livraison. Préparez-vous à le réceptionner.",
    },
    {
      key: "delivered",
      label: "Remis",
      icon: "✅",
      badge: "Remis",
      statusClass: "track__status--done",
      title: "Remis au destinataire",
      descDone: "Colis remis et signé par le destinataire.",
      descActive: "Remise en cours.",
      descPending: "En attente de remise.",
      eventCode: "DELIVERED",
      progress: 100,
      live: false,
      liveText: "Terminé",
      guide: "Livraison terminée. Merci d’avoir choisi LivrExpress !",
    },
  ];

  const STATUS_INDEX = Object.fromEntries(
    PIPELINE.map((s, i) => [s.key, i])
  );

  const COURIERS = [
    { name: "Moussa Diop", avatar: "🛵", phone: WHATSAPP },
    { name: "Awa Sarr", avatar: "🛵", phone: WHATSAPP },
    { name: "Ibrahima Fall", avatar: "🛵", phone: WHATSAPP },
    { name: "Fatou Kane", avatar: "🛵", phone: WHATSAPP },
  ];

  const PLAN_PRICES = {
    Express: { amount: 1500, label: "Express", etaMin: 30, etaMax: 45 },
    Pro: { amount: 2500, label: "Pro", etaMin: 20, etaMax: 30 },
    Business: { amount: 45000, label: "Business", etaMin: 25, etaMax: 40 },
  };

  // —— Utils ——
  const pad = (n, len = 2) => String(n).padStart(len, "0");

  const formatTime = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const formatDateTime = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} · ${formatTime(d)}`;
  };

  const formatDateShort = (date) => {
    const d = date instanceof Date ? date : new Date(date);
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  const randomCourier = () => {
    // Profil livreur complet (transparence client)
    if (global.LivrExpressProfile?.assignCourier) {
      const full = global.LivrExpressProfile.assignCourier();
      if (full) return full;
    }
    const c = COURIERS[Math.floor(Math.random() * COURIERS.length)];
    return { ...c, phone: c.phone || WHATSAPP };
  };

  /** Génère un n° de suivi unique type transporteur : LX-260720-A3F9 */
  const generateTrackingId = (existing = new Set()) => {
    const now = new Date();
    const y = String(now.getFullYear()).slice(2);
    const m = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let id;
    let guard = 0;
    do {
      let suffix = "";
      for (let i = 0; i < 4; i++) {
        suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
      }
      id = `LX-${y}${m}${day}-${suffix}`;
      guard += 1;
    } while (existing.has(id) && guard < 40);
    return id;
  };

  // —— Storage ——
  const readAll = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeAll = (map) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn("LivrExpress: impossible d’enregistrer", e);
    }
  };

  const useSupabase = () =>
    Boolean(global.LivrExpressSB && global.LivrExpressSB.isEnabled());

  const saveShipment = (shipment) => {
    const map = readAll();
    map[shipment.trackingId] = shipment;
    writeAll(map);
    // Sync cloud (async, non bloquant pour l'UI)
    if (useSupabase() && shipment?.source !== "demo") {
      global.LivrExpressSB.upsertShipment(shipment).catch((e) =>
        console.warn("Sync shipment:", e)
      );
    }
    return shipment;
  };

  const getShipment = (trackingId) => {
    if (!trackingId) return null;
    const id = normalizeTrackingId(trackingId);
    const map = readAll();
    const ship = map[id] || null;
    // Mode live : ignorer les anciennes démos
    if (ship && ship.source === "demo") return null;
    return ship;
  };

  /** Charge un colis depuis Supabase puis met en cache local */
  const getShipmentAsync = async (trackingId) => {
    const id = normalizeTrackingId(trackingId);
    if (!id) return null;
    if (useSupabase()) {
      try {
        const remote = await global.LivrExpressSB.getShipmentRemote(id);
        if (remote) {
          const map = readAll();
          map[id] = remote;
          writeAll(map);
          return remote;
        }
      } catch (e) {
        console.warn("getShipmentAsync:", e);
      }
    }
    return getShipment(id);
  };

  const listShipments = () => {
    seedDemosIfNeeded();
    const map = readAll();
    return Object.values(map).sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  };

  const normalizeTrackingId = (raw) => {
    let value = String(raw || "")
      .trim()
      .toUpperCase()
      .replace(/^#/, "")
      .replace(/\s+/g, "");
    // LX-YYMMDD-XXXX ou LX-2847 legacy
    if (/^\d{4}$/.test(value)) value = `LX-${value}`;
    if (/^LX\d{4}$/.test(value)) value = `LX-${value.slice(2)}`;
    // LX260720A3F9 → LX-260720-A3F9
    if (/^LX\d{6}[A-Z0-9]{4}$/.test(value)) {
      value = `LX-${value.slice(2, 8)}-${value.slice(8)}`;
    }
    return value;
  };

  // —— Résolution UI depuis statut ——
  const getStatusMeta = (statusKey) => {
    const idx = STATUS_INDEX[statusKey];
    if (idx == null) return PIPELINE[0];
    return PIPELINE[idx];
  };

  const resolveSteps = (shipment) => {
    const current = STATUS_INDEX[shipment.statusKey] ?? 0;
    const isDelivered = shipment.statusKey === "delivered";
    const times = shipment.stepTimes || {};

    return PIPELINE.map((step, i) => {
      let state = "pending";
      if (isDelivered || i < current) state = "done";
      else if (i === current) state = "active";

      let desc = step.descPending;
      if (state === "done") desc = step.descDone;
      else if (state === "active") desc = step.descActive;

      return {
        key: step.key,
        label: step.label,
        icon: step.icon,
        title: step.title,
        index: i,
        state,
        time: times[step.key] ? formatTime(times[step.key]) : "",
        timeFull: times[step.key] ? formatDateTime(times[step.key]) : "",
        desc,
      };
    });
  };

  const resolveProgress = (statusKey) => {
    const meta = getStatusMeta(statusKey);
    return meta.progress;
  };

  const buildTimeline = (shipment) => {
    const events = Array.isArray(shipment.events)
      ? [...shipment.events]
      : [];
    events.sort((a, b) => new Date(a.at) - new Date(b.at));

    const currentIdx = STATUS_INDEX[shipment.statusKey] ?? 0;

    // Enrichir avec étapes futures non encore eventées
    const existingKeys = new Set(events.map((e) => e.statusKey));
    PIPELINE.forEach((step, i) => {
      if (existingKeys.has(step.key)) return;
      if (i <= currentIdx) return;
      events.push({
        code: step.eventCode,
        statusKey: step.key,
        title: step.title,
        desc: step.descPending,
        location: "",
        at: null,
        state: "pending",
        isPublic: true,
      });
    });

    return events.map((ev) => {
      const idx = STATUS_INDEX[ev.statusKey];
      let state = ev.state;
      if (!state) {
        if (ev.at && idx != null && idx < currentIdx) state = "done";
        else if (ev.statusKey === shipment.statusKey) state = "active";
        else if (ev.at && idx != null && idx <= currentIdx) state = "done";
        else state = "pending";
      }
      if (shipment.statusKey === "delivered" && ev.at) state = "done";
      return {
        title: ev.title,
        desc: ev.desc,
        location: ev.location || "",
        time: ev.at ? formatDateTime(ev.at) : "—",
        timeShort: ev.at ? formatTime(ev.at) : "—",
        state,
        code: ev.code || "",
      };
    });
  };

  const addEvent = (shipment, statusKey, overrides = {}) => {
    const meta = getStatusMeta(statusKey);
    const at = overrides.at || new Date().toISOString();
    const event = {
      code: overrides.code || meta.eventCode,
      statusKey,
      title: overrides.title || meta.title,
      desc: overrides.desc || meta.descDone,
      location: overrides.location || "",
      at,
      isPublic: true,
    };
    shipment.events = shipment.events || [];
    shipment.events.push(event);
    shipment.stepTimes = shipment.stepTimes || {};
    shipment.stepTimes[statusKey] = at;
    shipment.updatedAt = at;
    return event;
  };

  // —— Notifications client (évolution du colis) ——
  const readNotificationsMap = () => {
    try {
      const raw = localStorage.getItem(NOTIF_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeNotificationsMap = (map) => {
    try {
      localStorage.setItem(NOTIF_KEY, JSON.stringify(map));
      // Signal multi-onglets + même onglet
      try {
        global.dispatchEvent(
          new CustomEvent("livrexpress:notifications", {
            detail: { map },
          })
        );
      } catch (_) {
        /* ignore */
      }
    } catch (e) {
      console.warn("LivrExpress: notifications non enregistrées", e);
    }
  };

  const notifId = () =>
    `N-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  /**
   * Crée une notification pour un client.
   * @param {string} userId
   * @param {object} payload
   */
  const createNotification = (userId, payload = {}) => {
    if (!userId) return null;
    const map = readNotificationsMap();
    const list = Array.isArray(map[userId]) ? map[userId] : [];
    const item = {
      id: notifId(),
      userId,
      type: payload.type || "info",
      title: payload.title || "LivrExpress",
      message: payload.message || "",
      trackingId: payload.trackingId || null,
      orderId: payload.orderId || null,
      statusKey: payload.statusKey || null,
      icon: payload.icon || "📦",
      createdAt: payload.createdAt || new Date().toISOString(),
      read: false,
    };
    list.unshift(item);
    // garder les 80 dernières par utilisateur
    map[userId] = list.slice(0, 80);
    writeNotificationsMap(map);

    if (useSupabase()) {
      global.LivrExpressSB.insertNotification(item).catch((e) =>
        console.warn("Sync notif:", e)
      );
    }

    // Notification téléphone (sonnerie système + pont hors-site)
    // Ne pas bloquer le flux métier si le push échoue
    try {
      const Push = global.LivrExpressPush;
      if (Push && typeof Push.notifyClientDevice === "function") {
        Promise.resolve(
          Push.notifyClientDevice(userId, {
            id: item.id,
            type: item.type,
            title: item.title,
            message: item.message,
            trackingId: item.trackingId,
            orderId: item.orderId,
            statusKey: item.statusKey,
            icon: item.icon,
            url: payload.url || null,
            requireInteraction:
              item.statusKey === "delivery" ||
              item.statusKey === "delivered" ||
              item.type === "new_order",
          })
        ).catch((err) => console.warn("LivrExpress push:", err));
      }
    } catch (e) {
      console.warn("LivrExpress push:", e);
    }

    return item;
  };

  /** Notification liée à un changement de statut de colis */
  const notifyStatusChange = (shipment, statusKey, overrides = {}) => {
    if (!shipment || !shipment.userId) return null;
    const meta = getStatusMeta(statusKey);
    const badge = meta.badge || meta.label || statusKey;
    const title =
      overrides.title ||
      `Colis ${shipment.trackingId} — ${badge}`;
    const message =
      overrides.message ||
      meta.guide ||
      meta.descActive ||
      `Nouveau statut : ${badge}`;
    return createNotification(shipment.userId, {
      type: "status",
      title,
      message,
      trackingId: shipment.trackingId,
      statusKey,
      icon: meta.icon || "📦",
      ...overrides,
    });
  };

  const listNotifications = (userId, filter = {}) => {
    if (!userId) return [];
    const map = readNotificationsMap();
    let list = Array.isArray(map[userId]) ? [...map[userId]] : [];
    if (filter.unreadOnly) list = list.filter((n) => !n.read);
    list.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    if (filter.limit) list = list.slice(0, filter.limit);
    return list;
  };

  const listNotificationsAsync = async (userId, filter = {}) => {
    if (!userId) return [];
    if (useSupabase()) {
      try {
        const remote = await global.LivrExpressSB.listNotificationsRemote(userId);
        const map = readNotificationsMap();
        map[userId] = remote;
        writeNotificationsMap(map);
        let list = [...remote];
        if (filter.unreadOnly) list = list.filter((n) => !n.read);
        if (filter.limit) list = list.slice(0, filter.limit);
        return list;
      } catch (e) {
        console.warn("listNotificationsAsync:", e);
      }
    }
    return listNotifications(userId, filter);
  };

  const countUnreadNotifications = (userId) => {
    if (!userId) return 0;
    const map = readNotificationsMap();
    const list = Array.isArray(map[userId]) ? map[userId] : [];
    return list.filter((n) => !n.read).length;
  };

  const markNotificationRead = (userId, notificationId) => {
    if (!userId || !notificationId) return { ok: false };
    const map = readNotificationsMap();
    const list = Array.isArray(map[userId]) ? map[userId] : [];
    let found = false;
    map[userId] = list.map((n) => {
      if (n.id === notificationId) {
        found = true;
        return { ...n, read: true };
      }
      return n;
    });
    if (found) {
      writeNotificationsMap(map);
      if (useSupabase()) {
        global.LivrExpressSB.markNotifReadRemote(userId, notificationId).catch(
          () => undefined
        );
      }
    }
    return { ok: found };
  };

  const markAllNotificationsRead = (userId) => {
    if (!userId) return { ok: false, count: 0 };
    const map = readNotificationsMap();
    const list = Array.isArray(map[userId]) ? map[userId] : [];
    let count = 0;
    map[userId] = list.map((n) => {
      if (!n.read) count += 1;
      return { ...n, read: true };
    });
    if (count) {
      writeNotificationsMap(map);
      if (useSupabase()) {
        global.LivrExpressSB.markAllNotifReadRemote(userId).catch(() => undefined);
      }
    }
    return { ok: true, count };
  };

  /**
   * Colis disponibles pour un livreur (validés, pas encore livrés, non pris ou à assigner)
   */
  const listAvailableForCourier = () => {
    seedDemosIfNeeded();
    return listShipments().filter((s) => {
      if (s.source === "demo") return false;
      if (s.statusKey === "delivered") return false;
      // Dispo si pas encore de livreur assigné, ou statut prepared/confirmed (prêt à l'enlèvement)
      const free =
        !s.assignedCourierUserId &&
        !s.courierId &&
        (s.statusKey === "confirmed" ||
          s.statusKey === "prepared" ||
          s.statusKey === "picked" ||
          s.statusKey === "transit" ||
          s.statusKey === "delivery");
      // Si déjà enlevé sans assignation user, encore claimable si pas de courierId
      return (
        free ||
        (!s.assignedCourierUserId &&
          ["confirmed", "prepared"].includes(s.statusKey))
      );
    });
  };

  const listShipmentsForCourier = (userId) => {
    if (!userId) return [];
    return listShipments().filter(
      (s) =>
        s.assignedCourierUserId === userId ||
        (s.courier && s.courier.userId === userId)
    );
  };

  const listActiveForCourier = (userId) =>
    listShipmentsForCourier(userId).filter((s) => s.statusKey !== "delivered");

  const listHistoryForCourier = (userId) =>
    listShipmentsForCourier(userId).filter((s) => s.statusKey === "delivered");

  /**
   * Livreur active une commande : s'assigne + démarre la course
   */
  const claimShipment = (trackingId, courierUser, courierProfile) => {
    const shipment = getShipment(trackingId);
    if (!shipment) return { ok: false, error: "Colis introuvable." };
    if (shipment.statusKey === "delivered") {
      return { ok: false, error: "Ce colis est déjà livré." };
    }
    if (
      shipment.assignedCourierUserId &&
      shipment.assignedCourierUserId !== courierUser.id
    ) {
      return { ok: false, error: "Ce colis est déjà pris par un autre livreur." };
    }

    const c = courierProfile || {
      id: courierUser.courierId,
      name: courierUser.name,
      phone: courierUser.phone,
      avatar: "🛵",
    };

    shipment.assignedCourierUserId = courierUser.id;
    shipment.courierId = c.id || shipment.courierId;
    shipment.courier = {
      id: c.id,
      userId: courierUser.id,
      name: c.name,
      phone: c.phone,
      avatar: c.avatar || "🛵",
      photoUrl: c.photoUrl || "",
      vehicle: c.vehicle,
      plate: c.plate,
      zone: c.zone,
      rating: c.rating,
      verified: true,
      meta: "Course activée",
      profileUrl: c.id ? `livreur.html?id=${encodeURIComponent(c.id)}` : null,
    };

    // Avancer au moins à "picked" si encore en préparation
    if (shipment.statusKey === "confirmed" || shipment.statusKey === "prepared") {
      // force status picked with event
      const nextKey =
        shipment.statusKey === "confirmed" ? "prepared" : "picked";
      // step through to picked
      let guard = 0;
      while (
        shipment.statusKey !== "picked" &&
        shipment.statusKey !== "delivered" &&
        guard < 5
      ) {
        const idx = STATUS_INDEX[shipment.statusKey] ?? 0;
        const next = PIPELINE[idx + 1];
        if (!next) break;
        shipment.statusKey = next.key;
        addEvent(shipment, next.key, {
          location: shipment.sender?.address || "",
          desc: `Prise en charge par ${c.name}.`,
          title: next.title,
        });
        guard += 1;
      }
      if (shipment.courier) shipment.courier.meta = "Colis enlevé · en route";
    } else if (shipment.courier) {
      shipment.courier.meta = "Course en cours";
    }

    shipment.updatedAt = new Date().toISOString();
    saveShipment(shipment);

    if (shipment.userId) {
      notifyStatusChange(shipment, shipment.statusKey, {
        message: `Votre colis est pris en charge par ${c.name}. Suivi GPS live activé.`,
      });
    }

    return { ok: true, shipment };
  };

  /** Livreur marque comme livré */
  const completeDeliveryByCourier = (trackingId, courierUser) => {
    const shipment = getShipment(trackingId);
    if (!shipment) return { ok: false, error: "Colis introuvable." };
    if (shipment.assignedCourierUserId !== courierUser.id) {
      return { ok: false, error: "Ce colis ne vous est pas assigné." };
    }
    if (shipment.statusKey === "delivered") {
      return { ok: true, shipment };
    }
    // avancer jusqu'à delivered
    let guard = 0;
    let current = shipment;
    while (current.statusKey !== "delivered" && guard < 8) {
      current = advanceShipment(current.trackingId);
      guard += 1;
      if (!current) break;
    }
    // incrément compteur livreur
    const Prof = global.LivrExpressProfile;
    if (Prof && current?.courierId) {
      const cr = Prof.getCourier(current.courierId);
      if (cr) {
        Prof.saveCourier({
          ...cr,
          deliveriesCount: (cr.deliveriesCount || 0) + 1,
        });
      }
    }
    return { ok: true, shipment: current };
  };

  /** Avance d’un cran le statut (ops admin / livreur) */
  const advanceShipment = (trackingId) => {
    const shipment = getShipment(trackingId);
    if (!shipment || shipment.statusKey === "delivered") return shipment;

    const idx = STATUS_INDEX[shipment.statusKey] ?? 0;
    const next = PIPELINE[idx + 1];
    if (!next) return shipment;

    shipment.statusKey = next.key;
    const location =
      next.key === "picked" || next.key === "delivery"
        ? shipment.sender?.address || ""
        : next.key === "transit"
          ? "Hub LivrExpress · Plateau"
          : next.key === "delivered"
            ? shipment.recipient?.address || ""
            : shipment.sender?.address || "";

    if (
      (next.key === "picked" || next.key === "delivery") &&
      !shipment.courier
    ) {
      const c = randomCourier();
      shipment.courier = {
        ...c,
        meta: next.key === "delivery" ? "En tournée" : "Enlevé",
      };
      if (c.id) shipment.courierId = c.id;
    }

    if (next.key === "delivery" && shipment.courier) {
      shipment.courier.meta = `En route · ${shipment.recipient?.city || "Dakar"}`;
    }
    if (next.key === "delivered" && shipment.courier) {
      shipment.courier.meta = `Livré · ${formatTime(new Date())}`;
      shipment.deliveredAt = new Date().toISOString();
    }

    const desc =
      next.key === "delivered"
        ? `Remis à ${shipment.recipient?.name || "destinataire"}.`
        : next.descActive;

    addEvent(shipment, next.key, {
      location,
      desc,
    });

    // ETA
    if (next.key === "delivered") {
      shipment.etaLabel = "Livré";
    }

    const saved = saveShipment(shipment);

    // Client informé à chaque évolution du colis
    notifyStatusChange(saved, next.key, {
      message:
        next.key === "delivered"
          ? `Votre colis ${saved.trackingId} a été remis au destinataire. Merci d’avoir choisi LivrExpress !`
          : `${desc} Suivez l’évolution en temps réel.`,
    });

    return saved;
  };

  const setStatus = (trackingId, statusKey) => {
    let shipment = getShipment(trackingId);
    if (!shipment || STATUS_INDEX[statusKey] == null) return shipment || null;

    const target = STATUS_INDEX[statusKey];
    let guard = 0;
    while (
      (STATUS_INDEX[shipment.statusKey] ?? 0) < target &&
      shipment.statusKey !== "delivered" &&
      guard < 10
    ) {
      shipment = advanceShipment(shipment.trackingId);
      guard += 1;
    }
    return shipment;
  };

  // —— Demandes de commande (validation admin avant n° de suivi) ——
  const readOrders = () => {
    try {
      const raw = localStorage.getItem(ORDERS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeOrders = (map) => {
    try {
      localStorage.setItem(ORDERS_KEY, JSON.stringify(map));
      try {
        global.dispatchEvent(
          new CustomEvent("livrexpress:orders", { detail: { map } })
        );
      } catch (_) {
        /* ignore */
      }
    } catch (e) {
      console.warn("LivrExpress: commandes non enregistrées", e);
    }
  };

  /**
   * IDs des comptes admin (local + fallback super-admin).
   * Utilisé pour pousser les alertes « nouvelle commande ».
   */
  const listAdminUserIds = () => {
    const ids = new Set();
    // Fallback propriétaire (auth.js DEFAULT_SUPER_ADMIN.id)
    ids.add("super_admin_owner");
    try {
      const Auth = global.Auth || global.LivrExpressAuth;
      if (Auth && typeof Auth.listAdmins === "function") {
        Auth.listAdmins().forEach((a) => {
          if (a && a.id) ids.add(a.id);
        });
      }
    } catch (_) {
      /* ignore */
    }
    try {
      const raw = localStorage.getItem("livrexpress_users_v1");
      if (raw) {
        const users = JSON.parse(raw);
        Object.values(users || {}).forEach((u) => {
          if (
            u &&
            u.id &&
            (u.role === "admin" || u.role === "super_admin")
          ) {
            ids.add(u.id);
          }
        });
      }
    } catch (_) {
      /* ignore */
    }
    return [...ids];
  };

  /** Notifie tous les admins (nouvelle commande, etc.) */
  const notifyAdmins = (payload = {}) => {
    const items = [];
    listAdminUserIds().forEach((adminId) => {
      const item = createNotification(adminId, {
        type: payload.type || "admin_order",
        icon: payload.icon || "🧾",
        ...payload,
      });
      if (item) items.push(item);
    });
    return items;
  };

  /**
   * Version async : notifie uniquement les admins distants absents de la liste locale
   * (évite les doublons après un appel notifyAdmins sync).
   */
  const notifyAdminsAsync = async (payload = {}, alreadyNotifiedIds = []) => {
    const known = new Set(alreadyNotifiedIds || listAdminUserIds());
    const extra = new Set();
    try {
      const Auth = global.Auth || global.LivrExpressAuth;
      if (Auth && typeof Auth.listAdminsAsync === "function") {
        const remote = await Auth.listAdminsAsync();
        (remote || []).forEach((a) => {
          if (a && a.id && !known.has(a.id)) extra.add(a.id);
        });
      }
    } catch (e) {
      console.warn("notifyAdminsAsync list:", e);
    }
    const items = [];
    extra.forEach((adminId) => {
      const item = createNotification(adminId, {
        type: payload.type || "admin_order",
        icon: payload.icon || "🧾",
        ...payload,
      });
      if (item) items.push(item);
    });
    return items;
  };

  const orderId = () =>
    `CMD-${Date.now().toString(36).toUpperCase()}-${Math.random()
      .toString(36)
      .slice(2, 6)
      .toUpperCase()}`;

  /**
   * Client : crée une demande en attente de validation admin.
   * Aucun n° de suivi n’est attribué tant que l’admin n’a pas validé.
   */
  const createOrderRequest = (form, user) => {
    if (!user || !user.id) {
      throw new Error("Authentification client requise.");
    }
    const map = readOrders();
    const id = orderId();
    const now = new Date().toISOString();
    const planInfo = PLAN_PRICES[form.plan] || PLAN_PRICES.Express;

    const locations = form.locations || {};
    const request = {
      id,
      userId: user.id,
      userEmail: user.email || "",
      userName: user.name || form.name || "",
      status: "pending", // pending | approved | rejected
      plan: form.plan || "Express",
      pricing: {
        amount: planInfo.amount,
        currency: "FCFA",
        label: planInfo.label,
      },
      sender: {
        name: form.name || user.name || "",
        phone: form.phone || user.phone || "",
        address: form.pickup || locations.pickup?.label || "",
        city: "Dakar",
        lat: locations.pickup?.lat ?? null,
        lng: locations.pickup?.lng ?? null,
        locationSource: locations.pickup?.source || "address",
      },
      recipient: {
        name: form.recipientName || "",
        phone: form.recipientPhone || "",
        address: form.dropoff || locations.delivery?.label || "",
        city: "Dakar",
        lat: locations.delivery?.lat ?? null,
        lng: locations.delivery?.lng ?? null,
        locationSource: locations.delivery?.source || "address",
      },
      // Modes : gps (téléphone) | address (choisie)
      deliveryMode: form.deliveryMode || locations.delivery?.source || "address",
      pickupMode: form.pickupMode || locations.pickup?.source || "address",
      locations,
      package: {
        type: form.package || "Colis",
        weight: form.weight || "—",
        description: form.notes || "",
        pieces: 1,
      },
      notes: form.notes || "",
      trackingId: null,
      rejectReason: "",
      createdAt: now,
      updatedAt: now,
      reviewedAt: null,
      reviewedBy: null,
    };

    map[id] = request;
    writeOrders(map);
    if (useSupabase()) {
      global.LivrExpressSB.upsertOrder(request).catch((e) =>
        console.warn("Sync order:", e)
      );
    }

    // —— Notifications automatiques ——
    // 1) Client : confirmation de réception de la demande
    createNotification(user.id, {
      type: "order_pending",
      title: "Demande envoyée",
      message: `Votre demande ${id} est en attente de validation LivrExpress. Vous serez notifié dès qu’elle sera traitée.`,
      orderId: id,
      icon: "⏳",
    });

    // 2) Admins : nouvelle commande à valider (immédiat + async Supabase)
    const adminPayload = {
      type: "new_order",
      title: "Nouvelle commande",
      message: `${request.userName || request.userEmail || "Client"} · ${request.plan} · ${request.sender?.address || "—"} → ${request.recipient?.address || "—"} (${id})`,
      orderId: id,
      icon: "🧾",
      url: "admin.html",
    };
    const adminNotifs = notifyAdmins(adminPayload);
    // Enrichit avec les IDs admin distants absents du local (sans bloquer)
    notifyAdminsAsync(
      adminPayload,
      adminNotifs.map((n) => n.userId)
    ).catch((e) => console.warn("notifyAdminsAsync:", e));

    try {
      global.dispatchEvent(
        new CustomEvent("livrexpress:new-order", {
          detail: { request },
        })
      );
    } catch (_) {
      /* ignore */
    }

    return request;
  };

  const getOrderRequest = (id) => readOrders()[id] || null;

  const listOrderRequests = (filter = {}) => {
    let list = Object.values(readOrders());
    if (filter.userId) list = list.filter((o) => o.userId === filter.userId);
    if (filter.status) list = list.filter((o) => o.status === filter.status);
    return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  /** Liste commandes (Supabase si actif, sinon local) */
  const listOrderRequestsAsync = async (filter = {}) => {
    if (useSupabase()) {
      try {
        const remote = await global.LivrExpressSB.listOrdersRemote(filter);
        // miroir local pour offline
        const map = readOrders();
        remote.forEach((o) => {
          map[o.id] = o;
        });
        writeOrders(map);
        return remote;
      } catch (e) {
        console.warn("listOrderRequestsAsync:", e);
      }
    }
    return listOrderRequests(filter);
  };

  const listShipmentsByUser = (userId) => {
    seedDemosIfNeeded();
    return Object.values(readAll())
      .filter((s) => s.userId === userId && s.source !== "demo")
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const listShipmentsByUserAsync = async (userId) => {
    if (useSupabase() && userId) {
      try {
        const remote = await global.LivrExpressSB.listShipmentsRemote({
          userId,
        });
        const map = readAll();
        remote.forEach((s) => {
          map[s.trackingId] = s;
        });
        writeAll(map);
        return remote.filter((s) => s.source !== "demo");
      } catch (e) {
        console.warn("listShipmentsByUserAsync:", e);
      }
    }
    return listShipmentsByUser(userId);
  };

  /**
   * Admin : valide une demande → génère n° de suivi + expédition active
   */
  const approveOrderRequest = (requestId, adminUser) => {
    const map = readOrders();
    const request = map[requestId];
    if (!request) return { ok: false, error: "Demande introuvable." };
    if (request.status === "approved") {
      return { ok: true, request, shipment: getShipment(request.trackingId) };
    }
    if (request.status === "rejected") {
      return { ok: false, error: "Cette demande a été refusée." };
    }

    const shipMap = readAll();
    const trackingId = generateTrackingId(new Set(Object.keys(shipMap)));
    const now = new Date();
    const planInfo = PLAN_PRICES[request.plan] || PLAN_PRICES.Express;
    const eta = new Date(now.getTime() + planInfo.etaMax * 60 * 1000);

    const shipment = {
      trackingId,
      orderRequestId: request.id,
      userId: request.userId,
      userEmail: request.userEmail,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      statusKey: "confirmed",
      plan: request.plan || "Express",
      pricing: request.pricing || {
        amount: planInfo.amount,
        currency: "FCFA",
        label: planInfo.label,
      },
      sender: { ...request.sender },
      recipient: { ...request.recipient },
      package: {
        ...request.package,
        reference: trackingId,
      },
      courier: null,
      // Positions GPS : départ / livraison (client GPS ou adresse) + livreur live
      locations: {
        ...(request.locations || {}),
        pickup: request.locations?.pickup || {
          label: request.sender?.address,
          lat: request.sender?.lat,
          lng: request.sender?.lng,
          source: request.sender?.locationSource || "address",
        },
        delivery: request.locations?.delivery || {
          label: request.recipient?.address,
          lat: request.recipient?.lat,
          lng: request.recipient?.lng,
          source: request.recipient?.locationSource || "address",
        },
        courier: null,
      },
      deliveryMode: request.deliveryMode || "address",
      pickupMode: request.pickupMode || "address",
      eta: eta.toISOString(),
      etaLabel: `${planInfo.etaMin}–${planInfo.etaMax} min`,
      events: [],
      stepTimes: {},
      notes: request.notes || "",
      source: "order",
      serviceLevel: request.plan || "Express",
    };

    addEvent(shipment, "confirmed", {
      at: now.toISOString(),
      location: "Dakar · Validation admin",
      desc: `Commande ${request.id} validée. N° de suivi attribué : ${trackingId}.`,
      title: "Commande validée — n° de suivi créé",
    });

    shipment.statusKey = "prepared";
    addEvent(shipment, "prepared", {
      at: now.toISOString(),
      location: shipment.sender.address || "Point d’enlèvement",
      desc: "Colis prêt pour prise en charge livreur.",
    });

    saveShipment(shipment);

    request.status = "approved";
    request.trackingId = trackingId;
    request.updatedAt = now.toISOString();
    request.reviewedAt = now.toISOString();
    request.reviewedBy = adminUser?.email || adminUser?.id || "admin";
    map[requestId] = request;
    writeOrders(map);
    if (useSupabase()) {
      global.LivrExpressSB.upsertOrder(request).catch((e) =>
        console.warn("Sync order approve:", e)
      );
    }

    // Notifications client : validation + statuts initiaux
    if (request.userId) {
      createNotification(request.userId, {
        type: "order_approved",
        title: "Commande validée",
        message: `Votre demande ${request.id} est acceptée. N° de suivi : ${trackingId}.`,
        trackingId,
        orderId: request.id,
        icon: "✅",
      });
      notifyStatusChange(shipment, "confirmed", {
        message: `Commande enregistrée. Votre n° de suivi est ${trackingId}.`,
      });
      notifyStatusChange(shipment, "prepared", {
        message:
          "Votre colis est préparé et prêt pour l’enlèvement par le livreur.",
      });
    }

    return { ok: true, request, shipment };
  };

  /** Admin : refuse une demande */
  const rejectOrderRequest = (requestId, adminUser, reason = "") => {
    const map = readOrders();
    const request = map[requestId];
    if (!request) return { ok: false, error: "Demande introuvable." };
    if (request.status !== "pending") {
      return { ok: false, error: "Seules les demandes en attente peuvent être refusées." };
    }
    const now = new Date().toISOString();
    request.status = "rejected";
    request.rejectReason = reason || "Demande refusée par l’administration.";
    request.updatedAt = now;
    request.reviewedAt = now;
    request.reviewedBy = adminUser?.email || adminUser?.id || "admin";
    map[requestId] = request;
    writeOrders(map);
    if (useSupabase()) {
      global.LivrExpressSB.upsertOrder(request).catch((e) =>
        console.warn("Sync order reject:", e)
      );
    }

    if (request.userId) {
      createNotification(request.userId, {
        type: "order_rejected",
        title: "Demande refusée",
        message: request.rejectReason,
        orderId: request.id,
        icon: "❌",
      });
    }

    return { ok: true, request };
  };

  /** Traitement en masse : valider plusieurs demandes */
  const bulkApproveOrderRequests = (ids, adminUser) => {
    const results = [];
    (ids || []).forEach((id) => {
      results.push({ id, ...approveOrderRequest(id, adminUser) });
    });
    const ok = results.filter((r) => r.ok).length;
    return { ok: true, approved: ok, total: results.length, results };
  };

  /** Traitement en masse : refuser plusieurs demandes */
  const bulkRejectOrderRequests = (ids, adminUser, reason = "") => {
    const results = [];
    (ids || []).forEach((id) => {
      results.push({ id, ...rejectOrderRequest(id, adminUser, reason) });
    });
    const ok = results.filter((r) => r.ok).length;
    return { ok: true, rejected: ok, total: results.length, results };
  };

  /** @deprecated use createOrderRequest + approveOrderRequest */
  const createShipmentFromOrder = (form, user) => {
    const req = createOrderRequest(form, user || { id: "guest", name: form.name });
    // Compat : si pas d'admin flow, ne crée plus le suivi directement
    return req;
  };

  // —— Demos seed ——
  const getDemoShipments = () => {
    const day = new Date();
    day.setHours(10, 0, 0, 0);

    const mk = (partial) => {
      const base = {
        pricing: { amount: 1500, currency: "FCFA", label: "Express" },
        package: {
          type: "Colis",
          weight: "2 kg",
          description: "Démo",
          pieces: 1,
        },
        source: "demo",
        events: [],
        stepTimes: {},
        serviceLevel: "Express",
        ...partial,
      };
      base.package.reference = base.trackingId;
      return base;
    };

    const demos = {};

    // LX-5510 style short IDs kept for compatibility
    const d1 = mk({
      trackingId: "LX-5510",
      createdAt: new Date(day.getTime() + 5.5 * 3600000).toISOString(),
      updatedAt: new Date(day.getTime() + 5.7 * 3600000).toISOString(),
      statusKey: "prepared",
      plan: "Express",
      sender: {
        name: "Boutique Parcelles",
        phone: "77 111 11 11",
        address: "Parcelles Assainies, Dakar",
        city: "Dakar",
      },
      recipient: {
        name: "Client Mermoz",
        phone: "77 222 22 22",
        address: "Mermoz, Dakar",
        city: "Dakar",
      },
      package: {
        type: "Courses",
        weight: "4 kg",
        description: "Courses alimentaires",
        pieces: 1,
        reference: "LX-5510",
      },
      courier: null,
      etaLabel: "~45 min",
      pricing: { amount: 1500, currency: "FCFA", label: "Express" },
    });
    addEvent(d1, "confirmed", {
      at: new Date(day.getTime() + 5.5 * 3600000).toISOString(),
      location: "Dakar · Système",
      desc: "Course Express enregistrée.",
    });
    addEvent(d1, "prepared", {
      at: new Date(day.getTime() + 5.7 * 3600000).toISOString(),
      location: "Parcelles Assainies",
      desc: "Colis prêt — recherche livreur.",
    });
    demos["LX-5510"] = d1;

    const d2 = mk({
      trackingId: "LX-3301",
      createdAt: new Date(day.getTime() + 1 * 3600000).toISOString(),
      updatedAt: new Date(day.getTime() + 1.35 * 3600000).toISOString(),
      statusKey: "picked",
      plan: "Express",
      sender: {
        name: "Expéditeur Point E",
        phone: "77 333 33 33",
        address: "Point E, Dakar",
        city: "Dakar",
      },
      recipient: {
        name: "Destinataire Sacré-Cœur",
        phone: "77 444 44 44",
        address: "Sacré-Cœur, Dakar",
        city: "Dakar",
      },
      package: {
        type: "Documents",
        weight: "0,5 kg",
        description: "Documents urgents",
        pieces: 1,
        reference: "LX-3301",
      },
      courier: {
        name: "Ibrahima F.",
        avatar: "🛵",
        phone: WHATSAPP,
        meta: "Enlevé · Point E",
      },
      etaLabel: "25 min",
    });
    addEvent(d2, "confirmed", {
      at: new Date(day.getTime() + 1 * 3600000).toISOString(),
      location: "Dakar",
      desc: "Commande confirmée.",
    });
    addEvent(d2, "prepared", {
      at: new Date(day.getTime() + 1.1 * 3600000).toISOString(),
      location: "Point E",
      desc: "Colis préparé.",
    });
    addEvent(d2, "picked", {
      at: new Date(day.getTime() + 1.35 * 3600000).toISOString(),
      location: "Point E, Dakar",
      desc: "Ibrahima F. a récupéré le colis.",
    });
    demos["LX-3301"] = d2;

    const d3 = mk({
      trackingId: "LX-2847",
      createdAt: new Date(day.getTime() + 4 * 3600000).toISOString(),
      updatedAt: new Date(day.getTime() + 4.4 * 3600000).toISOString(),
      statusKey: "delivery",
      plan: "Express",
      sender: {
        name: "Expéditeur Médina",
        phone: "77 555 55 55",
        address: "Médina, Dakar",
        city: "Dakar",
      },
      recipient: {
        name: "Destinataire Plateau",
        phone: "77 666 66 66",
        address: "Plateau, Dakar",
        city: "Dakar",
      },
      package: {
        type: "Colis",
        weight: "2,5 kg",
        description: "Colis standard",
        pieces: 1,
        reference: "LX-2847",
      },
      courier: {
        name: "Moussa D.",
        avatar: "🛵",
        phone: WHATSAPP,
        meta: "À 8 min · Plateau",
      },
      etaLabel: "8 min",
      pricing: { amount: 1500, currency: "FCFA", label: "Express" },
    });
    [
      ["confirmed", 4, "Dakar", "Course Express enregistrée via WhatsApp."],
      ["prepared", 4.1, "Médina", "Colis prêt pour enlèvement."],
      ["picked", 4.25, "Médina, Dakar", "Moussa D. a récupéré le colis."],
      ["transit", 4.3, "Hub LivrExpress · Plateau", "Scan hub de tri."],
      [
        "delivery",
        4.4,
        "Plateau, Dakar",
        "En route vers le destinataire.",
      ],
    ].forEach(([key, h, loc, desc]) => {
      addEvent(d3, key, {
        at: new Date(day.getTime() + h * 3600000).toISOString(),
        location: loc,
        desc,
      });
    });
    demos["LX-2847"] = d3;

    const d4 = mk({
      trackingId: "LX-1092",
      createdAt: new Date(day.getTime() - 0.2 * 3600000).toISOString(),
      updatedAt: new Date(day.getTime() + 0.55 * 3600000).toISOString(),
      statusKey: "delivered",
      plan: "Pro",
      deliveredAt: new Date(day.getTime() + 0.55 * 3600000).toISOString(),
      sender: {
        name: "Expéditeur Ouakam",
        phone: "77 777 77 77",
        address: "Ouakam, Dakar",
        city: "Dakar",
      },
      recipient: {
        name: "Destinataire Almadies",
        phone: "77 888 88 88",
        address: "Almadies, Dakar",
        city: "Dakar",
      },
      package: {
        type: "Documents",
        weight: "1,2 kg",
        description: "Documents Pro",
        pieces: 1,
        reference: "LX-1092",
      },
      courier: {
        name: "Awa S.",
        avatar: "🛵",
        phone: WHATSAPP,
        meta: "Livré · Almadies",
      },
      etaLabel: "Livré",
      pricing: { amount: 2500, currency: "FCFA", label: "Pro" },
    });
    [
      ["confirmed", -0.2, "Dakar", "Course Pro prioritaire confirmée."],
      ["prepared", -0.05, "Ouakam", "Colis préparé."],
      ["picked", 0.15, "Ouakam", "Awa S. a récupéré le colis."],
      ["transit", 0.25, "Hub Almadies", "Transfert rapide Pro."],
      ["delivery", 0.35, "Almadies", "En livraison finale."],
      [
        "delivered",
        0.55,
        "Almadies, Dakar",
        "Colis remis en main propre.",
      ],
    ].forEach(([key, h, loc, desc]) => {
      addEvent(d4, key, {
        at: new Date(day.getTime() + h * 3600000).toISOString(),
        location: loc,
        desc,
      });
    });
    demos["LX-1092"] = d4;

    return demos;
  };

  /** Mode live : purge des colis de démo du stockage local */
  const seedDemosIfNeeded = () => {
    const map = readAll();
    let changed = false;
    Object.keys(map).forEach((id) => {
      if (map[id] && map[id].source === "demo") {
        delete map[id];
        changed = true;
      }
    });
    if (changed) writeAll(map);
  };

  // —— UI helpers (stepper HTML) ——
  const renderStepperHtml = (steps, options = {}) => {
    const { showTimes = true, compact = false } = options;
    const cls = compact ? "stepper stepper--compact" : "stepper";
    // 6 steps: denser grid
    const items = steps
      .map((step, i) => {
        const stateClass =
          step.state === "done"
            ? "is-done"
            : step.state === "active"
              ? "is-active"
              : "is-pending";
        const lineClass =
          i < steps.length - 1
            ? step.state === "done"
              ? "is-filled"
              : "is-empty"
            : "";
        const mark = step.state === "done" ? "✓" : String(i + 1);
        const aria =
          step.state === "done"
            ? "terminée"
            : step.state === "active"
              ? "en cours"
              : "à venir";
        let timeHtml = "";
        if (showTimes) {
          if (step.time) {
            timeHtml = `<span class="stepper__time">${step.time}</span>`;
          } else if (step.state === "active") {
            timeHtml =
              '<span class="stepper__time stepper__time--now">Maintenant</span>';
          } else {
            timeHtml =
              '<span class="stepper__time stepper__time--muted">—</span>';
          }
        }
        return `
          <li class="stepper__item ${stateClass}" data-step="${step.key}" aria-label="${step.label} : ${aria}">
            <div class="stepper__node">
              <span class="stepper__mark" aria-hidden="true">${mark}</span>
              ${i < steps.length - 1 ? `<span class="stepper__line ${lineClass}" aria-hidden="true"></span>` : ""}
            </div>
            <div class="stepper__meta">
              ${compact ? "" : `<span class="stepper__icon" aria-hidden="true">${step.icon}</span>`}
              <span class="stepper__label">${step.label}</span>
              ${timeHtml}
            </div>
          </li>`;
      })
      .join("");
    return { className: cls, html: items, count: steps.length };
  };

  const viewModel = (shipment) => {
    if (!shipment) return null;
    const meta = getStatusMeta(shipment.statusKey);
    const steps = resolveSteps(shipment);
    const progress = resolveProgress(shipment.statusKey);
    const timeline = buildTimeline(shipment);
    const active = steps.find((s) => s.state === "active");

    return {
      shipment,
      meta,
      steps,
      progress,
      timeline,
      guideTitle: active
        ? `Étape actuelle : ${active.label}`
        : shipment.statusKey === "delivered"
          ? "Livraison terminée"
          : "Suivi de votre colis",
      guide: meta.guide,
      badge: meta.badge,
      statusClass: meta.statusClass,
      label:
        shipment.statusKey === "delivered"
          ? "Colis livré"
          : shipment.statusKey === "confirmed"
            ? "Commande enregistrée"
            : "Colis en cours",
      icon: meta.icon === "📝" ? "📦" : meta.icon,
      live: meta.live,
      liveText: meta.liveText,
      courier: (() => {
        const enriched = global.LivrExpressProfile?.enrichShipmentCourier?.(
          shipment
        );
        if (enriched) return enriched;
        return (
          shipment.courier || {
            name: "Livreur en attente",
            avatar: "⏳",
            meta: "Assignation sous peu",
            phone: WHATSAPP,
          }
        );
      })(),
      formatDateTime,
      formatTime,
      formatDateShort,
    };
  };

  // Init demos
  try {
    seedDemosIfNeeded();
  } catch (_) {
    /* ignore */
  }

  global.LivrExpress = {
    PIPELINE,
    WHATSAPP,
    generateTrackingId,
    normalizeTrackingId,
    createOrderRequest,
    createShipmentFromOrder,
    getOrderRequest,
    listOrderRequests,
    approveOrderRequest,
    rejectOrderRequest,
    bulkApproveOrderRequests,
    bulkRejectOrderRequests,
    listShipmentsByUser,
    getShipment,
    getShipmentAsync,
    listShipments,
    listShipmentsByUserAsync,
    listOrderRequestsAsync,
    listNotificationsAsync,
    saveShipment,
    advanceShipment,
    setStatus,
    listAvailableForCourier,
    listShipmentsForCourier,
    listActiveForCourier,
    listHistoryForCourier,
    claimShipment,
    completeDeliveryByCourier,
    useSupabase,
    resolveSteps,
    resolveProgress,
    buildTimeline,
    getStatusMeta,
    viewModel,
    renderStepperHtml,
    formatDateTime,
    formatTime,
    formatDateShort,
    seedDemosIfNeeded,
    PLAN_PRICES,
    // Notifications client + admin
    createNotification,
    notifyStatusChange,
    notifyAdmins,
    notifyAdminsAsync,
    listAdminUserIds,
    listNotifications,
    countUnreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  };
})(typeof window !== "undefined" ? window : globalThis);
