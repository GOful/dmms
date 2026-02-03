import { createMarker } from './map-service.js';

let currentSelectedItemId = null;

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

        // 모든 역 그룹을 찾아서 처리
        const allStationHeaders = document.querySelectorAll('.station-header');
        allStationHeaders.forEach(header => {
            // header-stationId 형식에서 stationId를 추출
            const stationId = header.id.replace('header-', '');
            const stationContent = document.getElementById(stationId);
            
            if (stationContent && stationContent !== currentStationContent) {
                // 다른 역의 콘텐츠 영역은 닫는다
                if (stationContent.classList.contains('show')) {
                    stationContent.classList.remove('show');
                    const arrow = header.querySelector('span[id^="arrow-"]');
                    if (arrow) arrow.innerText = '▼';
                }
            }
        });

        // Ensure the selected item is visible
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

export function toggleSidebar() {
    const container = document.getElementById('app-container');
    container.classList.toggle('sidebar-hidden');
}

export function toggleGroup(id) {
    const el = document.getElementById(id);
    const arrow = document.getElementById('arrow-' + id);
    if(el) {
        el.classList.toggle('show');
        if(arrow) arrow.innerText = el.classList.contains('show') ? '▲' : '▼';
    }
}

function getLineIcon(lineTitle) {
    if (lineTitle === '1호선') {
        return '<span class="line-icon line-1">1</span>';
    }
    if (lineTitle === '2호선') {
        return '<span class="line-icon line-2">2</span>';
    }
    return '🚇'; // 기본 아이콘
}

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

            // Enforce min/max heights (e.g., 100px)
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
