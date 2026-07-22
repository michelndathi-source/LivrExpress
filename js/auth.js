/**
 * LivrExpress — Authentification & sessions (client / admin)
 * Mode Supabase (Auth + profiles) si configuré, sinon localStorage.
 */
(function (global) {
  const USERS_KEY = "livrexpress_users_v1";
  const SESSION_KEY = "livrexpress_session_v1";

  const useSupabase = () =>
    Boolean(global.LivrExpressSB && global.LivrExpressSB.isEnabled());

  /**
   * Super-admin unique propriétaire du site.
   * Seul compte autorisé à ajouter / retirer des co-admins.
   * (Modifiez SUPER_ADMIN_EMAIL ici si besoin.)
   */
  const SUPER_ADMIN_EMAIL = "michelndathi@gmail.com";
  const SUPER_ADMIN_PASSWORD = "admin123";

  const DEFAULT_SUPER_ADMIN = {
    id: "super_admin_owner",
    email: SUPER_ADMIN_EMAIL,
    password: SUPER_ADMIN_PASSWORD,
    name: "Michel Ndathi",
    phone: "770000000",
    role: "super_admin",
    createdAt: new Date().toISOString(),
  };

  const isAdminRole = (role) => role === "admin" || role === "super_admin";
  const isCourierRole = (role) => role === "courier";
  const homeForRole = (role) => {
    if (isAdminRole(role)) return "admin.html";
    if (isCourierRole(role)) return "espace-livreur.html";
    return "espace-client.html";
  };

  const hashPassword = (password) => {
    // Hash simple pour démo (ne pas utiliser en production)
    try {
      return btoa(unescape(encodeURIComponent(`lx:${password}:sn`)));
    } catch {
      return `lx_${password}`;
    }
  };

  const readUsers = () => {
    try {
      const raw = localStorage.getItem(USERS_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  };

  const writeUsers = (map) => {
    localStorage.setItem(USERS_KEY, JSON.stringify(map));
  };

  const seedAdmin = () => {
    const users = readUsers();
    const key = SUPER_ADMIN_EMAIL.toLowerCase();
    const legacyKey = "admin@livrexpress.sn";
    let changed = false;

    // Garantir un unique super-admin propriétaire
    if (!users[key]) {
      users[key] = {
        id: DEFAULT_SUPER_ADMIN.id,
        email: key,
        passwordHash: hashPassword(SUPER_ADMIN_PASSWORD),
        name: DEFAULT_SUPER_ADMIN.name,
        phone: DEFAULT_SUPER_ADMIN.phone,
        role: "super_admin",
        createdAt: DEFAULT_SUPER_ADMIN.createdAt,
        address: "",
      };
      changed = true;
    } else {
      // Migration : forcer le rôle super_admin pour le propriétaire
      if (users[key].role !== "super_admin") {
        users[key].role = "super_admin";
        changed = true;
      }
      if (!users[key].name || users[key].name === "Super Admin" || users[key].name === "Administrateur") {
        users[key].name = DEFAULT_SUPER_ADMIN.name;
        changed = true;
      }
    }

    // Ancien compte démo admin@livrexpress.sn → co-admin (plus super-admin)
    if (users[legacyKey] && legacyKey !== key) {
      if (users[legacyKey].role === "super_admin") {
        users[legacyKey].role = "admin";
        changed = true;
      }
    }

    // Un seul super_admin : rétrograder les autres
    Object.keys(users).forEach((email) => {
      if (email !== key && users[email].role === "super_admin") {
        users[email].role = "admin";
        changed = true;
      }
    });

    if (changed) writeUsers(users);
    return users;
  };

  const uid = (prefix = "u") =>
    `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

  const getSession = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (!session || !session.userId || !session.email) return null;
      if (session.expiresAt && new Date(session.expiresAt) < new Date()) {
        clearSession();
        return null;
      }
      return session;
    } catch {
      return null;
    }
  };

  const setSession = (user) => {
    const session = {
      userId: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  };

  const clearSession = () => {
    localStorage.removeItem(SESSION_KEY);
  };

  const publicUser = (user) => {
    if (!user) return null;
    const ext = global.LivrExpressProfile?.getExt?.(user.id) || {};
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      phone: user.phone || "",
      role: user.role,
      isSuperAdmin: user.role === "super_admin",
      isAdmin: isAdminRole(user.role),
      isCourier: isCourierRole(user.role),
      courierId: user.courierId || null,
      createdAt: user.createdAt || user.created_at,
      address: user.address || "",
      createdBy: user.createdBy || user.created_by || null,
      photoUrl: user.photoUrl || ext.photoUrl || "",
      city: user.city || ext.city || "Dakar",
      neighborhood: user.neighborhood || ext.neighborhood || "",
      company: user.company || ext.company || "",
      bio: user.bio || ext.bio || "",
      preferredPickup: user.preferredPickup || ext.preferredPickup || "",
      preferredDropoff: user.preferredDropoff || ext.preferredDropoff || "",
      defaultPlan: user.defaultPlan || ext.defaultPlan || "Express",
      clientTier: user.clientTier || ext.clientTier || "standard",
    };
  };

  const getUserByEmail = (email) => {
    const users = seedAdmin();
    const key = String(email || "")
      .trim()
      .toLowerCase();
    return users[key] || null;
  };

  const getUserById = (id) => {
    const users = seedAdmin();
    return Object.values(users).find((u) => u.id === id) || null;
  };

  const getCurrentUser = () => {
    if (useSupabase()) {
      const cached = global.LivrExpressSB.readCachedProfile();
      return cached ? publicUser(cached) : null;
    }
    const session = getSession();
    if (!session) return null;
    const user = getUserById(session.userId) || getUserByEmail(session.email);
    if (!user) {
      clearSession();
      return null;
    }
    // Resync session si le rôle a changé (ex. migration super_admin)
    if (session.role !== user.role) {
      setSession(user);
    }
    return publicUser(user);
  };

  /** Charge la session Supabase (à appeler au démarrage de chaque page) */
  const bootstrap = async () => {
    if (!useSupabase()) {
      seedAdmin();
      return { ok: true, mode: "local", user: getCurrentUser() };
    }
    const res = await global.LivrExpressSB.bootstrap();
    return {
      ok: res.ok,
      mode: "supabase",
      user: res.user ? publicUser(res.user) : null,
      error: res.error,
    };
  };

  const register = async ({ name, email, phone, password, address }) => {
    if (useSupabase()) {
      const key = String(email || "")
        .trim()
        .toLowerCase();
      if (key === SUPER_ADMIN_EMAIL.toLowerCase()) {
        return { ok: false, error: "Cet email est réservé à l’administration." };
      }
      const res = await global.LivrExpressSB.signUp({
        name,
        email,
        phone,
        password,
        address,
        role: "client",
      });
      if (!res.ok) return res;
      if (!res.session) {
        return {
          ok: false,
          error:
            "Compte créé. Confirmez votre email (Supabase Auth) puis connectez-vous.",
        };
      }
      return { ok: true, user: publicUser(res.user) };
    }

    const users = seedAdmin();
    const key = String(email || "")
      .trim()
      .toLowerCase();
    if (!key || !key.includes("@")) {
      return { ok: false, error: "Email invalide." };
    }
    if (!name || String(name).trim().length < 2) {
      return { ok: false, error: "Indiquez votre nom complet." };
    }
    if (!password || String(password).length < 6) {
      return { ok: false, error: "Mot de passe : 6 caractères minimum." };
    }
    if (users[key]) {
      return { ok: false, error: "Un compte existe déjà avec cet email." };
    }
    if (key === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return { ok: false, error: "Cet email est réservé à l’administration." };
    }

    const user = {
      id: uid("cli"),
      email: key,
      passwordHash: hashPassword(password),
      name: String(name).trim(),
      phone: String(phone || "").trim(),
      address: String(address || "").trim(),
      role: "client",
      createdAt: new Date().toISOString(),
    };
    users[key] = user;
    writeUsers(users);
    setSession(user);
    return { ok: true, user: publicUser(user) };
  };

  const login = async ({ email, password }) => {
    if (useSupabase()) {
      const res = await global.LivrExpressSB.signIn({ email, password });
      if (!res.ok) return res;
      return { ok: true, user: publicUser(res.user) };
    }

    const users = seedAdmin();
    const key = String(email || "")
      .trim()
      .toLowerCase();
    const user = users[key];
    if (!user) {
      return { ok: false, error: "Email ou mot de passe incorrect." };
    }
    if (user.passwordHash !== hashPassword(password)) {
      return { ok: false, error: "Email ou mot de passe incorrect." };
    }
    setSession(user);
    return { ok: true, user: publicUser(user) };
  };

  const logout = async () => {
    if (useSupabase()) {
      await global.LivrExpressSB.signOut();
    }
    clearSession();
  };

  const updateProfile = async (userId, patch) => {
    const actor = getCurrentUser();
    const target =
      (useSupabase()
        ? null
        : Object.values(seedAdmin()).find((u) => u.id === userId)) || null;

    // Sécurité : un livreur ne peut pas modifier ses infos personnelles
    if (actor && actor.role === "courier" && actor.id === userId) {
      return {
        ok: false,
        error:
          "Pour la sécurité, les livreurs ne peuvent pas modifier leurs informations. Contactez l’administration LivrExpress.",
      };
    }
    // Seul le staff peut modifier un compte livreur
    if (
      (target?.role === "courier" || patch.role === "courier") &&
      actor &&
      !isAdminRole(actor.role)
    ) {
      return {
        ok: false,
        error: "Seul un administrateur peut créer ou modifier un compte livreur.",
      };
    }

    // Champs étendus (photo, quartier, etc.) → module profil (clients)
    const extKeys = [
      "photoUrl",
      "city",
      "neighborhood",
      "company",
      "bio",
      "preferredPickup",
      "preferredDropoff",
      "defaultPlan",
      "clientTier",
      "tags",
    ];
    const extPatch = {};
    extKeys.forEach((k) => {
      if (patch[k] != null) extPatch[k] = patch[k];
    });
    if (
      Object.keys(extPatch).length &&
      global.LivrExpressProfile?.setExt &&
      !(actor?.role === "courier")
    ) {
      global.LivrExpressProfile.setExt(userId, extPatch);
    }

    if (useSupabase()) {
      const res = await global.LivrExpressSB.updateProfileRemote(userId, {
        name: patch.name,
        phone: patch.phone,
        address: patch.address,
        role: isAdminRole(actor?.role) ? patch.role : undefined,
      });
      if (!res.ok) return res;
      if (Object.keys(extPatch).length && actor?.role !== "courier") {
        global.LivrExpressProfile?.setExt?.(userId, extPatch);
      }
      const merged = {
        ...res.user,
        ...global.LivrExpressProfile?.getExt?.(userId),
      };
      global.LivrExpressSB.cacheProfile?.(merged);
      return { ok: true, user: publicUser(merged) };
    }
    const users = seedAdmin();
    const user = Object.values(users).find((u) => u.id === userId);
    if (!user) return { ok: false, error: "Utilisateur introuvable." };
    if (user.role === "courier" && actor && !isAdminRole(actor.role)) {
      return {
        ok: false,
        error: "Seul un administrateur peut modifier un compte livreur.",
      };
    }
    if (patch.name) user.name = String(patch.name).trim();
    if (patch.phone != null) user.phone = String(patch.phone).trim();
    if (patch.address != null) user.address = String(patch.address).trim();
    if (patch.courierId != null) user.courierId = patch.courierId;
    if (patch.role && isAdminRole(actor?.role)) user.role = patch.role;
    users[user.email] = user;
    writeUsers(users);
    if (getSession()?.userId === userId) setSession(user);
    return {
      ok: true,
      user: publicUser({
        ...user,
        ...global.LivrExpressProfile?.getExt?.(userId),
      }),
    };
  };

  /**
   * Admin uniquement : crée un compte Auth livreur + fiche courier.
   * Le livreur ne pourra jamais modifier ses infos perso.
   */
  const createCourierAccount = async (
    actor,
    { name, email, phone, password, vehicle, plate, zone, bio, avatar }
  ) => {
    if (!actor || !isAdminRole(actor.role)) {
      return {
        ok: false,
        error: "Seul un administrateur peut créer un compte livreur.",
      };
    }
    const key = String(email || "")
      .trim()
      .toLowerCase();
    if (!key.includes("@")) return { ok: false, error: "Email invalide." };
    if (!name || String(name).trim().length < 2) {
      return { ok: false, error: "Nom du livreur requis." };
    }
    if (!password || String(password).length < 6) {
      return { ok: false, error: "Mot de passe : 6 caractères minimum." };
    }

    const courierId =
      "cr_" +
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 6);

    let userId = null;
    let userEmail = key;

    if (useSupabase()) {
      const sb = global.LivrExpressSB.getClient();
      const { data: cur } = await sb.auth.getSession();
      const adminSession = cur?.session;

      const { data, error } = await sb.auth.signUp({
        email: key,
        password,
        options: {
          data: { name: String(name).trim(), phone: String(phone || "").trim() },
        },
      });
      if (error) return { ok: false, error: error.message };
      if (!data.user) {
        return {
          ok: false,
          error: "Compte non créé (confirmation email ?). Désactivez Confirm email pour les tests.",
        };
      }
      userId = data.user.id;
      await sb
        .from("profiles")
        .update({
          role: "courier",
          name: String(name).trim(),
          phone: String(phone || "").trim(),
        })
        .eq("id", userId);

      // Restaurer session admin
      if (adminSession?.refresh_token) {
        await sb.auth.setSession({
          access_token: adminSession.access_token,
          refresh_token: adminSession.refresh_token,
        });
        await global.LivrExpressSB.fetchProfile(actor.id);
      }
    } else {
      const users = seedAdmin();
      if (users[key]) {
        return { ok: false, error: "Un compte existe déjà avec cet email." };
      }
      userId = uid("cr");
      users[key] = {
        id: userId,
        email: key,
        passwordHash: hashPassword(password),
        name: String(name).trim(),
        phone: String(phone || "").trim(),
        address: "",
        role: "courier",
        courierId,
        createdAt: new Date().toISOString(),
        createdBy: actor.email,
      };
      writeUsers(users);
    }

    const courier = {
      id: courierId,
      userId,
      email: userEmail,
      name: String(name).trim(),
      phone: String(phone || "").trim(),
      photoUrl: "",
      avatar: avatar || "🛵",
      vehicle: vehicle || "Moto",
      plate: plate || "",
      zone: zone || "Dakar",
      rating: 5.0,
      deliveriesCount: 0,
      bio: bio || "",
      languages: ["Français", "Wolof"],
      verified: true,
      active: true,
      joinedAt: new Date().toISOString(),
      createdBy: actor.email,
    };

    global.LivrExpressProfile?.saveCourier?.(courier);

    // Sync Supabase couriers table
    if (useSupabase()) {
      const sb = global.LivrExpressSB.getClient();
      await sb.from("couriers").upsert({
        id: courier.id,
        user_id: userId,
        email: userEmail,
        name: courier.name,
        phone: courier.phone,
        photo_url: "",
        avatar: courier.avatar,
        vehicle: courier.vehicle,
        plate: courier.plate,
        zone: courier.zone,
        rating: courier.rating,
        deliveries_count: 0,
        bio: courier.bio,
        languages: courier.languages,
        verified: true,
        active: true,
        joined_at: courier.joinedAt,
        created_by: actor.email,
      });
    }

    return {
      ok: true,
      user: publicUser({
        id: userId,
        email: userEmail,
        name: courier.name,
        phone: courier.phone,
        role: "courier",
        courierId,
      }),
      courier,
    };
  };

  /** Admin : met à jour la fiche livreur (infos perso verrouillées pour le livreur) */
  const updateCourierAccount = async (actor, courierId, patch) => {
    if (!actor || !isAdminRole(actor.role)) {
      return {
        ok: false,
        error: "Seul un administrateur peut modifier un livreur.",
      };
    }
    const Prof = global.LivrExpressProfile;
    const prev = Prof?.getCourier?.(courierId);
    if (!prev) return { ok: false, error: "Livreur introuvable." };

    const next = Prof.saveCourier({
      ...prev,
      name: patch.name != null ? String(patch.name).trim() : prev.name,
      phone: patch.phone != null ? String(patch.phone).trim() : prev.phone,
      vehicle: patch.vehicle != null ? patch.vehicle : prev.vehicle,
      plate: patch.plate != null ? patch.plate : prev.plate,
      zone: patch.zone != null ? patch.zone : prev.zone,
      bio: patch.bio != null ? patch.bio : prev.bio,
      avatar: patch.avatar != null ? patch.avatar : prev.avatar,
      active: patch.active != null ? Boolean(patch.active) : prev.active,
      photoUrl: patch.photoUrl != null ? patch.photoUrl : prev.photoUrl,
      verified: true,
    });

    // Sync user auth name/phone
    if (prev.userId) {
      await updateProfile(prev.userId, {
        name: next.name,
        phone: next.phone,
      });
    }

    if (useSupabase()) {
      const sb = global.LivrExpressSB.getClient();
      await sb
        .from("couriers")
        .update({
          name: next.name,
          phone: next.phone,
          vehicle: next.vehicle,
          plate: next.plate,
          zone: next.zone,
          bio: next.bio,
          avatar: next.avatar,
          active: next.active,
          photo_url: next.photoUrl || "",
        })
        .eq("id", courierId);
    }

    return { ok: true, courier: next };
  };

  /** Récupère un utilisateur par id (local ou cache) */
  const findUserById = (id) => {
    if (!id) return null;
    if (useSupabase()) {
      const cached = global.LivrExpressSB.readCachedProfile?.();
      if (cached && cached.id === id) return publicUser(cached);
    }
    const user = getUserById(id);
    return user ? publicUser(user) : null;
  };

  const listClients = () => {
    // Sync : cache local ; async version listClientsAsync pour Supabase
    if (useSupabase()) {
      // Retourne [] si pas encore chargé — prefer listClientsAsync
      return [];
    }
    const users = seedAdmin();
    return Object.values(users)
      .filter((u) => u.role === "client")
      .map(publicUser)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  };

  const listClientsAsync = async () => {
    if (useSupabase()) {
      const list = await global.LivrExpressSB.listProfiles("client");
      return list.map(publicUser);
    }
    return listClients();
  };

  const listAdmins = () => {
    if (useSupabase()) return [];
    const users = seedAdmin();
    return Object.values(users)
      .filter((u) => isAdminRole(u.role))
      .map(publicUser)
      .sort((a, b) => {
        if (a.role === "super_admin") return -1;
        if (b.role === "super_admin") return 1;
        return new Date(b.createdAt) - new Date(a.createdAt);
      });
  };

  const listAdminsAsync = async () => {
    if (useSupabase()) {
      const list = await global.LivrExpressSB.listProfiles("admin");
      return list.map(publicUser);
    }
    return listAdmins();
  };

  /**
   * Super-admin uniquement : crée un co-admin pour co-gérer le site.
   */
  const createAdmin = async (actor, { name, email, phone, password }) => {
    if (!actor || actor.role !== "super_admin") {
      return {
        ok: false,
        error: "Seul le super-admin peut ajouter des co-administrateurs.",
      };
    }
    if (useSupabase()) {
      const res = await global.LivrExpressSB.createAdminRemote(actor, {
        name,
        email,
        phone,
        password,
      });
      if (!res.ok) return res;
      return { ok: true, user: publicUser(res.user), promoted: res.promoted };
    }
    const users = seedAdmin();
    const key = String(email || "")
      .trim()
      .toLowerCase();
    if (!key || !key.includes("@")) {
      return { ok: false, error: "Email invalide." };
    }
    if (key === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return { ok: false, error: "Cet email est déjà le super-admin." };
    }
    if (!name || String(name).trim().length < 2) {
      return { ok: false, error: "Nom requis." };
    }
    if (!password || String(password).length < 6) {
      return { ok: false, error: "Mot de passe : 6 caractères minimum." };
    }
    if (users[key]) {
      if (isAdminRole(users[key].role)) {
        return { ok: false, error: "Cet email est déjà administrateur." };
      }
      // Promouvoir un client existant en co-admin
      users[key].role = "admin";
      users[key].passwordHash = hashPassword(password);
      users[key].name = String(name).trim();
      if (phone) users[key].phone = String(phone).trim();
      users[key].createdBy = actor.email;
      users[key].promotedAt = new Date().toISOString();
      writeUsers(users);
      return { ok: true, user: publicUser(users[key]), promoted: true };
    }

    const user = {
      id: uid("adm"),
      email: key,
      passwordHash: hashPassword(password),
      name: String(name).trim(),
      phone: String(phone || "").trim(),
      address: "",
      role: "admin",
      createdAt: new Date().toISOString(),
      createdBy: actor.email,
    };
    users[key] = user;
    writeUsers(users);
    return { ok: true, user: publicUser(user), promoted: false };
  };

  /**
   * Super-admin uniquement : retire un co-admin (jamais le super-admin).
   */
  const removeAdmin = async (actor, adminEmail) => {
    if (!actor || actor.role !== "super_admin") {
      return {
        ok: false,
        error: "Seul le super-admin peut retirer des co-administrateurs.",
      };
    }
    if (useSupabase()) {
      const res = await global.LivrExpressSB.removeAdminRemote(actor, adminEmail);
      if (!res.ok) return res;
      return { ok: true, user: publicUser(res.user) };
    }
    const users = seedAdmin();
    const key = String(adminEmail || "")
      .trim()
      .toLowerCase();
    if (key === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return { ok: false, error: "Impossible de retirer le super-admin." };
    }
    const target = users[key];
    if (!target || target.role !== "admin") {
      return { ok: false, error: "Co-admin introuvable." };
    }
    // Rétrograder en client (conserve l’historique du compte)
    target.role = "client";
    target.demotedAt = new Date().toISOString();
    target.demotedBy = actor.email;
    users[key] = target;
    writeUsers(users);
    return { ok: true, user: publicUser(target) };
  };

  const requireAuth = (options = {}) => {
    const { role = null, redirect = "login.html" } = options;
    const user = getCurrentUser();
    if (!user) {
      const next = encodeURIComponent(
        window.location.pathname.split("/").pop() + window.location.search
      );
      window.location.href = `${redirect}?next=${next}`;
      return null;
    }
    if (role) {
      const ok =
        role === "admin"
          ? isAdminRole(user.role)
          : role === "super_admin"
            ? user.role === "super_admin"
            : role === "courier"
              ? isCourierRole(user.role)
              : user.role === role;
      if (!ok) {
        window.location.href = homeForRole(user.role);
        return null;
      }
    }
    return user;
  };

  /** Pages accessibles sans connexion */
  const PUBLIC_PAGES = ["splash.html", "login.html", "register.html"];

  /**
   * Protège tout le site : sans session → login.
   * splash / login / register restent publics.
   * (Le splash d’animation est géré à chaque chargement de page dans main.js)
   */
  const guardSite = () => {
    const page =
      (window.location.pathname.split("/").pop() || "index.html").toLowerCase() ||
      "index.html";
    const file = page === "" || page === "/" ? "index.html" : page;

    const isPublicAuthPage = PUBLIC_PAGES.includes(file);

    if (file === "splash.html") {
      return { allowed: true, user: getCurrentUser() };
    }

    const user = getCurrentUser();

    if (!user) {
      if (isPublicAuthPage) return { allowed: true, user: null };
      const next = encodeURIComponent(file + (window.location.search || ""));
      window.location.replace(`login.html?next=${next}`);
      return { allowed: false, user: null };
    }

    if (file === "login.html" || file === "register.html") {
      window.location.replace(homeForRole(user.role));
      return { allowed: false, user };
    }

    // admin.html réservé aux admins
    if (file === "admin.html" && !isAdminRole(user.role)) {
      window.location.replace(homeForRole(user.role));
      return { allowed: false, user };
    }

    // Espace livreur réservé aux livreurs
    if (file === "espace-livreur.html" && !isCourierRole(user.role)) {
      window.location.replace(homeForRole(user.role));
      return { allowed: false, user };
    }

    // Livreurs : pages autorisées uniquement
    if (isCourierRole(user.role)) {
      const courierAllowed = [
        "espace-livreur.html",
        "livreur.html",
        "suivi.html",
        "fiche.html",
        "index.html",
        "splash.html",
      ];
      if (!courierAllowed.includes(file)) {
        window.location.replace("espace-livreur.html");
        return { allowed: false, user };
      }
      // espace-client / profil client interdits
      if (file === "espace-client.html" || file === "profil.html") {
        window.location.replace("espace-livreur.html");
        return { allowed: false, user };
      }
    }

    // Clients / staff ne passent pas par l'espace livreur
    if (file === "espace-client.html" && isCourierRole(user.role)) {
      window.location.replace("espace-livreur.html");
      return { allowed: false, user };
    }

    return { allowed: true, user };
  };

  /** Animation splash 0→100 % en 3s — se relance à chaque chargement / refresh */
  const runSplash = (options = {}) => {
    const duration = options.duration || 3000;
    const fullPage = Boolean(options.fullPage);

    return new Promise((resolve) => {
      // Page splash.html dédiée : utilise les éléments déjà présents
      if (fullPage || document.body.classList.contains("splash-body")) {
        const bar = document.getElementById("splashBar");
        const percentEl = document.getElementById("splashPercent");
        const start = performance.now();
        const tick = (now) => {
          const t = Math.min(1, (now - start) / duration);
          const pct = Math.round(t * 100);
          if (bar) bar.style.width = pct + "%";
          if (percentEl) percentEl.textContent = pct + "%";
          if (t < 1) requestAnimationFrame(tick);
          else resolve();
        };
        requestAnimationFrame(tick);
        return;
      }

      // Overlay injecté sur la page courante (chaque refresh)
      let root = document.getElementById("splashOverlay");
      if (!root) {
        root = document.createElement("div");
        root.id = "splashOverlay";
        root.className = "splash splash--overlay";
        root.setAttribute("role", "status");
        root.setAttribute("aria-live", "polite");
        root.setAttribute("aria-label", "Chargement LivrExpress");
        root.innerHTML = `
          <div class="splash__glow" aria-hidden="true"></div>
          <div class="splash__center">
            <div class="splash__icon-wrap" aria-hidden="true">
              <svg class="splash__icon" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="8" y="42" width="58" height="40" rx="6" fill="white" fill-opacity="0.95"/>
                <path d="M66 52h22l14 16v14H66V52z" fill="white" fill-opacity="0.95"/>
                <path d="M66 52v16h36" stroke="#1d4ed8" stroke-width="3" stroke-linejoin="round"/>
                <circle cx="30" cy="88" r="10" fill="#dbeafe" stroke="white" stroke-width="4"/>
                <circle cx="88" cy="88" r="10" fill="#dbeafe" stroke="white" stroke-width="4"/>
                <circle cx="30" cy="88" r="3.5" fill="#1e40af"/>
                <circle cx="88" cy="88" r="3.5" fill="#1e40af"/>
                <path d="M18 42V34a6 6 0 016-6h28a6 6 0 016 6v8" stroke="white" stroke-width="4" stroke-linecap="round"/>
                <path d="M22 58h30" stroke="#3b82f6" stroke-width="3" stroke-linecap="round" stroke-opacity="0.5"/>
              </svg>
            </div>
            <p class="splash__brand">Livr<span>Express</span></p>
            <p class="splash__tagline">Livraison rapide à Dakar</p>
            <div class="splash__progress" aria-hidden="true">
              <div class="splash__progress-track">
                <div class="splash__progress-bar" id="splashBar"></div>
              </div>
              <p class="splash__percent" id="splashPercent">0%</p>
            </div>
          </div>`;
        document.body.appendChild(root);
      }

      document.documentElement.classList.add("splash-active");
      root.hidden = false;
      root.classList.remove("is-done");

      const bar = root.querySelector("#splashBar") || root.querySelector(".splash__progress-bar");
      const percentEl =
        root.querySelector("#splashPercent") || root.querySelector(".splash__percent");
      if (bar) bar.style.width = "0%";
      if (percentEl) percentEl.textContent = "0%";

      // Relancer les animations CSS de l’icône à chaque refresh
      const iconWrap = root.querySelector(".splash__icon-wrap");
      if (iconWrap) {
        iconWrap.style.animation = "none";
        // force reflow
        void iconWrap.offsetWidth;
        iconWrap.style.animation = "";
      }

      const start = performance.now();
      const tick = (now) => {
        const t = Math.min(1, (now - start) / duration);
        const pct = Math.round(t * 100);
        if (bar) bar.style.width = pct + "%";
        if (percentEl) percentEl.textContent = pct + "%";
        if (t < 1) {
          requestAnimationFrame(tick);
        } else {
          root.classList.add("is-done");
          document.documentElement.classList.remove("splash-active");
          setTimeout(() => {
            root.hidden = true;
            resolve();
          }, 280);
        }
      };
      requestAnimationFrame(tick);
    });
  };

  const isLoggedIn = () => Boolean(getCurrentUser());
  const isAdmin = () => isAdminRole(getCurrentUser()?.role);
  const isSuperAdmin = () => getCurrentUser()?.role === "super_admin";
  const isClient = () => getCurrentUser()?.role === "client";
  const isCourier = () => isCourierRole(getCurrentUser()?.role);

  // Init seed
  seedAdmin();

  global.Auth = {
    register,
    login,
    logout,
    bootstrap,
    getCurrentUser,
    getSession,
    getUserById,
    getUserByEmail,
    findUserById,
    updateProfile,
    listClients,
    listClientsAsync,
    listAdmins,
    listAdminsAsync,
    createAdmin,
    removeAdmin,
    createCourierAccount,
    updateCourierAccount,
    requireAuth,
    guardSite,
    runSplash,
    isLoggedIn,
    isAdmin,
    isSuperAdmin,
    isClient,
    isCourier,
    isAdminRole,
    isCourierRole,
    homeForRole,
    useSupabase,
    publicUser,
    PUBLIC_PAGES,
    SUPER_ADMIN_EMAIL,
    DEFAULT_ADMIN_EMAIL: SUPER_ADMIN_EMAIL,
    DEFAULT_ADMIN_PASSWORD: SUPER_ADMIN_PASSWORD,
  };
})(typeof window !== "undefined" ? window : globalThis);
