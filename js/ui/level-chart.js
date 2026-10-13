/**
 * 연도별 수위 꺾은선 차트 (인라인 SVG) — 맨홀 상세정보에서 사용
 */

const SIZE = { width: 600, height: 210, left: 56, right: 24, top: 24, bottom: 28 };
const STEP_MM = 500;   // 세로축 눈금 간격

/**
 * @param {object[]} records 연도별 기록 (year, level, repair, flood, note)
 * @param {number|null} avgLevel 평균 수위 (가로 점선)
 */
export function renderLevelChart(records, avgLevel) {
    const points = records.filter((r) => r.level != null);
    if (!points.length) {
        return '<div class="py-8 text-center text-sm text-slate-400">수위 측정 기록이 없습니다.</div>';
    }

    const { width: W, height: H, left, right, top, bottom } = SIZE;
    // 사진만 있는 연도(엑셀 미기재)는 가로축 범위에서 제외
    const years = records.filter((r) => r.level != null || r.repair || r.note).map((r) => r.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    // 최고점이 위쪽 끝에 붙지 않도록 10% 여유를 두고 500mm 단위로 올림
    const maxLevel = Math.max(STEP_MM, Math.ceil((Math.max(...points.map((p) => p.level)) * 1.1) / STEP_MM) * STEP_MM);

    const x = (year) => left + (maxYear === minYear
        ? (W - left - right) / 2
        : ((year - minYear) / (maxYear - minYear)) * (W - left - right));
    const y = (level) => top + (1 - level / maxLevel) * (H - top - bottom);
    const inRange = (r) => r.year >= minYear && r.year <= maxYear;

    // 눈금이 너무 많으면 1000mm 단위만
    const ticks = Array.from({ length: maxLevel / STEP_MM + 1 }, (_, i) => i * STEP_MM)
        .filter((v, _, all) => all.length <= 7 || v % 1000 === 0);
    const gridLines = ticks.map((v) => `
        <line x1="${left}" x2="${W - right}" y1="${y(v)}" y2="${y(v)}" stroke="#e2e8f0"/>
        <text x="${left - 6}" y="${y(v) + 4}" text-anchor="end" font-size="11" fill="#94a3b8">${v.toLocaleString()}</text>`);

    const yearLabels = [];
    for (let year = minYear; year <= maxYear; year++) {
        yearLabels.push(`<text x="${x(year)}" y="${H - 8}" text-anchor="middle" font-size="10.5" fill="#64748b">${year}년</text>`);
    }

    const floodBands = records.filter((r) => r.flood && inRange(r)).map((r) => `
        <rect x="${x(r.year) - 14}" y="${top}" width="28" height="${H - top - bottom}" fill="#fee2e2" opacity="0.7"/>`);

    const repairLines = records.filter((r) => r.repair && inRange(r)).map((r) => `
        <line x1="${x(r.year)}" x2="${x(r.year)}" y1="${top}" y2="${H - bottom}" stroke="#10b981" stroke-width="1.5" stroke-dasharray="4 3"/>
        <text x="${x(r.year)}" y="${top - 8}" text-anchor="middle" font-size="10" font-weight="600" fill="#059669">맨홀보수</text>`);

    const avgLine = avgLevel == null ? '' : `
        <line x1="${left}" x2="${W - right}" y1="${y(avgLevel)}" y2="${y(avgLevel)}" stroke="#94a3b8" stroke-dasharray="6 4"/>
        <text x="${W - right}" y="${y(avgLevel) - 4}" text-anchor="end" font-size="10" fill="#64748b">평균 ${avgLevel.toLocaleString()}</text>`;

    const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.year)},${y(p.level)}`).join(' ');
    const dots = points.map((p) => `
        <circle cx="${x(p.year)}" cy="${y(p.level)}" r="${p.flood ? 5.5 : 4.5}" fill="${p.flood ? '#ef4444' : '#2563eb'}" stroke="#fff" stroke-width="1.5">
            <title>${p.year}년 ${p.level.toLocaleString()}mm${p.flood ? ' (접속개소 침수)' : ''}</title>
        </circle>`);

    return `
        <svg viewBox="0 0 ${W} ${H}" class="w-full h-auto" role="img" aria-label="연도별 수위 추이">
            ${floodBands.join('')}
            ${gridLines.join('')}
            <text x="4" y="${top - 8}" font-size="10" fill="#94a3b8">(mm)</text>
            ${avgLine}
            ${repairLines.join('')}
            <path d="${path}" fill="none" stroke="#2563eb" stroke-width="2" stroke-linejoin="round"/>
            ${dots.join('')}
            ${yearLabels.join('')}
        </svg>`;
}
