import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

const API_KEY = "AIzaSyAs7AMkUkPCVr-lK01naoUNZHBGFFPJsCk"; 
const genAI = new GoogleGenerativeAI(API_KEY);
// 사용 중인 Gemma 3 모델 설정
const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });

export async function askAI(rawData) {
    const input = document.getElementById('chat-input');
    const history = document.getElementById('chat-history');
    const sendBtn = document.getElementById('send-btn');
    const userMsg = input.value.trim();

    if (!userMsg || !rawData) return;

    // UI 업데이트: 메시지 추가 및 입력창 비활성화
    history.innerHTML += `<div class="chat-msg user-msg">${userMsg}</div>`;
    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;

    const loadingId = "loading-" + Date.now();
    history.innerHTML += `<div id="${loadingId}" class="chat-msg ai-msg">Gemma가 분석 중...</div>`;
    history.scrollTop = history.scrollHeight;

    try {
        // 1. 관련성 검사 키워드 (대구 지역 및 시설물 관련)
        const infraKeywords = ['맨홀', '역', '호선', '좌표', '위도', '경도', '침수', '수선', '민원', '위험', '데이터', '목록', '어디'];
        const isRelated = infraKeywords.some(key => userMsg.includes(key));

        let finalPrompt = "";

        if (isRelated) {
            // 2. 관련 질문인 경우에만 context 생성 (토큰 절약)
            let context = "맨홀 데이터 목록(순서: ID,이름,역,위도,경도,침수빈도,수선횟수,민원횟수)\n";
            rawData.lines.forEach(line => {
                line.stations.forEach(st => {
                    st.manholes.forEach(mh => {        
                        context += `${mh.id},${mh.name},${st.stationName},${mh.lat},${mh.lng},${mh.flood_freq},${mh.repair_cnt},${mh.complaint_cnt}\n`;
                    });
                });
            });
            console.log("데이터 포함 프롬프트 생성됨.");
            finalPrompt = `너는 '디트로 맨홀관리 시스템'의 도우미 Gemma야. 다음 데이터를 바탕으로 질문에 답해줘.\n\n[데이터]\n${context}\n\n[질문]\n${userMsg}`;
        } else {
            // 3. 관련 없는 질문인 경우 일반 챗봇으로 동작
            console.log("일반 대화 모드로 전환 (데이터 제외).");
            finalPrompt = `너는 '디트로 맨홀관리 시스템'의 도우미 Gemma야. 시설물 관리와 관련 없는 일상적인 대화나 질문에는 친절하게 대답해줘. 질문: ${userMsg}`;
        }

        const result = await model.generateContent(finalPrompt);
        const response = await result.response;
        
        const loadingEl = document.getElementById(loadingId);
        if (loadingEl) loadingEl.remove();
        
        history.innerHTML += `<div class="chat-msg ai-msg">${response.text()}</div>`;
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