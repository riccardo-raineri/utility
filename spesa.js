/* ============================================================================
   LISTA DELLA SPESA 2.0 - Frontend
   ============================================================================
   IMPORTANTE: dopo aver pubblicato lo script come Web App, incolla qui sotto
   l'URL che Google ti da (finisce con /exec).
   ============================================================================ */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxmtXY1qGdTLYOo-vElncFxXg2FtGxYIhrmOdQQsJpBt44FUSYwILZtIGvRUN0UUD0y/exec';

// Categorie in ordine di visualizzazione, con icona
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
let stato = { prodotti: [], rilevazioni: [], lista: [] };
let graficoStorico = null;
let graficoCategorie = null;
let graficoMensile = null;

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

  document.getElementById('storico-select-prodotto').addEventListener('change', renderStorico);
  document.getElementById('confronto-select-prodotto').addEventListener('change', renderConfronto);
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

  const prezzoKg = calcolaPrezzoKg(peso, unita, prezzo);
  let testo = '\u20AC/kg equivalente: ' + prezzoKg.toFixed(2);

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
 *  VISTA: LISTA DELLA SPESA (checklist raggruppata per categoria)
 * ----------------------------------------------------------------------- */

function renderListaSpesa() {
  const contenitore = document.getElementById('lista-categorie');
  contenitore.innerHTML = '';

  CATEGORIE.forEach(function (cat) {
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

function creaRigaProdotto(item, indice) {
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
  return riga;
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
    renderTutto();
    mostraToast('Spesa registrata nello storico');
  } catch (err) {
    mostraToast('Errore: ' + err.message);
  }
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
