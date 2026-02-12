import { createMarker, relayoutMap } from './map-service.js';

let currentSelectedItemId = null;
let equipmentData = null; // 장비 데이터 캐싱용 변수
let currentMenuTarget = null; // 현재 활성화된 메뉴 타겟 저장
let lastPdfRenderId = 0; // PDF 렌더링 중복 방지용 ID
let currentPdfDoc = null; // 현재 로드된 PDF 문서 객체
let currentPdfScale = 1.5; // PDF 렌더링 배율

// PDF 뷰어로 바로 연결되는 메뉴 타겟 목록 (안전작업 및 점검표)
const PDF_MENU_TARGETS = [
    'confined_space_program', 
    'work_permit', 
    'cpr', 
    'related_laws',
    'inspection_6m', 
    'inspection_1y'
];

/**
 * [기능] 장비 데이터를 JSON 파일에서 비동기로 로드합니다.
 */
async function loadEquipmentData() {
    if (equipmentData) return equipmentData;
    try {
        const response = await fetch('equipment_data.json');
        equipmentData = await response.json();
        return equipmentData;
    } catch (error) {
        console.error('장비 데이터 로드 실패:', error);
        return null;
    }
}

/**
 * [기능] 사이드바 트리 메뉴에서 특정 맨홀 항목을 선택(하이라이트)하고,
 * 해당 항목이 보이도록 트리를 자동으로 펼치고 스크롤합니다.
 * @param {string} id - 선택할 맨홀 ID
 */
export function selectManholeInSidebar(id) {
    if (currentSelectedItemId) {
        const prevSelected = document.getElementById(`manhole-item-${currentSelectedItemId}`);
        if (prevSelected) {
            // 이전 선택 스타일 제거
            prevSelected.classList.remove('bg-blue-50', 'text-blue-700', 'font-bold', 'border-l-4', 'border-blue-600');
        }
    }

    const newSelected = document.getElementById(`manhole-item-${id}`);
    if (newSelected) {
        // 새로운 선택 스타일 적용 (Tailwind)
        newSelected.classList.add('bg-blue-50', 'text-blue-700', 'font-bold', 'border-l-4', 'border-blue-600');
        currentSelectedItemId = id;

        // 선택된 항목의 부모 그룹들이 닫혀있다면 모두 열어줌
        let parent = newSelected.parentElement;
        while(parent && parent.id !== 'tree-container') {
            // hidden 클래스가 있으면(닫혀있으면) 제거해서 열어줌
            if (parent.classList.contains('hidden')) {
                const header = document.getElementById(`header-${parent.id}`);
                if(header) header.click();
            }
            parent = parent.parentElement;
        }
        
        // 상단 고정 헤더(Sticky)에 가려지는 것을 방지하기 위해 중앙으로 스크롤
        newSelected.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

/**
 * [기능] 사이드바 전체를 보이거나 숨깁니다.
 */
export function toggleSidebar() {
    const container = document.getElementById('app-container');
    container.classList.toggle('sidebar-hidden');
    relayoutMap(); // 지도를 다시 계산하여 올바르게 표시
}

/**
 * [기능] AI 채팅창을 보이거나 숨깁니다.
 */
export function toggleChat() {
    const chatContainer = document.getElementById('ai-chat-container');
    const appContainer = document.getElementById('app-container');
    const isVisible = chatContainer.classList.toggle('show');
    appContainer.classList.toggle('chat-open', isVisible);
    
    // 챗봇이 열리면 입력창에 포커스
    if (isVisible) {
        document.getElementById('chat-input').focus();
    }
}


/**
 * [기능] 트리 메뉴의 그룹(노선, 역)을 접거나 펼칩니다.
 * @param {string} id - 대상 그룹의 ID
 */
export function toggleGroup(id) {
    const el = document.getElementById(id);
    const arrow = document.getElementById('arrow-' + id);
    if(el) {
        // Tailwind의 hidden 클래스를 토글 (hidden이 없으면 보임)
        const isHidden = el.classList.toggle('hidden');
        if(arrow) arrow.innerText = isHidden ? '▼' : '▲';
    }
}

/**
 * [유틸] 노선 이름에 따른 아이콘 HTML을 반환합니다.
 */
function getLineIcon(lineTitle) {
    // Tailwind 클래스로 아이콘 스타일링
    const baseClass = "inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white mr-2 shadow-sm";
    if (lineTitle === '1호선') {
        return `<span class="${baseClass} bg-[#e60012]">1</span>`;
    }
    if (lineTitle === '2호선') {
        return `<span class="${baseClass} bg-[#00a84d]">2</span>`;
    }
    return '🚇'; // 기본 아이콘
}

/**
 * [기능] JSON 데이터를 기반으로 사이드바의 트리 메뉴 구조를 동적으로 생성합니다.
 * @param {Object} data - 맨홀 데이터 객체
 * @param {Function} onSelect - 항목 클릭 시 실행할 콜백
 */
export function renderTree(data, onSelect) {
    const container = document.getElementById('tree-container');
    container.innerHTML = ""; 

    data.lines.forEach(line => {
        const lineTotal = line.stations.reduce((acc, st) => acc + st.manholes.length, 0);

        const div = document.createElement('div');
        div.innerHTML = `
            <div class="flex justify-between items-center p-3 cursor-pointer hover:bg-slate-50 border-b border-slate-100 font-bold text-slate-700 select-none transition-colors sticky top-0 bg-white z-10 shadow-sm" id="header-${line.lineId}">
                <span class="flex items-center">${getLineIcon(line.lineTitle)} ${line.lineTitle} <span class="text-sm text-slate-400 font-normal ml-1">(${lineTotal})</span></span> 
                <span id="arrow-${line.lineId}" class="text-slate-400 text-xs">▼</span>
            </div>
            <div id="${line.lineId}" class="hidden"></div>
        `;
        container.appendChild(div);
        document.getElementById(`header-${line.lineId}`).onclick = () => toggleGroup(line.lineId);
        
        const lineContent = document.getElementById(line.lineId);
        line.stations.forEach(st => {
            const stCount = st.manholes.length;
            const stDiv = document.createElement('div');
            stDiv.innerHTML = `
                <div class="flex justify-between items-center p-2 pl-8 cursor-pointer hover:bg-slate-50 border-b border-slate-50 text-sm font-medium text-slate-600 select-none transition-colors sticky top-[45px] bg-slate-50/95 backdrop-blur-sm z-0" id="header-${st.stationId}">
                    <span>${st.stationName} <span class="text-xs text-slate-400 font-normal">(${stCount})</span></span> 
                    <span id="arrow-${st.stationId}" class="text-slate-400 text-xs">▼</span>
                </div>
                <div id="${st.stationId}" class="hidden"></div>
            `;
            lineContent.appendChild(stDiv);
            document.getElementById(`header-${st.stationId}`).onclick = () => toggleGroup(st.stationId);
            
            const stContent = document.getElementById(st.stationId);
            st.manholes.forEach(mh => {
                const pos = new kakao.maps.LatLng(mh.lat, mh.lng);
                createMarker(mh, pos, st.stationName, onSelect);

                const item = document.createElement('div');
                item.id = `manhole-item-${mh.id}`;
                // Tailwind 클래스 적용 (기본 상태)
                item.className = 'pl-12 py-2 pr-4 cursor-pointer text-sm text-slate-500 border-b border-slate-50 hover:bg-blue-50 hover:text-blue-600 transition-colors border-l-4 border-transparent';
                item.innerText = `[${mh.id}] ${mh.name}`;
                item.onclick = () => onSelect(mh.id);
                stContent.appendChild(item);
            });
        });
    });
}

/**
 * [기능] 상단 메뉴바의 링크 클릭 이벤트를 처리합니다. (SPA 방식)
 */
export function setupMenuEvents() {
    const menuList = document.getElementById('menu-list');
    const spaLinks = document.querySelectorAll('.spa-link');
    const modalOverlay = document.getElementById('spa-modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeBtn = document.getElementById('modal-close-btn');
    
    // [리팩토링] 모바일 메뉴 제어 로직 (Drawer 방식)
    const navToggle = document.getElementById('navbar-toggle');
    const menuContainer = document.getElementById('mobile-menu-container');
    const menuBackdrop = document.getElementById('mobile-menu-backdrop');
    const menuPanel = document.getElementById('mobile-menu-panel');
    const menuCloseBtn = document.getElementById('mobile-menu-close-btn');

    // 메뉴 열기
    function openMobileMenu() {
        if(!menuContainer) return;
        menuContainer.style.display = 'block';
        // 트랜지션 효과를 위해 약간의 지연 후 클래스 변경
        setTimeout(() => {
            menuBackdrop.classList.remove('opacity-0');
            menuPanel.classList.remove('translate-x-full');
        }, 10);
    }

    // 메뉴 닫기
    function closeMobileMenu() {
        if(!menuContainer) return;
        menuBackdrop.classList.add('opacity-0');
        menuPanel.classList.add('translate-x-full');
        // 애니메이션(300ms) 종료 후 숨김 처리
        setTimeout(() => {
            menuContainer.style.display = 'none';
        }, 300);
    }

    // 이벤트 리스너 등록
    if (navToggle) navToggle.addEventListener('click', (e) => { e.stopPropagation(); openMobileMenu(); });
    if (menuCloseBtn) menuCloseBtn.addEventListener('click', closeMobileMenu);
    if (menuBackdrop) menuBackdrop.addEventListener('click', closeMobileMenu);

    // 공통: SPA 링크 클릭 시 모달 열기
    spaLinks.forEach(link => {
        link.addEventListener('click', async (e) => {
            e.preventDefault();
            
            const target = link.getAttribute('data-target');
            currentMenuTarget = target; // 현재 메뉴 타겟 저장
            const menuName = link.innerText;

            const modalWindow = document.querySelector('.modal-window');
            // Tailwind에서는 클래스 조작 대신 스타일을 직접 변경하거나 상태 클래스 사용
            // 여기서는 간단히 내용만 교체

            modalTitle.innerText = menuName;

            // 장비 관련 메뉴일 경우 데이터 로드
            if (['device-reg', 'remote-control', 'status-check'].includes(target)) {
                await loadEquipmentData();
            }

            if (target === 'device-reg') {
                modalBody.innerHTML = generateGasDetectorTableHTML(equipmentData?.gas_detector || { headers: [], items: [] });
            } else if (target === 'remote-control') {
                modalBody.innerHTML = generateEmergencyRescueTableHTML(equipmentData?.emergency_rescue || { headers: [], items: [] });
            } else if (target === 'status-check') {
                modalBody.innerHTML = generateAirRespiratorTableHTML(equipmentData?.air_respirator || { headers: [], items: [] });
            } else if (PDF_MENU_TARGETS.includes(target)) {
                viewPdfManual(target);
            } else if (target === 'realtime-monitor') {
                modalBody.innerHTML = generateDummyTableHTML(menuName);
            } else {
                modalBody.innerHTML = `
                    <div class="space-y-2">
                        <p class="font-bold text-slate-800 text-lg">'${menuName}' 메뉴를 선택하셨습니다.</p>
                        <p class="text-slate-600">현재 페이지를 유지한 상태로 기능이 실행됩니다.</p>
                        <p class="text-slate-400 text-xs mt-4 font-mono bg-slate-100 inline-block px-2 py-1 rounded">(Target ID: ${target})</p>
                    </div>
                `;
            }

            modalOverlay.style.display = 'flex';
            
            // 모바일에서 메뉴 클릭 후 전체 메뉴 닫기
            closeMobileMenu();
        });
    });

    closeBtn.addEventListener('click', () => modalOverlay.style.display = 'none');
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) modalOverlay.style.display = 'none';
    });
}

/**
 * [기능] 모달 내부에 PDF 뷰어를 렌더링합니다.
 * @param {string} type - 매뉴얼 타입 (파일명으로 사용)
 */
window.viewPdfManual = async function(type) {
    const currentRenderId = Date.now();
    lastPdfRenderId = currentRenderId;

    const modalBody = document.getElementById('modal-body');
    // 실제 파일은 프로젝트 루트의 manuals 폴더에 위치해야 합니다 (예: manuals/gas_detector.pdf)
    const pdfPath = `manuals/${type}.pdf`; 

    // 안전작업 메뉴인지 확인 (목록으로 돌아가기 vs 닫기 버튼 구분)
    const isSafetyMenu = PDF_MENU_TARGETS.includes(currentMenuTarget);
    const btnText = isSafetyMenu ? '닫기' : '목록으로 돌아가기';
    const btnTextMobile = isSafetyMenu ? '닫기' : '목록';
    const btnIconPath = isSafetyMenu ? 'M6 18L18 6M6 6l12 12' : 'M10 19l-7-7m0 0l7-7m-7 7h18';
    
    // 초기 배율 설정 (모바일 1.2, 데스크탑 1.5)
    currentPdfScale = window.innerWidth < 640 ? 1.2 : 1.5;
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
                <!-- 줌 컨트롤 버튼 추가 -->
                <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-1 mr-2">
                    <button onclick="changePdfZoom(-0.2)" class="p-1 hover:bg-white rounded-md text-slate-600 transition-colors" title="축소">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd" /></svg>
                    </button>
                    <span id="pdf-zoom-level" class="text-xs font-mono w-12 text-center text-slate-500">${Math.round(currentPdfScale * 100)}%</span>
                    <button onclick="changePdfZoom(0.2)" class="p-1 hover:bg-white rounded-md text-slate-600 transition-colors" title="확대">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clip-rule="evenodd" /></svg>
                    </button>
                </div>
                <div class="flex gap-2">
                    <a href="${pdfPath}" download class="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm transition-colors shadow-sm flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                        <span class="hidden sm:inline">다운로드</span>
                        <span class="sm:hidden">저장</span>
                    </a>
                    <button onclick="closePdfManual()" class="px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-sm transition-colors shadow-sm flex items-center gap-1">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="${btnIconPath}" /></svg>
                        <span class="hidden sm:inline">${btnText}</span>
                        <span class="sm:hidden">${btnTextMobile}</span>
                    </button>
                </div>
            </div>
            <!-- PDF 뷰어 컨테이너 (PDF.js 렌더링 영역) -->
            <div id="pdf-viewer-container" class="flex-1 bg-slate-200/50 rounded-xl border border-slate-200 overflow-auto p-2 sm:p-4 flex flex-col items-center gap-4 relative min-h-[400px]">
                <div id="pdf-loading-spinner" class="absolute inset-0 flex flex-col items-center justify-center z-10">
                    <div class="w-10 h-10 border-4 border-slate-300 border-t-blue-600 rounded-full animate-spin mb-3"></div>
                    <span class="text-slate-500 font-medium animate-pulse">PDF 문서를 불러오는 중...</span>
                </div>
            </div>
        </div>
    `;

    try {
        // PDF.js Worker 설정
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

        // PDF 문서 로드
        const loadingTask = window.pdfjsLib.getDocument(pdfPath);
        currentPdfDoc = await loadingTask.promise;
        
        // 렌더링 실행
        await renderCurrentPdf(currentRenderId);
        
    } catch (error) {
        if (lastPdfRenderId !== currentRenderId) return;
        console.error('PDF Rendering Error:', error);
        const container = document.getElementById('pdf-viewer-container');
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
};

/**
 * [기능] 현재 로드된 PDF 문서를 설정된 배율로 렌더링합니다.
 */
async function renderCurrentPdf(renderId) {
    if (!currentPdfDoc || lastPdfRenderId !== renderId) return;

    const container = document.getElementById('pdf-viewer-container');
    container.innerHTML = ''; // 기존 내용 초기화

    // 줌 레벨 표시 업데이트
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
        
        // 스타일: 원본 크기를 유지하되, 컨테이너보다 크면 스크롤되도록 설정
        // w-full 클래스를 제거하여 줌인 시 실제로 커지게 함
        canvas.className = "shadow-lg rounded-lg bg-white mb-4 last:mb-0 max-w-none";
        canvas.style.maxWidth = 'none'; // Tailwind max-w-3xl 오버라이드
        
        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        
        container.appendChild(canvas);
        await page.render(renderContext).promise;
    }
}

/**
 * [기능] PDF 줌 레벨을 변경하고 다시 렌더링합니다.
 */
window.changePdfZoom = function(delta) {
    const newScale = currentPdfScale + delta;
    if (newScale < 0.5 || newScale > 5.0) return; // 최소/최대 배율 제한
    currentPdfScale = newScale;
    renderCurrentPdf(lastPdfRenderId);
};

/**
 * [기능] PDF 뷰어를 닫고 이전 테이블 화면으로 복귀합니다.
 */
window.closePdfManual = async function() {
    const modalBody = document.getElementById('modal-body');
    
    // 안전작업 메뉴인 경우 모달 닫기
    if (PDF_MENU_TARGETS.includes(currentMenuTarget)) {
        document.getElementById('spa-modal-overlay').style.display = 'none';
        return;
    }

    // 데이터가 없으면 다시 로드
    if (!equipmentData) await loadEquipmentData();

    // 저장된 타겟에 따라 테이블 다시 렌더링
    if (currentMenuTarget === 'device-reg') {
        modalBody.innerHTML = generateGasDetectorTableHTML(equipmentData?.gas_detector || { headers: [], items: [] });
    } else if (currentMenuTarget === 'remote-control') {
        modalBody.innerHTML = generateEmergencyRescueTableHTML(equipmentData?.emergency_rescue || { headers: [], items: [] });
    } else if (currentMenuTarget === 'status-check') {
        modalBody.innerHTML = generateAirRespiratorTableHTML(equipmentData?.air_respirator || { headers: [], items: [] });
    }
};

/**
 * [유틸] 테스트용 더미 데이터 테이블 HTML을 생성합니다.
 */
function generateDummyTableHTML(title) {
    return `
        <div class="flex flex-col gap-4 mb-6">
            <div class="flex justify-between items-center">
                <span class="text-sm text-slate-600">총 <strong class="text-blue-600">5</strong>건의 데이터가 조회되었습니다.</span>
                <button class="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-sm rounded-lg shadow-sm transition-colors flex items-center gap-1">
                    <span>엑셀 다운로드</span>
                </button>
            </div>
        </div>
        <div class="overflow-x-auto border border-slate-200 rounded-lg">
            <table class="w-full text-sm text-left text-slate-600">
                <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                        <th class="px-4 py-3 font-bold">ID</th>
                        <th class="px-4 py-3 font-bold">시설물명</th>
                        <th class="px-4 py-3 font-bold">위치</th>
                        <th class="px-4 py-3 font-bold">상태</th>
                        <th class="px-4 py-3 font-bold">최종 점검일</th>
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    <tr class="bg-white hover:bg-slate-50 transition-colors"><td class="px-4 py-3 font-medium text-slate-900">MH-001</td><td class="px-4 py-3">반월당역 1번 맨홀</td><td class="px-4 py-3">35.87, 128.60</td><td class="px-4 py-3"><span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">정상</span></td><td class="px-4 py-3">2026-02-01</td></tr>
                    <tr class="bg-white hover:bg-slate-50 transition-colors"><td class="px-4 py-3 font-medium text-slate-900">MH-002</td><td class="px-4 py-3">중앙로역 2번 맨홀</td><td class="px-4 py-3">35.87, 128.60</td><td class="px-4 py-3"><span class="bg-orange-100 text-orange-800 text-xs font-medium px-2.5 py-0.5 rounded">점검요망</span></td><td class="px-4 py-3">2026-01-15</td></tr>
                    <tr class="bg-white hover:bg-slate-50 transition-colors"><td class="px-4 py-3 font-medium text-slate-900">MH-003</td><td class="px-4 py-3">대구역 3번 맨홀</td><td class="px-4 py-3">35.87, 128.60</td><td class="px-4 py-3"><span class="bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded">수리중</span></td><td class="px-4 py-3">2026-02-03</td></tr>
                    <tr class="bg-white hover:bg-slate-50 transition-colors"><td class="px-4 py-3 font-medium text-slate-900">MH-004</td><td class="px-4 py-3">동대구역 4번 맨홀</td><td class="px-4 py-3">35.87, 128.61</td><td class="px-4 py-3"><span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">정상</span></td><td class="px-4 py-3">2026-01-20</td></tr>
                    <tr class="bg-white hover:bg-slate-50 transition-colors"><td class="px-4 py-3 font-medium text-slate-900">MH-005</td><td class="px-4 py-3">범어역 5번 맨홀</td><td class="px-4 py-3">35.86, 128.62</td><td class="px-4 py-3"><span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">정상</span></td><td class="px-4 py-3">2026-02-04</td></tr>
                </tbody>
            </table>
        </div>
    `;
}

/**
 * [기능] 공기호흡기 관리 테이블 및 매뉴얼 버튼 HTML을 생성합니다.
 */
function generateAirRespiratorTableHTML(dataObj) {
    const headers = dataObj.headers.map(h => `<th class="px-4 py-3 font-bold whitespace-nowrap">${h}</th>`).join('');
    
    const rows = dataObj.items.map((item, index) => `
        <tr class="bg-white hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 whitespace-nowrap">${index + 1}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.dept}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.name}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.assetNo}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.spec}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.acquireDate}</td>
            <td class="px-4 py-3 whitespace-nowrap"><span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">${item.status}</span></td>
        </tr>
    `).join('');

    return `
        <div class="flex flex-col gap-4 mb-6">
            <div class="flex justify-end items-center">
                <button onclick="viewPdfManual('air_respirator')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg shadow-sm transition-colors flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                    <span>사용매뉴얼</span>
                </button>
            </div>
        </div>
        <div class="overflow-x-auto border border-slate-200 rounded-lg">
            <table class="w-full text-sm text-left text-slate-600">
                <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                        ${headers}
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * [기능] 비상구조 장비 관리 테이블 및 매뉴얼 버튼 HTML을 생성합니다.
 */
function generateEmergencyRescueTableHTML(dataObj) {
    const headers = dataObj.headers.map(h => `<th class="px-4 py-3 font-bold whitespace-nowrap">${h}</th>`).join('');

    const rows = dataObj.items.map((item, index) => `
        <tr class="bg-white hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 whitespace-nowrap">${index + 1}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.dept}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.name}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.assetNo}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.spec}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.acquireDate}</td>
            <td class="px-4 py-3 whitespace-nowrap"><span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">${item.status}</span></td>
        </tr>
    `).join('');

    return `
        <div class="flex flex-col gap-4 mb-6">
            <div class="flex justify-end items-center">
                <button onclick="viewPdfManual('emergency_rescue')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg shadow-sm transition-colors flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                    <span>사용매뉴얼</span>
                </button>
            </div>
        </div>
        <div class="overflow-x-auto border border-slate-200 rounded-lg">
            <table class="w-full text-sm text-left text-slate-600">
                <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                        ${headers}
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * [기능] 복합가스측정기 관리 테이블 및 매뉴얼 버튼 HTML을 생성합니다.
 */
function generateGasDetectorTableHTML(dataObj) {
    const headers = dataObj.headers.map(h => `<th class="px-4 py-3 font-bold whitespace-nowrap">${h}</th>`).join('');

    const rows = dataObj.items.map((item, index) => `
        <tr class="bg-white hover:bg-slate-50 transition-colors">
            <td class="px-4 py-3 whitespace-nowrap">${index + 1}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.dept}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.assetNo}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.spec}</td>
            <td class="px-4 py-3 whitespace-nowrap"><span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">${item.status}</span></td>
            <td class="px-4 py-3 whitespace-nowrap">${item.acquireDate}</td>
            <td class="px-4 py-3 whitespace-nowrap">${item.calibDate}</td>
        </tr>
    `).join('');

    return `
        <div class="flex flex-col gap-4 mb-6">
            <div class="flex justify-end items-center">
                <button onclick="viewPdfManual('gas_detector')" class="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg shadow-sm transition-colors flex items-center gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-4 h-4">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                    </svg>
                    <span>사용매뉴얼</span>
                </button>
            </div>
        </div>
        <div class="overflow-x-auto border border-slate-200 rounded-lg">
            <table class="w-full text-sm text-left text-slate-600">
                <thead class="text-xs text-slate-700 uppercase bg-slate-50 border-b border-slate-200">
                    <tr>
                        ${headers}
                    </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
}

/**
 * [기능] 맨홀 상세 정보 모달을 열고 더미 데이터를 표시합니다.
 * @param {Object} mh - 맨홀 데이터 객체
 */
export function openManholeDetailModal(mh) {
    const modalOverlay = document.getElementById('spa-modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');

    modalTitle.innerText = `${mh.name} 상세 정보`;
    
    // 더미 데이터 생성
    const historyData = generateDummyHistory();
    const waterLevelData = generateDummyWaterLevel();

    modalBody.innerHTML = `
        <div class="space-y-6">
            <!-- 기본 정보 -->
            <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
                <h4 class="font-bold text-slate-700 mb-2 flex items-center gap-2">
                    <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    기본 정보
                </h4>
                <div class="grid grid-cols-2 gap-4 text-sm">
                    <div><span class="text-slate-500">ID:</span> <span class="font-medium">${mh.id}</span></div>
                    <div><span class="text-slate-500">위치:</span> <span class="font-medium">${mh.lat.toFixed(5)}, ${mh.lng.toFixed(5)}</span></div>
                    <div><span class="text-slate-500">설치년도:</span> <span class="font-medium">2005년</span></div>
                </div>
            </div>

            <!-- 이력 정보 (민원, 수선, 침수) -->
            <div>
                <h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                    유지보수 및 이슈 이력
                </h4>
                <div class="overflow-x-auto border border-slate-200 rounded-lg">
                    <table class="min-w-full divide-y divide-slate-200">
                        <thead class="bg-slate-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">날짜</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">구분</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">내용</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">조치결과</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-slate-200 text-sm">
                            ${historyData.map(item => `
                                <tr class="hover:bg-slate-50">
                                    <td class="px-4 py-3 whitespace-nowrap text-slate-600 text-xs">${item.date.substring(2)}</td>
                                    <td class="px-4 py-3 whitespace-nowrap">
                                        <span class="px-2 py-1 text-xs font-semibold rounded-full ${item.type === '민원' ? 'bg-yellow-100 text-yellow-800' : item.type === '침수' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}">
                                            ${item.type}
                                        </span>
                                    </td>
                                    <td class="px-4 py-3 text-slate-700 min-w-[160px]">${item.content}</td>
                                    <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${item.result}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- 연간 수위 정보 -->
            <div>
                <h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2">
                    <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                    연간 수위 데이터 (최근 5년)
                </h4>
                <div class="overflow-x-auto border border-slate-200 rounded-lg">
                    <table class="min-w-full divide-y divide-slate-200">
                        <thead class="bg-slate-50">
                            <tr>
                                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">년도</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">수위</th>
                                <th class="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">상태</th>
                            </tr>
                        </thead>
                        <tbody class="bg-white divide-y divide-slate-200 text-sm">
                            ${waterLevelData.map(item => `
                                <tr class="hover:bg-slate-50">
                                    <td class="px-4 py-3 whitespace-nowrap font-medium text-slate-700">${item.year}년</td>
                                    <td class="px-4 py-3 whitespace-nowrap text-slate-600">${item.level}mm</td>
                                    <td class="px-4 py-3 whitespace-nowrap">
                                        <span class="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">정상</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    `;

    modalOverlay.style.display = 'flex';
}

/** [헬퍼] 이력 더미 데이터 생성 */
function generateDummyHistory() {
    return [
        { date: '2025-01-15', type: '점검', content: '정기 안전 점검 수행', result: '이상 없음' },
        { date: '2024-08-23', type: '침수', content: '집중호우로 인한 일시적 수위 상승', result: '배수 조치 완료' },
        { date: '2024-05-10', type: '수선', content: '맨홀 뚜껑 소음 관련 민원 조치', result: '고무 패킹 교체' },
        { date: '2023-11-05', type: '민원', content: '주변 보도블럭 침하 신고', result: '현장 확인 후 보수' }
    ];
}

/** [헬퍼] 수위 더미 데이터 생성 */
function generateDummyWaterLevel() {
    return [
        { year: 2025, level: 210 },
        { year: 2024, level: 205 },
        { year: 2023, level: 215 },
        { year: 2022, level: 200 },
        { year: 2021, level: 208 }
    ];
}
