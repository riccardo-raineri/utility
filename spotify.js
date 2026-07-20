document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
        lucide.createIcons();
    }
});

// ==> IMPOSTA QUI IL TUO PIN SEGRETO <==
const SECRET_PIN = "1234"; 

function verifyPin() {
    const enteredPin = document.getElementById('input-pin').value;
    
    if (enteredPin === SECRET_PIN) {
        // Sblocca il form
        const form = document.getElementById('spotify-form');
        form.style.opacity = '1';
        form.style.pointerEvents = 'auto';

        // Abilita tutti gli input e checkbox all'interno del form (tranne quello read-only del periodo)
        const inputs = form.querySelectorAll('input:not(#input-periodo)');
        inputs.forEach(input => input.disabled = false);

        // Nascondi la barra di richiesta PIN e cambia l'icona del lucchetto
        document.getElementById('pin-prompt-container').style.display = 'none';
        document.getElementById('form-subtitle').textContent = 'Modalità di modifica sbloccata';
        document.getElementById('form-subtitle').style.color = 'var(--spotify-green)';
        
        const lockIcon = document.getElementById('form-lock-icon');
        lockIcon.setAttribute('data-lucide', 'unlock');
        if (window.lucide) lucide.createIcons();

    } else {
        alert('PIN errato! Riprova.');
        document.getElementById('input-pin').value = '';
    }
}

// Funzione per formattare la data nel formato italiano richiesto (es. "20 luglio 2026")
function formatDateItalian(dateString) {
    if (!dateString) return "";
    const [year, month, day] = dateString.split('-');
    const months = [
        "gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno",
        "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"
    ];
    const monthName = months[parseInt(month, 10) - 1];
    const dayNumber = parseInt(day, 10);
    return `${dayNumber} ${monthName} ${year}`;
}

// Aggiorna dinamicamente la stringa del periodo combinando le due date del calendario
function updatePeriodString() {
    const startDateVal = document.getElementById('date-start').value;
    const endDateVal = document.getElementById('date-end').value;

    if (startDateVal && endDateVal) {
        const formattedStart = formatDateItalian(startDateVal);
        const formattedEnd = formatDateItalian(endDateVal);
        document.getElementById('input-periodo').value = `${formattedStart} → ${formattedEnd}`;
    }
}

// Funzione per mostrare/nascondere lo storico precedente
function toggleOlderHistory() {
    const olderHistoryContainer = document.getElementById('older-history');
    const btn = document.getElementById('toggle-history-btn');

    if (olderHistoryContainer.style.display === 'none' || olderHistoryContainer.style.display === '') {
        olderHistoryContainer.style.display = 'flex';
        btn.innerHTML = '<i data-lucide="eye-off" style="width: 14px; height: 14px;"></i> Nascondi precedenti';
    } else {
        olderHistoryContainer.style.display = 'none';
        btn.innerHTML = '<i data-lucide="eye" style="width: 14px; height: 14px;"></i> Mostra tutti i precedenti';
    }

    if (window.lucide) {
        lucide.createIcons();
    }
}

// ==> INSERISCI QUI L'URL DEL TUO APPS SCRIPT <==
const APPS_SCRIPT_URL = 'INSERISCI_QUI_IL_TUO_URL_APPS_SCRIPT';

async function saveToGoogleSheets(event) {
    event.preventDefault();
    
    const btn = document.getElementById('submit-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i data-lucide="loader" style="width:14px;height:14px;animation:spin 1s linear infinite;"></i> Salvataggio...';
    btn.disabled = true;

    const periodo = document.getElementById('input-periodo').value;
    const durata = document.getElementById('input-durata').value;
    const prezzo = document.getElementById('input-prezzo').value;

    const allUsers = ["Chiara", "Giulia", "Riccardo", "Sergio", "Sharon", "Valentina", "Alessandra"];
    const checkboxes = document.querySelectorAll('input[name="user"]:checked');
    const pagati = Array.from(checkboxes).map(cb => cb.value);
    const nonPagati = allUsers.filter(user => !pagati.includes(user));

    const payload = {
        periodo: periodo,
        durata: durata,
        prezzo: prezzo,
        pagati: pagati,
        nonPagati: nonPagati.length > 0 ? nonPagati : ["Nessuno"]
    };

    try {
        await fetch(APPS_SCRIPT_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        alert('Modifiche inviate e salvate con successo su Google Fogli!');
        location.reload();
    } catch (error) {
        console.error('Errore:', error);
        alert('Errore durante il salvataggio.');
        btn.innerHTML = originalText;
        btn.disabled = false;
        if (window.lucide) lucide.createIcons();
    }
}