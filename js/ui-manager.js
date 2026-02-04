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
            prevSelected.classList.remove('selected');
        }
    }

    const newSelected = document.getElementById(`manhole-item-${id}`);
    if (newSelected) {
        newSelected.classList.add('selected');
        currentSelectedItemId = id;

        // 선택된 항목의 부모 그룹들이 닫혀있다면 모두 열어줌
        let parent = newSelected.parentElement;
        while(parent && parent.id !== 'tree-container') {
            if (parent.classList.contains('tree-group-content') && !parent.classList.contains('show')) {
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
                item.id = `manhole-item-${mh.id}`;
                item.className = 'manhole-item';
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

    // 공통: SPA 링크 클릭 시 모달 열기
    spaLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            
            const target = link.getAttribute('data-target');
            const menuName = link.innerText;

            const modalWindow = document.querySelector('.modal-window');
            modalWindow.classList.remove('large');

            modalTitle.innerText = menuName;

            if (target === 'device-reg' || target === 'realtime-monitor') {
                modalWindow.classList.add('large');
                modalBody.innerHTML = generateDummyTableHTML(menuName);
            } else {
                modalBody.innerHTML = `
                    <p><strong>'${menuName}'</strong> 메뉴를 선택하셨습니다.</p>
                    <p>현재 페이지를 유지한 상태로 기능이 실행됩니다.</p>
                    <p style="color:#888; font-size:0.9em; margin-top:10px;">(Target ID: ${target})</p>
                `;
            }

            modalOverlay.style.display = 'flex';
            
            // 모바일에서 메뉴 클릭 후 전체 메뉴 닫기
            if (window.innerWidth <= 768) {
                menuList.classList.remove('active');
            }
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
        <div style="margin-bottom: 15px; display: flex; flex-direction: column; gap: 10px; align-items: flex-start;">
            <span>총 <strong>5</strong>건의 데이터가 조회되었습니다.</span>
            <button style="padding: 8px 12px; background: #27ae60; color: white; border: none; border-radius: 4px; cursor: pointer;">엑셀 다운로드</button>
        </div>
        <div style="overflow-x: auto;">
            <table class="data-table">
                <thead>
                    <tr><th>ID</th><th>시설물명</th><th>위치</th><th>상태</th><th>최종 점검일</th></tr>
                </thead>
                <tbody>
                    <tr><td>MH-001</td><td>반월당역 1번 맨홀</td><td>35.87, 128.60</td><td><span style="color:green">정상</span></td><td>2026-02-01</td></tr>
                    <tr><td>MH-002</td><td>중앙로역 2번 맨홀</td><td>35.87, 128.60</td><td><span style="color:orange">점검요망</span></td><td>2026-01-15</td></tr>
                    <tr><td>MH-003</td><td>대구역 3번 맨홀</td><td>35.87, 128.60</td><td><span style="color:red">수리중</span></td><td>2026-02-03</td></tr>
                    <tr><td>MH-004</td><td>동대구역 4번 맨홀</td><td>35.87, 128.61</td><td><span style="color:green">정상</span></td><td>2026-01-20</td></tr>
                    <tr><td>MH-005</td><td>범어역 5번 맨홀</td><td>35.86, 128.62</td><td><span style="color:green">정상</span></td><td>2026-02-04</td></tr>
                </tbody>
            </table>
        </div>
    `;
}
