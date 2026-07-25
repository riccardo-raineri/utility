const DATA_BASE = "data/carburanti/";
const CARBURANTI = ["Benzina", "Gasolio", "GPL", "Metano", "Benzina Premium", "Gasolio Premium"];

// Stato dell'applicazione
const stato = {
  manifest: null,
  cacheRegioni: new Map(),
  stazioniGeo: null,

  modalita: "zona",            // "zona" | "geo"
  regione: "",
  provincia: "",
  comune: "",
  raggioKm: 10,
  posizioneUtente: null,       // {lat, lon}

  carburante: "Benzina",
  filtroSelf: "tutti",         // "tutti" | "self" | "servito"
  ordinamento: "prezzo",       // "prezzo" | "distanza"

  // Mappa Leaflet
  map: null,
  markersGroup: null,
  tileLayer: null
};

// -------------------------------------------------------------------------
// Utility
// -------------------------------------------------------------------------

function slugRegione(nome) {
  return nome.toLowerCase().replaceAll("'", "-").replaceAll(" ", "-");
}

function distanzaKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formattaPrezzo(valore) {
  return valore.toFixed(3).replace(".", ",");
}

function formattaData(iso) {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

async function fetchJSON(percorso) {
  const risposta = await fetch(percorso, { cache: "no-cache" });
  if (!risposta.ok) {
    throw new Error(`Impossibile scaricare ${percorso} (HTTP ${risposta.status})`);
  }
  return risposta.json();
}

async function caricaRegione(nomeRegione) {
  const slug = slugRegione(nomeRegione);
  if (stato.cacheRegioni.has(slug)) {
    return stato.cacheRegioni.get(slug);
  }
  const dati = await fetchJSON(`${DATA_BASE}prezzi/${slug}.json`);
  stato.cacheRegioni.set(slug, dati);
  return dati;
}

// -------------------------------------------------------------------------
// Avvio pagina
// -------------------------------------------------------------------------

async function avvia() {
  collegaEventi();
  renderPillCarburanti();
  inizializzaMappa();
  impostaTemaIniziale();

  try {
    stato.manifest = await fetchJSON(`${DATA_BASE}manifest.json`);
    popolaRegioni(stato.manifest);
    document.getElementById("update-text").textContent =
      `Dati aggiornati al ${formattaData(stato.manifest.aggiornato)} · ${stato.manifest.totaleImpianti.toLocaleString("it-IT")} impianti`;
    mostraStatoIniziale();
  } catch (errore) {
    console.error(errore);
    mostraErrore(
      "Non riesco a scaricare l'elenco delle regioni. Controlla che i file in data/carburanti/ siano presenti."
    );
  } finally {
    if (window.lucide) lucide.createIcons();
  }
}

function popolaRegioni(manifest) {
  const selectRegione = document.getElementById("select-regione");
  manifest.regioni.sort().forEach((regione) => {
    const opt = document.createElement("option");
    opt.value = regione;
    opt.textContent = regione;
    selectRegione.appendChild(opt);
  });

  aggiornaOpzioniProvincia();
}

function aggiornaOpzioniProvincia() {
  const selectProvincia = document.getElementById("select-provincia");
  const regioneScelta = document.getElementById("select-regione").value;

  selectProvincia.innerHTML = '<option value="">Tutte</option>';

  const province = stato.manifest.province
    .filter((p) => !regioneScelta || p.regione === regioneScelta)
    .sort((a, b) => a.sigla.localeCompare(b.sigla));

  province.forEach(({ sigla }) => {
    const opt = document.createElement("option");
    opt.value = sigla;
    opt.textContent = sigla;
    selectProvincia.appendChild(opt);
  });
}

function renderPillCarburanti() {
  const contenitore = document.getElementById("fuel-pills");
  contenitore.innerHTML = "";
  CARBURANTI.forEach((nome) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "fuel-pill" + (nome === stato.carburante ? " active" : "");
    btn.textContent = nome;
    btn.addEventListener("click", () => {
      stato.carburante = nome;
      renderPillCarburanti();
      eseguiRicerca();
    });
    contenitore.appendChild(btn);
  });
}

function mostraStatoIniziale() {
  document.getElementById("map-section").style.display = "none";
  const area = document.getElementById("results-area");
  area.innerHTML = `
    <div class="state-message">
      Seleziona una regione, una provincia, un comune, oppure usa
      "Vicino a me" per iniziare la ricerca.
    </div>`;
}

// -------------------------------------------------------------------------
// Gestione Mappa (Leaflet.js)
// -------------------------------------------------------------------------

function inizializzaMappa() {
  if (typeof L === "undefined") return;
  // Centro iniziale sull'Italia
  stato.map = L.map('map').setView([41.9028, 12.4964], 6);
  stato.markersGroup = L.layerGroup().addTo(stato.map);
}

function aggiornaTileMappa() {
  if (!stato.map) return;

  if (stato.tileLayer) {
    stato.map.removeLayer(stato.tileLayer);
  }
  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const urlTile = isDark
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
    : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';

  stato.tileLayer = L.tileLayer(urlTile, {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
  }).addTo(stato.map);
}

function aggiornaMappa(elenco) {
  if (!stato.map) return;

  const mapSection = document.getElementById("map-section");
  stato.markersGroup.clearLayers();

  const impiantiConCoordinate = elenco.filter(i => i.lat && i.lon);

  if (impiantiConCoordinate.length === 0) {
    mapSection.style.display = "none";
    return;
  }

  mapSection.style.display = "block";
  stato.map.invalidateSize();

  const bounds = [];

  impiantiConCoordinate.forEach((imp) => {
    const lat = Number(imp.lat);
    const lon = Number(imp.lon);
    bounds.push([lat, lon]);

    const marker = L.marker([lat, lon]);
    const popupContent = `
      <div class="popup-title">${escapeHTML(imp.bandiera)} · ${escapeHTML(imp.nome)}</div>
      <div>${escapeHTML(imp.indirizzo)}, ${escapeHTML(imp.comune)}</div>
      <div style="margin-top:4px; font-size: 0.78rem; opacity:0.8;">${imp.prezzoInfo.self ? "Self-Service" : "Servito"}</div>
      <div class="popup-price">€ ${formattaPrezzo(imp.prezzoInfo.prezzo)}/l</div>
    `;
    marker.bindPopup(popupContent);
    stato.markersGroup.addLayer(marker);
  });

  if (bounds.length > 0) {
    stato.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
  }
}

// -------------------------------------------------------------------------
// Gestione Eventi UI
// -------------------------------------------------------------------------

function collegaEventi() {
  document.querySelectorAll(".search-modes button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".search-modes button").forEach((b) => {
        b.classList.remove("active");
        b.setAttribute("aria-selected", "false");
      });
      btn.classList.add("active");
      btn.setAttribute("aria-selected", "true");

      stato.modalita = btn.dataset.mode;
      const isGeo = stato.modalita === "geo";
      document.getElementById("fields-zona").style.display = isGeo ? "none" : "grid";
      document.getElementById("fields-geo").style.display = isGeo ? "grid" : "none";
      document.getElementById("geo-status").textContent = "";

      const optDistanza = document.getElementById("opt-distanza");
      optDistanza.disabled = !isGeo;
      if (isGeo) {
        stato.ordinamento = "distanza";
        document.getElementById("select-ordina").value = "distanza";
      } else {
        stato.ordinamento = "prezzo";
        document.getElementById("select-ordina").value = "prezzo";
      }

      if (isGeo && stato.posizioneUtente) {
        eseguiRicerca();
      } else if (!isGeo) {
        aggiornaRicercaZona();
      }
    });
  });

  document.getElementById("select-regione").addEventListener("change", () => {
    stato.regione = document.getElementById("select-regione").value;
    stato.provincia = "";
    document.getElementById("select-provincia").value = "";
    aggiornaOpzioniProvincia();
    aggiornaRicercaZona();
  });

  document.getElementById("select-provincia").addEventListener("change", () => {
    stato.provincia = document.getElementById("select-provincia").value;
    if (stato.provincia) {
      const info = stato.manifest.province.find((p) => p.sigla === stato.provincia);
      if (info && info.regione !== stato.regione) {
        stato.regione = info.regione;
        document.getElementById("select-regione").value = info.regione;
      }
    }
    aggiornaRicercaZona();
  });

  let timerComune = null;
  document.getElementById("input-comune").addEventListener("input", () => {
    clearTimeout(timerComune);
    timerComune = setTimeout(() => {
      stato.comune = document.getElementById("input-comune").value.trim();
      aggiornaRicercaZona();
    }, 350);
  });

  document.getElementById("select-raggio").addEventListener("change", (e) => {
    stato.raggioKm = Number(e.target.value);
    if (stato.posizioneUtente) eseguiRicerca();
  });
  document.getElementById("btn-geo").addEventListener("click", richiediPosizione);

  document.querySelectorAll("#self-filter button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#self-filter button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      stato.filtroSelf = btn.dataset.self;
      eseguiRicerca();
    });
  });

  document.getElementById("select-ordina").addEventListener("change", (e) => {
    stato.ordinamento = e.target.value;
    eseguiRicerca();
  });

  document.getElementById("theme-toggle").addEventListener("click", cambiaTema);
}

function aggiornaRicercaZona() {
  if (stato.regione || stato.provincia || stato.comune) {
    eseguiRicerca();
  } else {
    mostraStatoIniziale();
  }
}

// -------------------------------------------------------------------------
// Geolocalizzazione
// -------------------------------------------------------------------------

function richiediPosizione() {
  const statusEl = document.getElementById("geo-status");

  if (!("geolocation" in navigator)) {
    statusEl.textContent = "Il tuo browser non supporta la geolocalizzazione.";
    statusEl.classList.add("error");
    return;
  }

  statusEl.classList.remove("error");
  statusEl.textContent = "Individuo la tua posizione…";

  navigator.geolocation.getCurrentPosition(
    (posizione) => {
      stato.posizioneUtente = {
        lat: posizione.coords.latitude,
        lon: posizione.coords.longitude,
      };
      statusEl.textContent = "Posizione trovata.";
      eseguiRicerca();
    },
    (errore) => {
      statusEl.classList.add("error");
      if (errore.code === errore.PERMISSION_DENIED) {
        statusEl.textContent = "Permesso negato. Consenti l'accesso alla posizione nel tuo browser.";
      } else {
        statusEl.textContent = "Non riesco a determinare la tua posizione. Riprova.";
      }
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

// -------------------------------------------------------------------------
// Ricerca
// -------------------------------------------------------------------------

async function eseguiRicerca() {
  mostraCaricamento();
  try {
    if (stato.modalita === "geo") {
      await eseguiRicercaGeo();
    } else {
      await eseguiRicercaZonaEffettiva();
    }
  } catch (errore) {
    console.error(errore);
    mostraErrore("Qualcosa è andato storto durante il caricamento dei dati.");
  }
}

async function eseguiRicercaZonaEffettiva() {
  let regioniDaCaricare;

  if (stato.regione) {
    regioniDaCaricare = [stato.regione];
  } else if (stato.provincia) {
    const info = stato.manifest.province.find((p) => p.sigla === stato.provincia);
    regioniDaCaricare = info ? [info.regione] : [];
  } else {
    regioniDaCaricare = stato.manifest.regioni;
  }

  const datiRegioni = await Promise.all(regioniDaCaricare.map(caricaRegione));

  let impianti = [];
  datiRegioni.forEach((dati) => {
    const mediaRegionale = dati.mediaRegionale[stato.carburante];
    dati.impianti.forEach((imp) => {
      impianti.push({ ...imp, mediaRegionale });
    });
  });

  if (stato.provincia) {
    impianti = impianti.filter((imp) => imp.provincia === stato.provincia);
  }
  if (stato.comune) {
    const cercato = stato.comune.toLowerCase();
    impianti = impianti.filter((imp) => imp.comune.toLowerCase().includes(cercato));
  }

  renderizzaRisultati(filtraEOrdina(impianti));
}

async function eseguiRicercaGeo() {
  if (!stato.posizioneUtente) {
    mostraMessaggio("Premi \"Usa la mia posizione\" per cercare i distributori più vicini.");
    return;
  }

  if (!stato.stazioniGeo) {
    stato.stazioniGeo = await fetchJSON(`${DATA_BASE}stazioni-geo.json`);
  }

  const { lat, lon } = stato.posizioneUtente;
  const vicine = stato.stazioniGeo
    .map((s) => ({ ...s, distanzaKm: distanzaKm(lat, lon, s.lat, s.lon) }))
    .filter((s) => s.distanzaKm <= stato.raggioKm)
    .sort((a, b) => a.distanzaKm - b.distanzaKm);

  if (vicine.length === 0) {
    mostraMessaggio(`Nessun distributore trovato entro ${stato.raggioKm} km. Prova ad aumentare il raggio.`);
    return;
  }

  const regioniCoinvolte = [...new Set(vicine.map((s) => s.regione))];
  const datiRegioni = await Promise.all(regioniCoinvolte.map(caricaRegione));

  const impiantiPerId = new Map();
  datiRegioni.forEach((dati) => {
    const mediaRegionale = dati.mediaRegionale[stato.carburante];
    dati.impianti.forEach((imp) => impiantiPerId.set(imp.id, { ...imp, mediaRegionale }));
  });

  const impianti = vicine
    .map((s) => {
      const dettagli = impiantiPerId.get(s.id);
      return dettagli ? { ...dettagli, lat: s.lat, lon: s.lon, distanzaKm: s.distanzaKm } : null;
    })
    .filter(Boolean);

  renderizzaRisultati(filtraEOrdina(impianti));
}

function filtraEOrdina(impianti) {
  let elenco = impianti
    .map((imp) => {
      const prezzoInfo = imp.prezzi.find((p) => p.carburante === stato.carburante);
      return prezzoInfo ? { ...imp, prezzoInfo } : null;
    })
    .filter(Boolean);

  if (stato.filtroSelf === "self") {
    elenco = elenco.filter((imp) => imp.prezzoInfo.self);
  } else if (stato.filtroSelf === "servito") {
    elenco = elenco.filter((imp) => !imp.prezzoInfo.self);
  }

  if (stato.ordinamento === "distanza" && elenco.some((i) => i.distanzaKm !== undefined)) {
    elenco.sort((a, b) => a.distanzaKm - b.distanzaKm);
  } else {
    elenco.sort((a, b) => a.prezzoInfo.prezzo - b.prezzoInfo.prezzo);
  }

  return elenco;
}

// -------------------------------------------------------------------------
// Rendering
// -------------------------------------------------------------------------

function mostraCaricamento() {
  document.getElementById("map-section").style.display = "none";
  const area = document.getElementById("results-area");
  area.innerHTML = `
    <div class="state-message">
      <div class="spinner" aria-hidden="true"></div>
      Cerco i distributori…
    </div>`;
}

function mostraMessaggio(testo) {
  document.getElementById("map-section").style.display = "none";
  document.getElementById("results-area").innerHTML = `<div class="state-message">${testo}</div>`;
}

function mostraErrore(testo) {
  document.getElementById("map-section").style.display = "none";
  document.getElementById("results-area").innerHTML = `<div class="state-message error">${testo}</div>`;
}

const LIMITE_RISULTATI_MOSTRATI = 50;

function renderizzaRisultati(elenco) {
  const area = document.getElementById("results-area");

  if (elenco.length === 0) {
    mostraMessaggio(`Nessun distributore trovato con ${stato.carburante} per questa zona/filtro.`);
    return;
  }

  aggiornaMappa(elenco);

  const [primo, ...resto] = elenco;
  const daMostrare = resto.slice(0, LIMITE_RISULTATI_MOSTRATI - 1);

  area.innerHTML = `
    ${renderMiglioreRisultato(primo)}
    <div class="results-list">
      ${daMostrare.map((imp, i) => renderRigaRisultato(imp, i + 2)).join("")}
    </div>
    <p class="results-footer">
      ${elenco.length} distributori trovati con ${stato.carburante}
      ${elenco.length > LIMITE_RISULTATI_MOSTRATI ? ` · ne mostro i primi ${LIMITE_RISULTATI_MOSTRATI}` : ""}
    </p>`;

  if (window.lucide) lucide.createIcons();
}

function renderDelta(imp) {
  if (imp.mediaRegionale === undefined || imp.mediaRegionale === null) return "";
  const diff = imp.prezzoInfo.prezzo - imp.mediaRegionale;
  const classe = diff <= 0 ? "below" : "above";
  const segno = diff <= 0 ? "" : "+";
  return `<span class="delta ${classe}">${segno}${formattaPrezzo(diff)} € vs media</span>`;
}

function renderMiglioreRisultato(imp) {
  return `
    <div class="best-result">
      <div>
        <div class="label"><i data-lucide="award"></i> Prezzo più basso trovato</div>
        <div class="station-name">${escapeHTML(imp.bandiera)} · ${escapeHTML(imp.nome)}</div>
        <div class="station-meta">
          <i data-lucide="map-pin"></i> ${escapeHTML(imp.indirizzo)}, ${escapeHTML(imp.comune)} (${imp.provincia})
          ${imp.distanzaKm !== undefined ? ` · <i data-lucide="navigation"></i> ${imp.distanzaKm.toFixed(1)} km` : ""}
          <span class="badge-self">${imp.prezzoInfo.self ? "Self" : "Servito"}</span>
        </div>
        ${renderDelta(imp)}
      </div>
      <div class="price-display">${formattaPrezzo(imp.prezzoInfo.prezzo)}<span class="unit">€/l</span></div>
    </div>`;
}

function renderRigaRisultato(imp, posizione) {
  return `
    <div class="result-row">
      <div class="rank">${posizione}</div>
      <div>
        <div class="name">${escapeHTML(imp.bandiera)} · ${escapeHTML(imp.nome)}</div>
        <div class="meta">
          <i data-lucide="map-pin"></i> ${escapeHTML(imp.indirizzo)}, ${escapeHTML(imp.comune)} (${imp.provincia})
          ${imp.distanzaKm !== undefined ? ` · <i data-lucide="navigation"></i> ${imp.distanzaKm.toFixed(1)} km` : ""}
          <span class="badge-self">${imp.prezzoInfo.self ? "Self" : "Servito"}</span>
        </div>
      </div>
      <div class="price-col">
        <span class="price num">${formattaPrezzo(imp.prezzoInfo.prezzo)} €</span>
        ${renderDelta(imp)}
      </div>
    </div>`;
}

function escapeHTML(testo) {
  const div = document.createElement("div");
  div.textContent = testo ?? "";
  return div.innerHTML;
}

// -------------------------------------------------------------------------
// Tema Chiaro / Scuro
// -------------------------------------------------------------------------

function impostaTemaIniziale() {
  const salvato = localStorage.getItem("carburanti-theme");
  const tema = salvato || "dark";
  applicaTema(tema);
}

function cambiaTema() {
  const attuale = document.documentElement.getAttribute("data-theme");
  const nuovo = attuale === "dark" ? "light" : "dark";
  applicaTema(nuovo);
  localStorage.setItem("carburanti-theme", nuovo);
}

function applicaTema(tema) {
  document.documentElement.setAttribute("data-theme", tema);
  const iconBox = document.getElementById("theme-icon-box");
  if (iconBox) {
    iconBox.innerHTML = tema === "dark" ? '<i data-lucide="moon"></i>' : '<i data-lucide="sun"></i>';
    if (window.lucide) lucide.createIcons();
  }
  aggiornaTileMappa();
}

// -------------------------------------------------------------------------
avvia();