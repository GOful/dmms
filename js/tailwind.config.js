/**
 * Tailwind CDN 공용 설정 (index.html, login.html) — Tailwind CDN 스크립트 바로 다음에 로드
 */
tailwind.config = {
    theme: {
        extend: {
            fontFamily: {
                sans: ['"Noto Sans KR"', 'sans-serif'],
            },
            keyframes: {
                fadeIn: {
                    from: { opacity: '0', transform: 'translateY(-10px)' },
                    to: { opacity: '1', transform: 'translateY(0)' },
                },
                'gradient-flow': {
                    '0%, 100%': { 'background-position': '0% 50%' },
                    '50%': { 'background-position': '100% 50%' },
                },
            },
            animation: {
                'gradient-flow': 'gradient-flow 3s ease infinite',
            },
        },
    },
    plugins: [
        // 얇은 스크롤바
        function ({ addBase }) {
            addBase({
                '::-webkit-scrollbar': { width: '6px' },
                '::-webkit-scrollbar-track': { background: 'transparent' },
                '::-webkit-scrollbar-thumb': { backgroundColor: '#cbd5e1', borderRadius: '3px' },
                '::-webkit-scrollbar-thumb:hover': { backgroundColor: '#94a3b8' },
            });
        },
    ],
};
