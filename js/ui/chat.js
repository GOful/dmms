/**
 * AI 대화창 UI — 열고 닫기, 메시지 표시, 질문 가이드 팝업
 * (AI 요청과 응답 처리는 ai.js)
 */

const $ = (id) => document.getElementById(id);

/** 질문 가이드의 예시 질문 */
const EXAMPLES = [
    {
        title: '데이터형 질문',
        hover: 'hover:border-blue-300 hover:bg-blue-50/50',
        questions: ['침수 횟수 3회 이상인 곳 표시해줘', '반월당역 근처 맨홀 침수 이력 알려줘'],
    },
    {
        title: '지능형 질문',
        hover: 'hover:border-purple-300 hover:bg-purple-50/50',
        questions: ['특별히 관리해야 할 맨홀 5곳을 지도에 표시해줘', '데이터를 분석하여 점검이 시급한 역을 추천해줘'],
    },
];

/**
 * 대화창 이벤트 연결
 * @param {{ onSend: (question: string) => void }} handlers
 */
export function initChat({ onSend }) {
    const input = $('chat-input');
    const send = () => {
        const question = input.value.trim();
        if (!question || input.disabled) return;
        input.value = '';
        onSend(question);
    };

    $('chat-toggle-btn').addEventListener('click', toggleChat);
    $('chat-close-btn').addEventListener('click', toggleChat);
    $('chat-send-btn').addEventListener('click', send);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.isComposing) {
            e.preventDefault();
            send();
        }
    });
    setupHelpPopup(input);
}

function toggleChat() {
    const visible = $('chat-container').classList.toggle('show');
    if (visible) $('chat-input').focus();
}

// ── 메시지 ───────────────────────────────────────────────

const BUBBLE = 'px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed break-words animate-[fadeIn_0.3s_ease-out]';

function appendMessage(className, setContent) {
    const history = $('chat-history');
    const el = document.createElement('div');
    el.className = `${BUBBLE} ${className}`;
    setContent(el);
    history.appendChild(el);
    history.scrollTop = history.scrollHeight;
    return el;
}

export function addUserMessage(text) {
    appendMessage('self-end bg-blue-600 text-white rounded-tr-none max-w-[85%]', (el) => { el.textContent = text; });
}

/** AI 응답 (HTML 포함) — error: 빨간 글씨 */
export function addBotMessage(html, { error = false } = {}) {
    const color = error ? 'text-red-600' : 'text-slate-800';
    appendMessage(`self-start bg-white border border-slate-200 ${color} rounded-tl-none max-w-[90%] prose prose-sm`,
        (el) => { el.innerHTML = html; });
}

let typingEl = null;

/** '분석 중...' 표시 켜기/끄기 + 입력창 잠금 */
export function setBusy(busy) {
    $('chat-input').disabled = busy;
    $('chat-send-btn').disabled = busy;
    typingEl?.remove();
    typingEl = busy
        ? appendMessage('self-start bg-white border border-slate-200 text-slate-600 rounded-tl-none flex items-center gap-2', (el) => {
            el.innerHTML = `
                <div class="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
                <span class="font-medium">분석 중...</span>`;
        })
        : null;
}

// ── 질문 가이드 팝업 ─────────────────────────────────────

function setupHelpPopup(input) {
    const container = input.parentElement;

    const button = document.createElement('button');
    button.type = 'button';
    button.title = '질문 예시 보기';
    button.className = 'absolute left-0 -top-9 flex items-center gap-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-200 hover:text-blue-600 hover:border-blue-400 transition-all py-1.5 px-3 rounded-full shadow-sm z-10';
    button.innerHTML = `
        <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>
        질문 가이드`;

    const popup = document.createElement('div');
    popup.className = 'hidden absolute bottom-full left-0 mb-12 w-[380px] max-w-[85vw] bg-white border border-slate-100 shadow-2xl rounded-xl overflow-hidden z-50 animate-[fadeIn_0.2s_ease-out] ring-1 ring-slate-900/5';
    popup.innerHTML = `
        <div class="bg-slate-900 p-3 text-white flex items-center justify-between">
            <h4 class="font-bold text-sm">AI 대화 질문 가이드</h4>
            <button type="button" class="js-close text-slate-400 hover:text-white">
                <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/></svg>
            </button>
        </div>
        <div class="p-3 bg-slate-50/50 space-y-3">
            <div class="flex gap-2 text-xs text-slate-600">
                <div class="flex-1 bg-white border border-slate-200 rounded-lg py-2 text-center shadow-sm"><b class="text-slate-900 text-sm">"표시해줘"</b> : 지도 핀</div>
                <div class="flex-1 bg-white border border-slate-200 rounded-lg py-2 text-center shadow-sm"><b class="text-slate-900 text-sm">"알려줘"</b> : 상세 답변</div>
            </div>
            ${EXAMPLES.map((group) => `
                <div>
                    <h5 class="text-xs font-bold text-slate-500 mb-1.5 pl-1">${group.title}</h5>
                    <div class="space-y-1">
                        ${group.questions.map((q) => `
                            <button type="button" data-question="${q}" class="w-full py-1.5 px-2.5 rounded-lg bg-white border border-slate-200 ${group.hover} text-left text-sm text-slate-700 font-medium transition-all">${q}</button>`).join('')}
                    </div>
                </div>`).join('')}
        </div>`;

    button.addEventListener('click', (e) => {
        e.stopPropagation();
        popup.classList.toggle('hidden');
    });
    popup.querySelector('.js-close').addEventListener('click', () => popup.classList.add('hidden'));
    popup.querySelectorAll('[data-question]').forEach((q) => {
        q.addEventListener('click', () => {
            // 모바일 키보드가 올라오지 않도록 잠시 읽기 전용으로 값만 넣음
            input.readOnly = true;
            input.value = q.dataset.question;
            popup.classList.add('hidden');
            input.blur();
            setTimeout(() => { input.readOnly = false; }, 50);
        });
    });
    document.addEventListener('click', (e) => {
        if (!popup.contains(e.target) && !button.contains(e.target)) popup.classList.add('hidden');
    });

    container.append(button, popup);
}
