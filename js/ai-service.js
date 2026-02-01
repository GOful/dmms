import { GoogleGenerativeAI } from "https://esm.run/@google/generative-ai";

const API_KEY = "AIzaSyAs7AMkUkPCVr-lK01naoUNZHBGFFPJsCk"; 
const genAI = new GoogleGenerativeAI(API_KEY);
const model = genAI.getGenerativeModel({ model: "gemma-3-27b-it" });

export async function askAI(rawData) {
    const input = document.getElementById('chat-input');
    const history = document.getElementById('chat-history');
    const sendBtn = document.getElementById('send-btn');
    const userMsg = input.value.trim();

    if (!userMsg || !rawData) return;

    history.innerHTML += `<div class="chat-msg user-msg">${userMsg}</div>`;
    input.value = "";
    input.disabled = true;
    sendBtn.disabled = true;

    const loadingId = "loading-" + Date.now();
    history.innerHTML += `<div id="${loadingId}" class="chat-msg ai-msg">Gemma가 분석 중...</div>`;
    history.scrollTop = history.scrollHeight;

    try {
        let context = "관리 중인 맨홀 목록:\n";
        rawData.lines.forEach(line => line.stations.forEach(st => st.manholes.forEach(mh => {
            context += `- ID: ${mh.id}, 이름: ${mh.name}, 위치: ${st.stationName} 인근\n`;
        })));

        const prompt = `너는 '디트로 맨홀관리 시스템'의 도우미 Gemma야.\n[데이터]\n${context}\n[질문]\n${userMsg}`;
        const result = await model.generateContent(prompt);
        const response = await result.response;
        
        document.getElementById(loadingId).remove();
        history.innerHTML += `<div class="chat-msg ai-msg">${response.text()}</div>`;
    } catch (error) {
        document.getElementById(loadingId).innerText = "오류가 발생했습니다.";
    } finally {
        input.disabled = false;
        sendBtn.disabled = false;
        history.scrollTop = history.scrollHeight;
    }
}