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
    const btn = document.getElementById('toggle-sidebar-btn');
    btn.innerText = container.classList.contains('sidebar-hidden') ? "▶ 리스트" : "◀ 리스트";
}

export function toggleGroup(id) {
    const el = document.getElementById(id);
    const arrow = document.getElementById('arrow-' + id);
    if(el) {
        el.classList.toggle('show');
        if(arrow) arrow.innerText = el.classList.contains('show') ? '▲' : '▼';
    }
}

export function renderTree(data, onSelect) {
    const container = document.getElementById('tree-container');
    container.innerHTML = ""; 

    data.lines.forEach(line => {
        const div = document.createElement('div');
        div.innerHTML = `
            <div class="tree-group-header line-header" id="header-${line.lineId}">
                <span>🚇 ${line.lineTitle}</span> <span id="arrow-${line.lineId}">▼</span>
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
                    <span>🚉 ${st.stationName}</span> <span id="arrow-${st.stationId}">▼</span>
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