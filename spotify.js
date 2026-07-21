/* =====================================================
   CONFIGURAZIONE — le uniche 3 cose da modificare
   ===================================================== */

// Incolla qui l'URL della Web App ottenuto dal deploy di Apps Script
// (vedi ISTRUZIONI.txt, punto 4). Deve finire con "/exec".
const URL_BACKEND = 'https://script.google.com/macros/s/AKfycbznX_X7cIUScD12JFhpq0xybLDNNZ3FagvlVAf9SDVyiFzGa6wJcHbR2WL0jqyBM0KL/exec';

// PIN per sbloccare la pagina (solo protezione lato client, non sicurezza reale)
const PIN_CORRETTO = '1234';

// Nomi dei 6 membri del gruppo: modificali con i nomi veri.
// L'ordine qui è l'ordine in cui compariranno i checkbox nel form.
const MEMBRI = ['Chiara', 'Giulia', 'Riccardo', 'Valentina', 'Sharon', 'Sergio', 'Alessandra'];

/* =====================================================
   STATO IN MEMORIA
   ===================================================== */
let periodi = []; // elenco dei periodi caricati dal foglio
let periodoInModifica = null; // se stiamo modificando un periodo esistente

/* =====================================================
   PIN GATE
   ===================================================== */
const pinGate = document.getElementById('pinGate');
const pinInput = document.getElementById('pinInput');
const pinErrore = document.getElementById('pinErrore');
const app = document.getElementById('app');

document.getElementById('pinSubmit').addEventListener('click', provaPin);
pinInput.addEventListener('keydown', function (e) { if (e.key === 'Enter') provaPin(); });

function provaPin() {
  if (pinInput.value === PIN_CORRETTO) {
    sessionStorage.setItem('sf_sbloccato', '1'); // resta sbloccato finché la scheda è aperta
    pinGate.classList.add('hidden');
    app.classList.remove('hidden');
    avvia();
  } else {
    pinErrore.classList.add('mostra');
  }
}

// Se il PIN è già stato inserito in questa sessione, salta la schermata
if (sessionStorage.getItem('sf_sbloccato') === '1') {
  pinGate.classList.add('hidden');
  app.classList.remove('hidden');
  avvia();
}

/* =====================================================
   TEMA CHIARO / SCURO
   ===================================================== */
const temaSalvato = localStorage.getItem('sf_tema');
if (temaSalvato) document.body.setAttribute('data-theme', temaSalvato);

document.getElementById('themeToggle').addEventListener('click', function () {
  const attuale = document.body.getAttribute('data-theme');
  const nuovo = attuale === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', nuovo);
  localStorage.setItem('sf_tema', nuovo);
});

/* =====================================================
   AVVIO: carica i dati dal backend
   ===================================================== */
function avvia() {
  costruisciCheckboxMembri();
  caricaPeriodi();
}

function costruisciCheckboxMembri() {
  const contenitore = document.getElementById('listaMembri');
  contenitore.innerHTML = '';
  MEMBRI.forEach(function (nome) {
    const label = document.createElement('label');
    label.className = 'membro-label';
    label.innerHTML = '<input type="checkbox" value="' + nome + '"> ' + nome;
    const checkbox = label.querySelector('input');
    checkbox.addEventListener('change', function () {
      label.classList.toggle('checked', checkbox.checked);
    });
    contenitore.appendChild(label);
  });
}

function caricaPeriodi() {
  fetch(URL_BACKEND)
    .then(function (r) { return r.json(); })
    .then(function (dati) {
      periodi = dati;
      renderRiepilogo();
      renderTabella();
    })
    .catch(function (errore) {
      document.getElementById('salvaStato').textContent = 'Errore nel caricamento dei dati: ' + errore.message;
    });
}

/* =====================================================
   RENDER — riepilogo periodo più recente
   ===================================================== */
function renderRiepilogo() {
  if (periodi.length === 0) {
    document.getElementById('periodoAttualeLabel').textContent = 'Nessun periodo registrato';
    return;
  }

  const attuale = periodi[periodi.length - 1]; // l'ultimo inserito
  const pagatoNomi = splitNomi(attuale.pagato);
  const nonPagatoNomi = splitNomi(attuale.nonPagato);
  const totale = pagatoNomi.length + nonPagatoNomi.length;
  const percentuale = totale > 0 ? Math.round((pagatoNomi.length / totale) * 100) : 0;

  document.getElementById('periodoAttualeLabel').textContent = attuale.inizio + ' — ' + attuale.fine;
  document.getElementById('barraPagato').style.width = percentuale + '%';
  document.getElementById('countPagato').textContent = pagatoNomi.length;
  document.getElementById('countTotale').textContent = totale;
  document.getElementById('countNonPagato').textContent = nonPagatoNomi.length;

  const chipLista = document.getElementById('chipListaAttuale');
  chipLista.innerHTML = '';
  pagatoNomi.forEach(function (nome) { chipLista.appendChild(creaChip(nome, 'pagato')); });
  nonPagatoNomi.forEach(function (nome) { chipLista.appendChild(creaChip(nome, 'non-pagato')); });
}

function creaChip(nome, classe) {
  const span = document.createElement('span');
  span.className = 'chip ' + classe;
  span.textContent = nome;
  return span;
}

function splitNomi(stringa) {
  if (!stringa) return [];
  return stringa.split(',').map(function (n) { return n.trim(); }).filter(Boolean);
}

/* =====================================================
   RENDER — tabella storico
   ===================================================== */
function renderTabella() {
  const corpo = document.getElementById('corpoTabella');
  corpo.innerHTML = '';

  // Mostra i periodi dal più recente al più vecchio
  periodi.slice().reverse().forEach(function (periodo) {
    const riga = document.createElement('tr');
    riga.innerHTML =
      '<td>' + periodo.inizio + ' — ' + periodo.fine + '</td>' +
      '<td>€ ' + periodo.quota + '</td>' +
      '<td>' + periodo.durata + '</td>' +
      '<td>' + (splitNomi(periodo.pagato).length) + '</td>' +
      '<td>' + (splitNomi(periodo.nonPagato).length) + '</td>' +
      '<td><button class="btn-modifica">Modifica</button></td>';

    riga.querySelector('.btn-modifica').addEventListener('click', function () {
      caricaPeriodoNelForm(periodo);
    });

    corpo.appendChild(riga);
  });
}

/* =====================================================
   FORM — carica un periodo esistente per modificarlo
   ===================================================== */
function caricaPeriodoNelForm(periodo) {
  periodoInModifica = periodo;

  document.getElementById('campoInizio').value = dataInputDaVisualizzata(periodo.inizio);
  document.getElementById('campoFine').value = dataInputDaVisualizzata(periodo.fine);
  document.getElementById('campoQuota').value = periodo.quota;
  document.getElementById('campoDurata').value = periodo.durata;

  const pagatoNomi = splitNomi(periodo.pagato);
  document.querySelectorAll('.membro-label').forEach(function (label) {
    const checkbox = label.querySelector('input');
    checkbox.checked = pagatoNomi.indexOf(checkbox.value) !== -1;
    label.classList.toggle('checked', checkbox.checked);
  });

  document.getElementById('formPeriodo').scrollIntoView({ behavior: 'smooth' });
}

// Converte "gg/mm/aaaa" (formato mostrato) in "aaaa-mm-gg" (formato input date)
function dataInputDaVisualizzata(data) {
  const parti = data.split('/');
  if (parti.length !== 3) return '';
  return parti[2] + '-' + parti[1] + '-' + parti[0];
}

// Converte "aaaa-mm-gg" (input date) in "gg/mm/aaaa" (formato salvato sul foglio)
function dataVisualizzataDaInput(data) {
  const parti = data.split('-');
  if (parti.length !== 3) return data;
  return parti[2] + '/' + parti[1] + '/' + parti[0];
}

/* =====================================================
   FORM — invio (crea o aggiorna un periodo)
   ===================================================== */
document.getElementById('formPeriodo').addEventListener('submit', function (e) {
  e.preventDefault();

  const membriPagato = [];
  document.querySelectorAll('.membro-label input').forEach(function (checkbox) {
    if (checkbox.checked) membriPagato.push(checkbox.value);
  });
  const membriNonPagato = MEMBRI.filter(function (nome) { return membriPagato.indexOf(nome) === -1; });

  const periodo = {
    inizio: dataVisualizzataDaInput(document.getElementById('campoInizio').value),
    fine: dataVisualizzataDaInput(document.getElementById('campoFine').value),
    quota: document.getElementById('campoQuota').value,
    durata: document.getElementById('campoDurata').value,
    pagato: membriPagato.join(', '),
    nonPagato: membriNonPagato.join(', ')
  };

  const stato = document.getElementById('salvaStato');
  stato.textContent = 'Salvataggio in corso…';

  const url = URL_BACKEND + '?action=save&data=' + encodeURIComponent(JSON.stringify(periodo));

  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function () {
      stato.textContent = 'Salvato ✓';
      periodoInModifica = null;
      document.getElementById('formPeriodo').reset();
      document.querySelectorAll('.membro-label').forEach(function (label) { label.classList.remove('checked'); });
      caricaPeriodi();
      setTimeout(function () { stato.textContent = ''; }, 2500);
    })
    .catch(function (errore) {
      stato.textContent = 'Errore: ' + errore.message;
    });
});
