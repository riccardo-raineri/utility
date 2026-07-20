const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbw3EKRlvWN3V2sk50fto3G08hgMyHTUqTivq9IKmIT671FsgY7jxFB74FFcV9IIurIv/exec';
const SECRET_PIN = "0712"; 
const ALL_USERS = ["Chiara", "Giulia", "Riccardo", "Sergio", "Sharon", "Valentina", "Alessandra"];

let globalPaymentsData = [];

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
    fetchDataFromGoogleSheets();
});

// 1. CARICAMENTO DATI
async function fetchDataFromGoogleSheets() {
    const container = document.getElementById('payments-container');
    container.innerHTML = `
        <div style="text-align:center; padding: 40px; color: var(--spotify-green);">
            <i data-lucide="loader" style="width:24px;height:24px;animation:spin 1s linear infinite;"></i>
            <p style="margin-top:10px; font-size:13px;">Sincronizzazione con Google Fogli in corso...</p>
        </div>
    `;
    if (window.lucide) lucide.createIcons();

    try {
        const response = await fetch(APPS_SCRIPT_URL);
        if (!response.ok) throw new Error('Errore di connessione');
        
        globalPaymentsData = await response.json();
        renderPaymentsUI(globalPaymentsData);
        populateQuickSelect(globalPaymentsData);
    } catch (error) {
        console.error('Errore nel recupero dati:', error);
        container.innerHTML = `
            <div style="text-align:center; padding: 30px; color: #F87171;">
                <p style="font-weight:600; margin-bottom:8px;">Impossibile connettersi a Google Fogli</p>
                <p style="font-size:12px; color:var(--text-secondary);">Verifica che l'URL Apps Script sia corretto e pubblicato come 'Chiunque'.</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }
}

// 2. RENDERING INTERFACCIA
function renderPaymentsUI(payments) {
    const container = document.getElementById('payments-container');
    if (!payments || payments.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">Nessun periodo trovato nel foglio.</p>';
        return;
    }

    let html = `
        <div class="section-title-row">
            <h3 style="font-size: 16px; font-weight: 700;">Storico Pagamenti</h3>
            <button type="button" id="toggle-history-btn" onclick="toggleOlderHistory()" style="display: ${payments.length > 1 ? 'flex' : 'none'};">
                <i data-lucide="eye" style="width: 14px; height: 14px;"></i> Mostra tutti i precedenti
            </button>
        </div>
    `;

    payments.forEach((item, index) => {
        const isCurrent = item.isCurrent;
        
        let paidBadges = item.pagati.length > 0 
            ? item.pagati.map(u => `<span class="user-badge paid"><i data-lucide="check" style="width:12px;height:12px"></i> ${u}</span>`).join(' ')
            : `<span style="font-size:12px; color:var(--text-secondary);">Nessuno</span>`;

        let pendingBadges = item.nonPagati.length > 0
            ? item.nonPagati.map(u => `<span class="user-badge pending"><i data-lucide="clock" style="width:12px;height:12px"></i> ${u}</span>`).join(' ')
            : `<span style="font-size:12px; color:var(--spotify-green); font-weight:600;"><i data-lucide="check-circle-2" style="width:12px;height:12px"></i> Tutti hanno pagato!</span>`;

        let cardClass = isCurrent ? "payment-card current" : "payment-card";
        let wrapperOpen = (!isCurrent && index === 1) ? `<div id="older-history" style="display: none; flex-direction: column; gap: 16px; width: 100%;">` : "";
        
        html += `
            ${wrapperOpen}
            <div class="${cardClass}">
                <div class="card-top-row">
                    <div class="period-info">
                        <i data-lucide="calendar"></i>
                        <span class="period-text">${item.periodo}</span>
                    </div>
                    ${isCurrent ? '<span class="badge-current">In corso ('+item.durata+')</span>' : '<span style="font-family:var(--font-mono); font-size:12px; color:var(--text-tertiary);">'+item.durata+'</span>'}
                </div>
                <div class="card-details-row">
                    <div class="price-tag">${item.prezzo} <span style="font-size:11px; font-weight:400; color:var(--text-secondary);">a persona</span></div>
                    <div class="users-status-group">
                        <div class="user-list">
                            <span class="label-status" style="margin-right: 4px;">Hanno pagato:</span>
                            ${paidBadges}
                        </div>
                        <div class="user-list" style="margin-top: 6px;">
                            <span class="label-status" style="margin-right: 4px; color: #F87171;">Mancano:</span>
                            ${pendingBadges}
                        </div>
                    </div>
                </div>
            </div>
        `;

        if (index === payments.length - 1 && payments.length > 1) {
            html += `</div>`;
        }
    });

    container.innerHTML = html;
    if (window.lucide) lucide.createIcons();
}

// 3. POPOLA TENDINA DI SELEZIONE
function populateQuickSelect(payments) {
    const select = document.getElementById('quick-select-period');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleziona un periodo esistente da aggiornare --</option>';
    
    payments.forEach((p, idx) => {
        let opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${p.periodo} ${p.isCurrent ? '(IN CORSO)' : ''}`;
        select.appendChild(opt);
    });
}

function loadPeriodIntoForm() {
    const idx = document.getElementById('quick-select-period').value;
    if (idx === "") return;

    const selected = globalPaymentsData[idx];
    const checkboxes = document.querySelectorAll('input[name="user"]');
    
    checkboxes.forEach(cb => {
        cb.checked = selected.pagati.includes(cb.value);
    });

    document.getElementById('input-periodo').value = selected.periodo;
    document.getElementById('input-durata').value = selected.durata;
    document.getElementById('input-prezzo').value = selected.prezzo;
    
    document.getElementById('date-start').value = "";
    document.getElementById('date-end').value = "";
}

// 4. VERIFICA PIN
function verifyPin() {
    const enteredPin = document.getElementById('input-pin').value;
    if (enteredPin === SECRET_PIN) {
        const form = document.getElementById('spotify-form');
        form.style.opacity = '1';
        form.style.pointerEvents = 'auto';

        const inputs = form.querySelectorAll('input, select');
        inputs.forEach(input => { if(input.id !== 'input-periodo') input.disabled = false; });

        document.getElementById('pin-prompt-container').style.display = 'none';
        document.getElementById('form-subtitle').textContent = 'Modalità di modifica sbloccata';
        document.getElementById('form-subtitle').style.color = 'var(--spotify-green)';
        
        document.getElementById('form-lock-icon').setAttribute('data-lucide', 'unlock');
        if (window.lucide) lucide.createIcons();
    } else {
        alert('PIN errato! Riprova.');
        document.getElementById('input-pin').value = '';
    }
}

function formatDateItalian(dateString) {
    if (!dateString) return "";
    const [year, month, day] = dateString.split('-');
    const months = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
    return `${parseInt(day, 10)} ${months[parseInt(month, 10) - 1]} ${year}`;
}

function updatePeriodString() {
    const startDateVal = document.getElementById('date-start').value;
    const endDateVal = document.getElementById('date-end').value;

    if (startDateVal && endDateVal) {
        document.getElementById('input-periodo').value = `${formatDateItalian(startDateVal)} → ${formatDateItalian(endDateVal)}`;
        document.getElementById('quick-select-period').value = "";
    }
}

function toggleOlderHistory() {
    const olderHistoryContainer = document.getElementById('older-history');
    const btn = document.getElementById('toggle-history-btn');
    if (!olderHistoryContainer) return;

    if (olderHistoryContainer.style.display === 'none' || olderHistoryContainer.style.display === '') {
        olderHistoryContainer.style.display = 'flex';
        btn.innerHTML = '<i data-lucide="eye-off" style="width: 14px; height: 14px;"></i> Nascondi precedenti';
    } else {
        olderHistoryContainer.style.display = 'none';
        btn.innerHTML = '<i data-lucide="eye" style="width: 14px; height: 14px;"></i> Mostra tutti i precedenti';
    }
    if (window.lucide) lucide.createIcons();
}

// 5. SALVATAGGIO AFFIDABILE TRAMITE GET
async function savePaymentData(event) {
    event.preventDefault();
    
    const btn = document.getElementById('submit-btn');
    const originalBtnHTML = btn.innerHTML;
    
    btn.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;animation:spin 1s linear infinite;"></i> Salvataggio su Google Fogli...';
    btn.disabled = true;
    if (window.lucide) lucide.createIcons();

    const periodo = document.getElementById('input-periodo').value;
    const durata = document.getElementById('input-durata').value;
    const prezzo = document.getElementById('input-prezzo').value;

    const checkboxes = document.querySelectorAll('input[name="user"]:checked');
    const pagati = Array.from(checkboxes).map(cb => cb.value);
    const nonPagati = ALL_USERS.filter(user => !pagati.includes(user));

    const payload = {
        periodo: periodo,
        durata: durata,
        prezzo: prezzo,
        pagati: pagati,
        nonPagati: nonPagati
    };

    // Costruiamo l'URL di salvataggio sicuro
    const saveUrl = `${APPS_SCRIPT_URL}?action=save&data=${encodeURIComponent(JSON.stringify(payload))}`;

    try {
        const response = await fetch(saveUrl);
        const result = await response.json();
        
        if (result.status === 'success') {
            alert('Modifiche salvate con successo su Google Fogli!');
            location.reload(); 
        } else {
            throw new Error(result.message || "Errore sconosciuto dal server");
        }

    } catch (error) {
        console.error('Errore durante il salvataggio:', error);
        alert("Impossibile salvare la modifica su Google Fogli. Assicurati che l'URL sia corretto e il deployment aggiornato.");
        btn.innerHTML = originalBtnHTML;
        btn.disabled = false;
        if (window.lucide) lucide.createIcons();
    }
}