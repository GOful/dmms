/**
 * 맨홀 상세정보 모달 (지도 팝업의 '상세보기')
 *
 *   관리 모드: 엑셀 이력 — 침수 이력, 기본 정보, 수위 통계·차트, 맨홀보수 사진, 연도별 표
 *   시연 모드: 예시 데이터
 */
import { escapeHtml, levelDeltaHtml, mmHtml } from '../utils.js';
import { openModal } from './modal.js';
import { renderLevelChart } from './level-chart.js';

const ICONS = {
    info: '<svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    chart: '<svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"/></svg>',
    photo: '<svg class="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>',
    history: '<svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>',
    warning: '<svg class="w-6 h-6 text-red-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
    check: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
};

/** 상세정보 모달 열기 */
export function openManholeDetail(manhole) {
    let html;
    if (!window.DMMS.isAdmin) html = demoDetailHtml(manhole);
    else if (manhole.hasHistory) html = historyDetailHtml(manhole);
    else html = pendingDetailHtml(manhole);

    const body = openModal(`${manhole.name} 상세 정보`, `<div class="space-y-6">${html}</div>`);
    setupPhotoLightbox(body);
}

// ── 공통 조각 ────────────────────────────────────────────

function section(icon, title, content, note = '') {
    return `
        <div>
            <h4 class="font-bold text-slate-700 mb-3 flex items-center gap-2">
                ${ICONS[icon]} ${title}
                ${note ? `<span class="text-xs font-normal text-slate-400">${note}</span>` : ''}
            </h4>
            ${content}
        </div>`;
}

function statTile(label, valueHtml, sub = '', highlight = false) {
    return `
        <div class="p-3 rounded-lg border text-center ${highlight ? 'bg-red-50 border-red-200' : 'bg-white border-slate-200'}">
            <div class="text-xs text-slate-500 mb-1">${label}</div>
            <div class="font-bold text-lg text-slate-800">${valueHtml}</div>
            ${sub ? `<div class="text-[11px] text-slate-400 mt-0.5">${sub}</div>` : ''}
        </div>`;
}

function countHtml(count, colorClass) {
    return `<span class="${colorClass}">${count}</span><span class="text-xs font-normal text-slate-400 ml-0.5">회</span>`;
}

/** 기본 정보 상자 — rows: [[라벨, 값], ...], extra: 아래에 붙일 HTML */
function basicInfo(rows, extra = '') {
    return `
        <div class="bg-slate-50 p-4 rounded-lg border border-slate-200">
            <h4 class="font-bold text-slate-700 mb-2 flex items-center gap-2">${ICONS.info} 기본 정보</h4>
            <div class="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                ${rows.map(([label, value]) => `<div><span class="text-slate-500">${label}:</span> <span class="font-medium">${value}</span></div>`).join('')}
            </div>
            ${extra}
        </div>`;
}

const coords = (mh) => `${mh.lat.toFixed(5)}, ${mh.lng.toFixed(5)}`;
const yearText = (year) => (year ? `${year}년` : '');

// ── 관리 모드: 엑셀 이력 ─────────────────────────────────

function historyDetailHtml(mh) {
    const records = mh.records || [];
    const levelRange = mh.level_years ? `(${mh.level_years[0]}~${mh.level_years[1]}년 측정)` : '';

    return [
        floodBanner(mh),
        basicInfo(
            [
                ['ID', mh.id],
                ['위치', coords(mh)],
                ['구간', `${mh.line} ${escapeHtml(mh.section)} #${mh.no}`],
                ['최근 맨홀보수', mh.last_repair_year ? `${mh.last_repair_year}년` : '이력 없음'],
            ],
            `<div class="grid grid-cols-2 gap-2 mt-4">
                ${statTile('맨홀보수', countHtml(mh.repair_cnt, 'text-blue-600'))}
                ${statTile('접속개소 침수', countHtml(mh.flood_cnt, 'text-red-600'), '', mh.flood_cnt > 0)}
            </div>`,
        ),
        section('chart', '수위', `
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                ${statTile('평균수위', mmHtml(mh.avg_level))}
                ${statTile('최대수위', mmHtml(mh.max_level), yearText(mh.max_level_year))}
                ${statTile('최저수위', mmHtml(mh.min_level), yearText(mh.min_level_year))}
                ${statTile('최근수위', `${mmHtml(mh.latest_level)} ${levelDeltaHtml(mh.latest_level, mh.prev_level)}`, yearText(mh.latest_level_year))}
            </div>
            <div class="border border-slate-200 rounded-lg p-3 bg-white">
                ${renderLevelChart(records, mh.avg_level)}
                <div class="flex flex-wrap gap-4 justify-end text-[11px] text-slate-500 mt-1">
                    <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-blue-600"></span>수위</span>
                    <span class="flex items-center gap-1"><span class="w-2.5 h-2.5 rounded-full bg-red-500"></span>접속개소 침수</span>
                    <span class="flex items-center gap-1"><span class="w-3 border-t-2 border-dashed border-slate-400"></span>평균</span>
                    <span class="flex items-center gap-1"><span class="w-3 border-t-2 border-dashed border-emerald-500"></span>맨홀보수</span>
                </div>
            </div>`, levelRange),
        repairGallery(records),
        section('history', '연도별 점검·맨홀보수 이력', historyTable(records)),
    ].join('');
}

/** 상단 침수 이력 안내 (있으면 빨간 경고, 없으면 초록 안내) */
function floodBanner(mh) {
    const checkYears = mh.flood_check_years || [];
    if (!checkYears.length) return '';
    const range = `${checkYears[0]}~${checkYears[checkYears.length - 1]}년`;

    if (mh.flood_cnt > 0) {
        const chips = (mh.flood_years || [])
            .map((y) => `<span class="px-2.5 py-1 rounded-md text-xs font-bold bg-red-600 text-white">${y} 침수</span>`).join('');
        return `
            <div class="rounded-lg border-2 border-red-300 bg-red-50 p-4 flex items-start gap-3">
                ${ICONS.warning}
                <div class="flex-1">
                    <div class="font-bold text-red-700">전력케이블 접속개소 침수 이력 ${mh.flood_cnt}회</div>
                    <div class="text-xs text-red-600/80 mt-0.5">${range} 중 ${mh.flood_cnt}개 연도에서 접속개소 침수</div>
                    <div class="flex flex-wrap gap-1.5 mt-3">${chips}</div>
                </div>
            </div>`;
    }
    return `
        <div class="rounded-lg border border-green-200 bg-green-50 px-4 py-3 flex items-center gap-2 text-sm font-bold text-green-700">
            ${ICONS.check} 접속개소 침수 이력 없음
            <span class="text-xs font-normal text-green-600">(${range} 기록 기준)</span>
        </div>`;
}

/** 연도별 맨홀보수 사진 (사진만 있고 엑셀에 보수 표시가 없으면 '엑셀 미기재') */
function repairGallery(records) {
    const items = records.filter((r) => r.repair || r.photo).reverse();
    if (!items.length) return '';

    const cards = items.map((r) => {
        const caption = `${r.year}년 맨홀보수`;
        const photo = r.photo
            ? `<button type="button" class="block w-full aspect-[4/3] bg-slate-100" data-photo="${encodeURI(r.photo)}" data-caption="${caption}">
                   <img src="${encodeURI(r.photo)}" loading="lazy" alt="${caption} 사진" class="w-full h-full object-cover hover:opacity-90 transition-opacity">
               </button>`
            : '<div class="w-full aspect-[4/3] bg-slate-50 flex items-center justify-center text-xs text-slate-400">사진 없음</div>';
        const badge = r.repair
            ? '<span class="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-blue-100 text-blue-700">맨홀보수</span>'
            : '<span class="px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-100 text-amber-700" title="맨홀보수 사진은 있으나 엑셀에 보수(O) 표시가 없습니다">엑셀 미기재</span>';
        return `
            <div class="rounded-lg border border-slate-200 overflow-hidden bg-white">
                ${photo}
                <div class="px-3 py-2 flex items-center justify-between gap-2">
                    <span class="font-bold text-slate-700">${r.year}년</span>${badge}
                </div>
            </div>`;
    });

    return section('photo', '연도별 맨홀보수 이력',
        `<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">${cards.join('')}</div>`, `(${items.length}건)`);
}

/** 연도별 표 (최신 연도부터, 사진만 있는 연도는 제외) */
function historyTable(records) {
    const rows = records.filter((r) => r.level != null || r.repair || r.note).reverse().map((r) => `
        <tr class="${r.flood ? 'bg-red-50 shadow-[inset_4px_0_0_#ef4444]' : 'hover:bg-slate-50'}">
            <td class="px-3 py-2 whitespace-nowrap font-medium ${r.flood ? 'text-red-700' : 'text-slate-700'}">${r.year}</td>
            <td class="px-3 py-2 whitespace-nowrap ${r.flood ? 'text-red-700 font-semibold' : 'text-slate-600'}">
                ${r.level != null ? `${r.level.toLocaleString()}mm` : '<span class="text-slate-300">-</span>'}
            </td>
            <td class="px-3 py-2 whitespace-nowrap">
                ${r.repair ? '<span class="px-2 py-0.5 text-xs font-semibold rounded-full bg-blue-100 text-blue-700">보수</span>' : ''}
            </td>
            <td class="px-3 py-2 text-slate-600 min-w-[140px]">${noteHtml(r)}</td>
        </tr>`);

    return `
        <div class="overflow-x-auto border border-slate-200 rounded-lg">
            <table class="min-w-full divide-y divide-slate-200 text-sm text-center">
                <thead class="bg-slate-50">
                    <tr class="text-xs font-medium text-slate-500">
                        <th class="px-3 py-2">연도</th><th class="px-3 py-2">수위</th><th class="px-3 py-2">맨홀보수</th><th class="px-3 py-2">비고</th>
                    </tr>
                </thead>
                <tbody class="bg-white divide-y divide-slate-100">
                    ${rows.join('') || '<tr><td colspan="4" class="px-3 py-6 text-slate-400">기록된 이력이 없습니다.</td></tr>'}
                </tbody>
            </table>
        </div>`;
}

/** 비고 칸: 침수 뱃지 + 원문 비고 (뱃지와 같은 뜻의 '침수'/'접속제 침수'는 생략) */
function noteHtml(r) {
    const badge = r.flood ? '<span class="px-1.5 py-0.5 mr-1 text-[11px] font-bold rounded bg-red-600 text-white">접속개소 침수</span>' : '';
    const redundant = !r.note || (r.flood && /^(접속제\s*)?침수$/.test(r.note));
    return badge + (redundant ? '' : escapeHtml(r.note));
}

/** 사진 클릭 → 화면 가득 확대 (클릭 · ESC 로 닫기) */
function setupPhotoLightbox(container) {
    container.querySelectorAll('[data-photo]').forEach((button) => {
        button.addEventListener('click', () => {
            const box = document.createElement('div');
            box.className = 'fixed inset-0 z-[80] bg-black/80 flex flex-col items-center justify-center p-4 cursor-zoom-out';
            box.innerHTML = `
                <img src="${button.dataset.photo}" alt="" class="max-w-full max-h-[85vh] rounded-lg shadow-2xl">
                <div class="mt-3 text-sm text-white/90">${escapeHtml(button.dataset.caption || '')}</div>`;

            const close = () => {
                box.remove();
                document.removeEventListener('keydown', onKey, true);
            };
            // 모달의 ESC 닫기보다 먼저 처리해 확대 화면만 닫음
            const onKey = (e) => {
                if (e.key !== 'Escape') return;
                e.stopPropagation();
                close();
            };
            box.addEventListener('click', close);
            document.addEventListener('keydown', onKey, true);
            document.body.appendChild(box);
        });
    });
}

// ── 관리 모드: 이력 데이터가 없을 때 ────────────────────

function pendingDetailHtml(mh) {
    return basicInfo([['ID', mh.id], ['위치', coords(mh)]]) + `
        <div class="border border-dashed border-slate-300 rounded-lg p-8 bg-slate-50/60 text-center">
            <h4 class="font-bold text-slate-700 mb-1">상세 데이터 준비 중</h4>
            <p class="text-sm text-slate-500">이 맨홀의 이력 데이터가 아직 없습니다.</p>
        </div>`;
}

// ── 시연 모드: 예시 데이터 ───────────────────────────────

const DEMO_HISTORY = [
    { date: '2025-01-15', type: '점검', content: '정기 안전 점검 수행', result: '이상 없음' },
    { date: '2024-08-23', type: '침수', content: '집중호우로 인한 일시적 수위 상승', result: '배수 조치 완료' },
    { date: '2024-05-10', type: '수선', content: '맨홀 뚜껑 소음 관련 민원 조치', result: '고무 패킹 교체' },
    { date: '2023-11-05', type: '점검', content: '주변 보도블럭 침하 확인', result: '현장 확인 후 보수' },
];
const DEMO_LEVELS = [
    { year: 2025, level: 210 },
    { year: 2024, level: 205 },
    { year: 2023, level: 215 },
    { year: 2022, level: 200 },
    { year: 2021, level: 208 },
];

function demoDetailHtml(mh) {
    const levels = DEMO_LEVELS.map((d) => d.level);
    const th = (text) => `<th class="px-4 py-3 text-left text-xs font-medium text-slate-500 whitespace-nowrap">${text}</th>`;
    const typeClass = (type) => (type === '침수' ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800');

    return [
        basicInfo([['ID', mh.id], ['위치', coords(mh)], ['설치년도', '2005년']]),
        section('history', '유지보수 및 이슈 이력', `
            <div class="overflow-x-auto border border-slate-200 rounded-lg">
                <table class="min-w-full divide-y divide-slate-200 text-sm">
                    <thead class="bg-slate-50"><tr>${th('날짜')}${th('구분')}${th('내용')}${th('조치결과')}</tr></thead>
                    <tbody class="bg-white divide-y divide-slate-200">
                        ${DEMO_HISTORY.map((h) => `
                            <tr class="hover:bg-slate-50">
                                <td class="px-4 py-3 whitespace-nowrap text-slate-600 text-xs">${h.date.substring(2)}</td>
                                <td class="px-4 py-3 whitespace-nowrap"><span class="px-2 py-1 text-xs font-semibold rounded-full ${typeClass(h.type)}">${h.type}</span></td>
                                <td class="px-4 py-3 text-slate-700 min-w-[160px]">${h.content}</td>
                                <td class="px-4 py-3 text-slate-600 whitespace-nowrap">${h.result}</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`),
        section('chart', '연간 수위 데이터 (최근 5년)', `
            <div class="grid grid-cols-3 gap-2 mb-3">
                ${statTile('평균수위', mmHtml(Math.round(levels.reduce((a, b) => a + b, 0) / levels.length)))}
                ${statTile('최대수위', mmHtml(Math.max(...levels)))}
                ${statTile('최저수위', mmHtml(Math.min(...levels)))}
            </div>
            <div class="overflow-x-auto border border-slate-200 rounded-lg">
                <table class="min-w-full divide-y divide-slate-200 text-sm">
                    <thead class="bg-slate-50"><tr>${th('년도')}${th('수위')}</tr></thead>
                    <tbody class="bg-white divide-y divide-slate-200">
                        ${DEMO_LEVELS.map((d) => `
                            <tr class="hover:bg-slate-50">
                                <td class="px-4 py-3 font-medium text-slate-700">${d.year}년</td>
                                <td class="px-4 py-3 text-slate-600">${d.level}mm</td>
                            </tr>`).join('')}
                    </tbody>
                </table>
            </div>`),
    ].join('');
}
