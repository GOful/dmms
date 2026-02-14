// ========================================
// 상태 변수 & 상수
// ========================================

const state = {
    map: null,
    rv: null,
    rvClient: null,
    currentCircle: null,    // 현재 그려진 디버그용 원
    centerMarker: null,     // 현재 그려진 디버그용 마커
    markersMap: {},         // 맨홀 ID를 키로 하는 마커 객체 저장소 { [manholeId]: { marker, pos, data, stationName } }
    weatherOverlays: [],    // 날씨 오버레이(원, 커스텀오버레이) 객체 배열
    currentOverlay: null,   // 현재 표시된 맨홀 정보 오버레이
};

// 선택된 맨홀 마커 이미지 (파란색 강조)
const svgSelectedMarkerHtml = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter></defs>
  <circle cx="32" cy="32" r="28" fill="#2563eb" stroke="#ffffff" stroke-width="3" filter="url(#shadow)"/>
  <circle cx="32" cy="32" r="22" fill="none" stroke="#93c5fd" stroke-width="1" stroke-dasharray="4 2"/>
  <path d="M34 14L20 34H30L28 50L42 30H32L34 14Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

const starImg = new kakao.maps.MarkerImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgSelectedMarkerHtml.trim())}`,
    new kakao.maps.Size(50, 50)
);

// 기본 맨홀 마커 이미지 (슬레이트 색상 + 번개 아이콘)
const svgMarkerHtml = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter></defs>
  <circle cx="32" cy="32" r="28" fill="#334155" stroke="#cbd5e1" stroke-width="3" filter="url(#shadow)"/>
  <circle cx="32" cy="32" r="22" fill="none" stroke="#475569" stroke-width="1" stroke-dasharray="4 2"/>
  <path d="M34 14L20 34H30L28 50L42 30H32L34 14Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

const normalImg = new kakao.maps.MarkerImage(
    `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgMarkerHtml.trim())}`,
    new kakao.maps.Size(44, 44)
);

// ========================================
// 초기화
// ========================================

/**
 * [초기화] 카카오맵 및 로드뷰 객체를 생성하고 초기 설정을 수행합니다.
 */
export function initMap() {
    state.map = new kakao.maps.Map(document.getElementById('map'), {
        center: new kakao.maps.LatLng(35.8714, 128.6014),
        level: 7
    });

    state.map.setMinLevel(1);
    state.map.setMaxLevel(14);

    state.rv = new kakao.maps.Roadview(document.getElementById('roadview'));
    state.rvClient = new kakao.maps.RoadviewClient();

    setupMapControls();
}

/**
 * [초기화] 지도 상단 컨트롤(교통정보, 날씨, 로드뷰) 체크박스 이벤트를 설정합니다.
 */
function setupMapControls() {
    const trafficCheckbox = document.getElementById('traffic-checkbox');
    const weatherCheckbox = document.getElementById('weather-checkbox');
    const roadviewCheckbox = document.getElementById('roadview-checkbox');
    const mapResizer = document.getElementById('map-resizer');

    trafficCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            state.map.addOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);
        } else {
            state.map.removeOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);
        }
    });

    weatherCheckbox.addEventListener('change', (e) => {
        toggleWeather(e.target.checked);
    });

    roadviewCheckbox.addEventListener('change', (e) => {
        const rvContainer = document.getElementById('roadview');
        if (e.target.checked) {
            rvContainer.style.display = 'block';
            mapResizer.style.display = 'block';
            state.map.relayout();
            state.rv.relayout();
        } else {
            rvContainer.style.display = 'none';
            mapResizer.style.display = 'none';
            state.map.relayout();
        }
    });
}

/**
 * [초기화] 지도와 로드뷰 사이의 높이 조절(Resizer) 기능을 초기화합니다.
 */
export function initMapResizer() {
    const resizer = document.getElementById('map-resizer');
    const roadviewContainer = document.getElementById('roadview');
    const mainContent = document.getElementById('main-content');

    let isResizing = false;

    resizer.addEventListener('mousedown', (e) => {
        e.preventDefault();
        isResizing = true;
        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';

        const mouseMoveHandler = (e) => {
            if (!isResizing) return;
            const mainRect = mainContent.getBoundingClientRect();
            let newHeight = mainRect.bottom - e.clientY;
            newHeight = Math.max(100, Math.min(newHeight, mainRect.height - 100));
            roadviewContainer.style.height = `${newHeight}px`;
        };

        const mouseUpHandler = () => {
            isResizing = false;
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';

            if(state.map) state.map.relayout();
            if(state.rv) state.rv.relayout();
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    });
}

// ========================================
// 마커 & 맨홀 선택
// ========================================

/**
 * [기능] 개별 맨홀 마커를 생성하고 클릭 이벤트를 등록합니다.
 */
export function createMarker(mh, pos, stationName, onSelect) {
    const marker = new kakao.maps.Marker({ position: pos, map: state.map, image: normalImg });
    state.markersMap[mh.id] = { marker, pos, data: mh, stationName };
    kakao.maps.event.addListener(marker, 'click', () => onSelect(mh.id));
}

/**
 * [기능] 특정 맨홀을 선택했을 때의 동작을 처리합니다.
 */
export function selectManhole(id) {
    // UI 업데이트를 위해 이벤트를 발생시켜 main.js에 알림
    document.dispatchEvent(new CustomEvent('manholeselected', { detail: { manholeId: id } }));
    
    const target = state.markersMap[id];
    if(!target) return;

    state.map.setLevel(4);
    state.map.panTo(target.pos);

    Object.values(state.markersMap).forEach(m => m.marker.setImage(normalImg));
    target.marker.setImage(starImg);

    state.rvClient.getNearestPanoId(target.pos, 50, (pId) => {
        if(pId) state.rv.setPanoId(pId, target.pos);
    });

    showManholeOverlay(target.data, target.stationName, target.pos);
}

/**
 * [기능] 지도 상의 마커 위에 맨홀 정보 오버레이(네임카드)를 표시합니다.
 */
function showManholeOverlay(mh, stationName, position) {
    if (state.currentOverlay) {
        state.currentOverlay.setMap(null);
    }

    const template = document.getElementById('manhole-overlay-template');
    if (!template) {
        console.error('manhole-overlay-template을 찾을 수 없습니다.');
        return;
    }
    
    const content = template.content.cloneNode(true);
    const waterLevel = Math.floor(Math.random() * 300) + 200;

    // 데이터 채우기
    content.querySelector('.data-name').textContent = mh.name;
    content.querySelector('.data-station-name').textContent = stationName;
    content.querySelector('.data-id').textContent = mh.id;
    content.querySelector('.data-coords').textContent = `${mh.lat.toFixed(4)}, ${mh.lng.toFixed(4)}`;
    content.querySelector('.data-complaint-cnt').textContent = mh.complaint_cnt || 0;
    content.querySelector('.data-repair-cnt').textContent = mh.repair_cnt || 0;
    content.querySelector('.data-flood-freq').textContent = mh.flood_freq || 0;
    content.querySelector('.data-water-level').textContent = `${waterLevel}mm`;

    // 이벤트 리스너 연결
    content.querySelector('.close-overlay-btn').addEventListener('click', () => {
        if (state.currentOverlay) state.currentOverlay.setMap(null);
    });

    // 상세보기 버튼 클릭 시 UI 모듈에 직접 의존하는 대신 커스텀 이벤트를 발생시킴
    content.querySelector('.detail-view-btn')?.addEventListener('click', () => {
        document.dispatchEvent(new CustomEvent('manholedetailrequested', { detail: { manholeData: mh } }));
    });

    state.currentOverlay = new kakao.maps.CustomOverlay({
        position: position,
        content: content,
        yAnchor: 1,
        zIndex: 100
    });
    state.currentOverlay.setMap(state.map);
}

// ========================================
// 날씨 오버레이
// ========================================

/**
 * [기능] 날씨 정보 오버레이를 켜거나 끕니다.
 */
function toggleWeather(show) {
    if (show && state.weatherOverlays.length === 0) {
        displayWeather();
    } else {
        state.weatherOverlays.forEach(overlay => overlay.setMap(show ? state.map : null));
    }
}

/**
 * [기능] weather_data.json 파일을 읽어 각 역 위치에 날씨 정보를 시각화합니다.
 */
async function displayWeather() {
    if (state.weatherOverlays.length > 0) return;

    try {
        const response = await fetch('weather_data.json');
        const weatherData = await response.json();

        for (const stationName in weatherData) {
            const data = weatherData[stationName];
            const lat = parseFloat(data.LAT);
            const lng = parseFloat(data.LON);
            const position = new kakao.maps.LatLng(lat, lng);
            const overlayPosition = new kakao.maps.LatLng(lat + 0.0040, lng);

            const ta = parseFloat(data.TA);
            const rn_ox_val = parseFloat(data.RN_OX);
            const rn_60m = parseFloat(data.RN_60M);
            const vs = parseInt(data.VS, 10);

            let weatherIcon = '☀️';
            if (rn_ox_val > 0 || rn_60m > 0) weatherIcon = '☔️';
            else if (vs < 12) weatherIcon = '🌫️';

            const tempText = `${ta.toFixed(1)}°C`;
            const pcpText = rn_60m > 0 ? `강수: ${rn_60m}mm` : "강수 없음";

            const circle = new kakao.maps.Circle({
                center: position,
                radius: 500,
                strokeWeight: 2,
                strokeColor: '#1E90FF',
                strokeOpacity: 0.8,
                strokeStyle: 'solid',
                fillColor: '#87CEFA',
                fillOpacity: 0.3,
                map: state.map
            });

            const content = `
                <div class="pointer-events-none flex items-center gap-3 bg-white/90 backdrop-blur-sm border border-slate-300 rounded-xl px-4 py-2 shadow-lg">
                    <div class="text-2xl filter drop-shadow-sm">${weatherIcon}</div>
                    <div class="flex flex-col items-start text-xs">
                        <div class="font-bold text-sm text-slate-800">${tempText}</div>
                        <div class="text-slate-500 font-medium">${pcpText}</div>
                    </div>
                </div>
            `;
            const customOverlay = new kakao.maps.CustomOverlay({
                position: overlayPosition,
                content: content,
                map: state.map,
                yAnchor: 0.5,
                xAnchor: 0.5
            });

            state.weatherOverlays.push(circle);
            state.weatherOverlays.push(customOverlay);
        }
    } catch (e) {
        console.error("날씨 데이터 로드 또는 표시에 실패했습니다:", e);
    }
}

// ========================================
// 유틸리티
// ========================================

/**
 * [유틸] 사이드바 토글 등으로 지도 컨테이너 크기가 변경되었을 때 레이아웃을 갱신합니다.
 */
export function relayoutMap() {
    setTimeout(() => {
        if(state.map) state.map.relayout();
        const rvContainer = document.getElementById('roadview');
        if(state.rv && rvContainer && rvContainer.style.display !== 'none') {
            state.rv.relayout();
        }
    }, 300);
}

/**
 * [디버그] 특정 좌표에 테스트용 마커와 반경 원을 그립니다.
 */
export function drawTestCircle(lat, lng, radiusMeter = 5000) {
    const position = new kakao.maps.LatLng(lat, lng);

    if (state.currentCircle) state.currentCircle.setMap(null);
    if (state.centerMarker) state.centerMarker.setMap(null);

    state.centerMarker = new kakao.maps.Marker({
        position: position,
        map: state.map
    });

    state.currentCircle = new kakao.maps.Circle({
        center: position,
        radius: radiusMeter,
        strokeWeight: 2,
        strokeColor: '#75B8FA',
        strokeOpacity: 0.8,
        strokeStyle: 'solid',
        fillColor: '#CFE7FF',
        fillOpacity: 0.3
    });

    state.currentCircle.setMap(state.map);
    state.map.panTo(position);
}