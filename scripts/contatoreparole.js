/* =====================================================================
   CONTATOREPAROLE.JS — Logica Applicativa e Gestione Tema
   ===================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Inizializzazione Icone Lucide
    if (window.lucide) {
        lucide.createIcons();
    }

    // Elementi DOM
    const textInput = document.getElementById('textInput');
    const btnSample = document.getElementById('btnSample');
    const btnCopy = document.getElementById('btnCopy');
    const btnClear = document.getElementById('btnClear');
    const toggleStopwords = document.getElementById('toggleStopwords');
    const themeToggle = document.getElementById('themeToggle');

    // Elementi Output Statistiche
    const valWords = document.getElementById('valWords');
    const valReadTime = document.getElementById('valReadTime');
    const valCharsWithSpaces = document.getElementById('valCharsWithSpaces');
    const valCharsNoSpaces = document.getElementById('valCharsNoSpaces');
    const valSyllables = document.getElementById('valSyllables');
    const valSentencesParagraphs = document.getElementById('valSentencesParagraphs');
    const charLimitNotice = document.getElementById('charLimitNotice');
    const keywordsList = document.getElementById('keywordsList');

    // Lista Stopwords Italiane
    const stopwordsIT = new Set([
        "a", "ad", "al", "allo", "ai", "agli", "all", "alla", "alle", "con", "col", "coi", "da", "dal", "dallo", "dai",
        "dagli", "dall", "dalla", "dalle", "di", "del", "dello", "dei", "degli", "dell", "della", "delle", "in", "nel",
        "nello", "nei", "negli", "nell", "nella", "nelle", "su", "sul", "sullo", "sui", "sugli", "sull", "sulla", "sulle",
        "per", "tra", "fra", "il", "lo", "i", "gli", "la", "le", "l", "un", "uno", "una", "un", "e", "ed", "o", "od",
        "ma", "se", "perché", "anche", "come", "che", "chi", "cui", "non", "più", "molto", "questo", "questa", "questi",
        "queste", "quello", "quella", "quelli", "quelle", "sono", "sia", "stato", "è", "era", "erano", "ha", "hanno",
        "ci", "vi", "ne", "si", "mi", "ti", "lo", "la", "li", "le", "noi", "voi", "loro"
    ]);

    // Sample Text
    const sampleText = `La scrittura editoriale richiede precisione, equilibrio e cura della struttura. Attraverso questo strumento di analisi puoi monitorare costantemente le metriche chiave del tuo testo: dalla densità delle parole chiave alla stima dei tempi di lettura.

Ogni parola contribuisce a creare chiarezza. Buona stesura del tuo documento!`;

    /* -----------------------------------------------------------------
       1. GESTIONE TEMA (Light / Dark)
       ----------------------------------------------------------------- */
    function initTheme() {
        const savedTheme = localStorage.getItem('editorial_theme');
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.setAttribute('data-theme', 'dark');
        } else {
            document.body.removeAttribute('data-theme');
        }
    }

    themeToggle.addEventListener('click', () => {
        const isDark = document.body.getAttribute('data-theme') === 'dark';
        if (isDark) {
            document.body.removeAttribute('data-theme');
            localStorage.setItem('editorial_theme', 'light');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('editorial_theme', 'dark');
        }
    });

    initTheme();

    /* -----------------------------------------------------------------
       2. CALCOLO E METRICHE DI TESTO
       ----------------------------------------------------------------- */
    function analyzeText() {
        const text = textInput.value;

        // Caratteri
        const charCountWithSpaces = text.length;
        const charCountNoSpaces = text.replace(/\s/g, '').length;

        // Parole
        const wordsArray = text.trim().toLowerCase().match(/\b[a-zàèéìòóùçA-ZÀÈÉÌÒÓÙÇ0-9']+\b/g) || [];
        const wordCount = wordsArray.length;

        // Tempo di Lettura (Media 200 parole/minuto)
        const readingSeconds = Math.ceil((wordCount / 200) * 60);
        const readTimeStr = readingSeconds < 60 
            ? `${readingSeconds} sec` 
            : `${Math.floor(readingSeconds / 60)}m ${readingSeconds % 60}s`;

        // Frasi e Paragrafi
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
        const paragraphs = text.split(/\n+/).filter(p => p.trim().length > 0).length;

        // Stima Sillabe (Approssimazione basata sui nuclei vocalici)
        let totalSyllables = 0;
        wordsArray.forEach(w => {
            const matches = w.match(/[aeiouàèéìòóù]/gi);
            totalSyllables += matches ? matches.length : 1;
        });

        // Aggiornamento DOM Statistiche
        valWords.textContent = wordCount.toLocaleString();
        valReadTime.textContent = wordCount === 0 ? '0 sec' : readTimeStr;
        valCharsWithSpaces.textContent = charCountWithSpaces.toLocaleString();
        valCharsNoSpaces.textContent = charCountNoSpaces.toLocaleString();
        valSyllables.textContent = totalSyllables.toLocaleString();
        valSentencesParagraphs.textContent = `${sentences} / ${paragraphs}`;
        charLimitNotice.textContent = `${charCountWithSpaces.toLocaleString()} caratteri inseriti`;

        // Analisi Densità Parole
        renderKeywords(wordsArray);
    }

    /* -----------------------------------------------------------------
       3. DENSITÀ PAROLE CHIAVE
       ----------------------------------------------------------------- */
    function renderKeywords(words) {
        if (words.length === 0) {
            keywordsList.innerHTML = `<div class="empty-keywords">Inserisci del testo per visualizzare l'analisi</div>`;
            return;
        }

        const filterStopwords = toggleStopwords.checked;
        const freqMap = {};

        words.forEach(word => {
            const cleanWord = word.toLowerCase();
            if (cleanWord.length <= 1) return;
            if (filterStopwords && stopwordsIT.has(cleanWord)) return;

            freqMap[cleanWord] = (freqMap[cleanWord] || 0) + 1;
        });

        const sortedKeywords = Object.entries(freqMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5);

        if (sortedKeywords.length === 0) {
            keywordsList.innerHTML = `<div class="empty-keywords">Nessuna parola chiave rilevata</div>`;
            return;
        }

        const maxCount = sortedKeywords[0][1];
        keywordsList.innerHTML = '';

        sortedKeywords.forEach(([word, count]) => {
            const percentage = ((count / words.length) * 100).toFixed(1);
            const fillWidth = Math.max((count / maxCount) * 100, 8);

            const row = document.createElement('div');
            row.className = 'keyword-row';
            row.innerHTML = `
                <div class="keyword-info">
                    <span class="keyword-word">${word}</span>
                    <span class="keyword-metrics">${count} (${percentage}%)</span>
                </div>
                <div class="keyword-bar-bg">
                    <div class="keyword-bar-fill" style="width: ${fillWidth}%"></div>
                </div>
            `;
            keywordsList.appendChild(row);
        });
    }

    /* -----------------------------------------------------------------
       4. EVENT LISTENERS
       ----------------------------------------------------------------- */
    textInput.addEventListener('input', analyzeText);
    toggleStopwords.addEventListener('change', analyzeText);

    btnSample.addEventListener('click', () => {
        textInput.value = sampleText;
        analyzeText();
    });

    btnClear.addEventListener('click', () => {
        textInput.value = '';
        analyzeText();
        textInput.focus();
    });

    btnCopy.addEventListener('click', () => {
        if (!textInput.value) return;
        navigator.clipboard.writeText(textInput.value).then(() => {
            const originalText = btnCopy.querySelector('span').textContent;
            btnCopy.querySelector('span').textContent = 'Copiato!';
            setTimeout(() => {
                btnCopy.querySelector('span').textContent = originalText;
            }, 1500);
        });
    });
});