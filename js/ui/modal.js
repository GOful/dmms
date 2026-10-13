/**
 * 공용 모달 (상단 메뉴 화면, 맨홀 상세정보)
 */
const $ = (id) => document.getElementById(id);

/** 닫기 버튼 · 바깥 영역 클릭 · ESC 로 닫기 */
export function initModal() {
    $('modal-close-btn').addEventListener('click', closeModal);
    $('modal-overlay').addEventListener('click', (e) => {
        if (e.target === e.currentTarget) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });
}

/**
 * 모달 열기
 * @param {string} title 제목
 * @param {string} html 본문 HTML
 * @returns {HTMLElement} 본문 요소 (이벤트 연결용)
 */
export function openModal(title, html = '') {
    $('modal-title').textContent = title;
    const body = $('modal-body');
    body.innerHTML = html;
    body.scrollTop = 0;
    $('modal-overlay').classList.replace('hidden', 'flex');
    return body;
}

export function closeModal() {
    $('modal-overlay').classList.replace('flex', 'hidden');
}
