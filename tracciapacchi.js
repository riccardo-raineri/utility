// tracciapacchi.js
// Logica del tool: salva i pacchi in localStorage, chiama il Cloudflare Worker
// (proxy verso Ship24) per registrare nuovi tracking e aggiornarne lo stato.

const THEME_KEY = "toolbox_theme";       // chiave condivisa con gli altri tool del toolbox
const WORKER_KEY = "tracciapacchi_worker_url";
const PACKAGES_KEY = "tracciapacchi_pacchi";
const MAX_PACCHI = 5;                    // limite pensato per il piano gratuito Ship24

// --- Riferimenti agli elementi della pagina ---
const themeToggle = document.getElementById("theme-toggle");
const themeIcon = document.getElementById("theme-icon");
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
// Struttura di ogni pacco: { id, label, number, trackerId, status, detail, lastUpdate }
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

// Estrae dallo schema di risposta Ship24 lo stato e l'ultimo evento utile
function parseShip24Result(data) {
  const tracking = data?.data?.trackings?.[0];
  if (!tracking) return { status: "pending", detail: "In attesa di aggiornamenti", trackerId: null };

  const milestone = tracking.shipment?.statusMilestone || "pending";
  const events = tracking.events || [];
  const lastEvent = events[0]; // Ship24 restituisce gli eventi dal più recente

  return {
    trackerId: tracking.tracker?.trackerId || null,
    status: milestone,
    detail: lastEvent
      ? `${lastEvent.status || ""}${lastEvent.location ? " · " + lastEvent.location : ""}`
      : "Nessun evento disponibile ancora",
  };
}

function statusToClass(status) {
  if (status === "delivered") return "status-delivered";
  if (["exception", "failed_attempt", "return_to_sender"].includes(status)) return "status-exception";
  if (["info_received", "pending"].includes(status)) return "status-pending";
  return "status-transit"; // in_transit, out_for_delivery, ecc.
}

function statusToLabel(status) {
  const labels = {
    pending: "In attesa",
    info_received: "Informazioni ricevute",
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

  try {
    const data = await callWorker({ action: "results", trackerId: pkg.trackerId });
    const parsed = parseShip24Result(data);
    pkg.status = parsed.status;
    pkg.detail = parsed.detail;
    pkg.lastUpdate = new Date().toISOString();
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
// Rendering della lista pacchi
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

function renderPackages() {
  const packages = getPackages();
  packagesList.innerHTML = "";
  packagesCount.textContent = `${packages.length}/${MAX_PACCHI}`;
  emptyState.hidden = packages.length > 0;

  packages.forEach((pkg) => {
    const node = cardTemplate.content.cloneNode(true);
    node.querySelector(".package-label").textContent = pkg.label;
    node.querySelector(".package-number").textContent = pkg.number;
    node.querySelector(".status-dot").classList.add(statusToClass(pkg.status));
    node.querySelector(".status-text").textContent = statusToLabel(pkg.status);
    node.querySelector(".status-detail").textContent = pkg.detail || "";
    node.querySelector(".last-update").textContent = formatRelativeTime(pkg.lastUpdate);

    node.querySelector(".remove-btn").addEventListener("click", () => removePackage(pkg.id));
    node.querySelector(".refresh-btn").addEventListener("click", () => refreshPackage(pkg.id));

    packagesList.appendChild(node);
  });
}

// ------------------------------------------------------------------
// Avvio
// ------------------------------------------------------------------
initTheme();
initSettings();
renderPackages();
