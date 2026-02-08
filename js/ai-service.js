import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

const API_KEY = "AIzaSyDZfCjhWW4PNJ3R1EkbkHrm6nhjG_IuPuI"; 
const genAI = new GoogleGenerativeAI(API_KEY);
// 사용 중인 Gemma 3 모델 설정
const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });

/**
 * [기능] 사용자의 질문을 받아 AI에게 전송하고 답변을 화면에 표시합니다.
 * @param {Object} rawData - AI가 분석할 맨홀 및 역 데이터 (JSON 객체)
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

    // 로딩 인디케이터 표시
    const loadingId = "loading-" + Date.now();
    history.innerHTML += `
        <div id="${loadingId}" class="self-start bg-white border border-slate-200 text-slate-600 px-4 py-2.5 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-2 text-sm animate-[fadeIn_0.3s_ease-out]">
            <div class="w-4 h-4 border-2 border-slate-300 border-t-blue-600 rounded-full animate-spin"></div>
            <span class="font-medium">분석 중...</span>
        </div>`;
    history.scrollTop = history.scrollHeight;

    try {
        // 1. 질문 의도 파악: 시설물 관리 관련 질문인지 키워드로 검사
        const infraKeywords = ['맨홀', '역', '호선', '좌표', '위도', '경도', '침수', '수선', '민원', '위험', '데이터', '목록', '어디', '가장', '제일', '상태', '분석', '점검', '관리', '지역'];
        const isRelated = infraKeywords.some(key => userMsg.includes(key));

        let finalPrompt = "";

        if (isRelated) {
            // 2-A. 관련 질문인 경우: CSV 포맷으로 변환된 데이터를 프롬프트에 주입 (RAG 유사 방식)
            let contextData = "ID,이름,역,위도,경도,침수빈도,수선횟수,민원횟수\n";
            rawData.lines.forEach(line => {
                line.stations.forEach(st => {
                    st.manholes.forEach(mh => {        
                        contextData += `${mh.id},${mh.name},${st.stationName},${mh.lat},${mh.lng},${mh.flood_freq},${mh.repair_cnt},${mh.complaint_cnt}\n`;
                    });
                });
            });
            console.log("데이터 포함 프롬프트 생성됨.");
            
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
            // 2-B. 관련 없는 질문인 경우: 데이터 주입 없이 일반 페르소나만 적용 (토큰 절약)
            console.log("일반 대화 모드로 전환 (데이터 제외).");
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
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.innerText = "오류가 발생했습니다. 할당량(Quota)이나 네트워크를 확인하세요.";
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        history.scrollTop = history.scrollHeight;
    }
}