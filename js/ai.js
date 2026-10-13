/**
 * AI 챗봇 — 맨홀 데이터를 붙여 Google Generative AI 에 질문하고, 응답 속 지도 명령을 실행한다
 *
 * AI 가 JSON 으로 돌려주는 지도 명령
 *   filter_map_markers  지정한 맨홀 ID 를 지도에 표시
 *   apply_filter        '보수 3회 이상' 같은 수치 조건 → 계산은 여기서 직접 (AI 계산 오류 방지)
 */
import { AI_MODEL } from './config.js';
import { escapeHtml, forEachManhole } from './utils.js';
import { filterMarkers } from './map/map.js';
import { addBotMessage, addUserMessage, setBusy } from './ui/chat.js';

/** apply_filter 에서 쓸 수 있는 항목 */
const FILTER_FIELDS = {
    repair_cnt: { label: '맨홀보수', unit: '회' },
    flood_cnt: { label: '접속개소 침수', unit: '회' },
    latest_level: { label: '최근수위', unit: 'mm' },
    avg_level: { label: '평균수위', unit: 'mm' },
    max_level: { label: '최대수위', unit: 'mm' },
    risk_score: { label: '종합 위험도', unit: '점' },   // 침수 ×3 + 보수 ×2
};
const COMPARE = {
    '>=': (a, b) => a >= b,
    '<=': (a, b) => a <= b,
    '>': (a, b) => a > b,
    '<': (a, b) => a < b,
    '==': (a, b) => a === b,
};
const RISK_DEFAULT_LIMIT = 5;
const INFRA_KEYWORDS = ['맨홀', '역', '호선', '좌표', '위도', '경도', '침수', '수선', '보수', '수위', '위험',
    '데이터', '목록', '어디', '가장', '제일', '상태', '분석', '점검', '관리', '지역'];

let modelPromise = null;

/** 모델은 첫 질문 때 불러옴 (라이브러리·API 키를 못 불러와도 앱의 다른 기능은 동작) */
function getModel() {
    modelPromise ??= Promise.all([
        import('https://esm.run/@google/generative-ai'),
        import('./apikey.js'),
    ]).then(([{ GoogleGenerativeAI }, { GOOGLE_API_KEY }]) =>
        new GoogleGenerativeAI(GOOGLE_API_KEY).getGenerativeModel({ model: AI_MODEL }));
    modelPromise.catch(() => { modelPromise = null; });   // 실패하면 다음 질문 때 다시 시도
    return modelPromise;
}

/**
 * 질문 → AI 응답을 대화창에 표시
 * @param {string} question
 * @param {object} data 맨홀 데이터 (lines > stations > manholes)
 */
export async function askAI(question, data) {
    addUserMessage(question);
    setBusy(true);
    try {
        const model = await getModel();
        const result = await model.generateContent(buildPrompt(question, data));
        const message = handleResponse(result.response.text(), data);
        setBusy(false);
        addBotMessage(message);
    } catch (e) {
        console.error('AI 요청 실패:', e);
        setBusy(false);
        addBotMessage('서비스 연결이 원활하지 않습니다. 다시 시도해 주세요.', { error: true });
    }
}

// ── 프롬프트 ─────────────────────────────────────────────

function buildPrompt(question, data) {
    if (!INFRA_KEYWORDS.some((k) => question.includes(k))) {
        return `너는 '대구교통공사 맨홀관리 시스템'의 AI 'DMMS AI'야. 시설 관리 외의 일상 대화에는 친절하게 답해줘. 질문: ${question}`;
    }

    // 좌표는 보내지 않음 (토큰 절약 — 위치 표시는 앱이 담당)
    const rows = ['ID,이름,역,접속개소침수횟수,맨홀보수횟수,최근수위(mm),평균수위(mm),최대수위(mm)'];
    forEachManhole(data, (mh, st) => {
        rows.push([mh.id, mh.name, st.stationName, mh.flood_cnt || 0, mh.repair_cnt || 0,
            mh.latest_level ?? '-', mh.avg_level ?? '-', mh.max_level ?? '-'].join(','));
    });
    const fieldList = Object.entries(FILTER_FIELDS).map(([key, f]) => `${key}: ${f.label}`).join(', ');

    return `
당신은 대구교통공사(DTRO)의 맨홀 관리 시스템 전문 AI 어시스턴트다
아래 제공된 [Data]를 분석하여 사용자의 질문에 답변

<Instruction>
1. 반드시 제공된 [Data]에 기반해 답변
2. 반드시 답변 시 HTML 태그(<ul>, <li>, <strong>, <br>)를 적절히 섞어 가독성 높이기
3. 침수는 맨홀 하부 전력케이블 접속개소가 잠긴 경우, 보수는 맨홀 보수공사를 뜻함. 위험 시설물(침수/맨홀보수 많음, 수위 높음) 언급 시 반드시 주의점검에 대한 내용을 마지막 강조
4. [중요] 사용자가 지도 표시(찍어줘, 보여줘 등)를 요청하면, 아래 JSON 형식으로 응답하고 'message' 필드에는 선택된 맨홀들의 데이터(침수 횟수, 상태 등)와 선정 이유를 HTML 태그(<ul>, <li>)를 사용하여 요약해 주세요:

\`\`\`json
{
  "tool": "filter_map_markers",
  "target_ids": ["ID1", "ID2"],
  "message": "요청하신 침수 위험 지역 2곳을 표시했습니다.<br><ul><li><strong>MH-001</strong>: 침수 5회 (심각)</li>...</ul>"
}
\`\`\`
   - [매우 중요] '맨홀보수 3회 이상', '침수 1회 이상', '수위 1000mm 넘는' 등 수치 조건을 제시한 경우, 절대 직접 ID를 나열하지 말고 반드시 'apply_filter' 도구를 사용하세요 (시스템이 정확히 계산합니다):
\`\`\`json
{
  "tool": "apply_filter",
  "criteria": {
    "field": "repair_cnt", // 데이터 필드명 (${fieldList})
    "operator": ">=", // 연산자 (>=, <=, >, <, ==) *주의: "넘는/초과"는 ">", "이상"은 ">="
    "value": 5, // 기준 값 (숫자)
    "limit": null // [선택] 사용자가 "5곳만", "상위 3개" 처럼 개수를 명시하지 않으면 null 또는 생략
  }
}
\`\`\`
   - [팁] '특별 관리', '위험한 곳', '시급한', '추천' 등 복합적인 판단이 필요한 경우 field를 'risk_score'로 설정하고 value는 5 이상으로 잡으세요. 이때는 결과가 너무 많지 않도록 'limit': 5 를 설정하세요.
</Instruction>

<Data>
${rows.join('\n')}
</Data>

Question: ${question}`;
}

// ── 응답 처리 ────────────────────────────────────────────

/** AI 응답 → 화면에 보일 메시지 (지도 명령이 있으면 실행) */
function handleResponse(text, data) {
    const json = extractJson(text);
    if (!json) return text;

    try {
        const action = JSON.parse(json);
        if (action.tool === 'filter_map_markers' && Array.isArray(action.target_ids)) {
            filterMarkers(action.target_ids);
            return action.message || `요청하신 <strong>${action.target_ids.length}</strong>개의 시설물을 지도에 표시했습니다.`;
        }
        if (action.tool === 'apply_filter' && action.criteria) {
            return applyFilter(action.criteria, data);
        }
        return text;
    } catch (e) {
        console.error('AI 응답 JSON 파싱 실패:', e);
        return text.replace(/```json|```/g, '').trim();
    }
}

/** ```json 코드블록 우선, 없으면 가장 바깥 { ... } */
function extractJson(text) {
    const block = text.match(/```json\s*([\s\S]*?)\s*```/);
    if (block) return block[1].trim();
    return text.match(/\{[\s\S]*\}/)?.[0] ?? null;
}

/** 수치 조건 필터: 조건에 맞는 맨홀을 값이 큰 순으로 지도에 표시 */
function applyFilter({ field, operator, value, limit }, data) {
    const compare = COMPARE[operator];
    const target = Number(value);
    let matched = [];

    forEachManhole(data, (mh, st) => {
        const v = field === 'risk_score'
            ? (mh.flood_cnt || 0) * 3 + (mh.repair_cnt || 0) * 2
            : (mh[field] || 0);
        if (compare?.(v, target)) matched.push({ id: mh.id, name: mh.name, station: st.stationName, value: v });
    });

    matched.sort((a, b) => b.value - a.value);
    const max = limit || (field === 'risk_score' ? RISK_DEFAULT_LIMIT : null);
    if (max > 0) matched = matched.slice(0, max);

    filterMarkers(matched.map((m) => m.id));
    if (!matched.length) return '<p>요청하신 조건에 해당하는 시설물이 없습니다.</p>';

    const { label, unit } = FILTER_FIELDS[field] || { label: field, unit: '' };
    const items = matched.map((m) =>
        `<li><strong>${m.id}</strong> (${escapeHtml(m.station)}): ${label} ${m.value}${unit} - ${escapeHtml(m.name)}</li>`).join('');
    return `<p>요청하신 시설물 <strong>${matched.length}</strong>곳을 찾았습니다.${max ? ` (상위 ${max}곳)` : ''}</p>
        <ul class="list-disc pl-5 mt-2 text-sm space-y-1 max-h-60 overflow-y-auto">${items}</ul>`;
}
