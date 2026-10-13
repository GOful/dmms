/**
 * 실행 모드 판별 (일반 스크립트 — 모듈보다 먼저 로드되어 auth-guard.js, login.js 에서도 사용)
 *
 *   index.html?mode=admin  관리용 화면 (실제 맨홀 데이터, *.admin.json)
 *   index.html?mode=demo   시연용 화면 (예시 데이터)
 */
(function () {
    const mode = new URLSearchParams(location.search).get('mode') === 'admin' ? 'admin' : 'demo';

    window.DMMS = {
        mode,
        isAdmin: mode === 'admin',
        /** 로컬 개발 환경 (로그인 생략) */
        isLocal: ['localhost', '127.0.0.1', '[::1]', ''].includes(location.hostname),
        /** 로그인 성공 시 비밀번호 해시를 저장하는 localStorage 키 */
        AUTH_KEY: 'dmms_auth_hash',
        /** 모드에 맞는 데이터 파일 경로 — 관리 모드면 'x.json' → 'x.admin.json' */
        dataPath: (file) => (mode === 'admin' ? file.replace(/\.json$/, '.admin.json') : file),
    };
})();
