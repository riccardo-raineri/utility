const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in'); });
}, {threshold: 0.1});
document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

/* ══════════════════════════════════════════════════════════
   CONFIGURAZIONE DA COMPLETARE
   ══════════════════════════════════════════════════════════
   1) PAYPAL: cerca "TUA-EMAIL-PAYPAL@business.com" più in alto nel file
      e sostituiscila con l'email del tuo account PayPal Business.
   2) BACKEND PRENOTAZIONI/PERSONALIZZAZIONI: crea un Google Apps Script
      (Estensioni > Apps Script da un Google Sheet) con una funzione doPost
      che salvi la riga sul foglio e invii le mail (vedi file separato
      "workshop-backend.gs" che trovi tra i file scaricati). Poi incolla
      qui sotto l'URL del Web App pubblicato.
   ══════════════════════════════════════════════════════════ */
const APPS_SCRIPT_URL = "INCOLLA_QUI_URL_DEL_TUO_WEB_APP";

/* ══════════════════════════════════════════════════════════
   CATALOGO PRODOTTI E TESSUTI
   Ogni prodotto ha una lista di "variants": ognuna con un nome
   e un'immagine di quella specifica fantasia/tessuto. Le immagini
   qui sotto sono segnaposto: sostituiscile con le foto reali dei
   tuoi tessuti (basta cambiare l'URL in "img").
   ══════════════════════════════════════════════════════════ */
const PRODOTTI = {
  'porta-libro': {
    name: 'Porta Libro',
    desc: "Morbida, colorata, personalizzabile. Dipinta a mano e disponibile in tantissime fantasie. Con laccio per chiusura.",
    price: 24,
    variants: [
      { label: 'Fantasia floreale', img: 'https://images.unsplash.com/photo-1596496181848-3091d4878b24?auto=format&fit=crop&w=600&q=80' },
      { label: 'A righe blu', img: 'https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?auto=format&fit=crop&w=600&q=80' },
      { label: 'A pois', img: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=600&q=80' },
      { label: 'Su misura / dipinta a mano', img: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  'cover-book': {
    name: 'Cover Book',
    desc: "Fatta a mano e dipinta a mano. Personalizzabile, disponibile in diverse varianti. Adattabile in larghezza grazie al laccio.",
    price: 19,
    variants: [
      { label: 'Tinta unita mustard', img: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=600&q=80' },
      { label: 'Fantasia botanica', img: 'https://images.unsplash.com/photo-1621072156002-e2fccdc0b176?auto=format&fit=crop&w=600&q=80' },
      { label: 'Denim grezzo', img: 'https://images.unsplash.com/photo-1604176424472-9d7122c0b8b1?auto=format&fit=crop&w=600&q=80' },
      { label: 'Su misura / dipinta a mano', img: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  'set-accessori': {
    name: 'Set Accessori (Tabacco, Occhiali, Kindle, Portafoglio, PC)',
    desc: "Porta Tabacco, Porta Occhiali, Porta Kindle, Portafoglio, Porta PC — ogni articolo è cucito a mano e disponibile in fantasie coordinate.",
    price: 38,
    variants: [
      { label: 'Set verde salvia', img: 'https://images.unsplash.com/photo-1591076482161-42ce6da69f67?auto=format&fit=crop&w=600&q=80' },
      { label: 'Set terracotta', img: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=600&q=80' },
      { label: 'Set fantasia geometrica', img: 'https://images.unsplash.com/photo-1588702545922-09ac29037013?auto=format&fit=crop&w=600&q=80' },
      { label: 'Su misura / dipinto a mano', img: 'https://images.unsplash.com/photo-1596496181848-3091d4878b24?auto=format&fit=crop&w=600&q=80' }
    ]
  }
};

/* ══════════════════════════════════════════════════════════
   MODALE PRODOTTO: variante che cambia immagine + personalizzazione
   ══════════════════════════════════════════════════════════ */
const modalOverlay = document.getElementById('product-modal-overlay');
const modalImg = document.getElementById('modal-img');
const modalName = document.getElementById('modal-name');
const modalDesc = document.getElementById('modal-desc');
const modalPrice = document.getElementById('modal-price');
const modalVariant = document.getElementById('modal-variant');
const modalItemName = document.getElementById('modal-item-name');
const modalItemAmount = document.getElementById('modal-item-amount');
const personalizeToggle = document.getElementById('personalize-toggle');
const personalizePanel = document.getElementById('personalize-panel');
const personalizeText = document.getElementById('personalize-text');
const personalizeFile = document.getElementById('personalize-file');
const personalizePreview = document.getElementById('personalize-preview');
const productModalSent = document.getElementById('product-modal-sent');
const paypalForm = document.getElementById('paypal-buy-form');

let currentProductId = null;
let personalizeImageBase64 = null;

function openProductModal(productId) {
  const p = PRODOTTI[productId];
  if (!p) return;
  currentProductId = productId;

  modalName.textContent = p.name;
  modalDesc.textContent = p.desc;
  modalPrice.textContent = `€${p.price}`;
  modalItemAmount.value = p.price;

  modalVariant.innerHTML = '';
  p.variants.forEach((v, i) => {
    const opt = document.createElement('option');
    opt.value = i;
    opt.textContent = v.label;
    modalVariant.appendChild(opt);
  });
  modalVariant.value = 0;

  function updateVariantView() {
    const v = p.variants[modalVariant.value];
    modalImg.src = v.img;
    modalImg.alt = `${p.name} - ${v.label}`;
    modalItemName.value = `${p.name} - ${v.label}`;
  }
  updateVariantView();
  modalVariant.onchange = updateVariantView;

  // reset pannello personalizzazione
  personalizePanel.classList.remove('open');
  personalizeText.value = '';
  personalizeFile.value = '';
  personalizePreview.style.display = 'none';
  personalizeImageBase64 = null;
  productModalSent.classList.remove('show');

  modalOverlay.classList.add('open');
}

function closeProductModal() {
  modalOverlay.classList.remove('open');
}

document.getElementById('catalogo-grid').addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-buy-btn');
  if (btn) openProductModal(btn.dataset.id);
});
document.getElementById('product-modal-close').addEventListener('click', closeProductModal);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeProductModal(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProductModal(); });

personalizeToggle.addEventListener('click', () => {
  personalizePanel.classList.toggle('open');
});

personalizeFile.addEventListener('change', () => {
  const file = personalizeFile.files[0];
  if (!file) { personalizeImageBase64 = null; personalizePreview.style.display = 'none'; return; }
  const reader = new FileReader();
  reader.onload = (e) => {
    personalizeImageBase64 = e.target.result; // include già "data:image/...;base64,"
    personalizePreview.src = e.target.result;
    personalizePreview.style.display = 'inline-block';
  };
  reader.readAsDataURL(file);
});

// Quando si invia il pagamento PayPal, se l'utente ha compilato la
// personalizzazione, mandiamo anche una richiesta al backend (Apps
// Script) con il testo e l'eventuale immagine di riferimento, così il
// laboratorio riceve subito i dettagli via mail. Il pagamento su PayPal
// procede comunque normalmente (il form si apre in una nuova scheda).
paypalForm.addEventListener('submit', () => {
  const testo = personalizeText.value.trim();
  if (!testo && !personalizeImageBase64) return;

  const p = PRODOTTI[currentProductId];
  const variant = p.variants[modalVariant.value].label;

  if (APPS_SCRIPT_URL.startsWith('INCOLLA_QUI')) return; // backend non ancora configurato

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'text/plain' },
    body: JSON.stringify({
      tipo: 'personalizzazione',
      prodotto: p.name,
      variante: variant,
      richiesta: testo,
      immagineBase64: personalizeImageBase64 || ''
    })
  }).catch(() => {});

  productModalSent.classList.add('show');
});

/* ══════════════════════════════════════════════════════════
   WORKSHOP: eventi in programma (data + luogo)
   Aggiorna questo array ogni volta che organizzi un nuovo workshop.
   ══════════════════════════════════════════════════════════ */
const WORKSHOP_EVENTI = [
  { id: 'evento-1', nome: 'Workshop di Pittura', luogo: 'Off Topic, Bologna', data: 'Sabato 20 Settembre 2026, ore 16:00' },
  { id: 'evento-2', nome: 'Workshop di Pittura', luogo: 'Mercato Sonato, Bologna', data: 'Sabato 4 Ottobre 2026, ore 16:00' }
  // Aggiungi qui altri eventi nello stesso formato
];

const wsEventoSelect = document.getElementById('ws-evento');
WORKSHOP_EVENTI.forEach(ev => {
  const opt = document.createElement('option');
  opt.value = ev.id;
  opt.textContent = `${ev.nome} — ${ev.luogo} — ${ev.data}`;
  wsEventoSelect.appendChild(opt);
});

/* ══════════════════════════════════════════════════════════
   FORM PRENOTAZIONE WORKSHOP
   Invia i dati al backend (Google Apps Script), che salva la
   prenotazione su Google Sheet e invia subito una mail di
   riepilogo alla persona che ha prenotato.
   ══════════════════════════════════════════════════════════ */
const workshopForm = document.getElementById('workshop-form');
const wsConfirm = document.getElementById('ws-confirm');
const wsError = document.getElementById('ws-error');

workshopForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  wsConfirm.classList.remove('show');
  wsError.classList.remove('show');

  const eventoId = document.getElementById('ws-evento').value;
  const evento = WORKSHOP_EVENTI.find(ev => ev.id === eventoId);
  const nome = document.getElementById('ws-nome').value.trim();
  const persone = document.getElementById('ws-persone').value;
  const email = document.getElementById('ws-email').value.trim();
  const note = document.getElementById('ws-note').value.trim();

  if (APPS_SCRIPT_URL.startsWith('INCOLLA_QUI')) {
    wsError.textContent = "Il modulo non è ancora collegato al sistema di prenotazione (backend da configurare). Scrivici nel frattempo su Instagram o WhatsApp!";
    wsError.classList.add('show');
    return;
  }

  try {
    // mode 'no-cors' perché Google Apps Script non restituisce header CORS:
    // non possiamo leggere la risposta, ma la richiesta arriva comunque al backend.
    await fetch(APPS_SCRIPT_URL, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain' },
      body: JSON.stringify({
        tipo: 'prenotazione',
        workshop: evento ? `${evento.nome} — ${evento.luogo} — ${evento.data}` : eventoId,
        nome, persone, email, note
      })
    });

    wsConfirm.innerHTML = `La tua richiesta di partecipazione al workshop <strong>${evento ? evento.nome : ''}</strong> è arrivata con successo.<br>Attendi una mail da parte nostra per confermare la tua partecipazione.`;
    wsConfirm.classList.add('show');
    workshopForm.reset();
  } catch (err) {
    wsError.classList.add('show');
  }
});