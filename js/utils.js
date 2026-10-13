/**
 * 공용 유틸리티
 */

/** HTML 특수문자 이스케이프 */
export function escapeHtml(value) {
    const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    return String(value).replace(/[&<>"']/g, (c) => map[c]);
}

/** JSON 파일 로드 — noCache: 매번 새로 받음 (날씨처럼 자주 바뀌는 파일) */
export async function fetchJson(path, { noCache = false } = {}) {
    const res = noCache
        ? await fetch(`${path}?t=${Date.now()}`, { cache: 'no-store' })
        : await fetch(path);
    if (!res.ok) throw new Error(`${path} 로드 실패 (HTTP ${res.status})`);
    return res.json();
}

/** 노선 > 구간 > 맨홀 순회 — callback(manhole, station, line) */
export function forEachManhole(data, callback) {
    data.lines.forEach((line) =>
        line.stations.forEach((station) =>
            station.manholes.forEach((manhole) => callback(manhole, station, line))));
}

/** 수위 값 HTML — '1,200mm' (값이 없으면 '-') */
export function mmHtml(value, unitClass = 'text-xs') {
    if (value == null) return '-';
    return `${value.toLocaleString()}<span class="${unitClass} font-normal text-slate-400 ml-0.5">mm</span>`;
}

/** 이전 측정 대비 수위 변화 HTML (▲ 상승 / ▼ 하강) */
export function levelDeltaHtml(current, prev) {
    if (current == null || prev == null || current === prev) return '';
    const diff = current - prev;
    return diff > 0
        ? `<span class="text-red-500 text-xs font-medium">▲${diff}</span>`
        : `<span class="text-blue-500 text-xs font-medium">▼${-diff}</span>`;
}

/** 'MM.DD(요일) HH:mm' */
export function formatDateTime(date = new Date()) {
    const pad = (n) => String(n).padStart(2, '0');
    const day = '일월화수목금토'[date.getDay()];
    return `${pad(date.getMonth() + 1)}.${pad(date.getDate())}(${day}) ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
