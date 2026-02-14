// Google Generative AI - AI 챗봇 서비스
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { 
    appendUserMessage, 
    showBotLoadingIndicator, 
    removeBotLoadingIndicator, 
    appendBotMessage, 
    appendBotError, 
    setChatInputDisabled 
} from './ui-manager.js';

const API_KEY = "AIzaSyDZfCjhWW4PNJ3R1EkbkHrm6nhjG_IuPuI";
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });


/**
 * [내부 기능] 사용자의 질문과 데이터를 바탕으로 AI에게 보낼 프롬프트를 생성합니다.
 * @param {string} userMsg - 사용자의 원본 질문
 * @param {Object} rawData - 분석에 사용할 맨홀 데이터
 * @returns {string} 최종적으로 생성된 프롬프트
 */
function _buildPrompt(userMsg, rawData) {
    // 1. 질문 의도 파악: 시설물 관리 관련 질문인지 키워드로 검사
    const infraKeywords = ['맨홀', '역', '호선', '좌표', '위도', '경도', '침수', '수선', '민원', '위험', '데이터', '목록', '어디', '가장', '제일', '상태', '분석', '점검', '관리', '지역'];
    const isRelated = infraKeywords.some(key => userMsg.includes(key));

    if (isRelated) {
        // 2-A. 관련 질문인 경우: CSV 포맷으로 변환된 데이터를 프롬프트에 주입 (RAG 유사 방식)
        let contextData = "ID,이름,역,위도,경도,침수빈도,수선횟수,민원횟수\n";
        rawData.lines.forEach(line => {
            line.stations.forEach(st => {
                st.manholes.forEach(mh => {        
                    contextData += `${mh.id},${mh.name},${st.stationName},${mh.lat},${mh.lng},${mh.flood_freq || 0},${mh.repair_cnt || 0},${mh.complaint_cnt || 0}\n`;
                });
            });
        });
        console.log("데이터 포함 프롬프트 생성됨.");
        
        return `
당신은 대구교통공사(DTRO)의 맨홀 관리 시스템 전문 AI 어시스턴트입니다.
아래 제공된 CSV 데이터를 분석하여 사용자의 질문에 답변하세요.

<Instruction>
1. 제공된 [Data]에 있는 내용에 기반해서만 답변하세요. 정보가 없으면 솔직하게 모른다고 답하세요.
2. 답변은 전문가처럼 명확하고 간결하게, 그리고 존댓말로 하세요.
3. 답변에 HTML 태그(<br>, <ul>, <li>, <strong> 등)를 사용하여 가독성을 높여주세요. 단, "HTML 형식으로 답변합니다" 같은 부연설명은 절대 하지 마세요.
4. 사용자가 '가장', '1순위', '최고' 등의 표현으로 최상위 항목을 물어보면, 전체 목록을 나열하지 말고 해당되는 최상위 항목(들)만 명확하게 답변하세요.
5. 침수 빈도나 민원 횟수가 높은 위험 시설물에 대해서는 "안전 점검이 필요해 보입니다." 와 같은 주의를 당부하는 멘트를 추가하세요.
</Instruction>

<Data>
${contextData}
</Data>

Question: ${userMsg}`;
    } else {
        // 2-B. 관련 없는 질문인 경우: 데이터 주입 없이 일반 페르소나만 적용 (토큰 절약)
        console.log("일반 대화 모드로 전환 (데이터 제외).");
        return `너는 '대구교통공사 맨홀관리 시스템'의 AI야. 시설물 관리와 관련 없는 일상적인 대화나 질문에는 친절하게 대답해줘. 너의 이름은 'DMMS AI'야. 질문: ${userMsg}`;
    }
}


/**
 * [기능] 사용자의 질문을 받아 AI에게 전송하고 답변을 화면에 표시합니다.
 * @param {Object} rawData - AI가 분석할 맨홀 및 역 데이터 (JSON 객체)
 */
export async function askAI(rawData) {
    const userInput = document.getElementById('chat-input').value.trim();
    if (!userInput || !rawData) return;

    // 1. UI 업데이트 (사용자 메시지 표시 및 입력창 비활성화)
    appendUserMessage(userInput);
    setChatInputDisabled(true);
    showBotLoadingIndicator();

    try {
        // 2. 프롬프트 생성
        const finalPrompt = _buildPrompt(userInput, rawData);

        // 3. AI 응답 생성 요청
        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        const text = response.text();
        
        // 4. UI 업데이트 (로딩 제거 및 답변 표시)
        removeBotLoadingIndicator();
        appendBotMessage(text);

    } catch (error) {
        // 5. 오류 처리
        console.error("AI 응답 오류:", error);
        removeBotLoadingIndicator();
        appendBotError("오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");

    } finally {
        // 6. UI 최종 복원
        setChatInputDisabled(false);
        document.getElementById('chat-input').focus();
    }
}