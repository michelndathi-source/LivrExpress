/**
 * LivrExpress — PWA installable (Ajouter à l’écran d’accueil)
 * + enregistrement Service Worker pour mode app hors-ligne léger
 */
(function (global) {
  const DISMISS_KEY = "livrexpress_pwa_install_dismiss_v1";

  const isStandalone = () =>
    global.matchMedia("(display-mode: standalone)").matches ||
    global.navigator.standalone === true;

  const registerSW = async () => {
    if (!("serviceWorker" in navigator)) return null;
    try {
      // scope relatif pour GitHub Pages (/LivrExpress/)
      const reg = await navigator.serviceWorker.register("./sw.js", {
        scope: "./",
      });
      return reg;
    } catch (e) {
      console.warn("SW register:", e);
      return null;
    }
  };

  let deferredPrompt = null;

  const hideBanner = () => {
    const el = document.getElementById("pwaInstallBanner");
    if (el) el.hidden = true;
  };

  const showBanner = () => {
    if (isStandalone()) return;
    if (sessionStorage.getItem(DISMISS_KEY) === "1") return;
    // iOS n’a pas beforeinstallprompt — afficher aide manuelle
    const isIOS =
      /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    const canNative = Boolean(deferredPrompt);

    let banner = document.getElementById("pwaInstallBanner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "pwaInstallBanner";
      banner.className = "pwa-install";
      banner.innerHTML = `
        <div class="pwa-install__card">
          <div class="pwa-install__icon" aria-hidden="true">📲</div>
          <div class="pwa-install__body">
            <p class="pwa-install__title">Installer LivrExpress</p>
            <p class="pwa-install__text" id="pwaInstallText">
              Ajoutez l’app sur votre écran d’accueil pour un usage plus rapide.
            </p>
          </div>
          <div class="pwa-install__actions">
            <button type="button" class="btn btn--primary btn--sm" id="pwaInstallBtn">Installer</button>
            <button type="button" class="btn btn--ghost btn--sm" id="pwaInstallDismiss">Plus tard</button>
          </div>
        </div>`;
      document.body.appendChild(banner);
    }

    banner.hidden = false;
    const text = banner.querySelector("#pwaInstallText");
    const installBtn = banner.querySelector("#pwaInstallBtn");

    if (isIOS && !canNative) {
      if (text) {
        text.textContent =
          "Sur iPhone : partage → « Sur l’écran d’accueil » pour installer l’app.";
      }
      if (installBtn) {
        installBtn.textContent = "Compris";
        installBtn.onclick = () => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          hideBanner();
        };
      }
    } else if (canNative) {
      if (text) {
        text.textContent =
          "Installez LivrExpress comme une vraie application sur votre téléphone.";
      }
      if (installBtn) {
        installBtn.textContent = "Installer";
        installBtn.onclick = async () => {
          hideBanner();
          deferredPrompt.prompt();
          try {
            await deferredPrompt.userChoice;
          } catch (_) {
            /* ignore */
          }
          deferredPrompt = null;
        };
      }
    } else {
      // Chrome sans prompt encore — message générique
      if (text) {
        text.textContent =
          "Menu navigateur (⋮) → « Installer l’application » ou « Ajouter à l’écran d’accueil ».";
      }
      if (installBtn) {
        installBtn.textContent = "OK";
        installBtn.onclick = () => {
          sessionStorage.setItem(DISMISS_KEY, "1");
          hideBanner();
        };
      }
    }

    banner.querySelector("#pwaInstallDismiss")?.addEventListener(
      "click",
      () => {
        sessionStorage.setItem(DISMISS_KEY, "1");
        hideBanner();
      },
      { once: true }
    );
  };

  // beforeinstallprompt (Android / Chrome / Edge)
  global.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Délai pour ne pas gêner le premier paint
    setTimeout(showBanner, 1800);
  });

  global.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    hideBanner();
  });

  // Boot
  const boot = () => {
    registerSW();
    // iOS / navigateurs sans event : proposer après un délai si pas installé
    setTimeout(() => {
      if (isStandalone()) return;
      const isIOS =
        /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
      if (isIOS || !deferredPrompt) {
        // ne pas spammer : une fois par session max déjà géré
        if (isIOS) showBanner();
      }
    }, 4000);

    // Classe utilitaire pour styles standalone
    if (isStandalone()) {
      document.documentElement.classList.add("pwa-standalone");
      document.body.classList.add("pwa-standalone");
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  global.LivrExpressPWA = {
    registerSW,
    isStandalone,
    showInstallBanner: showBanner,
  };
})(typeof window !== "undefined" ? window : globalThis);
