import { createMarker, relayoutMap } from './map-service.js';

let currentSelectedItemId = null;

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
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const target = link.getAttribute('data-target');
            const menuName = link.innerText;

            const modalWindow = document.querySelector('.modal-window');
            // Tailwind에서는 클래스 조작 대신 스타일을 직접 변경하거나 상태 클래스 사용
            // 여기서는 간단히 내용만 교체

            modalTitle.innerText = menuName;

            if (target === 'device-reg' || target === 'realtime-monitor') {
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
