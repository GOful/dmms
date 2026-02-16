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
 * [기능] 트리 메뉴의 그룹(노선, 역)을 접거나 펼칩니다.
 * @param {string} groupId - 대상 그룹의 ID
 */
export function toggleGroup(groupId) {
    const groupContent = document.querySelector(`[data-group-content-id="${groupId}"]`);
    const header = document.querySelector(`[data-group-id="${groupId}"]`);
    if(groupContent && header) {
        const isHidden = groupContent.classList.toggle('hidden');
        const arrow = header.querySelector('.arrow-icon');
        if(arrow) arrow.textContent = isHidden ? '▼' : '▲';
    }
}


/**
 * [유틸] 노선 이름에 따른 아이콘 HTML을 반환합니다.
 */
function getLineIcon(lineTitle) {
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
 */
export function renderTree(data) {
    const container = document.getElementById('tree-container');
    if (!container) return;
    container.innerHTML = ""; 

    const lineTemplate = document.getElementById('line-group-template');
    const stationTemplate = document.getElementById('station-group-template');
    const manholeTemplate = document.getElementById('manhole-item-template');

    if (!lineTemplate || !stationTemplate || !manholeTemplate) {
        console.error('Tree templates not found!');
        return;
    }

    data.lines.forEach(line => {
        const lineTotal = line.stations.reduce((acc, st) => acc + st.manholes.length, 0);
        
        const lineClone = lineTemplate.content.cloneNode(true);
        const lineHeader = lineClone.querySelector('.tree-group-header');
        const stationsContainer = lineClone.querySelector('.stations-container');
        
        lineHeader.dataset.groupId = line.lineId;
        lineClone.querySelector('.line-icon').innerHTML = getLineIcon(line.lineTitle);
        lineClone.querySelector('.line-title').textContent = line.lineTitle;
        lineClone.querySelector('.line-count').textContent = `(${lineTotal})`;
        stationsContainer.dataset.groupContentId = line.lineId;

        line.stations.forEach(st => {
            const stCount = st.manholes.length;

            const stationClone = stationTemplate.content.cloneNode(true);
            const stationHeader = stationClone.querySelector('.tree-group-header');
            const manholesContainer = stationClone.querySelector('.manholes-container');

            stationHeader.dataset.groupId = st.stationId;
            stationClone.querySelector('.station-name').textContent = st.stationName;
            stationClone.querySelector('.station-count').textContent = `(${stCount})`;
            manholesContainer.dataset.groupContentId = st.stationId;

            st.manholes.forEach(mh => {
                const manholeClone = manholeTemplate.content.cloneNode(true);
                const manholeItem = manholeClone.querySelector('.manhole-item');
                manholeItem.dataset.manholeId = mh.id;
                manholeItem.id = `manhole-item-${mh.id}`;
                manholeItem.textContent = `[${mh.id}] ${mh.name}`;
                manholesContainer.appendChild(manholeClone);
            });
            stationsContainer.appendChild(stationClone);
        });
        container.appendChild(lineClone);
    });
}
