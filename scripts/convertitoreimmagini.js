// Configurazione PDF.js Worker
if (window.pdfjsLib) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

let loadedImage = null;
let originalFile = null;
let originalFileName = "";
let convertedBlob = null;
let convertedUrl = null;
let aspectRatio = 1;

document.addEventListener('DOMContentLoaded', () => {
    applyStoredTheme();
    refreshIcons();
});

function refreshIcons() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

/* -----------------------------------------------------------------
   GESTIONE TEMA
   ----------------------------------------------------------------- */
function applyStoredTheme() {
    const stored = localStorage.getItem('toolbox_theme');
    if (stored === 'light') {
        document.body.setAttribute('data-theme', 'light');
    } else {
        document.body.removeAttribute('data-theme');
    }
}

function toggleTheme() {
    const body = document.body;
    const isLight = body.getAttribute('data-theme') === 'light';
    if (isLight) {
        body.removeAttribute('data-theme');
        localStorage.setItem('toolbox_theme', 'dark');
    } else {
        body.setAttribute('data-theme', 'light');
        localStorage.setItem('toolbox_theme', 'light');
    }
}

/* -----------------------------------------------------------------
   GESTIONE DRAG & DROP E ELABORAZIONE INGRESSO
   ----------------------------------------------------------------- */
const dropZone = document.getElementById('drop-zone');
['dragenter', 'dragover'].forEach(name => dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.add('drag-over'); }));
['dragleave', 'drop'].forEach(name => dropZone.addEventListener(name, (e) => { e.preventDefault(); dropZone.classList.remove('drag-over'); }));
dropZone.addEventListener('drop', (e) => { if (e.dataTransfer.files.length) processFile(e.dataTransfer.files[0]); });

function handleFileSelect(e) { if (e.target.files.length) processFile(e.target.files[0]); }

async function processFile(file) {
    originalFile = file;
    originalFileName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
    const ext = file.name.split('.').pop().toLowerCase();

    let imageDataUrl = "";

    try {
        // 1. Gestione Formato Apple HEIC / HEIF
        if (ext === 'heic' || ext === 'heif') {
            if (typeof heic2any !== 'undefined') {
                const convertedBlob = await heic2any({ blob: file, toType: "image/png" });
                imageDataUrl = URL.createObjectURL(Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob);
            } else {
                alert("Libreria HEIC non caricata.");
                return;
            }
        } 
        // 2. Gestione Documenti PDF (Conversione Prima Pagina in Immagine)
        else if (ext === 'pdf') {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdf.getPage(1);
            const viewport = page.getViewport({ scale: 2.0 });
            
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await page.render({ canvasContext: ctx, viewport: viewport }).promise;
            imageDataUrl = canvas.toDataURL('image/png');
        }
        // 3. Immagini Standard, SVG e altri formati
        else {
            imageDataUrl = await readFileAsDataURL(file);
        }

        // Caricamento nell'oggetto Image HTML per le operazioni successive
        const img = new Image();
        img.onload = () => {
            loadedImage = img;
            aspectRatio = img.width / img.height;

            document.getElementById('preview-img').src = imageDataUrl;
            document.getElementById('file-name').textContent = file.name;
            document.getElementById('file-meta').textContent = `${img.width}×${img.height} px • ${formatBytes(file.size)}`;

            document.getElementById('resize-width').value = img.width;
            document.getElementById('resize-height').value = img.height;

            document.getElementById('drop-zone').style.display = 'none';
            document.getElementById('file-preview').style.display = 'flex';
            document.getElementById('options-group').style.display = 'block';

            toggleQualityControl();
            hideResults();
            refreshIcons();
        };
        img.src = imageDataUrl;

    } catch (err) {
        console.error(err);
        alert("Errore nella lettura del file. Assicurati che sia un formato valido.");
    }
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

/* -----------------------------------------------------------------
   CONTROLLO OPZIONI E RIDIMENSIONAMENTO
   ----------------------------------------------------------------- */
function handleDimensionChange(type) {
    if (!document.getElementById('keep-aspect').checked || !aspectRatio) return;
    const wInput = document.getElementById('resize-width');
    const hInput = document.getElementById('resize-height');

    if (type === 'width' && wInput.value) {
        hInput.value = Math.round(wInput.value / aspectRatio);
    } else if (type === 'height' && hInput.value) {
        wInput.value = Math.round(hInput.value * aspectRatio);
    }
}

function toggleQualityControl() {
    const format = document.getElementById('format-select').value;
    const qualityFormats = ['image/jpeg', 'image/webp', 'image/avif'];
    document.getElementById('quality-group').style.display = qualityFormats.includes(format) ? 'block' : 'none';
    hideResults();
}

function updateQualityText(val) { document.getElementById('quality-value').textContent = val + '%'; }

/* -----------------------------------------------------------------
   ELABORAZIONE E CONVERSIONE IN USCITA
   ----------------------------------------------------------------- */
async function processConversion() {
    if (!loadedImage) return;

    const format = document.getElementById('format-select').value;
    const quality = parseFloat(document.getElementById('quality-range').value) / 100;
    const targetWidth = parseInt(document.getElementById('resize-width').value) || loadedImage.width;
    const targetHeight = parseInt(document.getElementById('resize-height').value) || loadedImage.height;

    // 1. Esportazione Speciale verso PDF
    if (format === 'application/pdf') {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
            orientation: targetWidth > targetHeight ? 'landscape' : 'portrait',
            unit: 'px',
            format: [targetWidth, targetHeight]
        });

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(loadedImage, 0, 0, targetWidth, targetHeight);

        const imgData = tempCanvas.toDataURL('image/jpeg', 0.95);
        doc.addImage(imgData, 'JPEG', 0, 0, targetWidth, targetHeight);
        
        convertedBlob = doc.output('blob');
        showResult(convertedBlob, document.getElementById('preview-img').src, URL.createObjectURL(convertedBlob));
        return;
    }

    // 2. Esportazione Vettoriale SVG (Wrapping Raster-in-SVG)
    if (format === 'image/svg+xml') {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = targetWidth;
        tempCanvas.height = targetHeight;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(loadedImage, 0, 0, targetWidth, targetHeight);

        const pngData = tempCanvas.toDataURL('image/png');
        const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${targetWidth}" height="${targetHeight}">
            <image href="${pngData}" width="${targetWidth}" height="${targetHeight}"/>
        </svg>`;

        convertedBlob = new Blob([svgString], { type: 'image/svg+xml' });
        showResult(convertedBlob, document.getElementById('preview-img').src, URL.createObjectURL(convertedBlob));
        return;
    }

    // 3. Esportazione Canvas Standard (PNG, JPG, WEBP, ICO, TIFF, GIF)
    const canvas = document.createElement('canvas');
    canvas.width = targetWidth;
    canvas.height = targetHeight;
    const ctx = canvas.getContext('2d');

    // Sfondo bianco se si converte verso formati che non supportano trasparenza
    if (format === 'image/jpeg') {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    ctx.drawImage(loadedImage, 0, 0, targetWidth, targetHeight);

    // Mappatura formati per Canvas
    let exportMime = format;
    if (format === 'image/x-icon' || format === 'image/tiff') {
        exportMime = 'image/png'; // Fallback compatibile per generare il blob di anteprima
    }

    canvas.toBlob((blob) => {
        if (!blob) return alert("Formato non supportato nativamente dal browser.");

        convertedBlob = blob;
        const resultUrl = URL.createObjectURL(blob);
        showResult(blob, document.getElementById('preview-img').src, resultUrl);
    }, exportMime, quality);
}

function showResult(blob, beforeUrl, afterUrl) {
    if (convertedUrl) URL.revokeObjectURL(convertedUrl);
    convertedUrl = afterUrl;

    document.getElementById('compare-before-img').src = beforeUrl;
    document.getElementById('compare-after-img').src = afterUrl;

    const origBytes = originalFile.size;
    const newBytes = blob.size;
    const diffPerc = (((newBytes - origBytes) / origBytes) * 100).toFixed(1);

    document.getElementById('stat-orig-size').textContent = formatBytes(origBytes);
    document.getElementById('stat-new-size').textContent = formatBytes(newBytes);

    const diffElem = document.getElementById('stat-diff-perc');
    diffElem.textContent = (diffPerc > 0 ? '+' : '') + diffPerc + '%';
    diffElem.style.color = diffPerc <= 0 ? 'var(--color-success)' : 'var(--color-danger)';

    document.getElementById('result-section').style.display = 'block';
    refreshIcons();
    setTimeout(() => updateSliderPosition(50), 50);
}

/* -----------------------------------------------------------------
   SLIDER COMPARAZIONE & DOWNLOAD
   ----------------------------------------------------------------- */
function updateSliderPosition(value) {
    const wrapper = document.getElementById('slider-before-wrapper');
    const handle = document.getElementById('slider-handle');
    const container = document.getElementById('slider-container');
    const beforeImg = document.getElementById('compare-before-img');
    if (wrapper) wrapper.style.width = value + '%';
    if (handle) handle.style.left = value + '%';
    if (container && beforeImg) beforeImg.style.width = container.offsetWidth + 'px';
}

function downloadFile() {
    if (!convertedUrl) return;
    const format = document.getElementById('format-select').value;
    
    const extMap = {
        'image/png': 'png',
        'image/jpeg': 'jpg',
        'image/webp': 'webp',
        'image/avif': 'avif',
        'image/gif': 'gif',
        'image/x-icon': 'ico',
        'image/svg+xml': 'svg',
        'image/tiff': 'tiff',
        'application/pdf': 'pdf'
    };

    const link = document.createElement('a');
    link.download = `${originalFileName}_convertito.${extMap[format] || 'png'}`;
    link.href = convertedUrl;
    link.click();
}

function hideResults() { document.getElementById('result-section').style.display = 'none'; }

function resetFile() {
    loadedImage = null;
    originalFile = null;
    if (convertedUrl) URL.revokeObjectURL(convertedUrl);
    convertedUrl = null;

    document.getElementById('file-input').value = "";
    document.getElementById('drop-zone').style.display = 'block';
    document.getElementById('file-preview').style.display = 'none';
    document.getElementById('options-group').style.display = 'none';
    hideResults();
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Byte';
    const k = 1024, sizes = ['Byte', 'KB', 'MB', 'GB'], i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}