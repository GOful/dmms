/**
 * 앱 전역 설정
 */

/** 지도 초기 화면 (대구 도심) */
export const MAP_CENTER = [35.8714, 128.6014];
export const MAP_LEVEL = { initial: 7, min: 1, max: 14 };

/** 노선별 색상 — marker/ring: 지도 마커 배경·안쪽 점선, badge: 사이드바 노선 아이콘 */
export const LINE_STYLES = {
    line1: { marker: '#dc2626', ring: '#991b1b', badge: '#e60012', label: '1' },
    line2: { marker: '#15803d', ring: '#14532d', badge: '#00a84d', label: '2' },
};
export const DEFAULT_LINE_STYLE = { marker: '#334155', ring: '#475569', badge: '#64748b', label: '?' };
export const SELECTED_MARKER_STYLE = { marker: '#2563eb', ring: '#93c5fd' };

/** 이력 표시 색 (지도 마커 숫자, 사이드바 표시) */
export const HISTORY_COLORS = { flood: '#e11d48', repair: '#2563eb' };

/** 사이드바 빠른 필터 */
export const QUICK_FILTERS = [
    { key: 'all', label: '전체', test: () => true },
    { key: 'flood', label: '침수 이력', test: (mh) => mh.flood_cnt > 0 },
    { key: 'repair', label: '보수 이력', test: (mh) => mh.repair_cnt > 0 },
];

/** 모듈 간 통신용 이벤트 (document 에서 발생, main.js 에서 연결) */
export const EVENTS = {
    SELECT: 'dmms:manhole-select',   // detail: { id }       지도에서 맨홀 선택 (해제 시 id = null)
    DETAIL: 'dmms:manhole-detail',   // detail: { manhole }  맨홀 팝업의 상세보기
    FILTER: 'dmms:manhole-filter',   // detail: { ids }      지도 마커 필터 (해제 시 ids = null)
};

/**
 * 상단 메뉴 (데스크탑 드롭다운 · 모바일 메뉴 공용)
 *   type 'pdf'       → manuals/{key}.pdf 를 바로 연다
 *   type 'equipment' → equipment_data.json 의 {key} 표 (사용매뉴얼 = manuals/{key}.pdf)
 */
export const MENUS = [
    {
        title: '점검업무',
        items: [
            { key: 'inspection_6m', label: '6개월 검사표', type: 'pdf' },
        ],
    },
    {
        title: '장비관리',
        items: [
            { key: 'gas_detector', label: '복합가스측정기', type: 'equipment' },
            { key: 'emergency_rescue', label: '삼각구조대', type: 'equipment' },
            { key: 'air_respirator', label: '공기호흡기', type: 'equipment' },
        ],
    },
    {
        title: '안전작업',
        items: [
            { key: 'confined_space_program', label: '밀폐공간 작업프로그램', type: 'pdf' },
            { key: 'work_permit', label: '작업허가서', type: 'pdf' },
            { key: 'cpr', label: '인공호흡 및 심폐소생술', type: 'pdf' },
            { key: 'related_laws', label: '관계법령', type: 'pdf' },
        ],
    },
];

/** AI 챗봇 모델 (Google Generative AI) */
export const AI_MODEL = 'gemma-3-27b-it';
