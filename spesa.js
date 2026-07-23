/* ============================================================================
   LISTA DELLA SPESA 2.0 - Frontend
   ============================================================================
   IMPORTANTE: dopo aver pubblicato lo script come Web App, incolla qui sotto
   l'URL che Google ti dà (finisce con /exec).
   ============================================================================ */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxmtXY1qGdTLYOo-vElncFxXg2FtGxYIhrmOdQQsJpBt44FUSYwILZtIGvRUN0UUD0y/exec';

// Categorie in ordine di visualizzazione predefinito, con icona
const CATEGORIE = [
  { id: 'Frutta e Verdura', icona: '🥬' },
  { id: 'Veg', icona: '🌱' },
  { id: 'Pasta', icona: '🍝' },
  { id: 'Latticini', icona: '🧀' },
  { id: 'Carne e Pesce', icona: '🐟' },
  { id: 'Salumi', icona: '🥓' },
  { id: 'Scatolame', icona: '🥫' },
  { id: 'Surgelati', icona: '🧊' },
  { id: 'Condimenti', icona: '🧂' },
  { id: 'Colazione', icona: '🥐' },
  { id: 'Snacks e Patatine', icona: '🍿' },
  { id: 'Bibite', icona: '🥤' },
  { id: 'Vini e Birra', icona: '🍷' },
  { id: 'Chimici', icona: '🧴' },
  { id: 'Altro', icona: '📦' }
];

// Modelli generici di percorso in negozio
const MODELLI_SUPERMERCATO = {
  generico: ['Frutta e Verdura', 'Veg', 'Pasta', 'Latticini', 'Carne e Pesce', 'Salumi', 'Scatolame', 'Surgelati', 'Condimenti', 'Colazione', 'Snacks e Patatine', 'Bibite', 'Vini e Birra', 'Chimici', 'Altro'],
  esselunga: ['Frutta e Verdura', 'Veg', 'Pasta', 'Colazione', 'Latticini', 'Salumi', 'Carne e Pesce', 'Scatolame', 'Condimenti', 'Snacks e Patatine', 'Bibite', 'Vini e Birra', 'Surgelati', 'Chimici', 'Altro'],
  conad: ['Frutta e Verdura', 'Veg', 'Pasta', 'Salumi', 'Latticini', 'Carne e Pesce', 'Colazione', 'Scatolame', 'Condimenti', 'Snacks e Patatine', 'Bibite', 'Surgelati', 'Vini e Birra', 'Chimici', 'Altro'],
  coop: ['Frutta e Verdura', 'Veg', 'Pasta', 'Carne e Pesce', 'Salumi', 'Latticini', 'Colazione', 'Condimenti', 'Scatolame', 'Snacks e Patatine', 'Bibite', 'Surgelati', 'Vini e Birra', 'Chimici', 'Altro'],
  lidl: ['Frutta e Verdura', 'Veg', 'Pasta', 'Colazione', 'Salumi', 'Latticini', 'Carne e Pesce', 'Scatolame', 'Snacks e Patatine', 'Bibite', 'Condimenti', 'Surgelati', 'Vini e Birra', 'Chimici', 'Altro'],
  dm: ['Frutta e Verdura', 'Veg', 'Pasta', 'Colazione', 'Scatolame', 'Latticini', 'Salumi', 'Carne e Pesce', 'Condimenti', 'Snacks e Patatine', 'Bibite', 'Surgelati', 'Vini e Birra', 'Chimici', 'Altro'],
  carrefour: ['Frutta e Verdura', 'Veg', 'Pasta', 'Latticini', 'Salumi', 'Carne e Pesce', 'Colazione', 'Scatolame', 'Condimenti', 'Snacks e Patatine', 'Bibite', 'Vini e Birra', 'Surgelati', 'Chimici', 'Altro']
};

let stato = { prodotti: [], rilevazioni: [], lista: [], ordini: {} };
let graficoStorico = null;
let graficoCategorie = null;
let graficoMensile = null;
let ordineCorrente = [];      
let indiceInModifica = null;  
let filtroRicerca = '';       

/* ----------------------------------------------------------------------- *
 *  COMUNICAZIONE COL BACKEND & LOADER VISIVO
 * ----------------------------------------------------------------------- */

function mostraCaricamento(attiva) {
  const overlay = document.getElementById('loading-overlay');
  if (attiva) {
    overlay.classList.remove('nascosto');
  } else {
    overlay.classList.add('nascosto');
  }
}

async function chiamaBackend(action, extraParams) {
  mostraCaricamento(true);
  try {
    const params = new URLSearchParams(Object.assign({ action: action }, extraParams || {}));
    const res = await fetch(WEBAPP_URL + '?' + params.toString());
    const json = await res.json();
    if (!json.ok) throw new Error(json.errore || 'Errore sconosciuto dal backend');
    return json;
  } finally {
    mostraCaricamento(false);
  }
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
  document.getElementById('btn-annulla-modifica').addEventListener('click', annullaModifica);
  document.getElementById('btn-registra').addEventListener('click', registraSpesaOdierna);
  document.getElementById('btn-svuota').addEventListener('click', svuotaListaCorrente);

  document.getElementById('input-prodotto').addEventListener('input', aggiornaAnteprimaProdotto);
  document.getElementById('input-peso').addEventListener('input', aggiornaAnteprimaProdotto);
  document.getElementById('input-prezzo').addEventListener('input', aggiornaAnteprimaProdotto);
  document.getElementById('input-prezzo-offerta').addEventListener('input', aggiornaAnteprimaProdotto);
  document.getElementById('input-unita').addEventListener('change', aggiornaAnteprimaProdotto);

  document.getElementById('input-supermercato').addEventListener('change', function () {
    const inputNuovo = document.getElementById('input-supermercato-nuovo');
    if (this.value === '__nuovo__') {
      inputNuovo.classList.remove('nascosto');
      inputNuovo.value = '';
      inputNuovo.focus();
    } else {
      inputNuovo.classList.add('nascosto');
      renderListaSpesa();
    }
  });
  document.getElementById('input-supermercato-nuovo').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') confermaNuovoSupermercato();
  });
  document.getElementById('input-supermercato-nuovo').addEventListener('blur', confermaNuovoSupermercato);

  document.getElementById('ricerca-prodotto').addEventListener('input', function () {
    filtroRicerca = this.value.trim().toLowerCase();
    renderListaSpesa();
  });

  document.getElementById('storico-select-prodotto').addEventListener('change', renderStorico);
  document.getElementById('confronto-select-prodotto').addEventListener('change', renderConfronto);

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
  document.getElementById('ordine-modello').addEventListener('change', function () {
    const modello = MODELLI_SUPERMERCATO[this.value] || MODELLI_SUPERMERCATO.generico;
    ordineCorrente = modello.slice();
    renderPannelloOrdine();
  });

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
 *  TEMA CHIARO / SCURO
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
 *  SELETTORE SUPERMERCATO
 * ----------------------------------------------------------------------- */

function popolaSelectSupermercato() {
  const select = document.getElementById('input-supermercato');
  const valorePrecedente = select.value;

  const daRilevazioni = stato.rilevazioni.map(function (r) { return r.supermercato; });
  const daOrdini = Object.keys(stato.ordini || {});
  const daLista = stato.lista.map(function (i) { return i.supermercato; });
  const elenco = [...new Set([...daRilevazioni, ...daOrdini, ...daLista].filter(Boolean))].sort();

  select.innerHTML = elenco.map(function (s) {
    return '<option value="' + s + '">' + s + '</option>';
  }).join('') + '<option value="__nuovo__">+ Nuovo supermercato...</option>';

  if (valorePrecedente && elenco.indexOf(valorePrecedente) !== -1) {
    select.value = valorePrecedente;
  } else if (elenco.length > 0) {
    select.value = elenco[0];
  } else {
    select.value = '__nuovo__';
  }
}

function supermercatoSelezionato() {
  const select = document.getElementById('input-supermercato');
  return select.value === '__nuovo__' ? '' : select.value;
}

function confermaNuovoSupermercato() {
  const inputNuovo = document.getElementById('input-supermercato-nuovo');
  const nome = inputNuovo.value.trim();
  if (!nome) { inputNuovo.classList.add('nascosto'); return; }

  const select = document.getElementById('input-supermercato');
  const giaPresente = [...select.options].some(function (o) { return o.value === nome; });
  if (!giaPresente) {
    const opzione = document.createElement('option');
    opzione.value = nome;
    opzione.textContent = nome;
    select.insertBefore(opzione, select.querySelector('option[value="__nuovo__"]'));
  }
  select.value = nome;
  inputNuovo.classList.add('nascosto');
  renderListaSpesa();
}

/* ----------------------------------------------------------------------- *
 *  VISTA: FORM AGGIUNTA / MODIFICA PRODOTTO
 * ----------------------------------------------------------------------- */

function popolaSelectCategorie() {
  const select = document.getElementById('input-categoria');
  select.innerHTML = CATEGORIE.map(function (c) {
    return '<option value="' + c.id + '">' + c.icona + ' ' + c.id + '</option>';
  }).join('');
}

function popolaDatalistProdotti() {
  document.getElementById('prodotti-list').innerHTML = stato.prodotti.map(function (p) {
    return '<option value="' + p.nome + '">';
  }).join('');

  const marche = [...new Set(stato.prodotti.map(function (p) { return p.marca; }).filter(Boolean))].sort();
  document.getElementById('marche-list').innerHTML = marche.map(function (m) {
    return '<option value="' + m + '">';
  }).join('');
}

function ultimaRilevazione(nomeProdotto) {
  const storicoProdotto = stato.rilevazioni
    .filter(function (r) { return r.prodotto === nomeProdotto; })
    .sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  return storicoProdotto[0] || null;
}

function aggiornaAnteprimaProdotto() {
  const nome = document.getElementById('input-prodotto').value.trim();
  const hint = document.getElementById('hint-prezzo');

  const noto = stato.prodotti.find(function (p) { return p.nome === nome; });
  if (noto) {
    document.getElementById('input-categoria').value = noto.categoria;
    document.getElementById('input-unita').value = noto.unita;
    if (noto.marca && !document.getElementById('input-marca').value) {
      document.getElementById('input-marca').value = noto.marca;
    }
  }

  const peso = parseFloat(document.getElementById('input-peso').value);
  const prezzo = parseFloat(document.getElementById('input-prezzo').value);
  const prezzoOfferta = parseFloat(document.getElementById('input-prezzo-offerta').value);
  const unita = document.getElementById('input-unita').value;

  const prezzoAttivo = !isNaN(prezzoOfferta) ? prezzoOfferta : prezzo;

  if (!peso || isNaN(prezzoAttivo)) { hint.textContent = ''; hint.className = 'hint'; return; }

  const prezzoKg = calcolaPrezzoKg(peso, unita, prezzoAttivo);
  let testo = '€/kg: ' + prezzoKg.toFixed(2);

  const ultima = ultimaRilevazione(nome);
  hint.className = 'hint';
  if (ultima && ultima.prezzoKg) {
    const diff = ((prezzoKg - ultima.prezzoKg) / ultima.prezzoKg) * 100;
    if (Math.abs(diff) >= 1) {
      testo += '  •  ' + (diff > 0 ? '+' : '') + diff.toFixed(0) + '% rispetto a ' + ultima.data;
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
  const marca = document.getElementById('input-marca').value.trim();
  const categoria = document.getElementById('input-categoria').value;
  const unita = document.getElementById('input-unita').value;
  const peso = parseFloat(document.getElementById('input-peso').value);
  const prezzo = parseFloat(document.getElementById('input-prezzo').value);
  const prezzoOfferta = parseFloat(document.getElementById('input-prezzo-offerta').value);
  const supermercato = supermercatoSelezionato() || 'Non specificato';

  const hasOfferta = !isNaN(prezzoOfferta) && prezzoOfferta > 0;
  const prezzoRilevante = hasOfferta ? prezzoOfferta : prezzo;

  if (!nome || !peso || isNaN(prezzoRilevante)) {
    mostraToast('Inserisci almeno prodotto, peso e un prezzo valido');
    return;
  }

  const nuovoItem = { 
    prodotto: nome, 
    marca: marca, 
    categoria: categoria, 
    unita: unita, 
    peso: peso, 
    prezzo: prezzoRilevante, 
    prezzoOriginale: hasOfferta ? prezzo : null,
    inOfferta: hasOfferta,
    supermercato: supermercato, 
    spuntato: false 
  };

  if (indiceInModifica !== null) {
    nuovoItem.spuntato = stato.lista[indiceInModifica].spuntato;
    stato.lista[indiceInModifica] = nuovoItem;
    annullaModifica();
    mostraToast('Prodotto aggiornato');
  } else {
    stato.lista.push(nuovoItem);
    document.getElementById('input-prodotto').value = '';
    document.getElementById('input-marca').value = '';
    document.getElementById('input-peso').value = '';
    document.getElementById('input-prezzo').value = '';
    document.getElementById('input-prezzo-offerta').value = '';
    document.getElementById('hint-prezzo').textContent = '';
  }

  renderListaSpesa();
  try { await sincronizzaLista(); } catch (err) { mostraToast('Non sincronizzato: ' + err.message); }
}

function modificaProdottoInLista(indice) {
  const item = stato.lista[indice];

  document.getElementById('input-prodotto').value = item.prodotto;
  document.getElementById('input-marca').value = item.marca || '';
  document.getElementById('input-categoria').value = item.categoria;
  document.getElementById('input-peso').value = item.peso;
  document.getElementById('input-unita').value = item.unita;

  if (item.inOfferta) {
    document.getElementById('input-prezzo').value = item.prezzoOriginale || '';
    document.getElementById('input-prezzo-offerta').value = item.prezzo;
  } else {
    document.getElementById('input-prezzo').value = item.prezzo;
    document.getElementById('input-prezzo-offerta').value = '';
  }

  const selectSuper = document.getElementById('input-supermercato');
  if ([...selectSuper.options].some(function (o) { return o.value === item.supermercato; })) {
    selectSuper.value = item.supermercato;
  }

  indiceInModifica = indice;
  document.getElementById('btn-aggiungi').textContent = '✓ Salva modifiche';
  document.getElementById('btn-annulla-modifica').classList.remove('nascosto');

  aggiornaAnteprimaProdotto();
  document.getElementById('input-prodotto').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function annullaModifica() {
  indiceInModifica = null;
  document.getElementById('btn-aggiungi').textContent = '+ Aggiungi alla lista';
  document.getElementById('btn-annulla-modifica').classList.add('nascosto');
  document.getElementById('input-prodotto').value = '';
  document.getElementById('input-marca').value = '';
  document.getElementById('input-peso').value = '';
  document.getElementById('input-prezzo').value = '';
  document.getElementById('input-prezzo-offerta').value = '';
  document.getElementById('hint-prezzo').textContent = '';
}

/* ----------------------------------------------------------------------- *
 *  VISTA: LISTA DELLA SPESA
 * ----------------------------------------------------------------------- */

function ordineCategorieAttuale() {
  const supermercato = supermercatoSelezionato();
  const personalizzato = stato.ordini && stato.ordini[supermercato];
  const tutteLeCategorie = CATEGORIE.map(function (c) { return c.id; });

  if (personalizzato && personalizzato.length) {
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
      .filter(function (x) { return x.item.categoria === cat.id; })
      .filter(function (x) { return !filtroRicerca || x.item.prodotto.toLowerCase().indexOf(filtroRicerca) !== -1 || (x.item.marca || '').toLowerCase().indexOf(filtroRicerca) !== -1; });

    if (items.length === 0) return;

    const blocco = document.createElement('div');
    blocco.className = 'categoria-blocco';
    blocco.innerHTML = '<div class="categoria-titolo">' + cat.icona + ' ' + cat.id + '</div>';

    items.forEach(function (x) {
      blocco.appendChild(creaRigaProdotto(x.item, x.indiceReale));
    });

    contenitore.appendChild(blocco);
  });

  if (filtroRicerca && contenitore.innerHTML === '') {
    contenitore.innerHTML = '<p class="hint">Nessun prodotto trovato per "' + filtroRicerca + '"</p>';
  }

  aggiornaScontrino();
}

function creaRigaProdotto(item, indice) {
  const wrapper = document.createElement('div');
  wrapper.className = 'prodotto-riga-wrapper';

  const sfondoDestra = document.createElement('div');
  sfondoDestra.className = 'swipe-azione swipe-destra';
  sfondoDestra.textContent = '✓';

  const sfondoSinistra = document.createElement('div');
  sfondoSinistra.className = 'swipe-azione swipe-sinistra';
  sfondoSinistra.textContent = '🗑';

  const riga = document.createElement('div');
  riga.className = 'prodotto-riga' + (item.spuntato ? ' spuntato' : '');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = item.spuntato;
  checkbox.addEventListener('change', function () { toggleSpuntato(indice); });

  const info = document.createElement('div');
  const prezzoKg = calcolaPrezzoKg(item.peso, item.unita, item.prezzo);
  const dettagli = [];
  if (item.marca) dettagli.push(item.marca);
  dettagli.push(item.peso + ' ' + item.unita);
  dettagli.push(item.supermercato);
  dettagli.push('€/kg ' + prezzoKg.toFixed(2));
  info.innerHTML = '<div class="prodotto-nome">' + item.prodotto + '</div>' +
    '<div class="prodotto-dettaglio">' + dettagli.join(' • ') + '</div>';

  const prezzo = document.createElement('div');
  prezzo.className = 'prodotto-prezzo';
  if (item.inOfferta && item.prezzoOriginale) {
    prezzo.innerHTML = '<span class="prezzo-originale">€ ' + Number(item.prezzoOriginale).toFixed(2) + '</span> ' +
                       '<span class="prezzo-offerta">€ ' + Number(item.prezzo).toFixed(2) + '</span>';
  } else {
    prezzo.textContent = '€ ' + Number(item.prezzo).toFixed(2);
  }

  const modifica = document.createElement('button');
  modifica.className = 'riga-modifica';
  modifica.textContent = '✏';
  modifica.title = 'Modifica prodotto';
  modifica.addEventListener('click', function () { modificaProdottoInLista(indice); });

  const elimina = document.createElement('button');
  elimina.className = 'riga-elimina';
  elimina.textContent = '✕';
  elimina.title = 'Rimuovi dalla lista';
  elimina.addEventListener('click', function () { eliminaDaLista(indice); });

  riga.appendChild(checkbox);
  riga.appendChild(info);
  riga.appendChild(prezzo);
  riga.appendChild(modifica);
  riga.appendChild(elimina);

  wrapper.appendChild(sfondoDestra);
  wrapper.appendChild(sfondoSinistra);
  wrapper.appendChild(riga);

  abilitaSwipe(riga, indice);

  return wrapper;
}

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
  if (indiceInModifica === indice) annullaModifica();
  stato.lista.splice(indice, 1);
  renderListaSpesa();
  try { await sincronizzaLista(); } catch (err) { mostraToast('Non sincronizzato: ' + err.message); }
}

function aggiornaScontrino() {
  const spuntati = stato.lista.filter(function (i) { return i.spuntato; });
  const totale = spuntati.reduce(function (somma, i) { return somma + Number(i.prezzo); }, 0);
  document.getElementById('totale-carrello').textContent = '€ ' + totale.toFixed(2);
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
  const supermercato = supermercatoSelezionato();
  if (!supermercato) { mostraToast('Seleziona prima un supermercato'); return; }

  document.getElementById('ordine-supermercato-nome').textContent = supermercato;
  document.getElementById('ordine-modello').value = 'generico';

  const salvato = stato.ordini && stato.ordini[supermercato];
  ordineCorrente = (salvato && salvato.length) ? salvato.slice() : MODELLI_SUPERMERCATO.generico.slice();
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
      '<button class="freccia" data-indice="' + indice + '" data-dir="-1"' + (indice === 0 ? ' disabled' : '') + '>↑</button>' +
      '<button class="freccia" data-indice="' + indice + '" data-dir="1"' + (indice === ordineCorrente.length - 1 ? ' disabled' : '') + '>↓</button>' +
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
  const supermercato = supermercatoSelezionato();
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
 *  PRODOTTI BASE
 * ----------------------------------------------------------------------- */

function apriPannelloBase() {
  const cont = document.getElementById('base-lista');
  const prodottiOrdinati = stato.prodotti.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); });

  cont.innerHTML = prodottiOrdinati.map(function (p) {
    return '<div class="base-riga">' +
      '<button class="stella' + (p.base ? ' attiva' : '') + '" data-nome="' + p.nome + '">' + (p.base ? '★' : '☆') + '</button>' +
      '<span>' + p.nome + '</span></div>';
  }).join('') || '<p class="hint">Nessun prodotto ancora registrato.</p>';

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

async function aggiungiProdottiBase() {
  const base = stato.prodotti.filter(function (p) { return p.base; });
  if (base.length === 0) {
    mostraToast('Nessun prodotto base impostato');
    return;
  }

  const supermercatoCorrente = supermercatoSelezionato();
  let aggiunti = 0;

  base.forEach(function (p) {
    const giaPresente = stato.lista.some(function (i) { return i.prodotto === p.nome; });
    if (giaPresente) return;

    const ultima = ultimaRilevazione(p.nome);
    stato.lista.push({
      prodotto: p.nome,
      marca: ultima ? (ultima.marca || '') : (p.marca || ''),
      categoria: p.categoria,
      unita: p.unita,
      peso: ultima ? ultima.peso : 0,
      prezzo: ultima ? ultima.prezzo : 0,
      prezzoOriginale: ultima ? ultima.prezzoOriginale : null,
      inOfferta: ultima ? ultima.inOfferta : false,
      supermercato: supermercatoCorrente || (ultima ? ultima.supermercato : 'Non specificato'),
      spuntato: false
    });
    aggiunti++;
  });

  renderListaSpesa();
  try { await sincronizzaLista(); } catch (err) { mostraToast('Non sincronizzato: ' + err.message); }

  mostraToast(aggiunti > 0 ? aggiunti + ' prodotti base aggiunti' : 'I prodotti base sono già tutti nella lista');
}

/* ----------------------------------------------------------------------- *
 *  VISTA: STORICO PREZZI
 * ----------------------------------------------------------------------- */

function popolaSelectProdottiStorico() {
  const nomi = [...new Set(stato.rilevazioni.map(function (r) { return r.prodotto; }))].sort();
  const opzioni = nomi.map(function (n) { return '<option value="' + n + '">' + n + '</option>'; }).join('');
  document.getElementById('storico-select-prodotto').innerHTML = opzioni || '<option value="">Nessuna rilevazione</option>';
  document.getElementById('confronto-select-prodotto').innerHTML = opzioni || '<option value="">Nessuna rilevazione</option>';
}

function renderStorico() {
  const prodotto = document.getElementById('storico-select-prodotto').value;
  const righe = stato.rilevazioni
    .filter(function (r) { return r.prodotto === prodotto; })
    .sort(function (a, b) { return a.data < b.data ? -1 : 1; });

  const ctx = document.getElementById('chart-storico');
  if (graficoStorico) graficoStorico.destroy();
  graficoStorico = new Chart(ctx, {
    type: 'line',
    data: {
      labels: righe.map(function (r) { return r.data; }),
      datasets: [{
        label: '€/kg',
        data: righe.map(function (r) { return r.prezzoKg; }),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245,158,11,0.15)',
        tension: 0.25,
        fill: true,
        pointBackgroundColor: '#ea580c'
      }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });

  const tbody = document.querySelector('#tabella-storico tbody');
  tbody.innerHTML = '';
  righe.slice().reverse().forEach(function (r) {
    const tr = document.createElement('tr');
    
    let prezzoHtml = '€ ' + Number(r.prezzo).toFixed(2);
    if (r.inOfferta && r.prezzoOriginale) {
      prezzoHtml = '<span class="prezzo-originale">€ ' + Number(r.prezzoOriginale).toFixed(2) + '</span> ' +
                   '<span class="prezzo-offerta">€ ' + Number(r.prezzo).toFixed(2) + '</span>';
    }

    tr.innerHTML = '<td>' + r.data + '</td><td>' + (r.marca || '—') + '</td><td>' + r.supermercato + '</td><td>' + r.peso + ' ' + r.unita + '</td>' +
      '<td>' + prezzoHtml + '</td><td>' + Number(r.prezzoKg).toFixed(2) + '</td><td></td>';
    const tdBtn = tr.lastElementChild;
    const btn = document.createElement('button');
    btn.className = 'riga-elimina';
    btn.textContent = '✕';
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
 *  VISTA: CONFRONTO SUPERMERCATI
 * ----------------------------------------------------------------------- */

function renderConfronto() {
  const prodotto = document.getElementById('confronto-select-prodotto').value;
  const righe = stato.rilevazioni.filter(function (r) { return r.prodotto === prodotto; });

  const perSupermercato = {};
  righe.forEach(function (r) {
    const attuale = perSupermercato[r.supermercato];
    if (!attuale || r.data > attuale.data) perSupermercato[r.supermercato] = r;
  });

  const elenco = Object.values(perSupermercato).sort(function (a, b) { return a.prezzoKg - b.prezzoKg; });

  const tbody = document.querySelector('#tabella-confronto tbody');
  tbody.innerHTML = elenco.map(function (r) {
    return '<tr><td>' + r.supermercato + '</td><td>' + (r.marca || '—') + '</td><td>€ ' + Number(r.prezzoKg).toFixed(2) + '</td><td>' + r.data + '</td></tr>';
  }).join('') || '<tr><td colspan="4">Nessun dato per questo prodotto</td></tr>';
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
  document.getElementById('stat-mese-totale').textContent = '€ ' + totaleMese.toFixed(2);

  const perCategoria = {};
  rilevazioniMeseCorrente.forEach(function (r) {
    perCategoria[r.categoria] = (perCategoria[r.categoria] || 0) + Number(r.prezzo);
  });
  const categorieOrdinate = Object.entries(perCategoria).sort(function (a, b) { return b[1] - a[1]; });
  document.getElementById('stat-top-categoria').textContent = categorieOrdinate[0] ? categorieOrdinate[0][0] : '—';

  const ctxCat = document.getElementById('chart-categorie');
  if (graficoCategorie) graficoCategorie.destroy();
  graficoCategorie = new Chart(ctxCat, {
    type: 'doughnut',
    data: {
      labels: categorieOrdinate.map(function (c) { return c[0]; }),
      datasets: [{
        data: categorieOrdinate.map(function (c) { return c[1]; }),
        backgroundColor: ['#f59e0b', '#ea580c', '#10b981', '#6366f1', '#ec4899', '#14b8a6', '#f97316', '#84cc16', '#06b6d4', '#8b5cf6', '#64748b', '#d97706']
      }]
    },
    options: { plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
  });

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
      datasets: [{ data: totaliMensili, backgroundColor: '#f59e0b', borderRadius: 6 }]
    },
    options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } }
  });
}

/* ----------------------------------------------------------------------- *
 *  VARIE
 * ----------------------------------------------------------------------- */

function renderTutto() {
  popolaSelectSupermercato();
  popolaDatalistProdotti();
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