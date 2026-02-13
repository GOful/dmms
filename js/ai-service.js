// Google Generative AI (Gemma 3) - AI 챗봇 서비스
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { highlightManholes } from './map-service.js';

const API_KEY = "AIzaSyDZfCjhWW4PNJ3R1EkbkHrm6nhjG_IuPuI";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });

// ========================================
// 지도 액션 (로컬 필터링)
// ========================================

// 액션 키워드: 이 단어가 포함되면 지도 표시 요청으로 판단
const ACTION_KEYWORDS = ['표시', '보여', '찾아', '하이라이트', '마크', '지도에'];

// 필드 매핑: 사용자 키워드 → 데이터 필드명
const FIELD_MAP = {
    '수선': 'repair_cnt',
    '침수': 'flood_freq',
    '민원': 'complaint_cnt',
};

// 복합 조건 키워드: AI 분석이 필요한 요청
const DANGER_KEYWORDS = ['주의', '위험', '관리', '점검', '우선', '심각', '긴급', '취약'];

// 비교 연산자 매핑: 패턴 → 비교 함수
const COMPARATORS = [
    { pattern: /이상/, fn: (v, t) => v >= t },
    { pattern: /초과/, fn: (v, t) => v > t },
    { pattern: /이하/, fn: (v, t) => v <= t },
    { pattern: /미만/, fn: (v, t) => v < t },
];

/**
 * [기능] 사용자 메시지에서 지도 액션(필터링 + 하이라이트)을 파싱합니다.
 */
function parseMapAction(userMsg) {
    const hasAction = ACTION_KEYWORDS.some(kw => userMsg.includes(kw));
    if (!hasAction) return null;

    // 1. 숫자 조건 필터 (예: "수선이 2회 이상", "민원 3회 초과")
    for (const [keyword, field] of Object.entries(FIELD_MAP)) {
        if (!userMsg.includes(keyword)) continue;
        const numMatch = userMsg.match(/(\d+)/);
        if (!numMatch) continue;
        const threshold = parseInt(numMatch[1], 10);

        let compare = (v, t) => v >= t;
        let compLabel = '이상';
        for (const comp of COMPARATORS) {
            if (comp.pattern.test(userMsg)) {
                compare = comp.fn;
                compLabel = userMsg.match(comp.pattern)[0];
                break;
            }
        }

        return { type: 'numeric', field, threshold, compare, label: `${keyword} ${threshold}회 ${compLabel}` };
    }

    // 2. AI 분석 필터 (예: "주의를 기울여야할 맨홀 표시해줘", "위험 맨홀 보여줘")
    const hasDanger = DANGER_KEYWORDS.some(kw => userMsg.includes(kw));
    if (hasDanger) {
        return { type: 'danger' };
    }

    // 3. 호선 필터 (예: "1호선 맨홀 표시해줘")
    const lineMatch = userMsg.match(/(\d+)호선/);
    if (lineMatch) {
        return { type: 'line', keyword: `${lineMatch[1]}호선` };
    }

    // 4. 역 필터 (예: "반월당역 맨홀 보여줘")
    const stationMatch = userMsg.match(/([가-힣]+역)/);
    if (stationMatch) {
        return { type: 'station', keyword: stationMatch[1] };
    }

    return null;
}

/**
 * [기능] rawData에서 조건에 맞는 맨홀 ID 목록을 필터링합니다.
 */
function filterManholes(rawData, action) {
    const ids = [];
    const names = [];

    rawData.lines.forEach(line => {
        if (action.type === 'line' && !line.lineTitle.includes(action.keyword)) return;

        line.stations.forEach(st => {
            if (action.type === 'station' && !st.stationName.includes(action.keyword)) return;

            st.manholes.forEach(mh => {
                let match = false;

                if (action.type === 'numeric') {
                    match = action.compare(mh[action.field], action.threshold);
                } else {
                    match = true;
                }

                if (match) {
                    ids.push(mh.id);
                    names.push(mh.name);
                }
            });
        });
    });

    return { ids, names };
}

/**
 * [기능] 지도 액션 결과를 챗 메시지로 생성합니다.
 */
function buildActionMessage(action, ids, names) {
    if (ids.length === 0) {
        const conditionText = action.type === 'numeric' ? action.label : action.keyword;
        return `조건에 맞는 맨홀이 없습니다. (조건: ${conditionText})`;
    }

    let header = '';
    if (action.type === 'numeric') {
        header = `<strong>${action.label}</strong>인 맨홀 <strong>${ids.length}개</strong>를 지도에 표시했습니다.`;
    } else if (action.type === 'line') {
        header = `<strong>${action.keyword}</strong> 맨홀 <strong>${ids.length}개</strong>를 지도에 표시했습니다.`;
    } else if (action.type === 'station') {
        header = `<strong>${action.keyword}</strong> 맨홀 <strong>${ids.length}개</strong>를 지도에 표시했습니다.`;
    }

    const listItems = names.slice(0, 10).map(n => `<li>${n}</li>`).join('');
    const moreText = names.length > 10 ? `<li class="text-slate-400">...외 ${names.length - 10}개</li>` : '';

    return `${header}<ul class="mt-2 ml-4 list-disc text-xs space-y-0.5">${listItems}${moreText}</ul>`;
}

// ========================================
// 공통 유틸
// ========================================

/**
 * [유틸] rawData를 CSV 문자열로 변환합니다.
 */
function buildCsvData(rawData) {
    let csv = "호선,ID,이름,역,위도,경도,침수빈도,수선횟수,민원횟수\n";
    rawData.lines.forEach(line => {
        line.stations.forEach(st => {
            st.manholes.forEach(mh => {
                csv += `${line.lineTitle},${mh.id},${mh.name},${st.stationName},${mh.lat},${mh.lng},${mh.flood_freq},${mh.repair_cnt},${mh.complaint_cnt}\n`;
            });
        });
    });
    return csv;
}

/**
 * [유틸] 로딩 인디케이터를 표시합니다.
 */
function showLoading(history) {
    const loadingId = "loading-" + Date.now();
    history.innerHTML += `
        <div id="${loadingId}" class="self-start bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 text-sm animate-[fadeIn_0.3s_ease-out]">
            <div class="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
            <span class="font-medium">분석 중...</span>
        </div>`;
    history.scrollTop = history.scrollHeight;
    return loadingId;
}

/**
 * [유틸] AI 응답 말풍선 HTML을 생성합니다.
 */
function chatBubble(content) {
    return `<div class="self-start bg-white border border-slate-200 text-slate-800 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm max-w-[90%] text-sm leading-relaxed prose prose-sm break-words animate-[fadeIn_0.3s_ease-out]">${content}</div>`;
}

// ========================================
// AI 분석 + 지도 표시 (danger 타입)
// ========================================

/**
 * [기능] AI에게 데이터를 보내 위험 맨홀을 분석시키고, 결과를 지도에 표시합니다.
 * AI가 직접 기준을 판단하고 맨홀 ID를 반환합니다.
 */
async function handleDangerAction(rawData, userMsg, history) {
    const contextData = buildCsvData(rawData);

    const prompt = `
당신은 대구교통공사(DTRO)의 맨홀 관리 시스템 전문 AI 어시스턴트입니다.
아래 CSV 데이터를 분석하여 사용자의 요청에 응답하세요.

<Instruction>
1. 사용자의 요청을 분석하여 해당하는 맨홀들을 선별하세요.
2. 침수빈도, 수선횟수, 민원횟수 등을 종합적으로 고려하여 스스로 판단 기준을 세우세요.
3. 반드시 아래 형식으로 응답하세요:
   - 첫 줄에 [IDS] 태그 안에 선별한 맨홀 ID를 쉼표로 나열: [IDS]MH-1-01-01,MH-1-02-05[/IDS]
   - 그 아래에 분석 근거와 설명을 작성하세요.
4. 선별 기준과 이유를 구체적으로 설명해주세요.
5. 해당하는 맨홀이 없으면 [IDS][/IDS] (빈 태그)로 응답하세요.
</Instruction>

<Data>
${contextData}
</Data>

요청: ${userMsg}`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    // AI 응답에서 맨홀 ID 추출
    const idsMatch = responseText.match(/\[IDS\](.*?)\[\/IDS\]/);
    let ids = [];
    if (idsMatch && idsMatch[1].trim()) {
        ids = idsMatch[1].split(',').map(id => id.trim());
    }

    // 지도에 하이라이트
    if (ids.length > 0) {
        highlightManholes(ids);
    }

    // [IDS]...[/IDS] 태그를 제거한 설명 텍스트만 표시
    const explanation = responseText
        .replace(/\[IDS\].*?\[\/IDS\]/, '')
        .trim();

    const mapNote = ids.length > 0
        ? `<div class="mt-2 pt-2 border-t border-slate-100 text-xs text-blue-600 font-medium">지도에 ${ids.length}개 맨홀을 표시했습니다.</div>`
        : '';

    history.innerHTML += chatBubble(explanation + mapNote);
}

// ========================================
// AI 대화
// ========================================

/**
 * [기능] 사용자의 질문을 받아 처리합니다.
 * - 숫자/호선/역 필터 → 로컬 필터링 (즉시)
 * - 위험/주의 분석 → AI 분석 후 지도 표시
 * - 일반 질문 → AI 대화
 * @param {Object} rawData - 맨홀 및 역 데이터 (JSON 객체)
 */
export async function askAI(rawData) {
    const input = document.getElementById('chat-input');
    const history = document.getElementById('chat-history');
    const sendBtn = document.getElementById('send-btn');
    const userMsg = input.value.trim();

    if (!userMsg || !rawData) return;

    // UI 업데이트: 메시지 추가 및 입력창 비활성화
    history.innerHTML += `<div class="self-end bg-blue-600 text-white px-4 py-2.5 rounded-2xl rounded-tr-none shadow-sm max-w-[85%] text-sm leading-relaxed break-words animate-[fadeIn_0.3s_ease-out]">${userMsg}</div>`;
    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;

    const action = parseMapAction(userMsg);

    // 1. 로컬 필터링 (숫자/호선/역 조건)
    if (action && action.type !== 'danger') {
        const fakeLoadingId = showLoading(history);

        // 자연스러운 딜레이 (0.8~1.5초)
        await new Promise(r => setTimeout(r, 800 + Math.random() * 700));

        const { ids, names } = filterManholes(rawData, action);
        if (ids.length > 0) {
            highlightManholes(ids);
        }

        const loadingEl = document.getElementById(fakeLoadingId);
        if (loadingEl) loadingEl.remove();

        history.innerHTML += chatBubble(buildActionMessage(action, ids, names));
        input.disabled = false;
        sendBtn.disabled = false;
        history.scrollTop = history.scrollHeight;
        return;
    }

    // 2. AI 분석 (danger 타입 포함, 일반 질문 포함)
    const loadingId = showLoading(history);

    try {
        if (action && action.type === 'danger') {
            // AI가 직접 위험 맨홀을 판단하고 지도에 표시
            await handleDangerAction(rawData, userMsg, history);
        } else {
            // 일반 AI 대화
            const infraKeywords = ['맨홀', '역', '호선', '좌표', '위도', '경도', '침수', '수선', '민원', '위험', '데이터', '목록', '어디', '가장', '제일', '상태', '분석', '점검', '관리', '지역'];
            const isRelated = infraKeywords.some(key => userMsg.includes(key));

            let finalPrompt = "";

            if (isRelated) {
                const contextData = buildCsvData(rawData);
                finalPrompt = `
당신은 대구교통공사(DTRO)의 맨홀 관리 시스템 전문 AI 어시스턴트입니다.
아래 제공된 CSV 데이터를 분석하여 사용자의 질문에 답변하세요.

<Instruction>
1. 제공된 [Data]에 있는 내용에 기반해서만 답변하세요. 정보가 없으면 솔직하게 모른다고 답하세요.
2. 특정 맨홀의 정보를 나열할 때는 가독성이 좋게 해주세요
3. 침수 빈도나 민원 횟수가 높은 위험 시설물에 대해서는 주의를 당부하는 멘트를 추가하세요.
</Instruction>

<Data>
${contextData}
</Data>

Question: ${userMsg}`;
            } else {
                finalPrompt = `너는 '대구교통공사 맨홀관리 시스템'의 AI야. 시설물 관리와 관련 없는 일상적인 대화나 질문에는 친절하게 대답해줘. 질문: ${userMsg}`;
            }

        // AI 응답 생성 요청
        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        
        // 결과 표시
        history.innerHTML += `<div class="self-start bg-white border border-slate-200 text-slate-800 px-4 py-3 rounded-2xl rounded-tl-none shadow-sm max-w-[90%] text-sm leading-relaxed prose prose-sm break-words animate-[fadeIn_0.3s_ease-out]">${response.text()}</div>`;
    } catch (error) {
        console.error("AI 응답 오류:", error);
        history.innerHTML += chatBubble("오류가 발생했습니다. 할당량(Quota)이나 네트워크를 확인하세요.");
    } finally {
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        input.disabled = false;
        sendBtn.disabled = false;
        history.scrollTop = history.scrollHeight;
    }
}
