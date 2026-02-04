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
        // 상단 고정 헤더(Sticky)에 가려지는 것을 방지하기 위해 중앙으로 스크롤
        newSelected.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // [반응형] 모바일 환경에서는 항목 선택 시 사이드바를 자동으로 닫음
        if (window.innerWidth <= 768) {
            const container = document.getElementById('app-container');
            if (!container.classList.contains('sidebar-hidden')) {
                toggleSidebar();
            }
        }
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
        // 노선별 전체 맨홀 개수 계산
        const lineTotal = line.stations.reduce((acc, st) => acc + st.manholes.length, 0);

        const div = document.createElement('div');
        div.innerHTML = `
            <div class="tree-group-header line-header" id="header-${line.lineId}">
                <span>${getLineIcon(line.lineTitle)} ${line.lineTitle} <span style="font-size:0.9em; color:#555; font-weight:normal; margin-left:4px;">(${lineTotal})</span></span> <span id="arrow-${line.lineId}">▼</span>
            </div>
            <div id="${line.lineId}" class="tree-group-content"></div>
        `;
        container.appendChild(div);
        document.getElementById(`header-${line.lineId}`).onclick = () => toggleGroup(line.lineId);
        
        const lineContent = document.getElementById(line.lineId);
        line.stations.forEach(st => {
            // 역별 맨홀 개수
            const stCount = st.manholes.length;
            const stDiv = document.createElement('div');
            stDiv.innerHTML = `
                <div class="tree-group-header station-header" id="header-${st.stationId}">
                    <span>${st.stationName} <span style="font-size:0.9em; color:#777; font-weight:normal;">(${stCount})</span></span> <span id="arrow-${st.stationId}">▼</span>
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

/**
 * [기능] 상단 메뉴바의 링크 클릭 이벤트를 처리합니다. (SPA 방식)
 * 페이지 이동 없이 모달 창을 띄웁니다.
 */
export function setupMenuEvents() {
    const links = document.querySelectorAll('.spa-link');
    const modalOverlay = document.getElementById('spa-modal-overlay');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeBtn = document.getElementById('modal-close-btn');

    // 메뉴 클릭 시
    links.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault(); // 페이지 이동 방지 (핵심)
            
            const target = link.getAttribute('data-target');
            const menuName = link.innerText;

            const modalWindow = document.querySelector('.modal-window');
            
            // 기본적으로 모달 크기 초기화
            modalWindow.classList.remove('large');

            modalTitle.innerText = menuName;

            // 특정 메뉴(예: 장비 등록, 실시간 모니터링)일 경우 테이블 표시
            if (target === 'device-reg' || target === 'realtime-monitor') {
                modalWindow.classList.add('large'); // 모달을 넓게 설정
                modalBody.innerHTML = generateDummyTableHTML(menuName);
            } else {
                // 그 외 메뉴는 기본 텍스트 표시
                modalBody.innerHTML = `
                    <p><strong>'${menuName}'</strong> 메뉴를 선택하셨습니다.</p>
                    <p>현재 페이지를 유지한 상태로 기능이 실행됩니다.</p>
                    <p style="color:#888; font-size:0.9em; margin-top:10px;">(Target ID: ${target})</p>
                `;
            }

            modalOverlay.style.display = 'flex';
        });
    });

    // 모달 닫기 버튼
    closeBtn.addEventListener('click', () => {
        modalOverlay.style.display = 'none';
    });

    // 배경 클릭 시 닫기
    modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.style.display = 'none';
        }
    });
}

/**
 * [유틸] 테스트용 더미 데이터 테이블 HTML을 생성합니다.
 */
function generateDummyTableHTML(title) {
    return `
        <div style="margin-bottom: 15px; display: flex; justify-content: space-between; align-items: center;">
            <span>총 <strong>5</strong>건의 데이터가 조회되었습니다.</span>
            <button style="padding: 5px 10px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer;">엑셀 다운로드</button>
        </div>
        <table class="data-table">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>시설물명</th>
                    <th>위치(위도, 경도)</th>
                    <th>상태</th>
                    <th>최종 점검일</th>
                </tr>
            </thead>
            <tbody>
                <tr><td>MH-001</td><td>반월당역 1번 맨홀</td><td>35.8714, 128.6014</td><td><span style="color:green">정상</span></td><td>2026-02-01</td></tr>
                <tr><td>MH-002</td><td>중앙로역 2번 맨홀</td><td>35.8720, 128.6020</td><td><span style="color:orange">점검요망</span></td><td>2026-01-15</td></tr>
                <tr><td>MH-003</td><td>대구역 3번 맨홀</td><td>35.8750, 128.6050</td><td><span style="color:red">수리중</span></td><td>2026-02-03</td></tr>
                <tr><td>MH-004</td><td>동대구역 4번 맨홀</td><td>35.8780, 128.6100</td><td><span style="color:green">정상</span></td><td>2026-01-20</td></tr>
                <tr><td>MH-005</td><td>범어역 5번 맨홀</td><td>35.8600, 128.6200</td><td><span style="color:green">정상</span></td><td>2026-02-04</td></tr>
            </tbody>
        </table>
    `;
}
