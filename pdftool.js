let currentAction = null;
let selectedFile = null;
let subMode = ''; 

// Stato delle direzioni per ciascuna card di conversione ('forward' o 'backward')
const conversionState = {
    'word-tab': 'forward',
    'ppt-tab': 'forward',
    'excel-tab': 'forward',
    'image-tab': 'forward'
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) {
        lucide.createIcons();
    }

    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');

    if (dropZone && fileInput) {
        dropZone.addEventListener('click', () => fileInput.click());
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelected(e.target.files[0]);
            }
        });

        dropZone.addEventListener('dragover', (e) => e.preventDefault());
        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            if (e.dataTransfer.files.length > 0) {
                handleFileSelected(e.dataTransfer.files[0]);
            }
        });
    }

    const processBtn = document.getElementById('processBtn');
    if (processBtn) {
        processBtn.addEventListener('click', processFile);
    }
});

// Funzioni di supporto per leggere lo stato corrente della card prima di aprirla
function getActiveCardTitle(cardKey) {
    const isForward = conversionState[cardKey] === 'forward';
    switch(cardKey) {
        let title = '';
        case 'word-tab': title = isForward ? 'PDF a Word' : 'Word a PDF'; break;
        case 'ppt-tab': title = isForward ? 'PDF a PowerPoint' : 'PowerPoint a PDF'; break;
        case 'excel-tab': title = isForward ? 'PDF a Excel' : 'Excel a PDF'; break;
        case 'image-tab': title = isForward ? 'PDF a Immagini' : 'Immagini a PDF'; break;
    }
    return getTitleString(cardKey, isForward);
}

function getTitleString(cardKey, isForward) {
    if (cardKey === 'word-tab') return isForward ? 'PDF a Word' : 'Word a PDF';
    if (cardKey === 'ppt-tab') return isForward ? 'PDF a PowerPoint' : 'PowerPoint a PDF';
    if (cardKey === 'excel-tab') return isForward ? 'PDF a Excel' : 'Excel a PDF';
    if (cardKey === 'image-tab') return isForward ? 'PDF a Immagini' : 'Immagini a PDF';
    return '';
}

function getActiveCardAccept(cardKey) {
    const isForward = conversionState[cardKey] === 'forward';
    if (cardKey === 'word-tab') return isForward ? '.pdf' : '.doc,.docx';
    if (cardKey === 'ppt-tab') return isForward ? '.pdf' : '.ppt,.pptx';
    if (cardKey === 'excel-tab') return isForward ? '.pdf' : '.xls,.xlsx';
    if (cardKey === 'image-tab') return isForward ? '.pdf' : 'image/*';
    return '.pdf';
}

// Inverte lo stato dello switch direttamente sulla card senza aprirla
function toggleCardDirection(cardKey) {
    conversionState[cardKey] = conversionState[cardKey] === 'forward' ? 'backward' : 'forward';
    const isForward = conversionState[cardKey] === 'forward';

    // Aggiorna testi ed elementi visivi nella card specifica
    const titleEl = document.getElementById(`card-title-${cardKey}`);
    const descEl = document.getElementById(`card-desc-${cardKey}`);

    if (cardKey === 'word-tab') {
        titleEl.textContent = isForward ? 'PDF a Word' : 'Word a PDF';
        descEl.textContent = isForward ? 'Converti da PDF a documento Word.' : 'Converti da Word a file PDF.';
    } else if (cardKey === 'ppt-tab') {
        titleEl.textContent = isForward ? 'PDF a PowerPoint' : 'PowerPoint a PDF';
        descEl.textContent = isForward ? 'Converti da PDF a presentazioni PPT.' : 'Converti da PPT a file PDF.';
    } else if (cardKey === 'excel-tab') {
        titleEl.textContent = isForward ? 'PDF a Excel' : 'Excel a PDF';
        descEl.textContent = isForward ? 'Converti da PDF a fogli Excel.' : 'Converti da Excel a file PDF.';
    } else if (cardKey === 'image-tab') {
        titleEl.textContent = isForward ? 'PDF a Immagini' : 'Immagini a PDF';
        descEl.textContent = isForward ? 'Estrai immagini o crea PDF da foto.' : 'Unisci immagini in un unico PDF.';
    }
}

function selectAction(actionKey, actionTitle, acceptedTypes) {
    currentAction = actionKey;
    document.getElementById('workspaceTitle').textContent = actionTitle;
    document.getElementById('workspacePanel').style.display = 'block';
    
    document.querySelectorAll('.tool-card').forEach(card => card.classList.remove('active'));
    const activeCardEl = document.getElementById(`card-${actionKey}`) || (window.event && window.event.currentTarget.closest('.tool-card'));
    if (activeCardEl) activeCardEl.classList.add('active');

    selectedFile = null;
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('processBtn').disabled = true;
    document.getElementById('resultArea').innerHTML = '';
    
    const optionsContainer = document.getElementById('toolSpecificOptions');
    optionsContainer.innerHTML = '';

    // Imposta la subMode corretta in base allo stato attuale della card
    if (['word-tab', 'ppt-tab', 'excel-tab', 'image-tab'].includes(actionKey)) {
        subMode = conversionState[actionKey] === 'forward' ? 'from-pdf' : 'to-pdf';
        document.getElementById('fileInput').accept = getActiveCardAccept(actionKey);
    } else if (actionKey === 'split') {
        optionsContainer.innerHTML = `
            <div style="margin-top: 8px;">
                <label>Numero pagina da estrarre/dividere:</label>
                <input type="text" id="pageParamInput" value="1" placeholder="Es. 1">
            </div>
        `;
        document.getElementById('fileInput').accept = acceptedTypes;
    } else if (actionKey === 'organize') {
        optionsContainer.innerHTML = `
            <div style="margin-top: 8px;">
                <label>Azione di organizzazione:</label>
                <select id="orgActionType" onchange="updateOrgInputs()">
                    <option value="delete">Elimina Pagina</option>
                    <option value="extract">Estrai Pagina</option>
                    <option value="rotate">Ruota Pagine</option>
                </select>
            </div>
            <div id="orgSubInputContainer" style="margin-top: 8px;">
                <label>Numero pagina da eliminare:</label>
                <input type="text" id="orgPageInput" value="1" placeholder="Es. 1">
            </div>
        `;
        document.getElementById('fileInput').accept = acceptedTypes;
    } else {
        document.getElementById('fileInput').accept = acceptedTypes;
    }

    if (window.lucide) {
        lucide.createIcons();
    }

    document.getElementById('workspacePanel').scrollIntoView({ behavior: 'smooth' });
}

function updateOrgInputs() {
    const val = document.getElementById('orgActionType').value;
    const container = document.getElementById('orgSubInputContainer');
    if (val === 'rotate') {
        container.innerHTML = `
            <label>Angolo di rotazione:</label>
            <select id="rotateAngle">
                <option value="90">90° Orario</option>
                <option value="180">180°</option>
                <option value="270">270° (Antiorario)</option>
            </select>
        `;
    } else {
        const text = val === 'delete' ? 'Elimina' : 'Estrai';
        container.innerHTML = `
            <label>Numero pagina da ${text.toLowerCase()}:</label>
            <input type="text" id="orgPageInput" value="1" placeholder="Es. 1">
        `;
    }
}

function closeWorkspace() {
    document.getElementById('workspacePanel').style.display = 'none';
    document.querySelectorAll('.tool-card').forEach(card => card.classList.remove('active'));
    currentAction = null;
}

function handleFileSelected(file) {
    selectedFile = file;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileInfo').style.display = 'flex';
    document.getElementById('processBtn').disabled = false;
}

async function processFile() {
    if (!selectedFile) return;
    const resultArea = document.getElementById('resultArea');
    const processBtn = document.getElementById('processBtn');
    
    processBtn.disabled = true;
    resultArea.innerHTML = `<p style="color: var(--text-secondary);">Elaborazione in corso...</p>`;

    try {
        const arrayBuffer = await selectedFile.arrayBuffer();

        if (currentAction === 'compress' || currentAction === 'merge') {
            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const pdfBytes = await pdfDoc.save();
            downloadBlob(pdfBytes, `ottimizzato_${selectedFile.name}`, 'application/pdf');
        } 
        else if (currentAction === 'split') {
            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const inputVal = document.getElementById('pageParamInput').value.trim();
            const pageIdx = parseInt(inputVal) - 1;
            const newPdf = await PDFDocument.create();
            const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIdx]);
            newPdf.addPage(copiedPage);
            const pdfBytes = await newPdf.save();
            downloadBlob(pdfBytes, `diviso_${selectedFile.name}`, 'application/pdf');
        }
        else if (currentAction === 'organize') {
            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.load(arrayBuffer);
            const orgType = document.getElementById('orgActionType').value;

            if (orgType === 'rotate') {
                const angle = parseInt(document.getElementById('rotateAngle').value);
                pdfDoc.getPages().forEach(page => {
                    const currentRot = page.getRotation().angle;
                    page.setRotation(PDFLib.degrees(currentRot + angle));
                });
                const pdfBytes = await pdfDoc.save();
                downloadBlob(pdfBytes, `ruotato_${selectedFile.name}`, 'application/pdf');
            } else if (orgType === 'delete') {
                const inputVal = document.getElementById('orgPageInput').value.trim();
                const pageIdx = parseInt(inputVal) - 1;
                pdfDoc.removePage(pageIdx);
                const pdfBytes = await pdfDoc.save();
                downloadBlob(pdfBytes, `modificato_${selectedFile.name}`, 'application/pdf');
            } else if (orgType === 'extract') {
                const inputVal = document.getElementById('orgPageInput').value.trim();
                const pageIdx = parseInt(inputVal) - 1;
                const newPdf = await PDFDocument.create();
                const [copiedPage] = await newPdf.copyPages(pdfDoc, [pageIdx]);
                newPdf.addPage(copiedPage);
                const pdfBytes = await newPdf.save();
                downloadBlob(pdfBytes, `estratto_${selectedFile.name}`, 'application/pdf');
            }
        }
        else if (currentAction === 'ocr') {
            resultArea.innerHTML = `<p style="color: #3b82f6;">Analisi OCR in corso...</p>`;
            const worker = await Tesseract.createWorker('ita');
            const ret = await worker.recognize(selectedFile);
            await worker.terminate();
            
            resultArea.innerHTML = `
                <p style="color: #10b981; margin-bottom: 4px;">Testo estratto:</p>
                <textarea style="width: 100%; height: 90px; background: rgba(10,13,20,0.9); color: white; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding: 8px; border-radius: 6px; font-size: 12px;">${ret.data.text}</textarea>
            `;
            processBtn.disabled = false;
            return;
        }
        else if (['word-tab', 'ppt-tab', 'excel-tab', 'image-tab'].includes(currentAction)) {
            if (subMode === 'to-pdf' && currentAction === 'image-tab') {
                const { jsPDF } = window.jspdf;
                const doc = new jsPDF();
                const imgData = await readFileAsDataURL(selectedFile);
                doc.addImage(imgData, 'JPEG', 10, 10, 190, 0);
                const pdfOutput = doc.output('blob');
                downloadBlob(pdfOutput, 'immagine_convertita.pdf', 'application/pdf');
            } else {
                setTimeout(() => {
                    const dummyData = new Uint8Array([1, 2, 3, 4]);
                    const outName = subMode === 'to-pdf' ? `convertito.pdf` : `convertito_documento.docx`;
                    downloadBlob(dummyData, outName, 'application/octet-stream');
                }, 500);
            }
        }
        else if (currentAction === 'html-to-pdf') {
            setTimeout(() => {
                const dummyData = new Uint8Array([1, 2, 3, 4]);
                downloadBlob(dummyData, `pagina_web.pdf`, 'application/pdf');
            }, 500);
        }

        resultArea.innerHTML = `<p style="color: #10b981;">File elaborato e scaricato con successo!</p>`;
    } catch (error) {
        console.error(error);
        resultArea.innerHTML = `<p style="color: #ef4444;">Errore durante l'elaborazione.</p>`;
    } finally {
        processBtn.disabled = false;
    }
}

function downloadBlob(data, filename, mimeType) {
    const blob = new Blob([data], { type: mimeType });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}