// ============================================================================
// LISTA DELLA SPESA 2.0 - Logica & Dati
// ============================================================================

// --- 1. GESTIONE STATO ---
let prodotti = [
  { id: 1, nome: "Latte Intero", categoria: "Alimentari", qta: 2, unita: "lt", prezzo: 1.50, spuntato: false },
  { id: 2, nome: "Detersivo Piatti", categoria: "Casa", qta: 1, unita: "pz", prezzo: 2.99, spuntato: true },
  { id: 3, nome: "Mele Golden", categoria: "Alimentari", qta: 1.5, unita: "kg", prezzo: 2.20, spuntato: true }
];

// Dati fittizi per i grafici
const storicoPrezzi = [
  { data: "01/07", prezzoKg: 2.10 },
  { data: "08/07", prezzoKg: 2.35 },
  { data: "15/07", prezzoKg: 2.20 },
  { data: "22/07", prezzoKg: 2.50 },
  { data: "29/07", prezzoKg: 2.45 }
];
const totaliMensili = [85, 110, 145, 90, 130, 142.50];

// --- 2. ELEMENTI DOM ---
const tabs = document.querySelectorAll('.tab-btn');
const views = document.querySelectorAll('.view');
const formProdotto = document.getElementById('form-prodotto');
const listaContainer = document.getElementById('lista-prodotti');
const scontrinoContenuto = document.getElementById('scontrino-contenuto');
const totaleScontrino = document.getElementById('scontrino-totale-valore');
const themeToggle = document.getElementById('theme-toggle');
const toastEl = document.getElementById('toast');

// --- 3. NAVIGAZIONE TABS ---
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    // Rimuovi active da tutti
    tabs.forEach(t => t.classList.remove('active'));
    views.forEach(v => v.classList.remove('active'));
    
    // Aggiungi active a quello cliccato
    tab.classList.add('active');
    const target = tab.getAttribute('data-target');
    document.getElementById(target).classList.add('active');
    
    // Ridisegna scontrino se si apre il tab scontrino
    if (target === 'view-scontrino') renderScontrino();
  });
});

// --- 4. TEMA (SCURO / CHIARO) ---
themeToggle.addEventListener('click', () => {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  if (currentTheme === 'light') {
    document.documentElement.removeAttribute('data-theme');
  } else {
    document.documentElement.setAttribute('data-theme', 'light');
  }
});

// --- 5. GESTIONE PRODOTTI ---
formProdotto.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const nuovoProdotto = {
    id: Date.now(),
    nome: document.getElementById('input-nome').value,
    categoria: document.getElementById('input-categoria').value,
    qta: parseFloat(document.getElementById('input-qta').value),
    unita: document.getElementById('input-unita').value,
    prezzo: parseFloat(document.getElementById('input-prezzo').value),
    spuntato: false
  };

  prodotti.push(nuovoProdotto);
  formProdotto.reset();
  renderLista();
  showToast("Prodotto aggiunto!");
});

function toggleSpunta(id) {
  const p = prodotti.find(p => p.id === id);
  if(p) {
    p.spuntato = !p.spuntato;
    renderLista();
  }
}

function eliminaProdotto(id) {
  prodotti = prodotti.filter(p => p.id !== id);
  renderLista();
  showToast("Prodotto eliminato");
}

// --- 6. RENDER LISTA ---
function renderLista() {
  listaContainer.innerHTML = '';
  
  // Raggruppa per categoria
  const categorie = [...new Set(prodotti.map(p => p.categoria))];
  
  categorie.forEach(cat => {
    const prodottiCat = prodotti.filter(p => p.categoria === cat);
    if (prodottiCat.length === 0) return;

    const blocco = document.createElement('div');
    blocco.className = 'categoria-blocco';
    blocco.innerHTML = `<div class="categoria-titolo">${cat}</div>`;
    
    prodottiCat.forEach(p => {
      const riga = document.createElement('div');
      riga.className = `prodotto-riga ${p.spuntato ? 'spuntato' : ''}`;
      
      const totalePrezzo = (p.prezzo * p.qta).toFixed(2);
      
      riga.innerHTML = `
        <input type="checkbox" ${p.spuntato ? 'checked' : ''} onchange="toggleSpunta(${p.id})">
        <div>
          <div class="prodotto-nome">${p.nome}</div>
          <div class="prodotto-dettaglio">${p.qta}${p.unita} x €${p.prezzo.toFixed(2)}</div>
        </div>
        <div class="prodotto-prezzo">€${totalePrezzo}</div>
        <button class="riga-modifica" title="Modifica">✎</button>
        <button class="riga-elimina" title="Elimina" onclick="eliminaProdotto(${p.id})">×</button>
      `;
      blocco.appendChild(riga);
    });
    
    listaContainer.appendChild(blocco);
  });
}

// --- 7. RENDER SCONTRINO ---
function renderScontrino() {
  scontrinoContenuto.innerHTML = '';
  let totale = 0;
  
  const prodottiNelCarrello = prodotti.filter(p => p.spuntato);
  
  if (prodottiNelCarrello.length === 0) {
    scontrinoContenuto.innerHTML = `<div class="scontrino-riga"><span style="color:var(--testo-attenuato)">Carrello vuoto</span></div>`;
  } else {
    prodottiNelCarrello.forEach(p => {
      const subTotale = p.prezzo * p.qta;
      totale += subTotale;
      
      scontrinoContenuto.innerHTML += `
        <div class="scontrino-riga">
          <span>${p.qta}x ${p.nome}</span>
          <span>€${subTotale.toFixed(2)}</span>
        </div>
      `;
    });
  }
  
  totaleScontrino.innerText = `€ ${totale.toFixed(2)}`;
}

// --- 8. GRAFICI CHART.JS (Aggiornati allo stile giallo/spigoloso) ---
function initCharts() {
  Chart.defaults.color = '#9ba3a9';
  Chart.defaults.font.family = "'IBM Plex Mono', monospace";

  // Grafico Storico (Linea)
  const ctxStorico = document.getElementById('chart-storico').getContext('2d');
  new Chart(ctxStorico, {
    type: 'line',
    data: {
      labels: storicoPrezzi.map(r => r.data),
      datasets: [{
        label: '€/kg',
        data: storicoPrezzi.map(r => r.prezzoKg),
        borderColor: '#f4d03f', // Accento Giallo
        backgroundColor: 'rgba(244, 208, 63, 0.15)',
        borderWidth: 2,
        tension: 0, // Linea spezzata in stile scontrino
        fill: true,
        pointBackgroundColor: '#f4d03f',
        pointRadius: 3
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: false, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { grid: { display: false } }
      }
    }
  });

  // Grafico Mensile (Barre)
  const ctxMensile = document.getElementById('chart-mensile').getContext('2d');
  new Chart(ctxMensile, {
    type: 'bar',
    data: {
      labels: ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu'],
      datasets: [{ 
        label: 'Totale Mensile (€)',
        data: totaliMensili, 
        backgroundColor: '#f4d03f', // Accento Giallo
        borderRadius: 2 // Angoli netti
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
        x: { grid: { display: false } }
      }
    }
  });
}

// --- 9. UTILITY (Toast) ---
function showToast(msg) {
  toastEl.innerText = msg;
  toastEl.classList.add('visibile');
  setTimeout(() => {
    toastEl.classList.remove('visibile');
  }, 2500);
}

// --- INIZIALIZZAZIONE AL CARICAMENTO ---
document.addEventListener('DOMContentLoaded', () => {
  renderLista();
  renderScontrino();
  initCharts();
});