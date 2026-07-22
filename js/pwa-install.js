/**
 * LivrExpress — Installer l’app (même logique que la-restauration / Teranga)
 * Bannière bas d’écran + Installer (Android/Chrome) / consignes iOS Safari
 */
(function (global) {
  let deferredPrompt = null;
  let installed = false;
  let dismissed = false;
  let showIosHint = false;

  const isStandalone = () =>
    global.matchMedia("(display-mode: standalone)").matches ||
    global.matchMedia("(display-mode: minimal-ui)").matches ||
    ("standalone" in navigator &&
      /** @type {Navigator & { standalone?: boolean }} */ (navigator)
        .standalone === true);

  const isIosSafari = () => {
    const ua = navigator.userAgent || "";
    const ios = /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|Chrome|Android/.test(ua);
    // iOS Chrome etc. : encore afficher l’aide « écran d’accueil »
    return ios;
  };

  /** Enregistre le SW (chemins relatifs pour GitHub Pages) */
  const registerSW = () => {
    if (!("serviceWorker" in navigator)) return;
    try {
      const base = document.baseURI || location.href;
      const swUrl = new URL("sw.js", base).href;
      const scope = new URL("./", base).href;
      navigator.serviceWorker.register(swUrl, { scope }).catch(() => {
        navigator.serviceWorker.register("./sw.js", { scope: "./" }).catch(() => {});
      });
    } catch (_) {
      navigator.serviceWorker.register("./sw.js").catch(() => {});
    }
  };

  const iconSrc = (() => {
    try {
      return new URL("images/icon-192.png", document.baseURI || location.href).href;
    } catch {
      return "images/icon-192.png";
    }
  })();

  const ensureStyles = () => {
    if (document.getElementById("pwaTerangaStyles")) return;
    const s = document.createElement("style");
    s.id = "pwaTerangaStyles";
    s.textContent = `
      .pwa-banner {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 400;
        padding: 1rem;
        padding-bottom: max(1rem, env(safe-area-inset-bottom, 0px));
        pointer-events: none;
      }
      body.has-mobile-dock .pwa-banner {
        bottom: calc(3.85rem + env(safe-area-inset-bottom, 0px));
        padding-bottom: 0.75rem;
      }
      .pwa-banner[hidden] { display: none !important; }
      .pwa-banner__card {
        pointer-events: auto;
        margin: 0 auto;
        max-width: 32rem;
        display: flex;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 0.85rem;
        border-radius: 1rem;
        border: 1px solid rgba(37, 99, 235, 0.18);
        background: rgba(255, 255, 255, 0.97);
        box-shadow: 0 18px 50px rgba(15, 23, 42, 0.18);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
      }
      .pwa-banner__icon {
        width: 3rem;
        height: 3rem;
        border-radius: 0.75rem;
        object-fit: cover;
        flex-shrink: 0;
        background: #eff6ff;
        border: 1px solid #dbeafe;
      }
      .pwa-banner__body {
        min-width: 0;
        flex: 1 1 auto;
      }
      .pwa-banner__title {
        margin: 0;
        font-size: 0.875rem;
        font-weight: 800;
        color: #0f172a;
        line-height: 1.25;
      }
      .pwa-banner__text {
        margin: 0.15rem 0 0;
        font-size: 0.75rem;
        font-weight: 500;
        color: #64748b;
        line-height: 1.35;
      }
      .pwa-banner__install {
        flex-shrink: 0;
        appearance: none;
        border: none;
        border-radius: 999px;
        background: linear-gradient(145deg, #2563eb, #1d4ed8);
        color: #fff;
        font-family: inherit;
        font-size: 0.75rem;
        font-weight: 800;
        padding: 0.55rem 1rem;
        min-height: 2.35rem;
        cursor: pointer;
        box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
        -webkit-tap-highlight-color: transparent;
      }
      .pwa-banner__install:active {
        transform: scale(0.98);
      }
      .pwa-banner__close {
        flex-shrink: 0;
        appearance: none;
        border: none;
        background: transparent;
        color: #94a3b8;
        font-size: 0.95rem;
        font-weight: 700;
        padding: 0.35rem 0.45rem;
        border-radius: 999px;
        cursor: pointer;
        line-height: 1;
      }
      .pwa-banner__close:hover {
        color: #0f172a;
        background: #f1f5f9;
      }
    `;
    document.head.appendChild(s);
  };

  const shouldShow = () => {
    if (installed || dismissed || isStandalone()) return false;
    return Boolean(deferredPrompt) || showIosHint;
  };

  const render = () => {
    ensureStyles();
    let root = document.getElementById("pwaInstallBanner");
    if (!shouldShow()) {
      if (root) root.hidden = true;
      return;
    }

    if (!root) {
      root = document.createElement("div");
      root.id = "pwaInstallBanner";
      root.className = "pwa-banner";
      root.setAttribute("role", "dialog");
      root.setAttribute("aria-label", "Installer l’application");
      document.body.appendChild(root);
    }

    const iosOnly = showIosHint && !deferredPrompt;
    root.hidden = false;
    root.innerHTML = `
      <div class="pwa-banner__card">
        <img class="pwa-banner__icon" src="${iconSrc}" alt="" width="48" height="48" />
        <div class="pwa-banner__body">
          <p class="pwa-banner__title">Accès rapide LivrExpress</p>
          <p class="pwa-banner__text">
            ${
              iosOnly
                ? "Ajoutez LivrExpress à l’écran d’accueil (Partager → Sur l’écran d’accueil)"
                : "Ajoutez LivrExpress à l’écran d’accueil pour commander et suivre plus vite"
            }
          </p>
        </div>
        ${
          deferredPrompt
            ? `<button type="button" class="pwa-banner__install" id="pwaInstallBtn">Installer</button>`
            : ""
        }
        <button type="button" class="pwa-banner__close" id="pwaDismissBtn" aria-label="Fermer">✕</button>
      </div>`;

    root.querySelector("#pwaInstallBtn")?.addEventListener("click", async () => {
      if (!deferredPrompt) return;
      try {
        await deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === "accepted") {
          installed = true;
        }
      } catch (_) {
        /* ignore */
      }
      deferredPrompt = null;
      render();
    });

    root.querySelector("#pwaDismissBtn")?.addEventListener("click", () => {
      dismissed = true;
      render();
    });
  };

  const boot = () => {
    if (isStandalone()) {
      installed = true;
      document.documentElement.classList.add("pwa-standalone");
      document.body.classList.add("pwa-standalone");
      return;
    }

    registerSW();

    global.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      deferredPrompt = e;
      render();
    });

    global.addEventListener("appinstalled", () => {
      installed = true;
      deferredPrompt = null;
      render();
    });

    // iOS : afficher la bannière d’aide (comme Teranga)
    if (isIosSafari() && !isStandalone()) {
      showIosHint = true;
      render();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.LivrExpressPWA = {
    isStandalone,
    showInstallBanner: () => {
      dismissed = false;
      if (isIosSafari()) showIosHint = true;
      render();
    },
  };
})(typeof window !== "undefined" ? window : globalThis);
