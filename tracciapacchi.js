// tracciapacchi.js
// Logica del tool: salva i pacchi in localStorage, chiama il Cloudflare Worker
// (proxy verso Ship24) per registrare nuovi tracking, aggiornarne lo stato
// e mostrare la cronologia completa degli eventi.

const THEME_KEY = "toolbox_theme";       // chiave condivisa con gli altri tool del toolbox
const WORKER_KEY = "tracciapacchi_worker_url";
const PACKAGES_KEY = "tracciapacchi_pacchi";
const MAX_PACCHI = 5;                    // limite pensato per il piano gratuito Ship24

// Ordine delle tappe principali usato dallo stepper visivo
const MILESTONE_ORDER = ["info_received", "in_transit", "out_for_delivery", "delivered"];
const EXCEPTION_STATUSES = ["exception", "failed_attempt", "return_to_sender"];

// --- Riferimenti agli elementi della pagina ---
const themeToggle = document.getElementById("theme-toggle");
const settingsPanel = document.getElementById("settings-panel");
const workerUrlInput = document.getElementById("worker-url-input");
const saveWorkerUrlBtn = document.getElementById("save-worker-url");
const addForm = document.getElementById("add-form");
const inputLabel = document.getElementById("input-label");
const inputNumber = document.getElementById("input-number");
const addError = document.getElementById("add-error");
const packagesList = document.getElementById("packages-list");
const packagesCount = document.getElementById("packages-count");
const emptyState = document.getElementById("empty-state");
const refreshAllBtn = document.getElementById("refresh-all");
const cardTemplate = document.getElementById("package-card-template");
const statsRow = document.getElementById("stats-row");

// ------------------------------------------------------------------
// Tema chiaro/scuro (stesso pattern degli altri tool del toolbox)
// ------------------------------------------------------------------
function applyTheme(theme) {
  document.body.classList.toggle("theme-dark", theme === "dark");
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(saved);
}

themeToggle.addEventListener("click", () => {
  const current = localStorage.getItem(THEME_KEY) || "light";
  const next = current === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// ------------------------------------------------------------------
// Gestione URL del Worker (richiesto una sola volta)
// ------------------------------------------------------------------
function getWorkerUrl() {
  return localStorage.getItem(WORKER_KEY) || "";
}

function initSettings() {
  const url = getWorkerUrl();
  if (!url) {
    settingsPanel.hidden = false;
  } else {
    workerUrlInput.value = url;
  }
}

saveWorkerUrlBtn.addEventListener("click", () => {
  const url = workerUrlInput.value.trim();
  if (!url) return;
  localStorage.setItem(WORKER_KEY, url);
  settingsPanel.hidden = true;
});

// ------------------------------------------------------------------
// Gestione pacchi salvati in localStorage
// Struttura di ogni pacco:
// { id, label, number, trackerId, status, detail, courier, transitDays,
//   events: [{status, location, datetime}], lastUpdate }
// ------------------------------------------------------------------
function getPackages() {
  try {
    return JSON.parse(localStorage.getItem(PACKAGES_KEY)) || [];
  } catch {
    return [];
  }
}

function savePackages(packages) {
  localStorage.setItem(PACKAGES_KEY, JSON.stringify(packages));
}

// ------------------------------------------------------------------
// Chiamate al Worker
// ------------------------------------------------------------------
async function callWorker(payload) {
  const url = getWorkerUrl();
  if (!url) {
    settingsPanel.hidden = false;
    throw new Error("URL del Worker non configurato");
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Errore dal Worker (${res.status})`);
  }
  return res.json();
}

// Ship24 rileva automaticamente il corriere dal formato del numero di tracking
// e lo restituisce come courierCode (es. "poste-italiane", "gls-italy").
// Qui lo trasformiamo in un nome leggibile ("Poste Italiane").
function extractCourierName(shipment, tracker) {
  let code = shipment?.courierCode ?? tracker?.courierCode;
  if (Array.isArray(code)) code = code[0]; // un pacco può passare per più corrieri: mostriamo il principale
  if (!code) return null;
  return code
    .toString()
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Estrae dallo schema di risposta Ship24 stato, corriere e cronologia eventi.
// NB: alcuni nomi di campo vanno verificati contro la risposta reale della tua
// API key, potrebbero cambiare leggermente rispetto a questa versione.
function parseShip24Result(data) {
  const tracking = data?.data?.trackings?.[0];
  if (!tracking) {
    return { status: "pending", detail: "In attesa di aggiornamenti", trackerId: null, courier: null, events: [] };
  }

  const shipment = tracking.shipment || {};
  const events = (tracking.events || []).map((e) => ({
    status: e.status || "Aggiornamento",
    location: e.location || "",
    datetime: e.datetime || e.occurrenceDatetime || null,
  }));
  const lastEvent = events[0];

  return {
    trackerId: tracking.tracker?.trackerId || null,
    status: shipment.statusMilestone || "pending",
    detail: lastEvent
      ? `${lastEvent.status}${lastEvent.location ? " · " + lastEvent.location : ""}`
      : "Nessun evento disponibile ancora",
    courier: extractCourierName(shipment, tracking.tracker) || shipment.courierName || null,
    events,
  };
}

function statusToPillClass(status) {
  if (status === "delivered") return "pill-delivered";
  if (EXCEPTION_STATUSES.includes(status)) return "pill-exception";
  if (["info_received", "pending"].includes(status)) return "";
  return "pill-transit";
}

function statusToIcon(status) {
  if (status === "delivered") return "check-circle-2";
  if (EXCEPTION_STATUSES.includes(status)) return "alert-triangle";
  if (status === "out_for_delivery") return "map-pin";
  if (status === "in_transit") return "truck";
  return "clock-3";
}

function statusToLabel(status) {
  const labels = {
    pending: "In attesa",
    info_received: "Registrato",
    in_transit: "In transito",
    out_for_delivery: "In consegna",
    delivered: "Consegnato",
    exception: "Anomalia",
    failed_attempt: "Consegna fallita",
    return_to_sender: "Reso al mittente",
    available_for_pickup: "Pronto per il ritiro",
  };
  return labels[status] || "Stato sconosciuto";
}

// Calcola i giorni trascorsi dal primo evento registrato ad oggi (o alla consegna)
function computeTransitDays(events, status) {
  if (!events || events.length === 0) return null;
  const dated = events.filter((e) => e.datetime);
  if (dated.length === 0) return null;
  const first = new Date(dated[dated.length - 1].datetime);
  const end = status === "delivered" && dated[0].datetime ? new Date(dated[0].datetime) : new Date();
  const days = Math.max(0, Math.round((end - first) / 86400000));
  return days;
}

// ------------------------------------------------------------------
// Aggiunta di un nuovo pacco
// ------------------------------------------------------------------
addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  addError.hidden = true;

  const packages = getPackages();
  if (packages.length >= MAX_PACCHI) {
    addError.textContent = `Puoi tracciare al massimo ${MAX_PACCHI} pacchi contemporaneamente.`;
    addError.hidden = false;
    return;
  }

  const number = inputNumber.value.trim();
  if (!number) return;
  const label = inputLabel.value.trim() || `Pacco ${packages.length + 1}`;

  try {
    const data = await callWorker({ action: "track", trackingNumber: number });
    const parsed = parseShip24Result(data);

    packages.push({
      id: crypto.randomUUID(),
      label,
      number,
      trackerId: parsed.trackerId,
      status: parsed.status,
      detail: parsed.detail,
      courier: parsed.courier,
      events: parsed.events,
      transitDays: computeTransitDays(parsed.events, parsed.status),
      lastUpdate: new Date().toISOString(),
    });
    savePackages(packages);
    renderPackages();

    inputLabel.value = "";
    inputNumber.value = "";
  } catch (err) {
    addError.textContent = "Non è stato possibile registrare il pacco. Controlla il numero e l'URL del Worker.";
    addError.hidden = false;
  }
});

// ------------------------------------------------------------------
// Aggiornamento stato di un pacco
// ------------------------------------------------------------------
async function refreshPackage(id) {
  const packages = getPackages();
  const pkg = packages.find((p) => p.id === id);
  if (!pkg || !pkg.trackerId) return;

  const wasDelivered = pkg.status === "delivered";

  try {
    const data = await callWorker({ action: "results", trackerId: pkg.trackerId });
    const parsed = parseShip24Result(data);
    pkg.status = parsed.status;
    pkg.detail = parsed.detail;
    pkg.courier = parsed.courier || pkg.courier;
    pkg.events = parsed.events.length ? parsed.events : pkg.events;
    pkg.transitDays = computeTransitDays(pkg.events, pkg.status);
    pkg.lastUpdate = new Date().toISOString();
    pkg._justDelivered = !wasDelivered && pkg.status === "delivered"; // per l'evidenziazione una tantum
    savePackages(packages);
    renderPackages();
  } catch {
    // In caso di errore silenzioso, lo stato mostrato resta quello precedente
  }
}

refreshAllBtn.addEventListener("click", () => {
  getPackages().forEach((p) => refreshPackage(p.id));
});

// ------------------------------------------------------------------
// Rimozione pacco
// ------------------------------------------------------------------
function removePackage(id) {
  const packages = getPackages().filter((p) => p.id !== id);
  savePackages(packages);
  renderPackages();
}

// ------------------------------------------------------------------
// Rendering
// ------------------------------------------------------------------
function formatRelativeTime(isoString) {
  const diffMs = Date.now() - new Date(isoString).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "Aggiornato ora";
  if (diffMin < 60) return `Aggiornato ${diffMin} min fa`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Aggiornato ${diffH} h fa`;
  const diffG = Math.round(diffH / 24);
  return `Aggiornato ${diffG} g fa`;
}

function formatEventDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  if (isNaN(d)) return "";
  return d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function updateStatsRow(packages) {
  const counts = { in_transit: 0, out_for_delivery: 0, delivered: 0 };
  packages.forEach((p) => {
    if (p.status === "in_transit") counts.in_transit++;
    if (p.status === "out_for_delivery") counts.out_for_delivery++;
    if (p.status === "delivered") counts.delivered++;
  });
  document.getElementById("stat-transit").textContent = counts.in_transit;
  document.getElementById("stat-outfordelivery").textContent = counts.out_for_delivery;
  document.getElementById("stat-delivered").textContent = counts.delivered;
  statsRow.hidden = packages.length === 0;
}

function renderStepper(node, status) {
  const stepper = node.querySelector(".stepper");
  const isException = EXCEPTION_STATUSES.includes(status);
  stepper.classList.toggle("stepper-exception", isException);

  const currentIndex = isException ? -1 : MILESTONE_ORDER.indexOf(status);
  stepper.querySelectorAll(".step").forEach((stepEl) => {
    const stepName = stepEl.dataset.step;
    const stepIndex = MILESTONE_ORDER.indexOf(stepName);
    stepEl.classList.toggle("step-done", !isException && stepIndex <= currentIndex);
    stepEl.classList.toggle("step-current", !isException && stepIndex === currentIndex);
  });
}

function renderHistory(node, events) {
  const list = node.querySelector(".history-list");
  const toggleBtn = node.querySelector(".history-toggle");
  const toggleText = node.querySelector(".history-toggle-text");
  const wrap = node.querySelector(".history-wrap");

  list.innerHTML = "";
  if (!events || events.length === 0) {
    toggleBtn.hidden = true;
    return;
  }
  toggleBtn.hidden = false;
  toggleText.textContent = `Mostra cronologia (${events.length} event${events.length === 1 ? "o" : "i"})`;

  events.forEach((ev) => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = `<div class="h-status">${ev.status}</div><div class="h-meta">${[formatEventDate(ev.datetime), ev.location].filter(Boolean).join(" · ")}</div>`;
    list.appendChild(li);
  });

  toggleBtn.addEventListener("click", () => {
    const isOpen = wrap.classList.toggle("open");
    toggleBtn.setAttribute("aria-expanded", String(isOpen));
    toggleText.textContent = isOpen
      ? "Nascondi cronologia"
      : `Mostra cronologia (${events.length} event${events.length === 1 ? "o" : "i"})`;
  });
}

function renderPackages() {
  const packages = getPackages();
  packagesList.innerHTML = "";
  packagesCount.textContent = `${packages.length}/${MAX_PACCHI}`;
  emptyState.hidden = packages.length > 0;
  updateStatsRow(packages);

  packages.forEach((pkg) => {
    const node = cardTemplate.content.cloneNode(true);
    const card = node.querySelector(".package-card");

    node.querySelector(".package-label").textContent = pkg.label;
    node.querySelector(".package-number").textContent = pkg.number;

    const pill = node.querySelector(".status-pill");
    pill.classList.add(statusToPillClass(pkg.status));
    pill.querySelector(".status-pill-icon").setAttribute("data-lucide", statusToIcon(pkg.status));
    pill.querySelector(".status-text").textContent = statusToLabel(pkg.status);

    node.querySelector(".courier-name").textContent = pkg.courier || "Corriere non identificato";
    node.querySelector(".transit-days").textContent =
      pkg.transitDays != null ? `${pkg.transitDays} giorn${pkg.transitDays === 1 ? "o" : "i"} in viaggio` : "In attesa di eventi";

    node.querySelector(".status-detail").textContent = pkg.detail || "";
    node.querySelector(".last-update").textContent = formatRelativeTime(pkg.lastUpdate);

    renderStepper(node, pkg.status);
    renderHistory(node, pkg.events);

    if (pkg._justDelivered) {
      card.classList.add("just-delivered");
      pkg._justDelivered = false; // l'evidenziazione è una tantum, non va riproposta ai render successivi
    }

    node.querySelector(".remove-btn").addEventListener("click", () => removePackage(pkg.id));
    node.querySelector(".refresh-btn").addEventListener("click", () => refreshPackage(pkg.id));
    node.querySelector(".copy-btn").addEventListener("click", (ev) => {
      navigator.clipboard.writeText(pkg.number);
      const btn = ev.currentTarget;
      btn.classList.add("copied");
      clearTimeout(btn._copyTimeout);
      btn._copyTimeout = setTimeout(() => btn.classList.remove("copied"), 1400);
    });

    packagesList.appendChild(node);
  });

  // Ridisegna le icone Lucide per tutti i nodi appena inseriti nel DOM
  if (window.lucide) lucide.createIcons();
}

// ------------------------------------------------------------------
// Avvio
// ------------------------------------------------------------------
initTheme();
initSettings();
renderPackages();
if (window.lucide) lucide.createIcons();
