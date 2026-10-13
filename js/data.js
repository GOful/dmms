/**
 * 데이터 로드 — 모드에 따라 *.json(시연) / *.admin.json(관리) 을 읽는다
 */
import { fetchJson, forEachManhole } from './utils.js';

const { DMMS } = window;

/**
 * 맨홀 목록. 관리 모드는 엑셀에서 변환한 이력(manhole_history.admin.json)을 각 맨홀에 병합한다.
 * (병합 필드: repair_cnt, flood_cnt, *_level, records 등 — scripts/build_manhole_history.py 참고)
 */
export async function loadManholes() {
    const data = await fetchJson(DMMS.dataPath('manholes.json'));
    if (DMMS.isAdmin) await mergeHistory(data);
    return data;
}

async function mergeHistory(data) {
    try {
        const history = await fetchJson('manhole_history.admin.json');
        forEachManhole(data, (manhole) => {
            const h = history.manholes[manhole.id];
            if (h) Object.assign(manhole, h, { hasHistory: true, flood_check_years: history.flood_check_years });
        });
    } catch (e) {
        console.error('맨홀 이력 로드 실패:', e);
    }
}

let equipmentCache = null;

/** 장비 목록 (한 번만 로드) */
export async function loadEquipment() {
    equipmentCache ??= await fetchJson(DMMS.dataPath('equipment_data.json'));
    return equipmentCache;
}

/** 날씨 (매시간 갱신되므로 캐시하지 않음) */
export function loadWeather() {
    return fetchJson(DMMS.dataPath('weather_data.json'), { noCache: true });
}
