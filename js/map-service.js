import { filterTree, selectManholeInSidebar } from './tree-manager.js';
import { levelDelta } from './manhole-format.js';
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
    watchId: null,          // 위치 추적 ID
    userMarker: null,       // 내 위치 마커
    isTracking: false,      // 지도 중심 이동 여부
    selectedMarkerOverlay: null, // [추가] 선택된 마커의 애니메이션 오버레이
    selectedManholeId: null,     // [추가] 현재 선택된 맨홀 ID (마커 복원용)
};

// 선택된 맨홀 마커 이미지 (파란색 강조)
const svgSelectedMarkerHtml = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter></defs>
  <circle cx="32" cy="32" r="28" fill="#2563eb" stroke="#ffffff" stroke-width="3" filter="url(#shadow)"/>
  <circle cx="32" cy="32" r="22" fill="none" stroke="#93c5fd" stroke-width="1" stroke-dasharray="4 2"/>
  <path d="M34 14L20 34H30L28 50L42 30H32L34 14Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;

let starImg = null;

// 라인별 마커 색상 정의 (배경 / 점선 원 stroke)
const LINE_COLORS = {
    line1: { bg: '#dc2626', innerStroke: '#991b1b' }, // 1호선 빨강
    line2: { bg: '#15803d', innerStroke: '#14532d' }, // 2호선 초록 (진한 녹색)
    default: { bg: '#334155', innerStroke: '#475569' } // 기본(슬레이트)
};

// 맨홀 마커 SVG 생성기 (배경/내부 점선 색을 라인별로 받음)
function makeMarkerSvg(bg, innerStroke) {
    return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter></defs>
  <circle cx="32" cy="32" r="28" fill="${bg}" stroke="#ffffff" stroke-width="3" filter="url(#shadow)"/>
  <circle cx="32" cy="32" r="22" fill="none" stroke="${innerStroke}" stroke-width="1" stroke-dasharray="4 2"/>
  <path d="M34 14L20 34H30L28 50L42 30H32L34 14Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/>
</svg>`;
}

// 라인별 MarkerImage 캐시 (initMap에서 채워짐)
const normalImgByLine = {};

// ========================================
// 초기화
// ========================================

/**
 * [초기화] 카카오맵 및 로드뷰 객체를 생성하고 초기 설정을 수행합니다.
 */
export function initMap() {
    // [수정] 함수 내부에서 이미지 객체 생성 (kakao 객체가 로드된 후 실행됨)
    starImg = new kakao.maps.MarkerImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgSelectedMarkerHtml.trim())}`,
        new kakao.maps.Size(50, 50),
        { offset: new kakao.maps.Point(25, 25) } // [추가] 앵커를 중앙으로 설정
    );

    // 라인별 마커 이미지 사전 생성
    Object.keys(LINE_COLORS).forEach(key => {
        const c = LINE_COLORS[key];
        normalImgByLine[key] = new kakao.maps.MarkerImage(
            `data:image/svg+xml;charset=utf-8,${encodeURIComponent(makeMarkerSvg(c.bg, c.innerStroke).trim())}`,
            new kakao.maps.Size(44, 44),
            { offset: new kakao.maps.Point(22, 22) }
        );
    });

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
    const resetFilterBtn = document.getElementById('reset-filter-btn');
    const locationCheckbox = document.getElementById('location-checkbox');

    // 모바일: 컨트롤 패널 접기/펼치기 (데스크탑은 항상 펼침 — md 이상에서는 버튼이 비활성)
    const controls = document.getElementById('map-controls');
    const controlsToggle = document.getElementById('map-controls-toggle');
    const controlsBody = document.getElementById('map-controls-body');
    controlsToggle?.addEventListener('click', () => {
        const expanded = controls.classList.toggle('expanded');
        controlsBody.classList.toggle('max-md:hidden', !expanded);
        controlsToggle.setAttribute('aria-expanded', String(expanded));
    });

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

    if (resetFilterBtn) {
        resetFilterBtn.addEventListener('click', () => {
            filterMarkers([]); // 빈 배열 전달 시 전체 마커 표시
        });
    }

    if (locationCheckbox) {
        locationCheckbox.addEventListener('change', (e) => {
            toggleUserTracking(e.target.checked);
        });
    }
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

    // [추가] 모바일 터치 이벤트 지원
    resizer.addEventListener('touchstart', (e) => {
        e.preventDefault(); // 터치 시 브라우저 스크롤 방지
        isResizing = true;
        
        const touchMoveHandler = (e) => {
            if (!isResizing) return;
            const mainRect = mainContent.getBoundingClientRect();
            const clientY = e.touches[0].clientY; // 터치 좌표 가져오기
            
            let newHeight = mainRect.bottom - clientY;
            newHeight = Math.max(100, Math.min(newHeight, mainRect.height - 100));
            roadviewContainer.style.height = `${newHeight}px`;
        };

        const touchEndHandler = () => {
            isResizing = false;
            document.removeEventListener('touchmove', touchMoveHandler);
            document.removeEventListener('touchend', touchEndHandler);

            if(state.map) state.map.relayout();
            if(state.rv) state.rv.relayout();
        };

        document.addEventListener('touchmove', touchMoveHandler, { passive: false });
        document.addEventListener('touchend', touchEndHandler);
    });
}

// ========================================
// 마커 & 맨홀 선택
// ========================================

/**
 * [기능] 개별 맨홀 마커를 생성하고 클릭 이벤트를 등록합니다.
 */
export function createMarker(mh, pos, stationName, onSelect, lineId) {
    const image = normalImgByLine[lineId] || normalImgByLine.default;
    const marker = new kakao.maps.Marker({ position: pos, map: state.map, image });
    state.markersMap[mh.id] = { marker, pos, data: mh, stationName, lineId };
    kakao.maps.event.addListener(marker, 'click', () => onSelect(mh.id));
}

/**
 * [기능] 특정 맨홀을 선택했을 때의 동작을 처리합니다.
 */
export function selectManhole(id) {
    // UI 업데이트를 위해 이벤트를 발생시켜 main.js에 알림
    document.dispatchEvent(new CustomEvent('manholeselected', { detail: { manholeId: id } }));
    
    // [추가] 이전에 선택된 마커 상태 복원 (애니메이션 오버레이 제거 및 원래 마커 표시)
    if (state.selectedManholeId && state.markersMap[state.selectedManholeId]) {
        state.markersMap[state.selectedManholeId].marker.setMap(state.map);
    }
    if (state.selectedMarkerOverlay) {
        state.selectedMarkerOverlay.setMap(null);
        state.selectedMarkerOverlay = null;
    }

    const target = state.markersMap[id];
    if(!target) return;

    state.selectedManholeId = id; // 현재 선택 ID 저장
    state.map.panTo(target.pos);

    // [수정] 선택된 마커를 잠시 숨기고, 그 위치에 파동 효과(Ping)가 적용된 오버레이 생성
    target.marker.setMap(null);

    const content = document.createElement('div');
    content.className = "relative flex items-center justify-center w-24 h-24 cursor-pointer"; 
    // [수정] CustomOverlay가 CSS 클래스 적용 전 렌더링되어 위치가 어긋나는 현상 방지 (명시적 크기 지정)
    content.style.width = '96px';
    content.style.height = '96px';
    content.innerHTML = `
        <div class="absolute w-10 h-10 bg-blue-500 rounded-full opacity-80 animate-ping"></div>
        <div class="relative z-10 w-12 h-12 drop-shadow-xl">
            ${svgSelectedMarkerHtml}
        </div>
    `;

    state.selectedMarkerOverlay = new kakao.maps.CustomOverlay({
        position: target.pos,
        content: content,
        yAnchor: 0.5, // 원형 마커의 중심이 좌표에 오도록 설정
        xAnchor: 0.5,
        zIndex: 101
    });
    state.selectedMarkerOverlay.setMap(state.map);

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
    const isAdmin = window.__DMMS_MODE && window.__DMMS_MODE.getMode() === 'admin';

    // 기본 정보 (위치/ID는 admin에서도 정확한 값 표시)
    content.querySelector('.data-name').textContent = mh.name;
    content.querySelector('.data-station-name').textContent = stationName;
    content.querySelector('.data-id').textContent = mh.id;
    content.querySelector('.data-coords').textContent = `${mh.lat.toFixed(4)}, ${mh.lng.toFixed(4)}`;

    let levelStats = mh;
    if (!isAdmin) {
        // 시연 화면: 실데이터가 없으므로 임의 수위 5개년으로 통계 표시
        const levels = Array.from({ length: 5 }, () => Math.floor(Math.random() * 300) + 200);
        levelStats = {
            latest_level: levels[4], prev_level: levels[3],
            avg_level: Math.round(levels.reduce((a, b) => a + b, 0) / levels.length),
            max_level: Math.max(...levels), min_level: Math.min(...levels),
        };
    }

    content.querySelector('.data-repair-cnt').textContent = mh.repair_cnt || 0;
    content.querySelector('.data-flood-cnt').textContent = mh.flood_cnt || 0;
    // 접속개소 침수 이력 강조
    if (mh.flood_cnt > 0) {
        content.querySelector('.data-flood-tile').classList.replace('bg-slate-50', 'bg-red-50');
        content.querySelector('.data-flood-tile').classList.replace('border-slate-100', 'border-red-200');
        if (mh.flood_years?.length) {
            const alertEl = content.querySelector('.data-flood-alert');
            alertEl.classList.remove('hidden');
            content.querySelector('.data-flood-alert-cnt').textContent = mh.flood_cnt;
            content.querySelector('.data-flood-alert-years').textContent = mh.flood_years.map(y => `${y}년`).join(' · ');
        }
    }

    // 평균/최대/최저 수위
    const fmtLevel = (v, year) => v == null ? '-'
        : `${v.toLocaleString()}<span class="text-[10px] font-normal text-slate-400">mm</span>${year ? `<div class="text-[10px] font-normal text-slate-400">${year}년</div>` : ''}`;
    content.querySelector('.data-avg-level').innerHTML = fmtLevel(levelStats.avg_level);
    content.querySelector('.data-max-level').innerHTML = fmtLevel(levelStats.max_level, levelStats.max_level_year);
    content.querySelector('.data-min-level').innerHTML = fmtLevel(levelStats.min_level, levelStats.min_level_year);

    // 최근 수위 (전년 대비 증감만 표시, 별도 단계 구분 없음)
    const waterLevelEl = content.querySelector('.data-water-level');
    waterLevelEl.classList.add('flex', 'items-center', 'gap-1.5');
    if (levelStats.latest_level != null) {
        if (levelStats.latest_level_year) {
            content.querySelector('.data-water-level-label').textContent = `최근수위(${levelStats.latest_level_year})`;
        }
        waterLevelEl.innerHTML = `<span>${levelStats.latest_level.toLocaleString()}mm</span>${levelDelta(levelStats.latest_level, levelStats.prev_level)}`;
    } else {
        waterLevelEl.innerHTML = '<span class="text-xs font-normal text-slate-400">측정 기록 없음</span>';
    }

    // 이벤트 리스너 연결
    content.querySelector('.close-overlay-btn').addEventListener('click', () => {
        if (state.currentOverlay) state.currentOverlay.setMap(null);
        
        // [추가] 닫기 버튼 클릭 시 애니메이션 오버레이 제거 및 원래 마커 복원
        if (state.selectedManholeId && state.markersMap[state.selectedManholeId]) {
            state.markersMap[state.selectedManholeId].marker.setMap(state.map);
        }
        if (state.selectedMarkerOverlay) {
            state.selectedMarkerOverlay.setMap(null);
            state.selectedMarkerOverlay = null;
        }
        state.selectedManholeId = null;

        selectManholeInSidebar(null); // [추가] 사이드바 선택 상태 해제
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
        // [수정] 캐시 방지를 위해 타임스탬프 파라미터 추가 및 no-store 옵션 적용
        const response = await fetch(`weather_data.json?t=${new Date().getTime()}`, { cache: 'no-store' });
        const weatherData = await response.json();

        for (const stationName in weatherData) {
            const data = weatherData[stationName];
            const lat = parseFloat(data.LAT);
            const lng = parseFloat(data.LON);
            const position = new kakao.maps.LatLng(lat, lng);
            const overlayPosition = new kakao.maps.LatLng(lat + 0.0040, lng);

            const ta = parseFloat(data.TA);
            const rn_ox_val = parseFloat(data.RN_OX);
            const rn_day = parseFloat(data.RN_DAY);
            const vs = parseInt(data.VS, 10);

            let weatherIcon = '☀️';
            if (rn_ox_val > 0 || rn_day > 0) weatherIcon = '☔️';
            if (rn_ox_val > 0 || rn_day > 0) {
                // 강수가 감지될 때 기온이 2.0도 이하이면 눈(❄️), 아니면 비(☔️)로 표시
                weatherIcon = (ta <= 2.0) ? '❄️' : '☔️';
            }
            else if (vs < 50) weatherIcon = '🌫️';

            const tempText = `${ta.toFixed(1)}°C`;
            let pcpText = "강수 없음";
            if (rn_ox_val > 0 || rn_day > 0) {
                pcpText = `강수: ${rn_day.toFixed(1)}mm`;
            }

            const circle = new kakao.maps.Circle({
                center: position,
                radius: 500,
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

/**
 * [기능] 전달받은 맨홀 ID 목록에 해당하는 마커만 지도에 표시합니다.
 * 목록이 비어있거나 null이면 모든 마커를 다시 표시합니다.
 * @param {string[]} targetIds - 표시할 맨홀 ID 배열
 */
export function filterMarkers(targetIds) {
    if (!state.map) return;

    // [추가] 필터링 실행 시 기존 선택된 오버레이 닫기 및 마커 스타일 초기화
    if (state.currentOverlay) {
        state.currentOverlay.setMap(null);
        state.currentOverlay = null;
    }
    
    // [추가] 필터링 시 선택된 애니메이션 오버레이 초기화
    if (state.selectedMarkerOverlay) {
        state.selectedMarkerOverlay.setMap(null);
        state.selectedMarkerOverlay = null;
    }
    if (state.selectedManholeId && state.markersMap[state.selectedManholeId]) {
        state.markersMap[state.selectedManholeId].marker.setMap(state.map);
    }
    state.selectedManholeId = null;

    selectManholeInSidebar(null); // [추가] 필터링 시에도 사이드바 선택 해제

    const showAll = !targetIds || targetIds.length === 0;
    const bounds = new kakao.maps.LatLngBounds();
    let hasVisibleMarker = false;
    const filterControl = document.getElementById('map-filter-control');

    Object.values(state.markersMap).forEach(item => {
        const shouldShow = showAll || targetIds.includes(item.data.id);
        item.marker.setMap(shouldShow ? state.map : null);

        if (shouldShow && !showAll) {
            bounds.extend(item.pos);
            hasVisibleMarker = true;
        }
    });

    // 필터링된 마커들이 한눈에 보이도록 지도 범위 재설정
    if (hasVisibleMarker) {
        // [수정] 마커가 화면 가장자리에 꽉 차는 것을 방지하기 위해 패딩(여백)을 적용
        // 상, 우, 하, 좌 80px 정도의 여백을 주어 지도가 조금 더 멀리서(줌 아웃) 보이도록 설정
        state.map.setBounds(bounds, 80, 80, 80, 80);

        // [추가] 사용자의 요청에 따라 한 단계 더 줌아웃 (더 넓은 범위 표시)
        state.map.setLevel(state.map.getLevel() + 1);
    }

    // [추가] 필터링 상태에 따라 초기화 버튼 표시/숨김 토글
    if (filterControl) {
        if (!showAll) {
            filterControl.classList.remove('hidden');
        } else {
            filterControl.classList.add('hidden');
        }
    }

    // [추가] 사이드바 트리 메뉴도 함께 필터링
    filterTree(targetIds);
}

/**
 * [기능] 내 위치 추적 기능을 켜거나 끕니다.
 * @param {boolean} enable - 활성화 여부
 */
function toggleUserTracking(enable) {
    const loadingEl = document.getElementById('location-loading');

    if (enable) {
        if (navigator.geolocation) {
            if(loadingEl) loadingEl.classList.remove('hidden'); // 로딩 표시 시작

            // [설정] 위치 업데이트 주기 및 정확도 설정
            // maximumAge: 캐시된 위치 정보의 유효 시간(ms). 0이면 항상 새로운 위치를 시도.
            // timeout: 위치 정보를 가져오는 데 허용되는 최대 시간(ms).
            const options = {
                enableHighAccuracy: true,
                maximumAge: 30000,
                timeout: 10000 
            };

            state.isTracking = true;
            state.watchId = navigator.geolocation.watchPosition(
                (position) => {
                    updateUserPosition(position);
                    if(loadingEl) loadingEl.classList.add('hidden'); // 위치 수신 성공 시 로딩 숨김
                },
                (err) => {
                    console.error('위치 정보를 가져올 수 없습니다.', err);
                    alert('위치 정보를 가져올 수 없습니다. 기기의 권한을 확인해주세요.');
                    const checkbox = document.getElementById('location-checkbox');
                    if(checkbox) checkbox.checked = false;
                    state.isTracking = false;
                    if(loadingEl) loadingEl.classList.add('hidden'); // 에러 시에도 로딩 숨김
                }, 
                options
            );
        } else {
            alert('이 브라우저는 위치 정보를 지원하지 않습니다.');
        }
    } else {
        if (state.watchId) {
            navigator.geolocation.clearWatch(state.watchId);
            state.watchId = null;
        }
        state.isTracking = false;
        if(loadingEl) loadingEl.classList.add('hidden'); // 체크 해제 시 로딩 숨김
        if (state.userMarker) {
            state.userMarker.setMap(null);
            state.userMarker = null;
        }
    }
}

/**
 * [내부 기능] 위치 업데이트 시 마커를 이동하고 지도를 중심에 맞춥니다.
 */
function updateUserPosition(position) {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const loc = new kakao.maps.LatLng(lat, lng);

    if (!state.userMarker) {
        // 내 위치 마커 생성 (CustomOverlay로 변경하여 시인성 강화)
        // 파동 애니메이션(animate-ping)과 흰색 배경/그림자를 추가하여 눈에 잘 띄게 함
        const content = `
            <div class="relative flex items-center justify-center">
                <div class="absolute w-14 h-14 bg-blue-500 rounded-full opacity-75 animate-ping"></div>
                <div class="relative w-12 h-12 bg-white rounded-full shadow-xl border-2 border-blue-500 flex items-center justify-center overflow-hidden z-10">
                    <img src="img/logo.svg" alt="내 위치" class="w-9 h-9 object-contain">
                </div>
            </div>
        `;

        state.userMarker = new kakao.maps.CustomOverlay({
            position: loc,
            content: content,
            map: state.map,
            yAnchor: 0.5,
            xAnchor: 0.5
        });

        // [추가] 내 위치 표시 활성화 시(마커 최초 생성 시) 지도 중심 이동
        state.map.panTo(loc);
    } else {
        state.userMarker.setPosition(loc);
    }


}