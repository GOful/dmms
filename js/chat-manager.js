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

/**
 * [AI 채팅] 입력창 좌측에 도움말(예시 질문) 아이콘과 팝업을 생성합니다.
 */
export function initChatHelp() {
    const { input } = getChatElements();
    if (!input) return;

    const container = input.parentElement;
    // 아이콘 위치 선정을 위해 부모 컨테이너를 relative로 설정 (이미 설정되어 있어도 무방)
    if (getComputedStyle(container).position === 'static') {
        container.style.position = 'relative';
    }

    // [수정] 기존 패딩 제거 (버튼을 입력창 밖으로 이동하여 시인성 확보)
    input.classList.remove('pl-10');

    // 2. 도움말 버튼 생성 (위치는 상단 유지하되, 심플하고 세련된 스타일로 변경)
    const helpBtn = document.createElement('button');
    helpBtn.type = 'button';
    // [수정] 배경색(bg-white) 추가 및 스타일 보강 (대화 내용과 겹침 방지)
    helpBtn.className = 'absolute left-0 -top-9 flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:text-blue-600 hover:border-blue-400 transition-all py-1.5 px-3 rounded-full shadow-sm z-10';
    helpBtn.title = '질문 예시 보기';
    helpBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span class="font-medium">질문 가이드</span>
    `;

    // 3. 예시 질문 팝업 생성 (직전의 깔끔한 구성으로 복원)
    const popup = document.createElement('div');
    // 위치: 버튼 위쪽 (mb-10)
    popup.className = 'hidden absolute bottom-full left-0 mb-10 w-80 bg-white border border-slate-200 shadow-xl rounded-2xl p-3 z-50 animate-[fadeIn_0.2s_ease-out]';
    popup.innerHTML = `
        <div class="space-y-4 p-1">
            <div>
                <div class="text-xs font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded inline-block mb-1">사용 팁</div>
                <ul class="space-y-1">
                    <li class="flex items-center text-sm text-slate-700 px-3 py-1"><svg class="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg><span><span class="font-bold text-slate-800">"표시해줘"</span> : 지도에 위치를 표시합니다</span></li>
                    <li class="flex items-center text-sm text-slate-700 px-3 py-1"><svg class="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg><span><span class="font-bold text-slate-800">"알려줘"</span> : 상세 내용을 글로 답변합니다</span></li>
                </ul>
            </div>
            <div>
                <div class="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded inline-block mb-1">데이터형 질문</div>
                <ul class="space-y-1">
                    <li>
                        <button class="w-full text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 px-3 py-2.5 rounded-lg transition-colors example-btn flex items-center justify-between group">
                            <span class="flex items-center"><svg class="w-4 h-4 text-blue-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>침수 횟수 3회 이상인 곳 표시해줘</span>
                            <svg class="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7v4a3 3 0 0 1-3 3H5m0 0l4-4m-4 4l4 4" /></svg>
                        </button>
                    </li>
                    <li>
                        <button class="w-full text-left text-sm text-slate-700 hover:bg-blue-50 hover:text-blue-700 px-3 py-2.5 rounded-lg transition-colors example-btn flex items-center justify-between group">
                            <span class="flex items-center"><svg class="w-4 h-4 text-slate-400 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/></svg>반월당역 근처 맨홀 침수 이력 알려줘</span>
                            <svg class="w-5 h-5 text-slate-300 group-hover:text-blue-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7v4a3 3 0 0 1-3 3H5m0 0l4-4m-4 4l4 4" /></svg>
                        </button>
                    </li>
                </ul>
            </div>
            <div>
                <div class="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded inline-block mb-1">지능형 질문</div>
                <ul class="space-y-1">
                    <li>
                        <button class="w-full text-left text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 px-3 py-2.5 rounded-lg transition-colors example-btn flex items-center justify-between group">
                            <span class="flex items-center"><svg class="w-4 h-4 text-purple-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>특별히 관리해야 할 맨홀 5곳을 지도에 표시해줘</span>
                            <svg class="w-5 h-5 text-slate-300 group-hover:text-purple-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7v4a3 3 0 0 1-3 3H5m0 0l4-4m-4 4l4 4" /></svg>
                        </button>
                    </li>
                    <li>
                        <button class="w-full text-left text-sm text-slate-700 hover:bg-purple-50 hover:text-purple-700 px-3 py-2.5 rounded-lg transition-colors example-btn flex items-center justify-between group">
                            <span class="flex items-center"><svg class="w-4 h-4 text-purple-500 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"/></svg>데이터를 분석하여 점검이 시급한 역을 추천해줘</span>
                            <svg class="w-5 h-5 text-slate-300 group-hover:text-purple-500 transition-colors flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7v4a3 3 0 0 1-3 3H5m0 0l4-4m-4 4l4 4" /></svg>
                        </button>
                    </li>
                </ul>
            </div>
        </div>
    `;

    // 4. 이벤트 리스너 등록
    helpBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.classList.toggle('hidden');
    });

    popup.querySelectorAll('.example-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            input.value = btn.innerText.trim(); // 텍스트만 입력
            popup.classList.add('hidden');
            input.focus();
        });
    });

    // 외부 클릭 시 팝업 닫기
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && !helpBtn.contains(e.target)) {
            popup.classList.add('hidden');
        }
    });

    container.appendChild(helpBtn);
    container.appendChild(popup);
}
