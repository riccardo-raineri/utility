/* ============================================================================
   LISTA DELLA SPESA 2.0 - Stile Scontrino (Frontend)
   ============================================================================ */
const WEBAPP_URL = 'https://script.google.com/macros/s/AKfycbxmtXY1qGdTLYOo-vElncFxXg2FtGxYIhrmOdQQsJpBt44FUSYwILZtIGvRUN0UUD0y/exec';

const CATEGORIE = [
  { id: 'Frutta e Verdura', icona: '🥬' }, { id: 'Veg', icona: '🌱' }, { id: 'Pasta', icona: '🍝' },
  { id: 'Latticini', icona: '🧀' }, { id: 'Carne e Pesce', icona: '🐟' }, { id: 'Salumi', icona: '🥓' },
  { id: 'Scatolame', icona: '🥫' }, { id: 'Surgelati', icona: '🧊' }, { id: 'Condimenti', icona: '🧂' },
  { id: 'Colazione', icona: '🥐' }, { id: 'Snacks e Patatine', icona: '🍿' }, { id: 'Bibite', icona: '🥤' },
  { id: 'Vini e Birra', icona: '🍷' }, { id: 'Chimici', icona: '🧴' }, { id: 'Altro', icona: '📦' }
];

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
let ordineCorrente = [];      
let indiceInModifica = null;  
let filtroRicerca = '';       

/* ----------------------------------------------------------------------- *
 *  COMUNICAZIONE COL BACKEND & LOADER
 * ----------------------------------------------------------------------- */
function mostraCaricamento(attiva) {
  const overlay = document.getElementById('loading-overlay');
  if (attiva) overlay.classList.remove('nascosto');
  else overlay.classList.add('nascosto');
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
 *  AVVIO E COLLEGAMENTO EVENTI
 * ----------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', function () {
  inizializzaTema();
  popolaSelectCategorie();
  collegaEventi();
  caricaDati();
  
  // Imposta data e ora nello scontrino
  const elData = document.getElementById('data-scontrino');
  if (elData) {
    const oggi = new Date();
    elData.textContent = oggi.toLocaleDateString('it-IT') + ' - ' + oggi.toLocaleTimeString('it-IT', {hour: '2-digit', minute:'2-digit'});
  }
});

function collegaEventi() {
  document.getElementById('theme-toggle').addEventListener('click', cambiaTema);
  document.getElementById('btn-aggiungi').addEventListener('click', aggiungiProdottoALista);
  document.getElementById('btn-annulla-modifica').addEventListener('click', annullaModifica);

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

/* ----------------------------------------------------------------------- *
 *  TEMA
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
 *  SELECT E DATALIST
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
    .filter(function (r) { return r.prodotto.toLowerCase() === nomeProdotto.toLowerCase(); })
    .sort(function (a, b) { return a.data < b.data ? 1 : -1; });
  return storicoProdotto[0] || null;
}

/* ----------------------------------------------------------------------- *
 *  PREZZI RAPIDI & FORM
 * ----------------------------------------------------------------------- */
function aggiornaAnteprimaProdotto() {
  const nome = document.getElementById('input-prodotto').value.trim();
  const hint = document.getElementById('hint-prezzo');

  const noto = stato.prodotti.find(function (p) { return p.nome.toLowerCase() === nome.toLowerCase(); });
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

  mostraPrezziNoti(nome);

  if (!peso || isNaN(prezzoAttivo)) { hint.textContent = ''; hint.className = 'hint'; return; }
  
  const prezzoKg = calcolaPrezzoKg(peso, unita, prezzoAttivo);
  hint.className = 'hint';
  hint.textContent = '€/kg: ' + prezzoKg.toFixed(2);
}

function mostraPrezziNoti(nome) {
  const container = document.getElementById('prezzi-noti-container');
  if (!nome || nome.length < 2) { container.classList.add('nascosto'); return; }

  const rilevazioni = stato.rilevazioni.filter(r => r.prodotto.toLowerCase() === nome.toLowerCase());
  if (rilevazioni.length === 0) {
    container.classList.add('nascosto'); return;
  }

  const perSupermercato = {};
  rilevazioni.forEach(r => {
    if (!perSupermercato[r.supermercato] || r.data > perSupermercato[r.supermercato].data) {
      perSupermercato[r.supermercato] = r;
    }
  });

  const htmlChips = Object.values(perSupermercato).map(r => {
    const pOrig = r.prezzoOriginale ? Number(r.prezzoOriginale) : null;
    return `<div class="chip-prezzo" onclick="applicaPrezzoNoto('${r.supermercato}', ${r.prezzo}, ${pOrig}, ${r.inOfferta})">
              <span class="supermercato">${r.supermercato}</span>
              <span class="prezzo">${r.inOfferta ? '🎯 ' : ''}€ ${Number(r.prezzo).toFixed(2)}</span>
            </div>`;
  }).join('');

  container.innerHTML = `<div class="titolo-prezzi">🛒 Prezzi noti (clicca per applicare):</div>
                         <div class="chips-wrapper">${htmlChips}</div>`;
  container.classList.remove('nascosto');
}

window.applicaPrezzoNoto = function(supermercato, prezzo, prezzoOriginale, inOfferta) {
  if (navigator.vibrate) navigator.vibrate(40);
  
  document.getElementById('input-supermercato').value = supermercato;
  if (inOfferta && prezzoOriginale) {
    document.getElementById('input-prezzo').value = prezzoOriginale;
    document.getElementById('input-prezzo-offerta').value = prezzo;
  } else {
    document.getElementById('input-prezzo').value = prezzo;
    document.getElementById('input-prezzo-offerta').value = '';
  }
  aggiornaAnteprimaProdotto();
};

function calcolaPrezzoKg(peso, unita, prezzo) {
  let pesoKg = peso;
  if (unita === 'g' || unita === 'ml') pesoKg = peso / 1000;
  return pesoKg > 0 ? prezzo / pesoKg : prezzo;
}

async function aggiungiProdottoALista() {
  const nomeRaw = document.getElementById('input-prodotto').value.trim();
  const nome = nomeRaw ? nomeRaw.charAt(0).toUpperCase() + nomeRaw.slice(1) : '';
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
    prodotto: nome, marca: marca, categoria: categoria, unita: unita, peso: peso, 
    prezzo: prezzoRilevante, prezzoOriginale: hasOfferta ? prezzo : null,
    inOfferta: hasOfferta, supermercato: supermercato, spuntato: false 
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
    document.getElementById('prezzi-noti-container').classList.add('nascosto');
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
  document.getElementById('prezzi-noti-container').classList.add('nascosto');
}

/* ----------------------------------------------------------------------- *
 *  LISTA SPESA & SWIPE
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

    items.forEach(function (x) { blocco.appendChild(creaRigaProdotto(x.item, x.indiceReale)); });
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

  const sfondoDestra = document.createElement('div'); sfondoDestra.className = 'swipe-azione swipe-destra'; sfondoDestra.textContent = '✓';
  const sfondoSinistra = document.createElement('div'); sfondoSinistra.className = 'swipe-azione swipe-sinistra'; sfondoSinistra.textContent = '🗑';

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
  modifica.className = 'riga-modifica'; modifica.textContent = '✏'; modifica.title = 'Modifica prodotto';
  modifica.addEventListener('click', function () { modificaProdottoInLista(indice); });

  const elimina = document.createElement('button');
  elimina.className = 'riga-elimina'; elimina.textContent = '✕'; elimina.title = 'Rimuovi dalla lista';
  elimina.addEventListener('click', function () { eliminaDaLista(indice); });

  riga.appendChild(checkbox); riga.appendChild(info); riga.appendChild(prezzo); riga.appendChild(modifica); riga.appendChild(elimina);
  wrapper.appendChild(sfondoDestra); wrapper.appendChild(sfondoSinistra); wrapper.appendChild(riga);

  abilitaSwipe(riga, indice);
  return wrapper;
}

function abilitaSwipe(riga, indice) {
  let startX = 0, startY = 0, deltaX = 0, tracciando = false, orizzontale = null;
  const SOGLIA = 70;

  riga.addEventListener('touchstart', function (e) {
    const t = e.touches[0]; startX = t.clientX; startY = t.clientY; deltaX = 0; tracciando = true; orizzontale = null;
    riga.style.transition = 'none';
  }, { passive: true });

  riga.addEventListener('touchmove', function (e) {
    if (!tracciando) return;
    const dx = e.touches[0].clientX - startX; const dy = e.touches[0].clientY - startY;
    if (orizzontale === null) orizzontale = Math.abs(dx) > Math.abs(dy);
    if (!orizzontale) return;
    deltaX = dx; riga.style.transform = 'translateX(' + deltaX + 'px)';
  }, { passive: true });

  riga.addEventListener('touchend', function () {
    if (!tracciando) return;
    tracciando = false; riga.style.transition = 'transform .2s ease';
    if (orizzontale && deltaX > SOGLIA) {
      if (navigator.vibrate) navigator.vibrate([40]);
      riga.style.transform = 'translateX(0)';
      toggleSpuntato(indice);
    } else if (orizzontale && deltaX < -SOGLIA) {
      if (navigator.vibrate) navigator.vibrate([40]);
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
  
  const elTotale = document.getElementById('totale-carrello');
  if (elTotale) elTotale.textContent = '€ ' + totale.toFixed(2);
}

/* ----------------------------------------------------------------------- *
 *  ORDINE CORSIE
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
    return '<div class="ordine-riga">' + '<span>' + (cat ? cat.icona : '') + ' ' + catId + '</span>' +
      '<span class="ordine-frecce">' +
      '<button class="freccia" data-indice="' + indice + '" data-dir="-1"' + (indice === 0 ? ' disabled' : '') + '>↑</button>' +
      '<button class="freccia" data-indice="' + indice + '" data-dir="1"' + (indice === ordineCorrente.length - 1 ? ' disabled' : '') + '>↓</button>' +
      '</span></div>';
  }).join('');
}

function spostaCategoria(indice, dir) {
  const nuovoIndice = indice + dir;
  if (nuovoIndice < 0 || nuovoIndice >= ordineCorrente.length) return;
  const tmp = ordineCorrente[indice]; ordineCorrente[indice] = ordineCorrente[nuovoIndice]; ordineCorrente[nuovoIndice] = tmp;
  renderPannelloOrdine();
}

async function salvaOrdineCorsie() {
  const supermercato = supermercatoSelezionato();
  try {
    const json = await chiamaBackend('salvaOrdine', { data: JSON.stringify({ supermercato: supermercato, ordine: ordineCorrente }) });
    stato.ordini = json.ordini; renderListaSpesa();
    document.getElementById('pannello-ordine').classList.add('nascosto');
    mostraToast('Ordine corsie salvato per ' + supermercato);
  } catch (err) { mostraToast('Errore: ' + err.message); }
}

/* ----------------------------------------------------------------------- *
 *  PRODOTTI BASE
 * ----------------------------------------------------------------------- */
function apriPannelloBase() {
  const cont = document.getElementById('base-lista');
  const prodottiOrdinati = stato.prodotti.slice().sort(function (a, b) { return a.nome.localeCompare(b.nome); });
  cont.innerHTML = prodottiOrdinati.map(function (p) {
    return '<div class="base-riga"><button class="stella' + (p.base ? ' attiva' : '') + '" data-nome="' + p.nome + '">' + (p.base ? '★' : '☆') + '</button><span>' + p.nome + '</span></div>';
  }).join('') || '<p class="hint">Nessun prodotto ancora registrato.</p>';
  document.getElementById('pannello-base').classList.remove('nascosto');
}

async function toggleBaseProdotto(nome) {
  try {
    const json = await chiamaBackend('toggleBase', { nome: nome });
    stato.prodotti = json.prodotti; apriPannelloBase();
  } catch (err) { mostraToast('Errore: ' + err.message); }
}

async function aggiungiProdottiBase() {
  const base = stato.prodotti.filter(function (p) { return p.base; });
  if (base.length === 0) { mostraToast('Nessun prodotto base impostato'); return; }

  const supermercatoCorrente = supermercatoSelezionato();
  let aggiunti = 0;

  base.forEach(function (p) {
    if (stato.lista.some(function (i) { return i.prodotto === p.nome; })) return;
    const ultima = ultimaRilevazione(p.nome);
    stato.lista.push({
      prodotto: p.nome, marca: ultima ? (ultima.marca || '') : (p.marca || ''), categoria: p.categoria, unita: p.unita,
      peso: ultima ? ultima.peso : 0, prezzo: ultima ? ultima.prezzo : 0, prezzoOriginale: ultima ? ultima.prezzoOriginale : null,
      inOfferta: ultima ? ultima.inOfferta : false, supermercato: supermercatoCorrente || (ultima ? ultima.supermercato : 'Non specificato'), spuntato: false
    });
    aggiunti++;
  });

  renderListaSpesa();
  try { await sincronizzaLista(); } catch (err) { mostraToast('Non sincronizzato: ' + err.message); }
  mostraToast(aggiunti > 0 ? aggiunti + ' prodotti base aggiunti' : 'I prodotti base sono già tutti nella lista');
}

/* ----------------------------------------------------------------------- *
 *  VARIE E TOAST
 * ----------------------------------------------------------------------- */
function renderTutto() {
  popolaSelectSupermercato();
  popolaDatalistProdotti();
  renderListaSpesa();
}

let toastTimer = null;
function mostraToast(messaggio) {
  const toast = document.getElementById('toast');
  toast.textContent = messaggio; toast.classList.add('visibile');
  clearTimeout(toastTimer); toastTimer = setTimeout(function () { toast.classList.remove('visibile'); }, 3000);
}