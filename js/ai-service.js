// Google Generative AI - AI 챗봇 서비스
import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";
import { 
    appendUserMessage, 
    showBotLoadingIndicator, 
    removeBotLoadingIndicator, 
    appendBotMessage, 
    appendBotError, 
    setChatInputDisabled 
} from './chat-manager.js';
import { filterMarkers } from './map-service.js';

// 주의: API 키는 실제 배포 시 환경 변수나 보안 처리를 권장합니다.
const API_KEY = "AIzaSyDZfCjhWW4PNJ3R1EkbkHrm6nhjG_IuPuI";
const genAI = new GoogleGenerativeAI(API_KEY);

// 모델 설정
const model = genAI.getGenerativeModel({ 
    model: "gemma-3-27b-it"
});

/**
 * [내부 기능] 사용자의 질문과 데이터를 바탕으로 AI에게 보낼 프롬프트를 생성합니다.
 */
function _buildPrompt(userMsg, rawData) {
    const infraKeywords = ['맨홀', '역', '호선', '좌표', '위도', '경도', '침수', '수선', '민원', '위험', '데이터', '목록', '어디', '가장', '제일', '상태', '분석', '점검', '관리', '지역'];
    const isRelated = infraKeywords.some(key => userMsg.includes(key));

    if (isRelated) {
        let contextData = "ID,이름,역,위도,경도,침수횟수,수선횟수,민원횟수\n";
        rawData.lines.forEach(line => {
            line.stations.forEach(st => {
                st.manholes.forEach(mh => {        
                    contextData += `${mh.id},${mh.name},${st.stationName},${mh.lat},${mh.lng},${mh.flood_freq || 0},${mh.repair_cnt || 0},${mh.complaint_cnt || 0}\n`;
                });
            });
        });

        return `
당신은 대구교통공사(DTRO)의 맨홀 관리 시스템 전문 AI 어시스턴트다
아래 제공된 [Data]를 분석하여 사용자의 질문에 답변

<Instruction>
1. 반드시 제공된 [Data]에 기반해 답변
2. 반드시 답변 시 HTML 태그(<ul>, <li>, <strong>, <br>)를 적절히 섞어 가독성 높이기
3. 위험 시설물(침수/민원 높음) 언급 시 반드시 주의점검에 대한 내용을 마지막 강조
4. [중요] 사용자가 지도 표시(찍어줘, 보여줘 등)를 요청하면, 아래 JSON 형식으로 응답. 'message' 필드에는 선택된 맨홀들의 데이터(침수 횟수, 상태 등)와 선정 이유를 HTML 태그(<ul>, <li>)를 사용하여 요약해 주세요:
\`\`\`json
{
  "tool": "filter_map_markers",
  "target_ids": ["ID1", "ID2"],
  "message": "요청하신 침수 위험 지역 2곳을 표시했습니다.<br><ul><li><strong>MH-001</strong>: 침수 5회 (심각)</li>...</ul>"
}
\`\`\`
</Instruction>

<Data>
${contextData}
</Data>

Question: ${userMsg}`;
    } else {
        return `너는 '대구교통공사 맨홀관리 시스템'의 AI 'DMMS AI'야. 시설 관리 외의 일상 대화에는 친절하게 답해줘. 질문: ${userMsg}`;
    }
}

/**
 * [기능] 사용자의 질문을 받아 AI에게 전송하고 답변을 화면에 표시합니다.
 */
export async function askAI(rawData) {
    const chatInput = document.getElementById('chat-input');
    const userInput = chatInput.value.trim();
    if (!userInput || !rawData) return;

    // 1. UI 초기화
    appendUserMessage(userInput);
    chatInput.value = ''; // 입력창 비우기
    setChatInputDisabled(true);
    showBotLoadingIndicator();

    try {
        // 2. 프롬프트 생성 및 요청
        const finalPrompt = _buildPrompt(userInput, rawData);
        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        const text = response.text();

        // 3. 응답 처리 로직
        let displayMessage = text;
        
        // JSON 추출을 위한 정규표현식 (비탐욕적 매칭)
        const jsonMatch = text.match(/\{[\s\S]*?\}/);

        if (jsonMatch) {
            try {
                const actionData = JSON.parse(jsonMatch[0].trim());
                
                if (actionData.tool === "filter_map_markers" && Array.isArray(actionData.target_ids)) {
                    // 지도 기능 실행
                    filterMarkers(actionData.target_ids);
                    displayMessage = actionData.message || `요청하신 <strong>${actionData.target_ids.length}</strong>개의 시설물을 지도에 표시했습니다.`;
                }
            } catch (e) {
                console.error("JSON 파싱 에러:", e);
                // 파싱 실패 시 일반 텍스트에서 마크다운 기호만 제거
                displayMessage = text.replace(/```json|```/g, "").trim();
            }
        }

        // 4. 최종 메시지 출력
        removeBotLoadingIndicator();
        appendBotMessage(displayMessage);

    } catch (error) {
        console.error("AI 요청 실패:", error);
        removeBotLoadingIndicator();
        appendBotError("서비스 연결이 원활하지 않습니다. 다시 시도해 주세요.");
    } finally {
        setChatInputDisabled(false);
        chatInput.focus();
    }
}