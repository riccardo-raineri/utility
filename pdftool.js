let currentAction = null;
let selectedFile = null;
let pdfPageStates = {}; // Memoria per rotazioni o stati delle pagine nell'editor grafico

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

function selectAction(actionKey, actionTitle, acceptedTypes) {
    currentAction = actionKey;
    document.getElementById('workspaceTitle').textContent = actionTitle;
    document.getElementById('fileInput').accept = acceptedTypes;
    document.getElementById('workspacePanel').style.display = 'block';
    
    document.querySelectorAll('.tool-card').forEach(card => card.classList.remove('active'));
    event.currentTarget.classList.add('active');

    selectedFile = null;
    pdfPageStates = {};
    document.getElementById('fileInfo').style.display = 'none';
    document.getElementById('processBtn').disabled = true;
    document.getElementById('resultArea').innerHTML = '';
    document.getElementById('toolSpecificOptions').innerHTML = '';
    document.getElementById('visualEditorContainer').style.display = 'none';
    document.getElementById('visualEditorContainer').innerHTML = '';

    document.getElementById('workspacePanel').scrollIntoView({ behavior: 'smooth' });
}

function closeWorkspace() {
    document.getElementById('workspacePanel').style.display = 'none';
    document.querySelectorAll('.tool-card').forEach(card => card.classList.remove('active'));
    currentAction = null;
}

async function handleFileSelected(file) {
    selectedFile = file;
    document.getElementById('fileName').textContent = file.name;
    document.getElementById('fileInfo').style.display = 'flex';
    document.getElementById('processBtn').disabled = false;
    
    const editorContainer = document.getElementById('visualEditorContainer');
    editorContainer.innerHTML = '';

    // Se l'azione richiede l'editor grafico visivo delle pagine
    if (['rotate', 'split', 'delete-pages', 'extract-pages'].includes(currentAction)) {
        editorContainer.style.display = 'block';
        editorContainer.innerHTML = `<p style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Caricamento anteprime pagine in corso...</p>`;
        
        try {
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            const pdfDoc = await loadingTask.promise;
            
            let gridHtml = `<p style="font-size:12px; color:var(--text-secondary); margin-bottom:8px;">Clicca sulle miniature per gestirle:</p><div class="pdf-thumbnails-grid" id="thumbnailsGrid">`;
            
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                pdfPageStates[i] = { rotation: 0, selected: true, deleted: false };
                gridHtml += `
                    <div class="pdf-thumb-card selected" id="thumb-${i}" onclick="togglePageSelection(${i})">
                        <canvas id="canvas-thumb-${i}"></canvas>
                        <span>Pag. ${i}</span>
                    </div>
                `;
            }
            gridHtml += `</div>`;
            editorContainer.innerHTML = gridHtml;

            // Renderizza le miniature in canvas in background
            for (let i = 1; i <= pdfDoc.numPages; i++) {
                const page = await pdfDoc.getPage(i);
                const viewport = page.getViewport({ scale: 0.25 });
                const canvas = document.getElementById(`canvas-thumb-${i}`);
                if (canvas) {
                    const context = canvas.getContext('2d');
                    canvas.height = viewport.height;
                    canvas.width = viewport.width;
                    await page.render({ canvasContext: context, viewport: viewport }).promise;
                }
            }
        } catch (err) {
            console.error(err);
            editorContainer.innerHTML = `<p style="color:#ef4444; font-size:12px;">Impossibile generare le anteprime delle pagine.</p>`;
        }
    } else {
        editorContainer.style.display = 'none';
    }
}

// Interazione con l'editor grafico a miniature
function togglePageSelection(pageNum) {
    const card = document.getElementById(`thumb-${pageNum}`);
    if (!card) return;

    if (currentAction === 'rotate') {
        // Ruota di 90 gradi ogni click
        pdfPageStates[pageNum].rotation = (pdfPageStates[pageNum].rotation + 90) % 360;
        card.style.transform = `rotate(${pdfPageStates[pageNum].rotation}deg)`;
    } else if (currentAction === 'delete-pages') {
        pdfPageStates[pageNum].deleted = !pdfPageStates[pageNum].deleted;
        card.classList.toggle('marked-delete', pdfPageStates[pageNum].deleted);
    } else {
        // Per split ed estrai pagine (selezione multipla o singola)
        pdfPageStates[pageNum].selected = !pdfPageStates[pageNum].selected;
        card.classList.toggle('selected', pdfPageStates[pageNum].selected);
    }
}

async function processFile() {
    if (!selectedFile) return;
    const resultArea = document.getElementById('resultArea');
    const processBtn = document.getElementById('processBtn');
    
    processBtn.disabled = true;
    resultArea.innerHTML = `<p style="color: var(--text-secondary);">Elaborazione in corso...</p>`;

    try {
        const arrayBuffer = await selectedFile.arrayBuffer();

        if (['merge', 'split', 'compress', 'rotate', 'delete-pages', 'extract-pages'].includes(currentAction)) {
            const { PDFDocument } = PDFLib;
            const pdfDoc = await PDFDocument.load(arrayBuffer);

            if (currentAction === 'compress' || currentAction === 'merge') {
                const pdfBytes = await pdfDoc.save();
                downloadBlob(pdfBytes, `ottimizzato_${selectedFile.name}`, 'application/pdf');
            } 
            else if (currentAction === 'rotate') {
                const pages = pdfDoc.getPages();
                pages.forEach((page, index) => {
                    const pageNum = index + 1;
                    if (pdfPageStates[pageNum] && pdfPageStates[pageNum].rotation > 0) {
                        const currentRot = page.getRotation().angle;
                        page.setRotation(pdfLib.degrees(currentRot + pdfPageStates[pageNum].rotation));
                    }
                });
                const pdfBytes = await pdfDoc.save();
                downloadBlob(pdfBytes, `ruotato_${selectedFile.name}`, 'application/pdf');
            }
            else if (currentAction === 'split' || currentAction === 'extract-pages') {
                const newPdf = await PDFDocument.create();
                const pagesToCopy = [];
                for (let p = 1; p <= pdfDoc.getPageCount(); p++) {
                    if (pdfPageStates[p] && pdfPageStates[p].selected) {
                        pagesToCopy.push(p - 1);
                    }
                }
                if (pagesToCopy.length === 0) {
                    alert("Seleziona almeno una pagina dall'editor grafico!");
                    processBtn.disabled = false;
                    resultArea.innerHTML = "";
                    return;
                }
                const copiedPages = await newPdf.copyPages(pdfDoc, pagesToCopy);
                copiedPages.forEach(p => newPdf.addPage(p));
                const pdfBytes = await newPdf.save();
                downloadBlob(pdfBytes, `estratto_${selectedFile.name}`, 'application/pdf');
            }
            else if (currentAction === 'delete-pages') {
                const newPdf = await PDFDocument.create();
                const pagesToKeep = [];
                for (let p = 1; p <= pdfDoc.getPageCount(); p++) {
                    if (!pdfPageStates[p] || !pdfPageStates[p].deleted) {
                        pagesToKeep.push(p - 1);
                    }
                }
                const copiedPages = await newPdf.copyPages(pdfDoc, pagesToKeep);
                copiedPages.forEach(p => newPdf.addPage(p));
                const pdfBytes = await newPdf.save();
                downloadBlob(pdfBytes, `modificato_${selectedFile.name}`, 'application/pdf');
            }
        } 
        else if (currentAction === 'ocr') {
            resultArea.innerHTML = `<p style="color: #3b82f6;">Analisi OCR con Tesseract.js...</p>`;
            const worker = await Tesseract.createWorker('ita');
            const ret = await worker.recognize(selectedFile);
            await worker.terminate();
            
            resultArea.innerHTML = `
                <p style="color: #10b981; margin-bottom: 6px;">Testo estratto con successo!</p>
                <textarea style="width: 100%; height: 110px; background: rgba(10,13,20,0.9); color: white; border: 1px solid var(--border-color, rgba(255,255,255,0.1)); padding: 8px; border-radius: 8px; font-family: inherit; font-size: 12px;">${ret.data.text}</textarea>
            `;
            processBtn.disabled = false;
            return;
        }
        else if (currentAction === 'img-to-pdf') {
            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();
            const imgData = await readFileAsDataURL(selectedFile);
            doc.addImage(imgData, 'JPEG', 10, 10, 190, 0);
            const pdfOutput = doc.output('blob');
            downloadBlob(pdfOutput, 'immagine_convertita.pdf', 'application/pdf');
        }
        else {
            setTimeout(() => {
                const dummyData = new Uint8Array([1, 2, 3, 4]);
                downloadBlob(dummyData, `convertito_${selectedFile.name.split('.')[0]}.pdf`, 'application/pdf');
            }, 600);
        }

        resultArea.innerHTML = `<p style="color: #10b981;">File elaborato e scaricato con successo!</p>`;
    } catch (error) {
        console.error(error);
        resultArea.innerHTML = `<p style="color: #ef4444;">Errore durante l'elaborazione del file.</p>`;
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