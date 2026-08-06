/* ==========================================================================
   PEPE HANDMADE - FUNCTIONALITY & CATALOG MANAGEMENT
   ========================================================================== */

// Intersection Observer per animazioni reveal
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { 
    if (e.isIntersecting) e.target.classList.add('in'); 
  });
}, { threshold: 0.1 });

document.querySelectorAll('.reveal').forEach(el => obs.observe(el));

// Sostituire con il proprio URL Apps Script se necessario
const APPS_SCRIPT_URL = "INCOLLA_QUI_URL_DEL_TUO_WEB_APP";

/* ══════════════════════════════════════════════════════════
   CATALOGO PRODOTTI E TESSUTI
   ══════════════════════════════════════════════════════════ */
const PRODOTTI = {
  'porta-libro': {
    name: 'Porta Libro',
    desc: "Morbida, colorata, personalizzabile. Dipinta a mano e disponibile in tantissime fantasie. Con laccio per chiusura.",
    price: 24,
    features: ['Dipinta a mano', 'Personalizzabile', 'Laccio chiusura'],
    variants: [
      { label: 'Fantasia botanica', img: 'https://riccardo-raineri.github.io/utility/pepe/img/porta_libro_pers_fiori.jpg' },
      { label: 'A righe blu', img: 'https://images.unsplash.com/photo-1620574387735-3624d75b2dbc?auto=format&fit=crop&w=600&q=80' },
      { label: 'A pois', img: 'https://images.unsplash.com/photo-1618354691373-d851c5c3a990?auto=format&fit=crop&w=600&q=80' },
      { label: 'Su misura / dipinta a mano', img: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  'cover-book': {
    name: 'Cover Book',
    desc: "Fatta a mano e dipinta a mano. Personalizzabile, disponibile in diverse varianti. Adattabile in larghezza grazie al laccio.",
    price: 19,
    features: ['3 Taglie', 'Adattabile', 'Dipinta a mano'],
    variants: [
      { label: 'Tinta unita mustard', img: 'https://riccardo-raineri.github.io/utility/pepe/img/cover_book.jpg' },
      { label: 'Denim grezzo', img: 'https://images.unsplash.com/photo-1604176424472-9d7122c0b8b1?auto=format&fit=crop&w=600&q=80' },
      { label: 'Su misura / dipinta a mano', img: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  'set-accessori': {
    name: 'Set Accessori (5 Pezzi)',
    desc: "Porta Tabacco, Porta Occhiali, Porta Kindle, Portafoglio, Porta PC — ogni articolo è cucito a mano e disponibile in fantasie coordinate.",
    price: 38,
    features: ['5 Pezzi', 'Coordinati', 'Cuciti a mano'],
    variants: [
      { label: 'Set verde salvia', img: 'https://riccardo-raineri.github.io/utility/pepe/img/set.jpg' },
      { label: 'Set terracotta', img: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=600&q=80' },
      { label: 'Set fantasia geometrica', img: 'https://images.unsplash.com/photo-1588702545922-09ac29037013?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  'porta-kindle': {
    name: 'Porta Kindle',
    desc: "Custodia imbottita per proteggere il tuo e-reader con stile. Chiusura a bottone o con comodo laccio in pelle.",
    price: 16,
    features: ['Imbottita', 'Su misura', 'Antiurto'],
    variants: [
      { label: 'Velluto a coste', img: 'https://riccardo-raineri.github.io/utility/pepe/img/porta_kindle.png' },
      { label: 'Fantasia floreale', img: 'https://images.unsplash.com/photo-1463171515643-952cee54d42a?auto=format&fit=crop&w=600&q=80' },
      { label: 'Su misura / dipinta a mano', img: 'https://images.unsplash.com/photo-1596496181848-3091d4878b24?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  'pochette-multiuso': {
    name: 'Pochette Multiuso',
    desc: "Pratica e capiente, foderata all'interno e con chiusura zip. Ideale come beauty-case da borsa o astuccio portapenne.",
    price: 18,
    features: ['Chiusura Zip', 'Foderata', 'Lavabile'],
    variants: [
      { label: 'Fantasia limoni', img: 'https://riccardo-raineri.github.io/utility/pepe/img/mini_sacca_oggetti.jpg' },
      { label: 'Geometrica vintage', img: 'https://images.unsplash.com/photo-1588702545922-09ac29037013?auto=format&fit=crop&w=600&q=80' },
      { label: 'Tinta unita', img: 'https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  'tote-bag': {
    name: 'Tote Bag in Tela',
    desc: "Borsa in cotone pesante, cucita e dipinta a mano. Capiente, resistente e perfetta per ogni giorno. Manici lunghi e comodi.",
    price: 26,
    features: ['Cotone 100%', 'Extra forte', 'Dipinta a mano'],
    variants: [
      { label: 'Disegno minimal', img: 'https://images.unsplash.com/photo-1597514210408-fb7c92b23616?auto=format&fit=crop&w=600&q=80' },
      { label: 'Illustrazione floreale', img: 'https://images.unsplash.com/photo-1596496181848-3091d4878b24?auto=format&fit=crop&w=600&q=80' },
      { label: 'Personalizzata', img: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80' }
    ]
  },
  'porta-tabacco': {
    name: 'Porta Tabacco',
    desc: "Pochette porta tabacco con taschino per le cartine e laccetto porta accendino.",
    price: 26,
    features: ['Cotone 100%', 'Extra forte', 'Dipinta a mano'],
    variants: [
      { label: 'Disegno minimal', img: 'https://riccardo-raineri.github.io/utility/pepe/img/porta_tabacco.jpg' },
      { label: 'Illustrazione floreale', img: 'https://images.unsplash.com/photo-1596496181848-3091d4878b24?auto=format&fit=crop&w=600&q=80' },
      { label: 'Personalizzata', img: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=600&q=80' }
    ]
  }
};

/* ══════════════════════════════════════════════════════════
   GENERAZIONE DINAMICA DEL CATALOGO 
   ══════════════════════════════════════════════════════════ */
const fullCatalogContainer = document.getElementById('full-catalogo-grid');
if (fullCatalogContainer) {
  let html = '';
  for (const [id, p] of Object.entries(PRODOTTI)) {
    const thumb = p.variants[0].img;
    const featsHtml = (p.features || []).map(f => `<span class="cat-feat">${f}</span>`).join('');
    
    html += `
      <div class="cat-card reveal in">
        <div class="cat-photo">
          <img src="${thumb}" alt="${p.name}" loading="lazy">
        </div>
        <div class="cat-info">
          <div class="cat-name">${p.name}</div>
          <div class="cat-dsc">${p.desc}</div>
          <div class="cat-feats">${featsHtml}</div>
          <div class="cat-footer">
            <span class="cat-price">€${p.price}</span>
            <button class="btn btn-primary cat-buy-btn" data-id="${id}">Personalizza</button>
          </div>
        </div>
      </div>
    `;
  }
  fullCatalogContainer.innerHTML = html;
}

/* ══════════════════════════════════════════════════════════
   MODALE PRODOTTO
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
  if (!modalOverlay) return;
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

  personalizePanel.classList.remove('open');
  personalizeText.value = '';
  personalizeFile.value = '';
  personalizePreview.style.display = 'none';
  personalizeImageBase64 = null;
  productModalSent.classList.remove('show');

  modalOverlay.classList.add('open');
}

function closeProductModal() {
  if (modalOverlay) modalOverlay.classList.remove('open');
}

document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('.cat-buy-btn');
  if (btn) openProductModal(btn.dataset.id);
});

if (document.getElementById('product-modal-close')) {
  document.getElementById('product-modal-close').addEventListener('click', closeProductModal);
}
if (modalOverlay) {
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeProductModal(); });
}
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeProductModal(); });

if (personalizeToggle) {
  personalizeToggle.addEventListener('click', () => {
    personalizePanel.classList.toggle('open');
  });
}

if (personalizeFile) {
  personalizeFile.addEventListener('change', () => {
    const file = personalizeFile.files[0];
    if (!file) { personalizeImageBase64 = null; personalizePreview.style.display = 'none'; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      personalizeImageBase64 = e.target.result;
      personalizePreview.src = e.target.result;
      personalizePreview.style.display = 'inline-block';
    };
    reader.readAsDataURL(file);
  });
}

if (paypalForm) {
  paypalForm.addEventListener('submit', () => {
    const testo = personalizeText.value.trim();
    if (!testo && !personalizeImageBase64) return;

    const p = PRODOTTI[currentProductId];
    const variant = p.variants[modalVariant.value].label;

    if (APPS_SCRIPT_URL.startsWith('INCOLLA_QUI')) return;

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
}

/* ══════════════════════════════════════════════════════════
   WORKSHOP: Eventi e Form
   ══════════════════════════════════════════════════════════ */
const WORKSHOP_EVENTI = [
  { id: 'evento-1', nome: 'Workshop di Pittura', luogo: 'Off Topic, Bologna', data: 'Sabato 20 Settembre 2026, ore 16:00' },
  { id: 'evento-2', nome: 'Workshop di Pittura', luogo: 'Mercato Sonato, Bologna', data: 'Sabato 4 Ottobre 2026, ore 16:00' }
];

const wsEventoSelect = document.getElementById('ws-evento');
if (wsEventoSelect) {
  WORKSHOP_EVENTI.forEach(ev => {
    const opt = document.createElement('option');
    opt.value = ev.id;
    opt.textContent = `${ev.nome} — ${ev.luogo} — ${ev.data}`;
    wsEventoSelect.appendChild(opt);
  });
}

const workshopForm = document.getElementById('workshop-form');
const wsConfirm = document.getElementById('ws-confirm');
const wsError = document.getElementById('ws-error');

if (workshopForm) {
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
      wsError.textContent = "Il modulo non è ancora collegato. Scrivici nel frattempo su Instagram o WhatsApp!";
      wsError.classList.add('show');
      return;
    }

    try {
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
}