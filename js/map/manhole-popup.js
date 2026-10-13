/**
 * 맨홀 마커 클릭 시 지도 위에 뜨는 정보 팝업
 */
import { escapeHtml, levelDeltaHtml, mmHtml } from '../utils.js';

const CLOSE_ICON = '<path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>';
const WARNING_ICON = '<path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>';

/**
 * 팝업 DOM 생성
 * @param {object} manhole 맨홀 데이터 (관리 모드는 이력 요약값 포함)
 * @param {{ onClose: Function, onDetail: Function }} handlers
 */
export function createManholePopup(manhole, { onClose, onDetail }) {
    const level = window.DMMS.isAdmin ? manhole : demoLevelStats();
    const flooded = manhole.flood_cnt > 0;

    const wrapper = document.createElement('div');
    wrapper.innerHTML = `
        <div class="absolute bottom-14 left-1/2 -translate-x-1/2 min-w-[300px] max-w-[90vw] bg-white/95 backdrop-blur-md rounded-xl shadow-2xl border border-slate-200 overflow-hidden animate-[fadeIn_0.2s_ease-out] z-50">
            <div class="p-4 relative">
                <button class="js-close absolute top-2 right-2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100 transition-colors">
                    <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">${CLOSE_ICON}</svg>
                </button>

                <div class="pr-8 mb-3">
                    <h3 class="text-lg font-bold text-slate-800">${escapeHtml(manhole.name)}</h3>
                    <p class="text-xs text-slate-500 mt-1">ID: ${manhole.id} | 좌표: ${manhole.lat.toFixed(4)}, ${manhole.lng.toFixed(4)}</p>
                </div>

                ${flooded && manhole.flood_years?.length ? `
                <div class="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700">
                    <svg class="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">${WARNING_ICON}</svg>
                    <div class="text-xs leading-tight">
                        <div class="font-bold">접속개소 침수 이력 ${manhole.flood_cnt}회</div>
                        <div class="text-red-500">${manhole.flood_years.map((y) => `${y}년`).join(' · ')}</div>
                    </div>
                </div>` : ''}

                <div class="grid grid-cols-2 gap-2 text-center">
                    ${countTile('맨홀보수', manhole.repair_cnt, 'text-blue-600')}
                    ${countTile('접속개소 침수', manhole.flood_cnt, 'text-red-500', flooded)}
                </div>

                <div class="mt-3 grid grid-cols-3 text-center rounded-lg border border-slate-100 divide-x divide-slate-100">
                    ${levelCell('평균수위', level.avg_level)}
                    ${levelCell('최대수위', level.max_level, level.max_level_year)}
                    ${levelCell('최저수위', level.min_level, level.min_level_year)}
                </div>

                <div class="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center">
                    <div class="text-xs text-slate-500 flex items-center gap-1.5">
                        최근수위${level.latest_level_year ? `(${level.latest_level_year})` : ''}
                        ${level.latest_level != null
                            ? `<span class="font-bold text-slate-700 text-sm">${level.latest_level.toLocaleString()}mm</span>${levelDeltaHtml(level.latest_level, level.prev_level)}`
                            : '<span class="text-slate-400">측정 기록 없음</span>'}
                    </div>
                    <button class="js-detail text-xs bg-slate-800 text-white px-3 py-1.5 rounded-lg hover:bg-slate-700 transition-colors shadow-sm">상세보기</button>
                </div>
            </div>
        </div>`;

    const popup = wrapper.firstElementChild;
    popup.querySelector('.js-close').addEventListener('click', onClose);
    popup.querySelector('.js-detail').addEventListener('click', onDetail);
    return popup;
}

function countTile(label, count, colorClass, highlight = false) {
    const box = highlight ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100';
    return `
        <div class="${box} p-2 rounded-lg border">
            <div class="text-xs text-slate-500 mb-1">${label}</div>
            <div class="font-bold ${colorClass} text-lg">${count || 0}<span class="text-xs font-normal text-slate-400 ml-0.5">회</span></div>
        </div>`;
}

function levelCell(label, value, year) {
    return `
        <div class="py-1.5">
            <div class="text-[11px] text-slate-500">${label}</div>
            <div class="text-sm font-bold text-slate-700">${mmHtml(value, 'text-[10px]')}</div>
            ${year ? `<div class="text-[10px] text-slate-400">${year}년</div>` : ''}
        </div>`;
}

/** 시연 모드: 실제 수위 데이터가 없으므로 임의의 5개년 수위로 통계 생성 */
function demoLevelStats() {
    const levels = Array.from({ length: 5 }, () => Math.floor(Math.random() * 300) + 200);
    return {
        latest_level: levels[4],
        prev_level: levels[3],
        avg_level: Math.round(levels.reduce((a, b) => a + b, 0) / levels.length),
        max_level: Math.max(...levels),
        min_level: Math.min(...levels),
    };
}
