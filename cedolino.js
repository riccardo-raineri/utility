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

// PARSER NUMERICO
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

// ORE FORMATTATE CON 3 DECIMALI
function formatOre(val) {
    if (val === '' || val === null || val === undefined) return '0,000 h';
    const num = parseNumber(val);
    return new Intl.NumberFormat('it-IT', {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3
    }).format(num) + ' h';
}

// UPLOAD PDF
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

// REGEX PARSER AGGIORNATO CON NUOVE REGOLE
function parseCedolino(text) {
    const norm = text.replace(/\s+/g, ' ');
    const NUM = '\\d+(?:\\.\\d{3})*,\\d+';
    const clean = (s) => (s ? s.replace(/\./g, '').replace(',', '.') : '');
    
    const grab = (re) => {
        const m = norm.match(re);
        return m ? clean(m[1]) : '';
    };

    // Netto
    const netto = grab(/\*{3,}\s*(\d+(?:\.\d{3})*,\d{2})/);

    // Lordo
    let lordo = grab(new RegExp(`(?:TOT\\.?\\s*COMPETENZE|TOTALE\\s+COMPETENZE)\\s*[:€]*\\s*(${NUM})`, 'i'));

    // Ferie
    const ferieMatur = grab(new RegExp(`FERIE\\s*:?[\\s\\S]*?Matur\\.?\\s*(${NUM})`, 'i'));
    const ferieGodut = grab(new RegExp(`FERIE\\s*:?[\\s\\S]*?Godut[oa]\\s*(${NUM})`, 'i'));
    const ferieSaldo = grab(new RegExp(`FERIE\\s*:?[\\s\\S]*?Saldo\\s*(${NUM})`, 'i'));

    // ROL
    const rolMatur = grab(new RegExp(`R\\.?O\\.?L\\.?\\s*:?[\\s\\S]*?Matur\\.?\\s*(${NUM})`, 'i'));
    const rolGodut = grab(new RegExp(`R\\.?O\\.?L\\.?\\s*:?[\\s\\S]*?Godut[oa]\\s*(${NUM})`, 'i'));
    const rolSaldo = grab(new RegExp(`R\\.?O\\.?L\\.?\\s*:?[\\s\\S]*?Saldo\\s*(${NUM})`, 'i'));
    const exFestGod = grab(new RegExp(`(?:Ex\\s*fest\\.?\\s*godut[ea]|R\\.?o\\.?l\\.?\\s*\\/?\\s*Ex\\s*fest\\.?\\s*godut[ea])\\s*(${NUM})`, 'i'));

    // Ore supplementari 35%
    const straOre = grab(new RegExp(`(?:Ore\\s+supplementari|Straordinar[io])(?:\\s*35%)?\\s*(${NUM})`, 'i'));
    const straEuroMatch = norm.match(new RegExp(`(?:Ore\\s+supplementari|Straordinar[io])(?:\\s*35%)?\\s*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i'));
    const straEuro = straEuroMatch ? clean(straEuroMatch[1]) : '';

    // Ore supplementari 50%
    const stra50Ore = grab(new RegExp(`(?:Ore\\s+supplementari|Straordinar[io])\\s*50%\\s*(${NUM})`, 'i'));
    const stra50EuroMatch = norm.match(new RegExp(`(?:Ore\\s+supplementari|Straordinar[io])\\s*50%\\s*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i'));
    const stra50Euro = stra50EuroMatch ? clean(stra50EuroMatch[1]) : '';

    // Maggiorazione Festivo 50%
    const festOre = grab(new RegExp(`(?:Magg\\.?\\s*lav\\.?\\s*fest\\.?|Festiv[io])(?:\\s*50%)?\\s*(${NUM})`, 'i'));
    const festEuroMatch = norm.match(new RegExp(`(?:Magg\\.?\\s*lav\\.?\\s*fest\\.?|Festiv[io])(?:\\s*50%)?\\s*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i'));
    const festEuro = festEuroMatch ? clean(festEuroMatch[1]) : '';

    // Maggiorazione Notturno 25%
    const nott25Ore = grab(new RegExp(`(?:Magg\\.?\\s*lav\\.?\\s*notturn[oa]|Notturn[oa])(?:\\s*25%)?\\s*(${NUM})`, 'i'));
    const nott25EuroMatch = norm.match(new RegExp(`(?:Magg\\.?\\s*lav\\.?\\s*notturn[oa]|Notturn[oa])(?:\\s*25%)?\\s*${NUM}\\s+${NUM}\\s+(${NUM})`, 'i'));
    const nott25Euro = nott25EuroMatch ? clean(nott25EuroMatch[1]) : '';

    // Festività non goduta & Premio Risultato
    const festNonGod = grab(new RegExp(`(?:Festivit[àa]\\s+non\\s+goduta)\\s*[:€]*\\s*(${NUM})`, 'i'));
    const premioRis = grab(new RegExp(`(?:Premio\\s+Risultato|Premio\\s+di\\s+risultato)\\s*[:€]*\\s*(${NUM})`, 'i'));

    // Mese/Anno
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
        ExFestGoduteOre: exFestGod,
        StraordinariOre: straOre,
        StraordinariEuro: straEuro,
        Straordinari50Ore: stra50Ore,
        Straordinari50Euro: stra50Euro,
        FestiviOre: festOre,
        FestiviEuro: festEuro,
        Notturno25Ore: nott25Ore,
        Notturno25Euro: nott25Euro,
        FestivitaNonGodutaEuro: festNonGod,
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

    timeline.innerHTML = filtrati
        .map(
            (c) => `
            <div class="stub" data-mese="${c.MeseAnno}">
                <div>
                    <div class="stub-month">${monthLabel(c.MeseAnno)}</div>
                    <div class="stub-meta">Ferie Saldo: <b>${formatOre(c.FerieResidue)}</b> · ROL Saldo: <b>${formatOre(c.RolResiduo)}</b></div>
                </div>
                <div class="stub-net">${formatEuro(c.Netto)}</div>
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

    const campiMostrati = [
        ['Netto', 'Netto in Busta', 'euro'],
        ['Lordo', 'Lordo / Tot. Competenze', 'euro'],
        ['FerieMaturateMese', 'Ferie Maturate (Mese)', 'ore'],
        ['FerieGoduteMese', 'Ferie Godute (Mese)', 'ore'],
        ['FerieResidue', 'Ferie Saldo / Residuo', 'ore'],
        ['RolMaturatoMese', 'ROL Maturato (Mese)', 'ore'],
        ['RolGodutoMese', 'ROL Goduto (Mese)', 'ore'],
        ['RolResiduo', 'ROL Saldo / Residuo', 'ore'],
        ['ExFestGoduteOre', 'R.o.L. / Ex Fest. Godute', 'ore'],
        ['StraordinariOre', 'Ore Supplementari 35%', 'ore'],
        ['StraordinariEuro', 'Importo Supplementari 35%', 'euro'],
        ['Straordinari50Ore', 'Ore Supplementari 50%', 'ore'],
        ['Straordinari50Euro', 'Importo Supplementari 50%', 'euro'],
        ['FestiviOre', 'Magg. Lav. Festivo 50%', 'ore'],
        ['FestiviEuro', 'Importo Festivo 50%', 'euro'],
        ['Notturno25Ore', 'Magg. Lav. Notturno 25%', 'ore'],
        ['Notturno25Euro', 'Importo Notturno 25%', 'euro'],
        ['FestivitaNonGodutaEuro', 'Festività non goduta', 'euro'],
        ['PremioRisultato', 'Premio Risultato', 'euro'],
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

// BOTTONE MODIFICA
$('#editDetail').addEventListener('click', () => {
    const mese = $('#detailSection').dataset.mese;
    const c = state.cedolini.find((x) => x.MeseAnno === mese);
    if (!c) return;

    showReview(c);
    $('#detailSection').classList.add('hidden');
    setStatus(`Modifica in corso per il cedolino di ${monthLabel(mese)}`);
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