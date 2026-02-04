import { initMap, selectManhole, relayoutMap, initMapResizer } from './map-service.js';
import { renderTree, toggleSidebar, toggleChat, setupMenuEvents } from './ui-manager.js';
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
    // [반응형] 시작 시 모바일이면 사이드바 숨김 처리
    if (window.innerWidth <= 768) {
        document.getElementById('app-container').classList.add('sidebar-hidden');
    }

    document.getElementById('navbar-toggle').addEventListener('click', () => {
        // 모바일에서는 햄버거 버튼이 상단 메뉴 리스트를 토글
        document.getElementById('menu-list').classList.toggle('active');
    });

    document.getElementById('toggle-sidebar-btn-desktop').addEventListener('click', () => {
        toggleSidebar();
    });

    document.getElementById('toggle-chat-btn').onclick = toggleChat;
    
    document.getElementById('send-btn').onclick = () => askAI(rawData);
    document.getElementById('chat-input').onkeypress = (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            askAI(rawData);
        }
    };
    
    setupMenuEvents();

    updateDateTime();
    setInterval(updateDateTime, 60000);

    initMap();
    initMapResizer();

    try {
        const res = await fetch('manholes.json');
        rawData = await res.json();
        renderTree(rawData, selectManhole);
    } catch (e) {
        console.error("데이터 로드 실패:", e);
        document.getElementById('tree-container').innerHTML = "<p style='padding:20px;'>manholes.json 로드 실패</p>";
    }
}

init();