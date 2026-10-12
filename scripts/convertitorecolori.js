/* =====================================================================
   CONVERTITORECOLORI.JS — Logica di Conversione e Gestione UI
   ===================================================================== */

document.addEventListener('DOMContentLoaded', () => {
    // Inizializzazione Lucide Icons
    if (window.lucide) {
        lucide.createIcons();
    }

    // Elementi DOM Input & Swatch
    const hexInput = document.getElementById('hexInput');
    const nativeColorPicker = document.getElementById('nativeColorPicker');
    const swatchPreview = document.getElementById('swatchPreview');
    const swatchHint = document.getElementById('swatchHint');
    const inputGroup = hexInput.closest('.input-group');

    // Output RGB
    const resRgb = document.getElementById('resRgb');
    const valR = document.getElementById('valR');
    const valG = document.getElementById('valG');
    const valB = document.getElementById('valB');
    const barR = document.getElementById('barR');
    const barG = document.getElementById('barG');
    const barB = document.getElementById('barB');

    // Output HSL
    const resHsl = document.getElementById('resHsl');
    const valH = document.getElementById('valH');
    const valS = document.getElementById('valS');
    const valL = document.getElementById('valL');

    // Output CMYK
    const resCmyk = document.getElementById('resCmyk');
    const valC = document.getElementById('valC');
    const valM = document.getElementById('valM');
    const valY = document.getElementById('valY');
    const valK = document.getElementById('valK');

    // Controlli Tema
    const themeToggle = document.getElementById('themeToggle');

    /* -----------------------------------------------------------------
       1. ALGORITMI DI CONVERSIONE COLORE
       ----------------------------------------------------------------- */

    // Normalizza e valida stringa HEX (supporta #FFF e #FFFFFF)
    function parseHex(hexStr) {
        let cleanHex = hexStr.trim().replace(/^#/, '');

        if (cleanHex.length === 3) {
            cleanHex = cleanHex.split('').map(c => c + c).join('');
        }

        if (!/^[0-9A-Fa-f]{6}$/.test(cleanHex)) {
            return null;
        }

        const num = parseInt(cleanHex, 16);
        return {
            r: (num >> 16) & 255,
            g: (num >> 8) & 255,
            b: num & 255,
            hexFormatted: cleanHex.toUpperCase()
        };
    }

    // Converti RGB in HSL
    function rgbToHsl(r, g, b) {
        const rNorm = r / 255;
        const gNorm = g / 255;
        const bNorm = b / 255;

        const max = Math.max(rNorm, gNorm, bNorm);
        const min = Math.min(rNorm, gNorm, bNorm);
        let h = 0, s = 0;
        const l = (max + min) / 2;

        if (max !== min) {
            const d = max - min;
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

            switch (max) {
                case rNorm: h = (gNorm - bNorm) / d + (gNorm < bNorm ? 6 : 0); break;
                case gNorm: h = (bNorm - rNorm) / d + 2; break;
                case bNorm: h = (rNorm - gNorm) / d + 4; break;
            }
            h /= 6;
        }

        return {
            h: Math.round(h * 360),
            s: Math.round(s * 100),
            l: Math.round(l * 100)
        };
    }

    // Converti RGB in CMYK
    function rgbToCmyk(r, g, b) {
        if (r === 0 && g === 0 && b === 0) {
            return { c: 0, m: 0, y: 0, k: 100 };
        }

        const rNorm = r / 255;
        const gNorm = g / 255;
        const bNorm = b / 255;

        const k = 1 - Math.max(rNorm, gNorm, bNorm);
        const c = (1 - rNorm - k) / (1 - k);
        const m = (1 - gNorm - k) / (1 - k);
        const y = (1 - bNorm - k) / (1 - k);

        return {
            c: Math.round(c * 100),
            m: Math.round(m * 100),
            y: Math.round(y * 100),
            k: Math.round(k * 100)
        };
    }

    // Calcola la luminosità percepita (per il contrasto del testo del badge)
    function getContrastTextColor(r, g, b) {
        const yiq = ((r * 299) + (g * 587) + (b * 114)) / 1000;
        return yiq >= 128 ? '#0f172a' : '#ffffff';
    }

    /* -----------------------------------------------------------------
       2. AGGIORNAMENTO UI
       ----------------------------------------------------------------- */

    function updateColorValues(hexString, isFromNativePicker = false) {
        const rgb = parseHex(hexString);

        if (!rgb) {
            inputGroup.classList.add('invalid');
            return;
        }

        inputGroup.classList.remove('invalid');

        const { r, g, b, hexFormatted } = rgb;
        const hsl = rgbToHsl(r, g, b);
        const cmyk = rgbToCmyk(r, g, b);

        // Update Swatch & Picker
        const hexFull = `#${hexFormatted}`;
        swatchPreview.style.backgroundColor = hexFull;
        if (!isFromNativePicker) {
            nativeColorPicker.value = hexFull;
        }

        // Regola il testo dentro lo swatch per contrasto
        const textColor = getContrastTextColor(r, g, b);
        swatchHint.style.color = textColor;
        swatchHint.style.backgroundColor = textColor === '#ffffff' ? 'rgba(0, 0, 0, 0.4)' : 'rgba(255, 255, 255, 0.5)';

        // 1. Output RGB
        resRgb.textContent = `rgb(${r}, ${g}, ${b})`;
        valR.textContent = r;
        valG.textContent = g;
        valB.textContent = b;
        barR.style.width = `${(r / 255) * 100}%`;
        barG.style.width = `${(g / 255) * 100}%`;
        barB.style.width = `${(b / 255) * 100}%`;

        // 2. Output HSL
        resHsl.textContent = `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
        valH.textContent = `${hsl.h}°`;
        valS.textContent = `${hsl.s}%`;
        valL.textContent = `${hsl.l}%`;

        // 3. Output CMYK
        resCmyk.textContent = `cmyk(${cmyk.c}%, ${cmyk.m}%, ${cmyk.y}%, ${cmyk.k}%)`;
        valC.textContent = `${cmyk.c}%`;
        valM.textContent = `${cmyk.m}%`;
        valY.textContent = `${cmyk.y}%`;
        valK.textContent = `${cmyk.k}%`;
    }

    /* -----------------------------------------------------------------
       3. GESTIONE EVENTI E LISTENERS
       ----------------------------------------------------------------- */

    // Evento Input Testo HEX
    hexInput.addEventListener('input', (e) => {
        updateColorValues(e.target.value);
    });

    // Evento Picker Nativo
    nativeColorPicker.addEventListener('input', (e) => {
        const selectedHex = e.target.value.replace('#', '');
        hexInput.value = selectedHex.toUpperCase();
        updateColorValues(selectedHex, true);
    });

    // Bottone Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const hexVal = btn.getAttribute('data-hex');
            hexInput.value = hexVal;
            updateColorValues(hexVal);
        });
    });

    // Gestore Copia Negli Appunti
    function setupCopyButton(btnId, getText) {
        const btn = document.getElementById(btnId);
        if (!btn) return;

        btn.addEventListener('click', () => {
            const textToCopy = getText();
            navigator.clipboard.writeText(textToCopy).then(() => {
                const span = btn.querySelector('span');
                const originalText = span ? span.textContent : '';

                if (span) span.textContent = 'Copiato!';
                btn.style.borderColor = 'var(--accent)';

                setTimeout(() => {
                    if (span) span.textContent = originalText;
                    btn.style.borderColor = '';
                }, 1400);
            });
        });
    }

    setupCopyButton('btnCopyHex', () => `#${hexInput.value.trim().replace(/^#/, '').toUpperCase()}`);
    setupCopyButton('btnCopyRgb', () => resRgb.textContent);
    setupCopyButton('btnCopyHsl', () => resHsl.textContent);
    setupCopyButton('btnCopyCmyk', () => resCmyk.textContent);

    /* -----------------------------------------------------------------
       4. GESTIONE TEMA (Light / Dark)
       ----------------------------------------------------------------- */
    function initTheme() {
        const savedTheme = localStorage.getItem('color_studio_theme');
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
            localStorage.setItem('color_studio_theme', 'light');
        } else {
            document.body.setAttribute('data-theme', 'dark');
            localStorage.setItem('color_studio_theme', 'dark');
        }
    });

    // Inizializzazione Primo Avvio
    initTheme();
    updateColorValues(hexInput.value);
});