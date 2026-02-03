import { createMarker } from './map-service.js';

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
            prevSelected.classList.remove('selected');
        }
    }

    const newSelected = document.getElementById(`manhole-item-${id}`);
    if (newSelected) {
        newSelected.classList.add('selected');
        currentSelectedItemId = id;

        const currentStationContent = newSelected.closest('.tree-group-content');

        // 다른 역의 그룹은 닫아서 현재 선택된 역에 집중되도록 처리 (아코디언 효과)
        const allStationHeaders = document.querySelectorAll('.station-header');
        allStationHeaders.forEach(header => {
            // header-stationId 형식에서 stationId를 추출
            const stationId = header.id.replace('header-', '');
            const stationContent = document.getElementById(stationId);
            
            if (stationContent && stationContent !== currentStationContent) {
                if (stationContent.classList.contains('show')) {
                    stationContent.classList.remove('show');
                    const arrow = header.querySelector('span[id^="arrow-"]');
                    if (arrow) arrow.innerText = '▼';
                }
            }
        });

        // 선택된 항목의 부모 그룹들이 닫혀있다면 모두 열어줌 (경로 확보)
        let parent = newSelected.parentElement;
        while(parent && parent.id !== 'tree-container') {
            if (parent.classList.contains('tree-group-content')) {
                if (!parent.classList.contains('show')) {
                    parent.classList.add('show');
                    const header = document.getElementById(`header-${parent.id}`);
                    if(header) {
                        const arrow = header.querySelector('span[id^="arrow-"]');
                        if(arrow) arrow.innerText = '▲';
                    }
                }
            }
            parent = parent.parentElement;
        }
        newSelected.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

/**
 * [기능] 사이드바 전체를 보이거나 숨깁니다.
 */
export function toggleSidebar() {
    const container = document.getElementById('app-container');
    container.classList.toggle('sidebar-hidden');
}

/**
 * [기능] 트리 메뉴의 그룹(노선, 역)을 접거나 펼칩니다.
 * @param {string} id - 대상 그룹의 ID
 */
export function toggleGroup(id) {
    const el = document.getElementById(id);
    const arrow = document.getElementById('arrow-' + id);
    if(el) {
        el.classList.toggle('show');
        if(arrow) arrow.innerText = el.classList.contains('show') ? '▲' : '▼';
    }
}

/**
 * [유틸] 노선 이름에 따른 아이콘 HTML을 반환합니다.
 */
function getLineIcon(lineTitle) {
    if (lineTitle === '1호선') {
        return '<span class="line-icon line-1">1</span>';
    }
    if (lineTitle === '2호선') {
        return '<span class="line-icon line-2">2</span>';
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
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="tree-group-header line-header" id="header-${line.lineId}">
                <span>${getLineIcon(line.lineTitle)} ${line.lineTitle}</span> <span id="arrow-${line.lineId}">▼</span>
            </div>
            <div id="${line.lineId}" class="tree-group-content"></div>
        `;
        container.appendChild(div);
        document.getElementById(`header-${line.lineId}`).onclick = () => toggleGroup(line.lineId);
        
        const lineContent = document.getElementById(line.lineId);
        line.stations.forEach(st => {
            const stDiv = document.createElement('div');
            stDiv.innerHTML = `
                <div class="tree-group-header station-header" id="header-${st.stationId}">
                    <span>${st.stationName}</span> <span id="arrow-${st.stationId}">▼</span>
                </div>
                <div id="${st.stationId}" class="tree-group-content"></div>
            `;
            lineContent.appendChild(stDiv);
            document.getElementById(`header-${st.stationId}`).onclick = () => toggleGroup(st.stationId);
            
            const stContent = document.getElementById(st.stationId);
            st.manholes.forEach(mh => {
                const pos = new kakao.maps.LatLng(mh.lat, mh.lng);
                createMarker(mh, pos, st.stationName, onSelect);

                const item = document.createElement('div');
                item.id = `manhole-item-${mh.id}`; // 아이디 추가
                item.className = 'manhole-item';
                item.innerText = `[${mh.id}] ${mh.name}`;
                item.onclick = () => onSelect(mh.id);
                stContent.appendChild(item);
            });
        });
    });
}

/**
 * [기능] 사이드바 내의 트리 영역과 채팅 영역 사이의 높이 조절(Resizer) 기능을 초기화합니다.
 */
export function initSidebarResizer() {
    const resizer = document.getElementById('sidebar-resizer');
    const treeContainer = document.getElementById('tree-container');
    const chatContainer = document.getElementById('ai-chat-container');
    const sidebarMainContent = document.getElementById('sidebar-main-content');

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';

        const mouseMoveHandler = (e) => {
            if (!isResizing) return;

            const sidebarRect = sidebarMainContent.getBoundingClientRect();
            let newTreeHeight = e.clientY - sidebarRect.top;

            // 최소/최대 높이 제한 설정 (최소 100px)
            const minHeight = 100;
            const maxHeight = sidebarRect.height - minHeight - resizer.offsetHeight;

            newTreeHeight = Math.max(minHeight, Math.min(newTreeHeight, maxHeight));

            const newChatHeight = sidebarRect.height - newTreeHeight - resizer.offsetHeight;

            treeContainer.style.height = `${newTreeHeight}px`;
            chatContainer.style.height = `${newChatHeight}px`;
        };

        const mouseUpHandler = () => {
            isResizing = false;
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    });
}
