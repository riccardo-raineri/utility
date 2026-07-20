const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxODP97AvFCgCT6OxmnGM6PKOycgRkXKVe9yjCyNpRon_JZNgdYu7ai-HZ63o6qduGw/exec';
const SECRET_PIN = "1234"; 
const ALL_USERS = ["Alessandra", "Chiara", "Giulia", "Riccardo", "Sergio", "Sharon", "Valentina"];

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
        console.error('Errore recupero dati:', error);
        container.innerHTML = `
            <div style="text-align:center; padding: 30px; color: #F87171;">
                <p style="font-weight:600; margin-bottom:8px;">Impossibile connettersi a Google Fogli</p>
                <p style="font-size:12px; color:var(--text-secondary);">Verifica che l'URL Apps Script sia corretto e il deployment impostato su 'Chiunque'.</p>
            </div>
        `;
        if (window.lucide) lucide.createIcons();
    }
}

// 2. MOSTRA LE CARD CON LE DATE CORRETTE
function renderPaymentsUI(payments) {
    const container = document.getElementById('payments-container');
    if (!payments || payments.length === 0) {
        container.innerHTML = '<p style="text-align:center; color:var(--text-secondary);">Nessun periodo trovato nel foglio.</p>';
        return;
    }

    let html = `
        <div class="section-title-row">
            <h3 style="font-size: 16px; font-weight: 700;">Storico Pagamenti Spotify</h3>
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
                        <span class="period-text">${item.inizio} → ${item.fine}</span>
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

// 3. SELEZIONE RAPIDA PERIODO DA MODIFICARE
function populateQuickSelect(payments) {
    const select = document.getElementById('quick-select-period');
    if (!select) return;
    
    select.innerHTML = '<option value="">-- Seleziona un periodo da aggiornare --</option>';
    
    payments.forEach((p, idx) => {
        let opt = document.createElement('option');
        opt.value = idx;
        opt.textContent = `${p.inizio} → ${p.fine} ${p.isCurrent ? '(IN CORSO)' : ''}`;
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

    if (document.getElementById('input-inizio')) document.getElementById('input-inizio').value = selected.inizio;
    if (document.getElementById('input-fine')) document.getElementById('input-fine').value = selected.fine;
    if (document.getElementById('input-durata')) document.getElementById('input-durata').value = selected.durata;
    if (document.getElementById('input-prezzo')) document.getElementById('input-prezzo').value = selected.prezzo;
}

// 4. SALVATAGGIO GARANTITO E SENZA BLOCCHI
async function savePaymentData(event) {
    event.preventDefault();
    
    const btn = document.getElementById('submit-btn');
    const originalBtnHTML = btn.innerHTML;
    
    btn.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;animation:spin 1s linear infinite;"></i> Salvataggio su Google Fogli...';
    btn.disabled = true;
    if (window.lucide) lucide.createIcons();

    const inizio = document.getElementById('input-inizio').value;
    const fine = document.getElementById('input-fine').value;
    const durata = document.getElementById('input-durata').value;
    const prezzo = document.getElementById('input-prezzo').value;

    const checkboxes = document.querySelectorAll('input[name="user"]:checked');
    const pagati = Array.from(checkboxes).map(cb => cb.value);
    const nonPagati = ALL_USERS.filter(user => !pagati.includes(user));

    const payload = {
        inizio: inizio,
        fine: fine,
        durata: durata,
        prezzo: prezzo,
        pagati: pagati,
        nonPagati: nonPagati
    };

    // Costruzione della richiesta GET per superare il blocco CORS del browser
    const saveUrl = `${APPS_SCRIPT_URL}?action=save&data=${encodeURIComponent(JSON.stringify(payload))}`;

    try {
        const response = await fetch(saveUrl);
        const result = await response.json();
        
        if (result.status === 'success') {
            alert('Dati salvati e aggiornati con successo su Google Fogli!');
            location.reload(); 
        } else {
            throw new Error(result.message || "Errore durante il salvataggio");
        }

    } catch (error) {
        console.error('Errore salvataggio:', error);
        alert("Si è verificato un errore durante il salvataggio. Verifica che il deployment su Apps Script sia impostato su 'Chiunque'.");
        btn.innerHTML = originalBtnHTML;
        btn.disabled = false;
        if (window.lucide) lucide.createIcons();
    }
}