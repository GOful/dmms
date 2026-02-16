let lastPdfRenderId = 0; // PDF 렌더링 중복 방지용 ID
let currentPdfDoc = null; // 현재 로드된 PDF 문서 객체
let currentPdfScale = 1.5; // PDF 렌더링 배율

/**
 * [기능] 모달 내부에 PDF 뷰어를 렌더링합니다.
 * @param {string} type - 매뉴얼 타입 (파일명으로 사용)
 * @param {string} currentMenuTarget - 현재 활성화된 메뉴 타겟
 * @param {string[]} PDF_MENU_TARGETS - PDF 뷰어로 바로 연결되는 메뉴 타겟 목록
 * @param {function} closePdfManualCb - PDF 뷰어를 닫고 이전 화면으로 복귀하는 콜백
 */
export async function viewPdfManual(type, currentMenuTarget, PDF_MENU_TARGETS, closePdfManualCb) {
    const currentRenderId = Date.now();
    lastPdfRenderId = currentRenderId;

    const modalBody = document.getElementById('modal-body');
    const pdfPath = `manuals/${type}.pdf`; 

    const isSafetyMenu = PDF_MENU_TARGETS.includes(currentMenuTarget);
    const btnText = isSafetyMenu ? '닫기' : '목록으로 돌아가기';
    const btnTextMobile = isSafetyMenu ? '닫기' : '목록';
    const btnIconPath = isSafetyMenu ? 'M6 18L18 6M6 6l12 12' : 'M10 19l-7-7m0 0l7-7m-7 7h18';
    
    currentPdfScale = 1.0;
    currentPdfDoc = null;

    modalBody.innerHTML = `
        <div class="flex flex-col h-full min-h-[600px]">
            <div class="flex justify-between items-center mb-4">
                <h4 class="font-bold text-slate-700 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd" />
                    </svg>
                    사용 매뉴얼
                </h4>
                <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-1 mr-2">
                    <button id="pdf-zoom-out-btn" class="p-1 hover:bg-white rounded-md text-slate-600 transition-colors" title="축소">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
                    </button>
                    <span id="pdf-zoom-level" class="text-xs font-mono w-12 text-center text-slate-500">${Math.round(currentPdfScale * 100)}%</span>
                    <button id="pdf-zoom-in-btn" class="p-1 hover:bg-white rounded-md text-slate-600 transition-colors" title="확대">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
                    </button>
                </div>
                <div class="flex gap-2">
                    <a href="${pdfPath}" download class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-colors shadow-sm flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        <span class="hidden sm:inline">다운로드</span>
                        <span class="sm:hidden">저장</span>
                    </a>
                    <button id="pdf-close-btn" class="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm transition-colors shadow-sm flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${btnIconPath}" /></svg>
                        <span class="hidden sm:inline">${btnText}</span>
                        <span class="sm:hidden">${btnTextMobile}</span>
                    </button>
                </div>
            </div>
            <div id="pdf-viewer-container" class="flex-1 bg-slate-200/50 rounded-xl border border-slate-200 overflow-auto p-2 sm:p-4 flex flex-col items-center gap-4 relative min-h-[400px]">
                <div id="pdf-loading-spinner" class="absolute inset-0 flex flex-col items-center justify-center z-10">
                    <div class="w-10 h-10 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-3"></div>
                    <span class="text-slate-500 font-medium animate-pulse">PDF 문서를 불러오는 중...</span>
                </div>
            </div>
        </div>
    `;

    // 이벤트 리스너 바인딩
    document.getElementById('pdf-zoom-out-btn').addEventListener('click', () => changePdfZoom(0.2));
    document.getElementById('pdf-zoom-in-btn').addEventListener('click', () => changePdfZoom(0.2));
    document.getElementById('pdf-close-btn').addEventListener('click', closePdfManualCb);

    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        const loadingTask = pdfjsLib.getDocument(pdfPath);
        currentPdfDoc = await loadingTask.promise;
        await renderCurrentPdf(currentRenderId);
    } catch (error) {
        if (lastPdfRenderId !== currentRenderId) return;
        console.error('PDF Rendering Error:', error);
        const container = document.getElementById('pdf-viewer-container');
        if(container) {
            container.innerHTML = `
                <div class="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-slate-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <p class="font-bold text-lg text-slate-700 mb-2">문서를 표시할 수 없습니다.</p>
                    <a href="${pdfPath}" download class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors shadow-sm mt-4">
                        파일 직접 다운로드
                    </a>
                </div>
            `;
        }
    }
}

/**
 * [기능] 현재 로드된 PDF 문서를 설정된 배율로 렌더링합니다.
 */
async function renderCurrentPdf(renderId) {
    if (!currentPdfDoc || lastPdfRenderId !== renderId) return;

    const container = document.getElementById('pdf-viewer-container');
    if(container) container.innerHTML = ''; // 기존 내용 초기화

    const zoomLabel = document.getElementById('pdf-zoom-level');
    if(zoomLabel) zoomLabel.innerText = `${Math.round(currentPdfScale * 100)}%`;

    for (let pageNum = 1; pageNum <= currentPdfDoc.numPages; pageNum++) {
        if (lastPdfRenderId !== renderId) return;
        
        const page = await currentPdfDoc.getPage(pageNum);
        const viewport = page.getViewport({ scale: currentPdfScale });
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        canvas.className = "shadow-lg rounded-lg bg-white mb-4 last:mb-0 max-w-none";
        canvas.style.maxWidth = 'none';
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        if(container) container.appendChild(canvas);
        await page.render(renderContext).promise;
    }
}

/**
 * [기능] PDF 줌 레벨을 변경하고 다시 렌더링합니다.
 */
function changePdfZoom(delta) {
    const newScale = currentPdfScale + delta;
    if (newScale < 0.5 || newScale > 5.0) return;
    currentPdfScale = newScale;
    // lastPdfRenderId를 사용하여 현재 렌더링 작업에 대해서만 실행
    renderCurrentPdf(lastPdfRenderId);
}
