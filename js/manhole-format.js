// ========================================
// 맨홀 이력 데이터 표시용 공통 헬퍼 (지도 오버레이 / 상세 모달 공용)
// ========================================

/** [헬퍼] 이전 측정 대비 수위 변화 표시 HTML (▲ 상승 / ▼ 하강) */
export function levelDelta(current, prev) {
    if (current == null || prev == null || current === prev) return '';
    const diff = current - prev;
    return diff > 0
        ? `<span class="text-red-500 text-xs font-medium">▲${diff}</span>`
        : `<span class="text-blue-500 text-xs font-medium">▼${-diff}</span>`;
}
