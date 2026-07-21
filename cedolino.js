// ---------- Config & tema ----------
const $ = (sel) => document.querySelector(sel);

// Senza indicare esplicitamente il worker, PDF.js fallisce a caricare il PDF
// (spesso senza un errore chiaro a video) e l'estrazione del testo non parte mai.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
  webAppUrl: localStorage.getItem('cedolino_webAppUrl') || '',
  cedolini: [],
};

function initTheme() {
  const saved = localStorage.getItem('cedolino_theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
  $('#iconSun').style.display = saved === 'dark' ? 'none' : 'block';
  $('#iconMoon').style.display = saved === 'dark' ? 'block' : 'none';
}

$('#themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('cedolino_theme', next);
  $('#iconSun').style.display = next === 'dark' ? 'none' : 'block';
  $('#iconMoon').style.display = next === 'dark' ? 'block' : 'none';
});

$('#settingsToggle').addEventListener('click', () => {
  $('#settingsPanel').classList.toggle('hidden');
  $('#webAppUrl').value = state.webAppUrl;
});

$('#saveSettings').addEventListener('click', () => {
  state.webAppUrl = $('#webAppUrl').value.trim();
  localStorage.setItem('cedolino_webAppUrl', state.webAppUrl);
  $('#settingsPanel').classList.add('hidden');
  loadCedolini();
});

// ---------- Upload & parsing PDF ----------
const dropZone = $('#dropZone');
const fileInput = $('#fileInput');

['dragover'].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  })
);
['dragleave', 'drop'].forEach((evt) =>
  dropZone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
  })
);
dropZone.addEventListener('drop', (e) => {
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});
fileInput.addEventListener('change', (e) => {
  if (e.target.files[0]) handleFile(e.target.files[0]);
});

async function handleFile(file) {
  if (file.type !== 'application/pdf') {
    setStatus('Per ora è supportato solo il PDF.', true);
    return;
  }
  setStatus('Lettura del PDF in corso...');
  try {
    const text = await extractTextFromPdf(file);
    console.log('Testo estratto dal PDF:', text); // utile per debug in console

    if (!text || text.trim().length === 0) {
      setStatus('Il PDF non contiene testo selezionabile (probabile scansione/immagine): serve l\'OCR, non ancora attivo. Inserisci i dati a mano qui sotto.', true);
      showReview({});
      return;
    }

    const parsed = parseCedolino(text);
    const anyFieldFound = Object.values(parsed).some((v) => v !== '');

    if (anyFieldFound) {
      setStatus('Dati letti — controlla e correggi qui sotto prima di salvare.');
    } else {
      setStatus('Ho letto il PDF ma non ho riconosciuto le diciture: correggi i campi a mano. Apri "Testo grezzo" qui sotto e condividilo con me per migliorare il riconoscimento.', true);
    }
    showReview(parsed, text);
  } catch (err) {
    console.error(err);
    setStatus('Errore nella lettura del PDF (vedi console). Puoi comunque inserire i dati a mano qui sotto.', true);
    showReview({});
  }
}

function setStatus(msg, isError) {
  const el = $('#uploadStatus');
  el.textContent = msg;
  el.style.color = isError ? 'var(--red)' : 'var(--text-muted)';
}

async function extractTextFromPdf(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  let fullText = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    fullText += content.items.map((it) => it.str).join(' ') + '\n';
  }
  return fullText;
}

// Euristiche di riconoscimento tarate sul formato "agenzia di somministrazione"
// (Manpower, modello Zucchetti) confermato dal testo grezzo condiviso.
// Alcuni valori (es. Lordo) non hanno un'etichetta univoca adiacente in questo
// layout tabellare: sono stimati con una regola strutturale e vanno sempre
// ricontrollati nel form prima di salvare.
function parseCedolino(text) {
  const norm = text.replace(/\s+/g, ' ');
  const NUM = '\\d+(?:\\.\\d{3})*,\\d+'; // decimali variabili: 845,01 (euro), 7,083 (giorni ferie), 12,93652 (tariffa oraria)
  const clean = (s) => (s ? s.replace(/\./g, '').replace(',', '.') : '');
  const grab = (re) => {
    const m = norm.match(re);
    return m ? clean(m[1]) : '';
  };

  // Netto: protetto da asterischi anti-frode, es. "*****845,01"
  const netto = grab(/\*{3,}\s*(\d+(?:\.\d{3})*,\d{2})/);

  // Ferie / R.O.L. / ASSEM: "LABEL : Res.AP Matur. X Goduto Saldo Y"
  const ferieSaldo = grab(new RegExp(`FERIE\\s*:?[\\s\\S]*?Saldo\\s*(${NUM})`, 'i'));
  const ferieMatur = grab(new RegExp(`FERIE\\s*:?[\\s\\S]*?Matur\\.?\\s*(${NUM})`, 'i'));
  const rolSaldo = grab(new RegExp(`R\\.?O\\.?L\\.?\\s*:?[\\s\\S]*?Saldo\\s*(${NUM})`, 'i'));
  const rolMatur = grab(new RegExp(`R\\.?O\\.?L\\.?\\s*:?[\\s\\S]*?Matur\\.?\\s*(${NUM})`, 'i'));
  const assemSaldo = grab(new RegExp(`ASSEM\\s*:?[\\s\\S]*?Saldo\\s*(${NUM})`, 'i'));

  // Straordinari: "Ore supplementari 35% p.t 4,750 12,93652 61,45" (ore, tariffa, competenza)
  const straOre = grab(new RegExp(`ore\\s+supplementari\\s+\\d+%?\\s*p\\.?t\\.?\\s*(${NUM})`, 'i'));
  const straEuroMatch = norm.match(
    new RegExp(`ore\\s+supplementari\\s+\\d+%?\\s*p\\.?t\\.?\\s*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i')
  );
  const straEuro = straEuroMatch ? clean(straEuroMatch[1]) : '';

  // Lordo: nessuna etichetta diretta in questo layout. Euristica: nel blocco
  // finale il "TOT TRATTENUTE PREV./FISC." e il "TOT TRATTENUTE NETTO" spesso
  // coincidono (X), con il "TOT COMPETENZE" (Y) in mezzo → pattern "X Y X".
  const lordoTriple = norm.match(new RegExp(`(${NUM})\\s+(${NUM})\\s+\\1(?!\\d)`));
  let lordo = lordoTriple ? clean(lordoTriple[2]) : '';
  if (!lordo && netto) {
    // Fallback ulteriore: netto + trattenute INPS/FSBS chiaramente etichettate
    // (stima parziale, potrebbe non includere l'IRPEF per intero)
    const inps = grab(new RegExp(`INPS-FPLD\\/IVS[^\\d]*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i'));
    const fsbs = grab(new RegExp(`FSBS-Somministr[^\\d]*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i'));
    if (inps && fsbs) lordo = (parseFloat(netto) + parseFloat(inps) + parseFloat(fsbs)).toFixed(2);
  }

  return {
    Netto: netto,
    Lordo: lordo,
    FerieResidue: ferieSaldo,
    FerieMaturateMese: ferieMatur,
    RolResiduo: rolSaldo,
    RolMaturatoMese: rolMatur,
    StraordinariOre: straOre,
    StraordinariEuro: straEuro,
    Tredicesima: grab(new RegExp(`tredicesima\\s*[:€]*\\s*(${NUM})`, 'i')),
    Quattordicesima: grab(new RegExp(`quattordicesima\\s*[:€]*\\s*(${NUM})`, 'i')),
    TFRAccantonato: grab(new RegExp(`t\\.?f\\.?r\\.?\\s+accantonat[oa]\\s*[:]*\\s*(${NUM})`, 'i')),
    Extra: '',
    NoteExtra: assemSaldo ? `Permessi/ASSEM residui: ${assemSaldo}` : '',
  };
}

// ---------- Form di revisione ----------
function showReview(data, rawText) {
  $('#reviewSection').classList.remove('hidden');
  const form = $('#reviewForm');
  Object.entries(data).forEach(([key, value]) => {
    const input = form.querySelector(`[name="${key}"]`);
    if (input && value !== undefined) input.value = value;
  });

  const rawDetails = $('#rawTextDetails');
  if (rawText) {
    $('#rawTextArea').value = rawText;
    rawDetails.classList.remove('hidden');
  } else {
    rawDetails.classList.add('hidden');
  }

  $('#reviewSection').scrollIntoView({ behavior: 'smooth' });
}

$('#cancelReview').addEventListener('click', () => {
  $('#reviewSection').classList.add('hidden');
  $('#reviewForm').reset();
  $('#rawTextDetails').classList.add('hidden');
  fileInput.value = '';
  setStatus('');
});

$('#saveReview').addEventListener('click', async () => {
  const form = $('#reviewForm');
  if (!form.reportValidity()) return;

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  payload.DataCaricamento = new Date().toISOString();

  if (!state.webAppUrl) {
    alert('Imposta prima l\'URL della Web App nelle impostazioni (icona ingranaggio in alto).');
    return;
  }

  try {
    await fetch(`${state.webAppUrl}?action=save&data=${encodeURIComponent(JSON.stringify(payload))}`);
    $('#reviewSection').classList.add('hidden');
    form.reset();
    fileInput.value = '';
    setStatus('Cedolino salvato.');
    loadCedolini();
  } catch (err) {
    console.error(err);
    setStatus('Errore nel salvataggio. Controlla l\'URL della Web App.', true);
  }
});

// ---------- Dashboard ----------
$('#refreshBtn').addEventListener('click', loadCedolini);
$('#closeDetail').addEventListener('click', () => {
  $('#detailSection').classList.add('hidden');
});

async function loadCedolini() {
  if (!state.webAppUrl) return;
  const timeline = $('#timeline');
  try {
    const res = await fetch(state.webAppUrl);
    const data = await res.json();
    state.cedolini = data.sort((a, b) => (a.MeseAnno < b.MeseAnno ? 1 : -1));
    renderTimeline();
    renderStats();
  } catch (err) {
    console.error(err);
    timeline.innerHTML = '<p class="empty-state">Impossibile contattare la Web App. Controlla l\'URL nelle impostazioni.</p>';
  }
}

function renderStats() {
  const row = $('#statsRow');
  if (state.cedolini.length === 0) { row.innerHTML = ''; return; }
  const last = state.cedolini[0];
  const prev = state.cedolini[1];

  const delta = (a, b) => {
    if (!prev || a === '' || b === '') return '';
    const d = parseFloat(a) - parseFloat(b);
    if (isNaN(d) || d === 0) return '';
    return `<span class="stat-delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d.toFixed(2)}</span>`;
  };

  row.innerHTML = `
    <div class="stat-box">
      <div class="stat-label">Netto ultimo mese</div>
      <div class="stat-value">€ ${fmt(last.Netto)}</div>
      ${prev ? delta(last.Netto, prev.Netto) : ''}
    </div>
    <div class="stat-box">
      <div class="stat-label">Ferie residue</div>
      <div class="stat-value">${fmt(last.FerieResidue)} gg</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">ROL residuo</div>
      <div class="stat-value">${fmt(last.RolResiduo)} h</div>
    </div>
  `;
}

function renderTimeline() {
  const timeline = $('#timeline');
  if (state.cedolini.length === 0) {
    timeline.innerHTML = '<p class="empty-state">Nessun cedolino salvato ancora. Caricane uno qui sopra per iniziare.</p>';
    return;
  }
  timeline.innerHTML = state.cedolini
    .map(
      (c) => `
      <div class="stub" data-mese="${c.MeseAnno}">
        <div>
          <div class="stub-month">${monthLabel(c.MeseAnno)}</div>
          <div class="stub-meta">Ferie: ${fmt(c.FerieResidue)} gg · ROL: ${fmt(c.RolResiduo)} h</div>
        </div>
        <div class="stub-net">€ ${fmt(c.Netto)}</div>
      </div>`
    )
    .join('');

  timeline.querySelectorAll('.stub').forEach((el) => {
    el.addEventListener('click', () => showDetail(el.dataset.mese));
  });
}

function showDetail(mese) {
  const c = state.cedolini.find((x) => x.MeseAnno === mese);
  if (!c) return;
  const fields = [
    ['Lordo', 'Lordo (€)'],
    ['Netto', 'Netto (€)'],
    ['FerieResidue', 'Ferie residue (gg)'],
    ['FerieMaturateMese', 'Ferie maturate nel mese (gg)'],
    ['RolResiduo', 'ROL residuo (h)'],
    ['RolMaturatoMese', 'ROL maturato nel mese (h)'],
    ['StraordinariOre', 'Straordinari (ore)'],
    ['StraordinariEuro', 'Straordinari (€)'],
    ['Tredicesima', 'Tredicesima (€)'],
    ['Quattordicesima', 'Quattordicesima (€)'],
    ['TFRAccantonato', 'TFR accantonato (€)'],
    ['Extra', 'Extra (€)'],
    ['NoteExtra', 'Note'],
  ];
  $('#detailContent').innerHTML = `
    <h2 class="section-title">${monthLabel(c.MeseAnno)}</h2>
    <div class="detail-grid">
      ${fields
        .map(
          ([key, label]) => `
        <div class="detail-row"><span>${label}</span><span class="val">${c[key] || '—'}</span></div>`
        )
        .join('')}
    </div>
  `;
  $('#detailSection').classList.remove('hidden');
  $('#detailSection').scrollIntoView({ behavior: 'smooth' });
}

function monthLabel(meseAnno) {
  if (!meseAnno) return '';
  const [y, m] = meseAnno.split('-');
  const mesi = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
  return `${mesi[parseInt(m, 10) - 1]} ${y}`;
}

function fmt(v) {
  if (v === '' || v === undefined || v === null) return '0';
  const n = parseFloat(v);
  return isNaN(n) ? v : n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// ---------- Init ----------
initTheme();
loadCedolini();
