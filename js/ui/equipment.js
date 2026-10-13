/**
 * 장비관리 메뉴 — 장비 목록 표 + 사용매뉴얼 (equipment_data.json)
 */
import { loadEquipment } from '../data.js';
import { escapeHtml } from '../utils.js';
import { openModal } from './modal.js';
import { showPdf } from './pdf-viewer.js';

const GOOD_STATUS = ['양호', '정상', 'normal', 'ok'];

/**
 * 장비 목록 표 표시
 * @param {string} key equipment_data.json 의 키 (= 사용매뉴얼 PDF 이름)
 * @param {string} title 모달 제목
 */
export async function showEquipment(key, title) {
    const body = openModal(title, '<p class="py-8 text-center text-sm text-slate-400">불러오는 중...</p>');

    let table;
    try {
        table = (await loadEquipment())[key] ?? { headers: [], items: [] };
    } catch (e) {
        console.error('장비 데이터 로드 실패:', e);
        body.innerHTML = '<p class="py-8 text-center text-sm text-red-600">장비 데이터를 불러오지 못했습니다.</p>';
        return;
    }

    body.innerHTML = `
        <div class="flex justify-end mb-4">
            <button class="js-manual px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm rounded-lg shadow-sm transition-colors flex items-center gap-1">
                <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"/></svg>
                사용매뉴얼
            </button>
        </div>
        <div class="overflow-x-auto border border-slate-200 rounded-lg">
            <table class="w-full text-sm text-left text-slate-600">
                <thead class="text-xs text-slate-700 bg-slate-50 border-b border-slate-200">
                    <tr>${table.headers.map((h) => `<th class="px-4 py-3 font-bold whitespace-nowrap">${escapeHtml(h)}</th>`).join('')}</tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                    ${table.items.length
                        ? table.items.map(rowHtml).join('')
                        : `<tr><td colspan="${table.headers.length || 1}" class="px-4 py-8 text-center text-slate-400">등록된 장비가 없습니다.</td></tr>`}
                </tbody>
            </table>
        </div>`;

    body.querySelector('.js-manual').addEventListener('click', () => {
        showPdf(key, title, { back: 'list', onBack: () => showEquipment(key, title) });
    });
}

/** 표의 한 줄 — 첫 칸은 연번, 나머지는 항목 값 순서대로 */
function rowHtml(item, index) {
    const cells = [index + 1, ...Object.values(item)].map((value) => {
        const text = escapeHtml(value);
        const content = GOOD_STATUS.includes(String(value).toLowerCase())
            ? `<span class="bg-green-100 text-green-800 text-xs font-medium px-2.5 py-0.5 rounded">${text}</span>`
            : text;
        return `<td class="px-4 py-3 whitespace-nowrap">${content}</td>`;
    });
    return `<tr class="bg-white hover:bg-slate-50 transition-colors">${cells.join('')}</tr>`;
}
