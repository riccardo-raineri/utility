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

let stato = { lista: [], ordini: {} };
let ordineCorrente = [];      
let indiceInModifica = null;  
let filtroRicerca = '';       
let modalitaSupermercato = false; 
let isPreferitoInForm = false; 

/* Comunicazione Backend */
function mostraCaricamento(attiva) {
  const indicator = document.getElementById('sync-indicator');
  if (!indicator) return;
  if (attiva) {
    indicator.classList.remove('nascosto');
    requestAnimationFrame(() => indicator.classList.add('visibile'));
  } else {
    indicator.classList.remove('visibile');
    setTimeout(() => { if (!indicator.classList.contains('visibile')) indicator.classList.add('nascosto'); }, 200);
  }
}

async function chiamaBackend(action, extraParams) {
  mostraCaricamento(true);
  try {
    const params = new URLSearchParams(Object.assign({ action: action }, extraParams || {}));
    const res = await fetch(WEBAPP_URL + '?' + params.toString());
    const json = await res.json();
    if (!json.ok) throw new Error(json.errore || 'Errore dal backend');
    return json;
  } finally {
    mostraCaricamento(false);
  }
}

async function caricaDati() {
  try {
    const json = await chiamaBackend('dati');
    stato.lista = json.lista || [];
    stato.ordini = json.ordini || {};
    renderTutto();
  } catch (err) {
    mostraToast('Errore caricamento: ' + err.message);
  }
}

async function sincronizzaLista() {
  await chiamaBackend('aggiornaLista', { data: JSON.stringify(stato.lista) });
}

/* Inizializzazione Eventi */
document.addEventListener('DOMContentLoaded', function () {
  inizializzaTema();
  popolaSelectCategorie();
  collegaEventi();
  caricaDati();
  
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

  document.getElementById('input-peso').addEventListener('input', aggiornaAnteprimaProdotto);
  document.getElementById('input-prezzo').addEventListener('input', aggiornaAnteprimaProdotto);
  document.getElementById('input-prezzo-offerta').addEventListener('input', aggiornaAnteprimaProdotto);
  document.getElementById('input-unita').addEventListener('change', aggiornaAnteprimaProdotto);

  // Toggle Stella Preferito nel Form
  const btnStellaForm = document.getElementById('btn-toggle-base-form');
  btnStellaForm.addEventListener('click', function() {
    isPreferitoInForm = !isPreferitoInForm;
    btnStellaForm.textContent = isPreferitoInForm ? '★' : '☆';
    btnStellaForm.style.color = isPreferitoInForm ? 'var(--accento)' : '';
  });

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

  document.getElementById('input-supermercato-nuovo').addEventListener('blur', confermaNuovoSupermercato);

  document.getElementById('ricerca-prodotto').addEventListener('input', function () {
    filtroRicerca = this.value.trim().toLowerCase();
    renderListaSpesa();
  });

  // Modalità Supermercato
  const btnSpesa = document.getElementById('btn-sono-al-supermercato');
  const dropdownSpesa = document.getElementById('dropdown-supermercato-spesa');

  btnSpesa.addEventListener('click', function(e) {
    e.stopPropagation();
    if (!modalitaSupermercato) {
      const daOrdini = Object.keys(stato.ordini || {});
      const daLista = stato.lista.map(i => i.supermercato);
      const stores = [...new Set([...daOrdini, ...daLista].filter(Boolean))].sort();

      if (stores.length === 0) {
        const nuovoNegozio = prompt('In quale supermercato di trovi?');
        if (nuovoNegozio && nuovoNegozio.trim()) {
          const negozio = nuovoNegozio.trim();
          document.getElementById('input-supermercato').value = negozio;
          modalitaSupermercato = true;
          btnSpesa.textContent = 'Ho finito la spesa!';
          btnSpesa.classList.add('btn-active');
          renderListaSpesa();
          mostraToast(`🛒 Spesa attiva per: ${negozio}`);
        }
        return;
      }

      dropdownSpesa.innerHTML = `<div class="dropdown-supermercato-header">Seleziona Supermercato</div>` +
        stores.map(s => `<div class="dropdown-item-supermercato" data-negozio="${s}">🛒 ${s}</div>`).join('');
      
      dropdownSpesa.classList.toggle('nascosto');
    } else {
      modalitaSupermercato = false;
      btnSpesa.textContent = '🛒 Sono al supermercato';
      btnSpesa.classList.remove('btn-active');
      dropdownSpesa.classList.add('nascosto');
      renderListaSpesa();
      mostraToast('Modalità spesa disattivata');
    }
  });

  dropdownSpesa.addEventListener('click', function(e) {
    const item = e.target.closest('.dropdown-item-supermercato');
    if (!item) return;
    const negozioScelto = item.dataset.negozio;

    document.getElementById('input-supermercato').value = negozioScelto;
    modalitaSupermercato = true;
    btnSpesa.textContent = 'Ho finito la spesa!';
    btnSpesa.classList.add('btn-active');
    dropdownSpesa.classList.add('nascosto');
    renderListaSpesa();
    mostraToast(`🛒 Spesa attiva per: ${negozioScelto}`);
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.supermercato-dropdown-wrapper')) {
      dropdownSpesa.classList.add('nascosto');
    }
  });

  document.getElementById('btn-ordine-corsie').addEventListener('click', apriPannelloOrdine);
  document.getElementById('btn-chiudi-ordine').addEventListener('click', function () {
    document.getElementById('pannello-ordine').classList.add('nascosto');
  });
  document.getElementById('btn-salva-ordine').addEventListener('click', salvaOrdineCorsie);
}

/* Tema */
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

/* Select & Calcoli */
function popolaSelectSupermercato() {
  const select = document.getElementById('input-supermercato');
  const valorePrecedente = select.value;
  const daOrdini = Object.keys(stato.ordini || {});
  const daLista = stato.lista.map(i => i.supermercato);
  const elenco = [...new Set([...daOrdini, ...daLista].filter(Boolean))].sort();

  select.innerHTML = elenco.map(s => `<option value="${s}">${s}</option>`).join('') + 
                     '<option value="__nuovo__">+ Nuovo supermercato...</option>';

  if (valorePrecedente && elenco.includes(valorePrecedente)) {
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
  const opzione = document.createElement('option');
  opzione.value = nome;
  opzione.textContent = nome;
  select.insertBefore(opzione, select.querySelector('option[value="__nuovo__"]'));
  select.value = nome;
  inputNuovo.classList.add('nascosto');
  renderListaSpesa();
}

function popolaSelectCategorie() {
  const select = document.getElementById('input-categoria');
  select.innerHTML = CATEGORIE.map(c => `<option value="${c.id}">${c.icona} ${c.id}</option>`).join('');
}

function calcolaPrezzoKg(peso, unita, prezzo) {
  let pesoKg = peso;
  if (unita === 'g' || unita === 'ml') pesoKg = peso / 1000;
  return pesoKg > 0 ? prezzo / pesoKg : prezzo;
}

function aggiornaAnteprimaProdotto() {
  const hint = document.getElementById('hint-prezzo');
  const peso = parseFloat(document.getElementById('input-peso').value);
  const prezzo = parseFloat(document.getElementById('input-prezzo').value);
  const prezzoOfferta = parseFloat(document.getElementById('input-prezzo-offerta').value);
  const unita = document.getElementById('input-unita').value;
  const prezzoAttivo = !isNaN(prezzoOfferta) && prezzoOfferta > 0 ? prezzoOfferta : prezzo;

  if (!peso || isNaN(prezzoAttivo)) { hint.textContent = ''; return; }
  hint.textContent = '€/kg: ' + calcolaPrezzoKg(peso, unita, prezzoAttivo).toFixed(2);
}

/* Gestione Aggiunta e Modifica */
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
    mostraToast('Inserisci almeno prodotto, peso e prezzo');
    return;
  }

  const nuovoItem = { 
    prodotto: nome, marca: marca, categoria: categoria, unita: unita, peso: peso, 
    prezzo: prezzoRilevante, prezzoOriginale: hasOfferta ? prezzo : null,
    inOfferta: hasOfferta, supermercato: supermercato, spuntato: false,
    preferito: isPreferitoInForm
  };

  if (indiceInModifica !== null) {
    nuovoItem.spuntato = stato.lista[indiceInModifica].spuntato;
    stato.lista[indiceInModifica] = nuovoItem;
    annullaModifica();
    mostraToast('Prodotto aggiornato');
  } else {
    stato.lista.push(nuovoItem);
    resetForm();
  }

  renderListaSpesa();
  try { await sincronizzaLista(); } catch (err) { mostraToast('Errore sincronizzazione: ' + err.message); }
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

  isPreferitoInForm = !!item.preferito;
  const btnStellaForm = document.getElementById('btn-toggle-base-form');
  btnStellaForm.textContent = isPreferitoInForm ? '★' : '☆';
  btnStellaForm.style.color = isPreferitoInForm ? 'var(--accento)' : '';

  indiceInModifica = indice;
  document.getElementById('btn-aggiungi').textContent = '✓ Salva modifiche';
  document.getElementById('btn-annulla-modifica').classList.remove('nascosto');
  aggiornaAnteprimaProdotto();
}

function annullaModifica() {
  indiceInModifica = null;
  document.getElementById('btn-aggiungi').textContent = '+ Aggiungi alla lista';
  document.getElementById('btn-annulla-modifica').classList.add('nascosto');
  resetForm();
}

function resetForm() {
  document.getElementById('input-prodotto').value = '';
  document.getElementById('input-marca').value = '';
  document.getElementById('input-peso').value = '';
  document.getElementById('input-prezzo').value = '';
  document.getElementById('input-prezzo-offerta').value = '';
  document.getElementById('hint-prezzo').textContent = '';
  isPreferitoInForm = false;
  const btnStellaForm = document.getElementById('btn-toggle-base-form');
  btnStellaForm.textContent = '☆';
  btnStellaForm.style.color = '';
}

/* Rendering della Lista e Stella Preferiti */
function renderListaSpesa() {
  const contenitore = document.getElementById('lista-categorie');
  contenitore.innerHTML = '';

  const supermercato = supermercatoSelezionato();
  const personalizzato = stato.ordini && stato.ordini[supermercato];
  const tutteLeCategorie = CATEGORIE.map(c => c.id);
  const ordineCorsie = (personalizzato && personalizzato.length) 
    ? personalizzato.concat(tutteLeCategorie.filter(id => !personalizzato.includes(id)))
    : tutteLeCategorie;

  ordineCorsie.forEach(catId => {
    const cat = CATEGORIE.find(c => c.id === catId) || { id: catId, icona: '' };
    const items = stato.lista
      .map((item, indiceReale) => ({ item: item, indiceReale: indiceReale }))
      .filter(x => x.item.categoria === cat.id)
      .filter(x => !filtroRicerca || x.item.prodotto.toLowerCase().includes(filtroRicerca) || (x.item.marca || '').toLowerCase().includes(filtroRicerca))
      .filter(x => !(modalitaSupermercato && x.item.spuntato));

    if (items.length === 0) return;

    const blocco = document.createElement('div');
    blocco.className = 'categoria-blocco';
    blocco.innerHTML = `<div class="categoria-titolo">${cat.icona} ${cat.id}</div>`;

    items.forEach(x => { blocco.appendChild(creaRigaProdotto(x.item, x.indiceReale)); });
    contenitore.appendChild(blocco);
  });
}

function creaRigaProdotto(item, indice) {
  const wrapper = document.createElement('div');
  wrapper.className = 'prodotto-riga-wrapper';

  const riga = document.createElement('div');
  riga.className = 'prodotto-riga' + (item.spuntato ? ' spuntato' : '');

  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = item.spuntato;
  checkbox.addEventListener('change', () => toggleSpuntato(indice));

  // PULSANTE STELLA PREFERITI FUNZIONANTE NELLA LISTA
  const btnPref = document.createElement('button');
  btnPref.type = 'button';
  btnPref.className = 'preferito-toggle' + (item.preferito ? ' attivo' : '');
  btnPref.textContent = item.preferito ? '★' : '☆';
  btnPref.title = item.preferito ? 'Rimuovi dai preferiti' : 'Aggiungi ai preferiti';
  btnPref.addEventListener('click', function(e) {
    e.stopPropagation();
    togglePreferitoInLista(indice);
  });

  const info = document.createElement('div');
  const prezzoKg = calcolaPrezzoKg(item.peso, item.unita, item.prezzo);
  const dettagli = [];
  if (item.marca) dettagli.push(item.marca);
  dettagli.push(item.peso + ' ' + item.unita);
  dettagli.push(item.supermercato);
  dettagli.push('€/kg ' + prezzoKg.toFixed(2));

  const nomeDiv = document.createElement('div');
  nomeDiv.className = 'prodotto-nome';
  nomeDiv.appendChild(btnPref);
  nomeDiv.appendChild(document.createTextNode(' ' + item.prodotto));

  info.appendChild(nomeDiv);
  info.innerHTML += `<div class="prodotto-dettaglio">${dettagli.join(' • ')}</div>`;

  // Prezzo Normale o Scontato
  const prezzo = document.createElement('div');
  prezzo.className = 'prodotto-prezzo';
  if (item.inOfferta && item.prezzoOriginale) {
    prezzo.innerHTML = `<span class="prezzo-originale">€ ${Number(item.prezzoOriginale).toFixed(2)}</span> ` +
                       `<span class="prezzo-offerta">€ ${Number(item.prezzo).toFixed(2)}</span>`;
  } else {
    prezzo.textContent = '€ ' + Number(item.prezzo).toFixed(2);
  }

  const modifica = document.createElement('button');
  modifica.className = 'riga-modifica'; modifica.textContent = '✏';
  modifica.addEventListener('click', () => modificaProdottoInLista(indice));

  const elimina = document.createElement('button');
  elimina.className = 'riga-elimina'; elimina.textContent = '✕';
  elimina.addEventListener('click', () => eliminaDaLista(indice));

  riga.appendChild(checkbox); 
  riga.appendChild(info); 
  riga.appendChild(prezzo); 
  riga.appendChild(modifica); 
  riga.appendChild(elimina);
  
  wrapper.appendChild(riga);
  return wrapper;
}

// Azione al click della Stella Preferiti nella lista
async function togglePreferitoInLista(indice) {
  stato.lista[indice].preferito = !stato.lista[indice].preferito;
  renderListaSpesa();
  try { 
    await sincronizzaLista(); 
  } catch (err) { 
    mostraToast('Errore sincronizzazione: ' + err.message); 
  }
}

async function toggleSpuntato(indice) {
  stato.lista[indice].spuntato = !stato.lista[indice].spuntato;
  renderListaSpesa();
  try { await sincronizzaLista(); } catch (err) { mostraToast('Errore sincronizzazione: ' + err.message); }
}

async function eliminaDaLista(indice) {
  if (indiceInModifica === indice) annullaModifica();
  stato.lista.splice(indice, 1);
  renderListaSpesa();
  try { await sincronizzaLista(); } catch (err) { mostraToast('Errore sincronizzazione: ' + err.message); }
}

/* Pannello Corsie */
function apriPannelloOrdine() {
  const supermercato = supermercatoSelezionato();
  if (!supermercato) { mostraToast('Seleziona prima un supermercato'); return; }

  document.getElementById('ordine-supermercato-nome').textContent = supermercato;
  const salvato = stato.ordini && stato.ordini[supermercato];
  ordineCorrente = (salvato && salvato.length) ? salvato.slice() : MODELLI_SUPERMERCATO.generico.slice();
  renderPannelloOrdine();
  document.getElementById('pannello-ordine').classList.remove('nascosto');
}

function renderPannelloOrdine() {
  const cont = document.getElementById('ordine-lista');
  cont.innerHTML = ordineCorrente.map((catId, idx) => {
    const cat = CATEGORIE.find(c => c.id === catId);
    return `<div class="ordine-riga">
      <span>${cat ? cat.icona : ''} ${catId}</span>
    </div>`;
  }).join('');
}

async function salvaOrdineCorsie() {
  const supermercato = supermercatoSelezionato();
  try {
    const json = await chiamaBackend('salvaOrdine', { data: JSON.stringify({ supermercato: supermercato, ordine: ordineCorrente }) });
    stato.ordini = json.ordini; 
    renderListaSpesa();
    document.getElementById('pannello-ordine').classList.add('nascosto');
    mostraToast('Ordine corsie salvato');
  } catch (err) { mostraToast('Errore: ' + err.message); }
}

function renderTutto() {
  popolaSelectSupermercato();
  renderListaSpesa();
}

let toastTimer = null;
function mostraToast(messaggio) {
  const toast = document.getElementById('toast');
  toast.textContent = messaggio; 
  toast.classList.add('visibile');
  clearTimeout(toastTimer); 
  toastTimer = setTimeout(() => toast.classList.remove('visibile'), 3000);
}