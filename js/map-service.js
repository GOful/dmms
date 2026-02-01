let map, rv, rvClient;
const markersMap = {};
const starImg = new kakao.maps.MarkerImage('https://t1.daumcdn.net/localimg/localimages/07/mapapidoc/markerStar.png', new kakao.maps.Size(24, 35));

export function initMap() {
    map = new kakao.maps.Map(document.getElementById('map'), {
        center: new kakao.maps.LatLng(35.8714, 128.6014),
        level: 7
    });
    rv = new kakao.maps.Roadview(document.getElementById('roadview'));
    rvClient = new kakao.maps.RoadviewClient();
}

export function createMarker(mh, pos, stationName, onSelect) {
    const marker = new kakao.maps.Marker({ position: pos, map: map });
    markersMap[mh.id] = { marker, pos, data: mh, stationName };
    kakao.maps.event.addListener(marker, 'click', () => onSelect(mh.id));
}

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

export function relayoutMap() {
    setTimeout(() => { if(map) map.relayout(); }, 300);
}