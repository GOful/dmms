import { relayoutMap } from './map-service.js';
import { viewPdfManual } from './pdf-manager.js';

let equipmentData = null; // 장비 데이터 캐싱용 변수
let currentMenuTarget = null; // 현재 활성화된 메뉴 타겟 저장

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
        const response = await fetch(window.__DMMS_MODE.dataPath('equipment_data.json'));
        equipmentData = await response.json();
        return equipmentData;
    } catch (error) {
        console.error('장비 데이터 로드 실패:', error);
        return null;
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
 * [기능] 상단 메뉴바의 링크 클릭 이벤트를 처리합니다. (SPA 방식)
 */
export function setupMenuEvents() {
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

            modalTitle.innerText = menuName;

            // 장비 관련 메뉴일 경우 데이터 로드
            if (['device-reg', 'remote-control', 'status-check'].includes(target)) {
                await loadEquipmentData();
            }

            if (target === 'device-reg') {
                generateGasDetectorTableHTML(equipmentData?.gas_detector || { headers: [], items: [] });
            } else if (target === 'remote-control') {
                generateEmergencyRescueTableHTML(equipmentData?.emergency_rescue || { headers: [], items: [] });
            } else if (target === 'status-check') {
                generateAirRespiratorTableHTML(equipmentData?.air_respirator || { headers: [], items: [] });
            } else if (PDF_MENU_TARGETS.includes(target)) {
                viewPdfManual(target, currentMenuTarget, PDF_MENU_TARGETS, closePdfManual);
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
 * [기능] PDF 뷰어를 닫고 이전 테이블 화면으로 복귀합니다.
 */
async function closePdfManual() {
    if (PDF_MENU_TARGETS.includes(currentMenuTarget)) {
        document.getElementById('spa-modal-overlay').style.display = 'none';
        return;
    }

    if (!equipmentData) await loadEquipmentData();

    if (currentMenuTarget === 'device-reg') {
        generateGasDetectorTableHTML(equipmentData?.gas_detector || { headers: [], items: [] });
    } else if (currentMenuTarget === 'remote-control') {
        generateEmergencyRescueTableHTML(equipmentData?.emergency_rescue || { headers: [], items: [] });
    } else if (currentMenuTarget === 'status-check') {
        generateAirRespiratorTableHTML(equipmentData?.air_respirator || { headers: [], items: [] });
    }
}


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
 * [헬퍼] 장비관리 테이블을 생성하고 모달에 렌더링합니다. (Template 사용)
 * @param {object} dataObj - 테이블 데이터 (headers, items)
 * @param {string} manualType - 매뉴얼 버튼에 연결할 PDF 파일명
 */
function _createEquipmentTable(dataObj, manualType) {
    const template = document.getElementById('equipment-table-template');
    if (!template) return;

    const modalBody = document.getElementById('modal-body');
    modalBody.innerHTML = ''; // 기존 내용 초기화

    const clone = template.content.cloneNode(true);
    
    const headerRow = clone.querySelector('.table-headers');
    const tableBody = clone.querySelector('.table-body');
    const manualBtn = clone.querySelector('.manual-btn');

    // 헤더 생성
    if (headerRow) {
        headerRow.innerHTML = dataObj.headers.map(h => `<th class="px-4 py-3 font-bold whitespace-nowrap">${h}</th>`).join('');
    }

    // 바디 생성
    if (tableBody) {
        dataObj.items.forEach(item => {
            const row = document.createElement('tr');
            row.className = 'bg-white hover:bg-slate-50 transition-colors';
            
            // 데이터 객체의 모든 값을 순회하며 <td> 생성
            const cells = Object.values(item).map(value => {
                const td = document.createElement('td');
                td.className = 'px-4 py-3 whitespace-nowrap';
                // 상태(status) 값에 따라 뱃지 스타일 적용
                if (String(value).toLowerCase() === 'normal' || String(value).toLowerCase() === 'ok' || String(value) === '정상') {
                     td.innerHTML = `<span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">${value}</span>`;
                } else {
                    td.textContent = value;
                }
                return td.outerHTML;
            }).join('');
            
            row.innerHTML = cells;
            tableBody.appendChild(row);
        });
    }
    
    // 매뉴얼 버튼 이벤트 리스너 추가
    if (manualBtn) {
        manualBtn.addEventListener('click', () => viewPdfManual(manualType, currentMenuTarget, PDF_MENU_TARGETS, closePdfManual));
    }

    modalBody.appendChild(clone);
}


/**
 * [기능] 공기호흡기 관리 테이블 및 매뉴얼 버튼 HTML을 생성합니다.
 */
function generateAirRespiratorTableHTML(dataObj) {
    _createEquipmentTable(dataObj, 'air_respirator');
}

/**
 * [기능] 비상구조 장비관리 테이블 및 매뉴얼 버튼 HTML을 생성합니다.
 */
function generateEmergencyRescueTableHTML(dataObj) {
    _createEquipmentTable(dataObj, 'emergency_rescue');
}

/**
 * [기능] 복합가스측정기 관리 테이블 및 매뉴얼 버튼 HTML을 생성합니다.
 */
function generateGasDetectorTableHTML(dataObj) {
    _createEquipmentTable(dataObj, 'gas_detector');
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

    const isAdmin = window.__DMMS_MODE && window.__DMMS_MODE.getMode() === 'admin';

    if (isAdmin) {
        modalBody.innerHTML = renderAdminPendingDetail(mh);
        modalOverlay.style.display = 'flex';
        return;
    }

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

/** [헬퍼] 관리용 화면 — 실데이터 미연결 상태의 상세 모달 본문 */
function renderAdminPendingDetail(mh) {
    return `
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
                    <div><span class="text-slate-500">설치년도:</span> <span class="text-slate-400 italic">준비 중</span></div>
                </div>
            </div>

            <!-- 준비 중 안내 -->
            <div class="border border-dashed border-slate-300 rounded-lg p-8 bg-slate-50/60 text-center">
                <div class="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-200 text-slate-500 mb-3">
                    <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="2"><path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
                </div>
                <h4 class="font-bold text-slate-700 mb-1">상세 데이터 준비 중</h4>
                <p class="text-sm text-slate-500 leading-relaxed">
                    유지보수 이력 · 연간 수위 등 상세 정보는 DB 시스템 구축 후<br>
                    실제 운영 데이터와 연동될 예정입니다.
                </p>
            </div>
        </div>
    `;
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
