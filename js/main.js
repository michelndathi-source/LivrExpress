(async () => {
  const header = document.getElementById("header");
  const nav = document.getElementById("nav");
  const navToggle = document.getElementById("navToggle");
  const yearEl = document.getElementById("year");
  const LX = window.LivrExpress;
  const Auth = window.Auth;
  const isStaff = (user) =>
    user &&
    (user.role === "admin" ||
      user.role === "super_admin" ||
      (Auth && Auth.isAdminRole && Auth.isAdminRole(user.role)));
  const isCourier = (user) =>
    user &&
    (user.role === "courier" ||
      (Auth && Auth.isCourierRole && Auth.isCourierRole(user.role)));

  // ——— Session Supabase (si configuré) puis garde d'accès ———
  if (Auth && typeof Auth.bootstrap === "function") {
    try {
      await Auth.bootstrap();
    } catch (e) {
      console.warn("Auth bootstrap:", e);
    }
  }

  // ——— Protection du site : connexion obligatoire ———
  if (Auth && typeof Auth.guardSite === "function") {
    const gate = Auth.guardSite();
    if (!gate.allowed) return; // redirection en cours
  }

  // ——— Barre de navigation mobile (dock bas d’écran) ———
  const injectMobileDock = () => {
    if (document.getElementById("mobileDock")) return;
    const page = (
      window.location.pathname.split("/").pop() || "index.html"
    ).toLowerCase();
    // pas de dock sur splash / auth pure
    if (["splash.html", "login.html", "register.html"].includes(page)) return;

    const user = Auth ? Auth.getCurrentUser() : null;
    const staff = isStaff(user);
    const courier = isCourier(user);
    const accountHref = staff
      ? "admin.html"
      : courier
        ? "espace-livreur.html"
        : user
          ? "espace-client.html"
          : "login.html";
    const accountLabel = staff
      ? "Admin"
      : courier
        ? "Livreur"
        : user
          ? "Compte"
          : "Connexion";
    const orderHref = user
      ? staff
        ? "admin.html"
        : courier
          ? "espace-livreur.html"
          : "espace-client.html?commander=1"
      : "login.html?next=" + encodeURIComponent("espace-client.html?commander=1");

    const isActive = (names) =>
      names.some((n) => page === n || page.startsWith(n.replace(".html", "")))
        ? " is-active"
        : "";

    const dock = document.createElement("nav");
    dock.id = "mobileDock";
    dock.className = "mobile-dock";
    dock.setAttribute("aria-label", "Navigation mobile");
    dock.innerHTML = `
      <div class="mobile-dock__inner">
        <a class="mobile-dock__item${isActive(["index.html", ""])}" href="index.html">
          <span class="mobile-dock__icon" aria-hidden="true">🏠</span>
          Accueil
        </a>
        <a class="mobile-dock__item${isActive(["suivi.html", "fiche.html"])}" href="suivi.html">
          <span class="mobile-dock__icon" aria-hidden="true">📍</span>
          Suivi
        </a>
        <a class="mobile-dock__item mobile-dock__item--cta${isActive(["espace-client.html"])}" href="${orderHref}">
          <span class="mobile-dock__icon" aria-hidden="true">＋</span>
          Envoyer
        </a>
        <a class="mobile-dock__item${isActive(["profil.html", "livreur.html", "espace-livreur.html"])}" href="${
          courier
            ? "espace-livreur.html"
            : user && !staff
              ? "profil.html"
              : accountHref
        }">
          <span class="mobile-dock__icon" aria-hidden="true">👤</span>
          ${courier ? "Profil" : user && !staff ? "Profil" : accountLabel}
        </a>
        <a class="mobile-dock__item${isActive(["admin.html", "mes-colis.html", "espace-livreur.html"])}" href="${
          staff ? "admin.html" : courier ? "espace-livreur.html" : "mes-colis.html"
        }">
          <span class="mobile-dock__icon" aria-hidden="true">${
            staff ? "⚙️" : courier ? "🛵" : "📦"
          }</span>
          ${staff ? "Admin" : courier ? "Courses" : "Colis"}
        </a>
      </div>`;
    document.body.appendChild(dock);
    document.body.classList.add("has-mobile-dock");
  };
  injectMobileDock();

  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }

  // Header shadow on scroll
  const onScroll = () => {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 8);
  };
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  // Mobile menu
  if (navToggle && nav) {
    const closeNav = () => {
      nav.classList.remove("is-open");
      navToggle.setAttribute("aria-expanded", "false");
      navToggle.setAttribute("aria-label", "Ouvrir le menu");
    };

    const openNav = () => {
      nav.classList.add("is-open");
      navToggle.setAttribute("aria-expanded", "true");
      navToggle.setAttribute("aria-label", "Fermer le menu");
    };

    navToggle.addEventListener("click", () => {
      const isOpen = nav.classList.contains("is-open");
      if (isOpen) closeNav();
      else openNav();
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", closeNav);
    });

    window.addEventListener("resize", () => {
      if (window.innerWidth > 768) closeNav();
    });
  }

  // Smooth scroll offset for sticky header
  document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
    anchor.addEventListener("click", (e) => {
      if (anchor.hasAttribute("data-open-order")) return;
      const href = anchor.getAttribute("href");
      if (!href || href === "#") return;
      const target = document.querySelector(href);
      if (!target) return;
      e.preventDefault();
      const top =
        target.getBoundingClientRect().top +
        window.scrollY -
        (header ? header.offsetHeight - 4 : 0);
      window.scrollTo({ top, behavior: "smooth" });
    });
  });

  // Reveal on scroll
  const revealTargets = document.querySelectorAll(
    ".step, .price-card, .testimonial, .section__head, .cta__inner, .shipment-row"
  );
  revealTargets.forEach((el) => el.classList.add("reveal"));

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    revealTargets.forEach((el) => io.observe(el));
  } else {
    revealTargets.forEach((el) => el.classList.add("is-visible"));
  }

  // ===== Order modal =====
  const orderModal = document.getElementById("orderModal");
  const orderForm = document.getElementById("orderForm");
  const orderPlan = document.getElementById("orderPlan");
  const orderError = document.getElementById("orderError");
  const orderSuccess = document.getElementById("orderSuccess");
  const orderFormPanel = document.getElementById("orderFormPanel");
  const orderSuccessPanel = document.getElementById("orderSuccessPanel");
  const WHATSAPP_NUMBER = (LX && LX.WHATSAPP) || "221770000000";
  let lastFocusBeforeModal = null;
  let lastCreatedId = null;

  const setOrderMessage = (errorMsg, successMsg) => {
    if (orderError) {
      orderError.hidden = !errorMsg;
      orderError.textContent = errorMsg || "";
    }
    if (orderSuccess) {
      orderSuccess.hidden = !successMsg;
      orderSuccess.textContent = successMsg || "";
    }
  };

  const showOrderFormView = () => {
    if (orderFormPanel) orderFormPanel.hidden = false;
    if (orderSuccessPanel) orderSuccessPanel.hidden = true;
    setOrderMessage("", "");
  };

  const showOrderSuccessView = (request) => {
    if (orderFormPanel) orderFormPanel.hidden = true;
    if (orderSuccessPanel) orderSuccessPanel.hidden = false;
    lastCreatedId = request.id;

    const idEl = document.getElementById("successTrackingId");
    const planEl = document.getElementById("successPlan");
    const statusEl = document.getElementById("successStatus");
    const linkTrack = document.getElementById("successLinkTrack");
    const linkFiche = document.getElementById("successLinkFiche");
    const linkWa = document.getElementById("successLinkWa");
    const copyBtn = document.getElementById("copyTrackingBtn");

    if (idEl) idEl.textContent = request.id;
    if (planEl) planEl.textContent = request.plan || "Express";
    if (statusEl) statusEl.textContent = "En attente de validation";
    // Pas de n° de suivi tant que non validé
    if (linkTrack) {
      linkTrack.href = "espace-client.html";
      linkTrack.textContent = "Mon espace client";
    }
    if (linkFiche) linkFiche.hidden = true;
    if (copyBtn) copyBtn.hidden = true;
    if (linkWa) {
      const msg = encodeURIComponent(
        [
          "Bonjour LivrExpress,",
          `J’ai soumis une demande de livraison (réf. ${request.id}).`,
          `Départ : ${request.sender?.address || "—"}`,
          `Destination : ${request.recipient?.address || "—"}`,
          `Destinataire : ${request.recipient?.name || "—"} · ${request.recipient?.phone || "—"}`,
        ].join("\n")
      );
      linkWa.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`;
    }
  };

  const openOrderModal = (plan) => {
    const Auth = window.Auth;
    // Commander réservé aux clients connectés
    if (Auth) {
      const user = Auth.getCurrentUser();
      if (!user) {
        window.location.href =
          "login.html?next=" +
          encodeURIComponent("espace-client.html?commander=1");
        return;
      }
      if (isStaff(user)) {
        window.location.href = "admin.html";
        return;
      }
    }

    if (!orderModal) {
      window.location.href = "espace-client.html?commander=1";
      return;
    }

    lastFocusBeforeModal = document.activeElement;
    orderModal.hidden = false;
    document.body.classList.add("modal-open");
    showOrderFormView();

    if (orderForm) {
      orderForm.querySelectorAll(".is-invalid").forEach((el) => {
        el.classList.remove("is-invalid");
      });
    }

    // Préremplir depuis le profil client (mapping auto)
    const user = Auth ? Auth.getCurrentUser() : null;
    if (user && window.LivrExpressProfile?.fillOrderFormFromProfile) {
      window.LivrExpressProfile.fillOrderFormFromProfile(user);
    } else if (user) {
      const nameEl = document.getElementById("orderName");
      const phoneEl = document.getElementById("orderPhone");
      if (nameEl) nameEl.value = user.name || "";
      if (phoneEl) phoneEl.value = user.phone || "";
      const pickupEl = document.getElementById("orderPickup");
      if (pickupEl && (user.preferredPickup || user.address)) {
        pickupEl.value = user.preferredPickup || user.address || "";
      }
    }

    if (orderPlan && plan) {
      const option = Array.from(orderPlan.options).find(
        (opt) => opt.value.toLowerCase() === String(plan).toLowerCase()
      );
      if (option) orderPlan.value = option.value;
    } else if (orderPlan && user?.defaultPlan) {
      orderPlan.value = user.defaultPlan;
    }

    const firstField = document.getElementById("orderName");
    if (firstField) setTimeout(() => firstField.focus(), 50);
  };

  const closeOrderModal = () => {
    if (!orderModal) return;
    orderModal.hidden = true;
    document.body.classList.remove("modal-open");
    showOrderFormView();
    if (lastFocusBeforeModal && typeof lastFocusBeforeModal.focus === "function") {
      lastFocusBeforeModal.focus();
    }
  };

  document.querySelectorAll("[data-open-order]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const plan = btn.getAttribute("data-plan") || "";
      openOrderModal(plan);
      if (nav && nav.classList.contains("is-open") && navToggle) {
        nav.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
        navToggle.setAttribute("aria-label", "Ouvrir le menu");
      }
    });
  });

  document.querySelectorAll("[data-close-order]").forEach((el) => {
    el.addEventListener("click", closeOrderModal);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && orderModal && !orderModal.hidden) {
      closeOrderModal();
    }
  });

  if (orderModal) {
    const params = new URLSearchParams(window.location.search);
    const planParam = params.get("plan");
    const shouldOpen =
      params.get("commander") === "1" ||
      params.get("order") === "1" ||
      Boolean(planParam);
    if (shouldOpen) openOrderModal(planParam || "");
  }

  // État GPS formulaire commande
  let orderPickupGps = null;
  let orderDeliveryGps = null;

  const getDeliveryMode = () => {
    const gps = document.getElementById("deliveryModeGps");
    if (gps && gps.checked) return "gps";
    return "address";
  };

  const syncDeliveryModeUi = () => {
    const mode = getDeliveryMode();
    const drop = document.getElementById("orderDropoff");
    const wrap = document.getElementById("orderDropoffWrap");
    const gpsBtn = document.getElementById("orderDropoffGpsBtn");
    if (mode === "gps") {
      if (drop) {
        drop.required = false;
        drop.placeholder = "Optionnel — ou laissez la position GPS";
      }
      if (gpsBtn) gpsBtn.hidden = false;
    } else {
      if (drop) {
        drop.required = true;
        drop.placeholder = "ex. Almadies, villa 12";
      }
      if (gpsBtn) gpsBtn.hidden = true;
    }
    if (wrap) wrap.dataset.mode = mode;
  };

  document.getElementById("deliveryModeGps")?.addEventListener("change", syncDeliveryModeUi);
  document.getElementById("deliveryModeAddress")?.addEventListener("change", syncDeliveryModeUi);
  syncDeliveryModeUi();

  const bindGpsCapture = (btnId, hintId, which) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const Geo = window.LivrExpressGeo;
      const hint = document.getElementById(hintId);
      if (!Geo?.captureClientGps) {
        if (hint) {
          hint.hidden = false;
          hint.textContent = "Module GPS indisponible.";
        }
        return;
      }
      btn.disabled = true;
      const prev = btn.textContent;
      btn.textContent = "Localisation…";
      try {
        const pos = await Geo.captureClientGps();
        if (which === "pickup") {
          orderPickupGps = pos;
          const el = document.getElementById("orderPickup");
          if (el) el.value = pos.label || el.value;
        } else {
          orderDeliveryGps = pos;
          const el = document.getElementById("orderDropoff");
          if (el) el.value = pos.label || "Ma position GPS";
          const gpsRadio = document.getElementById("deliveryModeGps");
          if (gpsRadio) {
            gpsRadio.checked = true;
            syncDeliveryModeUi();
          }
        }
        if (hint) {
          hint.hidden = false;
          hint.textContent = `GPS OK (±${Math.round(pos.accuracy || 0)} m) — ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
        }
      } catch (err) {
        if (hint) {
          hint.hidden = false;
          hint.textContent = err.message || "GPS impossible";
        }
      } finally {
        btn.disabled = false;
        btn.textContent = prev;
      }
    });
  };
  bindGpsCapture("orderPickupGpsBtn", "orderPickupGpsHint", "pickup");
  bindGpsCapture("orderDropoffGpsBtn", "orderDropoffGpsHint", "delivery");

  if (orderForm) {
    orderForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      setOrderMessage("", "");

      const nameEl = document.getElementById("orderName");
      const phoneEl = document.getElementById("orderPhone");
      const pickupEl = document.getElementById("orderPickup");
      const dropoffEl = document.getElementById("orderDropoff");
      const recipientEl = document.getElementById("orderRecipient");
      const recipientPhoneEl = document.getElementById("orderRecipientPhone");
      const packageEl = document.getElementById("orderPackage");
      const weightEl = document.getElementById("orderWeight");
      const notesEl = document.getElementById("orderNotes");
      const Geo = window.LivrExpressGeo;

      const fields = [
        nameEl,
        phoneEl,
        orderPlan,
        pickupEl,
        dropoffEl,
        recipientEl,
        recipientPhoneEl,
      ];
      fields.forEach((el) => el && el.classList.remove("is-invalid"));

      const name = nameEl ? nameEl.value.trim() : "";
      const phone = phoneEl ? phoneEl.value.trim() : "";
      const plan = orderPlan ? orderPlan.value : "";
      let pickup = pickupEl ? pickupEl.value.trim() : "";
      let dropoff = dropoffEl ? dropoffEl.value.trim() : "";
      const recipientName = recipientEl ? recipientEl.value.trim() : "";
      const recipientPhone = recipientPhoneEl
        ? recipientPhoneEl.value.trim()
        : "";
      const pkg = packageEl ? packageEl.value.trim() : "";
      const weight = weightEl ? weightEl.value.trim() : "";
      const notes = notesEl ? notesEl.value.trim() : "";
      const deliveryMode = getDeliveryMode();
      let pickupMode = orderPickupGps ? "gps" : "address";

      let valid = true;
      const require = (el, value) => {
        if (!value) {
          if (el) el.classList.add("is-invalid");
          valid = false;
        }
      };
      require(nameEl, name);
      require(phoneEl, phone);
      require(recipientEl, recipientName);
      require(recipientPhoneEl, recipientPhone);
      require(orderPlan, plan);
      require(pickupEl, pickup);

      // Livraison : GPS (capturer si besoin) OU adresse obligatoire
      if (deliveryMode === "address") {
        require(dropoffEl, dropoff);
      }

      if (!valid) {
        setOrderMessage("Merci de remplir tous les champs obligatoires (*).", "");
        return;
      }

      const isValidPhone = (value) =>
        value.replace(/\D/g, "").length >= 8;

      if (!isValidPhone(phone)) {
        if (phoneEl) phoneEl.classList.add("is-invalid");
        setOrderMessage("Indiquez un numéro d’expéditeur valide.", "");
        return;
      }

      if (!isValidPhone(recipientPhone)) {
        if (recipientPhoneEl) recipientPhoneEl.classList.add("is-invalid");
        setOrderMessage(
          "Indiquez un numéro de destinataire valide (pour le livreur).",
          ""
        );
        return;
      }

      const Auth = window.Auth;
      const user = Auth ? Auth.getCurrentUser() : null;
      if (!user || user.role !== "client") {
        setOrderMessage(
          "Connectez-vous en tant que client pour envoyer une demande.",
          ""
        );
        setTimeout(() => {
          window.location.href = "login.html?next=espace-client.html";
        }, 800);
        return;
      }

      if (!LX || typeof LX.createOrderRequest !== "function") {
        setOrderMessage(
          "Service de commande indisponible. Rechargez la page.",
          ""
        );
        return;
      }

      const submitBtn = document.getElementById("orderSubmit");
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Localisation…";
      }

      try {
        // Mode GPS livraison : capturer si pas encore fait
        if (deliveryMode === "gps" && !orderDeliveryGps && Geo?.captureClientGps) {
          try {
            orderDeliveryGps = await Geo.captureClientGps();
            dropoff =
              orderDeliveryGps.label ||
              dropoff ||
              "Position GPS client";
            if (dropoffEl) dropoffEl.value = dropoff;
          } catch (gpsErr) {
            setOrderMessage(
              (gpsErr.message || "GPS impossible") +
                " — choisissez « Adresse choisie » ou autorisez la localisation.",
              ""
            );
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.textContent = "Envoyer la demande";
            }
            return;
          }
        }

        const locations = Geo?.buildLocationsPayload
          ? Geo.buildLocationsPayload({
              pickupMode,
              pickupGps: orderPickupGps,
              pickupAddress: pickup,
              deliveryMode,
              deliveryGps: orderDeliveryGps,
              deliveryAddress: dropoff,
            })
          : {};

        const request = LX.createOrderRequest(
          {
            name,
            phone,
            plan,
            pickup:
              pickup ||
              orderPickupGps?.label ||
              "Point de départ",
            dropoff:
              dropoff ||
              orderDeliveryGps?.label ||
              "Position GPS client",
            recipientName,
            recipientPhone,
            package: pkg || "Colis",
            weight: weight || "—",
            notes,
            deliveryMode,
            pickupMode,
            locations,
          },
          user
        );

        showOrderSuccessView(request);
        orderForm.reset();
        orderPickupGps = null;
        orderDeliveryGps = null;
        if (orderPlan && plan) orderPlan.value = plan;
        const gpsRadio = document.getElementById("deliveryModeGps");
        if (gpsRadio) gpsRadio.checked = true;
        syncDeliveryModeUi();

        if (typeof window.__refreshClientDash === "function") {
          window.__refreshClientDash();
        }
      } catch (err) {
        setOrderMessage(err.message || "Erreur lors de l’envoi.", "");
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = "Envoyer la demande";
        }
      }
    });
  }

  const copyTrackingBtn = document.getElementById("copyTrackingBtn");
  if (copyTrackingBtn) {
    copyTrackingBtn.addEventListener("click", async () => {
      const id =
        lastCreatedId ||
        (document.getElementById("successTrackingId") || {}).textContent;
      if (!id) return;
      try {
        await navigator.clipboard.writeText(id);
        copyTrackingBtn.textContent = "Copié !";
        setTimeout(() => {
          copyTrackingBtn.textContent = "Copier le n°";
        }, 1600);
      } catch {
        copyTrackingBtn.textContent = "Sélectionnez le n°";
      }
    });
  }

  // ===== Helpers tracking UI =====
  const applyStepper = (el, steps, options) => {
    if (!el || !LX) return;
    const rendered = LX.renderStepperHtml(steps, options);
    el.className = `${rendered.className} stepper--${rendered.count}`;
    el.innerHTML = rendered.html;
  };

  const renderTimeline = (el, items) => {
    if (!el) return;
    el.innerHTML = items
      .map((item) => {
        const stateClass =
          item.state === "done"
            ? "is-done"
            : item.state === "active"
              ? "is-active"
              : "";
        const loc = item.location
          ? `<p class="track-timeline__loc">${item.location}</p>`
          : "";
        return `
          <li class="track-timeline__item ${stateClass}">
            <span class="track-timeline__dot" aria-hidden="true"></span>
            <div>
              <p class="track-timeline__title">${item.title}</p>
              <p class="track-timeline__desc">${item.desc}</p>
              ${loc}
              <p class="track-timeline__time">${item.time || "—"}</p>
            </div>
          </li>`;
      })
      .join("");
  };

  const fillTrackingCard = (vm) => {
    if (!vm) return;
    const s = vm.shipment;
    const setText = (id, text) => {
      const n = document.getElementById(id);
      if (n) n.textContent = text;
    };

    setText("resultLabel", vm.label);
    setText("resultId", `#${s.trackingId}`);
    setText("resultIcon", vm.icon);

    const statusEl = document.getElementById("resultStatus");
    if (statusEl) {
      statusEl.textContent = vm.badge;
      statusEl.className = "track__status";
      if (vm.statusClass) statusEl.classList.add(vm.statusClass);
    }

    const progressEl = document.getElementById("resultProgress");
    if (progressEl) {
      progressEl.style.width = `${vm.progress}%`;
      progressEl.classList.add("is-static");
      progressEl.setAttribute("aria-valuenow", String(vm.progress));
    }

    const progressLabel = document.getElementById("resultProgressLabel");
    if (progressLabel) {
      progressLabel.textContent = `${vm.progress}% — ${vm.badge}`;
    }

    applyStepper(document.getElementById("resultSteps"), vm.steps, {
      showTimes: true,
    });

    const guideEl = document.getElementById("resultGuide");
    if (guideEl) {
      guideEl.innerHTML = `<strong>${vm.guideTitle}</strong> — ${vm.guide}`;
    }

    const liveEl = document.getElementById("resultLive");
    if (liveEl) {
      liveEl.hidden = false;
      liveEl.classList.toggle("is-off", !vm.live);
      const liveText = liveEl.querySelector(".track-card__live-text");
      if (liveText) liveText.textContent = vm.liveText;
    }

    setText("courierAvatar", vm.courier.avatar || "🛵");
    setText("courierName", vm.courier.name);
    const ratingTxt =
      vm.courier.rating != null ? ` · ★ ${vm.courier.rating}` : "";
    setText(
      "courierMeta",
      `${vm.courier.meta || vm.courier.zone || ""}${ratingTxt}${
        vm.courier.verified ? " · Vérifié" : ""
      }`
    );

    // Photo livreur si dispo
    const courierAv = document.getElementById("courierAvatar");
    if (courierAv && vm.courier.photoUrl) {
      courierAv.innerHTML = `<img src="${vm.courier.photoUrl}" alt="" class="courier__avatar-img" />`;
    }

    const contact = document.getElementById("courierContact");
    if (contact) {
      const msg = encodeURIComponent(
        `Bonjour LivrExpress, je suis le destinataire du colis ${s.trackingId}.`
      );
      contact.href = `https://wa.me/${vm.courier.phone || WHATSAPP_NUMBER}?text=${msg}`;
    }

    const courierProfileLink = document.getElementById("courierProfileLink");
    if (courierProfileLink) {
      const href =
        vm.courier.profileUrl ||
        (vm.courier.id
          ? `livreur.html?id=${encodeURIComponent(vm.courier.id)}`
          : "");
      if (href && vm.courier.name && vm.courier.name !== "Livreur en attente") {
        courierProfileLink.href = href;
        courierProfileLink.hidden = false;
      } else {
        courierProfileLink.hidden = true;
      }
    }

    // Destinataire — contact pour le livreur en cours de livraison
    setText("recipientName", s.recipient?.name || "—");
    setText("recipientPhone", s.recipient?.phone || "—");
    setText("recipientAddress", s.recipient?.address || "—");

    const recipientCall = document.getElementById("recipientCall");
    const recipientWa = document.getElementById("recipientWhatsApp");
    const rawPhone = (s.recipient?.phone || "").replace(/\D/g, "");
    let waPhone = rawPhone;
    if (waPhone && !waPhone.startsWith("221") && waPhone.length === 9) {
      waPhone = `221${waPhone}`;
    }
    if (recipientCall) {
      if (rawPhone) {
        recipientCall.href = `tel:+${waPhone.startsWith("221") ? waPhone : rawPhone}`;
        recipientCall.hidden = false;
      } else {
        recipientCall.hidden = true;
      }
    }
    if (recipientWa) {
      if (waPhone) {
        const msg = encodeURIComponent(
          `Bonjour, je suis le livreur LivrExpress pour le colis ${s.trackingId}. Je suis en route pour la livraison.`
        );
        recipientWa.href = `https://wa.me/${waPhone}?text=${msg}`;
        recipientWa.hidden = false;
      } else {
        recipientWa.hidden = true;
      }
    }

    setText("routeFrom", s.sender?.address || "—");
    setText(
      "routeFromTime",
      s.createdAt ? LX.formatDateTime(s.createdAt) : "—"
    );
    setText("routeTo", s.recipient?.address || "—");
    setText(
      "routeToTime",
      s.statusKey === "delivered" && s.deliveredAt
        ? `Livré · ${LX.formatDateTime(s.deliveredAt)}`
        : `ETA · ${s.etaLabel || "—"}`
    );

    setText("metaStatus", vm.badge);
    setText("metaType", s.plan || s.pricing?.label || "—");
    setText("metaWeight", s.package?.weight || "—");
    setText("metaEta", s.etaLabel || "—");

    const ficheLink = document.getElementById("resultFicheLink");
    if (ficheLink) {
      ficheLink.href = `fiche.html?id=${encodeURIComponent(s.trackingId)}`;
      ficheLink.hidden = false;
    }

    const pdfBtn = document.getElementById("resultPdfBtn");
    if (pdfBtn) {
      pdfBtn.hidden = false;
      pdfBtn.onclick = () => {
        window.location.href = `fiche.html?id=${encodeURIComponent(
          s.trackingId
        )}&pdf=1`;
      };
    }
  };

  // Hero card — pipeline générique (pas de colis démo)
  const heroStepper = document.getElementById("heroStepper");
  if (heroStepper && LX) {
    const fakeShip = {
      statusKey: "delivery",
      stepTimes: {},
      events: [],
    };
    const steps = LX.resolveSteps(fakeShip);
    applyStepper(heroStepper, steps, { showTimes: false, compact: true });
    const heroProgress = document.getElementById("heroProgress");
    const heroStatus = document.getElementById("heroStatus");
    const heroGuide = document.getElementById("heroGuide");
    if (heroProgress) {
      heroProgress.style.width = "78%";
      heroProgress.classList.add("is-static");
      heroProgress.setAttribute("aria-valuenow", "78");
    }
    if (heroStatus) {
      heroStatus.textContent = "En route";
      heroStatus.className = "track__status";
    }
    if (heroGuide) {
      heroGuide.textContent =
        "Suivez votre colis en temps réel avec le n° reçu après validation.";
    }
  }

  // ===== Page suivi =====
  const trackForm = document.getElementById("trackForm");
  if (trackForm && LX) {
    const trackInput = document.getElementById("trackInput");
    const trackError = document.getElementById("trackError");
    const trackEmpty = document.getElementById("trackEmpty");
    const trackResult = document.getElementById("trackResult");

    const showError = (msg) => {
      if (!trackError) return;
      trackError.hidden = !msg;
      trackError.textContent = msg || "";
    };

    const hideResult = () => {
      if (trackEmpty) trackEmpty.hidden = false;
      if (trackResult) trackResult.hidden = true;
      if (window.LivrExpressMap) {
        window.LivrExpressMap.unmountTrackingMap();
      }
    };

    const mountLiveMap = async (shipment) => {
      const MapApi = window.LivrExpressMap;
      if (!MapApi || !shipment) return;
      const loading = document.getElementById("mapLoading");
      const panel = document.getElementById("liveMapPanel");
      if (panel) panel.hidden = false;
      if (loading) loading.hidden = false;
      try {
        await MapApi.mountTrackingMap(shipment, "liveMap");
      } catch (e) {
        console.warn("Carte live:", e);
      } finally {
        if (loading) loading.hidden = true;
      }
    };

    const bindGpsControls = (shipment) => {
      const Geo = window.LivrExpressGeo;
      const statusEl = document.getElementById("gpsBarStatus");
      const setStatus = (msg, show = true) => {
        if (!statusEl) return;
        statusEl.hidden = !show;
        statusEl.textContent = msg || "";
      };
      const startBtn = document.getElementById("courierGpsStartBtn");
      const stopBtn = document.getElementById("courierGpsStopBtn");
      const clientBtn = document.getElementById("clientGpsShareBtn");
      if (!shipment || !Geo) return;

      const tid = shipment.trackingId;
      const syncBtns = () => {
        const on = Geo.isCourierTracking?.(tid);
        if (startBtn) startBtn.hidden = Boolean(on);
        if (stopBtn) stopBtn.hidden = !on;
      };
      syncBtns();

      if (startBtn) {
        startBtn.onclick = () => {
          const res = Geo.startCourierTracking(tid, (pos, err) => {
            if (err) {
              setStatus(err.message || "GPS livreur erreur");
              return;
            }
            if (pos) {
              setStatus(
                `GPS livreur actif · ±${Math.round(pos.accuracy || 0)} m · ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`
              );
              window.LivrExpressMap?.getTracker?.()?.refresh(
                LX.getShipment(tid)
              );
            }
          });
          if (!res.ok) setStatus(res.error || "Impossible d’activer le GPS");
          else setStatus("GPS livreur activé — partage de la position du téléphone de service…");
          syncBtns();
        };
      }
      if (stopBtn) {
        stopBtn.onclick = () => {
          Geo.stopCourierTracking(tid);
          setStatus("GPS livreur arrêté.");
          syncBtns();
        };
      }
      if (clientBtn) {
        clientBtn.onclick = () => {
          const res = Geo.startClientTracking(tid, (pos) => {
            if (pos) {
              setStatus(
                `Position client partagée · ±${Math.round(pos.accuracy || 0)} m`
              );
              window.LivrExpressMap?.getTracker?.()?.refresh(
                LX.getShipment(tid)
              );
            }
          });
          if (!res.ok) setStatus(res.error || "GPS client impossible");
          else setStatus("Partage de votre position client en cours…");
        };
      }
    };

    const showResult = (shipment) => {
      showError("");
      if (trackEmpty) trackEmpty.hidden = true;
      if (trackResult) trackResult.hidden = false;
      fillTrackingCard(LX.viewModel(shipment));
      if (trackInput) trackInput.value = shipment.trackingId;
      const url = new URL(window.location.href);
      url.searchParams.set("id", shipment.trackingId);
      window.history.replaceState({}, "", url);
      // Carte Maps + avancement live + contrôles GPS
      mountLiveMap(shipment);
      bindGpsControls(shipment);
    };

    // Stats carte → barre de progression visuelle
    window.addEventListener("livrexpress:map-stats", (e) => {
      const bar = document.getElementById("mapLiveProgressBar");
      const d = e.detail;
      if (bar && d) {
        bar.style.width = `${d.progress || 0}%`;
      }
      // Rafraîchir carte statut UI si le colis a avancé (autre onglet)
      if (d && trackResult && !trackResult.hidden && trackInput) {
        const fresh = LX.getShipment(trackInput.value);
        if (fresh && d.statusKey && fresh.statusKey === d.statusKey) {
          // sync card if status label changed mid-flight
          const statusEl = document.getElementById("resultStatus");
          if (statusEl && statusEl.textContent !== d.statusLabel && d.statusLabel) {
            fillTrackingCard(LX.viewModel(fresh));
          }
        }
      }
    });

    const lookup = async (raw) => {
      const id = LX.normalizeTrackingId(raw);
      if (!id) {
        showError("Veuillez saisir un numéro de suivi.");
        hideResult();
        return;
      }
      const shipment = LX.getShipmentAsync
        ? await LX.getShipmentAsync(id)
        : LX.getShipment(id);
      if (!shipment) {
        showError(
          `Aucun colis trouvé pour « ${id} ». Vérifiez le n° ou consultez Mes colis.`
        );
        hideResult();
        return;
      }
      showResult(shipment);
    };

    trackForm.addEventListener("submit", (e) => {
      e.preventDefault();
      lookup(trackInput ? trackInput.value : "");
    });

    // Poll léger : si le statut change (admin / ops), la carte + fiche se mettent à jour
    setInterval(() => {
      if (!trackResult || trackResult.hidden || !trackInput?.value) return;
      const fresh = LX.getShipment(trackInput.value);
      if (!fresh) return;
      const statusEl = document.getElementById("resultStatus");
      const vm = LX.viewModel(fresh);
      if (statusEl && vm && statusEl.textContent !== vm.badge) {
        fillTrackingCard(vm);
        window.LivrExpressMap?.getTracker?.()?.refresh(fresh);
      }
    }, 3000);

    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("id");
    if (fromQuery) lookup(fromQuery);
  }

  // ===== Page fiche de suivi =====
  const ficheRoot = document.getElementById("ficheRoot");
  if (ficheRoot && LX) {
    const params = new URLSearchParams(window.location.search);
    const id = LX.normalizeTrackingId(params.get("id") || "");
    const empty = document.getElementById("ficheEmpty");
    const sheet = document.getElementById("ficheSheet");

    const ficheActions = document.getElementById("ficheActions");

    if (!id) {
      if (empty) empty.hidden = false;
      if (sheet) sheet.hidden = true;
      if (ficheActions) ficheActions.hidden = true;
    } else {
      const shipment = LX.getShipment(id);
      if (!shipment) {
        if (empty) {
          empty.hidden = false;
          const emptyText = empty.querySelector(".track-empty__text");
          if (emptyText) {
            emptyText.innerHTML = `Aucune fiche pour « ${id} ». Voir <a href="mes-colis.html">Mes colis</a>.`;
          }
        }
        if (sheet) sheet.hidden = true;
        if (ficheActions) ficheActions.hidden = true;
      } else {
        if (empty) empty.hidden = true;
        if (sheet) sheet.hidden = false;
        if (ficheActions) ficheActions.hidden = false;
        renderFiche(shipment);
      }
    }

    function renderFiche(shipment) {
      const vm = LX.viewModel(shipment);
      const set = (sel, text) => {
        const el = document.querySelector(sel);
        if (el) el.textContent = text;
      };

      set("[data-fiche-id]", shipment.trackingId);
      set("[data-fiche-barcode]", shipment.trackingId.replace(/-/g, " "));
      set("[data-fiche-status]", vm.badge);
      set("[data-fiche-plan]", shipment.plan || "—");
      set(
        "[data-fiche-price]",
        shipment.pricing
          ? `${shipment.pricing.amount.toLocaleString("fr-FR")} ${shipment.pricing.currency}`
          : "—"
      );
      set(
        "[data-fiche-created]",
        LX.formatDateTime(shipment.createdAt)
      );
      set("[data-fiche-eta]", shipment.etaLabel || "—");
      set("[data-fiche-updated]", LX.formatDateTime(shipment.updatedAt));

      set("[data-fiche-sender-name]", shipment.sender?.name || "—");
      set("[data-fiche-sender-phone]", shipment.sender?.phone || "—");
      set("[data-fiche-sender-address]", shipment.sender?.address || "—");

      set("[data-fiche-recipient-name]", shipment.recipient?.name || "—");
      set("[data-fiche-recipient-phone]", shipment.recipient?.phone || "—");
      set(
        "[data-fiche-recipient-address]",
        shipment.recipient?.address || "—"
      );

      set("[data-fiche-pkg-type]", shipment.package?.type || "—");
      set("[data-fiche-pkg-weight]", shipment.package?.weight || "—");
      set(
        "[data-fiche-pkg-pieces]",
        String(shipment.package?.pieces ?? 1)
      );
      set(
        "[data-fiche-pkg-desc]",
        shipment.package?.description || shipment.notes || "—"
      );

      set(
        "[data-fiche-courier]",
        shipment.courier?.name || "Non assigné"
      );

      const statusBadge = document.querySelector("[data-fiche-status-badge]");
      if (statusBadge) {
        statusBadge.textContent = vm.badge;
        statusBadge.className = "track__status";
        if (vm.statusClass) statusBadge.classList.add(vm.statusClass);
      }

      applyStepper(document.getElementById("ficheStepper"), vm.steps, {
        showTimes: true,
      });

      const progressEl = document.getElementById("ficheProgress");
      if (progressEl) {
        progressEl.style.width = `${vm.progress}%`;
        progressEl.classList.add("is-static");
      }

      const trackLink = document.getElementById("ficheTrackLink");
      if (trackLink) {
        trackLink.href = `suivi.html?id=${encodeURIComponent(shipment.trackingId)}`;
      }

      const printBtn = document.getElementById("fichePrintBtn");
      if (printBtn) {
        printBtn.onclick = () => window.print();
      }

      const pdfBtn = document.getElementById("fichePdfBtn");
      if (pdfBtn) {
        pdfBtn.onclick = () => {
          // Ouvre le dialogue d’impression → « Enregistrer au format PDF »
          document.title = `Fiche-${shipment.trackingId}-LivrExpress`;
          window.print();
        };
      }

      // ?pdf=1 depuis le suivi → téléchargement auto
      const autoPdf = new URLSearchParams(window.location.search).get("pdf");
      if (autoPdf === "1") {
        setTimeout(() => {
          document.title = `Fiche-${shipment.trackingId}-LivrExpress`;
          window.print();
        }, 450);
      }
    }
  }

  // ===== Page liste des n° de suivi (redirige clients vers leur espace) =====
  const listRoot = document.getElementById("shipmentsList");
  if (listRoot && LX) {
    const Auth = window.Auth;
    const user = Auth ? Auth.getCurrentUser() : null;
    if (user && user.role === "client") {
      window.location.href = "espace-client.html";
    } else if (!user) {
      window.location.href = "login.html?next=espace-client.html";
    } else {
      // admin : voir tout
      if (LX.seedDemosIfNeeded) LX.seedDemosIfNeeded(); // purge démos en mode live
      const shipments = LX.listShipments().filter((s) => s.source !== "demo");
      const empty = document.getElementById("shipmentsEmpty");
      if (!shipments.length) {
        if (empty) empty.hidden = false;
        listRoot.innerHTML = "";
      } else {
        if (empty) empty.hidden = true;
        listRoot.innerHTML = shipments
          .map((s) => {
            const vm = LX.viewModel(s);
            const badgeClass = vm.statusClass
              ? `track__status ${vm.statusClass}`
              : "track__status";
            return `
            <article class="shipment-row">
              <div class="shipment-row__main">
                <div class="shipment-row__id-block">
                  <p class="shipment-row__label">N° de suivi</p>
                  <p class="shipment-row__id">${s.trackingId}</p>
                  <p class="shipment-row__date">${LX.formatDateTime(s.createdAt)}</p>
                </div>
                <div class="shipment-row__route">
                  <p><span class="shipment-row__k">De</span> ${s.sender?.address || "—"}</p>
                  <p><span class="shipment-row__k">Vers</span> ${s.recipient?.address || "—"}</p>
                </div>
                <div class="shipment-row__status">
                  <span class="${badgeClass}">${vm.badge}</span>
                </div>
              </div>
              <div class="shipment-row__actions">
                <a class="btn btn--primary btn--sm" href="suivi.html?id=${encodeURIComponent(s.trackingId)}">Suivre</a>
                <a class="btn btn--outline btn--sm" href="fiche.html?id=${encodeURIComponent(s.trackingId)}">Fiche</a>
              </div>
            </article>`;
          })
          .join("");
      }
    }
  }

  // ===== Auth UI (login / register) =====
  const loginForm = document.getElementById("loginForm");
  if (loginForm && Auth) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = document.getElementById("loginError");
      const email = document.getElementById("loginEmail")?.value || "";
      const password = document.getElementById("loginPassword")?.value || "";
      const submitBtn = loginForm.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        const result = await Auth.login({ email, password });
        if (!result.ok) {
          if (err) {
            err.hidden = false;
            err.textContent = result.error;
          }
          return;
        }
        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");
        if (isStaff(result.user)) {
          window.location.href =
            next && !next.includes("login") && next.includes("admin")
              ? next
              : "admin.html";
        } else if (isCourier(result.user)) {
          window.location.href = "espace-livreur.html";
        } else {
          const safeNext =
            next &&
            !next.includes("login") &&
            !next.includes("register") &&
            !next.includes("admin") &&
            !next.includes("espace-livreur")
              ? next
              : "espace-client.html";
          window.location.href = safeNext;
        }
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  const registerForm = document.getElementById("registerForm");
  if (registerForm && Auth) {
    registerForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = document.getElementById("registerError");
      const name = document.getElementById("regName")?.value || "";
      const phone = document.getElementById("regPhone")?.value || "";
      const email = document.getElementById("regEmail")?.value || "";
      const address = document.getElementById("regAddress")?.value || "";
      const password = document.getElementById("regPassword")?.value || "";
      const password2 = document.getElementById("regPassword2")?.value || "";
      if (password !== password2) {
        if (err) {
          err.hidden = false;
          err.textContent = "Les mots de passe ne correspondent pas.";
        }
        return;
      }
      const submitBtn = registerForm.querySelector('[type="submit"]');
      if (submitBtn) submitBtn.disabled = true;
      try {
        const result = await Auth.register({
          name,
          email,
          phone,
          password,
          address,
        });
        if (!result.ok) {
          if (err) {
            err.hidden = false;
            err.textContent = result.error;
          }
          return;
        }
        window.location.href = "index.html";
      } finally {
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // Déconnexion → retour login (site protégé)
  document.querySelectorAll("#logoutBtn, [data-logout]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (Auth) await Auth.logout();
      window.location.href = "login.html";
    });
  });

  // Nav publique : adapter selon session (Connexion à côté de Commander)
  const injectAuthNav = () => {
    if (!Auth) return;
    const nav = document.getElementById("nav");
    if (!nav || nav.dataset.authReady) return;
    nav.dataset.authReady = "1";

    const user = Auth.getCurrentUser();
    const loginBtns = nav.querySelectorAll(
      ".nav__login, a[href='login.html'], a[href*='login.html']"
    );

    if (user) {
      const accountHref = isStaff(user) ? "admin.html" : "espace-client.html";
      const accountLabel = isStaff(user)
        ? user.role === "super_admin"
          ? "Super Admin"
          : "Admin"
        : "Mon espace";

      loginBtns.forEach((el) => {
        el.href = accountHref;
        el.textContent = accountLabel;
        el.classList.add("nav__login");
        el.dataset.accountLink = "1";
      });

      const cta = nav.querySelector(".nav__cta, [data-open-order]");
      if (
        isStaff(user) &&
        cta &&
        cta.tagName === "BUTTON" &&
        cta.hasAttribute("data-open-order")
      ) {
        const a = document.createElement("a");
        a.href = accountHref;
        a.className = "btn btn--primary btn--sm nav__cta";
        a.textContent = accountLabel;
        cta.replaceWith(a);
      }
    }
  };
  injectAuthNav();

  // ===== Espace client =====
  const clientDash = document.getElementById("clientDash");
  if (clientDash && Auth && LX) {
    const user = Auth.requireAuth({ role: "client" });
    if (!user) return;

    const hello = document.getElementById("clientHello");
    if (hello) hello.textContent = user.name.split(" ")[0] || user.name;

    // —— Notifications téléphone (sonnerie système) ——
    const Push = window.LivrExpressPush;
    const pushBanner = document.getElementById("pushBanner");
    const PUSH_DISMISS_KEY = `livrexpress_push_dismiss_${user.id}`;

    const refreshPushBanner = () => {
      if (!pushBanner || !Push) return;
      const st = Push.getStatus(user.id);
      const dismissed = sessionStorage.getItem(PUSH_DISMISS_KEY) === "1";
      const titleEl = document.getElementById("pushBannerTitle");
      const textEl = document.getElementById("pushBannerText");
      const statusEl = document.getElementById("pushBannerStatus");
      const enableBtn = document.getElementById("pushEnableBtn");
      const testBtn = document.getElementById("pushTestBtn");
      const ntfyLink = document.getElementById("pushNtfyLink");
      const dismissBtn = document.getElementById("pushDismissBtn");

      pushBanner.hidden = false;
      pushBanner.classList.remove("push-banner--ok", "push-banner--warn");

      if (!st.supported) {
        pushBanner.classList.add("push-banner--warn");
        if (titleEl) titleEl.textContent = "Notifications non supportées";
        if (textEl) {
          textEl.textContent =
            "Votre navigateur ne permet pas les alertes système. Essayez Chrome ou Edge sur Android, ou Safari (app sur l’écran d’accueil) sur iPhone.";
        }
        if (enableBtn) enableBtn.hidden = true;
        if (testBtn) testBtn.hidden = true;
        if (ntfyLink) ntfyLink.hidden = true;
        if (statusEl) statusEl.hidden = true;
        return;
      }

      if (st.enabled && st.permission === "granted") {
        pushBanner.classList.add("push-banner--ok");
        if (titleEl) titleEl.textContent = "Alertes téléphone activées";
        if (textEl) {
          textEl.innerHTML =
            "À chaque statut de colis, votre téléphone affiche une notification avec la <strong>sonnerie système</strong>. Pour les recevoir même site fermé, ouvrez aussi « Alertes hors site » une fois (abonnement gratuit).";
        }
        if (enableBtn) {
          enableBtn.hidden = true;
        }
        if (testBtn) testBtn.hidden = false;
        if (ntfyLink && st.topic) {
          ntfyLink.hidden = false;
          ntfyLink.href = `https://ntfy.sh/${encodeURIComponent(st.topic)}`;
          ntfyLink.textContent = "Alertes hors site";
        }
        if (statusEl) {
          statusEl.hidden = false;
          statusEl.textContent = "Statut : autorisé · sonnerie du téléphone active";
        }
        if (dismissBtn) dismissBtn.textContent = "Masquer";
        if (dismissed) pushBanner.hidden = true;
        return;
      }

      if (st.permission === "denied") {
        pushBanner.classList.add("push-banner--warn");
        if (titleEl) titleEl.textContent = "Notifications bloquées";
        if (textEl) {
          textEl.textContent =
            "Autorisez LivrExpress dans les réglages du navigateur (icône cadenas → Notifications → Autoriser), puis rechargez la page.";
        }
        if (enableBtn) {
          enableBtn.hidden = false;
          enableBtn.textContent = "Réessayer";
        }
        if (testBtn) testBtn.hidden = true;
        if (ntfyLink) ntfyLink.hidden = true;
        return;
      }

      // Pas encore activé
      if (dismissed && st.permission === "default") {
        pushBanner.hidden = true;
        return;
      }
      if (titleEl) titleEl.textContent = "Activez les alertes sur votre téléphone";
      if (textEl) {
        textEl.innerHTML =
          "À chaque changement de statut de colis, votre téléphone affiche une notification avec la <strong>sonnerie de notification</strong> de votre appareil — même si vous quittez le site.";
      }
      if (enableBtn) {
        enableBtn.hidden = false;
        enableBtn.textContent = "Activer les notifications";
      }
      if (testBtn) testBtn.hidden = true;
      if (ntfyLink) ntfyLink.hidden = true;
      if (statusEl) statusEl.hidden = true;
    };

    document.getElementById("pushEnableBtn")?.addEventListener("click", async () => {
      if (!Push) return;
      const enableBtn = document.getElementById("pushEnableBtn");
      if (enableBtn) {
        enableBtn.disabled = true;
        enableBtn.textContent = "Activation…";
      }
      const res = await Push.enablePhoneNotifications(user.id);
      if (enableBtn) enableBtn.disabled = false;
      if (!res.ok) {
        alert(res.error || "Impossible d’activer les notifications.");
        refreshPushBanner();
        return;
      }
      sessionStorage.removeItem(PUSH_DISMISS_KEY);
      // Abonnement hors-site (ntfy) : ouvre le canal d’alertes téléphone
      if (res.ntfyUrl) {
        const go = confirm(
          "Notifications activées !\n\nPour recevoir les alertes même si le site est complètement fermé, abonnez-vous au canal d’alertes (gratuit).\n\nOuvrir le canal maintenant ?"
        );
        if (go) window.open(res.ntfyUrl, "_blank", "noopener");
      }
      refreshPushBanner();
    });

    document.getElementById("pushTestBtn")?.addEventListener("click", async () => {
      if (!Push) return;
      Push.playFallbackSound?.();
      await Push.showSystemNotification({
        id: "test-" + Date.now(),
        title: "Test LivrExpress",
        message:
          "Si vous entendez la sonnerie de notification de votre téléphone, c’est bon !",
        icon: "🔔",
        renotify: true,
      });
      // Test pont hors-site aussi
      await Push.sendPhoneBridge?.(user.id, {
        title: "Test LivrExpress",
        message: "Alerte hors site OK — vous recevrez les statuts de colis ici aussi.",
      });
    });

    document.getElementById("pushDismissBtn")?.addEventListener("click", () => {
      sessionStorage.setItem(PUSH_DISMISS_KEY, "1");
      if (pushBanner) pushBanner.hidden = true;
    });

    refreshPushBanner();
    // iOS / Android : re-check après retour sur l’app
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") refreshPushBanner();
    });

    const statusLabel = {
      pending: "En attente de validation",
      approved: "Validée",
      rejected: "Refusée",
    };
    const statusClass = {
      pending: "badge-status badge-status--pending",
      approved: "badge-status badge-status--ok",
      rejected: "badge-status badge-status--bad",
    };

    // —— Notifications statut colis ——
    const toastStack = document.getElementById("toastStack");
    const notifBell = document.getElementById("notifBell");
    const notifPanel = document.getElementById("notifPanel");
    const notifWrap = document.getElementById("notifWrap");
    const toastedIds = new Set();
    const TOAST_SEEN_KEY = `livrexpress_toast_seen_${user.id}`;

    try {
      const seen = JSON.parse(sessionStorage.getItem(TOAST_SEEN_KEY) || "[]");
      if (Array.isArray(seen)) seen.forEach((id) => toastedIds.add(id));
    } catch (_) {
      /* ignore */
    }

    const persistToasted = () => {
      try {
        sessionStorage.setItem(
          TOAST_SEEN_KEY,
          JSON.stringify([...toastedIds].slice(-100))
        );
      } catch (_) {
        /* ignore */
      }
    };

    const updateNotifBadges = () => {
      const count =
        typeof LX.countUnreadNotifications === "function"
          ? LX.countUnreadNotifications(user.id)
          : 0;
      const badge = document.getElementById("notifBadge");
      const tabBadge = document.getElementById("notifTabBadge");
      [badge, tabBadge].forEach((el) => {
        if (!el) return;
        if (count > 0) {
          el.hidden = false;
          el.textContent = count > 99 ? "99+" : String(count);
        } else {
          el.hidden = true;
          el.textContent = "0";
        }
      });
      if (notifBell) {
        notifBell.setAttribute(
          "aria-label",
          count > 0
            ? `Notifications (${count} non lue${count > 1 ? "s" : ""})`
            : "Notifications"
        );
      }
    };

    const renderNotifItem = (n, compact = false) => {
      const when = LX.formatDateTime(n.createdAt);
      const trackLink = n.trackingId
        ? `<a class="btn btn--outline btn--sm" href="suivi.html?id=${encodeURIComponent(n.trackingId)}">Suivre</a>`
        : "";
      return `
        <article class="notif-item ${n.read ? "is-read" : "is-unread"}" data-notif-id="${n.id}">
          <span class="notif-item__icon" aria-hidden="true">${n.icon || "📦"}</span>
          <div class="notif-item__body">
            <p class="notif-item__title">${n.title || "Notification"}</p>
            <p class="notif-item__msg">${n.message || ""}</p>
            <p class="notif-item__meta">
              ${when}${n.trackingId ? ` · ${n.trackingId}` : ""}${n.statusKey ? ` · ${n.statusKey}` : ""}
            </p>
            ${
              compact
                ? ""
                : `<div class="notif-item__actions">
                    ${trackLink}
                    ${
                      !n.read
                        ? `<button type="button" class="btn btn--ghost btn--sm" data-mark-read="${n.id}">Marquer lu</button>`
                        : ""
                    }
                  </div>`
            }
          </div>
          ${!n.read ? '<span class="notif-item__dot" aria-label="Non lue"></span>' : ""}
        </article>`;
    };

    const refreshNotifUI = () => {
      if (typeof LX.listNotifications !== "function") return;

      const all = LX.listNotifications(user.id);
      const recent = all.slice(0, 8);

      const panelList = document.getElementById("notifPanelList");
      if (panelList) {
        if (!recent.length) {
          panelList.innerHTML =
            '<p class="notif-panel__empty">Aucune notification pour le moment.</p>';
        } else {
          panelList.innerHTML = recent
            .map((n) => renderNotifItem(n, true))
            .join("");
        }
      }

      const pageList = document.getElementById("clientNotifList");
      if (pageList) {
        if (!all.length) {
          pageList.innerHTML =
            '<p class="dash-empty">Vous recevrez une alerte à chaque évolution de vos colis.</p>';
        } else {
          pageList.innerHTML = all.map((n) => renderNotifItem(n, false)).join("");
        }
      }

      updateNotifBadges();
    };

    const showToast = (n) => {
      if (!toastStack || !n || toastedIds.has(n.id)) return;
      toastedIds.add(n.id);
      persistToasted();

      const el = document.createElement("div");
      el.className = "toast toast--status";
      el.setAttribute("role", "status");
      el.innerHTML = `
        <span class="toast__icon" aria-hidden="true">${n.icon || "📦"}</span>
        <div class="toast__body">
          <p class="toast__title">${n.title || "Mise à jour colis"}</p>
          <p class="toast__msg">${n.message || ""}</p>
          ${
            n.trackingId
              ? `<a class="toast__link" href="suivi.html?id=${encodeURIComponent(n.trackingId)}">Voir le suivi</a>`
              : ""
          }
        </div>
        <button type="button" class="toast__close" aria-label="Fermer">×</button>`;

      const remove = () => {
        el.classList.add("is-leaving");
        setTimeout(() => el.remove(), 280);
      };
      el.querySelector(".toast__close")?.addEventListener("click", remove);
      toastStack.appendChild(el);
      requestAnimationFrame(() => el.classList.add("is-in"));
      setTimeout(remove, 6500);
    };

    /** Affiche un toast pour chaque notif non lue récente (session) */
    const flashUnreadToasts = () => {
      if (typeof LX.listNotifications !== "function") return;
      const unread = LX.listNotifications(user.id, { unreadOnly: true, limit: 5 });
      // plus récentes en bas de pile visuelle
      unread
        .slice()
        .reverse()
        .forEach((n, i) => {
          setTimeout(() => {
            showToast(n);
            // Notif téléphone si autorisée (autre onglet / admin a avancé le statut)
            if (
              Push &&
              Push.permission() === "granted" &&
              !toastedIds.has("sys-" + n.id)
            ) {
              toastedIds.add("sys-" + n.id);
              persistToasted();
              Push.showSystemNotification({
                id: n.id,
                title: n.title,
                message: n.message,
                trackingId: n.trackingId,
                statusKey: n.statusKey,
                icon: n.icon,
                renotify: true,
                requireInteraction:
                  n.statusKey === "delivery" || n.statusKey === "delivered",
              });
            }
          }, i * 350);
        });
    };

    const setNotifPanelOpen = (open) => {
      if (!notifPanel || !notifBell) return;
      notifPanel.hidden = !open;
      notifBell.setAttribute("aria-expanded", open ? "true" : "false");
    };

    if (notifBell && notifPanel) {
      notifBell.addEventListener("click", (e) => {
        e.stopPropagation();
        setNotifPanelOpen(notifPanel.hidden);
        if (!notifPanel.hidden) refreshNotifUI();
      });
      document.addEventListener("click", (e) => {
        if (!notifWrap) return;
        if (!notifWrap.contains(e.target)) setNotifPanelOpen(false);
      });
    }

    document.getElementById("notifMarkAll")?.addEventListener("click", () => {
      LX.markAllNotificationsRead?.(user.id);
      refreshNotifUI();
    });
    document.getElementById("notifMarkAllPage")?.addEventListener("click", () => {
      LX.markAllNotificationsRead?.(user.id);
      refreshNotifUI();
    });

    document.querySelectorAll("[data-open-notif-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        setNotifPanelOpen(false);
        const tab = clientDash.querySelector('.dash-tab[data-tab="notifications"]');
        tab?.click();
      });
    });

    // Clic sur item / marquer lu (panel + page)
    const onNotifClick = (e) => {
      const markBtn = e.target.closest("[data-mark-read]");
      if (markBtn) {
        const id = markBtn.getAttribute("data-mark-read");
        LX.markNotificationRead?.(user.id, id);
        refreshNotifUI();
        e.stopPropagation();
        return;
      }
      const item = e.target.closest("[data-notif-id]");
      if (item && !e.target.closest("a, button")) {
        const id = item.getAttribute("data-notif-id");
        LX.markNotificationRead?.(user.id, id);
        refreshNotifUI();
        const n = LX.listNotifications?.(user.id)?.find((x) => x.id === id);
        if (n?.trackingId) {
          window.location.href = `suivi.html?id=${encodeURIComponent(n.trackingId)}`;
        }
      }
    };
    document.getElementById("notifPanelList")?.addEventListener("click", onNotifClick);
    document.getElementById("clientNotifList")?.addEventListener("click", onNotifClick);

    // Mise à jour live (autre onglet admin ou même page)
    window.addEventListener("livrexpress:notifications", () => {
      refreshNotifUI();
      flashUnreadToasts();
    });
    window.addEventListener("storage", (e) => {
      if (e.key === "livrexpress_notifications_v1") {
        refreshNotifUI();
        flashUnreadToasts();
      }
    });
    // Poll léger si admin avance le statut dans un autre onglet (même navigateur)
    let lastUnreadSnapshot = LX.countUnreadNotifications?.(user.id) ?? 0;
    setInterval(() => {
      const unread = LX.countUnreadNotifications?.(user.id) ?? 0;
      if (unread !== lastUnreadSnapshot) {
        lastUnreadSnapshot = unread;
        refreshNotifUI();
        flashUnreadToasts();
      } else {
        updateNotifBadges();
      }
    }, 3000);

    const refreshClientDash = async () => {
      const orders = LX.listOrderRequestsAsync
        ? await LX.listOrderRequestsAsync({ userId: user.id })
        : LX.listOrderRequests({ userId: user.id });
      const shipments = LX.listShipmentsByUserAsync
        ? await LX.listShipmentsByUserAsync(user.id)
        : LX.listShipmentsByUser(user.id);

      const pending = orders.filter((o) => o.status === "pending").length;
      const delivered = shipments.filter((s) => s.statusKey === "delivered").length;
      const active = shipments.filter((s) => s.statusKey !== "delivered").length;

      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(v);
      };
      set("statPending", pending);
      set("statActive", active);
      set("statDelivered", delivered);
      set("statTotal", orders.length);

      refreshNotifUI();

      const ordersList = document.getElementById("clientOrdersList");
      if (ordersList) {
        if (!orders.length) {
          ordersList.innerHTML =
            '<p class="dash-empty">Aucune demande. Cliquez sur « Nouvelle demande ».</p>';
        } else {
          ordersList.innerHTML = orders
            .map(
              (o) => `
            <article class="dash-card">
              <div class="dash-card__top">
                <div>
                  <p class="dash-card__id">${o.id}</p>
                  <p class="dash-card__meta">${LX.formatDateTime(o.createdAt)} · ${o.plan}</p>
                </div>
                <span class="${statusClass[o.status] || "badge-status"}">${statusLabel[o.status] || o.status}</span>
              </div>
              <p class="dash-card__route">
                <strong>De</strong> ${o.sender?.address || "—"}
                <br /><strong>Vers</strong> ${o.recipient?.address || "—"}
                <br /><strong>Dest.</strong> ${o.recipient?.name || "—"} · ${o.recipient?.phone || "—"}
              </p>
              ${
                o.status === "approved" && o.trackingId
                  ? `<div class="dash-card__actions">
                      <p class="dash-card__track">N° suivi : <strong>${o.trackingId}</strong></p>
                      <a class="btn btn--primary btn--sm" href="suivi.html?id=${encodeURIComponent(o.trackingId)}">Suivre</a>
                      <a class="btn btn--outline btn--sm" href="fiche.html?id=${encodeURIComponent(o.trackingId)}">Fiche</a>
                    </div>`
                  : o.status === "rejected"
                    ? `<p class="dash-card__reject">${o.rejectReason || "Demande refusée."}</p>`
                    : `<p class="dash-card__wait">Le n° de suivi sera disponible après validation LivrExpress.</p>`
              }
            </article>`
            )
            .join("");
        }
      }

      const shipList = document.getElementById("clientShipmentsList");
      if (shipList) {
        if (!shipments.length) {
          shipList.innerHTML =
            '<p class="dash-empty">Aucun colis validé pour le moment.</p>';
        } else {
          shipList.innerHTML = shipments
            .map((s) => {
              const vm = LX.viewModel(s);
              return `
              <article class="dash-card">
                <div class="dash-card__top">
                  <div>
                    <p class="dash-card__id">${s.trackingId}</p>
                    <p class="dash-card__meta">${LX.formatDateTime(s.createdAt)} · ${s.plan}</p>
                  </div>
                  <span class="track__status ${vm.statusClass || ""}">${vm.badge}</span>
                </div>
                <div class="shipment-row__bar" style="margin:0.75rem 0">
                  <div class="progress__bar is-static" style="width:${vm.progress}%;height:6px;border-radius:999px"></div>
                </div>
                <p class="dash-card__route">${vm.guide}</p>
                <div class="dash-card__actions">
                  <a class="btn btn--primary btn--sm" href="suivi.html?id=${encodeURIComponent(s.trackingId)}">Suivre</a>
                  <a class="btn btn--outline btn--sm" href="fiche.html?id=${encodeURIComponent(s.trackingId)}">Fiche</a>
                </div>
              </article>`;
            })
            .join("");
        }
      }
    };

    window.__refreshClientDash = refreshClientDash;
    refreshClientDash();
    // Toasts pour les évolutions de colis non encore vues cette session
    setTimeout(flashUnreadToasts, 500);

    // Tabs
    clientDash.querySelectorAll(".dash-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const key = tab.getAttribute("data-tab");
        clientDash.querySelectorAll(".dash-tab").forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        clientDash.querySelectorAll(".dash-panel").forEach((p) => {
          const show = p.getAttribute("data-panel") === key;
          p.hidden = !show;
          p.classList.toggle("is-active", show);
        });
        if (key === "notifications") {
          // Ouverture de l’onglet : rafraîchir la liste
          refreshNotifUI();
        }
      });
    });

    // Profil
    const profileForm = document.getElementById("profileForm");
    const Prof = window.LivrExpressProfile;
    const refreshProfileMini = () => {
      const p = Prof?.buildAccountProfile?.(user) || user;
      const img = document.getElementById("profileMiniPhoto");
      const ini = document.getElementById("profileMiniInitials");
      if (img && p.photoUrl) {
        img.src = p.photoUrl;
        img.hidden = false;
        if (ini) ini.hidden = true;
      } else if (ini) {
        if (img) img.hidden = true;
        ini.hidden = false;
        ini.textContent = (p.initials || p.name || "?").toString().slice(0, 2).toUpperCase();
      }
      const link = document.getElementById("openFullProfile");
      if (link) link.href = `profil.html?id=${encodeURIComponent(user.id)}`;
    };
    if (profileForm) {
      const p0 = Prof?.buildAccountProfile?.(user) || user;
      document.getElementById("profileName").value = p0.name || "";
      document.getElementById("profilePhone").value = p0.phone || "";
      document.getElementById("profileEmail").value = p0.email || "";
      document.getElementById("profileAddress").value = p0.address || "";
      const cityEl = document.getElementById("profileCity");
      const neighEl = document.getElementById("profileNeighborhood");
      const pickEl = document.getElementById("profilePickup");
      if (cityEl) cityEl.value = p0.city || "Dakar";
      if (neighEl) neighEl.value = p0.neighborhood || "";
      if (pickEl) pickEl.value = p0.preferredPickup || p0.address || "";
      refreshProfileMini();

      document
        .getElementById("profileMiniPhotoInput")
        ?.addEventListener("change", async (ev) => {
          const file = ev.target.files?.[0];
          if (!file || !Prof) return;
          try {
            const dataUrl = await Prof.fileToPhotoDataUrl(file);
            await Auth.updateProfile(user.id, { photoUrl: dataUrl });
            refreshProfileMini();
            const ok = document.getElementById("profileSuccess");
            if (ok) {
              ok.hidden = false;
              ok.textContent = "Photo de profil mise à jour.";
            }
          } catch (err) {
            alert(err.message || "Photo impossible.");
          }
        });

      profileForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = document.getElementById("profileError");
        const ok = document.getElementById("profileSuccess");
        const result = await Auth.updateProfile(user.id, {
          name: document.getElementById("profileName").value,
          phone: document.getElementById("profilePhone").value,
          address: document.getElementById("profileAddress").value,
          city: document.getElementById("profileCity")?.value,
          neighborhood: document.getElementById("profileNeighborhood")?.value,
          preferredPickup: document.getElementById("profilePickup")?.value,
        });
        if (!result.ok) {
          if (err) {
            err.hidden = false;
            err.textContent = result.error;
          }
          if (ok) ok.hidden = true;
          return;
        }
        if (err) err.hidden = true;
        if (ok) {
          ok.hidden = false;
          ok.textContent = "Profil mis à jour. Les prochaines commandes seront préremplies.";
        }
        if (hello) hello.textContent = (result.user.name || "").split(" ")[0];
        refreshProfileMini();
      });
    }

    // Ouvrir commande si ?commander=1
    const params = new URLSearchParams(window.location.search);
    if (params.get("commander") === "1" || params.get("order") === "1") {
      openOrderModal(params.get("plan") || "");
    }
  }

  // ===== Admin =====
  const adminDash = document.getElementById("adminDash");
  if (adminDash && Auth && LX) {
    const admin = Auth.requireAuth({ role: "admin" });
    if (!admin) return;

    const isSuper = admin.role === "super_admin";
    const adminHello = document.getElementById("adminHello");
    if (adminHello) adminHello.textContent = admin.name || admin.email;
    const roleBadge = document.getElementById("adminRoleBadge");
    if (roleBadge) {
      roleBadge.textContent = isSuper
        ? "Super-admin (propriétaire)"
        : "Co-administrateur";
      roleBadge.className =
        "dash-admin-role" + (isSuper ? " dash-admin-role--super" : "");
    }

    const teamTab = document.getElementById("adminTeamTab");
    if (teamTab) teamTab.hidden = !isSuper;
    const superEmailLabel = document.getElementById("superAdminEmailLabel");
    if (superEmailLabel && Auth.SUPER_ADMIN_EMAIL) {
      superEmailLabel.textContent = ` (${Auth.SUPER_ADMIN_EMAIL})`;
    }

    let orderFilter = "pending";

    const getSelectedOrderIds = () =>
      Array.from(
        adminDash.querySelectorAll(".order-select:checked")
      ).map((el) => el.value);

    const updateBulkCount = () => {
      const n = getSelectedOrderIds().length;
      const el = document.getElementById("bulkCount");
      if (el) el.textContent = `${n} sélectionnée(s)`;
    };

    const refreshAdmin = async () => {
      const allOrders = LX.listOrderRequestsAsync
        ? await LX.listOrderRequestsAsync()
        : LX.listOrderRequests();
      const pending = allOrders.filter((o) => o.status === "pending");
      const shipments = LX.listShipments().filter((s) => s.source !== "demo");
      const active = shipments.filter((s) => s.statusKey !== "delivered");
      const delivered = shipments.filter((s) => s.statusKey === "delivered");
      const clients = Auth.listClientsAsync
        ? await Auth.listClientsAsync()
        : Auth.listClients();

      const set = (id, v) => {
        const el = document.getElementById(id);
        if (el) el.textContent = String(v);
      };
      set("adminStatPending", pending.length);
      set("adminStatActive", active.length);
      set("adminStatDelivered", delivered.length);
      set("adminStatClients", clients.length);

      const filtered =
        orderFilter === "all"
          ? allOrders
          : allOrders.filter((o) => o.status === orderFilter);

      const ordersList = document.getElementById("adminOrdersList");
      if (ordersList) {
        if (!filtered.length) {
          ordersList.innerHTML =
            '<p class="dash-empty">Aucune demande dans ce filtre.</p>';
        } else {
          ordersList.innerHTML = filtered
            .map((o) => {
              const canReview = o.status === "pending";
              return `
              <article class="dash-card" data-order-id="${o.id}">
                <div class="dash-card__top">
                  <div class="dash-card__id-row">
                    ${
                      canReview
                        ? `<label class="order-check"><input type="checkbox" class="order-select" value="${o.id}" /></label>`
                        : ""
                    }
                    <div>
                      <p class="dash-card__id">${o.id}</p>
                      <p class="dash-card__meta">${LX.formatDateTime(o.createdAt)} · Client : ${o.userName || o.userEmail}</p>
                    </div>
                  </div>
                  <span class="badge-status badge-status--${o.status === "pending" ? "pending" : o.status === "approved" ? "ok" : "bad"}">
                    ${o.status === "pending" ? "À valider" : o.status === "approved" ? "Validée" : "Refusée"}
                  </span>
                </div>
                <div class="dash-card__grid">
                  <p><strong>Offre</strong> ${o.plan} · ${o.pricing?.amount?.toLocaleString("fr-FR") || "—"} FCFA</p>
                  <p><strong>Expéditeur</strong> ${o.sender?.name} · ${o.sender?.phone}<br/>${o.sender?.address}</p>
                  <p><strong>Destinataire</strong> ${o.recipient?.name} · ${o.recipient?.phone}<br/>${o.recipient?.address}</p>
                  <p><strong>Colis</strong> ${o.package?.type || "—"} · ${o.package?.weight || "—"}</p>
                  ${o.notes ? `<p><strong>Notes</strong> ${o.notes}</p>` : ""}
                  ${o.trackingId ? `<p><strong>N° suivi</strong> ${o.trackingId}</p>` : ""}
                  ${o.reviewedBy ? `<p><strong>Traité par</strong> ${o.reviewedBy}</p>` : ""}
                </div>
                ${
                  canReview
                    ? `<div class="dash-card__actions">
                        <button type="button" class="btn btn--primary btn--sm" data-approve="${o.id}">Valider &amp; créer n° suivi</button>
                        <button type="button" class="btn btn--outline btn--sm" data-reject="${o.id}">Refuser</button>
                      </div>`
                    : o.trackingId
                      ? `<div class="dash-card__actions">
                          <a class="btn btn--primary btn--sm" href="suivi.html?id=${encodeURIComponent(o.trackingId)}">Suivi</a>
                          <a class="btn btn--outline btn--sm" href="fiche.html?id=${encodeURIComponent(o.trackingId)}">Fiche</a>
                          <button type="button" class="btn btn--ghost btn--sm" data-advance="${o.trackingId}">Mettre à jour le statut</button>
                        </div>`
                      : ""
                }
              </article>`;
            })
            .join("");
        }
      }

      const selectAll = document.getElementById("adminSelectAll");
      if (selectAll) selectAll.checked = false;
      updateBulkCount();

      const shipList = document.getElementById("adminShipmentsList");
      if (shipList) {
        if (!shipments.length) {
          shipList.innerHTML = '<p class="dash-empty">Aucune livraison active.</p>';
        } else {
          shipList.innerHTML = shipments
            .map((s) => {
              const vm = LX.viewModel(s);
              return `
              <article class="dash-card">
                <div class="dash-card__top">
                  <div>
                    <p class="dash-card__id">${s.trackingId}</p>
                    <p class="dash-card__meta">${s.userEmail || "—"} · ${s.plan}</p>
                  </div>
                  <span class="track__status ${vm.statusClass || ""}">${vm.badge}</span>
                </div>
                <p class="dash-card__route">${s.sender?.address} → ${s.recipient?.address}</p>
                <div class="dash-card__actions">
                  <a class="btn btn--outline btn--sm" href="suivi.html?id=${encodeURIComponent(s.trackingId)}">Voir</a>
                  <a class="btn btn--outline btn--sm" href="fiche.html?id=${encodeURIComponent(s.trackingId)}">Fiche</a>
                  ${
                    s.statusKey !== "delivered"
                      ? `<button type="button" class="btn btn--primary btn--sm" data-advance="${s.trackingId}">Mettre à jour le statut</button>`
                      : ""
                  }
                </div>
              </article>`;
            })
            .join("");
        }
      }

      const clientsList = document.getElementById("adminClientsList");
      const Prof = window.LivrExpressProfile;
      if (clientsList) {
        const mapOpts = {
          q: document.getElementById("clientMapQ")?.value || "",
          city: document.getElementById("clientMapCity")?.value || "",
          tier: document.getElementById("clientMapTier")?.value || "",
          zone: document.getElementById("clientMapZone")?.value || "",
          sort: document.getElementById("clientMapSort")?.value || "recent",
        };
        const mapped = Prof
          ? Prof.listClientMap(mapOpts)
          : clients.map((c) => ({
              ...c,
              stats: {
                totalOrders: LX.listOrderRequests({ userId: c.id }).length,
                totalSpent: 0,
              },
              clientTier: "standard",
              profileUrl: `profil.html?id=${encodeURIComponent(c.id)}`,
            }));

        if (!mapped.length) {
          clientsList.innerHTML =
            '<p class="dash-empty">Aucun client pour ces filtres.</p>';
        } else {
          clientsList.innerHTML = mapped
            .map((c) => {
              const tier = Prof?.tierMeta?.(c.clientTier) || {
                label: c.clientTier || "Standard",
                class: "",
              };
              const photo = c.photoUrl
                ? `<img class="client-map-avatar" src="${c.photoUrl}" alt="" />`
                : `<span class="client-map-avatar client-map-avatar--ini">${(
                    c.initials ||
                    (c.name || "?").slice(0, 2)
                  ).toUpperCase()}</span>`;
              return `
              <article class="dash-card client-map-card">
                <div class="dash-card__top">
                  <div class="client-map-card__id">
                    ${photo}
                    <div>
                      <p class="dash-card__id">${c.name || "—"}</p>
                      <p class="dash-card__meta">${c.email || "—"} · ${c.phone || "—"}</p>
                    </div>
                  </div>
                  <span class="account-tier ${tier.class}">${tier.label}</span>
                </div>
                <p class="dash-card__route">
                  ${c.city || "Dakar"}${c.neighborhood ? " · " + c.neighborhood : ""}
                  ${c.zones?.length ? " · Zones : " + c.zones.join(", ") : ""}
                </p>
                <p class="dash-card__meta">
                  ${c.stats?.totalOrders || 0} commande(s)
                  · ${Prof?.formatMoney?.(c.stats?.totalSpent) || "0 FCFA"}
                  · ${c.stats?.delivered || 0} livré(s)
                </p>
                <div class="dash-card__actions">
                  <a class="btn btn--primary btn--sm" href="${c.profileUrl}">Fiche compte</a>
                  ${
                    c.stats?.lastOrderId
                      ? `<span class="badge-status">Dernière : ${c.stats.lastOrderId}</span>`
                      : ""
                  }
                </div>
              </article>`;
            })
            .join("");
        }
      }

      // Livreurs admin
      const couriersList = document.getElementById("adminCouriersList");
      if (couriersList && Prof) {
        const crs = Prof.listCouriers(false);
        if (!crs.length) {
          couriersList.innerHTML =
            '<p class="dash-empty">Aucun livreur. Créez un compte ci-dessus.</p>';
        } else {
          couriersList.innerHTML = crs
            .map(
              (cr) => `
          <article class="dash-card">
            <div class="dash-card__top">
              <div>
                <p class="dash-card__id">${cr.avatar || "🛵"} ${cr.name}</p>
                <p class="dash-card__meta">${cr.email || "—"} · ${cr.phone || "—"}</p>
              </div>
              <span class="badge-status ${cr.active !== false ? "badge-status--ok" : "badge-status--bad"}">${
                cr.active !== false ? "Actif" : "Inactif"
              }</span>
            </div>
            <p class="dash-card__route">${cr.vehicle || "—"} · ${cr.plate || "—"} · ${cr.zone || "—"}</p>
            <p class="dash-card__meta">★ ${cr.rating ?? "—"} · ${cr.deliveriesCount || 0} courses · Auth: ${
                cr.userId ? "oui" : "fiche seule"
              }</p>
            <div class="dash-card__actions">
              <a class="btn btn--outline btn--sm" href="livreur.html?id=${encodeURIComponent(cr.id)}">Profil public</a>
              <button type="button" class="btn btn--ghost btn--sm" data-edit-courier="${cr.id}">Modifier (admin)</button>
              <button type="button" class="btn btn--outline btn--sm" data-toggle-courier="${cr.id}">${
                cr.active !== false ? "Désactiver" : "Activer"
              }</button>
            </div>
          </article>`
            )
            .join("");
        }
      }

      // Équipe admin (super-admin)
      if (isSuper) {
        const teamList = document.getElementById("adminTeamList");
        const admins = Auth.listAdminsAsync
          ? await Auth.listAdminsAsync()
          : Auth.listAdmins();
        if (teamList) {
          teamList.innerHTML = admins
            .map((a) => {
              const isOwner = a.role === "super_admin";
              return `
              <article class="dash-card">
                <div class="dash-card__top">
                  <div>
                    <p class="dash-card__id">${a.name}</p>
                    <p class="dash-card__meta">${a.email} · ${a.phone || "—"}</p>
                  </div>
                  <span class="badge-status ${isOwner ? "badge-status--ok" : ""}">
                    ${isOwner ? "Super-admin" : "Co-admin"}
                  </span>
                </div>
                <p class="dash-card__route">
                  ${
                    isOwner
                      ? "Propriétaire du site — unique super-admin"
                      : `Ajouté par ${a.createdBy || "—"} · ${LX.formatDateTime(a.createdAt)}`
                  }
                </p>
                ${
                  !isOwner
                    ? `<div class="dash-card__actions">
                        <button type="button" class="btn btn--outline btn--sm" data-remove-admin="${a.email}">
                          Retirer le rôle admin
                        </button>
                      </div>`
                    : ""
                }
              </article>`;
            })
            .join("");
        }
      }
    };

    adminDash.addEventListener("change", (e) => {
      if (
        e.target.classList.contains("order-select") ||
        e.target.id === "adminSelectAll"
      ) {
        if (e.target.id === "adminSelectAll") {
          const on = e.target.checked;
          adminDash.querySelectorAll(".order-select").forEach((cb) => {
            cb.checked = on;
          });
        }
        updateBulkCount();
      }
    });

    const bulkApproveBtn = document.getElementById("bulkApproveBtn");
    const bulkRejectBtn = document.getElementById("bulkRejectBtn");
    if (bulkApproveBtn) {
      bulkApproveBtn.addEventListener("click", () => {
        const ids = getSelectedOrderIds();
        if (!ids.length) {
          alert("Sélectionnez au moins une demande en attente.");
          return;
        }
        if (!confirm(`Valider ${ids.length} demande(s) et créer les n° de suivi ?`))
          return;
        const res = LX.bulkApproveOrderRequests(ids, admin);
        alert(`${res.approved} / ${res.total} demande(s) validée(s).`);
        refreshAdmin();
      });
    }
    if (bulkRejectBtn) {
      bulkRejectBtn.addEventListener("click", () => {
        const ids = getSelectedOrderIds();
        if (!ids.length) {
          alert("Sélectionnez au moins une demande en attente.");
          return;
        }
        const reason = prompt(
          "Motif du refus (visible par les clients) :",
          "Demande refusée par l’administration."
        );
        if (reason === null) return;
        if (!confirm(`Refuser ${ids.length} demande(s) ?`)) return;
        const res = LX.bulkRejectOrderRequests(ids, admin, reason);
        alert(`${res.rejected} / ${res.total} demande(s) refusée(s).`);
        refreshAdmin();
      });
    }

    adminDash.addEventListener("click", async (e) => {
      const approve = e.target.closest("[data-approve]");
      const reject = e.target.closest("[data-reject]");
      const advance = e.target.closest("[data-advance]");
      const filterBtn = e.target.closest("[data-order-filter]");
      const removeAdm = e.target.closest("[data-remove-admin]");

      if (filterBtn) {
        orderFilter = filterBtn.getAttribute("data-order-filter") || "pending";
        adminDash.querySelectorAll("[data-order-filter]").forEach((b) => {
          b.classList.toggle("btn--primary", b === filterBtn);
          b.classList.toggle(
            "btn--outline",
            b !== filterBtn && !b.classList.contains("btn--ghost")
          );
        });
        refreshAdmin();
        return;
      }

      if (approve) {
        const id = approve.getAttribute("data-approve");
        const result = LX.approveOrderRequest(id, admin);
        if (!result.ok) alert(result.error);
        else {
          alert(
            `Commande validée.\nN° de suivi : ${result.shipment.trackingId}\n\nLe client a été notifié (validation + préparation du colis).`
          );
          refreshAdmin();
        }
        return;
      }

      if (reject) {
        const id = reject.getAttribute("data-reject");
        const reason = prompt("Motif du refus (visible par le client) :", "");
        if (reason === null) return;
        const result = LX.rejectOrderRequest(id, admin, reason);
        if (!result.ok) alert(result.error);
        else refreshAdmin();
        return;
      }

      if (advance) {
        const tid = advance.getAttribute("data-advance");
        const updated = LX.advanceShipment(tid);
        // Pas d’alert() bloquant : la liste se rafraîchit avec le nouveau statut
        if (updated) {
          const meta = LX.getStatusMeta?.(updated.statusKey);
          const label = meta?.badge || updated.statusKey;
          console.info(
            `[LivrExpress] ${updated.trackingId} → ${label}` +
              (updated.userId ? " (client notifié)" : "")
          );
        }
        refreshAdmin();
        return;
      }

      if (removeAdm && isSuper) {
        const email = removeAdm.getAttribute("data-remove-admin");
        if (!confirm(`Retirer le rôle admin de ${email} ?`)) return;
        const res = await Auth.removeAdmin(admin, email);
        if (!res.ok) alert(res.error);
        else refreshAdmin();
      }
    });

    // Formulaire ajout co-admin
    const addAdminForm = document.getElementById("addAdminForm");
    if (addAdminForm && isSuper) {
      addAdminForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = document.getElementById("coAdminError");
        const ok = document.getElementById("coAdminSuccess");
        const result = await Auth.createAdmin(admin, {
          name: document.getElementById("coAdminName").value,
          email: document.getElementById("coAdminEmail").value,
          phone: document.getElementById("coAdminPhone").value,
          password: document.getElementById("coAdminPassword").value,
        });
        if (!result.ok) {
          if (err) {
            err.hidden = false;
            err.textContent = result.error;
          }
          if (ok) ok.hidden = true;
          return;
        }
        if (err) err.hidden = true;
        if (ok) {
          ok.hidden = false;
          ok.textContent = result.promoted
            ? "Client promu co-admin avec succès."
            : "Co-admin créé. Il peut se connecter avec cet email et le mot de passe défini.";
        }
        addAdminForm.reset();
        refreshAdmin();
      });
    }

    adminDash.querySelectorAll(".dash-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        if (tab.hidden) return;
        const key = tab.getAttribute("data-tab");
        adminDash
          .querySelectorAll(".dash-tab")
          .forEach((t) => t.classList.remove("is-active"));
        tab.classList.add("is-active");
        adminDash.querySelectorAll(".dash-panel").forEach((p) => {
          const show = p.getAttribute("data-panel") === key;
          p.hidden = !show;
          p.classList.toggle("is-active", show);
        });
      });
    });

    // Filtres mapping clients
    ["clientMapQ", "clientMapCity", "clientMapTier", "clientMapZone", "clientMapSort"].forEach(
      (id) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener(id === "clientMapQ" ? "input" : "change", () =>
          refreshAdmin()
        );
      }
    );

    // Création compte livreur (admin only)
    const addCourierForm = document.getElementById("addCourierForm");
    if (addCourierForm) {
      addCourierForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const err = document.getElementById("crFormError");
        const ok = document.getElementById("crFormSuccess");
        const res = await Auth.createCourierAccount(admin, {
          name: document.getElementById("crName").value,
          email: document.getElementById("crEmail").value,
          phone: document.getElementById("crPhone").value,
          password: document.getElementById("crPassword").value,
          vehicle: document.getElementById("crVehicle").value,
          plate: document.getElementById("crPlate").value,
          zone: document.getElementById("crZone").value,
          bio: document.getElementById("crBio").value,
        });
        if (!res.ok) {
          if (err) {
            err.hidden = false;
            err.textContent = res.error;
          }
          if (ok) ok.hidden = true;
          return;
        }
        if (err) err.hidden = true;
        if (ok) {
          ok.hidden = false;
          ok.textContent = `Livreur créé. Connexion : ${res.user.email} → espace-livreur.html`;
        }
        addCourierForm.reset();
        refreshAdmin();
      });
    }

    // Edit / toggle courier
    adminDash.addEventListener("click", async (e) => {
      const editBtn = e.target.closest("[data-edit-courier]");
      const toggleBtn = e.target.closest("[data-toggle-courier]");
      const Prof = window.LivrExpressProfile;
      if (editBtn && Prof) {
        const id = editBtn.getAttribute("data-edit-courier");
        const cr = Prof.getCourier(id);
        if (!cr) return;
        const name = prompt("Nom du livreur :", cr.name);
        if (name === null) return;
        const phone = prompt("Téléphone service :", cr.phone || "");
        if (phone === null) return;
        const vehicle = prompt("Véhicule :", cr.vehicle || "Moto");
        if (vehicle === null) return;
        const plate = prompt("Immatriculation :", cr.plate || "");
        if (plate === null) return;
        const zone = prompt("Zone :", cr.zone || "");
        if (zone === null) return;
        const bio = prompt("Bio :", cr.bio || "");
        if (bio === null) return;
        const res = await Auth.updateCourierAccount(admin, id, {
          name,
          phone,
          vehicle,
          plate,
          zone,
          bio,
        });
        if (!res.ok) alert(res.error);
        else refreshAdmin();
      }
      if (toggleBtn && Prof) {
        const id = toggleBtn.getAttribute("data-toggle-courier");
        const cr = Prof.getCourier(id);
        if (!cr) return;
        await Auth.updateCourierAccount(admin, id, {
          active: cr.active === false,
        });
        refreshAdmin();
      }
    });

    refreshAdmin();
  }

  // ===== Espace livreur =====
  const courierDash = document.getElementById("courierDash");
  if (courierDash && Auth && LX) {
    const user = Auth.requireAuth({ role: "courier" });
    if (!user) return;

    const Prof = window.LivrExpressProfile;
    const Geo = window.LivrExpressGeo;
    let courierProfile = Prof?.getCourierByUserId?.(user.id) || null;
    // Lier userId si fiche trouvée par email
    if (!courierProfile && Prof) {
      courierProfile =
        Prof.listCouriers(false).find(
          (c) =>
            c.email &&
            c.email.toLowerCase() === (user.email || "").toLowerCase()
        ) || null;
      if (courierProfile && !courierProfile.userId) {
        courierProfile = Prof.saveCourier({
          ...courierProfile,
          userId: user.id,
          email: user.email,
        });
      }
    }

    const hello = document.getElementById("courierHello");
    if (hello) {
      hello.textContent = (courierProfile?.name || user.name || "Livreur")
        .split(" ")[0];
    }

    let activeTrackingId = null;

    const setTxt = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };

    const refreshCourierDash = () => {
      const available = LX.listAvailableForCourier
        ? LX.listAvailableForCourier()
        : [];
      const active = LX.listActiveForCourier
        ? LX.listActiveForCourier(user.id)
        : [];
      const history = LX.listHistoryForCourier
        ? LX.listHistoryForCourier(user.id)
        : [];

      // Ne montrer en dispo que les non déjà pris par soi (ou vraiment libres)
      const availFiltered = available.filter(
        (s) =>
          !s.assignedCourierUserId || s.assignedCourierUserId === user.id
      );

      setTxt("crStatAvail", String(availFiltered.filter((s) => !s.assignedCourierUserId).length));
      setTxt("crStatActive", String(active.length));
      setTxt("crStatDone", String(history.length));
      setTxt(
        "crStatRating",
        courierProfile?.rating != null ? String(courierProfile.rating) : "—"
      );

      // Profil lecture seule
      setTxt("crProfName", courierProfile?.name || user.name || "—");
      setTxt("crProfEmail", courierProfile?.email || user.email || "—");
      setTxt("crProfPhone", courierProfile?.phone || user.phone || "—");
      setTxt("crProfVehicle", courierProfile?.vehicle || "—");
      setTxt("crProfPlate", courierProfile?.plate || "—");
      setTxt("crProfZone", courierProfile?.zone || "—");
      setTxt(
        "crProfRating",
        courierProfile?.rating != null ? `★ ${courierProfile.rating}` : "—"
      );
      setTxt(
        "crProfCount",
        String(courierProfile?.deliveriesCount ?? history.length)
      );
      setTxt("crProfBio", courierProfile?.bio || "—");
      const pub = document.getElementById("crPublicLink");
      if (pub && courierProfile?.id) {
        pub.href = `livreur.html?id=${encodeURIComponent(courierProfile.id)}`;
      }

      const availList = document.getElementById("courierAvailableList");
      if (availList) {
        const free = availFiltered.filter((s) => !s.assignedCourierUserId);
        if (!free.length) {
          availList.innerHTML =
            '<p class="dash-empty">Aucune commande disponible pour le moment.</p>';
        } else {
          availList.innerHTML = free
            .map((s) => {
              const vm = LX.viewModel(s);
              return `
              <article class="dash-card">
                <div class="dash-card__top">
                  <div>
                    <p class="dash-card__id">${s.trackingId}</p>
                    <p class="dash-card__meta">${s.plan} · ${vm.badge}</p>
                  </div>
                  <span class="track__status ${vm.statusClass || ""}">${vm.badge}</span>
                </div>
                <p class="dash-card__route">
                  <strong>De</strong> ${s.sender?.address || "—"}<br/>
                  <strong>Vers</strong> ${s.recipient?.address || "—"}<br/>
                  <strong>Dest.</strong> ${s.recipient?.name || "—"} · ${s.recipient?.phone || "—"}
                </p>
                <div class="dash-card__actions">
                  <button type="button" class="btn btn--primary btn--sm" data-claim="${s.trackingId}">
                    Activer la course
                  </button>
                  <a class="btn btn--outline btn--sm" href="suivi.html?id=${encodeURIComponent(s.trackingId)}">Carte</a>
                </div>
              </article>`;
            })
            .join("");
        }
      }

      const activeList = document.getElementById("courierActiveList");
      const mapPanel = document.getElementById("courierMapPanel");
      if (activeList) {
        if (!active.length) {
          activeList.innerHTML =
            '<p class="dash-empty">Aucune course active. Activez une commande dans l’onglet « Commandes dispo ».</p>';
          if (mapPanel) mapPanel.hidden = true;
          activeTrackingId = null;
        } else {
          activeList.innerHTML = active
            .map((s) => {
              const vm = LX.viewModel(s);
              return `
              <article class="dash-card">
                <div class="dash-card__top">
                  <div>
                    <p class="dash-card__id">${s.trackingId}</p>
                    <p class="dash-card__meta">${vm.badge} · ${s.recipient?.name || ""}</p>
                  </div>
                </div>
                <p class="dash-card__route">${s.sender?.address} → ${s.recipient?.address}</p>
                <div class="dash-card__actions">
                  <button type="button" class="btn btn--primary btn--sm" data-focus-map="${s.trackingId}">Voir sur la carte</button>
                  <button type="button" class="btn btn--outline btn--sm" data-advance-mine="${s.trackingId}">Avancer l’étape</button>
                  <button type="button" class="btn btn--primary btn--sm" data-complete="${s.trackingId}">Marquer livré</button>
                </div>
              </article>`;
            })
            .join("");
          if (!activeTrackingId) activeTrackingId = active[0].trackingId;
          if (mapPanel) mapPanel.hidden = false;
          mountCourierMap(activeTrackingId);
        }
      }

      const histList = document.getElementById("courierHistoryList");
      if (histList) {
        if (!history.length) {
          histList.innerHTML =
            '<p class="dash-empty">Aucune livraison terminée pour l’instant.</p>';
        } else {
          histList.innerHTML = history
            .map((s) => {
              const vm = LX.viewModel(s);
              return `
              <article class="dash-card">
                <div class="dash-card__top">
                  <div>
                    <p class="dash-card__id">${s.trackingId}</p>
                    <p class="dash-card__meta">${LX.formatDateTime(s.deliveredAt || s.updatedAt)}</p>
                  </div>
                  <span class="badge-status badge-status--ok">${vm.badge}</span>
                </div>
                <p class="dash-card__route">${s.sender?.address} → ${s.recipient?.address}</p>
                <div class="dash-card__actions">
                  <a class="btn btn--outline btn--sm" href="suivi.html?id=${encodeURIComponent(s.trackingId)}">Carte / suivi</a>
                  <a class="btn btn--ghost btn--sm" href="fiche.html?id=${encodeURIComponent(s.trackingId)}">Fiche PDF</a>
                </div>
              </article>`;
            })
            .join("");
        }
      }
    };

    const mountCourierMap = async (tid) => {
      if (!tid || !window.LivrExpressMap) return;
      const ship = LX.getShipment(tid);
      if (!ship) return;
      activeTrackingId = tid;
      const panel = document.getElementById("courierMapPanel");
      if (panel) panel.hidden = false;
      try {
        await window.LivrExpressMap.mountTrackingMap(ship, "courierLiveMap");
      } catch (e) {
        console.warn(e);
      }
      const markBtn = document.getElementById("crMarkDelivered");
      if (markBtn) {
        markBtn.hidden = ship.statusKey === "delivered";
        markBtn.onclick = () => {
          const res = LX.completeDeliveryByCourier(tid, user);
          if (!res.ok) alert(res.error);
          else {
            Geo?.stopCourierTracking?.(tid);
            refreshCourierDash();
          }
        };
      }
    };

    // Tabs
    courierDash.querySelectorAll(".dash-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        const key = tab.getAttribute("data-tab");
        courierDash.querySelectorAll(".dash-tab").forEach((t) =>
          t.classList.remove("is-active")
        );
        tab.classList.add("is-active");
        courierDash.querySelectorAll(".dash-panel").forEach((p) => {
          const show = p.getAttribute("data-panel") === key;
          p.hidden = !show;
          p.classList.toggle("is-active", show);
        });
      });
    });

    courierDash.addEventListener("click", (e) => {
      const claim = e.target.closest("[data-claim]");
      const focus = e.target.closest("[data-focus-map]");
      const complete = e.target.closest("[data-complete]");
      const adv = e.target.closest("[data-advance-mine]");

      if (claim) {
        const tid = claim.getAttribute("data-claim");
        const res = LX.claimShipment(tid, user, courierProfile);
        if (!res.ok) {
          alert(res.error);
          return;
        }
        // Démarrer GPS
        if (Geo?.startCourierTracking) {
          Geo.startCourierTracking(tid, (pos) => {
            const st = document.getElementById("crGpsStatus");
            if (st && pos) {
              st.hidden = false;
              st.textContent = `GPS actif · ±${Math.round(pos.accuracy || 0)} m`;
            }
          });
        }
        activeTrackingId = tid;
        refreshCourierDash();
        // basculer onglet active
        courierDash.querySelector('.dash-tab[data-tab="active"]')?.click();
        return;
      }
      if (focus) {
        mountCourierMap(focus.getAttribute("data-focus-map"));
        courierDash.querySelector('.dash-tab[data-tab="active"]')?.click();
        return;
      }
      if (complete) {
        const tid = complete.getAttribute("data-complete");
        const res = LX.completeDeliveryByCourier(tid, user);
        if (!res.ok) alert(res.error);
        else {
          Geo?.stopCourierTracking?.(tid);
          refreshCourierDash();
        }
        return;
      }
      if (adv) {
        const tid = adv.getAttribute("data-advance-mine");
        const ship = LX.getShipment(tid);
        if (ship?.assignedCourierUserId !== user.id) {
          alert("Course non assignée à vous.");
          return;
        }
        LX.advanceShipment(tid);
        refreshCourierDash();
      }
    });

    // GPS controls
    document.getElementById("crGpsStart")?.addEventListener("click", () => {
      if (!activeTrackingId) {
        alert("Aucune course active.");
        return;
      }
      const res = Geo?.startCourierTracking?.(activeTrackingId, (pos) => {
        const st = document.getElementById("crGpsStatus");
        if (st && pos) {
          st.hidden = false;
          st.textContent = `GPS téléphone service · ±${Math.round(pos.accuracy || 0)} m · ${pos.lat.toFixed(5)}, ${pos.lng.toFixed(5)}`;
        }
        window.LivrExpressMap?.getTracker?.()?.refresh(
          LX.getShipment(activeTrackingId)
        );
      });
      if (res && !res.ok) alert(res.error);
      document.getElementById("crGpsStart").hidden = true;
      document.getElementById("crGpsStop").hidden = false;
    });
    document.getElementById("crGpsStop")?.addEventListener("click", () => {
      if (activeTrackingId) Geo?.stopCourierTracking?.(activeTrackingId);
      document.getElementById("crGpsStart").hidden = false;
      document.getElementById("crGpsStop").hidden = true;
      const st = document.getElementById("crGpsStatus");
      if (st) {
        st.hidden = false;
        st.textContent = "GPS arrêté.";
      }
    });

    refreshCourierDash();
    setInterval(refreshCourierDash, 8000);
  }

  // ===== Fiche compte produit (profil.html) =====
  const accountRoot = document.getElementById("accountRoot");
  if (accountRoot && Auth && window.LivrExpressProfile) {
    const Prof = window.LivrExpressProfile;
    const me = Auth.requireAuth({});
    if (!me) return;

    const params = new URLSearchParams(window.location.search);
    let targetId = params.get("id") || me.id;
    const isOwn = targetId === me.id;
    const isStaffUser = isStaff(me);

    // Résoudre le user cible
    let baseUser = isOwn
      ? me
      : Auth.findUserById?.(targetId) ||
        Auth.getUserById?.(targetId) ||
        null;

    // Depuis mapping clients (commandes)
    if (!baseUser && LX) {
      const orders = LX.listOrderRequests({ userId: targetId });
      if (orders[0]) {
        baseUser = {
          id: targetId,
          email: orders[0].userEmail,
          name: orders[0].userName,
          phone: orders[0].sender?.phone || "",
          address: orders[0].sender?.address || "",
          role: "client",
          createdAt: orders[0].createdAt,
        };
      }
    }

    // Staff only for other accounts
    if (!isOwn && !isStaffUser) {
      targetId = me.id;
      baseUser = me;
    }

    const empty = document.getElementById("accountEmpty");
    if (!baseUser) {
      if (empty) empty.hidden = false;
      accountRoot.hidden = true;
    } else {
      if (empty) empty.hidden = true;
      accountRoot.hidden = false;

      const renderAccount = async () => {
        const profile =
          (await Prof.buildAccountProfileAsync?.(baseUser)) ||
          Prof.buildAccountProfile(baseUser);
        const tier = Prof.tierMeta(profile.clientTier);

        const set = (id, v) => {
          const el = document.getElementById(id);
          if (el) el.textContent = v;
        };

        set("accountName", profile.name || "—");
        set(
          "accountMeta",
          [profile.email, profile.phone, profile.company].filter(Boolean).join(" · ")
        );
        set(
          "accountRole",
          isOwn ? "Mon compte LivrExpress" : "Fiche client"
        );
        const tierEl = document.getElementById("accountTier");
        if (tierEl) {
          tierEl.textContent = tier.label;
          tierEl.className = `account-tier ${tier.class}`;
        }
        set("accountCity", profile.city || "Dakar");
        set("accountIdChip", `ID ${String(profile.id).slice(0, 10)}…`);

        const bioEl = document.getElementById("accountBio");
        if (bioEl) {
          if (profile.bio) {
            bioEl.hidden = false;
            bioEl.textContent = profile.bio;
          } else bioEl.hidden = true;
        }

        set("statOrders", String(profile.stats.totalOrders));
        set("statActive", String(profile.stats.active));
        set("statDelivered", String(profile.stats.delivered));
        set("statSpent", Prof.formatMoney(profile.stats.totalSpent));

        // Photo
        const img = document.getElementById("accountPhoto");
        const ini = document.getElementById("accountInitials");
        if (img && profile.photoUrl) {
          img.src = profile.photoUrl;
          img.hidden = false;
          if (ini) ini.hidden = true;
        } else {
          if (img) img.hidden = true;
          if (ini) {
            ini.hidden = false;
            ini.textContent = profile.initials || "?";
          }
        }

        const photoLabel = document.getElementById("accountPhotoLabel");
        const saveWrap = document.getElementById("accSaveWrap");
        const form = document.getElementById("accountForm");
        const canEdit = isOwn || isStaffUser;
        if (photoLabel) photoLabel.hidden = !isOwn;
        if (saveWrap) saveWrap.hidden = !canEdit;
        if (form) {
          form.querySelectorAll("input, textarea, select, button").forEach((el) => {
            if (el.id === "accEmail") return;
            if (el.type === "submit" || el.tagName === "BUTTON" || el.tagName === "A")
              return;
            el.disabled = !canEdit;
          });
        }

        // Form fields
        const fill = (id, v) => {
          const el = document.getElementById(id);
          if (el) el.value = v || "";
        };
        fill("accName", profile.name);
        fill("accPhone", profile.phone);
        fill("accEmail", profile.email);
        fill("accCity", profile.city);
        fill("accNeighborhood", profile.neighborhood);
        fill("accAddress", profile.address);
        fill("accPickup", profile.preferredPickup || profile.address);
        fill("accDropoff", profile.preferredDropoff);
        fill("accCompany", profile.company);
        fill("accPlan", profile.defaultPlan);
        fill("accBio", profile.bio);

        // Actions
        const actions = document.getElementById("accountActions");
        if (actions) {
          actions.innerHTML = isOwn
            ? `<a class="btn btn--primary btn--sm" href="espace-client.html?commander=1">Commander</a>
               <a class="btn btn--outline btn--sm" href="espace-client.html">Mon espace</a>
               <a class="btn btn--ghost btn--sm" href="suivi.html">Suivre un colis</a>`
            : `<a class="btn btn--outline btn--sm" href="admin.html">Retour admin</a>
               <a class="btn btn--ghost btn--sm" href="mailto:${profile.email}">Email</a>`;
        }

        // Zones
        const zones = document.getElementById("accountZones");
        if (zones) {
          const z = profile.zones?.length
            ? profile.zones
            : profile.neighborhood
              ? [profile.neighborhood]
              : [];
          zones.innerHTML = z.length
            ? z.map((x) => `<span class="account-chip">${x}</span>`).join("")
            : `<span class="account-card__hint">Aucune zone encore détectée</span>`;
        }

        // Activité
        const act = document.getElementById("accountActivity");
        if (act) {
          if (!profile.activity?.length) {
            act.innerHTML =
              '<p class="dash-empty">Aucune activité pour ce compte.</p>';
          } else {
            act.innerHTML = profile.activity
              .map((item) => {
                const link = item.href
                  ? `<a class="btn btn--outline btn--sm" href="${item.href}">Ouvrir</a>`
                  : "";
                return `
                <article class="account-activity__item">
                  <div>
                    <p class="account-activity__title">${item.title}</p>
                    <p class="account-activity__meta">${item.meta || ""}</p>
                    <p class="account-activity__time">${LX.formatDateTime(item.at)} · ${item.status} · ${item.plan || ""}</p>
                  </div>
                  ${link}
                </article>`;
              })
              .join("");
          }
        }
      };

      renderAccount();

      document
        .getElementById("accountPhotoInput")
        ?.addEventListener("change", async (ev) => {
          const file = ev.target.files?.[0];
          if (!file || !isOwn) return;
          try {
            const dataUrl = await Prof.fileToPhotoDataUrl(file);
            await Auth.updateProfile(me.id, { photoUrl: dataUrl });
            baseUser = Auth.getCurrentUser() || baseUser;
            await renderAccount();
          } catch (e) {
            alert(e.message || "Photo impossible");
          }
        });

      document.getElementById("accountForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!(isOwn || isStaffUser)) return;
        const err = document.getElementById("accError");
        const ok = document.getElementById("accSuccess");
        const uid = baseUser.id;
        const result = await Auth.updateProfile(uid, {
          name: document.getElementById("accName").value,
          phone: document.getElementById("accPhone").value,
          address: document.getElementById("accAddress").value,
          city: document.getElementById("accCity").value,
          neighborhood: document.getElementById("accNeighborhood").value,
          preferredPickup: document.getElementById("accPickup").value,
          preferredDropoff: document.getElementById("accDropoff").value,
          company: document.getElementById("accCompany").value,
          defaultPlan: document.getElementById("accPlan").value,
          bio: document.getElementById("accBio").value,
        });
        if (!result.ok) {
          if (err) {
            err.hidden = false;
            err.textContent = result.error;
          }
          return;
        }
        if (err) err.hidden = true;
        if (ok) {
          ok.hidden = false;
          ok.textContent =
            "Compte enregistré. Les commandes utiliseront ces infos automatiquement.";
        }
        baseUser = result.user || baseUser;
        await renderAccount();
      });
    }
  }

  // ===== Profil livreur (livreur.html) =====
  const courierRoot = document.getElementById("courierRoot");
  if (courierRoot && window.LivrExpressProfile) {
    const Prof = window.LivrExpressProfile;
    const params = new URLSearchParams(window.location.search);
    const id = params.get("id") || "";
    let courier = Prof.getCourier(id) || Prof.getCourierByName(id);
    const empty = document.getElementById("courierEmpty");

    if (!courier) {
      if (empty) empty.hidden = false;
      courierRoot.hidden = true;
    } else {
      if (empty) empty.hidden = true;
      courierRoot.hidden = false;

      const set = (i, v) => {
        const el = document.getElementById(i);
        if (el) el.textContent = v;
      };
      set("courierName", courier.name);
      set(
        "courierRating",
        `★ ${courier.rating} · ${courier.deliveriesCount} courses`
      );
      set("courierBio", courier.bio || "");
      set("courierVehicle", courier.vehicle || "—");
      set("courierPlate", courier.plate || "—");
      set("courierZone", courier.zone || "—");
      set("courierCount", String(courier.deliveriesCount || 0));
      set(
        "courierLangs",
        (courier.languages || []).join(", ") || "Français"
      );
      set(
        "courierJoined",
        courier.joinedAt
          ? LX.formatDateShort(courier.joinedAt)
          : "—"
      );

      const emoji = document.getElementById("courierAvatarEmoji");
      const photo = document.getElementById("courierPhoto");
      if (photo && courier.photoUrl) {
        photo.src = courier.photoUrl;
        photo.hidden = false;
        if (emoji) emoji.hidden = true;
      } else if (emoji) {
        emoji.textContent = courier.avatar || "🛵";
      }

      const ver = document.getElementById("courierVerified");
      if (ver) ver.hidden = !courier.verified;

      let phone = String(courier.phone || "").replace(/\D/g, "");
      if (phone.length === 9) phone = "221" + phone;
      const wa = document.getElementById("courierWa");
      const call = document.getElementById("courierCall");
      if (wa && phone) {
        wa.href = `https://wa.me/${phone}?text=${encodeURIComponent(
          "Bonjour, je vous contacte via LivrExpress concernant ma livraison."
        )}`;
      }
      if (call && phone) call.href = `tel:+${phone}`;

      const others = document.getElementById("courierOthers");
      if (others) {
        others.innerHTML = Prof.listCouriers(true)
          .filter((c) => c.id !== courier.id)
          .map(
            (c) => `
          <a class="courier-other-card" href="livreur.html?id=${encodeURIComponent(c.id)}">
            <span class="courier-other-card__av">${c.avatar || "🛵"}</span>
            <span>
              <strong>${c.name}</strong>
              <small>★ ${c.rating} · ${c.zone}</small>
            </span>
          </a>`
          )
          .join("");
      }
    }
  }

  // Splash uniquement sur la page de connexion (avant login)
  const pageName = (
    window.location.pathname.split("/").pop() || ""
  ).toLowerCase();
  const isLoginPage = pageName === "login.html";

  if (
    isLoginPage &&
    Auth &&
    typeof Auth.runSplash === "function" &&
    !Auth.getCurrentUser()
  ) {
    Auth.runSplash({ duration: 3000 }).then(() => {
      /* formulaire déjà visible sous l’overlay */
    });
  }
})();
