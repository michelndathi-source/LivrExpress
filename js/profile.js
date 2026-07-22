/**
 * LivrExpress — Profils comptes (clients) + livreurs
 * Photo, mapping client, auto-remplissage commandes, stats
 */
(function (global) {
  const EXT_KEY = "livrexpress_profiles_ext_v1";
  const COURIERS_KEY = "livrexpress_couriers_v1";

  const TIERS = {
    standard: { label: "Standard", class: "tier--standard" },
    pro: { label: "Pro", class: "tier--pro" },
    business: { label: "Business", class: "tier--business" },
    vip: { label: "VIP", class: "tier--vip" },
  };

  const DEFAULT_COURIERS = [
    {
      id: "cr_moussa",
      name: "Moussa Diop",
      phone: "221770000001",
      photoUrl: "",
      avatar: "🛵",
      vehicle: "Moto",
      plate: "DK-4521-A",
      zone: "Plateau · Médina · Point E",
      rating: 4.9,
      deliveriesCount: 842,
      bio: "Livreur LivrExpress depuis 2022. Ponctuel, soigneux avec les documents et colis fragiles.",
      languages: ["Français", "Wolof"],
      verified: true,
      active: true,
      joinedAt: "2022-03-12T00:00:00.000Z",
    },
    {
      id: "cr_awa",
      name: "Awa Sarr",
      phone: "221770000002",
      photoUrl: "",
      avatar: "🛵",
      vehicle: "Moto",
      plate: "DK-8830-B",
      zone: "Almadies · Ouakam · Ngor",
      rating: 4.8,
      deliveriesCount: 691,
      bio: "Spécialiste zone Ouest. Disponible 7j/7 pour courses Express et Pro.",
      languages: ["Français", "Wolof", "English"],
      verified: true,
      active: true,
      joinedAt: "2022-08-01T00:00:00.000Z",
    },
    {
      id: "cr_ibrahima",
      name: "Ibrahima Fall",
      phone: "221770000003",
      photoUrl: "",
      avatar: "🛵",
      vehicle: "Moto",
      plate: "DK-1204-C",
      zone: "Parcelles · Pikine · Guédiawaye",
      rating: 4.7,
      deliveriesCount: 520,
      bio: "Connaît parfaitement le trafic périphérie. Remises en main propre sécurisées.",
      languages: ["Français", "Wolof"],
      verified: true,
      active: true,
      joinedAt: "2023-01-20T00:00:00.000Z",
    },
    {
      id: "cr_fatou",
      name: "Fatou Kane",
      phone: "221770000004",
      photoUrl: "",
      avatar: "🛵",
      vehicle: "Scooter",
      plate: "DK-3399-D",
      zone: "Mermoz · Sacré-Cœur · Fann",
      rating: 5.0,
      deliveriesCount: 410,
      bio: "Top livreuse 2025. Communication client exemplaire et suivi GPS rigoureux.",
      languages: ["Français", "Wolof"],
      verified: true,
      active: true,
      joinedAt: "2023-06-05T00:00:00.000Z",
    },
  ];

  const readExt = () => {
    try {
      return JSON.parse(localStorage.getItem(EXT_KEY) || "{}") || {};
    } catch {
      return {};
    }
  };

  const writeExt = (map) => {
    try {
      localStorage.setItem(EXT_KEY, JSON.stringify(map));
    } catch (e) {
      console.warn("profiles ext:", e);
    }
  };

  const readCouriers = () => {
    try {
      const raw = localStorage.getItem(COURIERS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && Object.keys(parsed).length) {
          return parsed;
        }
      }
    } catch {
      /* ignore */
    }
    const map = {};
    DEFAULT_COURIERS.forEach((c) => {
      map[c.id] = c;
    });
    try {
      localStorage.setItem(COURIERS_KEY, JSON.stringify(map));
    } catch (_) {
      /* ignore */
    }
    return map;
  };

  const writeCouriers = (map) => {
    try {
      localStorage.setItem(COURIERS_KEY, JSON.stringify(map));
    } catch (_) {
      /* ignore */
    }
  };

  const emptyExt = () => ({
    photoUrl: "",
    city: "Dakar",
    neighborhood: "",
    company: "",
    bio: "",
    preferredPickup: "",
    preferredDropoff: "",
    defaultPlan: "Express",
    clientTier: "standard",
    tags: [],
  });

  const getExt = (userId) => {
    if (!userId) return emptyExt();
    const map = readExt();
    return { ...emptyExt(), ...(map[userId] || {}) };
  };

  const setExt = (userId, patch) => {
    if (!userId) return null;
    const map = readExt();
    const prev = { ...emptyExt(), ...(map[userId] || {}) };
    const next = { ...prev, ...patch, updatedAt: new Date().toISOString() };
    map[userId] = next;
    writeExt(map);

    // Sync Supabase profiles si dispo
    const SB = global.LivrExpressSB;
    if (SB?.isEnabled?.()) {
      const row = {
        photo_url: next.photoUrl || "",
        city: next.city || "Dakar",
        neighborhood: next.neighborhood || "",
        company: next.company || "",
        bio: next.bio || "",
        preferred_pickup: next.preferredPickup || "",
        preferred_dropoff: next.preferredDropoff || "",
        default_plan: next.defaultPlan || "Express",
        client_tier: next.clientTier || "standard",
        tags: next.tags || [],
      };
      const sb = SB.getClient?.();
      if (sb) {
        sb.from("profiles")
          .update(row)
          .eq("id", userId)
          .then(({ error }) => {
            if (error) console.warn("profile sync:", error.message);
          });
      }
    }
    return next;
  };

  /** Fusionne user Auth + extension + stats commandes */
  const buildAccountProfile = (user, options = {}) => {
    if (!user) return null;
    const LX = global.LivrExpress;
    const ext = getExt(user.id);
    const orders = LX
      ? LX.listOrderRequests({ userId: user.id })
      : [];
    const shipments = LX
      ? LX.listShipmentsByUser(user.id)
      : [];

    const totalOrders = orders.length;
    const approved = orders.filter((o) => o.status === "approved").length;
    const pending = orders.filter((o) => o.status === "pending").length;
    const rejected = orders.filter((o) => o.status === "rejected").length;
    const delivered = shipments.filter((s) => s.statusKey === "delivered").length;
    const active = shipments.filter((s) => s.statusKey !== "delivered").length;
    const totalSpent = orders
      .filter((o) => o.status === "approved")
      .reduce((sum, o) => sum + (o.pricing?.amount || 0), 0);

    const lastOrder = orders[0] || null;
    const neighborhoods = new Set();
    orders.forEach((o) => {
      const a = (o.sender?.address || "") + " " + (o.recipient?.address || "");
      ["Médina", "Plateau", "Almadies", "Ouakam", "Parcelles", "Mermoz", "Point E", "Sacré"].forEach(
        (n) => {
          if (a.toLowerCase().includes(n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 5))) {
            neighborhoods.add(n);
          }
        }
      );
    });

    // Auto-tier si non forcé manuellement
    let tier = ext.clientTier || "standard";
    if (!options.keepTier) {
      if (totalSpent >= 100000 || approved >= 20) tier = "vip";
      else if (totalSpent >= 45000 || approved >= 10) tier = "business";
      else if (approved >= 3) tier = "pro";
    }

    const initials = String(user.name || user.email || "?")
      .split(/\s+/)
      .map((p) => p[0])
      .join("")
      .slice(0, 2)
      .toUpperCase();

    return {
      ...user,
      ...ext,
      clientTier: ext.clientTier && ext.clientTier !== "standard" ? ext.clientTier : tier,
      initials,
      stats: {
        totalOrders,
        approved,
        pending,
        rejected,
        delivered,
        active,
        totalSpent,
        lastOrderAt: lastOrder?.createdAt || null,
        lastOrderId: lastOrder?.id || null,
      },
      zones: [...neighborhoods],
      activity: buildActivity(user.id, orders, shipments),
      profileUrl: `profil.html?id=${encodeURIComponent(user.id)}`,
    };
  };

  const buildActivity = (userId, orders, shipments) => {
    const items = [];
    (orders || []).forEach((o) => {
      items.push({
        type: "order",
        id: o.id,
        title: `Demande ${o.id}`,
        status: o.status,
        plan: o.plan,
        at: o.createdAt,
        meta: `${o.sender?.address || "—"} → ${o.recipient?.address || "—"}`,
        href: null,
      });
    });
    (shipments || []).forEach((s) => {
      items.push({
        type: "shipment",
        id: s.trackingId,
        title: `Colis ${s.trackingId}`,
        status: s.statusKey,
        plan: s.plan,
        at: s.updatedAt || s.createdAt,
        meta: s.recipient?.address || "",
        href: `suivi.html?id=${encodeURIComponent(s.trackingId)}`,
      });
    });
    items.sort((a, b) => new Date(b.at) - new Date(a.at));
    return items.slice(0, 40);
  };

  const buildAccountProfileAsync = async (user) => {
    if (!user) return null;
    const SB = global.LivrExpressSB;
    if (SB?.isEnabled?.()) {
      try {
        const remote = await SB.fetchProfile(user.id);
        if (remote) {
          // merge remote fields into ext cache
          setExt(user.id, {
            photoUrl: remote.photoUrl || remote.photo_url || getExt(user.id).photoUrl,
            city: remote.city || getExt(user.id).city,
            neighborhood: remote.neighborhood || getExt(user.id).neighborhood,
            company: remote.company || getExt(user.id).company,
            bio: remote.bio || getExt(user.id).bio,
            preferredPickup:
              remote.preferredPickup ||
              remote.preferred_pickup ||
              getExt(user.id).preferredPickup,
            preferredDropoff:
              remote.preferredDropoff ||
              remote.preferred_dropoff ||
              getExt(user.id).preferredDropoff,
            defaultPlan:
              remote.defaultPlan ||
              remote.default_plan ||
              getExt(user.id).defaultPlan,
            clientTier:
              remote.clientTier ||
              remote.client_tier ||
              getExt(user.id).clientTier,
            tags: remote.tags || getExt(user.id).tags,
          });
        }
      } catch (_) {
        /* ignore */
      }
      const LX = global.LivrExpress;
      if (LX?.listOrderRequestsAsync) {
        await LX.listOrderRequestsAsync({ userId: user.id });
      }
      if (LX?.listShipmentsByUserAsync) {
        await LX.listShipmentsByUserAsync(user.id);
      }
    }
    return buildAccountProfile(user);
  };

  /**
   * Mapping clients pour admin : filtre + tri
   */
  const listClientMap = (options = {}) => {
    const Auth = global.Auth;
    const LX = global.LivrExpress;
    if (!Auth) return [];

    // clients locaux
    let users = [];
    try {
      // listClients sync peut être vide en mode SB — on lit aussi storage users
      users = Auth.listClients?.() || [];
    } catch {
      users = [];
    }

    // Enrichir depuis commandes (clients qui ont commandé)
    if (LX) {
      const orders = LX.listOrderRequests();
      const byId = new Map(users.map((u) => [u.id, u]));
      orders.forEach((o) => {
        if (o.userId && !byId.has(o.userId)) {
          byId.set(o.userId, {
            id: o.userId,
            email: o.userEmail,
            name: o.userName || o.userEmail,
            phone: o.sender?.phone || "",
            address: o.sender?.address || "",
            role: "client",
            createdAt: o.createdAt,
          });
        }
      });
      users = [...byId.values()];
    }

    let list = users
      .filter((u) => u.role === "client" || !u.role)
      .map((u) => buildAccountProfile(u));

    const {
      q = "",
      city = "",
      tier = "",
      zone = "",
      sort = "recent",
      minOrders = 0,
    } = options;

    const query = String(q || "")
      .toLowerCase()
      .trim();
    if (query) {
      list = list.filter((p) => {
        const hay = [
          p.name,
          p.email,
          p.phone,
          p.address,
          p.company,
          p.neighborhood,
          p.city,
          ...(p.tags || []),
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(query);
      });
    }
    if (city) {
      list = list.filter(
        (p) =>
          String(p.city || "")
            .toLowerCase()
            .includes(String(city).toLowerCase())
      );
    }
    if (tier) {
      list = list.filter((p) => p.clientTier === tier);
    }
    if (zone) {
      list = list.filter(
        (p) =>
          (p.zones || []).some((z) =>
            z.toLowerCase().includes(String(zone).toLowerCase())
          ) ||
          String(p.neighborhood || "")
            .toLowerCase()
            .includes(String(zone).toLowerCase()) ||
          String(p.preferredPickup || "")
            .toLowerCase()
            .includes(String(zone).toLowerCase())
      );
    }
    if (minOrders > 0) {
      list = list.filter((p) => (p.stats?.totalOrders || 0) >= minOrders);
    }

    list.sort((a, b) => {
      if (sort === "name") {
        return String(a.name || "").localeCompare(String(b.name || ""), "fr");
      }
      if (sort === "orders") {
        return (b.stats?.totalOrders || 0) - (a.stats?.totalOrders || 0);
      }
      if (sort === "spent") {
        return (b.stats?.totalSpent || 0) - (a.stats?.totalSpent || 0);
      }
      if (sort === "tier") {
        const order = { vip: 0, business: 1, pro: 2, standard: 3 };
        return (order[a.clientTier] ?? 9) - (order[b.clientTier] ?? 9);
      }
      // recent
      const ta = new Date(a.stats?.lastOrderAt || a.createdAt || 0).getTime();
      const tb = new Date(b.stats?.lastOrderAt || b.createdAt || 0).getTime();
      return tb - ta;
    });

    return list;
  };

  const listClientMapAsync = async (options = {}) => {
    const Auth = global.Auth;
    if (Auth?.listClientsAsync) {
      await Auth.listClientsAsync();
    }
    const LX = global.LivrExpress;
    if (LX?.listOrderRequestsAsync) {
      await LX.listOrderRequestsAsync();
    }
    // Rebuild from remote clients if available
    if (Auth?.listClientsAsync) {
      const remote = await Auth.listClientsAsync();
      // seed local-looking users into map by building profiles
      return listClientMap(options).length
        ? listClientMap(options)
        : remote.map((u) => buildAccountProfile(u));
    }
    return listClientMap(options);
  };

  /** Préremplit le formulaire commande depuis le profil */
  const fillOrderFormFromProfile = (user, formRoot = document) => {
    if (!user) return;
    const profile = buildAccountProfile(user);
    const set = (id, val) => {
      const el = formRoot.getElementById
        ? formRoot.getElementById(id)
        : document.getElementById(id);
      if (el && val != null && val !== "") {
        // toujours préremplir les champs expéditeur depuis le profil
        if (
          id === "orderName" ||
          id === "orderPhone" ||
          id === "orderPickup" ||
          id === "orderPlan"
        ) {
          el.value = val;
        } else if (!el.value) {
          el.value = val;
        }
      }
    };
    set("orderName", profile.name);
    set("orderPhone", profile.phone);
    set(
      "orderPickup",
      profile.preferredPickup || profile.address || ""
    );
    set("orderPlan", profile.defaultPlan || "Express");
    // hint destinataire zone habituelle
    const drop = document.getElementById("orderDropoff");
    if (drop && !drop.value && profile.preferredDropoff) {
      drop.placeholder = profile.preferredDropoff;
    }
  };

  // —— Livreurs ——
  const listCouriers = (onlyActive = true) => {
    const map = readCouriers();
    let list = Object.values(map);
    if (onlyActive) list = list.filter((c) => c.active !== false);
    return list.sort(
      (a, b) => (b.rating || 0) - (a.rating || 0) || (b.deliveriesCount || 0) - (a.deliveriesCount || 0)
    );
  };

  const getCourier = (id) => {
    if (!id) return null;
    const map = readCouriers();
    if (map[id]) return map[id];
    // match by name fuzzy
    const found = Object.values(map).find(
      (c) =>
        c.id === id ||
        String(c.name).toLowerCase() === String(id).toLowerCase() ||
        String(c.name).toLowerCase().startsWith(String(id).toLowerCase().slice(0, 5))
    );
    return found || null;
  };

  const getCourierByName = (name) => {
    if (!name) return null;
    const n = String(name).toLowerCase();
    return (
      listCouriers(false).find(
        (c) =>
          c.name.toLowerCase() === n ||
          c.name.toLowerCase().includes(n) ||
          n.includes(c.name.toLowerCase().split(" ")[0])
      ) || null
    );
  };

  const saveCourier = (courier) => {
    const map = readCouriers();
    map[courier.id] = { ...map[courier.id], ...courier };
    writeCouriers(map);
    return map[courier.id];
  };

  /** Enrichit l’objet courier d’un shipment avec le profil complet */
  const enrichShipmentCourier = (shipment) => {
    if (!shipment) return null;
    let full = null;
    if (shipment.courierId) full = getCourier(shipment.courierId);
    if (!full && shipment.courier?.id) full = getCourier(shipment.courier.id);
    if (!full && shipment.courier?.name) full = getCourierByName(shipment.courier.name);
    if (!full && shipment.courier) {
      return {
        ...shipment.courier,
        profileUrl: null,
        verified: false,
        rating: null,
      };
    }
    if (!full) return null;
    return {
      ...full,
      meta: shipment.courier?.meta || full.zone,
      profileUrl: `livreur.html?id=${encodeURIComponent(full.id)}`,
    };
  };

  /** Assigne un livreur complet (rotation) */
  const assignCourier = () => {
    const list = listCouriers(true);
    if (!list.length) return null;
    const pick = list[Math.floor(Math.random() * list.length)];
    return {
      id: pick.id,
      name: pick.name,
      phone: pick.phone,
      avatar: pick.avatar || "🛵",
      photoUrl: pick.photoUrl || "",
      vehicle: pick.vehicle,
      plate: pick.plate,
      zone: pick.zone,
      rating: pick.rating,
      deliveriesCount: pick.deliveriesCount,
      verified: pick.verified,
      meta: pick.zone,
      profileUrl: `livreur.html?id=${encodeURIComponent(pick.id)}`,
    };
  };

  /** Compresse une image File en dataURL (max edge) */
  const fileToPhotoDataUrl = (file, maxEdge = 400) =>
    new Promise((resolve, reject) => {
      if (!file || !file.type.startsWith("image/")) {
        reject(new Error("Fichier image requis."));
        return;
      }
      if (file.size > 4 * 1024 * 1024) {
        reject(new Error("Image trop lourde (max 4 Mo)."));
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
          const w = Math.round(img.width * scale);
          const h = Math.round(img.height * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL("image/jpeg", 0.85));
        };
        img.onerror = () => reject(new Error("Image illisible."));
        img.src = reader.result;
      };
      reader.onerror = () => reject(new Error("Lecture impossible."));
      reader.readAsDataURL(file);
    });

  const tierMeta = (key) => TIERS[key] || TIERS.standard;

  const formatMoney = (n) =>
    `${Number(n || 0).toLocaleString("fr-FR")} FCFA`;

  // Init couriers
  readCouriers();

  global.LivrExpressProfile = {
    TIERS,
    tierMeta,
    formatMoney,
    getExt,
    setExt,
    buildAccountProfile,
    buildAccountProfileAsync,
    listClientMap,
    listClientMapAsync,
    fillOrderFormFromProfile,
    listCouriers,
    getCourier,
    getCourierByName,
    saveCourier,
    enrichShipmentCourier,
    assignCourier,
    fileToPhotoDataUrl,
  };
})(typeof window !== "undefined" ? window : globalThis);
