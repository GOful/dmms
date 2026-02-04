import { initMap, selectManhole, relayoutMap } from './map-service.js';
import { renderTree, toggleSidebar, initSidebarResizer } from './ui-manager.js';
import { askAI } from './ai-service.js';

let rawData = null;

function updateDateTime() {
    const now = new Date();
    // 포맷: MM.DD(요일) HH:mm
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = String(now.getDate()).padStart(2, '0');
    const day = ['일', '월', '화', '수', '목', '금', '토'][now.getDay()];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');

    const formattedDateTime = `${month}.${date}(${day}) ${hours}:${minutes}`;
    
    const displayElement = document.getElementById('datetime-display');
    if (displayElement) {
        displayElement.innerText = formattedDateTime;
    }
}

async function init() {
    // UI 이벤트 연결
    document.getElementById('toggle-sidebar-btn').onclick = () => {
        toggleSidebar();
        relayoutMap();
    };
    
    document.getElementById('send-btn').onclick = () => askAI(rawData);
    document.getElementById('chat-input').onkeypress = (e) => {
        if (e.key === 'Enter') askAI(rawData);
    };

    // 사이드바 리사이저 초기화
    initSidebarResizer();

    // 시간 표시 초기화 및 1분마다 업데이트
    updateDateTime();
    setInterval(updateDateTime, 60000);

    // 지도 초기화
    initMap();

    // 데이터 로드
    try {
        const res = await fetch('manholes.json');
        rawData = await res.json();
        renderTree(rawData, selectManhole);
    } catch (e) {
        console.error("데이터 로드 실패:", e);
        document.getElementById('tree-container').innerHTML = "<p style='padding:20px;'>manholes.json 로드 실패</p>";
    }

    // [반응형] 모바일 화면(768px 이하)이면 시작할 때 사이드바를 숨김
    if (window.innerWidth <= 768) {
        toggleSidebar();
        relayoutMap();
    }
}

init();