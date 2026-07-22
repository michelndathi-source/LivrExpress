/**
 * LivrExpress — Installation app (PWA)
 * Affiche automatiquement une invitation (le navigateur n’ouvre
 * PAS toujours le dialogue système tout seul).
 */
(function (global) {
  const DISMISS_KEY = "livrexpress_pwa_dismiss_v2";
  const DISMISS_DAYS = 3;

  let deferredPrompt = null;
  let swReady = false;

  const isStandalone = () =>
    global.matchMedia("(display-mode: standalone)").matches ||
    global.matchMedia("(display-mode: minimal-ui)").matches ||
    global.navigator.standalone === true;

  const isIOS = () =>
    /iphone|ipad|ipod/i.test(navigator.userAgent || "") ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

  const isAndroid = () => /android/i.test(navigator.userAgent || "");

  const isDismissed = () => {
    try {
      const raw = localStorage.getItem(DISMISS_KEY);
      if (!raw) return false;
      const t = parseInt(raw, 10);
      if (!t) return false;
      return Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch {
      return false;
    }
  };

  const setDismissed = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch (_) {
      /* ignore */
    }
  };

  /** SW avec chemin correct (GitHub Pages /LivrExpress/) */
  const registerSW = async () => {
    if (!("serviceWorker" in navigator)) return null;
    try {
      const base = document.querySelector("base")?.href || document.baseURI || location.href;
      const swUrl = new URL("sw.js", base).pathname;
      // Sur GitHub Pages, pathname = /LivrExpress/sw.js
      const scopeUrl = new URL("./", base).pathname;
      const reg = await navigator.serviceWorker.register(swUrl, {
        scope: scopeUrl,
      });
      await navigator.serviceWorker.ready;
      swReady = true;
      return reg;
    } catch (e) {
      // fallback relatif
      try {
        const reg = await navigator.serviceWorker.register("./sw.js", {
          scope: "./",
        });
        swReady = true;
        return reg;
      } catch (e2) {
        console.warn("SW:", e2);
        return null;
      }
    }
  };

  const ensureStyles = () => {
    if (document.getElementById("pwaInstallStyles")) return;
    const s = document.createElement("style");
    s.id = "pwaInstallStyles";
    s.textContent = `
      .pwa-fab {
        position: fixed;
        right: 0.85rem;
        bottom: calc(0.85rem + env(safe-area-inset-bottom, 0px));
        z-index: 310;
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        min-height: 2.75rem;
        padding: 0.55rem 1rem;
        border: none;
        border-radius: 999px;
        background: linear-gradient(145deg, #2563eb, #1e40af);
        color: #fff;
        font-family: inherit;
        font-size: 0.85rem;
        font-weight: 800;
        box-shadow: 0 10px 28px rgba(37, 99, 235, 0.4);
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      body.has-mobile-dock .pwa-fab {
        bottom: calc(4.6rem + env(safe-area-inset-bottom, 0px));
      }
      .pwa-fab[hidden] { display: none !important; }
      .pwa-modal {
        position: fixed; inset: 0; z-index: 520;
        display: grid; place-items: center;
        padding: 1rem;
        padding-bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
      }
      .pwa-modal[hidden] { display: none !important; }
      .pwa-modal__bd {
        position: absolute; inset: 0;
        background: rgba(15, 23, 42, 0.55);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      }
      .pwa-modal__card {
        position: relative; z-index: 1;
        width: min(100%, 22rem);
        padding: 1.4rem 1.25rem 1.2rem;
        background: #fff;
        border-radius: 20px;
        border: 1px solid #dbeafe;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.28);
        text-align: center;
      }
      .pwa-modal__icon {
        width: 4rem; height: 4rem; margin: 0 auto 0.75rem;
        display: grid; place-items: center;
        border-radius: 999px;
        background: linear-gradient(145deg, #eff6ff, #fff);
        border: 3px solid #dbeafe;
        font-size: 1.75rem;
      }
      .pwa-modal__brand {
        margin: 0 0 0.25rem;
        font-size: 0.75rem; font-weight: 800;
        letter-spacing: 0.05em; text-transform: uppercase;
        color: #64748b;
      }
      .pwa-modal__brand span { color: #2563eb; }
      .pwa-modal__title {
        margin: 0 0 0.4rem;
        font-size: 1.2rem; font-weight: 800; color: #0f172a;
      }
      .pwa-modal__text {
        margin: 0 0 0.85rem;
        font-size: 0.9rem; color: #475569; line-height: 1.45;
      }
      .pwa-modal__steps {
        text-align: left;
        margin: 0 0 1rem;
        padding: 0.75rem 0.9rem;
        background: #eff6ff;
        border-radius: 12px;
        border: 1px solid #dbeafe;
        font-size: 0.85rem;
        color: #1e293b;
        line-height: 1.5;
      }
      .pwa-modal__steps ol {
        margin: 0.35rem 0 0;
        padding-left: 1.15rem;
      }
      .pwa-modal__steps li { margin: 0.25rem 0; }
      .pwa-modal__actions {
        display: flex; flex-direction: column-reverse; gap: 0.45rem;
      }
      .pwa-modal__actions .btn { width: 100%; min-height: 2.75rem; }
      @media (min-width: 400px) {
        .pwa-modal__actions { flex-direction: row; }
        .pwa-modal__actions .btn { flex: 1; }
      }
      body.pwa-modal-open { overflow: hidden; }
    `;
    document.head.appendChild(s);
  };

  const getPlatformCopy = () => {
    if (isIOS()) {
      return {
        title: "Installer LivrExpress",
        text: "Ajoutez l’application sur l’écran d’accueil de votre iPhone.",
        stepsHtml: `
          <strong>Sur iPhone (Safari) :</strong>
          <ol>
            <li>Appuyez sur le bouton <strong>Partager</strong> ⎋ en bas</li>
            <li>Choisissez <strong>« Sur l’écran d’accueil »</strong></li>
            <li>Validez avec <strong>Ajouter</strong></li>
          </ol>`,
        primary: "J’ai compris",
        useNative: false,
      };
    }
    if (deferredPrompt) {
      return {
        title: "Installer LivrExpress",
        text: "Installez l’app sur votre téléphone pour un accès rapide, comme une application.",
        stepsHtml: `
          <strong>En un clic :</strong>
          <ol>
            <li>Appuyez sur <strong>Installer</strong> ci-dessous</li>
            <li>Confirmez dans la fenêtre de votre navigateur</li>
          </ol>`,
        primary: "Installer l’application",
        useNative: true,
      };
    }
    // Android / Chrome sans event encore (ou autre)
    return {
      title: "Installer LivrExpress",
      text: "Ajoutez LivrExpress sur l’écran d’accueil de votre téléphone.",
      stepsHtml: isAndroid()
        ? `
          <strong>Sur Android (Chrome) :</strong>
          <ol>
            <li>Appuyez sur le menu <strong>⋮</strong> en haut à droite</li>
            <li>Choisissez <strong>« Installer l’application »</strong>
              ou <strong>« Ajouter à l’écran d’accueil »</strong></li>
            <li>Confirmez <strong>Installer</strong></li>
          </ol>`
        : `
          <strong>Dans votre navigateur :</strong>
          <ol>
            <li>Ouvrez le menu du navigateur</li>
            <li>Choisissez <strong>Installer</strong> / <strong>Ajouter à l’écran d’accueil</strong></li>
          </ol>`,
      primary: "Voir comment faire",
      useNative: false,
    };
  };

  const hideModal = () => {
    const m = document.getElementById("pwaInstallModal");
    if (m) m.hidden = true;
    document.body.classList.remove("pwa-modal-open");
  };

  const showModal = (force = false) => {
    if (isStandalone()) return;
    if (!force && isDismissed()) return;

    ensureStyles();
    let modal = document.getElementById("pwaInstallModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "pwaInstallModal";
      modal.className = "pwa-modal";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "pwaModalTitle");
      modal.innerHTML = `
        <div class="pwa-modal__bd" data-pwa-close></div>
        <div class="pwa-modal__card">
          <div class="pwa-modal__icon" aria-hidden="true">📲</div>
          <p class="pwa-modal__brand">Livr<span>Express</span></p>
          <h2 class="pwa-modal__title" id="pwaModalTitle">Installer l’app</h2>
          <p class="pwa-modal__text" id="pwaModalText"></p>
          <div class="pwa-modal__steps" id="pwaModalSteps"></div>
          <div class="pwa-modal__actions">
            <button type="button" class="btn btn--ghost" id="pwaModalLater">Plus tard</button>
            <button type="button" class="btn btn--primary" id="pwaModalInstall">Installer</button>
          </div>
        </div>`;
      document.body.appendChild(modal);

      modal.querySelector("[data-pwa-close]")?.addEventListener("click", () => {
        setDismissed();
        hideModal();
      });
      modal.querySelector("#pwaModalLater")?.addEventListener("click", () => {
        setDismissed();
        hideModal();
      });
    }

    const copy = getPlatformCopy();
    modal.querySelector("#pwaModalTitle").textContent = copy.title;
    modal.querySelector("#pwaModalText").textContent = copy.text;
    modal.querySelector("#pwaModalSteps").innerHTML = copy.stepsHtml;
    const btn = modal.querySelector("#pwaModalInstall");
    btn.textContent = copy.primary;

    btn.onclick = async () => {
      if (copy.useNative && deferredPrompt) {
        try {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
        } catch (_) {
          /* ignore */
        }
        deferredPrompt = null;
        hideModal();
        return;
      }
      // iOS / instructions : garder ouvert un peu ou fermer
      if (isIOS()) {
        setDismissed();
        hideModal();
        return;
      }
      // Réessayer le prompt si disponible
      if (deferredPrompt) {
        try {
          deferredPrompt.prompt();
          await deferredPrompt.userChoice;
        } catch (_) {
          /* ignore */
        }
        deferredPrompt = null;
      }
      setDismissed();
      hideModal();
    };

    modal.hidden = false;
    document.body.classList.add("pwa-modal-open");
  };

  const ensureFab = () => {
    if (isStandalone()) return;
    ensureStyles();
    let fab = document.getElementById("pwaInstallFab");
    if (!fab) {
      fab = document.createElement("button");
      fab.type = "button";
      fab.id = "pwaInstallFab";
      fab.className = "pwa-fab";
      fab.innerHTML = "📲 Installer l’app";
      fab.setAttribute("aria-label", "Installer LivrExpress");
      fab.addEventListener("click", () => showModal(true));
      document.body.appendChild(fab);
    }
    fab.hidden = false;
  };

  // Event natif Android / Chrome / Edge
  global.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Mettre à jour le modal s’il est ouvert
    if (document.getElementById("pwaInstallModal") && !document.getElementById("pwaInstallModal").hidden) {
      showModal(true);
    }
  });

  global.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideModal();
    const fab = document.getElementById("pwaInstallFab");
    if (fab) fab.hidden = true;
  });

  const boot = async () => {
    if (isStandalone()) {
      document.documentElement.classList.add("pwa-standalone");
      document.body.classList.add("pwa-standalone");
      return;
    }

    await registerSW();

    // FAB toujours dispo
    ensureFab();

    // Invitation automatique (le navigateur ne le fait pas seul)
    // Petit délai pour laisser la page charger
    setTimeout(() => {
      if (isStandalone()) return;
      showModal(false);
    }, 1200);
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.LivrExpressPWA = {
    registerSW,
    isStandalone,
    showInstallBanner: () => showModal(true),
    showInstallModal: () => showModal(true),
  };
})(typeof window !== "undefined" ? window : globalThis);
