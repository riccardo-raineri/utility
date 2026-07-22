/* ============================================================================
   LISTA DELLA SPESA 2.0 - Frontend
   ============================================================================
   IMPORTANTE: dopo aver pubblicato lo script come Web App, incolla qui sotto
   l'URL che Google ti da (finisce con /exec).
   ============================================================================ */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxmtXY1qGdTLYOo-vElncFxXg2FtGxYIhrmOdQQsJpBt44FUSYwILZtIGvRUN0UUD0y/exec';

// Categorie in ordine di visualizzazione predefinito, con icona
const CATEGORIE = [
  { id: 'Frutta e Verdura', icona: '\u{1F96C}' },
  { id: 'Latticini', icona: '\u{1F9C0}' },
  { id: 'Carne e Pesce', icona: '\u{1F41F}' },
  { id: 'Salumi', icona: '\u{1F953}' },
  { id: 'Scatolame', icona: '\u{1F96B}' },
  { id: 'Surgelati', icona: '\u{1F9CA}' },
  { id: 'Condimenti', icona: '\u{1F9C2}' },
  { id: 'Colazione', icona: '\u{1F950}' },
  { id: 'Snacks', icona: '\u{1F36A}' },
  { id: 'Vini e Birra', icona: '\u{1F377}' },
  { id: 'Chimici', icona: '\u{1F9F4}' },
  { id: 'Altro', icona: '\u{1F4E6}' }
];

// Stato applicativo in memoria: viene ricaricato da Google Fogli a ogni avvio
let stato = { prodotti: [], rilevazioni: [], lista: [], ordini: {} };
let graficoStorico = null;
let graficoCategorie = null;
let graficoMensile = null;
let ordineCorrente = []; // usato mentre si modifica l'ordine corsie di un supermercato

/* ----------------------------------------------------------------------- *
 *  COMUNICAZIONE COL BACKEND
 * ----------------------------------------------------------------------- */

async function chiamaBackend(action, extraParams) {
  const params = new URLSearchParams(Object.assign({ action: action }, extraParams || {}));
  const res = await fetch(WEBAPP_URL + '?' + params.toString());
  const json = await res.json();
  if (!json.ok) throw new Error(json.errore || 'Errore sconosciuto dal backend');
  return json;
}

async function caricaDati() {
  try {
    const json = await chiamaBackend('dati');
    stato.prodotti = json.prodotti;
    stato.rilevazioni = json.rilevazioni;
    stato.lista = json.lista;
    stato.ordini = json.ordini || {};
    renderTutto();
  } catch (err) {
    mostraToast('Errore nel caricamento: ' + err.message);
  }
}

async function sincronizzaLista() {
  await chiamaBackend('aggiornaLista', { data: JSON.stringify(stato.lista) });
}

/* ----------------------------------------------------------------------- *
 *  AVVIO E NAVIGAZIONE TRA VISTE
 * ----------------------------------------------------------------------- */

document.addEventListener('DOMContentLoaded', function () {
  inizializzaTema();
  popolaSelectCategorie();
  collegaEventi();
  caricaDati();
});

function collegaEventi() {
  document.getElementById('tabs').addEventListener('click', function (e) {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    cambiaVista(btn.dataset.view);
  });

  document.getElementById('theme-toggle').addEventListener('click', cambiaTema);
  document.getElementById('btn-aggiungi').addEventListener('click', aggiungiProdottoALista);
  document.getElementById('btn-registra').addEventListener('click', registraSpesaOdierna);
  document.getElementById('btn-svuota').addEventListener('click', svuotaListaCorrente);

  document.getElementById('input-prodotto').addEventListener('input', aggiornaAnteprimaProdotto);
  document.getElementById('input-peso').addEventListener('input', aggiornaAnteprimaProdotto);
  document.getElementById('input-prezzo').addEventListener('input', aggiornaAnteprimaProdotto);
  document.getElementById('input-unita').addEventListener('change', aggiornaAnteprimaProdotto);

  // L'ordine delle corsie dipende dal supermercato selezionato: ri-raggruppa la lista quando cambia
  document.getElementById('input-supermercato').addEventListener('input', renderListaSpesa);

  document.getElementById('storico-select-prodotto').addEventListener('change', renderStorico);
  document.getElementById('confronto-select-prodotto').addEventListener('change', renderConfronto);

  // Ordine corsie
  document.getElementById('btn-ordine-corsie').addEventListener('click', apriPannelloOrdine);
  document.getElementById('btn-chiudi-ordine').addEventListener('click', function () {
    document.getElementById('pannello-ordine').classList.add('nascosto');
  });
  document.getElementById('btn-salva-ordine').addEventListener('click', salvaOrdineCorsie);
  document.getElementById('ordine-lista').addEventListener('click', function (e) {
    const btn = e.target.closest('.freccia');
    if (!btn) return;
    spostaCategoria(Number(btn.dataset.indice), Number(btn.dataset.dir));
  });

  // Prodotti base
  document.getElementById('btn-prodotti-base').addEventListener('click', apriPannelloBase);
  document.getElementById('btn-chiudi-base').addEventListener('click', function () {
    document.getElementById('pannello-base').classList.add('nascosto');
  });
  document.getElementById('base-lista').addEventListener('click', function (e) {
    const btn = e.target.closest('.stella');
    if (!btn) return;
    toggleBaseProdotto(btn.dataset.nome);
  });
  document.getElementById('btn-aggiungi-base').addEventListener('click', aggiungiProdottiBase);
}

function cambiaVista(view) {
  document.querySelectorAll('.tab-btn').forEach(function (b) {
    b.classList.toggle('active', b.dataset.view === view);
  });
  document.querySelectorAll('.view').forEach(function (v) {
    v.classList.toggle('active', v.id === 'view-' + view);
  });
  if (view === 'storico') renderStorico();
  if (view === 'confronto') renderConfronto();
  if (view === 'statistiche') renderStatistiche();
}

/* ----------------------------------------------------------------------- *
 *  TEMA CHIARO / SCURO (default scuro, coerente col resto del sito)
 * ----------------------------------------------------------------------- */

function inizializzaTema() {
  const salvato = localStorage.getItem('spesa-tema') || 'dark';
  document.documentElement.setAttribute('data-theme', salvato);
}

function cambiaTema() {
  const attuale = document.documentElement.getAttribute('data-theme');
  const nuovo = attuale === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', nuovo);
  localStorage.setItem('spesa-tema', nuovo);
}

/* ----------------------------------------------------------------------- *
 *  VISTA: FORM AGGIUNTA PRODOTTO
 * ----------------------------------------------------------------------- */

function popolaSelectCategorie() {
  const select = document.getElementById('input-categoria');
  select.innerHTML = CATEGORIE.map(function (c) {
    return '<option value="' + c.id + '">' + c.icona + ' ' + c.id + '</option>';
  }).join('');
}

function popolaDatalist() {
  document.getElementById('prodotti-list').innerHTML = stato.prodotti.map(function (p) {
    return '<option value="' + p.nome + '">';
  }).join('');

  const supermercati = [...new Set(stato.rilevazioni.map(function (r) { return r.supermercato; }))];
  document.getElementById('supermercati-list').innerHTML = supermercati.map(function (s) {
    return '<option value="' + s + '">';
  }).join('');
}

/** Trova l'ultima rilevazione nota per un prodotto (indipendentemente dal supermercato). */
function ultimaRilevazione(nomeProdotto) {
  const storicoProdotto = stato.rilevazioni
    .filter(function (r) { return r.prodotto === nomeProdotto; })
    .sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  return storicoProdotto[0] || null;
}

/** Quando l'utente digita un prodotto gia' noto, precompila categoria/unita e mostra il confronto col prezzo/kg precedente. */
function aggiornaAnteprimaProdotto() {
  const nome = document.getElementById('input-prodotto').value.trim();
  const hint = document.getElementById('hint-prezzo');

  const noto = stato.prodotti.find(function (p) { return p.nome === nome; });
  if (noto) {
    document.getElementById('input-categoria').value = noto.categoria;
    document.getElementById('input-unita').value = noto.unita;
  }

  const peso = parseFloat(document.getElementById('input-peso').value);
  const prezzo = parseFloat(document.getElementById('input-prezzo').value);
  const unita = document.getElementById('input-unita').value;

  if (!peso || !prezzo) { hint.textContent = ''; hint.className = 'hint'; return; }

  // Calcolo automatico del prezzo al kg (o all'unita' equivalente) a partire da peso e prezzo a confezione
  const prezzoKg = calcolaPrezzoKg(peso, unita, prezzo);
  let testo = '\u20AC/kg: ' + prezzoKg.toFixed(2);

  const ultima = ultimaRilevazione(nome);
  hint.className = 'hint';
  if (ultima && ultima.prezzoKg) {
    const diff = ((prezzoKg - ultima.prezzoKg) / ultima.prezzoKg) * 100;
    if (Math.abs(diff) >= 1) {
      testo += '  \u2022  ' + (diff > 0 ? '+' : '') + diff.toFixed(0) + '% rispetto a ' + ultima.data;
      hint.classList.add(diff > 0 ? 'up' : 'down');
    }
  }
  hint.textContent = testo;
}

function calcolaPrezzoKg(peso, unita, prezzo) {
  let pesoKg = peso;
  if (unita === 'g' || unita === 'ml') pesoKg = peso / 1000;
  return pesoKg > 0 ? prezzo / pesoKg : prezzo;
}

async function aggiungiProdottoALista() {
  const nome = document.getElementById('input-prodotto').value.trim();
  const categoria = document.getElementById('input-categoria').value;
  const unita = document.getElementById('input-unita').value;
  const peso = parseFloat(document.getElementById('input-peso').value);
  const prezzo = parseFloat(document.getElementById('input-prezzo').value);
  const supermercato = document.getElementById('input-supermercato').value.trim() || 'Non specificato';

  if (!nome || !peso || !prezzo) {
    mostraToast('Inserisci almeno prodotto, peso e prezzo');
    return;
  }

  stato.lista.push({ prodotto: nome, categoria: categoria, unita: unita, peso: peso, prezzo: prezzo, supermercato: supermercato, spuntato: false });

  document.getElementById('input-prodotto').value = '';
  document.getElementById('input-peso').value = '';
  document.getElementById('input-prezzo').value = '';
  document.getElementById('hint-prezzo').textContent = '';

  renderListaSpesa();
  try { await sincronizzaLista(); } catch (err) { mostraToast('Non sincronizzato: ' + err.message); }
}

/* ----------------------------------------------------------------------- *
 *  VISTA: LISTA DELLA SPESA (checklist raggruppata per categoria, per corsia)
 * ----------------------------------------------------------------------- */

/** Restituisce l'ordine delle categorie da usare per il supermercato attualmente selezionato. */
function ordineCategorieAttuale() {
  const supermercato = document.getElementById('input-supermercato').value.trim();
  const personalizzato = stato.ordini && stato.ordini[supermercato];
  const tutteLeCategorie = CATEGORIE.map(function (c) { return c.id; });

  if (personalizzato && personalizzato.length) {
    // usa l'ordine salvato, aggiungendo in fondo eventuali categorie non ancora ordinate (es. nuove)
    const mancanti = tutteLeCategorie.filter(function (id) { return personalizzato.indexOf(id) === -1; });
    return personalizzato.concat(mancanti);
  }
  return tutteLeCategorie;
}

function renderListaSpesa() {
  const contenitore = document.getElementById('lista-categorie');
  contenitore.innerHTML = '';

  ordineCategorieAttuale().forEach(function (catId) {
    const cat = CATEGORIE.find(function (c) { return c.id === catId; }) || { id: catId, icona: '' };
    const items = stato.lista
      .map(function (item, indiceReale) { return { item: item, indiceReale: indiceReale }; })
      .filter(function (x) { return x.item.categoria === cat.id; });

    if (items.length === 0) return;

    const blocco = document.createElement('div');
    blocco.className = 'categoria-blocco';
    blocco.innerHTML = '<div class="categoria-titolo">' + cat.icona + ' ' + cat.id + '</div>';

    items.forEach(function (x) {
      blocco.appendChild(creaRigaProdotto(x.item, x.indiceReale));
    });

    contenitore.appendChild(blocco);
  });

  aggiornaScontrino();
}

/** Crea la riga di un prodotto con supporto swipe: destra = spunta, sinistra = rimuovi dalla lista. */
function creaRigaProdotto(item, indice) {
  const wrapper = document.createElement('div');
  wrapper.className = 'prodotto-riga-wrapper';

  const sfondoDestra = document.createElement('div');
  sfondoDestra.className = 'swipe-azione swipe-destra';
  sfondoDestra.textContent = '\u2713';

  const sfondoSinistra = document.createElement('div');
  sfondoSinistra.className = 'swipe-azione swipe-sinistra';
  sfondoSinistra.textContent = '\u{1F5D1}';

  const riga = document.createElement('div');
  riga.className = 'prodotto-riga' + (item.spuntato ? ' spuntato' : '');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = item.spuntato;
  checkbox.addEventListener('change', function () { toggleSpuntato(indice); });

  const info = document.createElement('div');
  const prezzoKg = calcolaPrezzoKg(item.peso, item.unita, item.prezzo);
  info.innerHTML = '<div class="prodotto-nome">' + item.prodotto + '</div>' +
    '<div class="prodotto-dettaglio">' + item.peso + ' ' + item.unita + ' \u2022 ' + item.supermercato + ' \u2022 \u20AC/kg ' + prezzoKg.toFixed(2) + '</div>';

  const prezzo = document.createElement('div');
  prezzo.className = 'prodotto-prezzo';
  prezzo.textContent = '\u20AC ' + Number(item.prezzo).toFixed(2);

  const elimina = document.createElement('button');
  elimina.className = 'riga-elimina';
  elimina.textContent = '\u2715';
  elimina.title = 'Rimuovi dalla lista';
  elimina.addEventListener('click', function () { eliminaDaLista(indice); });

  riga.appendChild(checkbox);
  riga.appendChild(info);
  riga.appendChild(prezzo);
  riga.appendChild(elimina);

  wrapper.appendChild(sfondoDestra);
  wrapper.appendChild(sfondoSinistra);
  wrapper.appendChild(riga);

  abilitaSwipe(riga, indice);

  return wrapper;
}

/**
 * Abilita lo swipe su una riga prodotto (solo touch, pensato per mobile):
 * swipe verso destra = spunta/rimuovi spunta, swipe verso sinistra = rimuove
 * il prodotto dalla lista corrente (utile sia per eliminarlo per errore, sia
 * per "rimandarlo" semplicemente non comprandolo oggi).
 */
function abilitaSwipe(riga, indice) {
  let startX = 0, startY = 0, deltaX = 0, tracciando = false, orizzontale = null;
  const SOGLIA = 70;

  riga.addEventListener('touchstart', function (e) {
    const t = e.touches[0];
    startX = t.clientX; startY = t.clientY; deltaX = 0; tracciando = true; orizzontale = null;
    riga.style.transition = 'none';
  }, { passive: true });

  riga.addEventListener('touchmove', function (e) {
    if (!tracciando) return;
    const t = e.touches[0];
    const dx = t.clientX - startX;
    const dy = t.clientY - startY;
    if (orizzontale === null) orizzontale = Math.abs(dx) > Math.abs(dy);
    if (!orizzontale) return;
    deltaX = dx;
    riga.style.transform = 'translateX(' + deltaX + 'px)';
  }, { passive: true });

  riga.addEventListener('touchend', function () {
    if (!tracciando) return;
    tracciando = false;
    riga.style.transition = 'transform .2s ease';
    if (orizzontale && deltaX > SOGLIA) {
      riga.style.transform = 'translateX(0)';
      toggleSpuntato(indice);
    } else if (orizzontale && deltaX < -SOGLIA) {
      riga.style.transform = 'translateX(-100%)';
      setTimeout(function () { eliminaDaLista(indice); }, 180);
    } else {
      riga.style.transform = 'translateX(0)';
    }
  });
}

async function toggleSpuntato(indice) {
  stato.lista[indice].spuntato = !stato.lista[indice].spuntato;
  renderListaSpesa();
  try { await sincronizzaLista(); } catch (err) { mostraToast('Non sincronizzato: ' + err.message); }
}

async function eliminaDaLista(indice) {
  stato.lista.splice(indice, 1);
  renderListaSpesa();
  try { await sincronizzaLista(); } catch (err) { mostraToast('Non sincronizzato: ' + err.message); }
}

function aggiornaScontrino() {
  const spuntati = stato.lista.filter(function (i) { return i.spuntato; });
  const totale = spuntati.reduce(function (somma, i) { return somma + Number(i.prezzo); }, 0);
  document.getElementById('totale-carrello').textContent = '\u20AC ' + totale.toFixed(2);
  document.getElementById('conteggio-spuntati').textContent = spuntati.length + ' di ' + stato.lista.length + ' prodotti nel carrello';
}

async function svuotaListaCorrente() {
  if (stato.lista.length === 0) return;
  if (!confirm('Svuotare tutta la lista della spesa corrente?')) return;
  try {
    const json = await chiamaBackend('svuotaLista');
    stato.lista = json.lista;
    renderListaSpesa();
    mostraToast('Lista svuotata');
  } catch (err) {
    mostraToast('Errore: ' + err.message);
  }
}

async function registraSpesaOdierna() {
  const spuntati = stato.lista.filter(function (i) { return i.spuntato; });
  if (spuntati.length === 0) {
    mostraToast('Spunta almeno un prodotto prima di registrare la spesa');
    return;
  }
  if (!confirm('Registrare ' + spuntati.length + ' prodotti nello storico prezzi e svuotare la lista?')) return;

  try {
    const json = await chiamaBackend('registraSpesa', { data: JSON.stringify(spuntati) });
    stato.prodotti = json.prodotti;
    stato.rilevazioni = json.rilevazioni;
    stato.lista = json.lista;
    stato.ordini = json.ordini || stato.ordini;
    renderTutto();
    mostraToast('Spesa registrata nello storico');
  } catch (err) {
    mostraToast('Errore: ' + err.message);
  }
}

/* ----------------------------------------------------------------------- *
 *  ORDINE CORSIE PER SUPERMERCATO
 * ----------------------------------------------------------------------- */

function apriPannelloOrdine() {
  const supermercato = document.getElementById('input-supermercato').value.trim();
  if (!supermercato) { mostraToast('Scrivi prima il nome del supermercato'); return; }

  document.getElementById('ordine-supermercato-nome').textContent = supermercato;

  const salvato = stato.ordini && stato.ordini[supermercato];
  ordineCorrente = (salvato && salvato.length) ? salvato.slice() : CATEGORIE.map(function (c) { return c.id; });
  CATEGORIE.forEach(function (c) { if (ordineCorrente.indexOf(c.id) === -1) ordineCorrente.push(c.id); });

  renderPannelloOrdine();
  document.getElementById('pannello-ordine').classList.remove('nascosto');
}

function renderPannelloOrdine() {
  const cont = document.getElementById('ordine-lista');
  cont.innerHTML = ordineCorrente.map(function (catId, indice) {
    const cat = CATEGORIE.find(function (c) { return c.id === catId; });
    return '<div class="ordine-riga">' +
      '<span>' + (cat ? cat.icona : '') + ' ' + catId + '</span>' +
      '<span class="ordine-frecce">' +
      '<button class="freccia" data-indice="' + indice + '" data-dir="-1"' + (indice === 0 ? ' disabled' : '') + '>\u2191</button>' +
      '<button class="freccia" data-indice="' + indice + '" data-dir="1"' + (indice === ordineCorrente.length - 1 ? ' disabled' : '') + '>\u2193</button>' +
      '</span></div>';
  }).join('');
}

function spostaCategoria(indice, dir) {
  const nuovoIndice = indice + dir;
  if (nuovoIndice < 0 || nuovoIndice >= ordineCorrente.length) return;
  const tmp = ordineCorrente[indice];
  ordineCorrente[indice] = ordineCorrente[nuovoIndice];
  ordineCorrente[nuovoIndice] = tmp;
  renderPannelloOrdine();
}

async function salvaOrdineCorsie() {
  const supermercato = document.getElementById('input-supermercato').value.trim();
  try {
    const json = await chiamaBackend('salvaOrdine', { data: JSON.stringify({ supermercato: supermercato, ordine: ordineCorrente }) });
    stato.ordini = json.ordini;
    renderListaSpesa();
    document.getElementById('pannello-ordine').classList.add('nascosto');
    mostraToast('Ordine corsie salvato per ' + supermercato);
  } catch (err) {
    mostraToast('Errore: ' + err.message);
  }
}

/* ----------------------------------------------------------------------- *
 *  PRODOTTI BASE (riordino rapido)
 * ----------------------------------------------------------------------- */

function apriPannelloBase() {
  const cont = document.getElementById('base-lista');
  const prodottiOrdinati = stato.prodotti.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); });

  cont.innerHTML = prodottiOrdinati.map(function (p) {
    return '<div class="base-riga">' +
      '<button class="stella' + (p.base ? ' attiva' : '') + '" data-nome="' + p.nome + '">' + (p.base ? '\u2605' : '\u2606') + '</button>' +
      '<span>' + p.nome + '</span></div>';
  }).join('') || '<p class="hint">Nessun prodotto ancora registrato: aggiungine uno alla lista prima di impostarlo come base.</p>';

  document.getElementById('pannello-base').classList.remove('nascosto');
}

async function toggleBaseProdotto(nome) {
  try {
    const json = await chiamaBackend('toggleBase', { nome: nome });
    stato.prodotti = json.prodotti;
    apriPannelloBase();
  } catch (err) {
    mostraToast('Errore: ' + err.message);
  }
}

/** Aggiunge alla lista corrente tutti i prodotti segnati come "base", precompilati con l'ultimo prezzo noto. */
async function aggiungiProdottiBase() {
  const base = stato.prodotti.filter(function (p) { return p.base; });
  if (base.length === 0) {
    mostraToast('Nessun prodotto base impostato: usa "Prodotti base" per sceglierli');
    return;
  }

  const supermercatoCorrente = document.getElementById('input-supermercato').value.trim();
  let aggiunti = 0;

  base.forEach(function (p) {
    const giaPresente = stato.lista.some(function (i) { return i.prodotto === p.nome; });
    if (giaPresente) return;

    const ultima = ultimaRilevazione(p.nome);
    stato.lista.push({
      prodotto: p.nome,
      categoria: p.categoria,
      unita: p.unita,
      peso: ultima ? ultima.peso : 0,
      prezzo: ultima ? ultima.prezzo : 0,
      supermercato: supermercatoCorrente || (ultima ? ultima.supermercato : 'Non specificato'),
      spuntato: false
    });
    aggiunti++;
  });

  renderListaSpesa();
  try { await sincronizzaLista(); } catch (err) { mostraToast('Non sincronizzato: ' + err.message); }

  mostraToast(aggiunti > 0
    ? aggiunti + ' prodotti base aggiunti (verifica peso e prezzo al banco)'
    : 'I prodotti base sono gia\' tutti nella lista');
}

/* ----------------------------------------------------------------------- *
 *  VISTA: STORICO PREZZI DI UN PRODOTTO
 * ----------------------------------------------------------------------- */

function popolaSelectProdottiStorico() {
  const nomi = [...new Set(stato.rilevazioni.map(function (r) { return r.prodotto; }))].sort();
  const opzioni = nomi.map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('');
  document.getElementById('storico-select-prodotto').innerHTML = opzioni || '<option value="">Nessuna rilevazione ancora</option>';
  document.getElementById('confronto-select-prodotto').innerHTML = opzioni || '<option value="">Nessuna rilevazione ancora</option>';
}

function renderStorico() {
  const prodotto = document.getElementById('storico-select-prodotto').value;
  const righe = stato.rilevazioni
    .filter(function (r) { return r.prodotto === prodotto; })
    .sort(function (a, b) { return a.data < b.data ? -1 : 1; });

  // Grafico andamento prezzo/kg nel tempo
  const ctx = document.getElementById('chart-storico');
  if (graficoStorico) graficoStorico.destroy();
  graficoStorico = new Chart(ctx, {
    type: 'line',
    data: {
      labels: righe.map(function (r) { return r.data; }),
      datasets: [{
        label: '\u20AC/kg',
        data: righe.map(function (r) { return r.prezzoKg; }),
        borderColor: '#e4b93b',
        backgroundColor: 'rgba(228,185,59,0.15)',
        tension: 0.25,
        fill: true
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  // Tabella cronologica, con possibilita' di eliminare una rilevazione errata
  const tbody = document.querySelector('#tabella-storico tbody');
  tbody.innerHTML = '';
  righe.slice().reverse().forEach(function (r) {
    const tr = document.createElement('tr');
    tr.innerHTML = '<td>' + r.data + '</td><td>' + r.supermercato + '</td><td>' + r.peso + ' ' + r.unita + '</td>' +
      '<td>\u20AC ' + Number(r.prezzo).toFixed(2) + '</td><td>' + Number(r.prezzoKg).toFixed(2) + '</td><td></td>';
    const tdBtn = tr.lastElementChild;
    const btn = document.createElement('button');
    btn.className = 'riga-elimina';
    btn.textContent = '\u2715';
    btn.title = 'Elimina questa rilevazione';
    btn.addEventListener('click', function () { eliminaRilevazione(r.id); });
    tdBtn.appendChild(btn);
    tbody.appendChild(tr);
  });
}

async function eliminaRilevazione(id) {
  if (!confirm('Eliminare questa rilevazione dallo storico?')) return;
  try {
    const json = await chiamaBackend('eliminaRilevazione', { id: id });
    stato.rilevazioni = json.rilevazioni;
    popolaSelectProdottiStorico();
    renderStorico();
    mostraToast('Rilevazione eliminata');
  } catch (err) {
    mostraToast('Errore: ' + err.message);
  }
}

/* ----------------------------------------------------------------------- *
 *  VISTA: CONFRONTO TRA SUPERMERCATI
 * ----------------------------------------------------------------------- */

function renderConfronto() {
  const prodotto = document.getElementById('confronto-select-prodotto').value;
  const righe = stato.rilevazioni.filter(function (r) { return r.prodotto === prodotto; });

  // Per ogni supermercato, tiene solo la rilevazione piu' recente
  const perSupermercato = {};
  righe.forEach(function (r) {
    const attuale = perSupermercato[r.supermercato];
    if (!attuale || r.data > attuale.data) perSupermercato[r.supermercato] = r;
  });

  const elenco = Object.values(perSupermercato).sort(function (a, b) { return a.prezzoKg - b.prezzoKg; });

  const tbody = document.querySelector('#tabella-confronto tbody');
  tbody.innerHTML = elenco.map(function (r) {
    return '<tr><td>' + r.supermercato + '</td><td>\u20AC ' + Number(r.prezzoKg).toFixed(2) + '</td><td>' + r.data + '</td></tr>';
  }).join('') || '<tr><td colspan="3">Nessun dato per questo prodotto</td></tr>';
}

/* ----------------------------------------------------------------------- *
 *  VISTA: STATISTICHE
 * ----------------------------------------------------------------------- */

function renderStatistiche() {
  const oggi = new Date();
  const mesiChiave = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(oggi.getFullYear(), oggi.getMonth() - i, 1);
    mesiChiave.push(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'));
  }

  function chiaveMese(dataStr) { return dataStr.slice(0, 7); }
  const chiaveMeseCorrente = chiaveMese(oggi.toISOString());

  const rilevazioniMeseCorrente = stato.rilevazioni.filter(function (r) { return chiaveMese(r.data) === chiaveMeseCorrente; });
  const totaleMese = rilevazioniMeseCorrente.reduce(function (s, r) { return s + Number(r.prezzo); }, 0);
  document.getElementById('stat-mese-totale').textContent = '\u20AC ' + totaleMese.toFixed(2);

  // Spesa per categoria nel mese corrente
  const perCategoria = {};
  rilevazioniMeseCorrente.forEach(function (r) {
    perCategoria[r.categoria] = (perCategoria[r.categoria] || 0) + Number(r.prezzo);
  });
  const categorieOrdinate = Object.entries(perCategoria).sort(function (a, b) { return b[1] - a[1]; });
  document.getElementById('stat-top-categoria').textContent = categorieOrdinate[0] ? categorieOrdinate[0][0] : '\u2014';

  const ctxCat = document.getElementById('chart-categorie');
  if (graficoCategorie) graficoCategorie.destroy();
  graficoCategorie = new Chart(ctxCat, {
    type: 'doughnut',
    data: {
      labels: categorieOrdinate.map(function (c) { return c[0]; }),
      datasets: [{
        data: categorieOrdinate.map(function (c) { return c[1]; }),
        backgroundColor: ['#e4b93b', '#4c9a6a', '#e2574c', '#7a8fd6', '#c77dd6', '#5bb8b0', '#d69a5b', '#8fa15e', '#c7597a', '#6b8fe2', '#a3a3a3', '#9a7a5b']
      }]
    },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
  });

  // Andamento speso totale negli ultimi 6 mesi
  const totaliMensili = mesiChiave.map(function (chiave) {
    return stato.rilevazioni
      .filter(function (r) { return chiaveMese(r.data) === chiave; })
      .reduce(function (s, r) { return s + Number(r.prezzo); }, 0);
  });

  const ctxMese = document.getElementById('chart-mensile');
  if (graficoMensile) graficoMensile.destroy();
  graficoMensile = new Chart(ctxMese, {
    type: 'bar',
    data: {
      labels: mesiChiave,
      datasets: [{ data: totaliMensili, backgroundColor: '#e4b93b' }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

/* ----------------------------------------------------------------------- *
 *  VARIE
 * ----------------------------------------------------------------------- */

function renderTutto() {
  popolaDatalist();
  renderListaSpesa();
  popolaSelectProdottiStorico();
}

let toastTimer = null;
function mostraToast(messaggio) {
  const toast = document.getElementById('toast');
  toast.textContent = messaggio;
  toast.classList.add('visibile');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { toast.classList.remove('visibile'); }, 3000);
}
