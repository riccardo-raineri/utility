document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
        lucide.createIcons();
    }
});

// ==> IMPOSTA QUI IL TUO PIN SEGRETO <==
const SECRET_PIN = "0712"; 

function verifyPin() {
    const enteredPin = document.getElementById('input-pin').value;
    
    if (enteredPin === SECRET_PIN) {
        // Sblocca il form
        const form = document.getElementById('spotify-form');
        form.style.opacity = '1';
        form.style.pointerEvents = 'auto';

        // Abilita tutti gli input e checkbox all'interno del form
        const inputs = form.querySelectorAll('input');
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

// ==> INSERISCI QUI L'URL DEL TUO APPS SCRIPT <==
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycby5YRkeEUhDkDMX85Oh7Gkw7T96x8QLwUAsRSt5XT510Go-bfdhgMnAImDVW0io9nkO/exec';

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