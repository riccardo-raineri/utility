// tracciapacchi.js
// Versione Ottimizzata con Batch Update e Archiviazione

// Configurazione base: il frontend comunica solo con il tuo Web App (Apps Script)
const SHIP24_WORKER_URL = "https://tracciapacchi.riccardo-05e.workers.dev";
const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbwgrOF6_i4RTPUHxtjVDkK4uP_uP8bnu8UhKK8qT9XBBr0fGkSpYJ7BhdIWAe1jdrGC/exec";
const APPS_SCRIPT_TOKEN = "0712";

const THEME_KEY = "toolbox_theme";
const MAX_PACCHI = 5;

// Ordine delle tappe principali usato dallo stepper visivo
const MILESTONE_ORDER = ["info_received", "in_transit", "out_for_delivery", "delivered"];
const EXCEPTION_STATUSES = ["exception", "failed_attempt", "return_to_sender"];

// Cache locale dei pacchi
let packagesCache = [];

// --- Riferimenti agli elementi della pagina ---
const themeToggle = document.getElementById("theme-toggle");
const configWarning = document.getElementById("config-warning");
const addForm = document.getElementById("add-form");
const inputLabel = document.getElementById("input-label");
const inputNumber = document.getElementById("input-number");
const addError = document.getElementById("add-error");
const packagesList = document.getElementById("packages-list");
const packagesCount = document.getElementById("packages-count");
const loadingState = document.getElementById("loading-state");
const emptyState = document.getElementById("empty-state");
const refreshAllBtn = document.getElementById("refresh-all");
const cardTemplate = document.getElementById("package-card-template");
const statsRow = document.getElementById("stats-row");

// ------------------------------------------------------------------
// Utility
// ------------------------------------------------------------------
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function updateIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function isPlaceholder(value) {
  return !value || value.trim() === "" || value.includes("INSERISCI_QUI");
}

function isConfigured() {
  return !isPlaceholder(SHIP24_WORKER_URL) && !isPlaceholder(APPS_SCRIPT_URL) && !isPlaceholder(APPS_SCRIPT_TOKEN);
}


// ------------------------------------------------------------------
// Tema chiaro/scuro
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
// Storage condiviso: Google Sheet via Apps Script
// ------------------------------------------------------------------
async function loadPackages() {
  loadingState.hidden = false;
  packagesList.innerHTML = "";
  try {
    const res = await fetch(`${APPS_SCRIPT_URL}?token=${encodeURIComponent(APPS_SCRIPT_TOKEN)}`);
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    packagesCache = data.packages || [];
  } catch (err) {
    loadingState.hidden = true;
    packagesList.innerHTML = `<p class="loading-state error">Impossibile caricare i pacchi. Controlla la connessione o l'URL dello script.</p>`;
    return;
  }
  loadingState.hidden = true;
  renderPackages();
}

async function sheetRequest(action, pacco) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ token: APPS_SCRIPT_TOKEN, action, pacco }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error);
  return data;
}

async function callWorker(payload) {
  const res = await fetch(SHIP24_WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Errore dal Worker (${res.status})`);
  return res.json();
}

function extractCourierName(shipment, tracker) {
  let code = shipment?.courierCode ?? tracker?.courierCode;
  if (Array.isArray(code)) code = code[0];
  if (!code) return null;
  return code.toString().replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function parseShip24Result(data) {
  const tracking = data?.data?.trackings?.[0];
  if (!tracking) return { status: "pending", detail: "In attesa di aggiornamenti", trackerId: null, courier: null, events: [] };
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

function computeTransitDays(events, status) {
  if (!events || events.length === 0) return null;
  const dated = events.filter((e) => e.datetime);
  if (dated.length === 0) return null;
  const first = new Date(dated[dated.length - 1].datetime);
  const end = status === "delivered" && dated[0].datetime ? new Date(dated[0].datetime) : new Date();
  return Math.max(0, Math.round((end - first) / 86400000));
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
      id: generateUUID(),
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
    await sheetRequest("add", pkg);
    packagesCache.push(pkg);
    renderPackages();
    inputLabel.value = "";
    inputNumber.value = "";
  } catch (err) {
    addError.textContent = "Errore durante l'aggiunta. Controlla il numero o la configurazione.";
    addError.hidden = false;
  }
});

// ------------------------------------------------------------------
// Aggiornamento e Gestione
// ------------------------------------------------------------------

// Aggiornamento singola card
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
    await sheetRequest("update", pkg);
    renderPackages();
  } catch (err) { console.error(err); }
}

// AGGIORNAMENTO VELOCE (BATCH)
async function batchRefreshAll() {
  loadingState.hidden = false;
  try {
    const res = await fetch(APPS_SCRIPT_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ token: APPS_SCRIPT_TOKEN, action: "batch_update" }),
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    if (data.packages) packagesCache = data.packages;
  } catch (err) {
    addError.textContent = "Errore durante l'aggiornamento massivo.";
    addError.hidden = false;
  }
  loadingState.hidden = true;
  renderPackages();
}

refreshAllBtn.addEventListener("click", batchRefreshAll);

async function archivePackage(id) {
  if (!confirm("Vuoi archiviare questo pacco? Sparirà dalla lista principale.")) return;
  try {
    await sheetRequest("archive", { id });
    packagesCache = packagesCache.filter((p) => p.id !== id);
    renderPackages();
  } catch (err) {
    addError.textContent = "Errore durante l'archiviazione.";
    addError.hidden = false;
  }
}

async function removePackage(id) {
  if (!confirm("Rimuovere definitivamente il pacco?")) return;
  try {
    await sheetRequest("remove", { id });
    packagesCache = packagesCache.filter((p) => p.id !== id);
    renderPackages();
  } catch (err) {
    addError.textContent = "Errore nella rimozione.";
    addError.hidden = false;
  }
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
  return `Aggiornato ${Math.round(diffH / 24)} g fa`;
}

function formatEventDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return isNaN(d) ? "" : d.toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
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
  if (!events || events.length === 0) { toggleBtn.hidden = true; return; }
  toggleBtn.hidden = false;
  toggleText.textContent = `Mostra cronologia (${events.length} event${events.length === 1 ? "o" : "i})`;
  events.forEach((ev) => {
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML = `<div class="h-status">${ev.status}</div><div class="h-meta">${[formatEventDate(ev.datetime), ev.location].filter(Boolean).join(" · ")}</div>`;
    list.appendChild(li);
  });
  toggleBtn.onclick = () => {
    const isOpen = wrap.classList.toggle("open");
    toggleBtn.setAttribute("aria-expanded", String(isOpen));
    toggleText.textContent = isOpen ? "Nascondi cronologia" : `Mostra cronologia (${events.length} event${events.length === 1 ? "o" : "i})`;
  };
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
    node.querySelector(".transit-days").textContent = pkg.transitDays != null ? `${pkg.transitDays} giorn${pkg.transitDays === 1 ? "o" : "i} in viaggio` : "In attesa di eventi";
    node.querySelector(".status-detail").textContent = pkg.detail || "";
    node.querySelector(".last-update").textContent = formatRelativeTime(pkg.lastUpdate);

    renderStepper(node, pkg.status);
    renderHistory(node, pkg.events);

    // Gestione tasto Archivia (visibile solo se consegnato)
    const archiveBtn = node.querySelector(".archive-btn");
    if (pkg.status === "delivered") {
      archiveBtn.style.display = "flex";
      archiveBtn.onclick = () => archivePackage(pkg.id);
    } else {
      archiveBtn.style.display = "none";
    }

    if (pkg._justDelivered) { card.classList.add("just-delivered"); pkg._justDelivered = false; }

    node.querySelector(".remove-btn").onclick = () => removePackage(pkg.id);
    node.querySelector(".refresh-btn").onclick = () => refreshPackage(pkg.id);
    node.querySelector(".copy-btn").onclick = (ev) => {
      navigator.clipboard.writeText(pkg.number);
      const btn = ev.currentTarget;
      btn.classList.add("copied");
      setTimeout(() => btn.classList.remove("copied"), 1400);
    };
    packagesList.appendChild(node);
  });
  updateIcons();
}


// --- Avvio ---
document.addEventListener("DOMContentLoaded", () => {
  try {
    initTheme();
    updateIcons();
    if (isConfigured()) {
      configWarning.hidden = true;
      loadPackages();
    } else {
      configWarning.hidden = false;
      loadingState.hidden = true;
    }
  } catch (err) {
    console.error("Errore critico durante l'avvio di TracciaPacchi:", err);
    loadingState.innerHTML = `<p class="loading-state error">Errore di sistema: ${err.message}</p>`;
  }
});