/* =========================================================
   CEDOLINO+ — LOGICA COMPLETA ED ESTRAZIONE
   ========================================================= */

const $ = (sel) => document.querySelector(sel);

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
    webAppUrl: localStorage.getItem('cedolino_webAppUrl') || '',
    accessToken: localStorage.getItem('cedolino_accessToken') || '',
    cedolini: [],
};

let salaryChartInstance = null;

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    if (window.lucide) lucide.createIcons();
    loadCedolini();
});

function refreshIcons() {
    if (window.lucide) lucide.createIcons();
}

function initTheme() {
    const saved = localStorage.getItem('cedolino_theme') || 'dark';
    document.body.setAttribute('data-theme', saved);
    aggiornaIconaTema(saved);
}

$('#themeToggle').addEventListener('click', () => {
    const attuale = document.body.getAttribute('data-theme');
    const nuovo = attuale === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', nuovo);
    localStorage.setItem('cedolino_theme', nuovo);
    aggiornaIconaTema(nuovo);
    if (state.cedolini.length > 0) renderChart();
});

function aggiornaIconaTema(tema) {
    const btn = $('#themeToggle');
    if (btn) {
        btn.innerHTML = tema === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
        refreshIcons();
    }
}

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
    if (!state.webAppUrl) return '';
    try {
        const url = new URL(state.webAppUrl);
        url.searchParams.set('token', state.accessToken);
        Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
        return url.toString();
    } catch (e) {
        return '';
    }
}

function parseNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;

    let str = String(val).trim().replace(/[€$\s]/g, '');
    if (!str) return 0;

    if (str.includes('.') && str.includes(',')) {
        if (str.lastIndexOf(',') > str.lastIndexOf('.')) {
            str = str.replace(/\./g, '').replace(',', '.');
        } else {
            str = str.replace(/,/g, '');
        }
    } else if (str.includes(',')) {
        str = str.replace(',', '.');
    }

    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
}

function formatEuro(val) {
    if (val === '' || val === null || val === undefined) return '0,00 €';
    const num = parseNumber(val);
    return new Intl.NumberFormat('it-IT', {
        style: 'currency',
        currency: 'EUR',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num);
}

function formatOre(val) {
    if (val === '' || val === null || val === undefined) return '0,000 h';
    const num = parseNumber(val);
    return new Intl.NumberFormat('it-IT', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    }).format(num) + ' h';
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
        setStatus('Formato non supportato. Carica un file PDF.', true);
        return;
    }
    setStatus('Analisi del PDF in corso...');
    try {
        const text = await extractTextFromPdf(file);
        if (!text || text.trim().length === 0) {
            setStatus('PDF scansionato senza testo selezionabile. Inserisci i dati manualmente.', true);
            showReview({});
            return;
        }

        const parsed = parseCedolino(text);
        setStatus('Dati estratti con successo! Verifica i campi prima di salvare.');
        showReview(parsed, text);
    } catch (err) {
        console.error(err);
        setStatus('Errore nella lettura del PDF. Inserisci i dati a mano.', true);
        showReview({});
    }
}

function setStatus(msg, isError) {
    const el = $('#uploadStatus');
    el.textContent = msg;
    el.style.color = isError ? 'var(--warn)' : 'var(--text-secondary)';
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

function parseCedolino(text) {
    const norm = text.replace(/\s+/g, ' ');
    const NUM = '\\d+(?:\\.\\d{3})*,\\d+';
    const clean = (s) => (s ? s.replace(/\./g, '').replace(',', '.') : '');
    
    const grab = (re) => {
        const m = norm.match(re);
        return m ? clean(m[1]) : '';
    };

    const netto = grab(/\*{3,}\s*(\d+(?:\.\d{3})*,\d{2})/);
    let lordo = grab(new RegExp(`(?:TOT\\.?\\s*COMPETENZE|TOTALE\\s+COMPETENZE)\\s*[:€]*\\s*(${NUM})`, 'i'));

    const ferieMatur = grab(new RegExp(`FERIE\\s*:?[\\s\\S]*?Matur\\.?\\s*(${NUM})`, 'i'));
    const ferieGodut = grab(new RegExp(`FERIE\\s*:?[\\s\\S]*?Godut[oa]\\s*(${NUM})`, 'i'));
    const ferieSaldo = grab(new RegExp(`FERIE\\s*:?[\\s\\S]*?Saldo\\s*(${NUM})`, 'i'));

    const rolMatur = grab(new RegExp(`R\\.?O\\.?L\\.?\\s*:?[\\s\\S]*?Matur\\.?\\s*(${NUM})`, 'i'));
    const rolGodut = grab(new RegExp(`R\\.?O\\.?L\\.?\\s*:?[\\s\\S]*?Godut[oa]\\s*(${NUM})`, 'i'));
    const rolSaldo = grab(new RegExp(`R\\.?O\\.?L\\.?\\s*:?[\\s\\S]*?Saldo\\s*(${NUM})`, 'i'));
    
    const exFestGodOre = grab(new RegExp(`(?:Ex\\s*fest\\.?\\s*godut[ea]|R\\.?o\\.?l\\.?\\s*\\/?\\s*Ex\\s*fest\\.?\\s*godut[ea])\\s*(${NUM})`, 'i'));
    const exFestGodMatch = norm.match(new RegExp(`(?:Ex\\s*fest\\.?\\s*godut[ea]|R\\.?o\\.?l\\.?\\s*\\/?\\s*Ex\\s*fest\\.?\\s*godut[ea])\\s*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i'));
    const exFestGodEuro = exFestGodMatch ? clean(exFestGodMatch[1]) : '';

    const straOre = grab(new RegExp(`(?:Ore\\s+supplementari|Straordinar[io])(?:\\s*35%)?\\s*(${NUM})`, 'i'));
    const straEuroMatch = norm.match(new RegExp(`(?:Ore\\s+supplementari|Straordinar[io])(?:\\s*35%)?\\s*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i'));
    const straEuro = straEuroMatch ? clean(straEuroMatch[1]) : '';

    const stra50Ore = grab(new RegExp(`(?:Ore\\s+supplementari|Straordinar[io])\\s*50%\\s*(${NUM})`, 'i'));
    const stra50EuroMatch = norm.match(new RegExp(`(?:Ore\\s+supplementari|Straordinar[io])\\s*50%\\s*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i'));
    const stra50Euro = stra50EuroMatch ? clean(stra50EuroMatch[1]) : '';

    const festOre = grab(new RegExp(`(?:Magg\\.?\\s*lav\\.?\\s*fest\\.?|Festiv[io])(?:\\s*50%)?\\s*(${NUM})`, 'i'));
    const festEuroMatch = norm.match(new RegExp(`(?:Magg\\.?\\s*lav\\.?\\s*fest\\.?|Festiv[io])(?:\\s*50%)?\\s*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i'));
    const festEuro = festEuroMatch ? clean(festEuroMatch[1]) : '';

    const nott25Ore = grab(new RegExp(`(?:Magg\\.?\\s*lav\\.?\\s*notturn[oa]|Notturn[oa])(?:\\s*25%)?\\s*(${NUM})`, 'i'));
    const nott25EuroMatch = norm.match(new RegExp(`(?:Magg\\.?\\s*lav\\.?\\s*notturn[oa]|Notturn[oa])(?:\\s*25%)?\\s*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i'));
    const nott25Euro = nott25EuroMatch ? clean(nott25EuroMatch[1]) : '';

    const festNonGodOre = grab(new RegExp(`(?:Festivit[àa]\\s+non\\s+goduta)\\s*(${NUM})`, 'i'));
    const festNonGodMatch = norm.match(new RegExp(`(?:Festivit[àa]\\s+non\\s+goduta)\\s*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i'));
    const festNonGodEuro = festNonGodMatch ? clean(festNonGodMatch[1]) : grab(new RegExp(`(?:Festivit[àa]\\s+non\\s+goduta)\\s*[:€]*\\s*(${NUM})`, 'i'));

    const premioRis = grab(new RegExp(`(?:Premio\\s+Risultato|Premio\\s+di\\s+risultato)\\s*[:€]*\\s*(${NUM})`, 'i'));

    const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
    const meseMatch = norm.match(new RegExp(`\\b(${MESI.join('|')})\\s+(\\d{4})\\b`, 'i'));
    const meseAnno = meseMatch ? `${meseMatch[2]}-${String(MESI.indexOf(meseMatch[1].toLowerCase()) + 1).padStart(2, '0')}` : '';

    return {
        MeseAnno: meseAnno,
        Netto: netto,
        Lordo: lordo,
        FerieResidue: ferieSaldo,
        FerieMaturateMese: ferieMatur,
        FerieGoduteMese: ferieGodut,
        RolResiduo: rolSaldo,
        RolMaturatoMese: rolMatur,
        RolGodutoMese: rolGodut,
        ExFestGoduteOre: exFestGodOre,
        ExFestGoduteEuro: exFestGodEuro,
        StraordinariOre: straOre,
        StraordinariEuro: straEuro,
        Straordinari50Ore: stra50Ore,
        Straordinari50Euro: stra50Euro,
        FestiviOre: festOre,
        FestiviEuro: festEuro,
        Notturno25Ore: nott25Ore,
        Notturno25Euro: nott25Euro,
        FestivitaNonGodutaOre: festNonGodOre,
        FestivitaNonGodutaEuro: festNonGodEuro,
        PremioRisultato: premioRis,
        Tredicesima: grab(new RegExp(`tredicesima\\s*[:€]*\\s*(${NUM})`, 'i')),
        Quattordicesima: grab(new RegExp(`quattordicesima\\s*[:€]*\\s*(${NUM})`, 'i')),
        TFRAccantonato: grab(new RegExp(`t\\.?f\\.?r\\.?\\s+accantonat[oa]\\s*[:]*\\s*(${NUM})`, 'i')),
        Extra: '',
        NoteExtra: '',
    };
}

function showReview(data, rawText) {
    $('#reviewSection').classList.remove('hidden');
    const form = $('#reviewForm');

    Object.entries(data).forEach(([key, value]) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input) {
            input.value = value !== undefined && value !== null ? value : '';
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
        alert('Configura prima l\'URL nelle Impostazioni Cloud (icona ingranaggio).');
        return;
    }

    try {
        setStatus('Salvataggio in corso...');
        await fetch(apiUrl({ action: 'save', data: JSON.stringify(payload) }));
        $('#reviewSection').classList.add('hidden');
        form.reset();
        fileInput.value = '';
        setStatus('Cedolino salvato con successo!');
        loadCedolini();
    } catch (err) {
        console.error(err);
        setStatus('Errore durante il salvataggio.', true);
    }
});

async function loadCedolini() {
    const timeline = $('#timeline');
    if (!state.webAppUrl) {
        timeline.innerHTML = '<p class="empty-state">Configura l\'URL Google Apps Script nelle impostazioni per caricare i dati.</p>';
        return;
    }

    try {
        const res = await fetch(apiUrl());
        const data = await res.json();

        if (data && data.status === 'unauthorized') {
            timeline.innerHTML = '<p class="empty-state">Token/PIN d\'accesso non valido.</p>';
            return;
        }

        state.cedolini = (data || []).sort((a, b) => (a.MeseAnno < b.MeseAnno ? 1 : -1));
        renderStats();
        renderChart();
        renderTimeline();
    } catch (err) {
        console.error(err);
        timeline.innerHTML = '<p class="empty-state">Impossibile connettersi al server Cloud.</p>';
    }
}

function renderStats() {
    const row = $('#statsRow');
    if (state.cedolini.length === 0) {
        row.innerHTML = '';
        return;
    }

    const last = state.cedolini[0];
    const prev = state.cedolini[1];

    let deltaHtml = '';
    if (prev && last.Netto && prev.Netto) {
        const diff = parseNumber(last.Netto) - parseNumber(prev.Netto);
        if (diff !== 0) {
            const perc = ((diff / parseNumber(prev.Netto)) * 100).toFixed(1);
            const isUp = diff > 0;
            deltaHtml = `<div class="stat-delta ${isUp ? 'up' : 'down'}">
                <i data-lucide="${isUp ? 'trending-up' : 'trending-down'}" style="width:14px;height:14px;"></i>
                ${isUp ? '+' : ''}${formatEuro(diff)} (${isUp ? '+' : ''}${perc}%)
            </div>`;
        }
    }

    const annoCorrente = last.MeseAnno ? last.MeseAnno.split('-')[0] : new Date().getFullYear().toString();
    const totaleAnno = state.cedolini
        .filter((c) => c.MeseAnno && c.MeseAnno.startsWith(annoCorrente))
        .reduce((acc, c) => acc + parseNumber(c.Netto), 0);

    row.innerHTML = `
        <div class="stat-box accent-red">
            <div class="stat-label">Ultimo Netto (${monthLabel(last.MeseAnno)})</div>
            <div class="stat-value">${formatEuro(last.Netto)}</div>
            ${deltaHtml}
        </div>
        <div class="stat-box accent-green">
            <div class="stat-label">Totale Netto ${annoCorrente}</div>
            <div class="stat-value">${formatEuro(totaleAnno)}</div>
        </div>
        <div class="stat-box accent-blue">
            <div class="stat-label">Ferie Saldo</div>
            <div class="stat-value">${formatOre(last.FerieResidue)}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">ROL Saldo</div>
            <div class="stat-value">${formatOre(last.RolResiduo)}</div>
        </div>
    `;

    refreshIcons();
}

function renderChart() {
    const ctx = document.getElementById('salaryChart');
    if (!ctx) return;

    const sortedAsc = [...state.cedolini].sort((a, b) => (a.MeseAnno > b.MeseAnno ? 1 : -1));
    const labels = sortedAsc.map((c) => monthLabel(c.MeseAnno));
    const netData = sortedAsc.map((c) => parseNumber(c.Netto));
    const grossData = sortedAsc.map((c) => parseNumber(c.Lordo));

    const isLight = document.body.getAttribute('data-theme') === 'light';
    const textColor = isLight ? '#475569' : '#94A3B8';
    const gridColor = isLight ? '#E2E8F0' : 'rgba(255, 255, 255, 0.06)';

    if (salaryChartInstance) {
        salaryChartInstance.destroy();
    }

    salaryChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Netto (€)',
                    data: netData,
                    borderColor: '#F43F5E',
                    backgroundColor: 'rgba(244, 63, 94, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3
                },
                {
                    label: 'Lordo (€)',
                    data: grossData,
                    borderColor: '#3B82F6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    borderWidth: 2,
                    borderDash: [4, 4],
                    fill: false,
                    tension: 0.3
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: {
                        color: textColor,
                        font: { family: "'Plus Jakarta Sans', sans-serif", weight: '600' }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatEuro(context.raw);
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor },
                    grid: { color: gridColor }
                },
                y: {
                    ticks: {
                        color: textColor,
                        callback: function(value) { return value + ' €'; }
                    },
                    grid: { color: gridColor }
                }
            }
        }
    });
}

$('#searchInput').addEventListener('input', (e) => {
    renderTimeline(e.target.value.trim().toLowerCase());
});

function renderTimeline(filtro = '') {
    const timeline = $('#timeline');
    if (state.cedolini.length === 0) {
        timeline.innerHTML = '<p class="empty-state">Nessun cedolino presente nel database.</p>';
        return;
    }

    const filtrati = state.cedolini.filter((c) => {
        if (!filtro) return true;
        return monthLabel(c.MeseAnno).toLowerCase().includes(filtro) || c.MeseAnno.includes(filtro);
    });

    if (filtrati.length === 0) {
        timeline.innerHTML = '<p class="empty-state">Nessun risultato trovato.</p>';
        return;
    }

    timeline.innerHTML = `<div class="timeline-grid">` + filtrati
        .map(
            (c) => `
            <div class="stub-card" data-mese="${c.MeseAnno}">
                <div class="stub-header">
                    <div class="stub-month">${monthLabel(c.MeseAnno)}</div>
                    <div class="stub-net">${formatEuro(c.Netto)}</div>
                </div>
                <div class="stub-details">
                    <div class="stub-details-row"><span>Ferie Saldo:</span> <b>${formatOre(c.FerieResidue)}</b></div>
                    <div class="stub-details-row"><span>ROL Saldo:</span> <b>${formatOre(c.RolResiduo)}</b></div>
                    <div class="stub-details-row"><span>Lordo:</span> <b>${formatEuro(c.Lordo)}</b></div>
                </div>
            </div>`
        )
        .join('') + `</div>`;

    timeline.querySelectorAll('.stub-card').forEach((el) => {
        el.addEventListener('click', () => showDetail(el.dataset.mese));
    });
}

function showDetail(mese) {
    const c = state.cedolini.find((x) => x.MeseAnno === mese);
    if (!c) return;

    $('#detailSection').dataset.mese = mese;

    const coppieAffiancate = [
        ['StraordinariOre', 'StraordinariEuro', 'Ore Supplementari 35%'],
        ['Straordinari50Ore', 'Straordinari50Euro', 'Ore Supplementari 50%'],
        ['FestiviOre', 'FestiviEuro', 'Magg. Lav. Festivo 50%'],
        ['Notturno25Ore', 'Notturno25Euro', 'Magg. Lav. Notturno 25%'],
        ['FestivitaNonGodutaOre', 'FestivitaNonGodutaEuro', 'Festività non goduta'],
        ['ExFestGoduteOre', 'ExFestGoduteEuro', 'R.o.L. / Ex Fest. Godute'],
    ];

    const htmlCoppie = coppieAffiancate
        .map(([kOre, kEuro, titolo]) => `
            <div class="paired-detail-card">
                <div class="paired-detail-title">${titolo}</div>
                <div class="paired-detail-values">
                    <div><span class="label">Ore:</span><span class="val">${formatOre(c[kOre])}</span></div>
                    <div><span class="label">Importo:</span><span class="val">${formatEuro(c[kEuro])}</span></div>
                </div>
            </div>
        `).join('');

    $('#detailContent').innerHTML = `
        <h2 class="section-title"><i data-lucide="calendar"></i> Cedolino di ${monthLabel(c.MeseAnno)}</h2>
        
        <div class="form-section">
            <div class="form-section-title"><i data-lucide="wallet"></i> Retribuzione</div>
            <div class="detail-grid">
                <div class="detail-row"><span>Netto in Busta</span><span class="val">${formatEuro(c.Netto)}</span></div>
                <div class="detail-row"><span>Lordo / Tot. Competenze</span><span class="val">${formatEuro(c.Lordo)}</span></div>
            </div>
        </div>

        <div class="form-section">
            <div class="form-section-title"><i data-lucide="palmtree"></i> Ferie & R.O.L.</div>
            <div class="detail-grid">
                <div class="detail-row"><span>Ferie Maturate (Mese)</span><span class="val">${formatOre(c.FerieMaturateMese)}</span></div>
                <div class="detail-row"><span>Ferie Godute (Mese)</span><span class="val">${formatOre(c.FerieGoduteMese)}</span></div>
                <div class="detail-row"><span>Ferie Saldo / Residuo</span><span class="val">${formatOre(c.FerieResidue)}</span></div>
                <div class="detail-row"><span>ROL Maturato (Mese)</span><span class="val">${formatOre(c.RolMaturatoMese)}</span></div>
                <div class="detail-row"><span>ROL Goduto (Mese)</span><span class="val">${formatOre(c.RolGodutoMese)}</span></div>
                <div class="detail-row"><span>ROL Saldo / Residuo</span><span class="val">${formatOre(c.RolResiduo)}</span></div>
            </div>
        </div>

        <div class="form-section">
            <div class="form-section-title"><i data-lucide="clock"></i> Maggiorazioni & Straordinari</div>
            <div class="paired-grid">${htmlCoppie}</div>
        </div>

        <div class="form-section">
            <div class="form-section-title"><i data-lucide="gift"></i> Premi & Altri Compensi</div>
            <div class="detail-grid">
                <div class="detail-row"><span>Premio Risultato</span><span class="val">${formatEuro(c.PremioRisultato)}</span></div>
                <div class="detail-row"><span>Tredicesima</span><span class="val">${formatEuro(c.Tredicesima)}</span></div>
                <div class="detail-row"><span>Quattordicesima</span><span class="val">${formatEuro(c.Quattordicesima)}</span></div>
                <div class="detail-row"><span>TFR Accantonato</span><span class="val">${formatEuro(c.TFRAccantonato)}</span></div>
                <div class="detail-row"><span>Extra</span><span class="val">${formatEuro(c.Extra)}</span></div>
                <div class="detail-row"><span>Note</span><span class="val">${c.NoteExtra || '—'}</span></div>
            </div>
        </div>
    `;

    $('#detailSection').classList.remove('hidden');
    refreshIcons();
    $('#detailSection').scrollIntoView({ behavior: 'smooth' });
}

$('#editDetail').addEventListener('click', () => {
    const mese = $('#detailSection').dataset.mese;
    const c = state.cedolini.find((x) => x.MeseAnno === mese);
    if (!c) return;

    showReview(c);
    $('#detailSection').classList.add('hidden');
    setStatus(`Modifica in corso per il cedolino di ${monthLabel(mese)}. Clicca su Salva per aggiornare.`);
});

$('#closeDetail').addEventListener('click', () => {
    $('#detailSection').classList.add('hidden');
});

$('#copySummaryBtn').addEventListener('click', () => {
    const mese = $('#detailSection').dataset.mese;
    const c = state.cedolini.find((x) => x.MeseAnno === mese);
    if (!c) return;

    const testo = `📄 Cedolino ${monthLabel(c.MeseAnno)}
----------------------------
💰 Netto: ${formatEuro(c.Netto)}
📊 Lordo: ${formatEuro(c.Lordo)}
🏖️ Ferie Saldo: ${formatOre(c.FerieResidue)}
⏱️ ROL Saldo: ${formatOre(c.RolResiduo)}
⚡ Extra/Maggiorazioni: ${formatEuro(c.StraordinariEuro)}
🏆 Premio Risultato: ${formatEuro(c.PremioRisultato)}
🏦 TFR Accantonato: ${formatEuro(c.TFRAccantonato)}`;

    navigator.clipboard.writeText(testo).then(() => {
        alert('Riepilogo copiato negli appunti!');
    });
});

$('#deleteDetail').addEventListener('click', async () => {
    const mese = $('#detailSection').dataset.mese;
    if (!mese) return;
    if (!confirm(`Vuoi eliminare definitivamente il cedolino di ${monthLabel(mese)}?`)) return;

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

function monthLabel(meseAnno) {
    if (!meseAnno) return '';
    const parti = meseAnno.split('-');
    if (parti.length !== 2) return meseAnno;
    const mesi = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
    return `${mesi[parseInt(parti[1], 10) - 1]} ${parti[0]}`;
}