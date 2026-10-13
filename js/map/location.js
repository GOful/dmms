/**
 * 내 위치 표시 (지도 컨트롤 '내 위치 표시')
 */
const tracking = { watchId: null, marker: null };

const GEO_OPTIONS = {
    enableHighAccuracy: true,
    maximumAge: 30000,   // 30초 이내 위치는 재사용
    timeout: 10000,
};

/**
 * 내 위치 추적 켜기/끄기
 * @param {kakao.maps.Map} map
 * @param {boolean} enabled
 * @param {{ onError: Function }} options 위치를 받지 못했을 때 (체크 해제 등)
 */
export function toggleLocation(map, enabled, { onError }) {
    const loading = document.getElementById('location-loading');

    if (!enabled) {
        stop();
        loading.classList.add('hidden');
        return;
    }
    if (!navigator.geolocation) {
        alert('이 브라우저는 위치 정보를 지원하지 않습니다.');
        onError();
        return;
    }

    loading.classList.remove('hidden');
    tracking.watchId = navigator.geolocation.watchPosition(
        (position) => {
            loading.classList.add('hidden');
            updateMarker(map, position.coords);
        },
        (err) => {
            console.error('위치 정보를 가져올 수 없습니다.', err);
            alert('위치 정보를 가져올 수 없습니다. 기기의 권한을 확인해주세요.');
            loading.classList.add('hidden');
            stop();
            onError();
        },
        GEO_OPTIONS,
    );
}

function stop() {
    if (tracking.watchId != null) navigator.geolocation.clearWatch(tracking.watchId);
    tracking.marker?.setMap(null);
    tracking.watchId = tracking.marker = null;
}

/** 위치 마커 이동 (처음 표시할 때만 지도를 내 위치로 이동) */
function updateMarker(map, { latitude, longitude }) {
    const position = new kakao.maps.LatLng(latitude, longitude);
    if (tracking.marker) {
        tracking.marker.setPosition(position);
        return;
    }
    tracking.marker = new kakao.maps.CustomOverlay({
        map, position, xAnchor: 0.5, yAnchor: 0.5,
        content: `
            <div class="relative flex items-center justify-center">
                <div class="absolute w-14 h-14 bg-blue-500 rounded-full opacity-75 animate-ping"></div>
                <div class="relative z-10 w-12 h-12 bg-white rounded-full shadow-xl border-2 border-blue-500 flex items-center justify-center overflow-hidden">
                    <img src="img/logo.svg" alt="내 위치" class="w-9 h-9 object-contain">
                </div>
            </div>`,
    });
    map.panTo(position);
}
