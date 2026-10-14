/**
 * 앱 진입점 — 각 모듈을 초기화하고 서로 연결한다
 *
 *   지도(map/)  ──이벤트──▶  main  ──▶  사이드바 · 상세정보 모달
 *   (모듈끼리 직접 참조하지 않고 config.js 의 EVENTS 로 주고받음)
 */
import { EVENTS } from './config.js';
import { loadManholes } from './data.js';
import { formatDateTime } from './utils.js';
import { initMap, addManholeMarkers, selectManhole, filterMarkers, relayoutMap } from './map/map.js';
import { initModal } from './ui/modal.js';
import { initMenu } from './ui/menu.js';
import { initSidebar, renderTree, showTreeError, highlightManhole, filterTree } from './ui/sidebar.js';
import { openManholeDetail } from './ui/manhole-detail.js';
import { initChat } from './ui/chat.js';
import { askAI } from './ai.js';

async function init() {
    // 카카오맵을 못 불러와도(도메인 미등록·네트워크 오류) 목록·메뉴·AI 는 동작하도록 분리
    const mapReady = typeof kakao !== 'undefined';

    initModal();
    initMenu();
    initSidebar({
        onSelect: selectManhole,
        onToggle: relayoutMap,
        // 빠른 필터는 지도 필터와 같은 경로로 처리 → 지도·목록이 함께 걸러짐
        onFilter: (ids) => (mapReady ? filterMarkers(ids) : filterTree(ids)),
    });
    startClock();

    if (mapReady) initMap();
    else console.error('카카오맵 SDK 를 불러오지 못했습니다.');

    document.addEventListener(EVENTS.SELECT, (e) => highlightManhole(e.detail.id));
    document.addEventListener(EVENTS.FILTER, (e) => filterTree(e.detail.ids));
    document.addEventListener(EVENTS.DETAIL, (e) => openManholeDetail(e.detail.manhole));

    let data = null;
    initChat({ onSend: (question) => data && askAI(question, data) });

    try {
        data = await loadManholes();
        renderTree(data);
        if (mapReady) addManholeMarkers(data);
    } catch (e) {
        console.error('맨홀 데이터 로드 실패:', e);
        showTreeError(`${window.DMMS.dataPath('manholes.json')} 로드에 실패했습니다. 파일 경로와 JSON 형식을 확인하세요.`);
    }
}

/** 지도 컨트롤 패널의 날짜·시간 (1분마다 갱신) */
function startClock() {
    const el = document.getElementById('datetime-display');
    const update = () => { el.textContent = formatDateTime(); };
    update();
    setInterval(update, 60 * 1000);
}

init();
