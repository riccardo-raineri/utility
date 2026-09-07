// tracciapacchi.js
// Logica del tool. I pacchi non sono più salvati in localStorage: vivono in un
// Google Sheet condiviso, letto e scritto tramite Apps Script, così la lista
// è identica su ogni dispositivo. Ship24 resta dietro al Cloudflare Worker.

// ------------------------------------------------------------------
// CONFIGURAZIONE — valorizza queste tre costanti dopo il deploy
// ------------------------------------------------------------------
const SHIP24_WORKER_URL = "";   // es. "https://tracciapacchi.riccardo-05e.workers.dev"
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbz_vqKk59Umc6d_iB79jWfGHuU8TCPMvRF_UX2gk3nRJ8v7mSr9VlbDpiXgNTSoa95f/exec";     // es. "https://script.google.com/macros/s/AKfycb.../exec"
const APPS_SCRIPT_TOKEN = "0712";   // lo stesso token scelto in Code.gs

const THEME_KEY = "toolbox_theme"; // chiave condivisa con gli altri tool del toolbox, resta locale per dispositivo
const MAX_PACCHI = 5;              // limite pensato per il piano gratuito Ship24

// Ordine delle tappe principali usato dallo stepper visivo
const MILESTONE_ORDER = ["info_received", "in_transit", "out_for_delivery", "delivered"];
const EXCEPTION_STATUSES = ["exception", "failed_attempt", "return_to_sender"];

// --- Riferimenti agli elementi della pagina ---
const themeToggle = document.getElementById("theme-toggle");
const configWarning = document.getElementById("config-warning");
const addForm = document.getElementById("add-form");
const inputLabel = document.getElementById("input-label");
const inputNumber = document.getElementById("input-number");
const addError = document.getElementById("add-error");
const packagesList = document.getElementById("packages-list");
const packagesCount = document.getElementById("packages-count");
const emptyState = document.getElementById("empty-state");
const loadingState = document.getElementById("loading-state");
const refreshAllBtn = document.getElementById("refresh-all");
const cardTemplate = document.getElementById("package-card-template");
const statsRow = document.getElementById("stats-row");

// Cache in memoria della lista pacchi, sincronizzata col foglio Google
let packagesCache = [];

// ------------------------------------------------------------------
// Tema chiaro/scuro (stesso pattern degli altri tool del toolbox, resta locale)
// ------------------------------------------------------------------
function applyTheme(theme) {
  document.body.classList.toggle("theme-dark", theme === "dark");
}
function initTheme() {
  applyTheme(localStorage.getItem(THEME_KEY) || "light");
}
themeToggle.addEventListener("click", () => {
  const next = (localStorage.getItem(THEME_KEY) || "light") === "light" ? "dark" : "light";
  localStorage.setItem(THEME_KEY, next);
  applyTheme(next);
});

// ------------------------------------------------------------------
// Storage remoto: Apps Script + Google Sheet
// ------------------------------------------------------------------
function isConfigured() {
  return Boolean(SHIP24_WORKER_URL && APPS_SCRIPT_URL && APPS_SCRIPT_TOKEN);
}

async function fetchPackagesRemote() {
  const url = `${APPS_SCRIPT_URL}?token=${encodeURIComponent(APPS_SCRIPT_TOKEN)}&action=list`;
  const res = await fetch(url);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Errore nel recupero pacchi");
  return data.packages || [];
}

async function addPackageRemote(pkg) {
  await callAppsScript({ action: "add", package: pkg });
}
async function updatePackageRemote(pkg) {
  await callAppsScript({ action: "update", package: pkg });
}
async function removePackageRemote(id) {
  await callAppsScript({ action: "remove", id });
}
async function callAppsScript(body) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token: APPS_SCRIPT_TOKEN, ...body }),
  });
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "Errore nella scrittura sul foglio");
  return data;
}

// ------------------------------------------------------------------
// Chiamate al Worker Ship24
// ------------------------------------------------------------------
async function callWorker(payload) {
  const res = await fetch(SHIP24_WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Errore dal Worker (${res.status})`);
  return res.json();
}

// Ship24 rileva automaticamente il corriere dal formato del numero di tracking
// e lo restituisce come courierCode (es. "poste-italiane", "gls-italy").
// Qui lo trasformiamo in un nome leggibile ("Poste Italiane").
function extractCourierName(shipment, tracker) {
  let code = shipment?.courierCode ?? tracker?.courierCode;
  if (Array.isArray(code)) code = code[0];
  if (!code) return null;
  return code.toString().replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

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
    detail: lastEvent ? `${lastEvent.status}${lastEvent.location ? " · " + lastEvent.location : ""}` : "Nessun evento disponibile ancora",
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
    pending: "In attesa", info_received: "Registrato", in_transit: "In transito",
    out_for_delivery: "In consegna", delivered: "Consegnato", exception: "Anomalia",
    failed_attempt: "Consegna fallita", return_to_sender: "Reso al mittente",
    available_for_pickup: "Pronto per il ritiro",
  };
  return labels[status] || "Stato sconosciuto";
}
function computeTransitDays(events, status) {
  if (!events || events.length === 0) return null;
  const dated = events.filter((e) => e.datetime);
  if (dated.length === 0) return null;
  const first = new Date(dated[dated.length - 1].datetime);
  const end = status === "delivered" && dated[0].datetime ? new Date(dated[0].datetime) : new Date();
  return Math.max(0, Math.round((end - first) / 86400000));
}

// ------------------------------------------------------------------
// Caricamento iniziale
// ------------------------------------------------------------------
async function loadPackages() {
  loadingState.hidden = false;
  packagesList.hidden = true;
  try {
    packagesCache = await fetchPackagesRemote();
  } catch (err) {
    addError.textContent = "Non è stato possibile caricare i pacchi dal foglio Google. Controlla APPS_SCRIPT_URL e il token.";
    addError.hidden = false;
    packagesCache = [];
  }
  loadingState.hidden = true;
  packagesList.hidden = false;
  renderPackages();
}

// ------------------------------------------------------------------
// Aggiunta di un nuovo pacco
// ------------------------------------------------------------------
addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  addError.hidden = true;

  if (packagesCache.length >= MAX_PACCHI) {
    addError.textContent = `Puoi tracciare al massimo ${MAX_PACCHI} pacchi contemporaneamente.`;
    addError.hidden = false;
    return;
  }

  const number = inputNumber.value.trim();
  if (!number) return;
  const label = inputLabel.value.trim() || `Pacco ${packagesCache.length + 1}`;

  try {
    const data = await callWorker({ action: "track", trackingNumber: number });
    const parsed = parseShip24Result(data);

    const pkg = {
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
    };

    await addPackageRemote(pkg);
    packagesCache.push(pkg);
    renderPackages();

    inputLabel.value = "";
    inputNumber.value = "";
  } catch (err) {
    addError.textContent = "Non è stato possibile registrare il pacco. Controlla il numero e la configurazione.";
    addError.hidden = false;
  }
});

// ------------------------------------------------------------------
// Aggiornamento stato di un pacco
// ------------------------------------------------------------------
async function refreshPackage(id) {
  const pkg = packagesCache.find((p) => p.id === id);
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
    pkg._justDelivered = !wasDelivered && pkg.status === "delivered";

    await updatePackageRemote(pkg);
    renderPackages();
  } catch {
    // In caso di errore silenzioso, lo stato mostrato resta quello precedente
  }
}
refreshAllBtn.addEventListener("click", () => {
  packagesCache.forEach((p) => refreshPackage(p.id));
});

// ------------------------------------------------------------------
// Rimozione pacco
// ------------------------------------------------------------------
async function removePackage(id) {
  try {
    await removePackageRemote(id);
    packagesCache = packagesCache.filter((p) => p.id !== id);
    renderPackages();
  } catch {
    addError.textContent = "Non è stato possibile rimuovere il pacco dal foglio.";
    addError.hidden = false;
  }
}

// ------------------------------------------------------------------
// Rendering (invariato nella logica visiva rispetto alla versione precedente)
// ------------------------------------------------------------------
function formatRelativeTime(isoString) {
  const diffMin = Math.round((Date.now() - new Date(isoString).getTime()) / 60000);
  if (diffMin < 1) return "Aggiornato ora";
  if (diffMin < 60) return `Aggiornato ${diffMin} min fa`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `Aggiornato ${diffH} h fa`;
  return `Aggiornato ${Math.round(diffH / 24)} g fa`;
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
    const stepIndex = MILESTONE_ORDER.indexOf(stepEl.dataset.step);
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
  if (!events || events.length === 0) { toggleBtn.hidden = true; return; }
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
    toggleText.textContent = isOpen ? "Nascondi cronologia" : `Mostra cronologia (${events.length} event${events.length === 1 ? "o" : "i"})`;
  });
}
function renderPackages() {
  packagesList.innerHTML = "";
  packagesCount.textContent = `${packagesCache.length}/${MAX_PACCHI}`;
  emptyState.hidden = packagesCache.length > 0;
  updateStatsRow(packagesCache);

  packagesCache.forEach((pkg) => {
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
      pkg._justDelivered = false;
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

  if (window.lucide) lucide.createIcons();
}

// ------------------------------------------------------------------
// Avvio
// ------------------------------------------------------------------
initTheme();
if (window.lucide) lucide.createIcons();

if (!isConfigured()) {
  configWarning.hidden = false;
  loadingState.hidden = true;
} else {
  loadPackages();
}
EOF
echo "JS riscritto per storage remoto"