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
        // [최적화] AI에게 위도/경도 좌표까지 보낼 필요는 없음 (토큰 절약)
        // AI는 ID와 상태값만 판단하고, 위치 표시는 JS가 담당함
        let contextData = "ID,이름,역,침수,수선,민원\n";
        rawData.lines.forEach(line => {
            line.stations.forEach(st => {
                st.manholes.forEach(mh => {        
                    contextData += `${mh.id},${mh.name},${st.stationName},${mh.flood_cnt || 0},${mh.repair_cnt || 0},${mh.complaint_cnt || 0}\n`;
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
4. [중요] 사용자가 지도 표시(찍어줘, 보여줘 등)를 요청하면, 아래 JSON 형식으로 응답하고 'message' 필드에는 선택된 맨홀들의 데이터(침수 횟수, 상태 등)와 선정 이유를 HTML 태그(<ul>, <li>)를 사용하여 요약해 주세요:

\`\`\`json
{
  "tool": "filter_map_markers",
  "target_ids": ["ID1", "ID2"],
  "message": "요청하신 침수 위험 지역 2곳을 표시했습니다.<br><ul><li><strong>MH-001</strong>: 침수 5회 (심각)</li>...</ul>"
}
\`\`\`
   - [매우 중요] '수선 5회 이상', '침수 1회 이상', '3회 넘는' 등 수치 조건을 제시한 경우, 절대 직접 ID를 나열하지 말고 반드시 'apply_filter' 도구를 사용하세요 (시스템이 정확히 계산합니다):
\`\`\`json
{
  "tool": "apply_filter",
  "criteria": {
    "field": "repair_cnt", // 데이터 필드명 (repair_cnt, flood_cnt, complaint_cnt, risk_score)
    "operator": ">=", // 연산자 (>=, <=, >, <, ==) *주의: "넘는/초과"는 ">", "이상"은 ">="
    "value": 5, // 기준 값 (숫자)
    "limit": 5 // [선택] 결과 개수 제한 (예: "5곳만", "상위 3개")
  }
}
   - [팁] '특별 관리', '위험한 곳', '시급한', '추천' 등 복합적인 판단이 필요한 경우 field를 'risk_score'로 설정하고 value는 5 이상으로 잡으세요. 또한, 결과가 너무 많지 않도록 반드시 'limit': 5 를 설정하세요.
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
        
        // JSON 추출 로직 개선 (Code Block 우선, 없으면 Greedy 매칭으로 중첩 객체 대응)
        let jsonString = null;
        const codeBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
        
        if (codeBlockMatch) {
            jsonString = codeBlockMatch[1];
        } else {
            // 중첩된 중괄호({ ... { ... } ... })를 처리하기 위해 Greedy 매칭 사용
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) jsonString = jsonMatch[0];
        }

        if (jsonString) {
            try {
                const actionData = JSON.parse(jsonString.trim());
                
                if (actionData.tool === "filter_map_markers" && Array.isArray(actionData.target_ids)) {
                    // 지도 기능 실행
                    filterMarkers(actionData.target_ids);
                    displayMessage = actionData.message || `요청하신 <strong>${actionData.target_ids.length}</strong>개의 시설물을 지도에 표시했습니다.`;
                }
                
                // [추가] 수치 기반 필터링 로직 (AI가 조건을 추출하면 JS가 정확히 계산)
                if (actionData.tool === "apply_filter" && actionData.criteria) {
                    const { field, operator, value, limit } = actionData.criteria;
                    let matchedDetails = []; // 상세 정보 수집용
                    let matchedIds = [];

                    // 전체 데이터 순회하며 조건 검사
                    rawData.lines.forEach(line => {
                        line.stations.forEach(st => {
                            st.manholes.forEach(mh => {
                                let dataValue = 0;
                                if (field === 'risk_score') {
                                    // [추가] 종합 위험도 계산 (가중치: 침수 3, 수선 2, 민원 1)
                                    dataValue = (mh.flood_cnt || 0) * 3 + (mh.repair_cnt || 0) * 2 + (mh.complaint_cnt || 0) * 1;
                                } else {
                                    dataValue = mh[field] || 0;
                                }

                                let isMatch = false;
                                const numValue = Number(value);
                                
                                if (operator === ">=") isMatch = dataValue >= numValue;
                                else if (operator === "<=") isMatch = dataValue <= numValue;
                                else if (operator === ">") isMatch = dataValue > numValue;
                                else if (operator === "<") isMatch = dataValue < numValue;
                                else if (operator === "==") isMatch = dataValue == numValue;

                                if (isMatch) {
                                    matchedDetails.push({
                                        id: mh.id,
                                        name: mh.name,
                                        val: dataValue,
                                        station: st.stationName
                                    });
                                }
                            });
                        });
                    });

                    // [개선] 정렬 및 개수 제한 로직 추가
                    // 값이 높은 순서대로 정렬 (내림차순)
                    matchedDetails.sort((a, b) => b.val - a.val);

                    // [수정] limit 처리 로직 개선
                    // risk_score(종합 위험도) 분석이나 '추천' 요청인 경우, limit이 명시되지 않았더라도 
                    // 너무 많은 결과가 나오지 않도록 기본적으로 상위 5개만 보여줌
                    let finalLimit = limit;
                    if (!finalLimit && field === 'risk_score') {
                        finalLimit = 5;
                    }

                    if (finalLimit && finalLimit > 0 && matchedDetails.length > finalLimit) {
                        matchedDetails = matchedDetails.slice(0, finalLimit);
                    }

                    // 최종 ID 목록 추출
                    matchedIds = matchedDetails.map(item => item.id);

                    filterMarkers(matchedIds);
                    
                    // [수정] 결과 메시지를 JS가 직접 생성 (AI 환각 방지)
                    const fieldNameMap = { 'repair_cnt': '수선', 'flood_cnt': '침수', 'complaint_cnt': '민원', 'risk_score': '종합 위험도' };
                    const fieldName = fieldNameMap[field] || field;
                    const limitText = finalLimit ? ` (상위 ${finalLimit}곳)` : '';
                    const unit = field === 'risk_score' ? '점' : '회';

                    if (matchedIds.length > 0) {
                        const listHtml = matchedDetails.map(item => 
                            `<li><strong>${item.id}</strong> (${item.station}): ${fieldName} ${item.val}${unit} - ${item.name}</li>`
                        ).join('');
                        
                        displayMessage = `<p>요청하신 시설물 <strong>${matchedIds.length}</strong>곳을 찾았습니다.${limitText}</p>
                                          <ul class="list-disc pl-5 mt-2 text-sm space-y-1 max-h-60 overflow-y-auto">${listHtml}</ul>`;
                    } else {
                        displayMessage = `<p>요청하신 조건에 해당하는 시설물이 없습니다.</p>`;
                    }
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