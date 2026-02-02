let map, rv, rvClient;
let currentCircle = null; // 현재 그려진 원을 저장
let centerMarker = null;  // 중심점 마커를 저장
const markersMap = {};

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

    // 초기화 시 테스트를 위해 대구 달서구청 인근에 5km 반경 표시
    // (테스트가 끝나면 아래 줄은 삭제하세요)
  
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
    const target = markersMap[id];
    if(!target) return;
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