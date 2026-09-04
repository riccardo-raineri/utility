// ---------- Config & tema ----------
const $ = (sel) => document.querySelector(sel);

// Senza indicare esplicitamente il worker, PDF.js fallisce a caricare il PDF
// (spesso senza un errore chiaro a video) e l'estrazione del testo non parte mai.
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
  webAppUrl: localStorage.getItem('cedolino_webAppUrl') || '',
  accessToken: localStorage.getItem('cedolino_accessToken') || '',
  cedolini: [],
};

function initTheme() {
  const saved = localStorage.getItem('cedolino_theme') || 'dark';
  document.body.setAttribute('data-theme', saved);
  $('#iconSun').style.display = saved === 'dark' ? 'none' : 'block';
  $('#iconMoon').style.display = saved === 'dark' ? 'block' : 'none';
}

$('#themeToggle').addEventListener('click', () => {
  const current = document.body.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.body.setAttribute('data-theme', next);
  localStorage.setItem('cedolino_theme', next);
  $('#iconSun').style.display = next === 'dark' ? 'none' : 'block';
  $('#iconMoon').style.display = next === 'dark' ? 'block' : 'none';
});

$('#settingsToggle').addEventListener('click', () => {
  $('#settingsPanel').classList.toggle('hidden');
  $('#webAppUrl').value = state.webAppUrl;
  $('#accessToken').value = state.accessToken;
});

$('#saveSettings').addEventListener('click', () => {
  state.webAppUrl = $('#webAppUrl').value.trim();
  state.accessToken = $('#accessToken').value.trim();
  localStorage.setItem('cedolino_webAppUrl', state.webAppUrl);
  localStorage.setItem('cedolino_accessToken', state.accessToken);
  $('#settingsPanel').classList.add('hidden');
  loadCedolini();
});

function apiUrl(params) {
  const url = new URL(state.webAppUrl);
  url.searchParams.set('token', state.accessToken);
  Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
  return url.toString();
}
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
  if (!state.webAppUrl || !state.accessToken) {
    setStatus('Imposta prima URL e token nelle impostazioni (icona ingranaggio) per usare il riconoscimento AI.', true);
    return;
  }

  setStatus('Lettura del PDF in corso...');
  let text;
  try {
    text = await extractTextFromPdf(file);
    console.log('Testo estratto dal PDF:', text); // utile per debug in console
  } catch (err) {
    console.error(err);
    setStatus('Errore nella lettura del PDF (vedi console). Puoi comunque inserire i dati a mano qui sotto.', true);
    showReview({});
    return;
  }

  if (!text || text.trim().length === 0) {
    setStatus('Il PDF non contiene testo selezionabile (probabile scansione/immagine): serve l\'OCR, non ancora attivo. Inserisci i dati a mano qui sotto.', true);
    showReview({});
    return;
  }

  setStatus('Riconoscimento dei dati con AI in corso...');
  try {
    const result = await parseCedolinoWithAI(text);
    if (result.status === 'ok') {
      setStatus('Dati letti — controlla e correggi qui sotto prima di salvare.');
      showReview(result.fields, text);
    } else {
      setStatus(`Riconoscimento AI non riuscito (${result.message || 'errore sconosciuto'}). Correggi i campi a mano.`, true);
      showReview({}, text);
    }
  } catch (err) {
    console.error(err);
    setStatus('Errore nel contattare il riconoscimento AI. Correggi i campi a mano qui sotto.', true);
    showReview({}, text);
  }
}

async function parseCedolinoWithAI(text) {
  const res = await fetch(state.webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita la preflight CORS di 'application/json'
    body: JSON.stringify({ action: 'parse', token: state.accessToken, text }),
  });
  return res.json();
}

function setStatus(msg, isError) {
  const el = $('#uploadStatus');
  el.textContent = msg;
  el.style.color = isError ? 'var(--accent-red)' : 'var(--text-secondary)';
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
    await fetch(apiUrl({ action: 'save', data: JSON.stringify(payload) }));
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

$('#deleteDetail').addEventListener('click', async () => {
  const mese = $('#detailSection').dataset.mese;
  if (!mese) return;
  if (!confirm(`Eliminare definitivamente il cedolino di ${monthLabel(mese)}? L'operazione non è reversibile.`)) return;

  try {
    await fetch(apiUrl({ action: 'delete', mese }));
    $('#detailSection').classList.add('hidden');
    setStatus('Cedolino eliminato.');
    loadCedolini();
  } catch (err) {
    console.error(err);
    alert('Errore durante l\'eliminazione. Controlla la connessione e riprova.');
  }
});

async function loadCedolini() {
  if (!state.webAppUrl) return;
  const timeline = $('#timeline');
  $('#loaderContainer').classList.remove('hidden');
  timeline.innerHTML = '';
  try {
    const res = await fetch(apiUrl());
    const data = await res.json();
    if (data && data.status === 'unauthorized') {
      timeline.innerHTML = '<p class="empty-state">Token non valido: controlla il PIN nelle impostazioni.</p>';
      return;
    }
    state.cedolini = data.sort((a, b) => (a.MeseAnno < b.MeseAnno ? 1 : -1));
    renderTimeline();
    renderStats();
    renderChart();
  } catch (err) {
    console.error(err);
    timeline.innerHTML = '<p class="empty-state">Impossibile contattare la Web App. Controlla l\'URL nelle impostazioni.</p>';
  } finally {
    $('#loaderContainer').classList.add('hidden');
  }
}

$('#searchInput').addEventListener('input', (e) => {
  renderTimeline(e.target.value.trim().toLowerCase());
});

function renderStats() {
  const row = $('#statsRow');
  if (state.cedolini.length === 0) { row.innerHTML = ''; return; }
  const last = state.cedolini[0];
  const prev = state.cedolini[1];

  const delta = (a, b) => {
    if (!prev || a === '' || b === '') return '';
    const d = parseFloat(a) - parseFloat(b);
    if (isNaN(d) || d === 0) return '';
    return `<div class="stat-delta ${d > 0 ? 'up' : 'down'}"><i data-lucide="${d > 0 ? 'arrow-up-right' : 'arrow-down-right'}"></i>${d > 0 ? '+' : ''}${d.toFixed(2)} € vs mese prec.</div>`;
  };

  const ultimi3 = state.cedolini.slice(0, 3).map((c) => parseFloat(c.Netto)).filter((n) => !isNaN(n));
  const media3 = ultimi3.length ? ultimi3.reduce((a, b) => a + b, 0) / ultimi3.length : null;

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
    ${media3 !== null ? `
    <div class="stat-box">
      <div class="stat-label">Media netto (ultimi ${ultimi3.length} mesi)</div>
      <div class="stat-value">€ ${fmt(media3)}</div>
    </div>` : ''}
  `;
  refreshIcons();
}

// ---------- Grafico andamento netto ----------
function renderChart() {
  const card = $('#chartCard');
  const container = $('#netChart');
  const points = state.cedolini
    .filter((c) => c.MeseAnno && c.Netto !== '' && !isNaN(parseFloat(c.Netto)))
    .slice()
    .sort((a, b) => (a.MeseAnno > b.MeseAnno ? 1 : -1));

  if (points.length < 2) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');

  const W = 640, H = 180, PAD_X = 30, PAD_Y = 24;
  const values = points.map((p) => parseFloat(p.Netto));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const stepX = (W - PAD_X * 2) / (points.length - 1);
  const coords = values.map((v, i) => {
    const x = PAD_X + i * stepX;
    const y = H - PAD_Y - ((v - min) / range) * (H - PAD_Y * 2);
    return [x, y];
  });

  const linePath = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1][0].toFixed(1)},${H - PAD_Y} L${coords[0][0].toFixed(1)},${H - PAD_Y} Z`;

  const dots = coords
    .map(([x, y], i) => `<circle class="chart-dot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.5"><title>${monthLabel(points[i].MeseAnno)}: € ${fmt(values[i])}</title></circle>`)
    .join('');

  const labels = coords
    .map(([x], i) => {
      // mostra solo alcune etichette se ci sono troppi mesi, per non affollare
      const showEvery = Math.ceil(points.length / 6);
      if (i % showEvery !== 0 && i !== points.length - 1) return '';
      const short = monthLabel(points[i].MeseAnno).slice(0, 3);
      return `<text class="chart-label" x="${x.toFixed(1)}" y="${H - 6}" text-anchor="middle">${short}</text>`;
    })
    .join('');

  const firstVal = `<text class="chart-value" x="${coords[0][0]}" y="${coords[0][1] - 10}" text-anchor="middle">€${Math.round(values[0])}</text>`;
  const lastVal = `<text class="chart-value" x="${coords[coords.length - 1][0]}" y="${coords[coords.length - 1][1] - 10}" text-anchor="middle">€${Math.round(values[values.length - 1])}</text>`;

  container.innerHTML = `
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
      <defs>
        <linearGradient id="netChartGradient" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style="stop-color:var(--accent-red); stop-opacity:0.4" />
          <stop offset="100%" style="stop-color:var(--accent-red); stop-opacity:0" />
        </linearGradient>
      </defs>
      <line class="chart-grid" x1="${PAD_X}" y1="${H - PAD_Y}" x2="${W - PAD_X}" y2="${H - PAD_Y}" />
      <path class="chart-area" d="${areaPath}" />
      <path class="chart-line" d="${linePath}" />
      ${dots}
      ${firstVal}
      ${lastVal}
      ${labels}
    </svg>
  `;
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function renderTimeline(filter) {
  const timeline = $('#timeline');
  if (state.cedolini.length === 0) {
    timeline.innerHTML = '<p class="empty-state">Nessun cedolino salvato ancora. Caricane uno qui sopra per iniziare.</p>';
    return;
  }

  const q = (filter || '').toLowerCase();
  const filtered = q
    ? state.cedolini.filter((c) => monthLabel(c.MeseAnno).toLowerCase().includes(q) || (c.MeseAnno || '').includes(q))
    : state.cedolini;

  if (filtered.length === 0) {
    timeline.innerHTML = '<p class="empty-state">Nessun cedolino trovato per questa ricerca.</p>';
    return;
  }

  timeline.innerHTML = filtered
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
  $('#detailSection').dataset.mese = mese;
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
    <h2 class="detail-title">${monthLabel(c.MeseAnno)}</h2>
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
refreshIcons();
loadCedolini();
