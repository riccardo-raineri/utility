/* =====================================================
   CONFIGURAZIONE — le uniche 3 cose da modificare
   ===================================================== */

// Incolla qui l'URL della Web App ottenuto dal deploy di Apps Script
// (vedi ISTRUZIONI.txt, punto 4). Deve finire con "/exec".
const URL_BACKEND = 'https://script.google.com/macros/s/AKfycbznX_X7cIUScD12JFhpq0xybLDNNZ3FagvlVAf9SDVyiFzGa6wJcHbR2WL0jqyBM0KL/exec';

// PIN per sbloccare la pagina (solo protezione lato client, non sicurezza reale)
const PIN_CORRETTO = '1234';

// I 6 membri ATTUALI del gruppo (usati per il periodo attuale e i nuovi
// periodi). Alessandra è entrata al posto di Sergio da questo mese: i
// periodi passati restano quelli davvero registrati per allora, e non
// vengono toccati da questo elenco quando li visualizzi nello storico.
const MEMBRI = ['Chiara', 'Giulia', 'Riccardo', 'Valentina', 'Sharon', 'Alessandra'];

/* =====================================================
   STATO IN MEMORIA
   ===================================================== */
let periodi = []; // elenco dei periodi caricati dal foglio (ordine originale)

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
      const ordinati = ordinaPerDataDiscendente(periodi);
      renderTabella(ordinati);
      // Il periodo attuale è sempre quello con la data più recente,
      // non semplicemente l'ultima riga del foglio.
      if (ordinati.length > 0) {
        caricaPeriodoNelForm(ordinati[0], 'Periodo attuale');
      } else {
        resetForm('Nuovo periodo');
      }
    })
    .catch(function (errore) {
      document.getElementById('salvaStato').textContent = 'Errore nel caricamento dei dati: ' + errore.message;
    });
}

/* =====================================================
   ORDINAMENTO PER DATA
   ===================================================== */
// Converte "gg/mm/aaaa" in un vero oggetto Date, per poter confrontare
// e ordinare correttamente i periodi (l'ordine delle righe sul foglio
// non è affidabile: si vuole l'ordine cronologico reale).
function analizzaData(stringaData) {
  const parti = (stringaData || '').split('/');
  if (parti.length !== 3) return new Date(0);
  return new Date(parseInt(parti[2], 10), parseInt(parti[1], 10) - 1, parseInt(parti[0], 10));
}

function ordinaPerDataDiscendente(lista) {
  return lista.slice().sort(function (a, b) {
    return analizzaData(b.inizio) - analizzaData(a.inizio);
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
  const totale = checkbox.length; // sempre 6, quanti sono i MEMBRI attuali
  const percentuale = totale > 0 ? Math.round((pagati / totale) * 100) : 0;

  document.getElementById('barraPagato').style.width = percentuale + '%';
  document.getElementById('countPagato').textContent = pagati;
  document.getElementById('countTotale').textContent = totale;
  document.getElementById('countNonPagato').textContent = totale - pagati;
}

/* =====================================================
   RENDER — tabella storico (ordinata dal più recente al più vecchio)
   ===================================================== */
function renderTabella(listaOrdinata) {
  const corpo = document.getElementById('corpoTabella');
  corpo.innerHTML = '';

  listaOrdinata.forEach(function (periodo, indice) {
    const eIlPiuRecente = indice === 0;
    const riga = document.createElement('tr');
    riga.innerHTML =
      '<td>' + periodo.inizio + ' — ' + periodo.fine + '</td>' +
      '<td>€ ' + periodo.quota + '</td>' +
      '<td>' + periodo.durata + '</td>' +
      '<td class="cella-nomi cella-ok">' + (periodo.pagato || '—') + '</td>' +
      '<td class="cella-nomi cella-no">' + (periodo.nonPagato || '—') + '</td>' +
      '<td><button class="btn-modifica">Modifica</button></td>';

    riga.querySelector('.btn-modifica').addEventListener('click', function () {
      caricaPeriodoNelForm(periodo, eIlPiuRecente ? 'Periodo attuale' : 'Modifica periodo');
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
  const ordinati = ordinaPerDataDiscendente(periodi);
  for (let i = 0; i < ordinati.length; i++) {
    if (ordinati[i][campo]) return ordinati[i][campo];
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
  // se esiste la aggiorna, altrimenti ne aggiunge una nuova.
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
