/**
 * 모달 안 PDF 뷰어 (PDF.js — 모바일에서도 보이도록 canvas 로 직접 그림)
 */
import { openModal } from './modal.js';

const WORKER_SRC = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
const ZOOM_STEP = 0.2;
const ZOOM_RANGE = [0.5, 5.0];

const BACK_BUTTONS = {
    close: { label: '닫기', short: '닫기', icon: 'M6 18L18 6M6 6l12 12' },
    list: { label: '목록으로 돌아가기', short: '목록', icon: 'M10 19l-7-7m0 0l7-7m-7 7h18' },
};

// 다른 문서로 바뀌면 이전 렌더링을 중단하기 위한 식별자
const viewer = { doc: null, scale: 1.0, renderId: 0 };

/**
 * PDF 열기
 * @param {string} name manuals/{name}.pdf
 * @param {string} title 모달 제목
 * @param {{ back: 'close' | 'list', onBack: Function }} options 왼쪽 위 버튼 종류와 동작
 */
export async function showPdf(name, title, { back, onBack }) {
    const path = `manuals/${name}.pdf`;
    const button = BACK_BUTTONS[back];
    const renderId = ++viewer.renderId;
    viewer.doc = null;
    viewer.scale = 1.0;

    const body = openModal(title, `
        <div class="flex flex-col h-full min-h-[600px]">
            <div class="flex justify-between items-center mb-4">
                <h4 class="font-bold text-slate-700 flex items-center gap-2">
                    <svg class="h-5 w-5 text-red-500" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clip-rule="evenodd"/></svg>
                    사용 매뉴얼
                </h4>
                <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-1 mr-2">
                    <button class="js-zoom-out p-1 hover:bg-white rounded-md text-slate-600 transition-colors" title="축소">
                        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/></svg>
                    </button>
                    <span class="js-zoom-level text-xs font-mono w-12 text-center text-slate-500">100%</span>
                    <button class="js-zoom-in p-1 hover:bg-white rounded-md text-slate-600 transition-colors" title="확대">
                        <svg class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd"/></svg>
                    </button>
                </div>
                <div class="flex gap-2">
                    <a href="${path}" download class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-colors shadow-sm flex items-center gap-1">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"/></svg>
                        <span class="hidden sm:inline">다운로드</span><span class="sm:hidden">저장</span>
                    </a>
                    <button class="js-back px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm transition-colors shadow-sm flex items-center gap-1">
                        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${button.icon}"/></svg>
                        <span class="hidden sm:inline">${button.label}</span><span class="sm:hidden">${button.short}</span>
                    </button>
                </div>
            </div>
            <div class="js-pages flex-1 bg-slate-200/50 rounded-xl border border-slate-200 overflow-auto p-2 sm:p-4 flex flex-col items-center gap-4 relative min-h-[400px]">
                <div class="absolute inset-0 flex flex-col items-center justify-center">
                    <div class="w-10 h-10 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-3"></div>
                    <span class="text-slate-500 font-medium animate-pulse">PDF 문서를 불러오는 중...</span>
                </div>
            </div>
        </div>`);

    body.querySelector('.js-zoom-out').addEventListener('click', () => zoom(body, -ZOOM_STEP));
    body.querySelector('.js-zoom-in').addEventListener('click', () => zoom(body, ZOOM_STEP));
    body.querySelector('.js-back').addEventListener('click', onBack);

    try {
        pdfjsLib.GlobalWorkerOptions.workerSrc = WORKER_SRC;
        const doc = await pdfjsLib.getDocument(path).promise;
        if (renderId !== viewer.renderId) return;
        viewer.doc = doc;
        await renderPages(body, renderId);
    } catch (e) {
        if (renderId !== viewer.renderId) return;
        console.error('PDF 표시 실패:', e);
        body.querySelector('.js-pages').innerHTML = `
            <div class="flex flex-col items-center justify-center h-full text-slate-500 p-8 text-center">
                <p class="font-bold text-lg text-slate-700 mb-2">문서를 표시할 수 없습니다.</p>
                <a href="${path}" download class="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm transition-colors shadow-sm mt-4">파일 직접 다운로드</a>
            </div>`;
    }
}

/** 현재 배율로 모든 페이지를 canvas 에 그림 (다른 문서·배율로 바뀌면 중단) */
async function renderPages(body, renderId) {
    const container = body.querySelector('.js-pages');
    container.innerHTML = '';
    body.querySelector('.js-zoom-level').textContent = `${Math.round(viewer.scale * 100)}%`;

    for (let pageNum = 1; pageNum <= viewer.doc.numPages; pageNum++) {
        if (renderId !== viewer.renderId) return;
        const page = await viewer.doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: viewer.scale });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.className = 'shadow-lg rounded-lg bg-white max-w-none';
        container.appendChild(canvas);
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    }
}

function zoom(body, delta) {
    const scale = viewer.scale + delta;
    if (!viewer.doc || scale < ZOOM_RANGE[0] || scale > ZOOM_RANGE[1]) return;
    viewer.scale = scale;
    renderPages(body, ++viewer.renderId);
}
