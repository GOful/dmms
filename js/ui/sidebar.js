/**
 * 사이드바 — 노선 > 구간 > 맨홀 목록(트리)
 */
import { LINE_STYLES, DEFAULT_LINE_STYLE } from '../config.js';
import { escapeHtml } from '../utils.js';

const $ = (id) => document.getElementById(id);
const SELECTED_CLASSES = ['bg-blue-50', 'text-blue-700', 'font-bold', 'border-l-blue-600'];
let selectedId = null;

/**
 * 사이드바 이벤트 연결
 * @param {{ onSelect: (id: string) => void, onToggle: () => void }} handlers
 *        onSelect: 맨홀 항목 클릭, onToggle: 사이드바 열고 닫은 뒤 (지도 크기 갱신)
 */
export function initSidebar({ onSelect, onToggle }) {
    $('sidebar-toggle-btn').addEventListener('click', () => {
        $('app-container').classList.toggle('sidebar-hidden');
        onToggle();
    });

    $('tree-container').addEventListener('click', (e) => {
        const item = e.target.closest('.js-manhole');
        if (item) {
            onSelect(item.dataset.id);
            return;
        }
        const toggle = e.target.closest('.js-group-toggle');
        if (toggle) {
            const group = toggle.closest('.tree-group');
            setExpanded(group, isCollapsed(group));
        }
    });
}

/** 트리 렌더링 */
export function renderTree(data) {
    $('tree-container').innerHTML = data.lines.map(lineHtml).join('');
}

export function showTreeError(message) {
    $('tree-container').innerHTML = `<p class="p-4 text-sm text-red-600">${escapeHtml(message)}</p>`;
}

/** 맨홀 항목 강조 + 상위 그룹 펼치기 + 스크롤 (id 가 없으면 강조 해제) */
export function highlightManhole(id) {
    const prev = selectedId && $(itemId(selectedId));
    if (prev) {
        prev.classList.remove(...SELECTED_CLASSES);
        prev.classList.add('border-l-transparent');
    }
    selectedId = id;

    const item = id && $(itemId(id));
    if (!item) return;
    item.classList.remove('border-l-transparent');
    item.classList.add(...SELECTED_CLASSES);
    for (let group = item.closest('.tree-group'); group; group = group.parentElement.closest('.tree-group')) {
        setExpanded(group, true);
    }
    item.scrollIntoView({ behavior: 'smooth', block: 'center' });   // 고정 헤더에 가리지 않게 가운데로
}

/** 지도 필터와 맞춰 해당 맨홀만 표시 (ids 가 없으면 전체 표시 + 모두 접기) */
export function filterTree(ids) {
    const showAll = !ids?.length;
    const tree = $('tree-container');

    tree.querySelectorAll('.js-manhole').forEach((item) => {
        item.classList.toggle('hidden', !showAll && !ids.includes(item.dataset.id));
    });
    tree.querySelectorAll('.tree-group').forEach((group) => {
        const hasVisible = Boolean(group.querySelector('.js-manhole:not(.hidden)'));
        group.classList.toggle('hidden', !showAll && !hasVisible);
        setExpanded(group, !showAll && hasVisible);
    });
}

// ── 내부 ─────────────────────────────────────────────────

const itemId = (id) => `tree-item-${id}`;

function isCollapsed(group) {
    return group.querySelector(':scope > .js-group-body').classList.contains('hidden');
}

function setExpanded(group, expanded) {
    group.querySelector(':scope > .js-group-body').classList.toggle('hidden', !expanded);
    group.querySelector(':scope > .js-group-toggle .js-arrow').textContent = expanded ? '▲' : '▼';
}

function groupHtml(headerClass, headerHtml, bodyHtml) {
    return `
        <div class="tree-group">
            <button type="button" class="js-group-toggle w-full flex justify-between items-center text-left select-none transition-colors hover:bg-slate-50 ${headerClass}">
                ${headerHtml}
                <span class="js-arrow text-slate-400 text-xs">▼</span>
            </button>
            <div class="js-group-body hidden">${bodyHtml}</div>
        </div>`;
}

function lineHtml(line) {
    const style = LINE_STYLES[line.lineId] || DEFAULT_LINE_STYLE;
    const total = line.stations.reduce((sum, st) => sum + st.manholes.length, 0);
    const header = `
        <span class="flex items-center">
            <span class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold text-white mr-2 shadow-sm" style="background:${style.badge}">${style.label}</span>
            ${escapeHtml(line.lineTitle)}
            <span class="text-sm text-slate-400 font-normal ml-1">(${total})</span>
        </span>`;
    return groupHtml(
        'p-3 border-b border-slate-100 font-bold text-slate-700 sticky top-0 bg-white z-10 shadow-sm',
        header,
        line.stations.map(stationHtml).join(''),
    );
}

function stationHtml(station) {
    const header = `
        <span>${escapeHtml(station.stationName)}
            <span class="text-xs text-slate-400 font-normal">(${station.manholes.length})</span>
        </span>`;
    const items = station.manholes.map((mh) => `
        <div id="${itemId(mh.id)}" data-id="${mh.id}" class="js-manhole pl-12 py-2 pr-4 cursor-pointer text-sm text-slate-500 border-b border-b-slate-50 border-l-4 border-l-transparent hover:bg-blue-50 hover:text-blue-600 transition-colors">
            [${mh.id}] ${escapeHtml(mh.name)}
        </div>`).join('');
    return groupHtml(
        'p-2 pl-8 border-b border-slate-50 text-sm font-medium text-slate-600 sticky top-[45px] bg-slate-50/95 backdrop-blur-sm',
        header,
        items,
    );
}
