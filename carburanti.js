/* =========================================================================
   carburanti.js
   -------------------------------------------------------------------------
   Logica della pagina "Prezzi Carburanti".

   I dati arrivano da file JSON generati quotidianamente dalla GitHub Action
   (vedi scripts/update_carburanti.py), NON dal sito del MIMIT direttamente:
   il browser scarica solo file dallo stesso dominio del sito, quindi non
   c'è nessun problema di CORS.

   File letti (percorsi relativi a questa pagina):
     data/carburanti/manifest.json         -> elenco regioni/province + data aggiornamento
     data/carburanti/stazioni-geo.json      -> tutti gli impianti (solo posizione), per "vicino a me"
     data/carburanti/prezzi/<regione>.json  -> impianti + prezzi di una singola regione

   Se sposti la cartella dei dati, aggiorna DATA_BASE qui sotto (deve
   corrispondere a OUTPUT_DIR dentro update_carburanti.py).
   ========================================================================= */

const DATA_BASE = "data/carburanti/";

// Elenco "canonico" dei carburanti mostrati come filtro, nell'ordine in
// cui vogliamo che compaiano i pulsanti. Se un carburante non ha prezzi
// nella zona selezionata, il pulsante resta comunque visibile ma la
// ricerca restituirà semplicemente zero risultati per quel carburante.
const CARBURANTI = ["Benzina", "Gasolio", "GPL", "Metano", "Benzina Premium", "Gasolio Premium"];

// -------------------------------------------------------------------------
// Stato dell'applicazione
// -------------------------------------------------------------------------

const stato = {
  manifest: null,
  // Cache dei file JSON già scaricati, per non richiederli due volte
  // nella stessa sessione di navigazione.
  cacheRegioni: new Map(),     // slugRegione -> dati regione
  stazioniGeo: null,           // popolato al primo uso della ricerca "vicino a me"

  modalita: "zona",            // "zona" | "geo"
  regione: "",
  provincia: "",
  comune: "",
  raggioKm: 10,
  posizioneUtente: null,       // {lat, lon} dopo la geolocalizzazione

  carburante: "Benzina",
  filtroSelf: "tutti",         // "tutti" | "self" | "servito"
  ordinamento: "prezzo",       // "prezzo" | "distanza"
};

// -------------------------------------------------------------------------
// Utility
// -------------------------------------------------------------------------

/** Deve produrre lo stesso slug generato da _slug() in update_carburanti.py */
function slugRegione(nome) {
  return nome.toLowerCase().replaceAll("'", "-").replaceAll(" ", "-");
}

/** Distanza in km tra due coordinate (formula dell'emisenoverso) */
function distanzaKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // raggio medio della Terra in km
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
  // "2026-07-25" -> "25/07/2026"
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

/** Scarica (con cache in memoria) il file JSON di una regione */
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
// Avvio pagina: carica il manifest e popola i filtri
// -------------------------------------------------------------------------

async function avvia() {
  impostaTemaIniziale();
  collegaEventi();
  renderPillCarburanti();

  try {
    stato.manifest = await fetchJSON(`${DATA_BASE}manifest.json`);
    popolaRegioni(stato.manifest);
    document.getElementById("update-text").textContent =
      `Dati aggiornati al ${formattaData(stato.manifest.aggiornato)} · ${stato.manifest.totaleImpianti.toLocaleString("it-IT")} impianti`;
    mostraStatoIniziale();
  } catch (errore) {
    console.error(errore);
    mostraErrore(
      "Non riesco a scaricare l'elenco delle regioni. Controlla che i file in data/carburanti/ siano stati pubblicati (la GitHub Action deve aver girato almeno una volta)."
    );
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

  aggiornaOpzioniProvincia(); // inizialmente mostra tutte le province
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
  const area = document.getElementById("results-area");
  area.innerHTML = `
    <div class="state-message">
      Seleziona una regione, una provincia, un comune, oppure usa
      "Vicino a me" per iniziare la ricerca.
    </div>`;
}

// -------------------------------------------------------------------------
// Gestione eventi UI
// -------------------------------------------------------------------------

function collegaEventi() {
  // Switch tra "Per zona" e "Vicino a me"
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

  // Ricerca per zona: regione/provincia/comune
  document.getElementById("select-regione").addEventListener("change", () => {
    stato.regione = document.getElementById("select-regione").value;
    stato.provincia = ""; // reset provincia quando cambia la regione
    document.getElementById("select-provincia").value = "";
    aggiornaOpzioniProvincia();
    aggiornaRicercaZona();
  });

  document.getElementById("select-provincia").addEventListener("change", () => {
    stato.provincia = document.getElementById("select-provincia").value;
    // Se la provincia scelta appartiene a una regione diversa da quella
    // eventualmente selezionata, allineiamo la regione di conseguenza.
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
    }, 350); // piccolo debounce mentre l'utente digita
  });

  // Ricerca vicino a me
  document.getElementById("select-raggio").addEventListener("change", (e) => {
    stato.raggioKm = Number(e.target.value);
    if (stato.posizioneUtente) eseguiRicerca();
  });
  document.getElementById("btn-geo").addEventListener("click", richiediPosizione);

  // Filtro self/servito
  document.querySelectorAll("#self-filter button").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll("#self-filter button").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      stato.filtroSelf = btn.dataset.self;
      eseguiRicerca();
    });
  });

  // Ordinamento
  document.getElementById("select-ordina").addEventListener("change", (e) => {
    stato.ordinamento = e.target.value;
    eseguiRicerca();
  });

  // Tema chiaro/scuro
  document.getElementById("theme-toggle").addEventListener("click", cambiaTema);
}

/** In modalità "per zona": avvia la ricerca solo se l'utente ha già
 * selezionato almeno un criterio, per evitare di scaricare tutte le
 * regioni d'Italia ad ogni piccola modifica involontaria. */
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
        statusEl.textContent =
          "Permesso negato. Per usare questa ricerca devi consentire l'accesso alla posizione dal browser.";
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
    mostraErrore("Qualcosa è andato storto durante il caricamento dei dati. Riprova tra poco.");
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
    // Nessuna regione/provincia scelta ma è stato digitato un comune:
    // cerchiamo in tutta Italia (i file, una volta scaricati, restano
    // in cache per il resto della sessione).
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
    mostraMessaggio("Premi \"Usa la mia posizione\" per cercare i distributori più vicini a te.");
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
    mostraMessaggio(
      `Nessun distributore trovato entro ${stato.raggioKm} km. Prova ad aumentare il raggio di ricerca.`
    );
    return;
  }

  // Carichiamo solo le regioni effettivamente coinvolte dai risultati vicini.
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
      return dettagli ? { ...dettagli, distanzaKm: s.distanzaKm } : null;
    })
    .filter(Boolean);

  renderizzaRisultati(filtraEOrdina(impianti));
}

/** Applica filtro carburante + self/servito, e ordina secondo lo stato corrente */
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
  const area = document.getElementById("results-area");
  area.innerHTML = `
    <div class="state-message">
      <div class="spinner" aria-hidden="true"></div>
      Cerco i distributori…
    </div>`;
}

function mostraMessaggio(testo) {
  document.getElementById("results-area").innerHTML = `<div class="state-message">${testo}</div>`;
}

function mostraErrore(testo) {
  document.getElementById("results-area").innerHTML = `<div class="state-message error">${testo}</div>`;
}

const LIMITE_RISULTATI_MOSTRATI = 50;

function renderizzaRisultati(elenco) {
  const area = document.getElementById("results-area");

  if (elenco.length === 0) {
    mostraMessaggio(
      `Nessun distributore trovato con ${stato.carburante} per questa zona/filtro. Prova ad allargare la ricerca.`
    );
    return;
  }

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
}

function renderDelta(imp) {
  if (imp.mediaRegionale === undefined || imp.mediaRegionale === null) return "";
  const diff = imp.prezzoInfo.prezzo - imp.mediaRegionale;
  const classe = diff <= 0 ? "below" : "above";
  const segno = diff <= 0 ? "" : "+";
  return `<span class="delta ${classe}">${segno}${formattaPrezzo(diff)} € vs media regionale</span>`;
}

function renderMiglioreRisultato(imp) {
  return `
    <div class="best-result">
      <div>
        <div class="label">Prezzo più basso trovato</div>
        <div class="station-name">${escapeHTML(imp.bandiera)} · ${escapeHTML(imp.nome)}</div>
        <div class="station-meta">
          ${escapeHTML(imp.indirizzo)}, ${escapeHTML(imp.comune)} (${imp.provincia})
          ${imp.distanzaKm !== undefined ? ` · a ${imp.distanzaKm.toFixed(1)} km` : ""}
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
          ${escapeHTML(imp.indirizzo)}, ${escapeHTML(imp.comune)} (${imp.provincia})
          ${imp.distanzaKm !== undefined ? ` · a ${imp.distanzaKm.toFixed(1)} km` : ""}
          <span class="badge-self">${imp.prezzoInfo.self ? "Self" : "Servito"}</span>
        </div>
      </div>
      <div class="price-col">
        <span class="price num">${formattaPrezzo(imp.prezzoInfo.prezzo)} €</span>
        ${renderDelta(imp)}
      </div>
    </div>`;
}

/** Piccola protezione contro l'iniezione di HTML: i dati vengono dal MIMIT
 * e non dovrebbero contenere markup, ma meglio non fidarsi mai di dati
 * esterni quando li si inserisce nella pagina. */
function escapeHTML(testo) {
  const div = document.createElement("div");
  div.textContent = testo ?? "";
  return div.innerHTML;
}

// -------------------------------------------------------------------------
// Tema chiaro/scuro (persistito in localStorage, coerente con le altre
// pagine del toolbox: scuro di default)
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
  document.getElementById("theme-toggle").textContent = tema === "dark" ? "🌙" : "☀️";
}

// -------------------------------------------------------------------------
avvia();
