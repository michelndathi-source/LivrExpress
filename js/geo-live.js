/**
 * LivrExpress — Géolocalisation live (GPS téléphone)
 * - Livreur : position du téléphone de service
 * - Client : position GPS par défaut OU adresse choisie
 */
(function (global) {
  const GPS_STORE = "livrexpress_live_gps_v1";
  const WATCH_OPTS = {
    enableHighAccuracy: true,
    maximumAge: 5000,
    timeout: 20000,
  };

  const isSupported = () =>
    typeof navigator !== "undefined" && "geolocation" in navigator;

  const readStore = () => {
    try {
      return JSON.parse(localStorage.getItem(GPS_STORE) || "{}") || {};
    } catch {
      return {};
    }
  };

  const writeStore = (map) => {
    try {
      localStorage.setItem(GPS_STORE, JSON.stringify(map));
      global.dispatchEvent(
        new CustomEvent("livrexpress:gps", { detail: { map } })
      );
    } catch (e) {
      console.warn("GPS store:", e);
    }
  };

  /** Position courante (une fois) — options.skipPrompt pour éviter le double popup */
  const getCurrentPosition = (options = {}) =>
    new Promise(async (resolve, reject) => {
      if (!isSupported()) {
        reject(new Error("Géolocalisation non supportée sur cet appareil."));
        return;
      }
      if (!options.skipPrompt && global.LivrExpressPerm?.requestGeolocation) {
        const r = await global.LivrExpressPerm.requestGeolocation(
          options.variant || "geolocation"
        );
        if (!r.ok) {
          reject(
            new Error(
              r.reason === "dismissed"
                ? "Localisation non activée."
                : "GPS indisponible."
            )
          );
          return;
        }
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          resolve({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            at: new Date().toISOString(),
            source: "gps",
          });
        },
        (err) => {
          const msgs = {
            1: "Permission de localisation refusée. Autorisez le GPS dans les réglages.",
            2: "Position indisponible. Activez le GPS / le réseau.",
            3: "Délai dépassé pour obtenir la position.",
          };
          reject(new Error(msgs[err.code] || err.message || "Erreur GPS"));
        },
        WATCH_OPTS
      );
    });

  /** Reverse geocode simple (Nominatim) */
  const reverseGeocode = async (lat, lng) => {
    try {
      const url = new URL("https://nominatim.openstreetmap.org/reverse");
      url.searchParams.set("lat", String(lat));
      url.searchParams.set("lon", String(lng));
      url.searchParams.set("format", "json");
      url.searchParams.set("zoom", "17");
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      return (
        data.display_name ||
        data.address?.road ||
        `${lat.toFixed(5)}, ${lng.toFixed(5)}`
      );
    } catch {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
  };

  /**
   * Capturer la position client pour une livraison
   * @returns {{ lat, lng, accuracy, label, source, at }}
   */
  const captureClientGps = async (options = {}) => {
    const pos = await getCurrentPosition(options);
    const label = await reverseGeocode(pos.lat, pos.lng);
    return {
      ...pos,
      label: label || "Ma position GPS",
      source: "gps",
    };
  };

  // —— Positions live par trackingId ——
  const getLiveGps = (trackingId) => {
    if (!trackingId) return null;
    const map = readStore();
    return map[trackingId] || null;
  };

  const setLiveGps = (trackingId, payload) => {
    if (!trackingId) return null;
    const map = readStore();
    const prev = map[trackingId] || {};
    map[trackingId] = {
      ...prev,
      ...payload,
      trackingId,
      updatedAt: new Date().toISOString(),
    };
    writeStore(map);

    // Miroir sur le shipment (local + Supabase)
    const LX = global.LivrExpress;
    if (LX?.getShipment && LX?.saveShipment) {
      const ship = LX.getShipment(trackingId);
      if (ship) {
        ship.locations = ship.locations || {};
        if (payload.courier) ship.locations.courier = payload.courier;
        if (payload.client) ship.locations.clientLive = payload.client;
        if (payload.delivery) ship.locations.delivery = payload.delivery;
        if (payload.pickup) ship.locations.pickup = payload.pickup;
        ship.updatedAt = new Date().toISOString();
        LX.saveShipment(ship);
      }
    }

    // Sync Supabase jsonb locations
    const SB = global.LivrExpressSB;
    if (SB?.isEnabled?.()) {
      const sb = SB.getClient?.();
      if (sb) {
        const live = map[trackingId];
        sb.from("shipments")
          .update({
            locations: {
              courier: live.courier || null,
              clientLive: live.client || null,
              pickup: live.pickup || null,
              delivery: live.delivery || null,
            },
            updated_at: new Date().toISOString(),
          })
          .eq("tracking_id", trackingId)
          .then(({ error }) => {
            if (error) console.warn("GPS supabase:", error.message);
          });
      }
    }

    return map[trackingId];
  };

  // Watches actifs (courier GPS)
  const watches = new Map(); // trackingId -> watchId

  /**
   * Démarre le partage GPS du téléphone livreur pour un colis
   */
  const startCourierTracking = async (trackingId, onUpdate) => {
    if (!isSupported()) {
      return { ok: false, error: "GPS non supporté." };
    }
    if (!trackingId) return { ok: false, error: "N° de suivi manquant." };

    // Popup design avant permission native
    if (global.LivrExpressPerm?.requestGeolocation) {
      const r = await global.LivrExpressPerm.requestGeolocation("courier");
      if (!r.ok) {
        return { ok: false, error: "Activation GPS reportée." };
      }
    }

    stopCourierTracking(trackingId);

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const courier = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          at: new Date().toISOString(),
          source: "courier_phone",
        };
        setLiveGps(trackingId, { courier });
        if (typeof onUpdate === "function") onUpdate(courier);
      },
      (err) => {
        console.warn("Courier GPS:", err);
        if (typeof onUpdate === "function") {
          onUpdate(null, err);
        }
      },
      WATCH_OPTS
    );

    watches.set(trackingId, watchId);
    return { ok: true, watchId };
  };

  const stopCourierTracking = (trackingId) => {
    if (trackingId && watches.has(trackingId)) {
      navigator.geolocation.clearWatch(watches.get(trackingId));
      watches.delete(trackingId);
      return;
    }
    // stop all
    watches.forEach((id) => navigator.geolocation.clearWatch(id));
    watches.clear();
  };

  const isCourierTracking = (trackingId) => watches.has(trackingId);

  /**
   * Partage ponctuel / suivi léger de la position client (optionnel pendant livraison)
   */
  const startClientTracking = async (trackingId, onUpdate) => {
    if (!isSupported() || !trackingId) {
      return { ok: false, error: "GPS indisponible." };
    }
    if (global.LivrExpressPerm?.requestGeolocation) {
      const r = await global.LivrExpressPerm.requestGeolocation("geolocation");
      if (!r.ok) return { ok: false, error: "Localisation non activée." };
    }
    const key = `client:${trackingId}`;
    if (watches.has(key)) {
      navigator.geolocation.clearWatch(watches.get(key));
    }
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        const client = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: new Date().toISOString(),
          source: "client_phone",
        };
        setLiveGps(trackingId, { client });
        if (typeof onUpdate === "function") onUpdate(client);
      },
      (err) => console.warn("Client GPS:", err),
      { ...WATCH_OPTS, maximumAge: 15000 }
    );
    watches.set(key, watchId);
    return { ok: true };
  };

  const stopClientTracking = (trackingId) => {
    const key = `client:${trackingId}`;
    if (watches.has(key)) {
      navigator.geolocation.clearWatch(watches.get(key));
      watches.delete(key);
    }
  };

  /**
   * Construit l’objet locations pour une commande
   */
  const buildLocationsPayload = ({
    pickupMode, // 'gps' | 'address'
    pickupGps,
    pickupAddress,
    deliveryMode, // 'gps' | 'address'
    deliveryGps,
    deliveryAddress,
  }) => {
    const locations = {};
    if (pickupMode === "gps" && pickupGps) {
      locations.pickup = {
        lat: pickupGps.lat,
        lng: pickupGps.lng,
        accuracy: pickupGps.accuracy,
        label: pickupGps.label || "Position GPS départ",
        source: "gps",
        at: pickupGps.at,
      };
    } else if (pickupAddress) {
      locations.pickup = {
        label: pickupAddress,
        source: "address",
      };
    }
    if (deliveryMode === "gps" && deliveryGps) {
      locations.delivery = {
        lat: deliveryGps.lat,
        lng: deliveryGps.lng,
        accuracy: deliveryGps.accuracy,
        label: deliveryGps.label || "Position GPS client",
        source: "gps",
        at: deliveryGps.at,
      };
    } else if (deliveryAddress) {
      locations.delivery = {
        label: deliveryAddress,
        source: "address",
      };
    }
    return locations;
  };

  /**
   * Résout un point de destination pour la carte
   * (GPS enregistré > adresse géocodée)
   */
  const resolvePoint = async (loc, fallbackAddress) => {
    if (loc && typeof loc.lat === "number" && typeof loc.lng === "number") {
      return {
        lat: loc.lat,
        lng: loc.lng,
        label: loc.label || "Position GPS",
        source: loc.source || "gps",
      };
    }
    const addr = loc?.label || fallbackAddress || "Dakar";
    if (global.LivrExpressMap?.geocode) {
      const g = await global.LivrExpressMap.geocode(addr);
      return { ...g, source: "address" };
    }
    return { lat: 14.7167, lng: -17.4677, label: addr, source: "fallback" };
  };

  global.LivrExpressGeo = {
    isSupported,
    getCurrentPosition,
    reverseGeocode,
    captureClientGps,
    getLiveGps,
    setLiveGps,
    startCourierTracking,
    stopCourierTracking,
    isCourierTracking,
    startClientTracking,
    stopClientTracking,
    buildLocationsPayload,
    resolvePoint,
  };
})(typeof window !== "undefined" ? window : globalThis);
