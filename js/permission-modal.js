/**
 * LivrExpress — Popups d’autorisation (design site)
 * Affichés AVANT les dialogues natifs navigateur (notif / GPS).
 */
(function (global) {
  const PRESETS = {
    notifications: {
      id: "notifications",
      icon: "🔔",
      title: "Activer les notifications",
      lead: "Recevez une alerte à chaque évolution de votre colis.",
      benefits: [
        "Sonnerie et bannière sur votre téléphone",
        "Suivi sans ouvrir l’application en permanence",
        "Alertes validation, enlèvement, livraison et remise",
      ],
      allowLabel: "Autoriser les notifications",
      denyLabel: "Plus tard",
      footnote:
        "Votre navigateur demandera ensuite une confirmation officielle. Vous pourrez la modifier dans les réglages du téléphone.",
    },
    geolocation: {
      id: "geolocation",
      icon: "📍",
      title: "Activer la localisation GPS",
      lead: "Utilisez la position de votre téléphone pour une livraison précise.",
      benefits: [
        "Point de livraison ou départ plus exact",
        "Suivi live du livreur sur la carte",
        "Meilleure estimation d’arrivée (ETA)",
      ],
      allowLabel: "Autoriser le GPS",
      denyLabel: "Pas maintenant",
      footnote:
        "La position est utilisée uniquement pour la course LivrExpress. Le navigateur demandera ensuite votre accord.",
    },
    geolocation_courier: {
      id: "geolocation_courier",
      icon: "🛵",
      title: "GPS du téléphone de service",
      lead: "Partagez votre position pendant la course pour le suivi client.",
      benefits: [
        "Le client voit votre position en direct",
        "Trajet et distance mis à jour en temps réel",
        "Transparence et confiance sur chaque livraison",
      ],
      allowLabel: "Activer mon GPS service",
      denyLabel: "Annuler",
      footnote:
        "Activez le GPS uniquement pendant vos courses. Vous pouvez l’arrêter à tout moment.",
    },
  };

  let root = null;
  let resolveFn = null;

  const ensureDom = () => {
    if (root) return root;
    root = document.createElement("div");
    root.id = "lxPermModal";
    root.className = "lx-perm";
    root.hidden = true;
    root.setAttribute("role", "dialog");
    root.setAttribute("aria-modal", "true");
    root.setAttribute("aria-labelledby", "lxPermTitle");
    root.innerHTML = `
      <div class="lx-perm__backdrop" data-lx-perm-deny tabindex="-1"></div>
      <div class="lx-perm__dialog">
        <div class="lx-perm__glow" aria-hidden="true"></div>
        <div class="lx-perm__icon-wrap" aria-hidden="true">
          <span class="lx-perm__icon" id="lxPermIcon">🔔</span>
        </div>
        <p class="lx-perm__brand">Livr<span>Express</span></p>
        <h2 class="lx-perm__title" id="lxPermTitle">Autorisation</h2>
        <p class="lx-perm__lead" id="lxPermLead"></p>
        <ul class="lx-perm__list" id="lxPermList"></ul>
        <p class="lx-perm__foot" id="lxPermFoot"></p>
        <div class="lx-perm__actions">
          <button type="button" class="btn btn--ghost btn--lg lx-perm__deny" data-lx-perm-deny id="lxPermDeny">
            Plus tard
          </button>
          <button type="button" class="btn btn--primary btn--lg lx-perm__allow" data-lx-perm-allow id="lxPermAllow">
            Autoriser
          </button>
        </div>
      </div>`;
    document.body.appendChild(root);

    root.addEventListener("click", (e) => {
      if (e.target.closest("[data-lx-perm-allow]")) {
        close(true);
      } else if (e.target.closest("[data-lx-perm-deny]")) {
        close(false);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && root && !root.hidden) close(false);
    });

    return root;
  };

  const close = (allowed) => {
    if (!root) return;
    root.classList.remove("is-open");
    setTimeout(() => {
      if (root) root.hidden = true;
      document.body.classList.remove("lx-perm-open");
    }, 180);
    if (resolveFn) {
      const r = resolveFn;
      resolveFn = null;
      r(Boolean(allowed));
    }
  };

  /**
   * Affiche le popup design LivrExpress.
   * @param {string|object} typeOrConfig - 'notifications' | 'geolocation' | 'geolocation_courier' | config custom
   * @returns {Promise<boolean>} true si l’utilisateur clique Autoriser
   */
  const request = (typeOrConfig = "notifications") => {
    const preset =
      typeof typeOrConfig === "string"
        ? PRESETS[typeOrConfig] || PRESETS.notifications
        : { ...PRESETS.notifications, ...typeOrConfig };

    // Si déjà accordé côté navigateur, pas de popup inutile
    if (preset.id === "notifications" && global.Notification) {
      if (Notification.permission === "granted") {
        return Promise.resolve(true);
      }
      if (Notification.permission === "denied") {
        return Promise.resolve(false);
      }
    }

    ensureDom();
    root.querySelector("#lxPermIcon").textContent = preset.icon || "🔔";
    root.querySelector("#lxPermTitle").textContent = preset.title || "Autorisation";
    root.querySelector("#lxPermLead").textContent = preset.lead || "";
    root.querySelector("#lxPermFoot").textContent = preset.footnote || "";
    root.querySelector("#lxPermAllow").textContent =
      preset.allowLabel || "Autoriser";
    root.querySelector("#lxPermDeny").textContent =
      preset.denyLabel || "Plus tard";

    const list = root.querySelector("#lxPermList");
    list.innerHTML = (preset.benefits || [])
      .map((b) => `<li><span class="lx-perm__check" aria-hidden="true">✓</span>${b}</li>`)
      .join("");

    root.hidden = false;
    document.body.classList.add("lx-perm-open");
    requestAnimationFrame(() => root.classList.add("is-open"));
    root.querySelector("[data-lx-perm-allow]")?.focus();

    return new Promise((resolve) => {
      resolveFn = resolve;
    });
  };

  /** Notifs : popup design puis API navigateur */
  const requestNotifications = async () => {
    if (!global.Notification) {
      return { ok: false, permission: "unsupported" };
    }
    if (Notification.permission === "granted") {
      return { ok: true, permission: "granted" };
    }
    if (Notification.permission === "denied") {
      return { ok: false, permission: "denied" };
    }
    const accepted = await request("notifications");
    if (!accepted) {
      return { ok: false, permission: "dismissed" };
    }
    const perm = await Notification.requestPermission();
    return { ok: perm === "granted", permission: perm };
  };

  /** GPS : popup design puis getCurrentPosition / suite */
  const requestGeolocation = async (variant = "geolocation") => {
    if (!navigator.geolocation) {
      return { ok: false, reason: "unsupported" };
    }
    const key =
      variant === "courier" ? "geolocation_courier" : "geolocation";
    const accepted = await request(key);
    if (!accepted) {
      return { ok: false, reason: "dismissed" };
    }
    return { ok: true, reason: "accepted" };
  };

  global.LivrExpressPerm = {
    PRESETS,
    request,
    requestNotifications,
    requestGeolocation,
  };
})(typeof window !== "undefined" ? window : globalThis);
