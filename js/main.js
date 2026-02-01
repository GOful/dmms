import { initMap, selectManhole, relayoutMap } from './map-service.js';
import { renderTree, toggleSidebar } from './ui-manager.js';
import { askAI } from './ai-service.js';

let rawData = null;

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
}

init();