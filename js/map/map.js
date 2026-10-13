/**
 * 카카오맵 — 지도·로드뷰, 맨홀 마커, 선택·필터, 지도 컨트롤 패널
 */
import { MAP_CENTER, MAP_LEVEL, LINE_STYLES, DEFAULT_LINE_STYLE, SELECTED_MARKER_STYLE, EVENTS } from '../config.js';
import { forEachManhole } from '../utils.js';
import { createManholePopup } from './manhole-popup.js';
import { toggleWeather } from './weather-layer.js';
import { toggleLocation } from './location.js';

const state = {
    map: null,
    roadview: null,
    roadviewClient: null,
    markers: {},            // { [맨홀 ID]: { marker, position, manhole } }
    markerImages: {},       // { [노선 ID]: MarkerImage }
    selectedId: null,
    selectedOverlay: null,  // 선택된 맨홀 자리에 띄우는 강조 마커 (파동 효과)
    popup: null,            // 맨홀 정보 팝업
};

const emit = (name, detail) => document.dispatchEvent(new CustomEvent(name, { detail }));

// ── 초기화 ───────────────────────────────────────────────

/** 지도·로드뷰 생성 및 컨트롤 연결 (kakao SDK 로드 후 호출) */
export function initMap() {
    state.map = new kakao.maps.Map(document.getElementById('map'), {
        center: new kakao.maps.LatLng(...MAP_CENTER),
        level: MAP_LEVEL.initial,
    });
    state.map.setMinLevel(MAP_LEVEL.min);
    state.map.setMaxLevel(MAP_LEVEL.max);

    state.roadview = new kakao.maps.Roadview(document.getElementById('roadview'));
    state.roadviewClient = new kakao.maps.RoadviewClient();

    setupControls();
    setupRoadviewResizer();
}

/** 사이드바 열고 닫기 등으로 지도 영역 크기가 바뀐 뒤 다시 그림 (전환 애니메이션 이후) */
export function relayoutMap() {
    setTimeout(() => {
        state.map?.relayout();
        if (!document.getElementById('roadview').classList.contains('hidden')) state.roadview?.relayout();
    }, 300);
}

// ── 마커 ─────────────────────────────────────────────────

/** 맨홀 마커 SVG (원 + 안쪽 점선 + 번개 아이콘) */
function markerSvg({ marker, ring }) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
        <defs><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="2" flood-opacity="0.3"/></filter></defs>
        <circle cx="32" cy="32" r="28" fill="${marker}" stroke="#ffffff" stroke-width="3" filter="url(#shadow)"/>
        <circle cx="32" cy="32" r="22" fill="none" stroke="${ring}" stroke-width="1" stroke-dasharray="4 2"/>
        <path d="M34 14L20 34H30L28 50L42 30H32L34 14Z" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5" stroke-linejoin="round"/>
    </svg>`;
}

function markerImage(lineId) {
    state.markerImages[lineId] ??= new kakao.maps.MarkerImage(
        `data:image/svg+xml;charset=utf-8,${encodeURIComponent(markerSvg(LINE_STYLES[lineId] || DEFAULT_LINE_STYLE))}`,
        new kakao.maps.Size(44, 44),
        { offset: new kakao.maps.Point(22, 22) },
    );
    return state.markerImages[lineId];
}

/** 모든 맨홀 마커 생성 */
export function addManholeMarkers(data) {
    forEachManhole(data, (manhole, station, line) => {
        const position = new kakao.maps.LatLng(manhole.lat, manhole.lng);
        const marker = new kakao.maps.Marker({ position, map: state.map, image: markerImage(line.lineId) });
        kakao.maps.event.addListener(marker, 'click', () => selectManhole(manhole.id));
        state.markers[manhole.id] = { marker, position, manhole };
    });
}

// ── 선택 ─────────────────────────────────────────────────

/** 맨홀 선택: 강조 마커 + 정보 팝업 + 로드뷰 이동 */
export function selectManhole(id) {
    const target = state.markers[id];
    if (!target) return;

    clearSelection({ silent: true });
    state.selectedId = id;
    target.marker.setMap(null);

    state.selectedOverlay = new kakao.maps.CustomOverlay({
        map: state.map, position: target.position, content: selectedMarkerContent(),
        xAnchor: 0.5, yAnchor: 0.5, zIndex: 101,
    });
    state.popup = new kakao.maps.CustomOverlay({
        map: state.map, position: target.position, yAnchor: 1, zIndex: 100,
        content: createManholePopup(target.manhole, {
            onClose: () => clearSelection(),
            onDetail: () => emit(EVENTS.DETAIL, { manhole: target.manhole }),
        }),
    });

    state.map.panTo(target.position);
    state.roadviewClient.getNearestPanoId(target.position, 50, (panoId) => {
        if (panoId) state.roadview.setPanoId(panoId, target.position);
    });
    emit(EVENTS.SELECT, { id });
}

/** 선택 해제 (silent: 해제 이벤트를 보내지 않음 — 다른 맨홀로 바로 선택이 넘어갈 때) */
export function clearSelection({ silent = false } = {}) {
    state.popup?.setMap(null);
    state.selectedOverlay?.setMap(null);
    state.markers[state.selectedId]?.marker.setMap(state.map);
    state.popup = state.selectedOverlay = state.selectedId = null;
    if (!silent) emit(EVENTS.SELECT, { id: null });
}

function selectedMarkerContent() {
    const el = document.createElement('div');
    el.className = 'relative flex items-center justify-center cursor-pointer';
    // CustomOverlay 는 CSS 적용 전에 위치를 계산하므로 크기를 직접 지정
    el.style.width = el.style.height = '96px';
    el.innerHTML = `
        <div class="absolute w-10 h-10 bg-blue-500 rounded-full opacity-80 animate-ping"></div>
        <div class="relative z-10 w-12 h-12 drop-shadow-xl">${markerSvg(SELECTED_MARKER_STYLE)}</div>`;
    return el;
}

// ── 필터 ─────────────────────────────────────────────────

/** 지정한 맨홀만 지도에 표시하고 그 범위로 이동 (ids 가 비어 있으면 전체 표시) */
export function filterMarkers(ids) {
    clearSelection();
    const showAll = !ids?.length;
    const bounds = new kakao.maps.LatLngBounds();
    let hasVisible = false;

    Object.values(state.markers).forEach(({ marker, position, manhole }) => {
        const visible = showAll || ids.includes(manhole.id);
        marker.setMap(visible ? state.map : null);
        if (visible && !showAll) {
            bounds.extend(position);
            hasVisible = true;
        }
    });

    if (hasVisible) {
        state.map.setBounds(bounds, 80, 80, 80, 80);       // 가장자리 여백
        state.map.setLevel(state.map.getLevel() + 1);     // 한 단계 넓게
    }
    document.getElementById('map-filter-control').classList.toggle('hidden', showAll);
    emit(EVENTS.FILTER, { ids: showAll ? null : ids });
}

// ── 지도 컨트롤 패널 ─────────────────────────────────────

function setupControls() {
    const $ = (id) => document.getElementById(id);

    // 모바일: 패널 접기/펼치기 (데스크탑은 항상 펼침)
    $('map-controls-toggle').addEventListener('click', () => {
        const expanded = $('map-controls').classList.toggle('expanded');
        $('map-controls-body').classList.toggle('max-md:hidden', !expanded);
        $('map-controls-toggle').setAttribute('aria-expanded', String(expanded));
    });

    $('traffic-checkbox').addEventListener('change', (e) => {
        const traffic = kakao.maps.MapTypeId.TRAFFIC;
        if (e.target.checked) state.map.addOverlayMapTypeId(traffic);
        else state.map.removeOverlayMapTypeId(traffic);
    });

    $('weather-checkbox').addEventListener('change', (e) => toggleWeather(state.map, e.target.checked));

    $('roadview-checkbox').addEventListener('change', (e) => {
        $('roadview').classList.toggle('hidden', !e.target.checked);
        $('map-resizer').classList.toggle('hidden', !e.target.checked);
        state.map.relayout();
        if (e.target.checked) state.roadview.relayout();
    });

    $('location-checkbox').addEventListener('change', (e) => {
        toggleLocation(state.map, e.target.checked, { onError: () => { e.target.checked = false; } });
    });

    $('reset-filter-btn').addEventListener('click', () => filterMarkers(null));
}

/** 지도와 로드뷰 사이 경계선을 끌어 로드뷰 높이 조절 (마우스·터치 공용) */
function setupRoadviewResizer() {
    const resizer = document.getElementById('map-resizer');
    const roadview = document.getElementById('roadview');
    const main = document.getElementById('main-content');

    resizer.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        resizer.setPointerCapture(e.pointerId);
        document.body.classList.add('select-none', 'cursor-row-resize');

        const onMove = (ev) => {
            const rect = main.getBoundingClientRect();
            const height = Math.max(100, Math.min(rect.bottom - ev.clientY, rect.height - 100));
            roadview.style.height = `${height}px`;
        };
        resizer.addEventListener('pointermove', onMove);
        resizer.addEventListener('lostpointercapture', () => {
            resizer.removeEventListener('pointermove', onMove);
            document.body.classList.remove('select-none', 'cursor-row-resize');
            state.map.relayout();
            state.roadview.relayout();
        }, { once: true });
    });
}
