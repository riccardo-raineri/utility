/* ==========================================================================
   ORARIO TRASPORTI — logica applicativa
   ========================================================================== */

(function () {
  "use strict";

  /* ---------------------------------------------------------------------
     STATO GLOBALE
  --------------------------------------------------------------------- */
  let map, userMarker, vehicleMarker, routePolyline;
  let activeBusInterval = null;
  let selectedBusId = null;
  let currentTrainMode = "departures";
  let busSearchTerm = "";
  let trainSearchTerm = "";
  let plannerSearchTerm = "";
  let activeCategory = "all";
  let sortMode = "time";
  const favoriteDestinations = new Set();

  // Orologio simulato: parte da un orario coerente con i dati mock e avanza in tempo reale.
  const appTime = new Date();
  appTime.setHours(12, 33, 0, 0);

  const STATION_CENTER = { lat: 44.4949, lng: 11.3426 };

  /* ---------------------------------------------------------------------
     DATI DI SIMULAZIONE
  --------------------------------------------------------------------- */
  const mockBuses = [
    {
      id: "25",
      name: "25",
      dest: "Doppio Arco / Corticella",
      time: "12:35",
      status: "ok",
      delay: 0,
      occupancy: "medium",
      accessible: true,
      latOffset: 0.0015,
      lngOffset: 0.001,
      nextPassages: ["12:35", "12:47", "13:03"],
      stops: [
        { name: "Via Rizzoli", time: "12:30" },
        { name: "Piazza Maggiore", time: "12:32" },
        { name: "Via Indipendenza (fermata attuale)", time: "12:35" },
        { name: "Autostazione", time: "12:38" },
        { name: "Corticella Capolinea", time: "12:46" },
      ],
    },
    {
      id: "14",
      name: "14",
      dest: "San Lazzaro di Savena",
      time: "12:38",
      status: "warn",
      delay: 4,
      occupancy: "high",
      accessible: true,
      latOffset: -0.002,
      lngOffset: 0.0025,
      nextPassages: ["12:38", "12:56", "13:14"],
      stops: [
        { name: "Piazza dei Martiri", time: "12:34" },
        { name: "Via Indipendenza (fermata attuale)", time: "12:38" },
        { name: "Porta Maggiore", time: "12:43" },
        { name: "San Lazzaro Municipio", time: "12:52" },
      ],
    },
    {
      id: "27",
      name: "27",
      dest: "Piazza XX Settembre - Pilastro",
      time: "12:42",
      status: "ok",
      delay: 0,
      occupancy: "low",
      accessible: false,
      latOffset: 0.0025,
      lngOffset: -0.0015,
      nextPassages: ["12:42", "12:58", "13:16"],
      stops: [
        { name: "Stazione Centrale", time: "12:39" },
        { name: "Via Indipendenza (fermata attuale)", time: "12:42" },
        { name: "San Vitale", time: "12:47" },
        { name: "Pilastro", time: "12:58" },
      ],
    },
  ];

  const mockTrainsDepartures = [
    { code: "RV 2282", category: "Regionale Veloce", time: "12:40", dest: "Venezia Santa Lucia", bin: "4", status: "ok", label: "Regolare" },
    { code: "FR 9514", category: "Frecciarossa", time: "12:48", dest: "Roma Termini · Milano C.le", bin: "7", status: "warn", label: "Ritardo +10'", delayReason: "Rallentamenti per traffico intenso in linea." },
    { code: "REG 6520", category: "Regionale", time: "12:55", dest: "Rimini · Ancona", bin: "2", status: "ok", label: "Regolare" },
    { code: "FA 8511", category: "Frecciargento", time: "13:02", dest: "Firenze S.M.N. · Bolzano", bin: "5", oldBin: "3", status: "danger", label: "Ritardo +22'", delayReason: "Guasto tecnico a un convoglio precedente." },
    { code: "IC 731", category: "Intercity", time: "13:10", dest: "Lecce", bin: "1", status: "ok", label: "Regolare" },
  ];

  const mockTrainsArrivals = [
    { code: "FR 9608", category: "Frecciarossa", time: "12:36", dest: "Da Napoli Centrale", bin: "6", status: "ok", label: "Regolare" },
    { code: "RV 3311", category: "Regionale Veloce", time: "12:42", dest: "Da Milano Centrale", bin: "3", status: "warn", label: "Ritardo +5'", delayReason: "Attesa incrocio con altro convoglio." },
    { code: "FB 8850", category: "Frecciabianca", time: "12:50", dest: "Da Ravenna", bin: "1", status: "ok", label: "Regolare" },
  ];

  const destinationsDB = [
    {
      id: "d1",
      name: "Stazione Centrale RFI",
      category: "trasporti",
      icon: "train-front",
      bus: "27",
      walk: 2,
      wait: 6,
      details: "Passaggio ogni 6 min · fermata a 100 m.",
    },
    {
      id: "d2",
      name: "Università degli Studi (Via Zamboni)",
      category: "universita",
      icon: "graduation-cap",
      bus: "25",
      walk: 4,
      wait: 7,
      details: "Diretto senza cambi.",
    },
    {
      id: "d3",
      name: "Ospedale Maggiore",
      category: "sanita",
      icon: "cross",
      bus: "19 / 38",
      walk: 3,
      wait: 15,
      details: "Linea ad alta frequenza, più opzioni disponibili.",
    },
    {
      id: "d4",
      name: "Centro Fieristico (BolognaFiere)",
      category: "fiera",
      icon: "store",
      bus: "28",
      walk: 5,
      wait: 10,
      details: "Servizio potenziato nei giorni feriali.",
    },
  ];

  const CATEGORY_LABELS = {
    all: "Tutti",
    trasporti: "Stazioni",
    universita: "Università",
    sanita: "Sanità",
    fiera: "Fiere",
  };
  const CATEGORY_ICONS = {
    all: "layout-grid",
    trasporti: "train-front",
    universita: "graduation-cap",
    sanita: "cross",
    fiera: "store",
  };

  /* ---------------------------------------------------------------------
     UTILITÀ
  --------------------------------------------------------------------- */
  function pad(n) {
    return String(n).padStart(2, "0");
  }

  function formatClock(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
  }

  function formatHM(date) {
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  // Converte una stringa "HH:MM" in minuti totali dalla mezzanotte.
  function timeToMinutes(str) {
    const [h, m] = str.split(":").map(Number);
    return h * 60 + m;
  }

  // Minuti mancanti rispetto all'orologio simulato (gestisce il passaggio di mezzanotte).
  function minutesUntil(str) {
    const nowMinutes = appTime.getHours() * 60 + appTime.getMinutes();
    let target = timeToMinutes(str);
    let diff = target - nowMinutes;
    if (diff < -60) diff += 24 * 60;
    return diff;
  }

  function etaLabel(str) {
    const diff = minutesUntil(str);
    if (diff <= 0) return "in arrivo";
    if (diff === 1) return "1 min";
    return `${diff} min`;
  }

  function refreshIcons() {
    if (window.lucide) lucide.createIcons();
  }

  function occupancyLabel(level) {
    return { low: "Poco affollato", medium: "Affollamento medio", high: "Molto affollato" }[level] || "";
  }

  /* ---------------------------------------------------------------------
     OROLOGIO LIVE
  --------------------------------------------------------------------- */
  function tickClock() {
    appTime.setSeconds(appTime.getSeconds() + 1);
    const el = document.getElementById("liveClock");
    if (el) el.textContent = formatClock(appTime);
  }

  /* ---------------------------------------------------------------------
     NAVIGAZIONE TRA SEZIONI
  --------------------------------------------------------------------- */
  function switchSection(section) {
    ["bus", "train", "planner"].forEach((s) => {
      document.getElementById(`section-${s}`).classList.remove("is-active");
      const btn = document.getElementById(`nav-${s}`);
      btn.classList.remove("is-active");
      btn.setAttribute("aria-selected", "false");
    });

    document.getElementById(`section-${section}`).classList.add("is-active");
    const activeBtn = document.getElementById(`nav-${section}`);
    activeBtn.classList.add("is-active");
    activeBtn.setAttribute("aria-selected", "true");

    if (section === "bus" && map) {
      setTimeout(() => map.invalidateSize(), 150);
    }
  }

  /* ---------------------------------------------------------------------
     MAPPA (Leaflet)
  --------------------------------------------------------------------- */
  function initMap(lat, lng) {
    map = L.map("map", { zoomControl: false }).setView([lat, lng], 15);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
      attribution: "&copy; CARTO &copy; OpenStreetMap",
      maxZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "bottomright" }).addTo(map);

    userMarker = L.circleMarker([lat, lng], {
      radius: 8,
      color: "#2fbf6a",
      fillColor: "#2fbf6a",
      fillOpacity: 0.9,
      weight: 2,
    })
      .addTo(map)
      .bindPopup("<b>La tua posizione</b>");
  }

  function updateMapForBus(bus) {
    if (routePolyline) map.removeLayer(routePolyline);
    if (vehicleMarker) map.removeLayer(vehicleMarker);
    if (activeBusInterval) clearInterval(activeBusInterval);

    const centerLat = STATION_CENTER.lat;
    const centerLng = STATION_CENTER.lng;

    const routeCoords = [
      [centerLat - 0.005, centerLng - 0.004],
      [centerLat - 0.002, centerLng - 0.002],
      [centerLat, centerLng],
      [centerLat + bus.latOffset, centerLng + bus.lngOffset],
      [centerLat + 0.006, centerLng + 0.005],
    ];

    routePolyline = L.polyline(routeCoords, {
      color: "#2f6feb",
      weight: 4,
      opacity: 0.85,
      dashArray: "6, 6",
    }).addTo(map);
    map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });

    let currentStep = 0;
    vehicleMarker = L.circleMarker(routeCoords[currentStep], {
      radius: 8,
      color: "#8fb3ff",
      fillColor: "#2f6feb",
      fillOpacity: 1,
      weight: 3,
    })
      .addTo(map)
      .bindPopup(`<b>Linea ${bus.name}</b><br>Direzione: ${bus.dest}`)
      .openPopup();

    activeBusInterval = setInterval(() => {
      currentStep = (currentStep + 1) % routeCoords.length;
      vehicleMarker.setLatLng(routeCoords[currentStep]);
    }, 2500);
  }

  /* ---------------------------------------------------------------------
     SEZIONE BUS
  --------------------------------------------------------------------- */
  function getFilteredBuses() {
    const q = busSearchTerm.trim().toLowerCase();
    if (!q) return mockBuses;
    return mockBuses.filter(
      (b) => b.name.toLowerCase().includes(q) || b.dest.toLowerCase().includes(q)
    );
  }

  function statusBadge(status, text) {
    const cls = { ok: "badge-ok", warn: "badge-warn", danger: "badge-danger" }[status] || "badge-ok";
    return `<span class="badge ${cls}">${text}</span>`;
  }

  function renderBusList() {
    const container = document.getElementById("bus-list-container");
    const buses = getFilteredBuses();

    if (buses.length === 0) {
      container.innerHTML = `<li class="empty-state">Nessuna linea trovata per "${busSearchTerm}".</li>`;
      return;
    }

    container.innerHTML = buses
      .map((bus) => {
        const statusText = bus.delay > 0 ? `+${bus.delay} min` : "In orario";
        const badge = statusBadge(bus.status, statusText);
        const selected = bus.id === selectedBusId ? "is-selected" : "";
        return `
          <li class="bus-row ${selected}" data-bus-id="${bus.id}" tabindex="0" role="button" aria-pressed="${bus.id === selectedBusId}">
            <div class="bus-row-left">
              <div class="line-badge">${bus.name}</div>
              <div class="bus-row-info">
                <h4>${bus.dest}</h4>
                <div class="bus-row-meta">
                  <span><i data-lucide="users" aria-hidden="true"></i> ${occupancyLabel(bus.occupancy)}</span>
                  ${bus.accessible ? '<span><i data-lucide="accessibility" aria-hidden="true"></i> Accessibile</span>' : ""}
                </div>
              </div>
            </div>
            <div class="bus-row-right">
              <span class="eta">${etaLabel(bus.time)}</span>
              <span class="eta-label">ore ${bus.time}</span>
              ${badge}
            </div>
          </li>
        `;
      })
      .join("");

    refreshIcons();

    container.querySelectorAll(".bus-row").forEach((row) => {
      row.addEventListener("click", () => selectBus(row.dataset.busId));
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          selectBus(row.dataset.busId);
        }
      });
    });
  }

  function selectBus(busId) {
    const bus = mockBuses.find((b) => b.id === busId);
    if (!bus) return;
    selectedBusId = busId;
    renderBusList();

    document.getElementById("bus-route-panel").classList.remove("is-hidden");
    document.getElementById("selected-bus-title").innerHTML =
      `<i data-lucide="route" aria-hidden="true"></i> Linea ${bus.name} &bull; ${bus.dest}`;

    const currentStopIndex = bus.stops.findIndex((s) => s.name.includes("fermata attuale"));

    // Prossimi passaggi
    const chips = document.getElementById("next-passages-chips");
    chips.innerHTML = bus.nextPassages
      .map((t, i) => `<span class="chip ${i === 0 ? "is-next" : ""}">${t} &middot; ${etaLabel(t)}</span>`)
      .join("");

    // Timeline fermate
    const timeline = document.getElementById("bus-stops-timeline");
    timeline.innerHTML = bus.stops
      .map((stop, idx) => {
        const isCurrent = idx === currentStopIndex;
        return `
          <div class="timeline-row">
            <div class="timeline-track">
              <div class="timeline-dot ${isCurrent ? "is-current" : ""}"></div>
              ${idx < bus.stops.length - 1 ? '<div class="timeline-line"></div>' : ""}
            </div>
            <div class="timeline-body ${isCurrent ? "is-current" : ""}">
              <span>${stop.name}</span>
              <span class="timeline-time">${stop.time}</span>
            </div>
          </div>
        `;
      })
      .join("");

    refreshIcons();
    updateMapForBus(bus);
  }

  function closeBusRoute() {
    document.getElementById("bus-route-panel").classList.add("is-hidden");
    selectedBusId = null;
    renderBusList();
    if (routePolyline) map.removeLayer(routePolyline);
    if (vehicleMarker) map.removeLayer(vehicleMarker);
    if (activeBusInterval) clearInterval(activeBusInterval);
  }

  function refreshBusData(btn) {
    if (btn) {
      btn.classList.add("is-spinning");
      setTimeout(() => btn.classList.remove("is-spinning"), 600);
    }
    document.getElementById("bus-updated-at").textContent = formatHM(appTime);
    renderBusList();
    if (selectedBusId) selectBus(selectedBusId);
  }

  /* ---------------------------------------------------------------------
     SEZIONE TRENI
  --------------------------------------------------------------------- */
  function getFilteredTrains() {
    const data = currentTrainMode === "departures" ? mockTrainsDepartures : mockTrainsArrivals;
    const q = trainSearchTerm.trim().toLowerCase();
    if (!q) return data;
    return data.filter(
      (t) => t.code.toLowerCase().includes(q) || t.dest.toLowerCase().includes(q)
    );
  }

  function setTrainMode(mode) {
    currentTrainMode = mode;
    document.getElementById("btn-dep").classList.toggle("is-active", mode === "departures");
    document.getElementById("btn-arr").classList.toggle("is-active", mode === "arrivals");
    renderTrainTable();
  }

  function renderTrainTable() {
    const tbody = document.getElementById("train-table-body");
    const trains = getFilteredTrains();

    document.getElementById("train-count").textContent = trains.length;
    document.getElementById("train-updated-at").textContent = formatClock(appTime);

    // Banner di allerta se c'è un ritardo grave
    const heavy = trains.find((t) => t.status === "danger");
    const alertBox = document.getElementById("train-alert");
    if (heavy) {
      alertBox.classList.remove("is-hidden");
      document.getElementById("train-alert-text").textContent =
        `${heavy.code} per ${heavy.dest.replace("Da ", "")}: ${heavy.label.toLowerCase()}. ${heavy.delayReason || ""}`;
    } else {
      alertBox.classList.add("is-hidden");
    }

    if (trains.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" class="empty-state">Nessun treno trovato per "${trainSearchTerm}".</td></tr>`;
      return;
    }

    tbody.innerHTML = trains
      .map((train) => {
        const badge = statusBadge(train.status, train.label);
        const platformCell = train.oldBin
          ? `<span class="platform-old">${train.oldBin}</span><span class="platform-changed">${train.bin}</span>`
          : `<span class="platform-cell">${train.bin}</span>`;

        return `
          <tr>
            <td><span class="train-code">${train.code}</span></td>
            <td><span class="cat-badge">${train.category}</span></td>
            <td><span class="train-time">${train.time}</span> <span class="muted small">(${etaLabel(train.time)})</span></td>
            <td>${train.dest}</td>
            <td>${platformCell}</td>
            <td class="align-right">
              <div class="status-cell">
                ${badge}
                ${train.delayReason ? `<span class="delay-reason">${train.delayReason}</span>` : ""}
              </div>
            </td>
          </tr>
        `;
      })
      .join("");
  }

  /* ---------------------------------------------------------------------
     SEZIONE PIANIFICATORE
  --------------------------------------------------------------------- */
  function renderCategoryChips() {
    const container = document.getElementById("category-chips");
    const categories = ["all", ...new Set(destinationsDB.map((d) => d.category))];

    container.innerHTML = categories
      .map((cat) => {
        const active = cat === activeCategory ? "is-active" : "";
        return `
          <button class="filter-chip ${active}" data-cat="${cat}">
            <i data-lucide="${CATEGORY_ICONS[cat]}" aria-hidden="true"></i> ${CATEGORY_LABELS[cat] || cat}
          </button>
        `;
      })
      .join("");

    refreshIcons();

    container.querySelectorAll(".filter-chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        activeCategory = chip.dataset.cat;
        renderCategoryChips();
        renderDestinations();
      });
    });
  }

  function getFilteredDestinations() {
    const q = plannerSearchTerm.trim().toLowerCase();
    let list = destinationsDB.filter((d) => {
      const matchesQuery = !q || d.name.toLowerCase().includes(q);
      const matchesCategory = activeCategory === "all" || d.category === activeCategory;
      return matchesQuery && matchesCategory;
    });

    if (sortMode === "name") {
      list = list.slice().sort((a, b) => a.name.localeCompare(b.name, "it"));
    } else if (sortMode === "favorites") {
      list = list.slice().sort((a, b) => {
        const fa = favoriteDestinations.has(a.id) ? 0 : 1;
        const fb = favoriteDestinations.has(b.id) ? 0 : 1;
        return fa - fb || a.walk + a.wait - (b.walk + b.wait);
      });
    } else {
      list = list.slice().sort((a, b) => a.walk + a.wait - (b.walk + b.wait));
    }

    return list;
  }

  function renderDestinations() {
    const container = document.getElementById("planner-results");
    const items = getFilteredDestinations();

    document.getElementById("planner-count").textContent =
      `${items.length} destinazion${items.length === 1 ? "e" : "i"}`;

    if (items.length === 0) {
      container.innerHTML = `<li class="empty-state">Nessuna destinazione corrisponde alla ricerca. Prova un altro termine o categoria.</li>`;
      return;
    }

    container.innerHTML = items
      .map((item) => {
        const total = item.walk + item.wait;
        const isFav = favoriteDestinations.has(item.id);
        return `
          <li class="destination-card">
            <div class="dest-left">
              <div class="dest-icon"><i data-lucide="${item.icon}" aria-hidden="true"></i></div>
              <div>
                <h4 class="dest-name">${item.name}</h4>
                <p class="dest-detail">${item.details}</p>
                <div class="dest-sub">
                  <span><i data-lucide="footprints" aria-hidden="true"></i> ${item.walk} min a piedi</span>
                  <span><i data-lucide="clock" aria-hidden="true"></i> attesa media ${item.wait} min</span>
                </div>
              </div>
            </div>
            <div class="dest-right">
              <div class="dest-time-block">
                <div class="dest-total-time">${total} min tot.</div>
                <span class="dest-line-badge">Bus ${item.bus}</span>
              </div>
              <button class="fav-btn ${isFav ? "is-fav" : ""}" data-fav-id="${item.id}" aria-label="Aggiungi ai preferiti">
                <i data-lucide="star" aria-hidden="true"></i>
              </button>
            </div>
          </li>
        `;
      })
      .join("");

    refreshIcons();

    container.querySelectorAll(".fav-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.favId;
        if (favoriteDestinations.has(id)) favoriteDestinations.delete(id);
        else favoriteDestinations.add(id);
        renderDestinations();
      });
    });
  }

  /* ---------------------------------------------------------------------
     INIZIALIZZAZIONE ED EVENTI
  --------------------------------------------------------------------- */
  function bindEvents() {
    document.querySelectorAll(".mode-btn").forEach((btn) => {
      btn.addEventListener("click", () => switchSection(btn.dataset.section));
    });

    document.getElementById("refreshBusBtn").addEventListener("click", (e) => refreshBusData(e.currentTarget));
    document.getElementById("closeBusRouteBtn").addEventListener("click", closeBusRoute);

    document.getElementById("busSearch").addEventListener("input", (e) => {
      busSearchTerm = e.target.value;
      renderBusList();
    });

    document.getElementById("btn-dep").addEventListener("click", () => setTrainMode("departures"));
    document.getElementById("btn-arr").addEventListener("click", () => setTrainMode("arrivals"));
    document.getElementById("trainSearch").addEventListener("input", (e) => {
      trainSearchTerm = e.target.value;
      renderTrainTable();
    });

    document.getElementById("destination-input").addEventListener("input", (e) => {
      plannerSearchTerm = e.target.value;
      renderDestinations();
    });
    document.getElementById("sort-select").addEventListener("change", (e) => {
      sortMode = e.target.value;
      renderDestinations();
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    refreshIcons();
    initMap(STATION_CENTER.lat, STATION_CENTER.lng);

    bindEvents();

    renderBusList();
    document.getElementById("bus-updated-at").textContent = formatHM(appTime);

    renderTrainTable();

    renderCategoryChips();
    renderDestinations();

    document.getElementById("liveClock").textContent = formatClock(appTime);
    setInterval(tickClock, 1000);

    // Ricalcola i conteggi "tra X min" ogni 15s così restano coerenti con l'orologio simulato.
    setInterval(() => {
      renderBusList();
      if (selectedBusId) {
        const chips = document.getElementById("next-passages-chips");
        const bus = mockBuses.find((b) => b.id === selectedBusId);
        if (bus && chips) {
          chips.innerHTML = bus.nextPassages
            .map((t, i) => `<span class="chip ${i === 0 ? "is-next" : ""}">${t} &middot; ${etaLabel(t)}</span>`)
            .join("");
        }
      }
      renderTrainTable();
    }, 15000);
  });
})();
