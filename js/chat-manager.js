// ========================================
// AI 채팅 UI 관리
// ========================================
const getChatElements = () => ({
    history: document.getElementById('chat-history'),
    input: document.getElementById('chat-input'),
    sendBtn: document.getElementById('send-btn')
});

let loadingIndicatorId = null;

/**
 * [AI 채팅] 사용자 메시지를 채팅창에 추가합니다.
 * @param {string} message - 사용자가 입력한 메시지
 */
export function appendUserMessage(message) {
    const { history } = getChatElements();
    if (!history) return;
    
    const messageDiv = document.createElement('div');
    messageDiv.className = 'self-end bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] text-sm leading-relaxed break-words animate-[fadeIn_0.3s_ease-out]';
    messageDiv.textContent = message;
    history.appendChild(messageDiv);
    history.scrollTop = history.scrollHeight;
}

/**
 * [AI 채팅] AI의 응답 메시지를 채팅창에 추가합니다.
 * @param {string} htmlContent - AI가 생성한 HTML 응답
 */
export function appendBotMessage(htmlContent) {
    const { history } = getChatElements();
    if (!history) return;

    const messageDiv = document.createElement('div');
    messageDiv.className = 'self-start bg-white border border-slate-200 text-slate-800 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm max-w-[90%] text-sm leading-relaxed prose prose-sm break-words animate-[fadeIn_0.3s_ease-out]';
    messageDiv.innerHTML = htmlContent;
    history.appendChild(messageDiv);
    history.scrollTop = history.scrollHeight;
}

/**
 * [AI 채팅] '분석 중...' 로딩 인디케이터를 표시합니다.
 */
export function showBotLoadingIndicator() {
    const { history } = getChatElements();
    if (!history) return;

    loadingIndicatorId = "loading-" + Date.now();
    const loadingDiv = document.createElement('div');
    loadingDiv.id = loadingIndicatorId;
    loadingDiv.className = 'self-start bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 text-sm animate-[fadeIn_0.3s_ease-out]';
    loadingDiv.innerHTML = `
        <div class="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
        <span class="font-medium">분석 중...</span>
    `;
    history.appendChild(loadingDiv);
    history.scrollTop = history.scrollHeight;
}

/**
 * [AI 채팅] 로딩 인디케이터를 제거합니다.
 */
export function removeBotLoadingIndicator() {
    if (loadingIndicatorId) {
        const loadingEl = document.getElementById(loadingIndicatorId);
        if (loadingEl) {
            loadingEl.remove();
        }
        loadingIndicatorId = null;
    }
}

/**
 * [AI 채팅] 오류 메시지를 채팅창에 표시합니다.
 * @param {string} errorMessage - 표시할 오류 메시지
 */
export function appendBotError(errorMessage) {
    const { history } = getChatElements();
    if (!history) return;
    
    // 기존 로딩 인디케이터가 있다면 오류 메시지로 대체
    if (loadingIndicatorId) {
        const loadingEl = document.getElementById(loadingIndicatorId);
        if (loadingEl) {
            loadingEl.textContent = errorMessage;
             // 스타일 변경도 가능
            loadingEl.classList.add('text-red-600');
        }
        loadingIndicatorId = null;
    } else {
        appendBotMessage(errorMessage); // 로딩 인디케이터가 없으면 그냥 메시지로 추가
    }
    history.scrollTop = history.scrollHeight;
}


/**
 * [AI 채팅] 입력창과 전송 버튼의 활성화/비활성화 상태를 설정합니다.
 * @param {boolean} disabled - 비활성화 여부
 */
export function setChatInputDisabled(disabled) {
    const { input, sendBtn } = getChatElements();
    if (input) {
        input.disabled = disabled;
        if (!disabled) {
            input.value = '';
        }
    }
    if (sendBtn) {
        sendBtn.disabled = disabled;
    }
}
