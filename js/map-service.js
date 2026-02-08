import { selectManholeInSidebar } from './ui-manager.js';

let map, rv, rvClient;
let currentCircle = null; // 현재 그려진 원을 저장
let centerMarker = null;  // 중심점 마커를 저장
const markersMap = {};    // 맨홀 ID를 키로 하는 마커 객체 저장소
let weatherOverlays = []; // 날씨 오버레이(원, 커스텀오버레이) 객체 배열
let currentOverlay = null; // 현재 표시된 맨홀 정보 오버레이

// 지도에 표시할 별 모양 마커 이미지 설정
const starImg = new kakao.maps.MarkerImage(
    'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png', 
    new kakao.maps.Size(24, 35)
);

// 기본 맨홀 마커 이미지 설정 (img/marker1.png)
const normalImg = new kakao.maps.MarkerImage(
    'img/marker1.png',
    new kakao.maps.Size(40, 40)
);

/**
 * [초기화] 카카오맵 및 로드뷰 객체를 생성하고 초기 설정을 수행합니다.
 * - 지도 중심: 대구광역시 중앙로 인근
 * - 로드뷰 클라이언트 초기화
 * - UI 컨트롤 이벤트 바인딩
 */
export function initMap() {
    map = new kakao.maps.Map(document.getElementById('map'), {
        center: new kakao.maps.LatLng(35.8714, 128.6014),
        level: 7
    });

    // 줌 레벨 제한 설정 (1: 최대 확대, 14: 최대 축소)
    map.setMinLevel(1);
    map.setMaxLevel(14);

    rv = new kakao.maps.Roadview(document.getElementById('roadview'));
    rvClient = new kakao.maps.RoadviewClient();

    setupMapControls();
}

/**
 * [이벤트] 지도 상단 컨트롤(교통정보, 날씨)의 체크박스 이벤트를 설정합니다.
 */
function setupMapControls() {
    const trafficCheckbox = document.getElementById('traffic-checkbox');
    const weatherCheckbox = document.getElementById('weather-checkbox');
    const roadviewCheckbox = document.getElementById('roadview-checkbox');
    const mapResizer = document.getElementById('map-resizer');

    // 교통정보 레이어 토글
    trafficCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            map.addOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);
        } else {
            map.removeOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);
        }
    });

    // 날씨 오버레이 토글
    weatherCheckbox.addEventListener('change', (e) => {
        toggleWeather(e.target.checked);
    });

    // 로드뷰 토글 (추가된 기능)
    roadviewCheckbox.addEventListener('change', (e) => {
        const rvContainer = document.getElementById('roadview');
        if (e.target.checked) {
            rvContainer.style.display = 'block';
            mapResizer.style.display = 'block'; // 리사이저 표시
            map.relayout(); // 지도가 줄어든 영역에 맞게 재조정
            rv.relayout();  // 로드뷰가 보일 때 렌더링 갱신
        } else {
            rvContainer.style.display = 'none';
            mapResizer.style.display = 'none'; // 리사이저 숨김
            map.relayout(); // 지도가 전체 영역을 차지하도록 재조정
        }
    });
}

/**
 * [기능] 날씨 정보 오버레이를 켜거나 끕니다.
 * @param {boolean} show - 날씨 정보를 표시할지 여부
 */
function toggleWeather(show) {
    if (show && weatherOverlays.length === 0) {
        // 최초 활성화 시 데이터를 로드하여 표시
        displayWeather();
    } else {
        // 이미 로드된 오버레이들의 표시 여부만 변경 (성능 최적화)
        weatherOverlays.forEach(overlay => overlay.setMap(show ? map : null));
    }
}

/**
 * [기능] weather_data.json 파일을 읽어 각 역 위치에 날씨 정보를 시각화합니다.
 * - 반경 500m 원 표시
 * - 기온 및 강수량 커스텀 오버레이 표시
 */
async function displayWeather() {
    if (weatherOverlays.length > 0) return; // 이미 데이터가 있으면 실행하지 않음

    try {
        const response = await fetch('weather_data.json');
        const weatherData = await response.json();

        for (const stationName in weatherData) {
            const data = weatherData[stationName];
            const lat = parseFloat(data.LAT);
            const lng = parseFloat(data.LON);
            const position = new kakao.maps.LatLng(lat, lng);

            // 데이터 파싱 (기온, 강수유무, 1시간 강수량, 시정)
            const ta = parseFloat(data.TA);
            const rn_ox_val = parseFloat(data.RN_OX);
            const rn_60m = parseFloat(data.RN_60M);
            const vs = parseInt(data.VS, 10);

            // 1. 날씨 아이콘 결정 로직 (우선순위: 강수 > 안개 > 맑음)
            let weatherIcon = '☀️'; // 기본값: 맑음
            if (rn_ox_val > 0 || rn_60m > 0) {
                weatherIcon = '☔️'; // 비 또는 눈
            } else if (vs < 5000) { // 시정이 5km 미만이면
                weatherIcon = '🌫️'; // 안개
            }

            // 2. 텍스트 정보 구성
            const tempText = `${ta.toFixed(1)}°C`;
            const pcpText = rn_60m > 0 ? `강수: ${rn_60m}mm` : "강수 없음";

            // 3. 시각화: 반경 500m 원 생성
            const circle = new kakao.maps.Circle({
                center: position,
                radius: 500,
                strokeWeight: 2,
                strokeColor: '#1E90FF',
                strokeOpacity: 0.8,
                strokeStyle: 'solid',
                fillColor: '#87CEFA',
                fillOpacity: 0.3,
                map: map
            });

            // 4. 시각화: 정보창(커스텀 오버레이) 생성
            const content = `
                <div class="flex items-center gap-3 bg-white/90 backdrop-blur-sm border border-slate-300 rounded-xl px-4 py-2 shadow-lg -translate-y-4 -translate-x-1/2 transform transition-transform hover:scale-105">
                    <div class="text-2xl filter drop-shadow-sm">${weatherIcon}</div>
                    <div class="flex flex-col items-start text-xs">
                        <div class="font-bold text-sm text-slate-800">${tempText}</div>
                        <div class="text-slate-500 font-medium">${pcpText}</div>
                    </div>
                </div>
            `;
            const customOverlay = new kakao.maps.CustomOverlay({
                position: position,
                content: content,
                map: map,
                yAnchor: 1.2
            });
            
            // 생성된 객체를 배열에 저장하여 추후 토글 시 사용
            weatherOverlays.push(circle);
            weatherOverlays.push(customOverlay);
        }
    } catch (e) {
        console.error("날씨 데이터 로드 또는 표시에 실패했습니다:", e);
    }
}

/**
 * [기능] 개별 맨홀 마커를 생성하고 클릭 이벤트를 등록합니다.
 * @param {Object} mh - 맨홀 데이터 객체
 * @param {kakao.maps.LatLng} pos - 마커 위치
 * @param {string} stationName - 소속 역 이름
 * @param {Function} onSelect - 마커 클릭 시 실행할 콜백 함수
 */
export function createMarker(mh, pos, stationName, onSelect) {
    const marker = new kakao.maps.Marker({ position: pos, map: map, image: normalImg });
    markersMap[mh.id] = { marker, pos, data: mh, stationName };
    kakao.maps.event.addListener(marker, 'click', () => onSelect(mh.id));
}

/**
 * [디버그] 특정 좌표에 테스트용 마커와 반경 원을 그립니다.
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radiusMeter - 반경 (미터 단위, 5km = 5000)
 */
export function drawTestCircle(lat, lng, radiusMeter = 5000) {
    const position = new kakao.maps.LatLng(lat, lng);

    // 기존 테스트 객체 제거
    if (currentCircle) currentCircle.setMap(null);
    if (centerMarker) centerMarker.setMap(null);

    centerMarker = new kakao.maps.Marker({
        position: position,
        map: map
    });

    currentCircle = new kakao.maps.Circle({
        center: position,         // 원의 중심좌표
        radius: radiusMeter,      // 미터 단위의 반경 (5000 = 5km)
        strokeWeight: 2,          // 선의 두께
        strokeColor: '#75B8FA',   // 선의 색깔
        strokeOpacity: 0.8,       // 선의 불투명도
        strokeStyle: 'solid',     // 선의 스타일
        fillColor: '#CFE7FF',      // 채우기 색깔
        fillOpacity: 0.3          // 채우기 불투명도 (지도가 비쳐 보이도록 설정)
    });

    currentCircle.setMap(map);
    map.panTo(position);
}

/**
 * [기능] 특정 맨홀을 선택했을 때의 동작을 처리합니다.
 * - 사이드바 항목 활성화
 * - 지도 중심 이동 및 확대
 * - 마커 이미지 변경 (하이라이트)
 * - 로드뷰 업데이트
 * @param {string} id - 선택된 맨홀 ID
 */
export function selectManhole(id) {
    selectManholeInSidebar(id); // 사이드바 선택 동기화
    const target = markersMap[id];
    if(!target) return;

    // 지도 뷰 업데이트
    map.setLevel(4);
    map.panTo(target.pos);

    // 마커 하이라이트 처리
    Object.values(markersMap).forEach(m => m.marker.setImage(normalImg));
    target.marker.setImage(starImg);

    // 로드뷰 연동: 해당 위치의 가장 가까운 파노라마 ID를 찾아 이동
    rvClient.getNearestPanoId(target.pos, 50, (pId) => {
        if(pId) rv.setPanoId(pId, target.pos);
    });

    // 맨홀 정보 오버레이 표시 (네임카드)
    showManholeOverlay(target.data, target.stationName, target.pos);
}

/**
 * [기능] 지도 상의 마커 위에 맨홀 정보 오버레이(네임카드)를 표시합니다.
 */
function showManholeOverlay(mh, stationName, position) {
    // 기존 오버레이가 있다면 제거
    if (currentOverlay) {
        currentOverlay.setMap(null);
    }

    // 임의의 수위 데이터 생성 (데모용)
    const waterLevel = Math.floor(Math.random() * 300) + 200; 

    // 오버레이 컨텐츠 생성 (DOM Element 방식)
    const content = document.createElement('div');
    content.className = 'absolute bottom-10 left-1/2 -translate-x-1/2 w-auto min-w-[300px] max-w-[90vw] bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-[fadeIn_0.2s_ease-out] z-50';
    
    content.innerHTML = `
        <div class="p-4 relative">
            <div class="absolute top-2 right-2">
                <button class="close-overlay-btn text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" /></svg>
                </button>
            </div>
            <div class="flex justify-between items-start mb-3">
                <div class="flex-1 pr-8">
                    <h3 class="text-lg font-bold text-slate-800 flex flex-wrap items-center gap-2">
                        ${mh.name}
                        <span class="text-xs font-normal px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">${stationName}</span>
                    </h3>
                    <p class="text-xs text-slate-500 mt-1">ID: ${mh.id} | 좌표: ${mh.lat.toFixed(4)}, ${mh.lng.toFixed(4)}</p>
                </div>
            </div>
            <div class="grid grid-cols-3 gap-2 text-center">
                <div class="bg-slate-50 p-2 rounded-lg border border-slate-100 group hover:border-blue-200 transition-colors">
                    <div class="text-xs text-slate-500 mb-1">민원</div>
                    <div class="font-bold text-slate-700 text-lg">${mh.complaint_cnt || 0}<span class="text-xs font-normal text-slate-400 ml-0.5">회</span></div>
                </div>
                <div class="bg-slate-50 p-2 rounded-lg border border-slate-100 group hover:border-blue-200 transition-colors">
                    <div class="text-xs text-slate-500 mb-1">수선</div>
                    <div class="font-bold text-blue-600 text-lg">${mh.repair_cnt || 0}<span class="text-xs font-normal text-slate-400 ml-0.5">회</span></div>
                </div>
                <div class="bg-slate-50 p-2 rounded-lg border border-slate-100 group hover:border-blue-200 transition-colors">
                    <div class="text-xs text-slate-500 mb-1">침수빈도</div>
                    <div class="font-bold text-red-500 text-lg">${mh.flood_freq || 0}<span class="text-xs font-normal text-slate-400 ml-0.5">회</span></div>
                </div>
            </div>
            <div class="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                    <div class="text-xs text-slate-500 flex items-center gap-1">
                        평균수위 <span class="font-bold text-slate-700 text-sm">${waterLevel}mm</span> 
                        <span class="w-2 h-2 rounded-full bg-green-500 ml-1"></span><span class="text-green-600">정상</span>
                    </div>
                    <button class="text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors shadow-sm">상세보기</button>
            </div>
        </div>
    `;

    // 닫기 버튼 이벤트 연결
    const closeBtn = content.querySelector('.close-overlay-btn');
    closeBtn.addEventListener('click', () => {
        if (currentOverlay) currentOverlay.setMap(null);
    });

    // 커스텀 오버레이 생성 및 지도 표시
    currentOverlay = new kakao.maps.CustomOverlay({
        position: position,
        content: content,
        yAnchor: 1, // 마커 바로 위에 위치하도록 설정
        zIndex: 100
    });
    currentOverlay.setMap(map);
}

/**
 * [유틸] 사이드바 토글 등으로 지도 컨테이너 크기가 변경되었을 때 레이아웃을 갱신합니다.
 */
export function relayoutMap() {
    setTimeout(() => { 
        if(map) map.relayout();
        // 로드뷰가 보이는 상태라면 로드뷰도 리레이아웃
        const rvContainer = document.getElementById('roadview');
        if(rv && rvContainer && rvContainer.style.display !== 'none') {
            rv.relayout();
        }
    }, 300);
}

/**
 * [기능] 지도와 로드뷰 사이의 높이 조절(Resizer) 기능을 초기화합니다.
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
            // 로드뷰 높이 = 전체 높이 - 마우스 Y 좌표 (하단 기준 계산)
            let newHeight = mainRect.bottom - e.clientY;
            
            // 최소 100px, 최대 (전체 - 100px) 제한
            newHeight = Math.max(100, Math.min(newHeight, mainRect.height - 100));

            roadviewContainer.style.height = `${newHeight}px`;
        };

        const mouseUpHandler = () => {
            isResizing = false;
            document.removeEventListener('mousemove', mouseMoveHandler);
            document.removeEventListener('mouseup', mouseUpHandler);
            document.body.style.cursor = 'default';
            document.body.style.userSelect = 'auto';
            
            // 리사이징 종료 후 지도/로드뷰 레이아웃 갱신 (딜레이 없이 즉시 호출)
            if(map) map.relayout();
            if(rv) rv.relayout();
        };

        document.addEventListener('mousemove', mouseMoveHandler);
        document.addEventListener('mouseup', mouseUpHandler);
    });
}