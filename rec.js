/* =====================================================================
   REC — Logica applicativa
   Tutti i dati vengono salvati in localStorage sul dispositivo: non c'è
   nessun backend, quindi i dati restano solo su questo browser/telefono.
   ===================================================================== */

/* ---------------------------------------------------------------------
   UTILITY GENERICHE DI STORAGE
   Ogni modulo usa una propria chiave "kr_..." per non sovrascrivere
   i dati degli altri tool. Le funzioni gestiscono il parsing JSON e
   restituiscono sempre un array anche se la chiave non esiste ancora.
   --------------------------------------------------------------------- */
function krLoad(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : (fallback !== undefined ? fallback : []);
  }catch(e){
    console.error('Errore lettura storage', key, e);
    return fallback !== undefined ? fallback : [];
  }
}
function krSave(key, value){
  try{
    localStorage.setItem(key, JSON.stringify(value));
  }catch(e){
    console.error('Errore scrittura storage', key, e);
  }
}
function krId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
/* Ricrea le icone Lucide dopo ogni render dinamico della UI */
function krIcons(){
  if(window.lucide) lucide.createIcons();
}

/* =====================================================================
   TEMA CHIARO/SCURO
   Usa la stessa chiave "toolbox_theme" condivisa con tutti gli altri
   strumenti del toolbox, e l'attributo data-theme sul body.
   ===================================================================== */
(function initTheme(){
  const saved = localStorage.getItem('toolbox_theme');
  // Default scuro per questo strumento (uso anche in notturna sul set)
  const theme = saved === 'light' || saved === 'dark' ? saved : 'dark';
  document.body.setAttribute('data-theme', theme);

  document.getElementById('themeToggle').addEventListener('click', () => {
    const current = document.body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', next);
    localStorage.setItem('toolbox_theme', next);
  });
})();

/* =====================================================================
   NAVIGAZIONE A TAB (categorie)
   ===================================================================== */
(function initTabs(){
  const chips = document.querySelectorAll('.tab-chip');
  chips.forEach(chip => {
    chip.addEventListener('click', () => {
      chips.forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
      document.getElementById(chip.dataset.panel).classList.add('active');
    });
  });
})();

/* =====================================================================
   ACCORDION DELLE TOOL CARD
   Ogni header ha data-target = id del corpo da aprire/chiudere.
   ===================================================================== */
(function initAccordion(){
  document.querySelectorAll('.tool-header').forEach(header => {
    header.addEventListener('click', () => {
      const body = document.getElementById(header.dataset.target);
      const isOpen = body.classList.contains('open');
      body.classList.toggle('open', !isOpen);
      header.classList.toggle('open', !isOpen);
    });
  });
})();

/* =====================================================================
   HELPER: crea una riga generica per le liste (usato da più moduli)
   ===================================================================== */
function krRenderEmpty(container, message){
  container.innerHTML = `<div class="list-empty">${message}</div>`;
}

/* =====================================================================
   1) CHECKLIST ATTREZZATURA
   ===================================================================== */
(function checklistModule(){
  const KEY = 'kr_checklist';
  const form = document.getElementById('formChecklist');
  const input = document.getElementById('checklistItemInput');
  const catSelect = document.getElementById('checklistCatInput');
  const listEl = document.getElementById('checklistList');
  const progressEl = document.getElementById('checklistProgress');

  function render(){
    const items = krLoad(KEY);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessun oggetto in checklist. Aggiungi la tua attrezzatura qui sopra.');
      progressEl.textContent = '0 / 0 spuntati';
      return;
    }
    // Raggruppa per categoria mantenendo l'ordine di inserimento
    const groups = {};
    items.forEach(it => {
      if(!groups[it.cat]) groups[it.cat] = [];
      groups[it.cat].push(it);
    });
    listEl.innerHTML = Object.keys(groups).map(cat => `
      <div class="checklist-group">
        <div class="checklist-group-title">${cat.toUpperCase()}</div>
        ${groups[cat].map(it => `
          <div class="checklist-item ${it.done ? 'done' : ''}">
            <input type="checkbox" id="chk-${it.id}" ${it.done ? 'checked' : ''} data-id="${it.id}">
            <label for="chk-${it.id}">${it.text}</label>
            <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
          </div>
        `).join('')}
      </div>
    `).join('');
    const doneCount = items.filter(i => i.done).length;
    progressEl.textContent = `${doneCount} / ${items.length} spuntati`;
    krIcons();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    items.push({ id: krId(), text: input.value.trim(), cat: catSelect.value, done: false });
    krSave(KEY, items);
    input.value = '';
    render();
  });

  listEl.addEventListener('change', e => {
    if(e.target.matches('input[type="checkbox"]')){
      const items = krLoad(KEY);
      const it = items.find(i => i.id === e.target.dataset.id);
      if(it) it.done = e.target.checked;
      krSave(KEY, items);
      render();
    }
  });

  listEl.addEventListener('click', e => {
    const btn = e.target.closest('[data-del]');
    if(btn){
      const items = krLoad(KEY).filter(i => i.id !== btn.dataset.del);
      krSave(KEY, items);
      render();
    }
  });

  document.getElementById('btnChecklistReset').addEventListener('click', () => {
    const items = krLoad(KEY).map(i => ({ ...i, done: false }));
    krSave(KEY, items);
    render();
  });
  document.getElementById('btnChecklistClear').addEventListener('click', () => {
    if(confirm('Svuotare tutta la checklist?')){
      krSave(KEY, []);
      render();
    }
  });

  render();
})();

/* =====================================================================
   2) SHOT LIST
   ===================================================================== */
(function shotListModule(){
  const KEY = 'kr_shotlist';
  const form = document.getElementById('formShot');
  const listEl = document.getElementById('shotList');

  const STATI = ['da fare', 'fatto'];

  function render(){
    const items = krLoad(KEY);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessuna inquadratura pianificata.');
      return;
    }
    listEl.innerHTML = items.map(it => `
      <div class="item-row">
        <div class="item-main">
          <div class="item-title">Scena ${it.scena} — ${it.desc}</div>
          ${it.note ? `<div class="item-sub">${it.note}</div>` : ''}
        </div>
        <div class="item-actions">
          <button class="badge ${it.stato === 'fatto' ? 'badge-success' : 'badge-neutral'}" data-toggle="${it.id}">${it.stato}</button>
          <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `).join('');
    krIcons();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    items.push({
      id: krId(),
      scena: document.getElementById('shotScena').value.trim(),
      desc: document.getElementById('shotDesc').value.trim(),
      note: document.getElementById('shotNote').value.trim(),
      stato: 'da fare'
    });
    krSave(KEY, items);
    form.reset();
    render();
  });

  listEl.addEventListener('click', e => {
    const toggleBtn = e.target.closest('[data-toggle]');
    const delBtn = e.target.closest('[data-del]');
    if(toggleBtn){
      const items = krLoad(KEY);
      const it = items.find(i => i.id === toggleBtn.dataset.toggle);
      if(it) it.stato = STATI[(STATI.indexOf(it.stato) + 1) % STATI.length];
      krSave(KEY, items);
      render();
    }
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      render();
    }
  });

  render();
})();

/* =====================================================================
   3) LOCATION SCOUTING
   ===================================================================== */
(function locationModule(){
  const KEY = 'kr_locations';
  const form = document.getElementById('formLocation');
  const listEl = document.getElementById('locationList');

  function render(){
    const items = krLoad(KEY);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessuna location salvata.');
      return;
    }
    listEl.innerHTML = items.map(it => `
      <div class="item-row">
        <div class="item-main">
          <div class="item-title">${it.nome}</div>
          <div class="item-sub">${[it.indirizzo, it.orario].filter(Boolean).join(' · ') || 'Nessun dettaglio'}</div>
        </div>
        <div class="item-actions">
          ${it.indirizzo ? `<a class="icon-btn accent" target="_blank" rel="noopener" href="https://maps.apple.com/?q=${encodeURIComponent(it.indirizzo)}"><i data-lucide="navigation"></i></a>` : ''}
          <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `).join('');
    krIcons();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    items.push({
      id: krId(),
      nome: document.getElementById('locNome').value.trim(),
      indirizzo: document.getElementById('locIndirizzo').value.trim(),
      orario: document.getElementById('locOrario').value.trim()
    });
    krSave(KEY, items);
    form.reset();
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      render();
    }
  });

  render();
})();

/* =====================================================================
   4) CONTATTI RAPIDI TROUPE
   ===================================================================== */
(function contattiModule(){
  const KEY = 'kr_contatti';
  const form = document.getElementById('formContatti');
  const listEl = document.getElementById('contattiList');

  function render(){
    const items = krLoad(KEY);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessun contatto salvato.');
      return;
    }
    listEl.innerHTML = items.map(it => `
      <div class="item-row">
        <div class="item-main">
          <div class="item-title">${it.nome}</div>
          <div class="item-sub">${it.ruolo || 'Ruolo non specificato'}</div>
        </div>
        <div class="item-actions">
          <a class="icon-btn accent" href="tel:${it.tel}"><i data-lucide="phone"></i></a>
          <a class="icon-btn accent" target="_blank" rel="noopener" href="https://wa.me/${it.tel.replace(/[^0-9]/g,'')}"><i data-lucide="message-circle"></i></a>
          <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `).join('');
    krIcons();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    items.push({
      id: krId(),
      nome: document.getElementById('contNome').value.trim(),
      ruolo: document.getElementById('contRuolo').value.trim(),
      tel: document.getElementById('contTel').value.trim()
    });
    krSave(KEY, items);
    form.reset();
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      render();
    }
  });

  render();
})();

/* =====================================================================
   5) METEO DEL GIORNO + 6) VENTO PER DRONE
   Usa l'API gratuita e senza chiave Open-Meteo, dati orari per la
   giornata corrente nella posizione attuale del dispositivo.
   ===================================================================== */
(function meteoModule(){
  const btn = document.getElementById('btnMeteoRefresh');
  const statusEl = document.getElementById('meteoStatus');
  const nowEl = document.getElementById('meteoNow');
  const hourlyEl = document.getElementById('meteoHourly');
  const sogliaInput = document.getElementById('ventoSoglia');
  const semaforoLuce = document.getElementById('semaforoStato');
  const semaforoDettaglio = document.getElementById('semaforoDettaglio');

  function aggiornaSemaforo(ventoKmh){
    const soglia = parseFloat(sogliaInput.value) || 25;
    semaforoLuce.classList.remove('verde', 'giallo', 'rosso');
    let stato, testo;
    if(ventoKmh < soglia * 0.6){
      stato = 'verde'; testo = 'Condizioni ottimali per il volo';
    }else if(ventoKmh < soglia){
      stato = 'giallo'; testo = 'Vento sostenuto: valuta con attenzione';
    }else{
      stato = 'rosso'; testo = 'Vento oltre la soglia di sicurezza: sconsigliato';
    }
    semaforoLuce.classList.add(stato);
    semaforoLuce.textContent = Math.round(ventoKmh) + ' km/h';
    semaforoDettaglio.textContent = testo;
  }
  sogliaInput.addEventListener('input', () => {
    if(window.krUltimoVento !== undefined) aggiornaSemaforo(window.krUltimoVento);
  });

  function caricaMeteo(lat, lon){
    statusEl.textContent = 'Caricamento dati meteo in corso...';
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=temperature_2m,precipitation_probability,windspeed_10m,cloudcover&timezone=auto&forecast_days=1`;
    fetch(url)
      .then(r => r.json())
      .then(data => {
        statusEl.textContent = '';
        const h = data.hourly;
        const oraAttuale = new Date().getHours();
        const idxAttuale = h.time.findIndex(t => new Date(t).getHours() === oraAttuale);
        const idx = idxAttuale >= 0 ? idxAttuale : 0;

        nowEl.innerHTML = `
          <div class="stat"><span class="val">${Math.round(h.temperature_2m[idx])}°</span><span class="lbl">Temperatura</span></div>
          <div class="stat"><span class="val">${Math.round(h.windspeed_10m[idx])} km/h</span><span class="lbl">Vento</span></div>
          <div class="stat"><span class="val">${h.precipitation_probability[idx]}%</span><span class="lbl">Pioggia</span></div>
          <div class="stat"><span class="val">${h.cloudcover[idx]}%</span><span class="lbl">Nuvolosità</span></div>
        `;

        hourlyEl.innerHTML = h.time.slice(idx, idx + 12).map((t, i) => `
          <div class="meteo-hour-card">
            <div class="h-time">${new Date(t).getHours()}:00</div>
            <div class="h-temp">${Math.round(h.temperature_2m[idx + i])}°</div>
            <div class="h-extra">${Math.round(h.windspeed_10m[idx + i])} km/h</div>
            <div class="h-extra">${h.precipitation_probability[idx + i]}% pioggia</div>
          </div>
        `).join('');

        window.krUltimoVento = h.windspeed_10m[idx];
        aggiornaSemaforo(window.krUltimoVento);
      })
      .catch(err => {
        console.error(err);
        statusEl.textContent = 'Errore nel caricamento dei dati meteo. Controlla la connessione.';
      });
  }

  btn.addEventListener('click', () => {
    if(!navigator.geolocation){
      statusEl.textContent = 'Geolocalizzazione non disponibile su questo dispositivo.';
      return;
    }
    statusEl.textContent = 'Individuazione posizione in corso...';
    navigator.geolocation.getCurrentPosition(
      pos => caricaMeteo(pos.coords.latitude, pos.coords.longitude),
      err => { statusEl.textContent = 'Posizione non disponibile: consenti l\'accesso alla posizione nelle impostazioni del browser.'; },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  });
})();

/* =====================================================================
   7) IPERFOCALE & PROFONDITÀ DI CAMPO
   ===================================================================== */
(function iperfocaleModule(){
  document.getElementById('btnCalcIperfocale').addEventListener('click', () => {
    const focale = parseFloat(document.getElementById('hfFocale').value);
    const apertura = parseFloat(document.getElementById('hfApertura').value);
    const crop = parseFloat(document.getElementById('hfSensore').value);
    const distanza = parseFloat(document.getElementById('hfDistanza').value);
    const resultEl = document.getElementById('hfResult');

    if(!focale || !apertura){
      resultEl.innerHTML = 'Inserisci focale e apertura valide.';
      return;
    }
    // Circolo di confusione standard full frame 0.03mm, scalato per il crop factor
    const coc = 0.03 / crop;
    // Formula dell'iperfocale in mm, poi convertita in metri
    const iperfocaleMm = focale + (focale * focale) / (apertura * coc);
    const iperfocaleM = iperfocaleMm / 1000;

    let html = `Iperfocale: <span class="result-highlight">${iperfocaleM.toFixed(2)} m</span><br>`;
    html += `Oltre questa distanza, tutto è a fuoco fino all'infinito.`;

    if(distanza && distanza > 0){
      const sMm = distanza * 1000;
      const nearMm = (iperfocaleMm * sMm) / (iperfocaleMm + (sMm - focale));
      let farText;
      if(sMm >= iperfocaleMm){
        farText = '∞';
      }else{
        const farMm = (iperfocaleMm * sMm) / (iperfocaleMm - (sMm - focale));
        farText = (farMm / 1000).toFixed(2) + ' m';
      }
      html += `<br><br>A ${distanza} m di distanza dal soggetto:<br>`;
      html += `Fuoco vicino: <strong>${(nearMm/1000).toFixed(2)} m</strong> — Fuoco lontano: <strong>${farText}</strong>`;
    }
    resultEl.innerHTML = html;
  });
})();

/* =====================================================================
   8) ESPOSIZIONE / ND FILTER
   ===================================================================== */
(function ndModule(){
  const NOMI_ND = [
    { stop: 1, nome: 'ND2' }, { stop: 2, nome: 'ND4' }, { stop: 3, nome: 'ND8' },
    { stop: 4, nome: 'ND16' }, { stop: 5, nome: 'ND32' }, { stop: 6, nome: 'ND64' },
    { stop: 7, nome: 'ND128' }, { stop: 8, nome: 'ND256' }, { stop: 9, nome: 'ND512' },
    { stop: 10, nome: 'ND1000' }
  ];

  document.getElementById('btnCalcNd').addEventListener('click', () => {
    const sC = parseFloat(document.getElementById('ndShutterCur').value);
    const aC = parseFloat(document.getElementById('ndApertureCur').value);
    const iC = parseFloat(document.getElementById('ndIsoCur').value);
    const sT = parseFloat(document.getElementById('ndShutterTgt').value);
    const aT = parseFloat(document.getElementById('ndApertureTgt').value);
    const iT = parseFloat(document.getElementById('ndIsoTgt').value);
    const resultEl = document.getElementById('ndResult');

    if(!sC || !aC || !iC || !sT || !aT || !iT){
      resultEl.innerHTML = 'Compila tutti i campi con valori validi.';
      return;
    }
    // Calcolo degli stop di differenza tra l'esposizione corretta e quella
    // desiderata. Ogni componente contribuisce in stop (log2):
    // - apertura: 2*log2(f_corrente/f_target)  (f più piccolo = più luce)
    // - otturatore: log2(t_target/t_corrente) espresso come 1/x, quindi invertito
    // - ISO: log2(ISO_target/ISO_corrente)
    const stopApertura = 2 * Math.log2(aC / aT);
    const stopOtturatore = Math.log2(sC / sT); // 1/50 -> 1/25 raddoppia la luce
    const stopIso = Math.log2(iT / iC);
    const stopTotali = stopApertura + stopOtturatore + stopIso;

    if(Math.abs(stopTotali) < 0.15){
      resultEl.innerHTML = `Nessun filtro necessario: le due esposizioni sono già equivalenti.`;
      return;
    }
    if(stopTotali < 0){
      resultEl.innerHTML = `L'esposizione desiderata riceve <strong>meno luce</strong> di quella corretta (${Math.abs(stopTotali).toFixed(1)} stop in meno).<br>Non serve un ND: servirebbe piuttosto più luce, ISO più alto o un'apertura maggiore.`;
      return;
    }
    const stopArrotondati = Math.ceil(stopTotali);
    const nd = NOMI_ND.find(n => n.stop === stopArrotondati) || NOMI_ND[NOMI_ND.length - 1];
    resultEl.innerHTML = `Servono circa <span class="result-highlight">${stopTotali.toFixed(1)} stop</span> di ND.<br>` +
      `Filtro consigliato: <strong>${nd.nome}</strong> (${nd.stop} stop, arrotondato per eccesso).`;
  });
})();

/* =====================================================================
   9) TIMELAPSE
   ===================================================================== */
(function timelapseModule(){
  document.getElementById('btnCalcTimelapse').addEventListener('click', () => {
    const durataRealeMin = parseFloat(document.getElementById('tlDurataReale').value);
    const durataFinaleSec = parseFloat(document.getElementById('tlDurataFinale').value);
    const fps = parseFloat(document.getElementById('tlFps').value);
    const pesoScattoMb = parseFloat(document.getElementById('tlPesoScatto').value);
    const resultEl = document.getElementById('tlResult');

    if(!durataRealeMin || !durataFinaleSec || !fps){
      resultEl.innerHTML = 'Compila tutti i campi con valori validi.';
      return;
    }
    const durataRealeSec = durataRealeMin * 60;
    const numeroScatti = Math.round(durataFinaleSec * fps);
    const intervalloSec = durataRealeSec / numeroScatti;
    const spazioGb = (numeroScatti * pesoScattoMb) / 1024;

    resultEl.innerHTML = `Scatti necessari: <span class="result-highlight">${numeroScatti}</span><br>` +
      `Intervallo tra uno scatto e l'altro: <strong>${intervalloSec.toFixed(1)} sec</strong><br>` +
      `Spazio stimato sulla scheda: <strong>${spazioGb.toFixed(2)} GB</strong>`;
  });
})();

/* =====================================================================
   10) BITRATE / STORAGE
   Tabella di bitrate indicativi in Mbps per il 4K a 24-30fps: gli altri
   valori vengono scalati in proporzione a risoluzione e framerate.
   ===================================================================== */
(function storageModule(){
  const BITRATE_BASE_4K = { h264: 100, h265: 60, prores422: 500, proresraw: 800 };
  const FATTORE_RISOLUZIONE = { hd: 0.25, '4k': 1, '6k': 2.2, '8k': 4 };

  document.getElementById('btnCalcStorage').addEventListener('click', () => {
    const ris = document.getElementById('stRisoluzione').value;
    const fps = parseFloat(document.getElementById('stFps').value);
    const codec = document.getElementById('stCodec').value;
    const durataMin = parseFloat(document.getElementById('stDurata').value);
    const resultEl = document.getElementById('stResult');

    if(!durataMin){
      resultEl.innerHTML = 'Inserisci una durata valida.';
      return;
    }
    const fattoreFps = fps / 25; // il valore base della tabella è calcolato a 25fps
    const bitrateMbps = BITRATE_BASE_4K[codec] * FATTORE_RISOLUZIONE[ris] * fattoreFps;
    const durataSec = durataMin * 60;
    const spazioGb = (bitrateMbps * durataSec) / 8 / 1024;

    let velocitaConsigliata;
    if(bitrateMbps < 90) velocitaConsigliata = 'UHS-I / V30 sufficiente';
    else if(bitrateMbps < 300) velocitaConsigliata = 'UHS-II / V60 consigliata';
    else velocitaConsigliata = 'CFexpress Type B consigliata';

    resultEl.innerHTML = `Bitrate stimato: <span class="result-highlight">${Math.round(bitrateMbps)} Mbps</span><br>` +
      `Spazio stimato: <strong>${spazioGb.toFixed(1)} GB</strong> per ${durataMin} minuti<br>` +
      `Scheda consigliata: <strong>${velocitaConsigliata}</strong><br>` +
      `<span style="font-size:11px">Stima indicativa: i valori reali variano in base a camera e compressione.</span>`;
  });
})();

/* =====================================================================
   11) TRACKER BATTERIE
   ===================================================================== */
(function batterieModule(){
  const KEY = 'kr_batterie';
  const form = document.getElementById('formBatteria');
  const listEl = document.getElementById('batterieList');
  const STATI = [
    { key: 'carica', label: 'Carica', cls: 'badge-success' },
    { key: 'uso', label: 'In uso', cls: 'badge-warning' },
    { key: 'scarica', label: 'Scarica', cls: 'badge-danger' }
  ];

  function render(){
    const items = krLoad(KEY);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessuna batteria tracciata.');
      return;
    }
    listEl.innerHTML = items.map(it => {
      const s = STATI.find(s => s.key === it.stato) || STATI[0];
      return `
        <div class="item-row">
          <div class="item-main"><div class="item-title">${it.nome}</div></div>
          <div class="item-actions">
            <button class="badge ${s.cls}" data-toggle="${it.id}">${s.label}</button>
            <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      `;
    }).join('');
    krIcons();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    items.push({ id: krId(), nome: document.getElementById('battNome').value.trim(), stato: 'carica' });
    krSave(KEY, items);
    form.reset();
    render();
  });

  listEl.addEventListener('click', e => {
    const toggleBtn = e.target.closest('[data-toggle]');
    const delBtn = e.target.closest('[data-del]');
    if(toggleBtn){
      const items = krLoad(KEY);
      const it = items.find(i => i.id === toggleBtn.dataset.toggle);
      if(it){
        const idx = STATI.findIndex(s => s.key === it.stato);
        it.stato = STATI[(idx + 1) % STATI.length].key;
      }
      krSave(KEY, items);
      render();
    }
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      render();
    }
  });

  render();
})();

/* =====================================================================
   12) TRACKER SCHEDE DI MEMORIA
   ===================================================================== */
(function schedeModule(){
  const KEY = 'kr_schede';
  const form = document.getElementById('formScheda');
  const listEl = document.getElementById('schedeList');

  function render(){
    const items = krLoad(KEY);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessuna scheda tracciata.');
      return;
    }
    listEl.innerHTML = items.map(it => {
      const usatoPct = Math.min(100, Math.round((it.usato / it.capacita) * 100)) || 0;
      const libero = Math.max(0, it.capacita - it.usato);
      return `
        <div class="item-row" style="flex-direction:column; align-items:stretch;">
          <div style="display:flex; align-items:center; gap:10px;">
            <div class="item-main">
              <div class="item-title">${it.nome}</div>
              <div class="item-sub">${it.usato} / ${it.capacita} GB usati — ${libero} GB liberi</div>
            </div>
            <label style="display:flex; align-items:center; gap:5px; font-size:11px; color:var(--text-dim);">
              <input type="checkbox" data-backup="${it.id}" ${it.backup ? 'checked' : ''}> Backup
            </label>
            <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
          </div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:8px;">
            <input type="range" min="0" max="${it.capacita}" value="${it.usato}" data-usato="${it.id}" style="flex:1; accent-color: var(--accent);">
            <span class="mono" style="font-size:12px; width:40px; text-align:right;">${usatoPct}%</span>
          </div>
        </div>
      `;
    }).join('');
    krIcons();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    items.push({
      id: krId(),
      nome: document.getElementById('schedaNome').value.trim(),
      capacita: parseFloat(document.getElementById('schedaCapacita').value),
      usato: 0,
      backup: false
    });
    krSave(KEY, items);
    form.reset();
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      render();
    }
  });
  listEl.addEventListener('change', e => {
    const items = krLoad(KEY);
    if(e.target.matches('[data-backup]')){
      const it = items.find(i => i.id === e.target.dataset.backup);
      if(it) it.backup = e.target.checked;
      krSave(KEY, items);
    }
    if(e.target.matches('[data-usato]')){
      const it = items.find(i => i.id === e.target.dataset.usato);
      if(it) it.usato = parseFloat(e.target.value);
      krSave(KEY, items);
      render();
    }
  });

  render();
})();

/* =====================================================================
   13) LOG CIAK
   ===================================================================== */
/* Riferimento globale al render del log ciak, riusato dalla modalità
   schermo intero per aggiornare la lista principale dopo un salvataggio. */
let krRenderCiak = null;

(function ciakModule(){
  const KEY = 'kr_ciak';
  const form = document.getElementById('formCiak');
  const listEl = document.getElementById('ciakList');
  const GIUDIZI = { buona: { label: 'Buona', cls: 'badge-success' }, rifare: { label: 'Da rifare', cls: 'badge-warning' }, ng: { label: 'NG', cls: 'badge-danger' } };

  function render(){
    const items = krLoad(KEY);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessun ciak registrato.');
      return;
    }
    listEl.innerHTML = items.slice().reverse().map(it => {
      const g = GIUDIZI[it.giudizio];
      return `
        <div class="item-row">
          <div class="item-main">
            <div class="item-title">Scena ${it.scena} · Ciak ${it.ciak} <span class="mono" style="color:var(--text-faint); font-size:11px;">${it.ora}</span></div>
            ${it.note ? `<div class="item-sub">${it.note}</div>` : ''}
          </div>
          <div class="item-actions">
            <span class="badge ${g.cls}">${g.label}</span>
            <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      `;
    }).join('');
    krIcons();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    items.push({
      id: krId(),
      scena: document.getElementById('ciakScena').value.trim(),
      ciak: document.getElementById('ciakNum').value.trim(),
      giudizio: document.getElementById('ciakGiudizio').value,
      note: document.getElementById('ciakNote').value.trim(),
      ora: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    });
    krSave(KEY, items);
    form.reset();
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      render();
    }
  });

  krRenderCiak = render;
  render();

  document.getElementById('btnCiakFullscreen').addEventListener('click', () => {
    document.getElementById('ciakFullscreen').classList.add('open');
    if(window.krOpenFullscreenCiak) window.krOpenFullscreenCiak();
  });
})();

/* =====================================================================
   13-bis) MODALITÀ CIAK A SCHERMO INTERO
   Riusa la stessa chiave di storage "kr_ciak" del log normale, così le
   voci registrate qui compaiono anche nella lista compatta e viceversa.
   Le note scritte/vocali di questa sezione usano la stessa chiave
   "kr_note" del modulo Note vocali rapide, taggate con la scena corrente.
   ===================================================================== */
(function ciakFullscreenModule(){
  const KEY_CIAK = 'kr_ciak';
  const KEY_NOTE = 'kr_note';
  const KEY_COUNTERS = 'kr_ciak_counters';

  const overlay = document.getElementById('ciakFullscreen');
  const scenaVal = document.getElementById('fsScenaVal');
  const ciakVal = document.getElementById('fsCiakVal');
  const lastSaved = document.getElementById('fsLastSaved');
  const recentList = document.getElementById('fsRecentList');

  const GIUDIZI = { buona: 'Buona', rifare: 'Da rifare', ng: 'NG' };

  function getCounters(){
    return krLoad(KEY_COUNTERS, { scena: 1, ciak: 1 });
  }
  function setCounters(c){
    krSave(KEY_COUNTERS, c);
    scenaVal.textContent = c.scena;
    ciakVal.textContent = c.ciak;
  }

  function renderRecent(){
    const items = krLoad(KEY_CIAK).slice(-4).reverse();
    if(items.length === 0){
      recentList.innerHTML = '<div class="list-empty">Ancora nessun ciak registrato in questa sessione.</div>';
      return;
    }
    recentList.innerHTML = items.map(it => `
      <div class="item-row">
        <div class="item-main">
          <div class="item-title">Scena ${it.scena} · Ciak ${it.ciak} <span class="mono" style="color:var(--text-faint); font-size:11px;">${it.ora}</span></div>
        </div>
        <span class="badge ${it.giudizio === 'buona' ? 'badge-success' : it.giudizio === 'rifare' ? 'badge-warning' : 'badge-danger'}">${GIUDIZI[it.giudizio]}</span>
      </div>
    `).join('');
  }

  // Espone l'apertura per sincronizzare i contatori con l'ultimo ciak registrato
  window.krOpenFullscreenCiak = function(){
    setCounters(getCounters());
    renderRecent();
    renderFsNotes();
  };

  document.getElementById('btnCiakFsExit').addEventListener('click', () => {
    overlay.classList.remove('open');
  });

  document.getElementById('fsScenaPiu').addEventListener('click', () => {
    const c = getCounters(); c.scena += 1; c.ciak = 1; setCounters(c);
  });
  document.getElementById('fsScenaMeno').addEventListener('click', () => {
    const c = getCounters(); c.scena = Math.max(1, c.scena - 1); setCounters(c);
  });
  document.getElementById('fsCiakPiu').addEventListener('click', () => {
    const c = getCounters(); c.ciak += 1; setCounters(c);
  });
  document.getElementById('fsCiakMeno').addEventListener('click', () => {
    const c = getCounters(); c.ciak = Math.max(1, c.ciak - 1); setCounters(c);
  });

  document.querySelectorAll('.fs-giudizio-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const giudizio = btn.dataset.giudizio;
      const c = getCounters();
      const items = krLoad(KEY_CIAK);
      items.push({
        id: krId(),
        scena: c.scena,
        ciak: c.ciak,
        giudizio,
        note: '',
        ora: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      });
      krSave(KEY_CIAK, items);

      lastSaved.textContent = `Salvato — Scena ${c.scena}, Ciak ${c.ciak}: ${GIUDIZI[giudizio]}`;

      // Dopo un ciak buono si passa alla scena successiva, altrimenti si
      // resta sulla stessa scena aumentando il numero di ciak (ripetizione)
      if(giudizio === 'buona'){
        c.scena += 1; c.ciak = 1;
      }else{
        c.ciak += 1;
      }
      setCounters(c);
      renderRecent();
      if(krRenderCiak) krRenderCiak();
    });
  });

  /* --- Note scritte / vocali dentro lo schermo intero --- */
  const notesToggle = document.getElementById('fsNotesToggle');
  const notesBody = document.getElementById('fsNotesBody');
  const noteTesto = document.getElementById('fsNoteTesto');
  const noteMicBtn = document.getElementById('fsNoteMic');
  const noteSalvaBtn = document.getElementById('fsNoteSalva');
  const noteListEl = document.getElementById('fsNoteList');

  notesToggle.addEventListener('click', () => {
    const isOpen = notesBody.classList.toggle('open');
    notesToggle.classList.toggle('open', isOpen);
  });

  const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
  let fsRecognition = null;
  let fsAscoltando = false;
  if(SpeechRecognitionApi){
    fsRecognition = new SpeechRecognitionApi();
    fsRecognition.lang = 'it-IT';
    fsRecognition.continuous = true;
    fsRecognition.interimResults = false;
    fsRecognition.onresult = (e) => {
      const testo = Array.from(e.results).map(r => r[0].transcript).join(' ');
      noteTesto.value = (noteTesto.value + ' ' + testo).trim();
    };
    fsRecognition.onend = () => { fsAscoltando = false; noteMicBtn.classList.remove('recording'); };
  }

  noteMicBtn.addEventListener('click', () => {
    if(!fsRecognition){
      alert('Il riconoscimento vocale non è supportato su questo browser. Usa la tastiera per scrivere la nota.');
      return;
    }
    if(fsAscoltando){
      fsRecognition.stop(); fsAscoltando = false; noteMicBtn.classList.remove('recording');
    }else{
      fsRecognition.start(); fsAscoltando = true; noteMicBtn.classList.add('recording');
    }
  });

  function renderFsNotes(){
    const items = krLoad(KEY_NOTE).slice(-4).reverse();
    if(items.length === 0){
      noteListEl.innerHTML = '<div class="list-empty">Nessuna nota salvata in questa sessione.</div>';
      return;
    }
    noteListEl.innerHTML = items.map(it => `
      <div class="item-row">
        <div class="item-main">
          <div class="item-title">${it.scena ? '[' + it.scena + '] ' : ''}${it.testo}</div>
          <div class="item-sub">${it.ora}</div>
        </div>
      </div>
    `).join('');
  }

  noteSalvaBtn.addEventListener('click', () => {
    const testo = noteTesto.value.trim();
    if(!testo) return;
    const c = getCounters();
    const items = krLoad(KEY_NOTE);
    items.push({
      id: krId(),
      testo,
      scena: 'Scena ' + c.scena,
      ora: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    });
    krSave(KEY_NOTE, items);
    noteTesto.value = '';
    renderFsNotes();
  });
})();

/* =====================================================================
   14) LIVELLA / BUSSOLA
   Usa l'evento deviceorientation; su iOS 13+ serve richiedere il
   permesso esplicito tramite DeviceOrientationEvent.requestPermission().
   ===================================================================== */
(function livellaModule(){
  const btn = document.getElementById('btnLivellaAttiva');
  const statusEl = document.getElementById('livellaStatus');
  const bubble = document.getElementById('livellaBubble');
  const gammaEl = document.getElementById('livellaGamma');
  const betaEl = document.getElementById('livellaBeta');
  const alphaEl = document.getElementById('livellaAlpha');

  function handleOrientation(e){
    const beta = e.beta || 0;   // inclinazione avanti/indietro
    const gamma = e.gamma || 0; // inclinazione sinistra/destra
    const alpha = e.alpha;      // direzione bussola (0-360, non sempre disponibile)

    // Sposta la bolla proporzionalmente all'inclinazione, con un limite massimo
    const maxTilt = 45;
    const clampedGamma = Math.max(-maxTilt, Math.min(maxTilt, gamma));
    const clampedBeta = Math.max(-maxTilt, Math.min(maxTilt, beta));
    const rangePx = 55; // raggio utile del cerchio in px
    const x = (clampedGamma / maxTilt) * rangePx;
    const y = (clampedBeta / maxTilt) * rangePx;
    bubble.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

    gammaEl.textContent = gamma.toFixed(1) + '°';
    betaEl.textContent = beta.toFixed(1) + '°';
    alphaEl.textContent = (alpha !== null && alpha !== undefined) ? Math.round(alpha) + '°' : 'non disponibile';
  }

  function attiva(){
    if(!window.DeviceOrientationEvent){
      statusEl.textContent = 'Sensori di orientamento non disponibili su questo dispositivo/browser.';
      return;
    }
    window.addEventListener('deviceorientation', handleOrientation);
    statusEl.textContent = 'Sensori attivi.';
  }

  btn.addEventListener('click', () => {
    // iOS 13+ richiede un permesso esplicito, invocato solo da un tap utente
    if(typeof DeviceOrientationEvent.requestPermission === 'function'){
      DeviceOrientationEvent.requestPermission()
        .then(risposta => {
          if(risposta === 'granted') attiva();
          else statusEl.textContent = 'Permesso sensori negato.';
        })
        .catch(() => { statusEl.textContent = 'Impossibile richiedere il permesso sensori.'; });
    }else{
      attiva();
    }
  });
})();

/* =====================================================================
   15) TIMER / CRONOMETRI MULTIPLI
   I nomi dei timer sono persistenti, il tempo trascorso resta solo
   in memoria per la sessione corrente.
   ===================================================================== */
(function timerModule(){
  const KEY = 'kr_timer_nomi';
  const form = document.getElementById('formTimer');
  const listEl = document.getElementById('timerList');
  const runtime = {}; // id -> { secondi, running, intervalId }

  function formatTempo(sec){
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  function render(){
    const nomi = krLoad(KEY);
    if(nomi.length === 0){
      krRenderEmpty(listEl, 'Nessun timer creato.');
      return;
    }
    listEl.innerHTML = nomi.map(it => {
      if(!runtime[it.id]) runtime[it.id] = { secondi: 0, running: false, intervalId: null };
      const r = runtime[it.id];
      return `
        <div class="item-row">
          <div class="item-main">
            <div class="item-title">${it.nome}</div>
            <div class="item-sub mono" id="timerDisplay-${it.id}" style="font-size:16px;">${formatTempo(r.secondi)}</div>
          </div>
          <div class="item-actions">
            <button class="icon-btn accent" data-start="${it.id}"><i data-lucide="${r.running ? 'pause' : 'play'}"></i></button>
            <button class="icon-btn" data-reset="${it.id}"><i data-lucide="rotate-ccw"></i></button>
            <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      `;
    }).join('');
    krIcons();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const nomi = krLoad(KEY);
    nomi.push({ id: krId(), nome: document.getElementById('timerNome').value.trim() });
    krSave(KEY, nomi);
    form.reset();
    render();
  });

  listEl.addEventListener('click', e => {
    const startBtn = e.target.closest('[data-start]');
    const resetBtn = e.target.closest('[data-reset]');
    const delBtn = e.target.closest('[data-del]');

    if(startBtn){
      const id = startBtn.dataset.start;
      const r = runtime[id];
      if(r.running){
        clearInterval(r.intervalId);
        r.running = false;
      }else{
        r.running = true;
        r.intervalId = setInterval(() => {
          r.secondi += 1;
          const disp = document.getElementById('timerDisplay-' + id);
          if(disp) disp.textContent = formatTempo(r.secondi);
        }, 1000);
      }
      render();
    }
    if(resetBtn){
      const id = resetBtn.dataset.reset;
      const r = runtime[id];
      if(r.intervalId) clearInterval(r.intervalId);
      runtime[id] = { secondi: 0, running: false, intervalId: null };
      render();
    }
    if(delBtn){
      const id = delBtn.dataset.del;
      if(runtime[id] && runtime[id].intervalId) clearInterval(runtime[id].intervalId);
      delete runtime[id];
      krSave(KEY, krLoad(KEY).filter(i => i.id !== id));
      render();
    }
  });

  render();
})();

/* =====================================================================
   16) NOTE VOCALI RAPIDE
   Usa la Web Speech API se disponibile (principalmente Chrome); su
   browser non supportati resta comunque utilizzabile come note testuali.
   ===================================================================== */
(function noteModule(){
  const KEY = 'kr_note';
  const micBtn = document.getElementById('btnNoteMic');
  const testoEl = document.getElementById('noteTesto');
  const sceneEl = document.getElementById('noteScena');
  const salvaBtn = document.getElementById('btnNoteSalva');
  const listEl = document.getElementById('noteList');

  const SpeechRecognitionApi = window.SpeechRecognition || window.webkitSpeechRecognition;
  let recognition = null;
  let ascoltando = false;

  if(SpeechRecognitionApi){
    recognition = new SpeechRecognitionApi();
    recognition.lang = 'it-IT';
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (e) => {
      const testo = Array.from(e.results).map(r => r[0].transcript).join(' ');
      testoEl.value = (testoEl.value + ' ' + testo).trim();
    };
    recognition.onend = () => { ascoltando = false; micBtn.classList.remove('recording'); };
  }else{
    micBtn.title = 'Riconoscimento vocale non supportato su questo browser';
  }

  micBtn.addEventListener('click', () => {
    if(!recognition){
      alert('Il riconoscimento vocale non è supportato su questo browser. Usa la tastiera per scrivere la nota.');
      return;
    }
    if(ascoltando){
      recognition.stop();
      ascoltando = false;
      micBtn.classList.remove('recording');
    }else{
      recognition.start();
      ascoltando = true;
      micBtn.classList.add('recording');
    }
  });

  function render(){
    const items = krLoad(KEY);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessuna nota salvata.');
      return;
    }
    listEl.innerHTML = items.slice().reverse().map(it => `
      <div class="item-row">
        <div class="item-main">
          <div class="item-title">${it.scena ? '[' + it.scena + '] ' : ''}${it.testo}</div>
          <div class="item-sub">${it.ora}</div>
        </div>
        <div class="item-actions">
          <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `).join('');
    krIcons();
  }

  salvaBtn.addEventListener('click', () => {
    const testo = testoEl.value.trim();
    if(!testo) return;
    const items = krLoad(KEY);
    items.push({
      id: krId(),
      testo,
      scena: sceneEl.value.trim(),
      ora: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
    });
    krSave(KEY, items);
    testoEl.value = '';
    sceneEl.value = '';
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      render();
    }
  });

  render();
})();

/* =====================================================================
   17) METRONOMO PER MOVIMENTI CAMERA
   Genera un click con la Web Audio API, senza bisogno di file audio.
   ===================================================================== */
(function metronomoModule(){
  const bpmSlider = document.getElementById('metroBpm');
  const bpmVal = document.getElementById('metroBpmVal');
  const toggleBtn = document.getElementById('btnMetroToggle');
  const pulseEl = document.getElementById('metroPulse');
  let audioCtx = null;
  let intervalId = null;
  let attivo = false;

  function click(){
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.frequency.value = 1000;
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);

    pulseEl.classList.add('beat');
    setTimeout(() => pulseEl.classList.remove('beat'), 100);
  }

  function avvia(){
    const bpm = parseInt(bpmSlider.value, 10);
    const intervalMs = 60000 / bpm;
    intervalId = setInterval(click, intervalMs);
  }

  bpmSlider.addEventListener('input', () => {
    bpmVal.textContent = bpmSlider.value;
    if(attivo){
      clearInterval(intervalId);
      avvia();
    }
  });

  toggleBtn.addEventListener('click', () => {
    attivo = !attivo;
    if(attivo){
      avvia();
      toggleBtn.innerHTML = '<i data-lucide="pause"></i> Ferma';
    }else{
      clearInterval(intervalId);
      toggleBtn.innerHTML = '<i data-lucide="play"></i> Avvia';
    }
    krIcons();
  });
})();

/* =====================================================================
   18) RELEASE / LIBERATORIA DIGITALE
   Firma disegnata su canvas (mouse e touch), salvata come immagine
   dataURL insieme ai dati testuali in localStorage.
   ===================================================================== */
(function releaseModule(){
  const KEY = 'kr_liberatorie';
  const canvas = document.getElementById('relCanvas');
  const ctx = canvas.getContext('2d');
  const listEl = document.getElementById('releaseList');
  const dataInput = document.getElementById('relData');
  dataInput.value = new Date().toISOString().slice(0, 10);

  // Adatta la risoluzione del canvas alla larghezza reale visualizzata
  function resizeCanvas(){
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);
    ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--text');
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }
  window.addEventListener('resize', resizeCanvas);
  setTimeout(resizeCanvas, 50);

  let disegnando = false;
  function pos(e){
    const rect = canvas.getBoundingClientRect();
    const point = e.touches ? e.touches[0] : e;
    return { x: point.clientX - rect.left, y: point.clientY - rect.top };
  }
  function start(e){ disegnando = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); e.preventDefault(); }
  function move(e){ if(!disegnando) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); e.preventDefault(); }
  function end(){ disegnando = false; }

  canvas.addEventListener('mousedown', start);
  canvas.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);
  canvas.addEventListener('touchstart', start, { passive: false });
  canvas.addEventListener('touchmove', move, { passive: false });
  canvas.addEventListener('touchend', end);

  document.getElementById('btnRelClear').addEventListener('click', () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  });

  function render(){
    const items = krLoad(KEY);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessuna liberatoria salvata.');
      return;
    }
    listEl.innerHTML = items.slice().reverse().map(it => `
      <div class="item-row">
        <div class="item-main">
          <div class="item-title">${it.nome}</div>
          <div class="item-sub">${it.data}</div>
        </div>
        <div class="item-actions">
          <a class="icon-btn accent" download="liberatoria-${it.nome}.png" href="${it.firma}"><i data-lucide="download"></i></a>
          <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `).join('');
    krIcons();
  }

  document.getElementById('btnRelSalva').addEventListener('click', () => {
    const nome = document.getElementById('relNome').value.trim();
    if(!nome){ alert('Inserisci il nome del soggetto.'); return; }
    const items = krLoad(KEY);
    items.push({
      id: krId(),
      nome,
      data: dataInput.value,
      testo: document.getElementById('relTesto').value,
      firma: canvas.toDataURL('image/png')
    });
    krSave(KEY, items);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('relNome').value = '';
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      render();
    }
  });

  render();
})();

/* =====================================================================
   19) SPESE GIORNATA
   ===================================================================== */
(function speseModule(){
  const KEY = 'kr_spese';
  const form = document.getElementById('formSpesa');
  const listEl = document.getElementById('speseList');
  const totaleEl = document.getElementById('speseTotale');

  function formatEuro(n){
    return '€ ' + n.toFixed(2).replace('.', ',');
  }

  function render(){
    const items = krLoad(KEY);
    const totale = items.reduce((sum, i) => sum + i.importo, 0);
    totaleEl.textContent = formatEuro(totale);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessuna spesa registrata.');
      return;
    }
    listEl.innerHTML = items.slice().reverse().map(it => `
      <div class="item-row">
        <div class="item-main">
          <div class="item-title">${it.desc}</div>
          <div class="item-sub">${it.cat}</div>
        </div>
        <div class="item-actions">
          <span class="mono" style="font-size:14px;">${formatEuro(it.importo)}</span>
          <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `).join('');
    krIcons();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    items.push({
      id: krId(),
      desc: document.getElementById('spesaDesc').value.trim(),
      importo: parseFloat(document.getElementById('spesaImporto').value),
      cat: document.getElementById('spesaCat').value
    });
    krSave(KEY, items);
    form.reset();
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      render();
    }
  });

  render();
})();

/* =====================================================================
   20) PROMEMORIA & ALLARMI
   Controlla ogni 30 secondi se un promemoria è scaduto e, se le
   notifiche del browser sono state autorizzate, invia una notifica.
   ===================================================================== */
(function promemoriaModule(){
  const KEY = 'kr_promemoria';
  const form = document.getElementById('formPromemoria');
  const listEl = document.getElementById('promemoriaList');
  const notifBtn = document.getElementById('btnPromNotifiche');

  notifBtn.addEventListener('click', () => {
    if(!('Notification' in window)){
      alert('Le notifiche non sono supportate su questo browser.');
      return;
    }
    Notification.requestPermission().then(perm => {
      notifBtn.innerHTML = perm === 'granted'
        ? '<i data-lucide="bell-ring"></i> Notifiche attive'
        : '<i data-lucide="bell-off"></i> Notifiche non autorizzate';
      krIcons();
    });
  });

  function oraAttualeStr(){
    const d = new Date();
    return d.getHours().toString().padStart(2, '0') + ':' + d.getMinutes().toString().padStart(2, '0');
  }

  function render(){
    const items = krLoad(KEY).sort((a, b) => a.orario.localeCompare(b.orario));
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessun promemoria impostato.');
      return;
    }
    const ora = oraAttualeStr();
    listEl.innerHTML = items.map(it => {
      const passato = it.orario < ora;
      return `
        <div class="item-row" style="${passato ? 'opacity:.5;' : ''}">
          <div class="item-main">
            <div class="item-title">${it.testo}</div>
            <div class="item-sub mono">${it.orario}</div>
          </div>
          <div class="item-actions">
            <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      `;
    }).join('');
    krIcons();
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    items.push({
      id: krId(),
      testo: document.getElementById('promTesto').value.trim(),
      orario: document.getElementById('promOrario').value,
      notificato: false
    });
    krSave(KEY, items);
    form.reset();
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      render();
    }
  });

  // Controllo periodico per l'invio delle notifiche allo scadere dell'orario
  setInterval(() => {
    const ora = oraAttualeStr();
    const items = krLoad(KEY);
    let cambiato = false;
    items.forEach(it => {
      if(!it.notificato && it.orario === ora){
        it.notificato = true;
        cambiato = true;
        if('Notification' in window && Notification.permission === 'granted'){
          new Notification('Promemoria Kit Ripresa', { body: it.testo });
        }
      }
    });
    if(cambiato) krSave(KEY, items);
    render();
  }, 30000);

  render();
})();

/* Prima inizializzazione delle icone Lucide al caricamento della pagina */
krIcons();
