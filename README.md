# 🛠️ MY TOOLBOX Dashboard

<p align="center"><img src="banner.jpg" alt="GPT-Image2 Prompt System" width="800" /></p>

Una raccolta modulare di strumenti web: calcolatrici, utilità, tool per fotografia e video, produttività, viaggi e intrattenimento. Ogni strumento è una pagina indipendente, raggiungibile da una dashboard centrale con ricerca, filtri e preferiti. Interfaccia responsive, pensata prima di tutto per essere usata da smartphone, con tema chiaro/scuro.

---

## 🧭 La Dashboard

La home raccoglie tutti i tool e rende veloce trovare quello che serve:

*   **Ricerca istantanea** su titolo e descrizione, con scorciatoia da tastiera `/` per mettere subito il cursore nella barra.
*   **Filtri per categoria** (Utilità, Finanza, Cinema, Viaggi, Tempo, Svago). Su mobile si raccolgono in un menu hamburger.
*   **Preferiti**: ogni card ha una stella, e i tool salvati si ritrovano in un pannello laterale dedicato.
*   **Area Riservata**: un login nasconde o mostra gli strumenti personali (vedi sezione dedicata).
*   **Le mie apps**: collegamento diretto alla pagina delle altre app.
*   **Tema chiaro/scuro** con preferenza condivisa tra i tool che lo supportano.

---

## 🚀 Elenco dei Tool

### 💰 Finanza & Spesa
*   **Calcola Sconto**: inserisci prezzo, sconto e quantità per vedere risparmio per pezzo, risparmio totale e importo da pagare, con una barra visiva della percentuale.

### ⚡ Utilità & Produttività
*   **Data Sharing P2P**: scambio di messaggi, file e dati direttamente tra browser, in modalità peer-to-peer.
*   **PDF Tool**: conversione e gestione dei PDF interamente lato client.
*   **Convertitore Immagini**: conversione tra JPG, PNG, WebP e GIF con ottimizzazione visiva.
*   **Convertitore Universale**: conversione di lunghezza, peso, area, volume, velocità, tempo, dati digitali, pressione, energia, potenza, angoli e temperatura, con un tab dedicato alle valute in tempo reale.
*   **Convertitore Colori**: da HEX a RGB, HSL e CMYK, per grafica e sviluppo web.
*   **QR-Code Generator**: codici QR personalizzati per link, testi, password Wi-Fi e biglietti da visita digitali.
*   **Sole & Luna**: dashboard astronomica con cielo in 3D (Three.js), cursore temporale con riproduzione, ora d'oro e ora blu, fasi lunari e valutazione delle eclissi.
*   **Distanza Fulmine**: stima della distanza di un temporale dal tempo tra lampo e tuono.

### 🚗 Viaggi
*   **Costo Carburante**: litri e spesa di un tragitto in base a distanza e consumo, con opzione andata/ritorno e divisione del costo tra i passeggeri.
*   **Prezzo Carburanti**: cerca il distributore più economico usando i dati ufficiali MIMIT, aggiornati ogni giorno con una GitHub Action. Ricerca per zona o vicino a te, filtri per carburante e servizio, e un badge per i prezzi non aggiornati di recente.
*   **Orario Trasporti**: bus e treni dell'area di Bologna in tempo reale, con le relative fermate (Open Data TPER, HelloBus, ViaggiaTreno).

### ⏱️ Tempo
*   **Pomodoro Timer**: 25 minuti di lavoro e 5 di pausa con allarme audio.
*   **Timezone – Fusi Orari**: confronto visivo dell'orario simultaneo nelle città del mondo.
*   **Meteo**: previsioni e condizioni attuali con dati Open-Meteo.

### 📷 Foto & Video
*   **Esposimetro**: tempo di esposizione ottimale, con compensazione dei filtri ND e supporto all'astrofotografia.
*   **Aspect Ratio**: calcolo di proporzioni e risoluzioni con anteprima visiva in tempo reale.
*   **Film al Cinema**: film in programmazione e in uscita, con trailer e ricerca delle sale vicine.

### 🎮 Intrattenimento & Svago
*   **Il Gioco della Spia**: gioco di deduzione sociale da fare in compagnia, semplice, veloce, personalizzabile e senza pubblicità.
*   **Conteggio Parole**: analisi del testo con parole, caratteri, tempo di lettura stimato e densità delle parole chiave.
*   **Test Digitazione**: misura velocità e precisione con parole italiane casuali.

---

## 🔒 Area Riservata

Strumenti personali, visibili solo dopo il login dalla dashboard. Molti salvano i dati su Google Sheets tramite Google Apps Script, così restano disponibili da qualsiasi dispositivo.

*   **Spesa 2.0**: lista della spesa smart con storico dei prezzi, ordine delle corsie per ogni negozio, gesti swipe, autocompletamento delle marche, più negozi e più prezzi per prodotto. Accetta sia il punto che la virgola come separatore decimale.
*   **Cedolino+**: lettore di buste paga italiane. Carica il PDF, estrae i campi con l'API Gemini lato server, salva tutto su Google Sheets e mostra una dashboard con grafico dell'andamento, ricerca live e riepilogo.
*   **Traccia Pacchi**: traccia fino a 5 spedizioni contemporaneamente tramite Ship24, con notifiche Telegram a ogni cambio di stato.
*   **Spotify Family Tracker**: storico dei pagamenti trimestrali del piano Spotify Family e stato di chi ha pagato, con modifica protetta e dati su Google Sheets.
*   **REC**: strumenti per il giorno di riprese, divisi in sei sezioni (pre-produzione, luci e meteo, calcolatori tecnici, tracker di set, utilità e amministrazione). Include la modalità ciak a schermo intero (BUONA / DA RIFARE / NG), contatori automatici di scena e ciak, note vocali e liberatoria digitale con firma.
*   **GYM**: registro degli allenamenti in palestra con un video di esempio per l'esecuzione di ogni esercizio.

---

## 💻 Stack Tecnologico

Nessun framework di build per la parte statica: ogni pagina è HTML, CSS e JavaScript separati.

*   **HTML5 & CSS3**: Custom Properties, Flexbox, Grid, un foglio di stile per ogni pagina e sfondi generati interamente in CSS.
*   **JavaScript (ES6+)** per la logica client-side.
*   **Librerie**: Chart.js, PDF.js, Three.js, Lucide Icons, PeerJS.
*   **Backend leggero**: Google Apps Script e Google Sheets per i dati, Cloudflare Workers come proxy, GitHub Actions per gli aggiornamenti automatici dei dati.
*   **API e dati aperti**: MIMIT, Open-Meteo, TMDB, Ship24, Google Gemini, Bologna Open Data, HelloBus, ViaggiaTreno.
*   **Hosting**: GitHub Pages.

---
