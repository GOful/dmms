/**
 * 로그인 페이지 (login.html)
 *
 *   비밀번호를 PBKDF2-SHA256 으로 해시해 배포 시 생성되는 js/auth-config.js 의 값과 비교한다.
 *   (평문 비밀번호는 GitHub Secrets 의 SITE_PASSWORD — .github/workflows/deploy.yml 참고)
 *   로컬 개발 환경에서는 비밀번호 없이 바로 접속하는 버튼만 보여준다.
 */
(function () {
    const { DMMS } = window;
    const $ = (id) => document.getElementById(id);
    const ADMIN_URL = 'index.html?mode=admin';

    if (DMMS.isLocal) {
        $('login-form').classList.add('hidden');
        $('local-entry').classList.remove('hidden');
        $('admin-card-title').textContent = '관리자 페이지 (로컬)';
        return;
    }

    const input = $('password');

    function showError(message) {
        $('error-msg').textContent = message;
        $('error-msg').classList.remove('hidden');
        const card = $('login-card');
        card.classList.remove('shake');
        void card.offsetWidth;   // 애니메이션 재시작
        card.classList.add('shake');
    }

    function setLoading(loading) {
        $('submit-btn').disabled = loading;
        $('submit-label').textContent = loading ? '확인 중' : '로그인';
        $('submit-spinner').classList.toggle('hidden', !loading);
    }

    async function pbkdf2Hex(password, salt, iterations) {
        const enc = new TextEncoder();
        const key = await crypto.subtle.importKey('raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']);
        const bits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: enc.encode(salt), iterations, hash: 'SHA-256' }, key, 256);
        return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, '0')).join('');
    }

    $('toggle-password').addEventListener('click', () => {
        const showing = input.type === 'text';
        input.type = showing ? 'password' : 'text';
        $('eye-open').classList.toggle('hidden', !showing);
        $('eye-closed').classList.toggle('hidden', showing);
        input.focus();
    });

    if (!window.__AUTH_HASH) {
        showError('인증 설정이 로드되지 않았습니다. 관리자에게 문의하세요.');
        $('submit-btn').disabled = true;
        return;
    }

    // 이미 로그인한 상태면 바로 이동
    if (localStorage.getItem(DMMS.AUTH_KEY) === window.__AUTH_HASH) {
        location.replace(ADMIN_URL);
        return;
    }

    $('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        $('error-msg').classList.add('hidden');
        setLoading(true);
        try {
            const hash = await pbkdf2Hex(input.value, window.__AUTH_SALT, window.__AUTH_ITERS);
            if (hash === window.__AUTH_HASH) {
                localStorage.setItem(DMMS.AUTH_KEY, hash);
                location.replace(ADMIN_URL);
                return;
            }
            showError('비밀번호가 올바르지 않습니다.');
            input.value = '';
            input.focus();
        } catch (err) {
            console.error(err);
            showError('인증 처리 중 오류가 발생했습니다.');
        } finally {
            setLoading(false);
        }
    });
})();
