/**
 * 상단 내비게이션 — 메뉴(데스크탑 드롭다운 · 모바일 서랍), 모드 뱃지, 로그인/로그아웃
 * 메뉴 항목은 config.js 의 MENUS 하나로 관리한다.
 */
import { MENUS } from '../config.js';
import { closeModal } from './modal.js';
import { showEquipment } from './equipment.js';
import { showPdf } from './pdf-viewer.js';

const $ = (id) => document.getElementById(id);
const MENU_ITEMS = Object.fromEntries(MENUS.flatMap((group) => group.items.map((item) => [item.key, item])));

export function initMenu() {
    renderHeaderActions();
    $('desktop-menu').innerHTML = MENUS.map(desktopGroupHtml).join('');
    $('mobile-menu-list').innerHTML = MENUS.map(mobileGroupHtml).join('');

    // 메뉴 항목 클릭 (데스크탑 · 모바일 공용)
    document.addEventListener('click', (e) => {
        const link = e.target.closest('[data-menu]');
        if (!link) return;
        e.preventDefault();
        closeMobileMenu();
        openMenuItem(MENU_ITEMS[link.dataset.menu]);
    });

    $('mobile-menu-open-btn').addEventListener('click', openMobileMenu);
    $('mobile-menu-close-btn').addEventListener('click', closeMobileMenu);
    $('mobile-menu-backdrop').addEventListener('click', closeMobileMenu);
}

function openMenuItem(item) {
    if (item.type === 'equipment') {
        showEquipment(item.key, item.label);
    } else {
        showPdf(item.key, item.label, { back: 'close', onBack: closeModal });
    }
}

// ── 헤더 (모드 뱃지 · 로그인/로그아웃) ──────────────────

function renderHeaderActions() {
    const { DMMS } = window;
    const badge = (dot, text) => `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs text-slate-300 border border-slate-700">
            <span class="w-1.5 h-1.5 rounded-full ${dot}"></span>${text}
        </span>`;
    const buttonClass = 'text-xs font-medium text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 px-3 py-1.5 rounded-md transition-colors';

    $('header-actions').innerHTML = DMMS.isAdmin
        ? `${badge('bg-emerald-400', '관리용 화면')}<button id="logout-btn" class="${buttonClass}">로그아웃</button>`
        : `${badge('bg-amber-400', '시연용 화면')}<a href="login.html" class="${buttonClass}">관리자 로그인</a>`;

    $('logout-btn')?.addEventListener('click', () => {
        localStorage.removeItem(DMMS.AUTH_KEY);
        location.replace('login.html');
    });
}

// ── 메뉴 렌더링 ──────────────────────────────────────────

function desktopGroupHtml(group, index) {
    // 마지막 메뉴는 화면 오른쪽 끝에 붙어 있으므로 드롭다운을 오른쪽 기준으로
    const align = index === MENUS.length - 1 ? 'right-0' : 'left-0';
    return `
        <li class="relative group h-full flex items-center">
            <a href="#" class="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-md transition-colors">${group.title}</a>
            <ul class="absolute top-14 ${align} w-48 bg-white text-slate-800 rounded-lg shadow-xl border border-slate-100 hidden group-hover:block overflow-hidden z-50">
                ${group.items.map((item) => `
                    <li><a href="#" data-menu="${item.key}" class="block px-4 py-3 text-sm hover:bg-slate-50 hover:text-blue-600 transition-colors">${item.label}</a></li>`).join('')}
            </ul>
        </li>`;
}

function mobileGroupHtml(group) {
    return `
        <div class="px-4 py-2 mt-2 text-xs font-bold text-slate-400">${group.title}</div>
        ${group.items.map((item) => `
            <a href="#" data-menu="${item.key}" class="block px-4 py-3 text-sm font-medium text-slate-700 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors">${item.label}</a>`).join('')}`;
}

// ── 모바일 메뉴 (오른쪽에서 밀려 나오는 서랍) ───────────

function openMobileMenu() {
    $('mobile-menu').classList.remove('hidden');
    requestAnimationFrame(() => {
        $('mobile-menu-backdrop').classList.remove('opacity-0');
        $('mobile-menu-panel').classList.remove('translate-x-full');
    });
}

function closeMobileMenu() {
    if ($('mobile-menu').classList.contains('hidden')) return;
    $('mobile-menu-backdrop').classList.add('opacity-0');
    $('mobile-menu-panel').classList.add('translate-x-full');
    setTimeout(() => $('mobile-menu').classList.add('hidden'), 300);   // 닫힘 애니메이션 후 숨김
}
