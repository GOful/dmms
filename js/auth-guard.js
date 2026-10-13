/**
 * 접근 제어 (index.html 전용 일반 스크립트 — 화면이 그려지기 전에 실행)
 *
 *   - 로컬 개발 환경은 통과
 *   - ?mode 가 없으면 로그인 페이지로
 *   - 관리 모드는 로그인 때 저장한 비밀번호 해시가 배포 설정(js/auth-config.js)과 같아야 통과
 */
(function () {
    const { DMMS } = window;
    if (DMMS.isLocal) return;

    if (!new URLSearchParams(location.search).has('mode')) {
        location.replace('login.html');
        return;
    }
    if (!DMMS.isAdmin) return;

    const expected = window.__AUTH_HASH;
    if (!expected || localStorage.getItem(DMMS.AUTH_KEY) !== expected) {
        localStorage.removeItem(DMMS.AUTH_KEY);
        location.replace('login.html');
    }
})();
