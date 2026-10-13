/**
 * 지도 날씨 레이어 (지도 컨트롤 '현재 날씨')
 *
 *   시연 모드: 역 지점마다 반경 500m 원 + 날씨 라벨          (weather_data.json)
 *   관리 모드: 맨홀이 있는 기상청 500m 격자 칸 + 구간별 라벨   (weather_data.admin.json)
 *   데이터는 scripts/fetch_weather.py 가 매시간 갱신한다.
 */
import { loadWeather } from '../data.js';

const STROKE = '#1E90FF';
const FILL = '#87CEFA';
const FILL_RAIN = '#3B82F6';

const layer = { overlays: [], loaded: false, visible: false, observedAt: '' };

/** 날씨 레이어 켜기/끄기 (처음 켤 때 데이터 로드) */
export async function toggleWeather(map, visible) {
    layer.visible = visible;
    if (visible && !layer.loaded) {
        layer.loaded = true;
        try {
            const data = await loadWeather();
            const points = data.cells ? Object.values(data.cells) : Object.values(data);
            if (data.cells) drawGrid(map, data);
            else drawStations(map, data);
            layer.observedAt = latestObservedTime(points);
        } catch (e) {
            layer.loaded = false;
            console.error('날씨 데이터 로드 실패:', e);
        }
    }
    // 로드 중에 체크가 바뀌었을 수 있으므로 마지막 상태로 맞춤
    layer.overlays.forEach((o) => o.setMap(layer.visible ? map : null));

    const updated = document.getElementById('weather-updated');
    updated.textContent = layer.observedAt ? `${layer.observedAt} 관측` : '';
    updated.classList.toggle('hidden', !(layer.visible && layer.observedAt));
}

/** 지점들 중 가장 최근 관측 시각 → 'MM.DD HH:mm' (TM: YYYYMMDDHHMM, 없으면 '') */
function latestObservedTime(points) {
    const tm = points.map((p) => p.TM).filter(Boolean).sort().pop();
    if (!tm) return '';
    return `${tm.slice(4, 6)}.${tm.slice(6, 8)} ${tm.slice(8, 10)}:${tm.slice(10, 12)}`;
}

/** 시연 모드: 역 지점 원 + 라벨 */
function drawStations(map, stations) {
    Object.values(stations).forEach((station) => {
        const w = parseWeather(station);
        const lat = parseFloat(station.LAT);
        const lng = parseFloat(station.LON);

        layer.overlays.push(new kakao.maps.Circle({
            map, center: new kakao.maps.LatLng(lat, lng), radius: 500,
            strokeColor: STROKE, strokeOpacity: 0.8, fillColor: FILL, fillOpacity: 0.3,
        }));
        layer.overlays.push(new kakao.maps.CustomOverlay({
            map, position: new kakao.maps.LatLng(lat + 0.004, lng), xAnchor: 0.5, yAnchor: 0.5,
            content: labelHtml({
                icon: weatherIcon(w.ta, w.rain, w.vs),
                temp: `${w.ta.toFixed(1)}°C`,
                rain: w.rain ? `강수: ${w.rnDay.toFixed(1)}mm` : '강수 없음',
            }),
        }));
    });
}

/** 관리 모드: 500m 격자 칸 사각형 + 구간별 요약 라벨 */
function drawGrid(map, { cells, sections }) {
    Object.values(cells).forEach((cell) => {
        const { rain } = parseWeather(cell);
        layer.overlays.push(new kakao.maps.Polygon({
            map,
            path: cell.CORNERS.map(([lat, lng]) => new kakao.maps.LatLng(lat, lng)),
            strokeWeight: 1, strokeColor: STROKE, strokeOpacity: 0.8,
            fillColor: rain ? FILL_RAIN : FILL, fillOpacity: rain ? 0.35 : 0.25,
        }));
    });

    sections.forEach((section) => {
        const sectionCells = section.cells.map((key) => cells[key]).filter(Boolean);
        const ws = sectionCells.map(parseWeather).filter((w) => !Number.isNaN(w.ta));
        if (!ws.length) return;

        const minTa = Math.min(...ws.map((w) => w.ta));
        const maxTa = Math.max(...ws.map((w) => w.ta));
        const rainy = ws.filter((w) => w.rain);
        const maxRain = Math.max(0, ...rainy.map((w) => w.rnDay));
        // 라벨은 구간의 가장 북쪽 칸 위에 붙여 격자를 가리지 않게 함
        const topLat = Math.max(...sectionCells.flatMap((c) => c.CORNERS.map(([lat]) => lat)));

        layer.overlays.push(new kakao.maps.CustomOverlay({
            map, position: new kakao.maps.LatLng(topLat, section.lon), xAnchor: 0.5, yAnchor: 1.1,
            content: labelHtml({
                title: section.name,
                icon: weatherIcon(minTa, rainy.length > 0, Math.min(...ws.map((w) => w.vs))),
                temp: minTa === maxTa ? `${minTa.toFixed(1)}°C` : `${minTa.toFixed(1)}~${maxTa.toFixed(1)}°C`,
                rain: rainy.length ? `강수: ${maxRain.toFixed(1)}mm` : '강수 없음',
            }),
        }));
    });
}

/** 기상청 실황 값 → 숫자 (-999 등 결측은 NaN) */
function parseWeather(data) {
    const num = (v) => {
        const n = parseFloat(v);
        return n > -90 ? n : NaN;
    };
    const rnOx = num(data.RN_OX);
    const rnDay = num(data.RN_DAY);
    return { ta: num(data.TA), vs: num(data.VS), rnDay: rnDay || 0, rain: rnOx > 0 || rnDay > 0 };
}

/** 강수 시 기온 2℃ 이하면 눈, 아니면 비 / 시정 50 미만이면 안개 */
function weatherIcon(ta, rain, vs) {
    if (rain) return ta <= 2.0 ? '❄️' : '☔️';
    if (vs < 50) return '🌫️';
    return '☀️';
}

function labelHtml({ icon, temp, rain, title = '' }) {
    return `
        <div class="pointer-events-none flex items-center gap-3 bg-white/90 backdrop-blur-sm border border-slate-300 rounded-xl px-4 py-2 shadow-lg">
            <div class="text-2xl drop-shadow-sm">${icon}</div>
            <div class="flex flex-col items-start text-xs">
                ${title ? `<div class="text-[10px] font-medium text-slate-500">${title}</div>` : ''}
                <div class="font-bold text-sm text-slate-800">${temp}</div>
                <div class="text-slate-500 font-medium">${rain}</div>
            </div>
        </div>`;
}
