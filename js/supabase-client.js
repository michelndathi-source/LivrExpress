/**
 * LivrExpress — Client Supabase + couche données distante
 * Auth : email/password via Supabase Auth
 * Tables : profiles, order_requests, shipments, notifications
 */
(function (global) {
  const PROFILE_CACHE = "livrexpress_profile_cache_v1";
  let client = null;
  let readyPromise = null;

  const cfg = () => global.LIVREXPRESS_SUPABASE || {};

  const isEnabled = () =>
    Boolean(cfg().isConfigured && cfg().isConfigured() && global.supabase);

  const getClient = () => {
    if (!isEnabled()) return null;
    if (client) return client;
    client = global.supabase.createClient(cfg().url, cfg().anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
    return client;
  };

  const cacheProfile = (profile) => {
    try {
      if (profile) localStorage.setItem(PROFILE_CACHE, JSON.stringify(profile));
      else localStorage.removeItem(PROFILE_CACHE);
    } catch (_) {
      /* ignore */
    }
  };

  const readCachedProfile = () => {
    try {
      const raw = localStorage.getItem(PROFILE_CACHE);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  const mapProfile = (row) => {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name || "",
      phone: row.phone || "",
      address: row.address || "",
      role: row.role || "client",
      createdAt: row.created_at,
      createdBy: row.created_by || null,
      isSuperAdmin: row.role === "super_admin",
      isAdmin: row.role === "admin" || row.role === "super_admin",
      photoUrl: row.photo_url || row.photoUrl || "",
      city: row.city || "Dakar",
      neighborhood: row.neighborhood || "",
      company: row.company || "",
      bio: row.bio || "",
      preferredPickup: row.preferred_pickup || row.preferredPickup || "",
      preferredDropoff: row.preferred_dropoff || row.preferredDropoff || "",
      defaultPlan: row.default_plan || row.defaultPlan || "Express",
      clientTier: row.client_tier || row.clientTier || "standard",
      tags: row.tags || [],
    };
  };

  const fetchProfile = async (userId) => {
    const sb = getClient();
    if (!sb || !userId) return null;
    const { data, error } = await sb
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) {
      console.warn("LivrExpress profile:", error.message);
      return null;
    }
    const profile = mapProfile(data);
    if (profile) cacheProfile(profile);
    return profile;
  };

  /** Initialise session + cache profil */
  const bootstrap = async () => {
    if (!isEnabled()) return { ok: false, enabled: false };
    const sb = getClient();
    try {
      const { data, error } = await sb.auth.getSession();
      if (error) throw error;
      const session = data?.session;
      if (!session?.user) {
        cacheProfile(null);
        return { ok: true, enabled: true, user: null };
      }
      let profile = await fetchProfile(session.user.id);
      // Si le trigger n'a pas encore tourné
      if (!profile) {
        await new Promise((r) => setTimeout(r, 400));
        profile = await fetchProfile(session.user.id);
      }
      return { ok: true, enabled: true, user: profile, session };
    } catch (e) {
      console.warn("Supabase bootstrap:", e);
      return { ok: false, enabled: true, error: e.message || String(e) };
    }
  };

  if (!readyPromise) {
    readyPromise = Promise.resolve().then(() => bootstrap());
  }

  const signUp = async ({ name, email, phone, password, address, role }) => {
    const sb = getClient();
    if (!sb) return { ok: false, error: "Supabase non configuré." };
    const key = String(email || "")
      .trim()
      .toLowerCase();
    if (!key.includes("@")) return { ok: false, error: "Email invalide." };
    if (!password || password.length < 6) {
      return { ok: false, error: "Mot de passe : 6 caractères minimum." };
    }
    if (!name || String(name).trim().length < 2) {
      return { ok: false, error: "Indiquez votre nom complet." };
    }

    const { data, error } = await sb.auth.signUp({
      email: key,
      password,
      options: {
        data: {
          name: String(name).trim(),
          phone: String(phone || "").trim(),
          address: String(address || "").trim(),
          role: role || "client",
        },
      },
    });
    if (error) {
      return {
        ok: false,
        error: error.message || "Inscription impossible.",
      };
    }
    if (!data.user) {
      return {
        ok: false,
        error: "Vérifiez votre email pour activer le compte (si confirmation activée).",
      };
    }

    // Attendre le trigger profil
    let profile = null;
    for (let i = 0; i < 6; i++) {
      profile = await fetchProfile(data.user.id);
      if (profile) break;
      await new Promise((r) => setTimeout(r, 300));
    }
    if (!profile) {
      // fallback insert (si RLS permet — sinon trigger only)
      profile = {
        id: data.user.id,
        email: key,
        name: String(name).trim(),
        phone: String(phone || "").trim(),
        address: String(address || "").trim(),
        role: role || "client",
      };
      cacheProfile(profile);
    }
    return { ok: true, user: profile, session: data.session };
  };

  const signIn = async ({ email, password }) => {
    const sb = getClient();
    if (!sb) return { ok: false, error: "Supabase non configuré." };
    const key = String(email || "")
      .trim()
      .toLowerCase();
    const { data, error } = await sb.auth.signInWithPassword({
      email: key,
      password,
    });
    if (error) {
      return {
        ok: false,
        error:
          error.message === "Invalid login credentials"
            ? "Email ou mot de passe incorrect."
            : error.message || "Connexion impossible.",
      };
    }
    const profile = await fetchProfile(data.user.id);
    if (!profile) {
      return {
        ok: false,
        error: "Profil introuvable. Exécutez le script SQL de migration.",
      };
    }
    return { ok: true, user: profile, session: data.session };
  };

  const signOut = async () => {
    const sb = getClient();
    cacheProfile(null);
    if (sb) await sb.auth.signOut();
    return { ok: true };
  };

  const updateProfileRemote = async (userId, patch) => {
    const sb = getClient();
    if (!sb) return { ok: false, error: "Supabase non configuré." };
    const payload = { updated_at: new Date().toISOString() };
    if (patch.name != null) payload.name = String(patch.name).trim();
    if (patch.phone != null) payload.phone = String(patch.phone).trim();
    if (patch.address != null) payload.address = String(patch.address).trim();
    // rôle : super_admin uniquement via SQL / createAdmin
    if (patch.role && (await isStaffCaller())) {
      // admin peut fixer client | admin | courier (pas super_admin ici)
      if (["client", "admin", "courier"].includes(patch.role)) {
        payload.role = patch.role;
      }
    }
    const { data, error } = await sb
      .from("profiles")
      .update(payload)
      .eq("id", userId)
      .select("*")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    const profile = mapProfile(data);
    cacheProfile(profile);
    return { ok: true, user: profile };
  };

  const isStaffCaller = async () => {
    const p = readCachedProfile();
    return p && (p.role === "admin" || p.role === "super_admin");
  };

  const listProfiles = async (roleFilter) => {
    const sb = getClient();
    if (!sb) return [];
    let q = sb.from("profiles").select("*").order("created_at", { ascending: false });
    if (roleFilter === "client") q = q.eq("role", "client");
    if (roleFilter === "admin") q = q.in("role", ["admin", "super_admin"]);
    const { data, error } = await q;
    if (error) {
      console.warn(error);
      return [];
    }
    return (data || []).map(mapProfile);
  };

  /**
   * Crée un co-admin : signUp avec metadata role=admin
   * (nécessite souvent service role pour set role — ici metadata + trigger)
   */
  const createAdminRemote = async (actor, { name, email, phone, password }) => {
    if (!actor || actor.role !== "super_admin") {
      return {
        ok: false,
        error: "Seul le super-admin peut ajouter des co-administrateurs.",
      };
    }
    // Inscription via signUp (même client) — le nouvel utilisateur devient session active
    // On sauvegarde la session super-admin pour la restaurer
    const sb = getClient();
    const { data: cur } = await sb.auth.getSession();
    const adminSession = cur?.session;

    const result = await signUp({
      name,
      email,
      phone,
      password,
      address: "",
      role: "admin",
    });
    if (!result.ok) return result;

    // Forcer le rôle admin sur le profil
    await sb
      .from("profiles")
      .update({
        role: "admin",
        created_by: actor.email,
        name: String(name).trim(),
        phone: String(phone || "").trim(),
      })
      .eq("id", result.user.id);

    // Restaurer session super-admin
    if (adminSession?.refresh_token) {
      await sb.auth.setSession({
        access_token: adminSession.access_token,
        refresh_token: adminSession.refresh_token,
      });
      await fetchProfile(actor.id);
    } else {
      await signOut();
    }

    const profile = mapProfile({
      ...result.user,
      role: "admin",
      created_by: actor.email,
    });
    return { ok: true, user: profile, promoted: false };
  };

  const removeAdminRemote = async (actor, adminEmail) => {
    if (!actor || actor.role !== "super_admin") {
      return {
        ok: false,
        error: "Seul le super-admin peut retirer des co-administrateurs.",
      };
    }
    const sb = getClient();
    const key = String(adminEmail || "")
      .trim()
      .toLowerCase();
    if (key === (cfg().superAdminEmail || "").toLowerCase()) {
      return { ok: false, error: "Impossible de retirer le super-admin." };
    }
    const { data, error } = await sb
      .from("profiles")
      .update({ role: "client" })
      .eq("email", key)
      .eq("role", "admin")
      .select("*")
      .maybeSingle();
    if (error) return { ok: false, error: error.message };
    if (!data) return { ok: false, error: "Co-admin introuvable." };
    return { ok: true, user: mapProfile(data) };
  };

  // —— Mapping métier ——
  const orderToRow = (o) => {
    // GPS / modes embarqués dans sender & recipient (jsonb) — pas de colonnes dédiées
    const sender = { ...(o.sender || {}) };
    const recipient = { ...(o.recipient || {}) };
    if (o.locations?.pickup) {
      if (sender.lat == null && o.locations.pickup.lat != null) {
        sender.lat = o.locations.pickup.lat;
        sender.lng = o.locations.pickup.lng;
      }
      if (!sender.address && o.locations.pickup.label) {
        sender.address = o.locations.pickup.label;
      }
      sender.locationSource =
        sender.locationSource || o.locations.pickup.source || o.pickupMode;
    }
    if (o.locations?.delivery) {
      if (recipient.lat == null && o.locations.delivery.lat != null) {
        recipient.lat = o.locations.delivery.lat;
        recipient.lng = o.locations.delivery.lng;
      }
      if (!recipient.address && o.locations.delivery.label) {
        recipient.address = o.locations.delivery.label;
      }
      recipient.locationSource =
        recipient.locationSource ||
        o.locations.delivery.source ||
        o.deliveryMode;
    }
    // Métadonnées course dans package pour ne pas perdre locations
    const pkg = {
      ...(o.package || {}),
      _locations: o.locations || null,
      _pickupMode: o.pickupMode || null,
      _deliveryMode: o.deliveryMode || null,
    };
    return {
      id: o.id,
      user_id: o.userId,
      user_email: o.userEmail || "",
      user_name: o.userName || "",
      status: o.status,
      plan: o.plan,
      pricing: o.pricing || {},
      sender,
      recipient,
      package: pkg,
      notes: o.notes || "",
      tracking_id: o.trackingId || null,
      reject_reason: o.rejectReason || "",
      reviewed_at: o.reviewedAt || null,
      reviewed_by: o.reviewedBy || null,
      created_at: o.createdAt,
      updated_at: o.updatedAt || o.createdAt,
    };
  };

  const rowToOrder = (r) => {
    const sender = r.sender || {};
    const recipient = r.recipient || {};
    const pkg = r.package || {};
    const locations =
      pkg._locations ||
      ({
        pickup:
          sender.lat != null && sender.lng != null
            ? {
                lat: sender.lat,
                lng: sender.lng,
                label: sender.address || "",
                source: sender.locationSource || "gps",
              }
            : sender.address
              ? { label: sender.address, source: "address" }
              : null,
        delivery:
          recipient.lat != null && recipient.lng != null
            ? {
                lat: recipient.lat,
                lng: recipient.lng,
                label: recipient.address || "",
                source: recipient.locationSource || "gps",
              }
            : recipient.address
              ? { label: recipient.address, source: "address" }
              : null,
      });
    // Nettoie les meta internes du package exposé à l’UI
    const cleanPkg = { ...pkg };
    delete cleanPkg._locations;
    delete cleanPkg._pickupMode;
    delete cleanPkg._deliveryMode;
    return {
      id: r.id,
      userId: r.user_id,
      userEmail: r.user_email,
      userName: r.user_name,
      status: r.status,
      plan: r.plan,
      pricing: r.pricing || {},
      sender,
      recipient,
      package: cleanPkg,
      notes: r.notes || "",
      trackingId: r.tracking_id,
      rejectReason: r.reject_reason || "",
      reviewedAt: r.reviewed_at,
      reviewedBy: r.reviewed_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      locations,
      pickupMode: pkg._pickupMode || sender.locationSource || "address",
      deliveryMode: pkg._deliveryMode || recipient.locationSource || "address",
    };
  };

  const shipToRow = (s) => ({
    tracking_id: s.trackingId,
    order_request_id: s.orderRequestId || null,
    user_id: s.userId || null,
    user_email: s.userEmail || "",
    status_key: s.statusKey,
    plan: s.plan,
    pricing: s.pricing || {},
    sender: s.sender || {},
    recipient: s.recipient || {},
    package: s.package || {},
    courier: s.courier || null,
    courier_id: s.courierId || s.courier?.id || null,
    locations: s.locations || {},
    eta: s.eta || null,
    eta_label: s.etaLabel || "",
    events: s.events || [],
    step_times: s.stepTimes || {},
    notes: s.notes || "",
    source: s.source || "order",
    service_level: s.serviceLevel || s.plan || "Express",
    delivered_at: s.deliveredAt || null,
    created_at: s.createdAt,
    updated_at: s.updatedAt || s.createdAt,
  });

  const rowToShip = (r) => ({
    trackingId: r.tracking_id,
    orderRequestId: r.order_request_id,
    userId: r.user_id,
    userEmail: r.user_email,
    statusKey: r.status_key,
    plan: r.plan,
    pricing: r.pricing || {},
    sender: r.sender || {},
    recipient: r.recipient || {},
    package: r.package || {},
    courier: r.courier || null,
    courierId: r.courier_id || null,
    locations: r.locations || {},
    eta: r.eta,
    etaLabel: r.eta_label || "",
    events: r.events || [],
    stepTimes: r.step_times || {},
    notes: r.notes || "",
    source: r.source || "order",
    serviceLevel: r.service_level || r.plan,
    deliveredAt: r.delivered_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  const notifToRow = (n) => ({
    id: n.id,
    user_id: n.userId,
    type: n.type || "info",
    title: n.title || "LivrExpress",
    message: n.message || "",
    tracking_id: n.trackingId || null,
    order_id: n.orderId || null,
    status_key: n.statusKey || null,
    icon: n.icon || "📦",
    read: Boolean(n.read),
    created_at: n.createdAt || new Date().toISOString(),
  });

  const rowToNotif = (r) => ({
    id: r.id,
    userId: r.user_id,
    type: r.type,
    title: r.title,
    message: r.message,
    trackingId: r.tracking_id,
    orderId: r.order_id,
    statusKey: r.status_key,
    icon: r.icon,
    read: r.read,
    createdAt: r.created_at,
  });

  // —— CRUD distant ——
  const upsertOrder = async (order) => {
    const sb = getClient();
    if (!sb) return { ok: false };
    const { error } = await sb
      .from("order_requests")
      .upsert(orderToRow(order), { onConflict: "id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const listOrdersRemote = async (filter = {}) => {
    const sb = getClient();
    if (!sb) return [];
    let q = sb.from("order_requests").select("*").order("created_at", {
      ascending: false,
    });
    if (filter.userId) q = q.eq("user_id", filter.userId);
    if (filter.status) q = q.eq("status", filter.status);
    const { data, error } = await q;
    if (error) {
      console.warn(error);
      return [];
    }
    return (data || []).map(rowToOrder);
  };

  const getOrderRemote = async (id) => {
    const sb = getClient();
    if (!sb || !id) return null;
    const { data, error } = await sb
      .from("order_requests")
      .select("*")
      .eq("id", id)
      .maybeSingle();
    if (error || !data) return null;
    return rowToOrder(data);
  };

  const upsertShipment = async (ship) => {
    const sb = getClient();
    if (!sb) return { ok: false };
    const { error } = await sb
      .from("shipments")
      .upsert(shipToRow(ship), { onConflict: "tracking_id" });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const getShipmentRemote = async (trackingId) => {
    const sb = getClient();
    if (!sb || !trackingId) return null;
    const { data, error } = await sb
      .from("shipments")
      .select("*")
      .eq("tracking_id", trackingId)
      .maybeSingle();
    if (error || !data) return null;
    return rowToShip(data);
  };

  const listShipmentsRemote = async (filter = {}) => {
    const sb = getClient();
    if (!sb) return [];
    let q = sb.from("shipments").select("*").order("created_at", {
      ascending: false,
    });
    if (filter.userId) q = q.eq("user_id", filter.userId);
    const { data, error } = await q;
    if (error) {
      console.warn(error);
      return [];
    }
    return (data || []).map(rowToShip);
  };

  const insertNotification = async (n) => {
    const sb = getClient();
    if (!sb) return { ok: false };
    const { error } = await sb.from("notifications").insert(notifToRow(n));
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  };

  const listNotificationsRemote = async (userId) => {
    const sb = getClient();
    if (!sb || !userId) return [];
    const { data, error } = await sb
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(80);
    if (error) {
      console.warn(error);
      return [];
    }
    return (data || []).map(rowToNotif);
  };

  const markNotifReadRemote = async (userId, id) => {
    const sb = getClient();
    if (!sb) return { ok: false };
    const { error } = await sb
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
      .eq("user_id", userId);
    return { ok: !error, error: error?.message };
  };

  const markAllNotifReadRemote = async (userId) => {
    const sb = getClient();
    if (!sb) return { ok: false };
    const { error } = await sb
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    return { ok: !error, error: error?.message };
  };

  global.LivrExpressSB = {
    isEnabled,
    getClient,
    bootstrap,
    ready: () => readyPromise || bootstrap(),
    signUp,
    signIn,
    signOut,
    fetchProfile,
    readCachedProfile,
    cacheProfile,
    updateProfileRemote,
    listProfiles,
    createAdminRemote,
    removeAdminRemote,
    upsertOrder,
    listOrdersRemote,
    getOrderRemote,
    upsertShipment,
    getShipmentRemote,
    listShipmentsRemote,
    insertNotification,
    listNotificationsRemote,
    markNotifReadRemote,
    markAllNotifReadRemote,
    mapProfile,
  };
})(typeof window !== "undefined" ? window : globalThis);
