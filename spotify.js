/* =====================================================
   CONFIGURAZIONE — le uniche 3 cose da modificare
   ===================================================== */

// Incolla qui l'URL della Web App ottenuto dal deploy di Apps Script
// (vedi ISTRUZIONI.txt, punto 4). Deve finire con "/exec".
const URL_BACKEND = 'https://script.google.com/macros/s/AKfycbx1_49drxJ75WOkucbend8j6pPwFq3_3ClKjC67obdzCmDLtNb-Sj0B8Df8a0cAqxp3/exec';

// PIN per sbloccare la pagina (solo protezione lato client, non sicurezza reale)
const PIN_CORRETTO = '1234';

// Nomi dei membri del gruppo: modificali con i nomi veri.
// L'ordine qui è l'ordine in cui compariranno i checkbox nel form.
const MEMBRI = ['Chiara', 'Giulia', 'Riccardo', 'Valentina', 'Sharon', 'Sergio', 'Alessandra'];

/* =====================================================
   STATO IN MEMORIA
   ===================================================== */
let periodi = []; // elenco dei periodi caricati dal foglio

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
      aggiornaBarraDaCheckbox(); // aggiorna subito il riepilogo, senza aspettare il salvataggio
    });
    contenitore.appendChild(label);
  });
}

function caricaPeriodi() {
  fetch(URL_BACKEND)
    .then(function (r) { return r.json(); })
    .then(function (dati) {
      periodi = dati;
      renderTabella();
      // Dopo ogni caricamento, il form mostra sempre il periodo più recente
      // (cioè quello "in corso"), pronto per essere modificato al volo.
      if (periodi.length > 0) {
        caricaPeriodoNelForm(periodi[periodi.length - 1], 'Periodo attuale');
      } else {
        resetForm('Nuovo periodo');
      }
    })
    .catch(function (errore) {
      document.getElementById('salvaStato').textContent = 'Errore nel caricamento dei dati: ' + errore.message;
    });
}

/* =====================================================
   RIEPILOGO LIVE — ricalcolato a ogni click sui checkbox,
   così la barra e i conteggi seguono quello che si sta per salvare,
   non solo l'ultimo dato salvato.
   ===================================================== */
function aggiornaBarraDaCheckbox() {
  const checkbox = Array.from(document.querySelectorAll('.membro-label input'));
  const pagati = checkbox.filter(function (c) { return c.checked; }).length;
  const totale = checkbox.length;
  const percentuale = totale > 0 ? Math.round((pagati / totale) * 100) : 0;

  document.getElementById('barraPagato').style.width = percentuale + '%';
  document.getElementById('countPagato').textContent = pagati;
  document.getElementById('countTotale').textContent = totale;
  document.getElementById('countNonPagato').textContent = totale - pagati;
}

/* =====================================================
   RENDER — tabella storico
   ===================================================== */
function renderTabella() {
  const corpo = document.getElementById('corpoTabella');
  corpo.innerHTML = '';

  // Mostra i periodi dal più recente al più vecchio
  periodi.slice().reverse().forEach(function (periodo, indice) {
    const eUltimo = indice === 0; // il primo della lista invertita = il più recente
    const riga = document.createElement('tr');
    riga.innerHTML =
      '<td>' + periodo.inizio + ' — ' + periodo.fine + '</td>' +
      '<td>€ ' + periodo.quota + '</td>' +
      '<td>' + periodo.durata + '</td>' +
      '<td>' + (splitNomi(periodo.pagato).length) + '</td>' +
      '<td>' + (splitNomi(periodo.nonPagato).length) + '</td>' +
      '<td><button class="btn-modifica">Modifica</button></td>';

    riga.querySelector('.btn-modifica').addEventListener('click', function () {
      caricaPeriodoNelForm(periodo, eUltimo ? 'Periodo attuale' : 'Modifica periodo');
      document.getElementById('riepilogo').scrollIntoView({ behavior: 'smooth' });
    });

    corpo.appendChild(riga);
  });
}

function splitNomi(stringa) {
  if (!stringa) return [];
  return stringa.split(',').map(function (n) { return n.trim(); }).filter(Boolean);
}

/* =====================================================
   FORM — carica un periodo (attuale o storico) nel riepilogo/form
   ===================================================== */
function caricaPeriodoNelForm(periodo, titolo) {
  document.getElementById('riepilogoTitolo').textContent = titolo;

  document.getElementById('campoInizio').value = dataInputDaVisualizzata(periodo.inizio);
  document.getElementById('campoFine').value = dataInputDaVisualizzata(periodo.fine);
  document.getElementById('campoQuota').value = periodo.quota || '';
  document.getElementById('campoDurata').value = periodo.durata;

  const pagatoNomi = splitNomi(periodo.pagato);
  document.querySelectorAll('.membro-label').forEach(function (label) {
    const checkbox = label.querySelector('input');
    checkbox.checked = pagatoNomi.indexOf(checkbox.value) !== -1;
    label.classList.toggle('checked', checkbox.checked);
  });

  aggiornaBarraDaCheckbox();
}

/* =====================================================
   FORM — "+ Nuovo periodo": svuota le date e i checkbox,
   ma tiene precompilati quota e durata con gli ultimi valori usati,
   così di solito basta scegliere le nuove date e chi ha pagato.
   ===================================================== */
document.getElementById('nuovoPeriodoBtn').addEventListener('click', function () {
  resetForm('Nuovo periodo');
});

function resetForm(titolo) {
  document.getElementById('riepilogoTitolo').textContent = titolo;

  document.getElementById('campoInizio').value = '';
  document.getElementById('campoFine').value = '';
  document.getElementById('campoQuota').value = '';
  document.getElementById('campoDurata').value = ultimoValoreConosciuto('durata');

  document.querySelectorAll('.membro-label').forEach(function (label) {
    const checkbox = label.querySelector('input');
    checkbox.checked = false;
    label.classList.remove('checked');
  });

  aggiornaBarraDaCheckbox();
}

// Recupera l'ultimo valore non vuoto usato per un campo (es. "quota" o "durata"),
// scorrendo i periodi salvati dal più recente al più vecchio.
function ultimoValoreConosciuto(campo) {
  for (let i = periodi.length - 1; i >= 0; i--) {
    if (periodi[i][campo]) return periodi[i][campo];
  }
  return '';
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

  // La quota è facoltativa: se il campo è vuoto, riusa automaticamente
  // l'ultimo importo a persona salvato in uno dei periodi precedenti.
  const quotaInserita = document.getElementById('campoQuota').value;
  const quota = quotaInserita !== '' ? quotaInserita : ultimoValoreConosciuto('quota');

  const periodo = {
    inizio: dataVisualizzataDaInput(document.getElementById('campoInizio').value),
    fine: dataVisualizzataDaInput(document.getElementById('campoFine').value),
    quota: quota,
    durata: document.getElementById('campoDurata').value,
    pagato: membriPagato.join(', '),
    nonPagato: membriNonPagato.join(', ')
  };

  const stato = document.getElementById('salvaStato');
  stato.textContent = 'Salvataggio in corso…';

  // Il backend (apps-script.gs) cerca già una riga con le stesse date:
  // se esiste la aggiorna, altrimenti ne aggiunge una nuova. Non serve
  // quindi distinguere qui tra "modifica" e "nuovo periodo".
  const url = URL_BACKEND + '?action=save&data=' + encodeURIComponent(JSON.stringify(periodo));

  fetch(url)
    .then(function (r) { return r.json(); })
    .then(function () {
      stato.textContent = 'Salvato ✓';
      caricaPeriodi();
      setTimeout(function () { stato.textContent = ''; }, 2500);
    })
    .catch(function (errore) {
      stato.textContent = 'Errore: ' + errore.message;
    });
});
