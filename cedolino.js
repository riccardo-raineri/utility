/* =========================================================
   CEDOLINO+ — LOGICA ED ESTRAZIONE
   ========================================================= */

const $ = (sel) => document.querySelector(sel);

// Worker src obbligatorio per PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const state = {
    webAppUrl: localStorage.getItem('cedolino_webAppUrl') || '',
    accessToken: localStorage.getItem('cedolino_accessToken') || '',
    cedolini: [],
};

// ---------- INIT & ICONE LUCIDE ----------
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    if (window.lucide) lucide.createIcons();
    loadCedolini();
});

function refreshIcons() {
    if (window.lucide) lucide.createIcons();
}

// ---------- TEMA CHIARO / SCURO ----------
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
});

function aggiornaIconaTema(tema) {
    const btn = $('#themeToggle');
    if (btn) {
        btn.innerHTML = tema === 'dark' ? '<i data-lucide="sun"></i>' : '<i data-lucide="moon"></i>';
        refreshIcons();
    }
}

// ---------- SETTINGS PANEL ----------
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

// ---------- PARSER NUMERICO / VALUTA ITALIANA (FIX "00") ----------
function parseNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;

    let str = String(val).trim().replace(/[€$\s]/g, '');
    if (!str) return 0;

    // Gestione formato italiano (1.234,56) vs US (1234.56)
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
    if (val === '' || val === null || val === undefined) return '0 h';
    const num = parseNumber(val);
    return new Intl.NumberFormat('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(num) + ' h';
}

// ---------- DRAG & DROP & UPLOAD ----------
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
        const anyFieldFound = Object.values(parsed).some((v) => v !== '');

        if (anyFieldFound) {
            setStatus('Dati estratti con successo! Verifica i campi e salva.');
        } else {
            setStatus('Nessun campo riconosciuto automaticamente. Compila i dati a mano.', true);
        }
        showReview(parsed, text);
    } catch (err) {
        console.error(err);
        setStatus('Errore nella lettura del PDF. Compila i dati a mano qui sotto.', true);
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

// ---------- REGEX PARSER CEDOLINO ----------
function parseCedolino(text) {
    const norm = text.replace(/\s+/g, ' ');
    const NUM = '\\d+(?:\\.\\d{3})*,\\d+';
    const clean = (s) => (s ? s.replace(/\./g, '').replace(',', '.') : '');
    const grab = (re) => {
        const m = norm.match(re);
        return m ? clean(m[1]) : '';
    };

    const netto = grab(/\*{3,}\s*(\d+(?:\.\d{3})*,\d{2})/);
    const ferieSaldo = grab(new RegExp(`FERIE\\s*:?[\\s\\S]*?Saldo\\s*(${NUM})`, 'i'));
    const ferieMatur = grab(new RegExp(`FERIE\\s*:?[\\s\\S]*?Matur\\.?\\s*(${NUM})`, 'i'));
    const rolSaldo = grab(new RegExp(`R\\.?O\\.?L\\.?\\s*:?[\\s\\S]*?Saldo\\s*(${NUM})`, 'i'));
    const rolMatur = grab(new RegExp(`R\\.?O\\.?L\\.?\\s*:?[\\s\\S]*?Matur\\.?\\s*(${NUM})`, 'i'));
    const assemSaldo = grab(new RegExp(`ASSEM\\s*:?[\\s\\S]*?Saldo\\s*(${NUM})`, 'i'));

    const straOre = grab(new RegExp(`ore\\s+supplementari\\s+\\d+%?\\s*p\\.?t\\.?\\s*(${NUM})`, 'i'));
    const straEuroMatch = norm.match(
        new RegExp(`ore\\s+supplementari\\s+\\d+%?\\s*p\\.?t\\.?\\s*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i')
    );
    const straEuro = straEuroMatch ? clean(straEuroMatch[1]) : '';

    const lordoTriple = norm.match(new RegExp(`(${NUM})\\s+(${NUM})\\s+\\1(?!\\d)`));
    let lordo = lordoTriple ? clean(lordoTriple[2]) : '';

    const MESI = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];
    const meseMatch = norm.match(new RegExp(`\\b(${MESI.join('|')})\\s+(\\d{4})\\b`, 'i'));
    const meseAnno = meseMatch ? `${meseMatch[2]}-${String(MESI.indexOf(meseMatch[1].toLowerCase()) + 1).padStart(2, '0')}` : '';

    return {
        MeseAnno: meseAnno,
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
        NoteExtra: assemSaldo ? `Permessi/ASSEM residui: ${assemSaldo} h` : '',
    };
}

// ---------- FORM REVISIONE ----------
function showReview(data, rawText) {
    $('#reviewSection').classList.remove('hidden');
    const form = $('#reviewForm');

    Object.entries(data).forEach(([key, value]) => {
        const input = form.querySelector(`[name="${key}"]`);
        if (input && value !== undefined) {
            input.value = value;
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
        alert('Imposta prima l\'URL della Web App nelle Impostazioni Cloud (icona ingranaggio in alto).');
        return;
    }

    try {
        setStatus('Salvataggio su Google Sheets in corso...');
        await fetch(apiUrl({ action: 'save', data: JSON.stringify(payload) }));
        $('#reviewSection').classList.add('hidden');
        form.reset();
        fileInput.value = '';
        setStatus('Cedolino salvato con successo!');
        loadCedolini();
    } catch (err) {
        console.error(err);
        setStatus('Errore durante il salvataggio. Verifica le impostazioni.', true);
    }
});

// ---------- CARICAMENTO E DASHBOARD ----------
async function loadCedolini() {
    const timeline = $('#timeline');
    if (!state.webAppUrl) {
        timeline.innerHTML = '<p class="empty-state">Configura l\'URL Google Apps Script nelle impostazioni per visualizzare i tuoi cedolini.</p>';
        return;
    }

    try {
        const res = await fetch(apiUrl());
        const data = await res.json();

        if (data && data.status === 'unauthorized') {
            timeline.innerHTML = '<p class="empty-state">Token/PIN non valido. Verifica le impostazioni.</p>';
            return;
        }

        state.cedolini = (data || []).sort((a, b) => (a.MeseAnno < b.MeseAnno ? 1 : -1));
        renderStats();
        renderTimeline();
    } catch (err) {
        console.error(err);
        timeline.innerHTML = '<p class="empty-state">Impossibile caricare i dati dal server Cloud.</p>';
    }
}

// ---------- KPI STATS (CON CALCOLO ANNO E DELTA) ----------
function renderStats() {
    const row = $('#statsRow');
    if (state.cedolini.length === 0) {
        row.innerHTML = '';
        return;
    }

    const last = state.cedolini[0];
    const prev = state.cedolini[1];

    // Delta rispetto al mese precedente
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

    // Totale Guadagnato Anno Corrente (YTD)
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
            <div class="stat-label">Ferie Residue</div>
            <div class="stat-value">${formatOre(last.FerieResidue)}</div>
        </div>
        <div class="stat-box">
            <div class="stat-label">ROL Residuo</div>
            <div class="stat-value">${formatOre(last.RolResiduo)}</div>
        </div>
    `;

    refreshIcons();
}

// ---------- SEARCH & TIMELINE ----------
$('#searchInput').addEventListener('input', (e) => {
    renderTimeline(e.target.value.trim().toLowerCase());
});

function renderTimeline(filtro = '') {
    const timeline = $('#timeline');
    if (state.cedolini.length === 0) {
        timeline.innerHTML = '<p class="empty-state">Nessun cedolino salvato finora. Caricane uno per iniziare.</p>';
        return;
    }

    const filtrati = state.cedolini.filter((c) => {
        if (!filtro) return true;
        const etichettaMese = monthLabel(c.MeseAnno).toLowerCase();
        return etichettaMese.includes(filtro) || c.MeseAnno.includes(filtro);
    });

    if (filtrati.length === 0) {
        timeline.innerHTML = '<p class="empty-state">Nessun cedolino corrisponde alla ricerca.</p>';
        return;
    }

    timeline.innerHTML = filtrati
        .map(
            (c) => `
            <div class="stub" data-mese="${c.MeseAnno}">
                <div>
                    <div class="stub-month">${monthLabel(c.MeseAnno)}</div>
                    <div class="stub-meta">Ferie: <b>${formatOre(c.FerieResidue)}</b> · ROL: <b>${formatOre(c.RolResiduo)}</b></div>
                </div>
                <div class="stub-net">${formatEuro(c.Netto)}</div>
            </div>`
        )
        .join('');

    timeline.querySelectorAll('.stub').forEach((el) => {
        el.addEventListener('click', () => showDetail(el.dataset.mese));
    });
}

// ---------- DETTAGLIO CEDOLINO ----------
function showDetail(mese) {
    const c = state.cedolini.find((x) => x.MeseAnno === mese);
    if (!c) return;

    $('#detailSection').dataset.mese = mese;

    const campiMostrati = [
        ['Netto', 'Netto in Busta', 'euro'],
        ['Lordo', 'Lordo', 'euro'],
        ['FerieResidue', 'Ferie Residue', 'ore'],
        ['FerieMaturateMese', 'Ferie Maturate (Mese)', 'ore'],
        ['RolResiduo', 'ROL Residuo', 'ore'],
        ['RolMaturatoMese', 'ROL Maturato (Mese)', 'ore'],
        ['StraordinariOre', 'Straordinari', 'ore'],
        ['StraordinariEuro', 'Straordinari', 'euro'],
        ['Tredicesima', 'Tredicesima', 'euro'],
        ['Quattordicesima', 'Quattordicesima', 'euro'],
        ['TFRAccantonato', 'TFR Accantonato', 'euro'],
        ['Extra', 'Extra', 'euro'],
        ['NoteExtra', 'Note', 'testo'],
    ];

    const htmlRighe = campiMostrati
        .map(([key, label, tipo]) => {
            let valFormatted = '—';
            if (c[key] !== '' && c[key] !== undefined && c[key] !== null) {
                if (tipo === 'euro') valFormatted = formatEuro(c[key]);
                else if (tipo === 'ore') valFormatted = formatOre(c[key]);
                else valFormatted = c[key];
            }
            return `<div class="detail-row"><span>${label}</span><span class="val">${valFormatted}</span></div>`;
        })
        .join('');

    $('#detailContent').innerHTML = `
        <h2 class="section-title"><i data-lucide="calendar"></i> Cedolino di ${monthLabel(c.MeseAnno)}</h2>
        <div class="detail-grid">${htmlRighe}</div>
    `;

    $('#detailSection').classList.remove('hidden');
    refreshIcons();
    $('#detailSection').scrollIntoView({ behavior: 'smooth' });
}

$('#closeDetail').addEventListener('click', () => {
    $('#detailSection').classList.add('hidden');
});

// QoL: COPIA RIEPILOGO NEGLI APPUNTI
$('#copySummaryBtn').addEventListener('click', () => {
    const mese = $('#detailSection').dataset.mese;
    const c = state.cedolini.find((x) => x.MeseAnno === mese);
    if (!c) return;

    const testo = `📄 Cedolino ${monthLabel(c.MeseAnno)}
----------------------------
💰 Netto: ${formatEuro(c.Netto)}
📊 Lordo: ${formatEuro(c.Lordo)}
🏝️ Ferie Residue: ${formatOre(c.FerieResidue)}
⏱️ ROL Residuo: ${formatOre(c.RolResiduo)}
🏦 TFR Accantonato: ${formatEuro(c.TFRAccantonato)}`;

    navigator.clipboard.writeText(testo).then(() => {
        alert('Riepilogo copiato negli appunti!');
    });
});

$('#deleteDetail').addEventListener('click', async () => {
    const mese = $('#detailSection').dataset.mese;
    if (!mese) return;
    if (!confirm(`Sei sicuro di voler eliminare il cedolino di ${monthLabel(mese)}?`)) return;

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