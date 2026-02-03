import { selectManholeInSidebar } from './ui-manager.js';

let map, rv, rvClient;
let currentCircle = null; // 현재 그려진 원을 저장
let centerMarker = null;  // 중심점 마커를 저장
const markersMap = {};
let weatherOverlays = []; // 날씨 오버레이 저장 배열

const starImg = new kakao.maps.MarkerImage(
    'https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png', 
    new kakao.maps.Size(24, 35)
);

/**
 * 지도 및 로드뷰 초기화
 */
export function initMap() {
    map = new kakao.maps.Map(document.getElementById('map'), {
        center: new kakao.maps.LatLng(35.8714, 128.6014),
        level: 7
    });
    rv = new kakao.maps.Roadview(document.getElementById('roadview'));
    rvClient = new kakao.maps.RoadviewClient();

    // 지도 컨트롤 이벤트 리스너 연결
    setupMapControls();
}

/**
 * 지도 컨트롤(체크박스) 이벤트를 설정하는 함수
 */
function setupMapControls() {
    const trafficCheckbox = document.getElementById('traffic-checkbox');
    const weatherCheckbox = document.getElementById('weather-checkbox');

    trafficCheckbox.addEventListener('change', (e) => {
        if (e.target.checked) {
            map.addOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);
        } else {
            map.removeOverlayMapTypeId(kakao.maps.MapTypeId.TRAFFIC);
        }
    });

    weatherCheckbox.addEventListener('change', (e) => {
        toggleWeather(e.target.checked);
    });
}

/**
 * 날씨 정보 표시를 토글하는 함수
 * @param {boolean} show - 날씨 정보를 표시할지 여부
 */
function toggleWeather(show) {
    if (show && weatherOverlays.length === 0) {
        // 데이터가 없으면 새로 그림
        displayWeather();
    } else {
        // 데이터가 있으면 지도에 표시하거나 숨김
        weatherOverlays.forEach(overlay => overlay.setMap(show ? map : null));
    }
}

/**
 * 날씨 정보를 가져와 지도에 표시하는 함수
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

            // 날씨 정보 파싱
            const ta = parseFloat(data.TA);
            const rn_ox_val = parseFloat(data.RN_OX);
            const rn_60m = parseFloat(data.RN_60M);
            const vs = parseInt(data.VS, 10);

            // 1. 날씨 아이콘 결정 (우선순위: 비/눈 > 안개 > 맑음)
            let weatherIcon = '☀️'; // 기본값: 맑음
            // 강수 상태(rn_ox)가 0보다 크거나, 60분 강수량(rn_60m)이 0보다 크면 강수 아이콘 표시
            if (rn_ox_val > 0 || rn_60m > 0) {
                weatherIcon = '☔️'; // 비 또는 눈
            } else if (vs < 5000) { // 시정이 5km 미만이면
                weatherIcon = '🌫️'; // 안개
            }

            // 2. 텍스트 정보 구성
            const tempText = `${ta.toFixed(1)}°C`;
            const pcpText = rn_60m > 0 ? `강수: ${rn_60m}mm` : "강수 없음";

            // 3. 반경 500m 원 생성
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

            // 4. 날씨 정보를 표시할 커스텀 오버레이 생성
            const content = `
                <div class="weather-overlay">
                    <div class="weather-icon">${weatherIcon}</div>
                    <div class="weather-info">
                        <div class="weather-temp">${tempText}</div>
                        <div class="weather-pcp">${pcpText}</div>
                    </div>
                </div>
            `;
            const customOverlay = new kakao.maps.CustomOverlay({
                position: position,
                content: content,
                map: map,
                yAnchor: 1.2
            });
            
            weatherOverlays.push(circle);
            weatherOverlays.push(customOverlay);
        }
    } catch (e) {
        console.error("날씨 데이터 로드 또는 표시에 실패했습니다:", e);
    }
}

/**
 * 기존 맨홀 마커 생성 함수
 */
export function createMarker(mh, pos, stationName, onSelect) {
    const marker = new kakao.maps.Marker({ position: pos, map: map });
    markersMap[mh.id] = { marker, pos, data: mh, stationName };
    kakao.maps.event.addListener(marker, 'click', () => onSelect(mh.id));
}

/**
 * [테스트용] 특정 좌표에 마커를 찍고 반경 원을 그리는 함수
 * @param {number} lat - 위도
 * @param {number} lng - 경도
 * @param {number} radiusMeter - 반경 (미터 단위, 5km = 5000)
 */
export function drawTestCircle(lat, lng, radiusMeter = 5000) {
    const position = new kakao.maps.LatLng(lat, lng);

    // 기존에 그려진 원과 마커가 있다면 제거
    if (currentCircle) currentCircle.setMap(null);
    if (centerMarker) centerMarker.setMap(null);

    // 1. 중심점에 테스트 마커 표시
    centerMarker = new kakao.maps.Marker({
        position: position,
        map: map
    });

    // 2. 반경 원 생성
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

    // 3. 지도에 원 표시
    currentCircle.setMap(map);

    // 4. 해당 위치로 지도 중심 이동
    map.panTo(position);
}

/**
 * 맨홀 선택 시 처리
 */
export function selectManhole(id) {
    selectManholeInSidebar(id); // 사이드바 선택 동기화
    const target = markersMap[id];
    if(!target) return;
    map.setLevel(4);
    map.panTo(target.pos);
    Object.values(markersMap).forEach(m => m.marker.setImage(null));
    target.marker.setImage(starImg);
    rvClient.getNearestPanoId(target.pos, 50, (pId) => {
        if(pId) rv.setPanoId(pId, target.pos);
    });
}

/**
 * 지도의 레이아웃 재계산
 */
export function relayoutMap() {
    setTimeout(() => { if(map) map.relayout(); }, 300);
}