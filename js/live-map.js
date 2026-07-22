/**
 * LivrExpress — Carte de suivi en direct (Leaflet + OpenStreetMap)
 * Géocodage quartiers Dakar, itinéraire route, animation live du colis.
 */
(function (global) {
  /** Points de repère Dakar (lat, lng) */
  const DAKAR_PLACES = {
    plateau: { lat: 14.6682, lng: -17.4381, label: "Plateau" },
    medina: { lat: 14.6809, lng: -17.4495, label: "Médina" },
    almadies: { lat: 14.7395, lng: -17.5256, label: "Almadies" },
    ouakam: { lat: 14.7228, lng: -17.4905, label: "Ouakam" },
    ngor: { lat: 14.748, lng: -17.5145, label: "Ngor" },
    yoff: { lat: 14.7535, lng: -17.473, label: "Yoff" },
    parcelles: { lat: 14.7645, lng: -17.4355, label: "Parcelles Assainies" },
    "parcelles assainies": { lat: 14.7645, lng: -17.4355, label: "Parcelles Assainies" },
    grand: { lat: 14.715, lng: -17.455, label: "Grand Yoff" },
    "grand yoff": { lat: 14.715, lng: -17.455, label: "Grand Yoff" },
    liberte: { lat: 14.7165, lng: -17.462, label: "Liberté 6" },
    "liberte 6": { lat: 14.7165, lng: -17.462, label: "Liberté 6" },
    "liberté": { lat: 14.7165, lng: -17.462, label: "Liberté 6" },
    "point e": { lat: 14.6935, lng: -17.4665, label: "Point E" },
    fann: { lat: 14.6905, lng: -17.4685, label: "Fann" },
    mermoz: { lat: 14.707, lng: -17.473, label: "Mermoz" },
    sacré: { lat: 14.72, lng: -17.468, label: "Sacré-Cœur" },
    "sacre coeur": { lat: 14.72, lng: -17.468, label: "Sacré-Cœur" },
    hilaire: { lat: 14.72, lng: -17.468, label: "Sacré-Cœur" },
    dieuppeul: { lat: 14.728, lng: -17.45, label: "Dieuppeul" },
    derkle: { lat: 14.735, lng: -17.442, label: "Derklé" },
    "hlm": { lat: 14.732, lng: -17.445, label: "HLM" },
    pikine: { lat: 14.7548, lng: -17.3985, label: "Pikine" },
    guediawaye: { lat: 14.776, lng: -17.395, label: "Guédiawaye" },
    thiaroye: { lat: 14.745, lng: -17.365, label: "Thiaroye" },
    bargny: { lat: 14.692, lng: -17.233, label: "Bargny" },
    rufisque: { lat: 14.7167, lng: -17.2667, label: "Rufisque" },
    camberene: { lat: 14.768, lng: -17.43, label: "Cambérène" },
    patte: { lat: 14.745, lng: -17.458, label: "Patte d'Oie" },
    "patte d'oie": { lat: 14.745, lng: -17.458, label: "Patte d'Oie" },
    "cite keur": { lat: 14.78, lng: -17.38, label: "Cité Keur Gorgui" },
    mamelles: { lat: 14.732, lng: -17.515, label: "Les Mamelles" },
    virage: { lat: 14.74, lng: -17.51, label: "Virage" },
    corniche: { lat: 14.685, lng: -17.47, label: "Corniche Ouest" },
    airport: { lat: 14.7397, lng: -17.4902, label: "AIBD / Yoff" },
    aibd: { lat: 14.67, lng: -17.073, label: "AIBD" },
    hub: { lat: 14.6925, lng: -17.4465, label: "Hub LivrExpress · Plateau" },
    "hub livexpress": { lat: 14.6925, lng: -17.4465, label: "Hub LivrExpress · Plateau" },
    dakar: { lat: 14.7167, lng: -17.4677, label: "Dakar" },
  };

  const HUB = DAKAR_PLACES.hub;
  const GEO_CACHE_KEY = "livrexpress_geo_cache_v1";
  const DEFAULT_CENTER = { lat: 14.7167, lng: -17.4677 };

  const haversineKm = (a, b) => {
    const R = 6371;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const la1 = toRad(a.lat);
    const la2 = toRad(b.lat);
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  };

  const readGeoCache = () => {
    try {
      return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  };

  const writeGeoCache = (cache) => {
    try {
      localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
    } catch (_) {
      /* ignore */
    }
  };

  const normalizeAddress = (address) =>
    String(address || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9\s']/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  /** Résolution locale rapide (quartiers Dakar) */
  const resolveLocalPlace = (address) => {
    const n = normalizeAddress(address);
    if (!n) return null;
    // match exact / partial keys (longest first)
    const keys = Object.keys(DAKAR_PLACES).sort((a, b) => b.length - a.length);
    for (const key of keys) {
      if (n.includes(key)) {
        const p = DAKAR_PLACES[key];
        return { lat: p.lat, lng: p.lng, label: p.label, source: "local" };
      }
    }
    return null;
  };

  /** Géocodage Nominatim (fallback, avec cache) */
  const geocodeRemote = async (address) => {
    const q = String(address || "").trim();
    if (!q) return null;
    const cache = readGeoCache();
    const key = normalizeAddress(q);
    if (cache[key]) return { ...cache[key], source: "cache" };

    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("q", `${q}, Dakar, Senegal`);
      url.searchParams.set("format", "json");
      url.searchParams.set("limit", "1");
      url.searchParams.set("countrycodes", "sn");
      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return null;
      const data = await res.json();
      if (!data || !data[0]) return null;
      const point = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        label: data[0].display_name?.split(",")[0] || q,
        source: "nominatim",
      };
      cache[key] = { lat: point.lat, lng: point.lng, label: point.label };
      writeGeoCache(cache);
      return point;
    } catch {
      return null;
    }
  };

  const geocode = async (address) => {
    const local = resolveLocalPlace(address);
    if (local) return local;
    const remote = await geocodeRemote(address);
    if (remote) return remote;
    // fallback centre Dakar + léger offset déterministe
    const h = Array.from(String(address || "x")).reduce(
      (a, c) => a + c.charCodeAt(0),
      0
    );
    return {
      lat: DEFAULT_CENTER.lat + ((h % 20) - 10) * 0.002,
      lng: DEFAULT_CENTER.lng + ((h % 17) - 8) * 0.002,
      label: address || "Dakar",
      source: "fallback",
    };
  };

  /** Interpolation linéaire sur une polyline [ [lat,lng], ... ] */
  const pointAlongPath = (path, t) => {
    if (!path || path.length === 0) return DEFAULT_CENTER;
    if (path.length === 1) return { lat: path[0][0], lng: path[0][1] };
    const clamped = Math.max(0, Math.min(1, t));
    // distances cumulées
    const segLens = [];
    let total = 0;
    for (let i = 1; i < path.length; i++) {
      const d = haversineKm(
        { lat: path[i - 1][0], lng: path[i - 1][1] },
        { lat: path[i][0], lng: path[i][1] }
      );
      segLens.push(d);
      total += d;
    }
    if (total <= 0) return { lat: path[0][0], lng: path[0][1] };
    let target = clamped * total;
    for (let i = 0; i < segLens.length; i++) {
      if (target <= segLens[i] || i === segLens.length - 1) {
        const ratio = segLens[i] > 0 ? target / segLens[i] : 0;
        const a = path[i];
        const b = path[i + 1];
        return {
          lat: a[0] + (b[0] - a[0]) * ratio,
          lng: a[1] + (b[1] - a[1]) * ratio,
        };
      }
      target -= segLens[i];
    }
    const last = path[path.length - 1];
    return { lat: last[0], lng: last[1] };
  };

  const pathLengthKm = (path) => {
    let total = 0;
    for (let i = 1; i < (path || []).length; i++) {
      total += haversineKm(
        { lat: path[i - 1][0], lng: path[i - 1][1] },
        { lat: path[i][0], lng: path[i][1] }
      );
    }
    return total;
  };

  /** Progression 0–1 selon le statut pipeline */
  const statusProgress = (statusKey) => {
    const map = {
      confirmed: 0.02,
      prepared: 0.08,
      picked: 0.28,
      transit: 0.52,
      delivery: 0.78,
      delivered: 1,
    };
    return map[statusKey] != null ? map[statusKey] : 0.1;
  };

  /**
   * Progression live fine : avance lentement dans la plage du statut
   * (animation continue entre les jalons).
   */
  const liveProgress = (shipment) => {
    const base = statusProgress(shipment.statusKey);
    if (shipment.statusKey === "delivered") return 1;
    if (shipment.statusKey === "confirmed" || shipment.statusKey === "prepared") {
      return base;
    }
    // avance cyclique légère dans une fenêtre selon updatedAt
    const nextMap = {
      picked: 0.5,
      transit: 0.75,
      delivery: 0.98,
    };
    const ceiling = nextMap[shipment.statusKey] || base + 0.15;
    const updated = new Date(shipment.updatedAt || shipment.createdAt || Date.now()).getTime();
    const elapsedMin = (Date.now() - updated) / 60000;
    // ~12 min pour parcourir la fenêtre de statut
    const windowSpan = Math.max(0.02, ceiling - base);
    const t = Math.min(1, Math.max(0, elapsedMin / 12));
    // oscillation douce pour effet "en mouvement"
    const pulse = Math.sin(Date.now() / 4000) * 0.012;
    return Math.min(ceiling, base + windowSpan * t + pulse);
  };

  /** Itinéraire OSRM (routes réelles) avec fallback ligne brisée via hub */
  const fetchRoute = async (from, to, viaHub = false) => {
    const points = viaHub
      ? [
          [from.lng, from.lat],
          [HUB.lng, HUB.lat],
          [to.lng, to.lat],
        ]
      : [
          [from.lng, from.lat],
          [to.lng, to.lat],
        ];
    const coords = points.map((p) => p.join(",")).join(";");
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("osrm");
      const data = await res.json();
      const geom = data?.routes?.[0]?.geometry?.coordinates;
      if (!geom || !geom.length) throw new Error("empty");
      // geojson = [lng, lat] → leaflet [lat, lng]
      return geom.map((c) => [c[1], c[0]]);
    } catch {
      // fallback : courbe via hub
      if (viaHub) {
        return [
          [from.lat, from.lng],
          [HUB.lat, HUB.lng],
          [to.lat, to.lng],
        ];
      }
      const mid = {
        lat: (from.lat + to.lat) / 2 + 0.008,
        lng: (from.lng + to.lng) / 2 - 0.004,
      };
      return [
        [from.lat, from.lng],
        [mid.lat, mid.lng],
        [to.lat, to.lng],
      ];
    }
  };

  const divIcon = (html, className, size = 40) => {
    if (!global.L) return null;
    return global.L.divIcon({
      className: `lx-marker ${className || ""}`,
      html,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  };

  /**
   * Contrôleur de carte live pour un conteneur DOM
   */
  class LiveMapTracker {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.options = options;
      this.map = null;
      this.routeLine = null;
      this.traveledLine = null;
      this.markers = {};
      this.path = [];
      this.shipment = null;
      this.from = null;
      this.to = null;
      this.raf = null;
      this.timer = null;
      this.ready = false;
      this._lastStatus = null;
    }

    ensureLeaflet() {
      return Boolean(global.L);
    }

    initMap() {
      if (!this.ensureLeaflet()) {
        console.warn("Leaflet non chargé");
        return false;
      }
      const el = document.getElementById(this.containerId);
      if (!el) return false;
      if (this.map) {
        this.map.invalidateSize();
        return true;
      }
      this.map = global.L.map(el, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: true,
      }).setView([DEFAULT_CENTER.lat, DEFAULT_CENTER.lng], 12);

      global.L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(this.map);

      this.ready = true;
      // force size after layout
      setTimeout(() => this.map && this.map.invalidateSize(), 120);
      setTimeout(() => this.map && this.map.invalidateSize(), 400);
      return true;
    }

    destroy() {
      this.stopLive();
      if (this.map) {
        this.map.remove();
        this.map = null;
      }
      this.ready = false;
      this.routeLine = null;
      this.traveledLine = null;
      this.markers = {};
      this.path = [];
    }

    async setShipment(shipment) {
      if (!shipment) return;
      this.shipment = shipment;
      if (!this.initMap()) return;

      const Geo = global.LivrExpressGeo;
      const locs = shipment.locations || {};
      const live = Geo?.getLiveGps?.(shipment.trackingId) || {};

      // Départ : GPS enregistré ou adresse
      const pickupLoc = locs.pickup || live.pickup;
      const deliveryLoc = locs.delivery || live.delivery;

      let from;
      let to;
      if (Geo?.resolvePoint) {
        [from, to] = await Promise.all([
          Geo.resolvePoint(pickupLoc, shipment.sender?.address || "Plateau, Dakar"),
          Geo.resolvePoint(
            deliveryLoc,
            shipment.recipient?.address || "Almadies, Dakar"
          ),
        ]);
      } else {
        const senderAddr = shipment.sender?.address || "Plateau, Dakar";
        const recipAddr = shipment.recipient?.address || "Almadies, Dakar";
        [from, to] = await Promise.all([
          geocode(senderAddr),
          geocode(recipAddr),
        ]);
      }

      // Coords stockées sur sender/recipient
      if (
        shipment.sender?.lat != null &&
        shipment.sender?.lng != null &&
        !pickupLoc?.lat
      ) {
        from = {
          lat: shipment.sender.lat,
          lng: shipment.sender.lng,
          label: shipment.sender.address || from.label,
          source: shipment.sender.locationSource || "gps",
        };
      }
      if (
        shipment.recipient?.lat != null &&
        shipment.recipient?.lng != null &&
        !deliveryLoc?.lat
      ) {
        to = {
          lat: shipment.recipient.lat,
          lng: shipment.recipient.lng,
          label: shipment.recipient.address || to.label,
          source: shipment.recipient.locationSource || "gps",
        };
      }

      this.from = from;
      this.to = to;

      // Itinéraire réel entre départ et livraison (via hub si long trajet)
      const distKm = haversineKm(from, to);
      this.path = await fetchRoute(from, to, distKm > 4);
      this._drawStaticLayers();
      this._updateLivePosition(true);
      this.startLive();
      this._emitStats();
    }

    _drawStaticLayers() {
      if (!this.map || !this.from || !this.to) return;

      // clear old
      Object.values(this.markers).forEach((m) => {
        try {
          this.map.removeLayer(m);
        } catch (_) {
          /* ignore */
        }
      });
      this.markers = {};
      if (this.routeLine) this.map.removeLayer(this.routeLine);
      if (this.traveledLine) this.map.removeLayer(this.traveledLine);

      this.routeLine = global.L.polyline(this.path, {
        color: "#93c5fd",
        weight: 6,
        opacity: 0.85,
        lineJoin: "round",
      }).addTo(this.map);

      this.traveledLine = global.L.polyline([], {
        color: "#1d4ed8",
        weight: 6,
        opacity: 1,
        lineJoin: "round",
      }).addTo(this.map);

      this.markers.origin = global.L.marker([this.from.lat, this.from.lng], {
        icon: divIcon(
          `<span class="lx-marker__pin lx-marker__pin--origin">A</span>`,
          "lx-marker--origin",
          36
        ),
        title: "Départ",
      })
        .addTo(this.map)
        .bindPopup(
          `<strong>Départ</strong><br/>${this.escape(this.from.label || this.shipment?.sender?.address || "")}`
        );

      this.markers.dest = global.L.marker([this.to.lat, this.to.lng], {
        icon: divIcon(
          `<span class="lx-marker__pin lx-marker__pin--dest">B</span>`,
          "lx-marker--dest",
          36
        ),
        title: "Destination",
      })
        .addTo(this.map)
        .bindPopup(
          `<strong>Destination</strong><br/>${this.escape(this.to.label || this.shipment?.recipient?.address || "")}`
        );

      // Hub
      this.markers.hub = global.L.marker([HUB.lat, HUB.lng], {
        icon: divIcon(
          `<span class="lx-marker__pin lx-marker__pin--hub">HUB</span>`,
          "lx-marker--hub",
          44
        ),
        title: "Hub LivrExpress",
      })
        .addTo(this.map)
        .bindPopup("<strong>Hub LivrExpress</strong><br/>Plateau, Dakar");

      this.markers.courier = global.L.marker([this.from.lat, this.from.lng], {
        icon: divIcon(
          `<span class="lx-marker__courier" aria-hidden="true">🛵</span>`,
          "lx-marker--courier",
          48
        ),
        title: "Colis en direct",
        zIndexOffset: 1000,
      }).addTo(this.map);

      const bounds = global.L.latLngBounds(
        this.path.map((p) => global.L.latLng(p[0], p[1]))
      );
      this.map.fitBounds(bounds.pad(0.18));
    }

    escape(s) {
      return String(s || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    _updateLivePosition(fit) {
      if (!this.shipment || !this.path.length || !this.markers.courier) return;

      // Priorité : GPS téléphone livreur (service) > simulation sur itinéraire
      const Geo = global.LivrExpressGeo;
      const live = Geo?.getLiveGps?.(this.shipment.trackingId);
      const courierGps =
        live?.courier ||
        this.shipment.locations?.courier ||
        null;

      let lat;
      let lng;
      let t = liveProgress(this.shipment);
      let usingRealGps = false;

      if (
        courierGps &&
        typeof courierGps.lat === "number" &&
        typeof courierGps.lng === "number" &&
        this.shipment.statusKey !== "confirmed" &&
        this.shipment.statusKey !== "prepared"
      ) {
        lat = courierGps.lat;
        lng = courierGps.lng;
        usingRealGps = true;
        // Estimer progression le long de la route (projection simple)
        if (this.to) {
          const total = haversineKm(this.from, this.to) || 1;
          const remain = haversineKm({ lat, lng }, this.to);
          t = Math.max(0, Math.min(1, 1 - remain / total));
        }
      } else {
        const pos = pointAlongPath(this.path, t);
        lat = pos.lat;
        lng = pos.lng;
        // léger bruit seulement en simulation
        if (
          this.shipment.statusKey !== "delivered" &&
          this.shipment.statusKey !== "confirmed"
        ) {
          const wobble = Math.sin(Date.now() / 1800) * 0.00012;
          lat += wobble;
          lng += Math.cos(Date.now() / 2100) * 0.00012;
        }
      }

      this.markers.courier.setLatLng([lat, lng]);

      // Marqueur client (position GPS live optionnelle)
      const clientGps =
        live?.client || this.shipment.locations?.clientLive || null;
      if (
        clientGps &&
        typeof clientGps.lat === "number" &&
        this.map
      ) {
        if (!this.markers.client) {
          this.markers.client = global.L.marker(
            [clientGps.lat, clientGps.lng],
            {
              icon: divIcon(
                `<span class="lx-marker__pin lx-marker__pin--client">👤</span>`,
                "lx-marker--client",
                36
              ),
              title: "Position client",
            }
          )
            .addTo(this.map)
            .bindPopup("<strong>Client</strong><br/>Position GPS téléphone");
        } else {
          this.markers.client.setLatLng([clientGps.lat, clientGps.lng]);
        }
      }

      this._usingRealGps = usingRealGps;

      // portion parcourue
      const traveled = [];
      const steps = Math.max(2, Math.floor(t * (this.path.length * 8)));
      for (let i = 0; i <= steps; i++) {
        const p = pointAlongPath(this.path, (i / steps) * t);
        traveled.push([p.lat, p.lng]);
      }
      if (this.traveledLine) this.traveledLine.setLatLngs(traveled);

      const courierName = this.shipment.courier?.name || "Livreur LivrExpress";
      const meta = this.shipment.courier?.meta || this._statusLabel();
      this.markers.courier.bindPopup(
        `<strong>${this.escape(courierName)}</strong><br/>${this.escape(meta)}<br/><em>Position live</em>`
      );

      // icône selon statut
      const iconHtml =
        this.shipment.statusKey === "delivered"
          ? `<span class="lx-marker__courier is-done">✅</span>`
          : this.shipment.statusKey === "confirmed" ||
              this.shipment.statusKey === "prepared"
            ? `<span class="lx-marker__courier is-pack">📦</span>`
            : `<span class="lx-marker__courier">🛵</span>`;
      this.markers.courier.setIcon(
        divIcon(iconHtml, "lx-marker--courier", 48)
      );

      if (fit && this.map) {
        this.map.panTo([lat, lng], { animate: true, duration: 0.6 });
      }

      this._lastPos = { lat, lng, t };
      this._emitStats();
    }

    _statusLabel() {
      const LX = global.LivrExpress;
      if (LX && this.shipment) {
        return LX.getStatusMeta(this.shipment.statusKey)?.badge || "";
      }
      return this.shipment?.statusKey || "";
    }

    _emitStats() {
      if (!this.shipment || !this._lastPos) return;
      const totalKm = pathLengthKm(this.path);
      const doneKm = totalKm * this._lastPos.t;
      const remainKm = Math.max(0, totalKm - doneKm);
      // ~22 km/h moyenne urbaine Dakar simulée
      const etaMin =
        this.shipment.statusKey === "delivered"
          ? 0
          : Math.max(1, Math.round((remainKm / 22) * 60));

      const detail = {
        lat: this._lastPos.lat,
        lng: this._lastPos.lng,
        progress: Math.round(this._lastPos.t * 100),
        distanceKm: totalKm,
        remainingKm: remainKm,
        etaMin,
        statusKey: this.shipment.statusKey,
        statusLabel: this._statusLabel(),
        fromLabel: this.from?.label,
        toLabel: this.to?.label,
        live: !["confirmed", "prepared", "delivered"].includes(
          this.shipment.statusKey
        ),
      };

      const posEl = document.getElementById("mapLivePosition");
      const distEl = document.getElementById("mapLiveDistance");
      const etaEl = document.getElementById("mapLiveEta");
      const progEl = document.getElementById("mapLiveProgress");
      const liveBadge = document.getElementById("mapLiveBadge");

      if (posEl) {
        const gpsTag = this._usingRealGps ? " · GPS livreur" : "";
        posEl.textContent =
          this.shipment.statusKey === "delivered"
            ? "Arrivé à destination"
            : detail.live
              ? `${detail.lat.toFixed(5)}, ${detail.lng.toFixed(5)}${gpsTag}`
              : this.from?.label || "Point d’enlèvement";
      }
      if (distEl) {
        distEl.textContent =
          remainKm < 0.1 && this.shipment.statusKey === "delivered"
            ? "0 km"
            : `${remainKm.toFixed(1)} km restants`;
      }
      if (etaEl) {
        etaEl.textContent =
          this.shipment.statusKey === "delivered"
            ? "Livré"
            : etaMin < 60
              ? `~${etaMin} min`
              : `~${Math.round(etaMin / 60)} h`;
      }
      if (progEl) {
        progEl.textContent = `${detail.progress}% du trajet`;
        progEl.style.setProperty("--map-prog", `${detail.progress}%`);
      }
      if (liveBadge) {
        liveBadge.classList.toggle("is-off", !detail.live);
        liveBadge.querySelector(".live-map__badge-text") &&
          (liveBadge.querySelector(".live-map__badge-text").textContent =
            detail.live
              ? "LIVE"
              : this.shipment.statusKey === "delivered"
                ? "LIVRÉ"
                : "EN ATTENTE");
      }

      try {
        global.dispatchEvent(
          new CustomEvent("livrexpress:map-stats", { detail })
        );
      } catch (_) {
        /* ignore */
      }
    }

    startLive() {
      this.stopLive();
      if (!this.shipment) return;
      this._lastStatus = this.shipment.statusKey;
      this._updateLivePosition(false);

      if (this.shipment.statusKey === "delivered") return;

      // Écoute mises à jour GPS (autre onglet / livreur)
      this._onGps = () => this._updateLivePosition(false);
      global.addEventListener("livrexpress:gps", this._onGps);
      global.addEventListener("storage", this._onGps);

      // Recharge le colis (admin avance le statut / GPS cloud)
      this.timer = setInterval(async () => {
        const LX = global.LivrExpress;
        if (LX && this.shipment?.trackingId) {
          let fresh = LX.getShipmentAsync
            ? await LX.getShipmentAsync(this.shipment.trackingId)
            : LX.getShipment(this.shipment.trackingId);
          // fusion GPS local
          const Geo = global.LivrExpressGeo;
          const live = Geo?.getLiveGps?.(this.shipment.trackingId);
          if (fresh && live?.courier) {
            fresh.locations = fresh.locations || {};
            fresh.locations.courier = live.courier;
          }
          if (fresh) {
            const statusChanged = fresh.statusKey !== this._lastStatus;
            this.shipment = fresh;
            if (statusChanged) {
              this._lastStatus = fresh.statusKey;
              if (fresh.statusKey === "delivered") {
                this._updateLivePosition(true);
                this.stopLive();
                return;
              }
            }
          }
        }
        this._updateLivePosition(false);
      }, 2000);

      // Rafraîchissement fluide du marqueur
      this.raf = setInterval(() => {
        if (this.shipment && this.shipment.statusKey !== "delivered") {
          this._updateLivePosition(false);
        }
      }, 800);
    }

    stopLive() {
      if (this.raf) {
        clearInterval(this.raf);
        this.raf = null;
      }
      if (this.timer) {
        clearInterval(this.timer);
        this.timer = null;
      }
      if (this._onGps) {
        global.removeEventListener("livrexpress:gps", this._onGps);
        global.removeEventListener("storage", this._onGps);
        this._onGps = null;
      }
    }

    refresh(shipment) {
      if (shipment) this.shipment = shipment;
      if (!this.ready) {
        return this.setShipment(this.shipment);
      }
      this._updateLivePosition(true);
      this.startLive();
    }
  }

  // Instance singleton page suivi
  let tracker = null;

  const mountTrackingMap = async (shipment, containerId = "liveMap") => {
    const el = document.getElementById(containerId);
    const panel = document.getElementById("liveMapPanel");
    if (!el) return null;
    if (panel) panel.hidden = false;

    if (!tracker || tracker.containerId !== containerId) {
      if (tracker) tracker.destroy();
      tracker = new LiveMapTracker(containerId);
    }
    await tracker.setShipment(shipment);
    return tracker;
  };

  const unmountTrackingMap = () => {
    if (tracker) {
      tracker.destroy();
      tracker = null;
    }
    const panel = document.getElementById("liveMapPanel");
    if (panel) panel.hidden = true;
  };

  const getTracker = () => tracker;

  global.LivrExpressMap = {
    DAKAR_PLACES,
    HUB,
    geocode,
    haversineKm,
    statusProgress,
    liveProgress,
    fetchRoute,
    LiveMapTracker,
    mountTrackingMap,
    unmountTrackingMap,
    getTracker,
  };
})(typeof window !== "undefined" ? window : globalThis);
