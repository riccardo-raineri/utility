/* =====================================================================
   REC — Logica applicativa
   Tutti i dati vengono salvati in localStorage sul dispositivo: non c'è
   nessun backend, quindi i dati restano solo su questo browser/telefono
   a meno che il backend cloud sia configurato (vedi sotto).
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
  // Se la chiave corrisponde a una tabella sincronizzata, invia anche
  // una copia al backend cloud (funzione definita più sotto nel file,
  // disponibile qui grazie al hoisting delle dichiarazioni di funzione)
  const table = KR_TABLES[key];
  if(table) krCloudSave(table, value);
}
function krId(){
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}
/* Ricrea le icone Lucide dopo ogni render dinamico della UI */
function krIcons(){
  if(window.lucide) lucide.createIcons();
}
/* Aggiorna il piccolo contatore mostrato sulla casella della griglia */
function krSetTileCount(id, text){
  const el = document.getElementById('tileCount-' + id);
  if(el) el.textContent = text;
}
/* Cambia l'icona del pulsante di submit di un form (usato per passare
   da "+" ad "assegno di spunta" quando si entra in modalità modifica) */
function krSetSubmitIcon(form, iconName){
  const btn = form.querySelector('button[type="submit"]');
  if(btn) btn.innerHTML = `<i data-lucide="${iconName}"></i>`;
  krIcons();
}

/* =====================================================================
   SINCRONIZZAZIONE CLOUD (Google Sheets + Apps Script)
   Un Web App Apps Script espone un'API JSON che legge e scrive su un
   Google Sheet. Ogni tabella locale ("kr_...") corrisponde a un foglio.

   COME CONFIGURARE:
   1. Crea un nuovo Google Sheet vuoto.
   2. Estensioni → Apps Script, incolla il codice fornito a parte (Code.gs).
   3. In "Proprietà del progetto → Proprietà script" aggiungi una proprietà
      SECRET_TOKEN con un valore a tua scelta (es. una password).
   4. Distribuisci → Nuova distribuzione → Web app, accesso "Chiunque
      abbia il link", copia l'URL.
   5. Incolla URL e token qui sotto al posto dei segnaposto.
   ===================================================================== */
const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbxGFo_Gf0y0pm84cgLusonjuKZuRVOYwK8SQeHu0WSDYcJVf1ID-Lzb0V-SU3hKcQoR1w/exec',
  SECRET_TOKEN: '0712'
};

/* Mappa "chiave localStorage" -> "nome tabella sul backend".
   Solo le chiavi qui elencate vengono sincronizzate nel cloud; le
   impostazioni puramente locali (tema, contatori temporanei, ecc.)
   restano solo sul dispositivo. */
const KR_TABLES = {
  kr_checklist: 'checklist',
  kr_shotlist: 'shotlist',
  kr_locations: 'locations',
  kr_contatti: 'contatti',
  kr_ciak: 'ciak',
  kr_note: 'note',
  kr_liberatorie: 'liberatorie',
  kr_spese: 'spese',
  kr_promemoria: 'promemoria'
};

function krCloudConfigured(){
  return CONFIG.APPS_SCRIPT_URL && !CONFIG.APPS_SCRIPT_URL.includes('INCOLLA_QUI')
      && CONFIG.SECRET_TOKEN && !CONFIG.SECRET_TOKEN.includes('INCOLLA_QUI');
}

/* Aggiorna l'indicatore di stato sincronizzazione nell'header */
function krSetSyncStatus(stato){
  const el = document.getElementById('syncStatus');
  if(!el) return;
  el.dataset.state = stato; // 'ok' | 'sync' | 'off' | 'error'
  const icone = { ok: 'cloud', sync: 'refresh-cw', off: 'cloud-off', error: 'cloud-alert' };
  const testi = { ok: 'Sincronizzato', sync: 'Sincronizzazione...', off: 'Solo locale', error: 'Errore di rete' };
  el.innerHTML = `<i data-lucide="${icone[stato] || 'cloud-off'}"></i>`;
  el.title = testi[stato] || '';
  krIcons();
}

/* Salva una singola tabella sul backend (richiesta "fire and forget":
   non blocca l'interfaccia, i dati restano comunque salvati in locale) */
function krCloudSave(table, data){
  if(!krCloudConfigured()) return;
  krSetSyncStatus('sync');
  fetch(CONFIG.APPS_SCRIPT_URL, {
    method: 'POST',
    // text/plain evita il preflight CORS: Apps Script legge comunque il JSON da e.postData
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ action: 'save', table, token: CONFIG.SECRET_TOKEN, data })
  })
    .then(r => r.json())
    .then(res => krSetSyncStatus(res && res.ok ? 'ok' : 'error'))
    .catch(err => { console.error('Errore salvataggio cloud', table, err); krSetSyncStatus('error'); });
}

/* Carica tutte le tabelle in un'unica chiamata e aggiorna la copia
   locale, poi avvisa ogni modulo interessato con un evento dedicato
   così ognuno può ridisegnare la propria lista. */
function krCloudSyncAll(){
  if(!krCloudConfigured()){
    krSetSyncStatus('off');
    return;
  }
  krSetSyncStatus('sync');
  const url = `${CONFIG.APPS_SCRIPT_URL}?action=loadAll&token=${encodeURIComponent(CONFIG.SECRET_TOKEN)}`;
  fetch(url)
    .then(r => r.json())
    .then(res => {
      if(!res.ok){ console.error('Errore sync cloud', res.error); krSetSyncStatus('error'); return; }
      Object.keys(KR_TABLES).forEach(key => {
        const table = KR_TABLES[key];
        const dati = (res.data[table] || []).map(riga => krNormalizeRow(table, riga));
        // Scrittura diretta in localStorage: evita di ri-innescare un
        // altro salvataggio cloud subito dopo averlo appena scaricato
        localStorage.setItem(key, JSON.stringify(dati));
        window.dispatchEvent(new CustomEvent('kr-cloud-updated', { detail: key }));
      });
      krSetSyncStatus('ok');
    })
    .catch(err => { console.error('Errore rete sync cloud', err); krSetSyncStatus('error'); });
}

/* Normalizza i tipi delle colonne che tornano da Google Sheets come
   stringa (es. "TRUE"/"FALSE" o numeri salvati come testo) */
function krNormalizeRow(table, row){
  const r = Object.assign({}, row);
  const bool = v => v === true || v === 'true' || v === 'TRUE' || v === 1;
  if(table === 'checklist') r.done = bool(r.done);
  if(table === 'spese') r.importo = Number(r.importo) || 0;
  if(table === 'promemoria') r.notificato = bool(r.notificato);
  return r;
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
   MODALE STRUMENTI
   Cliccando una casella della griglia (.tile) si apre la finestra
   modale condivisa, mostrando il pannello (.modal-pane) corrispondente
   al suo data-target. Tutti i pannelli restano nel DOM: solo quello
   attivo riceve la classe "open".
   ===================================================================== */
(function initToolModal(){
  const modal = document.getElementById('toolModal');
  const modalTitle = document.getElementById('modalTitle');
  const modalIconWrap = document.getElementById('modalIconWrap');
  const closeBtn = document.getElementById('modalClose');

  function openTool(tile){
    document.querySelectorAll('.modal-pane').forEach(p => p.classList.remove('open'));
    const pane = document.getElementById(tile.dataset.target);
    if(pane) pane.classList.add('open');
    modalTitle.textContent = tile.dataset.title || '';
    modalIconWrap.innerHTML = `<i data-lucide="${tile.dataset.icon || 'square'}"></i>`;
    krIcons();
    modal.classList.add('open');
  }
  function closeTool(){
    modal.classList.remove('open');
  }

  document.querySelectorAll('.tile').forEach(tile => {
    tile.addEventListener('click', () => openTool(tile));
  });
  closeBtn.addEventListener('click', closeTool);
  // Chiude anche cliccando fuori dalla finestra (sull'overlay scuro)
  modal.addEventListener('click', e => { if(e.target === modal) closeTool(); });
})();

/* =====================================================================
   HELPER: crea una riga generica per le liste vuote
   ===================================================================== */
function krRenderEmpty(container, message){
  container.innerHTML = `<div class="list-empty">${message}</div>`;
}

/* =====================================================================
   HELPER: RIORDINO MANUALE TRASCINABILE (drag & drop)
   Funziona sia con mouse che con dita su touch screen grazie alle
   Pointer Events, ed è agganciato all'icona "drag-handle" di ogni riga
   così non interferisce con tap su checkbox/pulsanti. Va chiamato una
   sola volta per lista (l'ascolto resta valido anche dopo i re-render,
   perché è agganciato al contenitore stabile, non alle righe).
   ===================================================================== */
function krEnableDragReorder(listEl, key, onReordered){
  let dragRow = null;
  let startY = 0;
  const LIFT = 'scale(1.03) rotate(-1deg)';

  listEl.addEventListener('pointerdown', e => {
    const handle = e.target.closest('.drag-handle');
    if(!handle) return;
    const row = handle.closest('.item-row');
    if(!row) return;
    e.preventDefault();
    dragRow = row;
    startY = e.clientY;
    row.classList.add('dragging');
    row.style.transform = LIFT;
    if(row.setPointerCapture){
      try{ row.setPointerCapture(e.pointerId); }catch(err){ /* ignora */ }
    }
  });

  listEl.addEventListener('pointermove', e => {
    if(!dragRow) return;
    e.preventDefault();
    // La riga trascinata segue il dito/il mouse verticalmente, mantenendo
    // anche il leggero "sollevamento" (scala + rotazione) impostato al grab
    dragRow.style.transform = `translateY(${e.clientY - startY}px) ${LIFT}`;

    // Se le righe hanno un raggruppamento (es. checklist per categoria),
    // il riordino resta confinato allo stesso gruppo: righe senza
    // raggruppamento hanno dataset.cat undefined su entrambi i lati, quindi
    // il confronto passa sempre e il comportamento per le altre liste resta invariato
    const gruppo = dragRow.dataset.cat;
    const rows = Array.from(listEl.querySelectorAll('.item-row')).filter(r => r !== dragRow && r.dataset.cat === gruppo);
    for(const row of rows){
      const rect = row.getBoundingClientRect();
      if(e.clientY > rect.top && e.clientY < rect.bottom){
        const before = e.clientY < rect.top + rect.height / 2;
        krAnimateSwap(listEl, dragRow, () => {
          listEl.insertBefore(dragRow, before ? row : row.nextSibling);
        });
        // Ricalibra il punto di riferimento: la riga trascinata è ora nella
        // nuova posizione, quindi il trascinamento riparte da zero per
        // evitare salti visivi
        startY = e.clientY;
        dragRow.style.transform = LIFT;
        break;
      }
    }
  });

  function terminaDrag(){
    if(!dragRow) return;
    const row = dragRow;
    row.classList.remove('dragging');
    row.style.transform = '';
    // Piccola animazione di assestamento quando la riga si ferma nel punto di rilascio
    row.classList.add('drop-settle');
    setTimeout(() => row.classList.remove('drop-settle'), 250);

    const idsOrdinati = Array.from(listEl.querySelectorAll('.item-row')).map(r => r.dataset.id);
    const items = krLoad(key);
    const riordinati = idsOrdinati.map(id => items.find(i => i.id === id)).filter(Boolean);
    krSave(key, riordinati);
    dragRow = null;
    if(onReordered) onReordered();
  }
  listEl.addEventListener('pointerup', terminaDrag);
  listEl.addEventListener('pointercancel', terminaDrag);
}

/* Piccola animazione "FLIP": quando la riga trascinata supera un'altra
   riga e la scavalca, questa non scatta di colpo alla nuova posizione ma
   ci scorre dolcemente, per rendere visibile ed evidente il riordino */
function krAnimateSwap(container, dragRow, mutationFn){
  const rows = Array.from(container.querySelectorAll('.item-row')).filter(r => r !== dragRow);
  const posizioniPrima = new Map();
  rows.forEach(r => posizioniPrima.set(r, r.getBoundingClientRect().top));
  mutationFn();
  rows.forEach(r => {
    const prima = posizioniPrima.get(r);
    const dopo = r.getBoundingClientRect().top;
    const delta = prima - dopo;
    if(delta){
      r.style.transition = 'none';
      r.style.transform = `translateY(${delta}px)`;
      requestAnimationFrame(() => {
        r.style.transition = 'transform .18s ease';
        r.style.transform = '';
      });
    }
  });
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
  let editingId = null;

  function render(){
    const items = krLoad(KEY);
    krSetTileCount('checklist', items.length === 0 ? '0 voci' : `${items.filter(i=>i.done).length}/${items.length} fatti`);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessun oggetto in checklist. Aggiungi la tua attrezzatura qui sopra.');
      progressEl.textContent = '0 / 0 spuntati';
      return;
    }
    // Raggruppa per categoria mantenendo l'ordine di prima apparizione:
    // ogni categoria resta un blocco separato e visivamente distinto
    const categorie = [];
    const gruppi = {};
    items.forEach(it => {
      if(!gruppi[it.cat]){ gruppi[it.cat] = []; categorie.push(it.cat); }
      gruppi[it.cat].push(it);
    });
    listEl.innerHTML = categorie.map(cat => `
      <div class="checklist-group">
        <div class="checklist-group-title">${cat.toUpperCase()}</div>
        ${gruppi[cat].map(it => `
          <div class="item-row" data-id="${it.id}" data-cat="${it.cat}">
            <i data-lucide="grip-vertical" class="drag-handle"></i>
            <input type="checkbox" ${it.done ? 'checked' : ''} data-id="${it.id}" style="width:18px;height:18px;accent-color:var(--accent);flex-shrink:0;">
            <div class="item-main">
              <div class="item-title" style="${it.done ? 'text-decoration:line-through;color:var(--text-faint);' : ''}">${it.text}</div>
            </div>
            <div class="item-actions">
              <button class="icon-btn" data-edit="${it.id}"><i data-lucide="pencil"></i></button>
              <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
            </div>
          </div>
        `).join('')}
      </div>
    `).join('');
    const doneCount = items.filter(i => i.done).length;
    progressEl.textContent = `${doneCount} / ${items.length} spuntati`;
    krIcons();
  }

  function annullaModifica(){
    editingId = null;
    form.reset();
    krSetSubmitIcon(form, 'plus');
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    if(editingId){
      const it = items.find(i => i.id === editingId);
      if(it){ it.text = input.value.trim(); it.cat = catSelect.value; }
      annullaModifica();
    }else{
      items.push({ id: krId(), text: input.value.trim(), cat: catSelect.value, done: false });
      form.reset();
    }
    krSave(KEY, items);
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
    const delBtn = e.target.closest('[data-del]');
    const editBtn = e.target.closest('[data-edit]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      if(editingId === delBtn.dataset.del) annullaModifica();
      render();
    }
    if(editBtn){
      const it = krLoad(KEY).find(i => i.id === editBtn.dataset.edit);
      if(!it) return;
      editingId = it.id;
      input.value = it.text;
      catSelect.value = it.cat;
      krSetSubmitIcon(form, 'check');
      input.focus();
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
      annullaModifica();
      render();
    }
  });

  krEnableDragReorder(listEl, KEY, render);
  render();
  window.addEventListener('kr-cloud-updated', (e) => { if(e.detail === KEY) render(); });
})();

/* =====================================================================
   2) SHOT LIST
   ===================================================================== */
(function shotListModule(){
  const KEY = 'kr_shotlist';
  const form = document.getElementById('formShot');
  const listEl = document.getElementById('shotList');
  const annullaBtn = document.getElementById('btnShotAnnulla');
  const STATI = ['da fare', 'fatto'];
  let editingId = null;

  function render(){
    const items = krLoad(KEY);
    krSetTileCount('shotlist', `${items.length} inquadrature`);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessuna inquadratura pianificata.');
      return;
    }
    listEl.innerHTML = items.map(it => `
      <div class="item-row" data-id="${it.id}">
        <i data-lucide="grip-vertical" class="drag-handle"></i>
        <div class="item-main">
          <div class="item-title">Scena ${it.scena} — ${it.desc}</div>
          ${it.note ? `<div class="item-sub">${it.note}</div>` : ''}
        </div>
        <div class="item-actions">
          <button class="badge ${it.stato === 'fatto' ? 'badge-success' : 'badge-neutral'}" data-toggle="${it.id}">${it.stato}</button>
          <button class="icon-btn" data-edit="${it.id}"><i data-lucide="pencil"></i></button>
          <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `).join('');
    krIcons();
  }

  function annullaModifica(){
    editingId = null;
    form.reset();
    annullaBtn.style.display = 'none';
    krSetSubmitIcon(form, 'plus');
  }
  annullaBtn.addEventListener('click', annullaModifica);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    const valori = {
      scena: document.getElementById('shotScena').value.trim(),
      desc: document.getElementById('shotDesc').value.trim(),
      note: document.getElementById('shotNote').value.trim()
    };
    if(editingId){
      const it = items.find(i => i.id === editingId);
      if(it) Object.assign(it, valori);
      annullaModifica();
    }else{
      items.push({ id: krId(), ...valori, stato: 'da fare' });
      form.reset();
    }
    krSave(KEY, items);
    render();
  });

  listEl.addEventListener('click', e => {
    const toggleBtn = e.target.closest('[data-toggle]');
    const delBtn = e.target.closest('[data-del]');
    const editBtn = e.target.closest('[data-edit]');
    if(toggleBtn){
      const items = krLoad(KEY);
      const it = items.find(i => i.id === toggleBtn.dataset.toggle);
      if(it) it.stato = STATI[(STATI.indexOf(it.stato) + 1) % STATI.length];
      krSave(KEY, items);
      render();
    }
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      if(editingId === delBtn.dataset.del) annullaModifica();
      render();
    }
    if(editBtn){
      const it = krLoad(KEY).find(i => i.id === editBtn.dataset.edit);
      if(!it) return;
      editingId = it.id;
      document.getElementById('shotScena').value = it.scena;
      document.getElementById('shotDesc').value = it.desc;
      document.getElementById('shotNote').value = it.note || '';
      annullaBtn.style.display = 'inline-flex';
      krSetSubmitIcon(form, 'check');
    }
  });

  krEnableDragReorder(listEl, KEY, render);
  render();
  window.addEventListener('kr-cloud-updated', (e) => { if(e.detail === KEY) render(); });
})();

/* =====================================================================
   3) LOCATION SCOUTING
   ===================================================================== */
(function locationModule(){
  const KEY = 'kr_locations';
  const form = document.getElementById('formLocation');
  const listEl = document.getElementById('locationList');
  const annullaBtn = document.getElementById('btnLocAnnulla');
  let editingId = null;

  function render(){
    const items = krLoad(KEY);
    krSetTileCount('location', `${items.length} location`);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessuna location salvata.');
      return;
    }
    listEl.innerHTML = items.map(it => `
      <div class="item-row" data-id="${it.id}">
        <i data-lucide="grip-vertical" class="drag-handle"></i>
        <div class="item-main">
          <div class="item-title">${it.nome}</div>
          <div class="item-sub">${[it.indirizzo, it.orario].filter(Boolean).join(' · ') || 'Nessun dettaglio'}</div>
        </div>
        <div class="item-actions">
          ${it.indirizzo ? `<a class="icon-btn accent" target="_blank" rel="noopener" href="https://maps.apple.com/?q=${encodeURIComponent(it.indirizzo)}"><i data-lucide="navigation"></i></a>` : ''}
          <button class="icon-btn" data-edit="${it.id}"><i data-lucide="pencil"></i></button>
          <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `).join('');
    krIcons();
  }

  function annullaModifica(){
    editingId = null;
    form.reset();
    annullaBtn.style.display = 'none';
    krSetSubmitIcon(form, 'plus');
  }
  annullaBtn.addEventListener('click', annullaModifica);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    const valori = {
      nome: document.getElementById('locNome').value.trim(),
      indirizzo: document.getElementById('locIndirizzo').value.trim(),
      orario: document.getElementById('locOrario').value.trim()
    };
    if(editingId){
      const it = items.find(i => i.id === editingId);
      if(it) Object.assign(it, valori);
      annullaModifica();
    }else{
      items.push({ id: krId(), ...valori });
      form.reset();
    }
    krSave(KEY, items);
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    const editBtn = e.target.closest('[data-edit]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      if(editingId === delBtn.dataset.del) annullaModifica();
      render();
    }
    if(editBtn){
      const it = krLoad(KEY).find(i => i.id === editBtn.dataset.edit);
      if(!it) return;
      editingId = it.id;
      document.getElementById('locNome').value = it.nome;
      document.getElementById('locIndirizzo').value = it.indirizzo || '';
      document.getElementById('locOrario').value = it.orario || '';
      annullaBtn.style.display = 'inline-flex';
      krSetSubmitIcon(form, 'check');
    }
  });

  krEnableDragReorder(listEl, KEY, render);
  render();
  window.addEventListener('kr-cloud-updated', (e) => { if(e.detail === KEY) render(); });
})();

/* =====================================================================
   4) CONTATTI RAPIDI TROUPE
   ===================================================================== */
(function contattiModule(){
  const KEY = 'kr_contatti';
  const form = document.getElementById('formContatti');
  const listEl = document.getElementById('contattiList');
  const annullaBtn = document.getElementById('btnContAnnulla');
  let editingId = null;

  function render(){
    const items = krLoad(KEY);
    krSetTileCount('contatti', `${items.length} contatti`);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessun contatto salvato.');
      return;
    }
    listEl.innerHTML = items.map(it => `
      <div class="item-row" data-id="${it.id}">
        <i data-lucide="grip-vertical" class="drag-handle"></i>
        <div class="item-main">
          <div class="item-title">${it.nome}</div>
          <div class="item-sub">${it.ruolo || 'Ruolo non specificato'}</div>
        </div>
        <div class="item-actions">
          <a class="icon-btn accent" href="tel:${it.tel}"><i data-lucide="phone"></i></a>
          <a class="icon-btn accent" target="_blank" rel="noopener" href="https://wa.me/${it.tel.replace(/[^0-9]/g,'')}"><i data-lucide="message-circle"></i></a>
          <button class="icon-btn" data-edit="${it.id}"><i data-lucide="pencil"></i></button>
          <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `).join('');
    krIcons();
  }

  function annullaModifica(){
    editingId = null;
    form.reset();
    annullaBtn.style.display = 'none';
    krSetSubmitIcon(form, 'plus');
  }
  annullaBtn.addEventListener('click', annullaModifica);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    const valori = {
      nome: document.getElementById('contNome').value.trim(),
      ruolo: document.getElementById('contRuolo').value.trim(),
      tel: document.getElementById('contTel').value.trim()
    };
    if(editingId){
      const it = items.find(i => i.id === editingId);
      if(it) Object.assign(it, valori);
      annullaModifica();
    }else{
      items.push({ id: krId(), ...valori });
      form.reset();
    }
    krSave(KEY, items);
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    const editBtn = e.target.closest('[data-edit]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      if(editingId === delBtn.dataset.del) annullaModifica();
      render();
    }
    if(editBtn){
      const it = krLoad(KEY).find(i => i.id === editBtn.dataset.edit);
      if(!it) return;
      editingId = it.id;
      document.getElementById('contNome').value = it.nome;
      document.getElementById('contRuolo').value = it.ruolo || '';
      document.getElementById('contTel').value = it.tel;
      annullaBtn.style.display = 'inline-flex';
      krSetSubmitIcon(form, 'check');
    }
  });

  krEnableDragReorder(listEl, KEY, render);
  render();
  window.addEventListener('kr-cloud-updated', (e) => { if(e.detail === KEY) render(); });
})();

/* =====================================================================
   5) IPERFOCALE & PROFONDITÀ DI CAMPO
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
   6) ESPOSIZIONE / ND FILTER
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
    const stopApertura = 2 * Math.log2(aC / aT);
    const stopOtturatore = Math.log2(sC / sT);
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
   7) TIMELAPSE
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
   8) LOG CIAK
   ===================================================================== */
/* Riferimento globale al render del log ciak, riusato dalla modalità
   schermo intero per aggiornare la lista principale dopo un salvataggio. */
let krRenderCiak = null;

(function ciakModule(){
  const KEY = 'kr_ciak';
  const form = document.getElementById('formCiak');
  const listEl = document.getElementById('ciakList');
  const countEl = document.getElementById('ciakCount');
  const annullaBtn = document.getElementById('btnCiakAnnulla');
  const GIUDIZI = { buona: { label: 'Buona', cls: 'badge-success' }, rifare: { label: 'Da rifare', cls: 'badge-warning' }, ng: { label: 'NG', cls: 'badge-danger' } };
  let editingId = null;

  function render(){
    const items = krLoad(KEY);
    countEl.textContent = `${items.length} ciak registrati`;
    krSetTileCount('ciak', `${items.length} ciak`);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessun ciak registrato.');
      return;
    }
    listEl.innerHTML = items.slice().reverse().map(it => {
      const g = GIUDIZI[it.giudizio];
      const clip = [it.clipVideo ? `Video: ${it.clipVideo}` : '', it.clipAudio ? `Audio: ${it.clipAudio}` : ''].filter(Boolean).join(' · ');
      return `
        <div class="item-row" data-id="${it.id}">
          <i data-lucide="grip-vertical" class="drag-handle"></i>
          <div class="item-main">
            <div class="item-title">Scena ${it.scena} · Ciak ${it.ciak} <span class="mono" style="color:var(--text-faint); font-size:11px;">${it.ora}</span></div>
            ${clip ? `<div class="item-sub mono">${clip}</div>` : ''}
            ${it.note ? `<div class="item-sub">${it.note}</div>` : ''}
          </div>
          <div class="item-actions">
            <span class="badge ${g.cls}">${g.label}</span>
            <button class="icon-btn" data-edit="${it.id}"><i data-lucide="pencil"></i></button>
            <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      `;
    }).join('');
    krIcons();
  }

  function annullaModifica(){
    editingId = null;
    form.reset();
    annullaBtn.style.display = 'none';
    krSetSubmitIcon(form, 'plus');
  }
  annullaBtn.addEventListener('click', annullaModifica);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    const valori = {
      scena: document.getElementById('ciakScena').value.trim(),
      ciak: document.getElementById('ciakNum').value.trim(),
      giudizio: document.getElementById('ciakGiudizio').value,
      clipVideo: document.getElementById('ciakClipVideo').value.trim(),
      clipAudio: document.getElementById('ciakClipAudio').value.trim(),
      note: document.getElementById('ciakNote').value.trim()
    };
    if(editingId){
      const it = items.find(i => i.id === editingId);
      if(it) Object.assign(it, valori);
      annullaModifica();
    }else{
      items.push({ id: krId(), ...valori, ora: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) });
      form.reset();
    }
    krSave(KEY, items);
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    const editBtn = e.target.closest('[data-edit]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      if(editingId === delBtn.dataset.del) annullaModifica();
      render();
    }
    if(editBtn){
      const it = krLoad(KEY).find(i => i.id === editBtn.dataset.edit);
      if(!it) return;
      editingId = it.id;
      document.getElementById('ciakScena').value = it.scena;
      document.getElementById('ciakNum').value = it.ciak;
      document.getElementById('ciakGiudizio').value = it.giudizio;
      document.getElementById('ciakClipVideo').value = it.clipVideo || '';
      document.getElementById('ciakClipAudio').value = it.clipAudio || '';
      document.getElementById('ciakNote').value = it.note || '';
      annullaBtn.style.display = 'inline-flex';
      krSetSubmitIcon(form, 'check');
    }
  });

  /* Esporta l'intero log in un file CSV scaricabile (apribile con Excel/
     Fogli Google), con tutte le informazioni di ogni ciak registrato */
  document.getElementById('btnCiakEsporta').addEventListener('click', () => {
    const items = krLoad(KEY);
    if(items.length === 0){ alert('Non ci sono ciak da esportare.'); return; }
    const intestazioni = ['Scena', 'Ciak', 'Giudizio', 'Clip video', 'Clip audio', 'Note', 'Ora'];
    const escapeCsv = v => `"${String(v || '').replace(/"/g, '""')}"`;
    const righe = items.map(it => [
      it.scena, it.ciak, GIUDIZI[it.giudizio] ? GIUDIZI[it.giudizio].label : it.giudizio,
      it.clipVideo, it.clipAudio, it.note, it.ora
    ].map(escapeCsv).join(';'));
    const csv = '\uFEFF' + [intestazioni.map(escapeCsv).join(';'), ...righe].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log-ciak-REC-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  });

  krRenderCiak = render;
  krEnableDragReorder(listEl, KEY, render);
  render();
  window.addEventListener('kr-cloud-updated', (e) => { if(e.detail === KEY) render(); });

  document.getElementById('btnCiakFullscreen').addEventListener('click', () => {
    document.getElementById('ciakFullscreen').classList.add('open');
    if(window.krOpenFullscreenCiak) window.krOpenFullscreenCiak();
  });
})();

/* =====================================================================
   8-bis) MODALITÀ CIAK A SCHERMO INTERO
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
   9) NOTE VOCALI RAPIDE
   Usa la Web Speech API se disponibile (principalmente Chrome); su
   browser non supportati resta comunque utilizzabile come note testuali.
   ===================================================================== */
(function noteModule(){
  const KEY = 'kr_note';
  const micBtn = document.getElementById('btnNoteMic');
  const testoEl = document.getElementById('noteTesto');
  const sceneEl = document.getElementById('noteScena');
  const salvaBtn = document.getElementById('btnNoteSalva');
  const annullaBtn = document.getElementById('btnNoteAnnulla');
  const listEl = document.getElementById('noteList');
  let editingId = null;

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
    krSetTileCount('note', `${items.length} note`);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessuna nota salvata.');
      return;
    }
    listEl.innerHTML = items.slice().reverse().map(it => `
      <div class="item-row" data-id="${it.id}">
        <i data-lucide="grip-vertical" class="drag-handle"></i>
        <div class="item-main">
          <div class="item-title">${it.scena ? '[' + it.scena + '] ' : ''}${it.testo}</div>
          <div class="item-sub">${it.ora}</div>
        </div>
        <div class="item-actions">
          <button class="icon-btn" data-edit="${it.id}"><i data-lucide="pencil"></i></button>
          <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `).join('');
    krIcons();
  }

  function annullaModifica(){
    editingId = null;
    testoEl.value = '';
    sceneEl.value = '';
    annullaBtn.style.display = 'none';
    salvaBtn.innerHTML = '<i data-lucide="save"></i> Salva nota';
    krIcons();
  }
  annullaBtn.addEventListener('click', annullaModifica);

  salvaBtn.addEventListener('click', () => {
    const testo = testoEl.value.trim();
    if(!testo) return;
    const items = krLoad(KEY);
    if(editingId){
      const it = items.find(i => i.id === editingId);
      if(it){ it.testo = testo; it.scena = sceneEl.value.trim(); }
      annullaModifica();
    }else{
      items.push({
        id: krId(),
        testo,
        scena: sceneEl.value.trim(),
        ora: new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      });
      testoEl.value = '';
      sceneEl.value = '';
    }
    krSave(KEY, items);
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    const editBtn = e.target.closest('[data-edit]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      if(editingId === delBtn.dataset.del) annullaModifica();
      render();
    }
    if(editBtn){
      const it = krLoad(KEY).find(i => i.id === editBtn.dataset.edit);
      if(!it) return;
      editingId = it.id;
      testoEl.value = it.testo;
      sceneEl.value = it.scena || '';
      annullaBtn.style.display = 'inline-flex';
      salvaBtn.innerHTML = '<i data-lucide="check"></i> Salva modifica';
      krIcons();
    }
  });

  krEnableDragReorder(listEl, KEY, render);
  render();
  window.addEventListener('kr-cloud-updated', (e) => { if(e.detail === KEY) render(); });
})();

/* =====================================================================
   10) RELEASE / LIBERATORIA DIGITALE
   Firma disegnata su canvas (mouse e touch), salvata come immagine
   dataURL insieme ai dati testuali in localStorage. In modifica, la
   firma esistente viene ridisegnata sul canvas così può essere lasciata
   com'è oppure cancellata e rifatta.
   ===================================================================== */
(function releaseModule(){
  const KEY = 'kr_liberatorie';
  const canvas = document.getElementById('relCanvas');
  const ctx = canvas.getContext('2d');
  const listEl = document.getElementById('releaseList');
  const dataInput = document.getElementById('relData');
  const nomeInput = document.getElementById('relNome');
  const testoInput = document.getElementById('relTesto');
  const salvaBtn = document.getElementById('btnRelSalva');
  const testoDefault = testoInput.value;
  dataInput.value = new Date().toISOString().slice(0, 10);
  let editingId = null;

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
    krSetTileCount('release', `${items.length} firmate`);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessuna liberatoria salvata.');
      return;
    }
    listEl.innerHTML = items.slice().reverse().map(it => `
      <div class="item-row" data-id="${it.id}">
        <i data-lucide="grip-vertical" class="drag-handle"></i>
        <div class="item-main">
          <div class="item-title">${it.nome}</div>
          <div class="item-sub">${it.data}</div>
        </div>
        <div class="item-actions">
          <a class="icon-btn accent" download="liberatoria-${it.nome}.png" href="${it.firma}"><i data-lucide="download"></i></a>
          <button class="icon-btn" data-edit="${it.id}"><i data-lucide="pencil"></i></button>
          <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `).join('');
    krIcons();
  }

  function annullaModifica(){
    editingId = null;
    nomeInput.value = '';
    testoInput.value = testoDefault;
    dataInput.value = new Date().toISOString().slice(0, 10);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    salvaBtn.innerHTML = '<i data-lucide="save"></i> Salva liberatoria';
    krIcons();
  }

  salvaBtn.addEventListener('click', () => {
    const nome = nomeInput.value.trim();
    if(!nome){ alert('Inserisci il nome del soggetto.'); return; }
    const items = krLoad(KEY);
    const firma = canvas.toDataURL('image/png');
    if(editingId){
      const it = items.find(i => i.id === editingId);
      if(it){ it.nome = nome; it.data = dataInput.value; it.testo = testoInput.value; it.firma = firma; }
      annullaModifica();
    }else{
      items.push({ id: krId(), nome, data: dataInput.value, testo: testoInput.value, firma });
      nomeInput.value = '';
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    krSave(KEY, items);
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    const editBtn = e.target.closest('[data-edit]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      if(editingId === delBtn.dataset.del) annullaModifica();
      render();
    }
    if(editBtn){
      const it = krLoad(KEY).find(i => i.id === editBtn.dataset.edit);
      if(!it) return;
      editingId = it.id;
      nomeInput.value = it.nome;
      dataInput.value = it.data;
      testoInput.value = it.testo;
      // Ridisegna la firma esistente sul canvas: l'utente può lasciarla
      // così com'è, oppure cancellarla e firmare di nuovo
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width / 2, canvas.height / 2);
      };
      img.src = it.firma;
      salvaBtn.innerHTML = '<i data-lucide="check"></i> Salva modifica';
      krIcons();
      nomeInput.focus();
    }
  });

  krEnableDragReorder(listEl, KEY, render);
  render();
  window.addEventListener('kr-cloud-updated', (e) => { if(e.detail === KEY) render(); });
})();

/* =====================================================================
   11) SPESE GIORNATA
   ===================================================================== */
(function speseModule(){
  const KEY = 'kr_spese';
  const form = document.getElementById('formSpesa');
  const listEl = document.getElementById('speseList');
  const totaleEl = document.getElementById('speseTotale');
  const annullaBtn = document.getElementById('btnSpesaAnnulla');
  let editingId = null;

  function formatEuro(n){
    return '€ ' + n.toFixed(2).replace('.', ',');
  }

  function render(){
    const items = krLoad(KEY);
    const totale = items.reduce((sum, i) => sum + i.importo, 0);
    totaleEl.textContent = formatEuro(totale);
    krSetTileCount('spese', formatEuro(totale));
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessuna spesa registrata.');
      return;
    }
    listEl.innerHTML = items.slice().reverse().map(it => `
      <div class="item-row" data-id="${it.id}">
        <i data-lucide="grip-vertical" class="drag-handle"></i>
        <div class="item-main">
          <div class="item-title">${it.desc}</div>
          <div class="item-sub">${it.cat}</div>
        </div>
        <div class="item-actions">
          <span class="mono" style="font-size:14px;">${formatEuro(it.importo)}</span>
          <button class="icon-btn" data-edit="${it.id}"><i data-lucide="pencil"></i></button>
          <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
    `).join('');
    krIcons();
  }

  function annullaModifica(){
    editingId = null;
    form.reset();
    annullaBtn.style.display = 'none';
    krSetSubmitIcon(form, 'plus');
  }
  annullaBtn.addEventListener('click', annullaModifica);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    const valori = {
      desc: document.getElementById('spesaDesc').value.trim(),
      importo: parseFloat(document.getElementById('spesaImporto').value),
      cat: document.getElementById('spesaCat').value
    };
    if(editingId){
      const it = items.find(i => i.id === editingId);
      if(it) Object.assign(it, valori);
      annullaModifica();
    }else{
      items.push({ id: krId(), ...valori });
      form.reset();
    }
    krSave(KEY, items);
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    const editBtn = e.target.closest('[data-edit]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      if(editingId === delBtn.dataset.del) annullaModifica();
      render();
    }
    if(editBtn){
      const it = krLoad(KEY).find(i => i.id === editBtn.dataset.edit);
      if(!it) return;
      editingId = it.id;
      document.getElementById('spesaDesc').value = it.desc;
      document.getElementById('spesaImporto').value = it.importo;
      document.getElementById('spesaCat').value = it.cat;
      annullaBtn.style.display = 'inline-flex';
      krSetSubmitIcon(form, 'check');
    }
  });

  krEnableDragReorder(listEl, KEY, render);
  render();
  window.addEventListener('kr-cloud-updated', (e) => { if(e.detail === KEY) render(); });
})();

/* =====================================================================
   12) PROMEMORIA & ALLARMI
   Controlla ogni 30 secondi se un promemoria è scaduto e, se le
   notifiche del browser sono state autorizzate, invia una notifica.
   ===================================================================== */
(function promemoriaModule(){
  const KEY = 'kr_promemoria';
  const form = document.getElementById('formPromemoria');
  const listEl = document.getElementById('promemoriaList');
  const notifBtn = document.getElementById('btnPromNotifiche');
  const annullaBtn = document.getElementById('btnPromAnnulla');
  let editingId = null;

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
    krSetTileCount('promemoria', `${items.length} impostati`);
    if(items.length === 0){
      krRenderEmpty(listEl, 'Nessun promemoria impostato.');
      return;
    }
    const ora = oraAttualeStr();
    listEl.innerHTML = items.map(it => {
      const passato = it.orario < ora;
      return `
        <div class="item-row" data-id="${it.id}" style="${passato ? 'opacity:.5;' : ''}">
          <i data-lucide="grip-vertical" class="drag-handle"></i>
          <div class="item-main">
            <div class="item-title">${it.testo}</div>
            <div class="item-sub mono">${it.orario}</div>
          </div>
          <div class="item-actions">
            <button class="icon-btn" data-edit="${it.id}"><i data-lucide="pencil"></i></button>
            <button class="icon-btn danger" data-del="${it.id}"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
      `;
    }).join('');
    krIcons();
  }

  function annullaModifica(){
    editingId = null;
    form.reset();
    annullaBtn.style.display = 'none';
    krSetSubmitIcon(form, 'plus');
  }
  annullaBtn.addEventListener('click', annullaModifica);

  form.addEventListener('submit', e => {
    e.preventDefault();
    const items = krLoad(KEY);
    const valori = {
      testo: document.getElementById('promTesto').value.trim(),
      orario: document.getElementById('promOrario').value
    };
    if(editingId){
      const it = items.find(i => i.id === editingId);
      if(it) Object.assign(it, valori, { notificato: false });
      annullaModifica();
    }else{
      items.push({ id: krId(), ...valori, notificato: false });
      form.reset();
    }
    krSave(KEY, items);
    render();
  });

  listEl.addEventListener('click', e => {
    const delBtn = e.target.closest('[data-del]');
    const editBtn = e.target.closest('[data-edit]');
    if(delBtn){
      krSave(KEY, krLoad(KEY).filter(i => i.id !== delBtn.dataset.del));
      if(editingId === delBtn.dataset.del) annullaModifica();
      render();
    }
    if(editBtn){
      const it = krLoad(KEY).find(i => i.id === editBtn.dataset.edit);
      if(!it) return;
      editingId = it.id;
      document.getElementById('promTesto').value = it.testo;
      document.getElementById('promOrario').value = it.orario;
      annullaBtn.style.display = 'inline-flex';
      krSetSubmitIcon(form, 'check');
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
          new Notification('Promemoria REC', { body: it.testo });
        }
      }
    });
    if(cambiato) krSave(KEY, items);
    render();
  }, 30000);

  krEnableDragReorder(listEl, KEY, render);
  render();
  window.addEventListener('kr-cloud-updated', (e) => { if(e.detail === KEY) render(); });
})();

/* =====================================================================
   13) REPORT PDF AMMINISTRAZIONE
   Compila un report stampabile con logo, liberatorie, spese e
   promemoria, poi apre la finestra di stampa del browser: l'utente
   sceglie "Salva come PDF" come stampante di destinazione. Non serve
   nessuna libreria esterna.
   ===================================================================== */
(function pdfReportModule(){
  const btn = document.getElementById('btnGeneraPdf');
  const container = document.getElementById('printReport');

  function formatEuro(n){
    return '€ ' + n.toFixed(2).replace('.', ',');
  }

  function costruisciReport(){
    const liberatorie = krLoad('kr_liberatorie');
    const spese = krLoad('kr_spese');
    const promemoria = krLoad('kr_promemoria');
    const oggi = new Date().toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
    const totaleSpese = spese.reduce((s, i) => s + (Number(i.importo) || 0), 0);

    let html = `
      <div class="pr-header">
        <div class="pr-logo"><img src="logo.png" alt="REC"></div>
        <div class="pr-header-text">
          <h1>Report amministrazione giornata di ripresa</h1>
          <p>Generato il ${oggi}</p>
        </div>
      </div>
    `;

    html += `<h2>Liberatorie (${liberatorie.length})</h2>`;
    if(liberatorie.length === 0){
      html += `<p class="pr-empty">Nessuna liberatoria registrata.</p>`;
    }else{
      liberatorie.forEach(it => {
        html += `
          <div class="pr-release">
            <div><strong>${it.nome}</strong> — ${it.data}</div>
            <div class="pr-release-text">${it.testo}</div>
            ${it.firma ? `<img class="pr-signature" src="${it.firma}" alt="Firma di ${it.nome}">` : ''}
          </div>
        `;
      });
    }

    html += `<h2>Spese (${spese.length})</h2>`;
    if(spese.length === 0){
      html += `<p class="pr-empty">Nessuna spesa registrata.</p>`;
    }else{
      html += `<table class="pr-table"><thead><tr><th>Descrizione</th><th>Categoria</th><th>Importo</th></tr></thead><tbody>`;
      spese.forEach(it => {
        html += `<tr><td>${it.desc}</td><td>${it.cat}</td><td>${formatEuro(Number(it.importo) || 0)}</td></tr>`;
      });
      html += `</tbody><tfoot><tr><td colspan="2">Totale</td><td>${formatEuro(totaleSpese)}</td></tr></tfoot></table>`;
    }

    html += `<h2>Promemoria (${promemoria.length})</h2>`;
    if(promemoria.length === 0){
      html += `<p class="pr-empty">Nessun promemoria impostato.</p>`;
    }else{
      html += `<table class="pr-table"><thead><tr><th>Orario</th><th>Testo</th></tr></thead><tbody>`;
      promemoria.forEach(it => {
        html += `<tr><td>${it.orario}</td><td>${it.testo}</td></tr>`;
      });
      html += `</tbody></table>`;
    }

    container.innerHTML = html;
  }

  btn.addEventListener('click', () => {
    costruisciReport();
    document.body.classList.add('printing');
    window.print();
  });

  // Ripristina la visualizzazione normale dell'app dopo la stampa
  // (o dopo che l'utente annulla la finestra di stampa)
  window.addEventListener('afterprint', () => {
    document.body.classList.remove('printing');
  });
})();

/* Mostra il banner di avviso solo se il backend cloud non è ancora
   stato configurato con un URL e un token reali */
(function checkConfigWarning(){
  const banner = document.getElementById('configWarning');
  if(banner) banner.style.display = krCloudConfigured() ? 'none' : 'flex';
})();

/* Prima inizializzazione delle icone Lucide al caricamento della pagina */
krIcons();

/* Al caricamento della pagina prova subito a sincronizzare con il cloud
   (se configurato): se il backend risponde, sovrascrive i dati locali
   con quelli più aggiornati e ridisegna le liste. */
krCloudSyncAll();

/* Pulsante manuale nell'header per forzare una nuova sincronizzazione */
const btnSyncManual = document.getElementById('syncStatus');
if(btnSyncManual) btnSyncManual.addEventListener('click', krCloudSyncAll);
