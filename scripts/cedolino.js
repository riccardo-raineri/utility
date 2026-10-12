// ---------- Config & Stato ----------
const $ = (sel) => document.querySelector(sel);

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
  webAppUrl: localStorage.getItem('cedolino_webAppUrl') || '',
  accessToken: localStorage.getItem('cedolino_accessToken') || '',
  cedolini: [],
};

// ---------- Utility Valori e Numeri ----------
function parseNum(v) {
  if (v === '' || v === undefined || v === null) return 0;
  const str = String(v).replace(/\./g, '').replace(',', '.');
  const n = parseFloat(str);
  return isNaN(n) ? 0 : n;
}

function fmt(v) {
  if (v === '' || v === undefined || v === null) return '0,00';
  const str = String(v).replace(',', '.');
  const n = parseFloat(str);
  return isNaN(n) ? String(v) : n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function monthLabel(meseAnno) {
  if (!meseAnno) return '';
  const [y, m] = meseAnno.split('-');
  const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
  return `${mesi[parseInt(m, 10) - 1]} ${y}`;
}

// ---------- Inizializzazione e Tema ----------
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

// ---------- Caricamento e Parsing PDF ----------
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
    setStatus('Formato non supportato. Seleziona un file PDF.', true);
    return;
  }
  if (!state.webAppUrl || !state.accessToken) {
    setStatus('Configura prima URL e Token nelle impostazioni.', true);
    return;
  }

  setStatus('Estrazione testo dal PDF...');
  let text;
  try {
    text = await extractTextFromPdf(file);
  } catch (err) {
    console.error(err);
    setStatus('Impossibile leggere il PDF. Inserisci i dati manualmente.', true);
    showReview({});
    return;
  }

  if (!text || !text.trim()) {
    setStatus('PDF privo di testo selezionabile. Inserisci i dati a mano.', true);
    showReview({});
    return;
  }

  setStatus('Riconoscimento con AI (gemini-3.6-flash)...');
  try {
    const result = await parseCedolinoWithAI(text);
    if (result.status === 'ok') {
      setStatus('Dati estratti con successo! Verificali e salva.');
      showReview(result.fields, text);
    } else {
      setStatus(`Errore AI: ${result.message || 'Errore sconosciuto'}. Compila a mano.`, true);
      showReview({}, text);
    }
  } catch (err) {
    console.error(err);
    setStatus('Chiamata AI fallita. Compila i campi a mano.', true);
    showReview({}, text);
  }
}

async function parseCedolinoWithAI(text) {
  const res = await fetch(state.webAppUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
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

// ---------- Revisione e Salvataggio ----------
function showReview(data, rawText) {
  $('#reviewSection').classList.remove('hidden');
  const form = $('#reviewForm');
  
  Object.entries(data).forEach(([key, value]) => {
    const input = form.querySelector(`[name="${key}"]`);
    if (input && value !== undefined) {
      if (input.type === 'number' && typeof value === 'string') {
        input.value = value.replace(',', '.');
      } else {
        input.value = value;
      }
    }
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
    alert('Configura l\'URL Web App nelle impostazioni.');
    return;
  }

  try {
    await fetch(apiUrl({ action: 'save', data: JSON.stringify(payload) }));
    $('#reviewSection').classList.add('hidden');
    form.reset();
    fileInput.value = '';
    setStatus('Cedolino salvato con successo.');
    loadCedolini();
  } catch (err) {
    console.error(err);
    setStatus('Errore durante il salvataggio.', true);
  }
});

// ---------- Dashboard & Statistiche ----------
$('#refreshBtn').addEventListener('click', loadCedolini);
$('#closeDetail').addEventListener('click', () => $('#detailSection').classList.add('hidden'));

$('#deleteDetail').addEventListener('click', async () => {
  const mese = $('#detailSection').dataset.mese;
  if (!mese) return;
  if (!confirm(`Eliminare il cedolino di ${monthLabel(mese)}?`)) return;

  try {
    await fetch(apiUrl({ action: 'delete', mese }));
    $('#detailSection').classList.add('hidden');
    setStatus('Cedolino eliminato.');
    loadCedolini();
  } catch (err) {
    console.error(err);
    alert('Errore durante l\'eliminazione.');
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
      timeline.innerHTML = '<p class="empty-state">Token non valido. Verifica nelle impostazioni.</p>';
      return;
    }
    state.cedolini = data.sort((a, b) => (a.MeseAnno < b.MeseAnno ? 1 : -1));
    renderTimeline();
    renderStats();
    renderInteractiveChart();
  } catch (err) {
    console.error(err);
    timeline.innerHTML = '<p class="empty-state">Impossibile caricare i dati. Controlla la connessione.</p>';
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
    if (!prev) return '';
    const d = parseNum(a) - parseNum(b);
    if (d === 0) return '';
    return `<div class="stat-delta ${d > 0 ? 'up' : 'down'}"><i data-lucide="${d > 0 ? 'arrow-up-right' : 'arrow-down-right'}"></i>${d > 0 ? '+' : ''}${fmt(d)} € vs mese prec.</div>`;
  };

  const netti = state.cedolini.map((c) => parseNum(c.Netto)).filter((n) => n > 0);
  const mediaNett = netti.length ? netti.reduce((a, b) => a + b, 0) / netti.length : 0;

  row.innerHTML = `
    <div class="stat-box">
      <div class="stat-label">Netto Ultimo Mese</div>
      <div class="stat-value">€ ${fmt(last.Netto)}</div>
      ${delta(last.Netto, prev ? prev.Netto : null)}
    </div>
    <div class="stat-box">
      <div class="stat-label">Ferie Residue</div>
      <div class="stat-value">${fmt(last.FerieResidue)} gg</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">ROL Residuo</div>
      <div class="stat-value">${fmt(last.RolResiduo)} h</div>
    </div>
    <div class="stat-box">
      <div class="stat-label">Media Netto Storica</div>
      <div class="stat-value">€ ${fmt(mediaNett)}</div>
    </div>
  `;
  refreshIcons();
}

// ---------- Grafico Interattivo ----------
function renderInteractiveChart() {
  const card = $('#chartCard');
  const container = $('#netChart');

  const points = state.cedolini
    .filter((c) => c.MeseAnno && c.Netto)
    .slice()
    .sort((a, b) => (a.MeseAnno > b.MeseAnno ? 1 : -1));

  if (points.length < 2) {
    card.classList.add('hidden');
    return;
  }
  card.classList.remove('hidden');

  const W = 640, H = 190, PAD_X = 40, PAD_Y = 30;
  const values = points.map((p) => parseNum(p.Netto));
  const min = Math.min(...values) * 0.95;
  const max = Math.max(...values) * 1.05;
  const range = max - min || 1;

  const stepX = (W - PAD_X * 2) / (points.length - 1);
  const coords = values.map((v, i) => {
    const x = PAD_X + i * stepX;
    const y = H - PAD_Y - ((v - min) / range) * (H - PAD_Y * 2);
    return { x, y, val: v, month: points[i].MeseAnno, raw: points[i] };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L${coords[coords.length - 1].x.toFixed(1)},${H - PAD_Y} L${coords[0].x.toFixed(1)},${H - PAD_Y} Z`;

  const dotsSvg = coords
    .map((c, i) => `<circle class="chart-dot" data-idx="${i}" cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="5" style="cursor:pointer; transition: transform 0.2s;"></circle>`)
    .join('');

  const labelsSvg = coords
    .map((c, i) => {
      if (points.length > 8 && i % Math.ceil(points.length / 6) !== 0 && i !== points.length - 1) return '';
      return `<text class="chart-label" x="${c.x.toFixed(1)}" y="${H - 8}" text-anchor="middle">${monthLabel(c.month).split(' ')[0].slice(0, 3)}</text>`;
    })
    .join('');

  container.innerHTML = `
    <div style="position: relative;">
      <div id="chartTooltip" class="hidden" style="position: absolute; background: var(--card-bg); border: 1px solid var(--accent-red-border); padding: 8px 12px; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 12px; color: var(--text-primary); pointer-events: none; box-shadow: var(--shadow-md); z-index: 10;"></div>
      <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" id="chartSvg" style="width:100%; height:auto;">
        <defs>
          <linearGradient id="netChartGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style="stop-color:var(--accent-red); stop-opacity:0.35" />
            <stop offset="100%" style="stop-color:var(--accent-red); stop-opacity:0" />
          </linearGradient>
        </defs>
        <line class="chart-grid" x1="${PAD_X}" y1="${H - PAD_Y}" x2="${W - PAD_X}" y2="${H - PAD_Y}" />
        <line id="crosshairLine" class="hidden" stroke="var(--text-tertiary)" stroke-dasharray="3,3" y1="${PAD_Y}" y2="${H - PAD_Y}" />
        <path class="chart-area" d="${areaPath}" />
        <path class="chart-line" d="${linePath}" />
        ${dotsSvg}
        ${labelsSvg}
      </svg>
    </div>
  `;

  // Interattività Tooltip
  const svg = $('#chartSvg');
  const tooltip = $('#chartTooltip');
  const crosshair = $('#crosshairLine');

  svg.addEventListener('mousemove', (e) => {
    const rect = svg.getBoundingClientRect();
    const mouseX = ((e.clientX - rect.left) / rect.width) * W;

    let closest = coords[0];
    let minDiff = Math.abs(mouseX - coords[0].x);
    coords.forEach((c) => {
      const diff = Math.abs(mouseX - c.x);
      if (diff < minDiff) {
        minDiff = diff;
        closest = c;
      }
    });

    crosshair.setAttribute('x1', closest.x);
    crosshair.setAttribute('x2', closest.x);
    crosshair.classList.remove('hidden');

    const tooltipX = (closest.x / W) * rect.width;
    const tooltipY = (closest.y / H) * rect.height - 40;

    tooltip.style.left = `${Math.min(Math.max(tooltipX - 50, 10), rect.width - 120)}px`;
    tooltip.style.top = `${Math.max(tooltipY, 10)}px`;
    tooltip.innerHTML = `<strong>${monthLabel(closest.month)}</strong><br/>Netto: € ${fmt(closest.val)}`;
    tooltip.classList.remove('hidden');
  });

  svg.addEventListener('mouseleave', () => {
    tooltip.classList.add('hidden');
    crosshair.classList.add('hidden');
  });

  svg.querySelectorAll('.chart-dot').forEach((dot) => {
    dot.addEventListener('click', (e) => {
      const idx = e.target.getAttribute('data-idx');
      showDetail(coords[idx].month);
    });
  });
}

function refreshIcons() {
  if (window.lucide) window.lucide.createIcons();
}

// ---------- Timeline & Dettagli ----------
function renderTimeline(filter) {
  const timeline = $('#timeline');
  if (state.cedolini.length === 0) {
    timeline.innerHTML = '<p class="empty-state">Nessun cedolino salvato ancora. Caricane uno per iniziare.</p>';
    return;
  }

  const q = (filter || '').toLowerCase();
  const filtered = q
    ? state.cedolini.filter((c) => monthLabel(c.MeseAnno).toLowerCase().includes(q) || (c.MeseAnno || '').includes(q))
    : state.cedolini;

  if (filtered.length === 0) {
    timeline.innerHTML = '<p class="empty-state">Nessun cedolino trovato per la ricerca.</p>';
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
        <div class="detail-row">
          <span>${label}</span>
          <span class="val">${key === 'NoteExtra' ? (c[key] || '—') : fmt(c[key])}</span>
        </div>`
        )
        .join('')}
    </div>
  `;
  
  $('#detailSection').classList.remove('hidden');
  $('#detailSection').scrollIntoView({ behavior: 'smooth' });
}

// ---------- Init ----------
initTheme();
refreshIcons();
loadCedolini();