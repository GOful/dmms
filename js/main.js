import { initMap, selectManhole, relayoutMap, initMapResizer, createMarker } from './map-service.js';
import { renderTree, toggleSidebar, toggleChat, setupMenuEvents, toggleGroup, selectManholeInSidebar, openManholeDetailModal } from './ui-manager.js';
import { askAI } from './ai-service.js';

let rawData = null;

/**
 * [초기화] 모든 맨홀 데이터에 대해 지도 마커를 생성합니다.
 * @param {object} data - 맨홀 데이터
 * @param {function} onSelect - 마커 선택 시 실행될 콜백 함수
 */
function createAllMarkers(data, onSelect) {
    data.lines.forEach(line => {
        line.stations.forEach(st => {
            st.manholes.forEach(mh => {
                const pos = new kakao.maps.LatLng(mh.lat, mh.lng);
                createMarker(mh, pos, st.stationName, onSelect);
            });
        });
    });
}

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

/**
 * [이벤트 위임] 트리 컨테이너의 클릭 이벤트를 처리합니다.
 * @param {Event} e - 클릭 이벤트 객체
 */
function handleTreeClick(e) {
    const manholeItem = e.target.closest('.manhole-item');
    if (manholeItem && manholeItem.dataset.manholeId) {
        selectManhole(manholeItem.dataset.manholeId);
        return;
    }

    const groupHeader = e.target.closest('.tree-group-header');
    if (groupHeader && groupHeader.dataset.groupId) {
        toggleGroup(groupHeader.dataset.groupId);
        return;
    }
}

/**
 * [이벤트 리스너] 애플리케이션 전역 커스텀 이벤트를 설정합니다.
 */
function setupGlobalEventListeners() {
    // map-service에서 맨홀이 선택되었을 때 발생하는 이벤트
    document.addEventListener('manholeselected', (e) => {
        selectManholeInSidebar(e.detail.manholeId);
    });

    // map-service에서 맨홀 상세보기 버튼이 클릭되었을 때 발생하는 이벤트
    document.addEventListener('manholedetailrequested', (e) => {
        openManholeDetailModal(e.detail.manholeData);
    });
}

async function init() {
    // --- 주요 UI 이벤트 설정 ---
    document.getElementById('toggle-sidebar-btn-desktop').addEventListener('click', toggleSidebar);
    document.getElementById('toggle-chat-btn').addEventListener('click', toggleChat);
    document.getElementById('send-btn').addEventListener('click', () => askAI(rawData));
    document.getElementById('chat-input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            askAI(rawData);
        }
    });

    // --- 메뉴 및 트리 이벤트 설정 ---
    setupMenuEvents();
    document.getElementById('tree-container').addEventListener('click', handleTreeClick);
    
    // --- 전역 커스텀 이벤트 리스너 설정 ---
    setupGlobalEventListeners();

    // --- 날짜/시간 업데이트 ---
    updateDateTime();
    setInterval(updateDateTime, 60000);

    // --- 지도 초기화 ---
    initMap();
    initMapResizer();

    // --- 데이터 로드 및 렌더링 ---
    try {
        const res = await fetch('manholes.json');
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        rawData = await res.json();
        
        // 1. 지도에 모든 마커 생성
        createAllMarkers(rawData, selectManhole);
        // 2. 사이드바 트리 메뉴 렌더링
        renderTree(rawData);

    } catch (e) {
        console.error("데이터 로드 실패:", e);
        document.getElementById('tree-container').innerHTML = `<p class="p-4 text-red-600">manholes.json 로드에 실패했습니다. 파일 경로 및 JSON 형식을 확인하세요.</p>`;
    }
}

init();