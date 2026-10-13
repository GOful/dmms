# DMMS · 대구교통공사 맨홀관리 시스템

전력케이블이 지나가는 도시철도 맨홀의 위치·이력(맨홀보수, 수위, 접속개소 침수)을 지도에서 확인하는 웹 서비스입니다.
GitHub Pages 로 배포되며, 별도 서버 없이 정적 파일 + GitHub Actions 만으로 동작합니다.

## 주요 기능

| 기능 | 설명 |
|---|---|
| 맨홀 지도 | 카카오맵 위에 노선별 색상 마커 표시, 클릭 시 정보 팝업 · 로드뷰 이동 |
| 맨홀 목록 | 사이드바에 노선 > 구간 > 맨홀 트리 |
| 상세정보 | 접속개소 침수 이력, 수위 통계(평균·최대·최저·최근), 연도별 수위 차트, 맨홀보수 사진, 연도별 이력 표 |
| 현재 날씨 | 기상청 실황(기온·강수) — 관리용 화면은 맨홀이 있는 기상청 500m 격자 칸 단위 |
| AI 대화 | "침수 3회 이상인 곳 표시해줘" 같은 질문 → 지도에 해당 맨홀 표시 |
| 업무 메뉴 | 점검표 · 장비관리 · 안전작업 문서(PDF) |

## 화면 모드

| 주소 | 모드 | 데이터 |
|---|---|---|
| `index.html?mode=demo` | 시연용 | 예시 데이터 (`*.json`) |
| `index.html?mode=admin` | 관리용 (로그인 필요) | 실제 데이터 (`*.admin.json`) |

- `?mode` 없이 접속하면 로그인 페이지(`login.html`)로 이동합니다.
- 로컬 개발 환경(localhost)에서는 로그인 없이 관리용 화면에 들어갈 수 있습니다.

## 폴더 구조

```
├─ index.html / login.html     화면 (레이아웃만, 동작은 js/)
├─ css/login.css               로그인 페이지 전용 스타일 (그 외는 Tailwind)
├─ js/
│  ├─ main.js                  진입점 — 모듈 초기화 및 연결
│  ├─ config.js                설정 (지도 위치, 노선 색상, 상단 메뉴, 이벤트 이름)
│  ├─ data.js                  데이터 로드 (모드별 *.json / *.admin.json)
│  ├─ utils.js                 공용 함수
│  ├─ ai.js                    AI 챗봇 (Google Generative AI)
│  ├─ mode.js · auth-guard.js  모드 판별 · 접근 제어 (화면보다 먼저 실행)
│  ├─ login.js                 로그인 페이지
│  ├─ tailwind.config.js       Tailwind 공용 설정
│  ├─ map/                     지도 — map(마커·선택·필터), manhole-popup, weather-layer, location
│  └─ ui/                      화면 — menu, modal, sidebar, manhole-detail, level-chart, equipment, pdf-viewer, chat
├─ scripts/                    데이터 처리 (Python, 표준 라이브러리 위주)
│  ├─ excel_io.py              엑셀 읽기·쓰기 공용
│  ├─ build_manhole_history.py 엑셀 → manhole_history.admin.json
│  ├─ infer_flood.py           최근 연도 접속개소 침수 여부를 수위로 판정해 엑셀에 기록
│  └─ fetch_weather.py         기상청 실황 → weather_data(.admin).json
├─ data/
│  ├─ 맨홀이력.xlsx             맨홀 이력 원본 (보수·수위·등급·비고)
│  └─ {연도}_repair/           맨홀보수 사진 ({구간}{번호}.png, 예: 만촌1.png)
├─ manholes(.admin).json       맨홀 위치 목록
├─ manhole_history.admin.json  엑셀에서 생성한 이력 데이터 (직접 수정하지 않음)
├─ equipment_data(.admin).json 장비 목록
└─ manuals/*.pdf               메뉴에서 여는 문서
```

### JS 모듈 연결 방식

지도와 사이드바·모달은 서로 직접 부르지 않고 `config.js` 의 `EVENTS` 이벤트로 주고받으며, `main.js` 가 둘을 연결합니다.

```
지도에서 맨홀 선택 ──(dmms:manhole-select)──▶ main ──▶ 사이드바 강조
팝업의 상세보기   ──(dmms:manhole-detail)──▶ main ──▶ 상세정보 모달
AI 지도 필터      ──(dmms:manhole-filter)──▶ main ──▶ 사이드바 필터
```

상단 메뉴 항목은 `config.js` 의 `MENUS` 한 곳에서 관리합니다 (데스크탑·모바일 메뉴 공용).

## 데이터 갱신

### 맨홀 이력 (엑셀)

1. `data/맨홀이력.xlsx` 를 수정합니다.
   - 시트 = 호선, 1행 = 연도, 2행 = 항목(보수/수위/등급/비고), 3행부터 맨홀 1개씩 (B열 구간, C열 번호)
   - 엑셀의 `구간 + 번호` 가 `manholes.admin.json` 의 맨홀 이름(`월배기지 #1`)과 연결됩니다.
2. 변환을 실행해 확인합니다. (배포 때도 자동 실행되므로 엑셀만 push 해도 반영됩니다)
   ```bash
   python scripts/build_manhole_history.py
   ```
   연결되지 않은 맨홀·사진이 있으면 `[경고]` 로 알려줍니다.

### 맨홀보수 사진

`data/{연도}_repair/{구간}{번호}.png` 로 넣으면 해당 연도 이력에 자동으로 붙습니다. (예: `data/2026_repair/방촌6.png`)

### 최근 연도 침수 판정

비고가 없는 연도는 2020~2022년 기록과 수위를 비교해 접속개소 침수 여부를 엑셀에 기록할 수 있습니다.
판정 원리와 규칙은 `scripts/infer_flood.py` 상단 설명을 참고하세요.

```bash
python scripts/infer_flood.py            # 미리보기
python scripts/infer_flood.py --apply    # 엑셀에 기록 (Excel 을 닫고 실행)
python scripts/infer_flood.py --report   # 맨홀별 판단 근거 CSV (로컬 검토용)
```

### 날씨

배포 워크플로가 매시간 `scripts/fetch_weather.py` 를 실행합니다. 관리용 맨홀 위치가 바뀌면 날씨 격자도 다음 갱신 때 자동으로 맞춰집니다.

## 로컬 실행

```bash
python -m http.server 8000
# http://localhost:8000/login.html
```

- 지도: 카카오 개발자 콘솔에 `localhost` 도메인이 등록되어 있어야 표시됩니다.
- 날씨: `.env` 에 `KMA_API_KEY=...` 를 넣고 `python scripts/fetch_weather.py` (`pip install requests python-dotenv`)
- AI 대화: `js/apikey.js` 에 `export const GOOGLE_API_KEY = '...';` (git 에 올리지 않음)

## 배포 (GitHub Actions → GitHub Pages)

`.github/workflows/deploy.yml` 이 `main` push · 매시간 · 수동 실행 때 다음을 수행합니다.

1. Secrets 로 `js/apikey.js`(AI 키), `js/auth-config.js`(관리자 비밀번호 해시) 생성
2. 엑셀 → `manhole_history.admin.json` 변환
3. 기상청 날씨 수집
4. Pages 배포

| Secret | 용도 |
|---|---|
| `GOOGLE_API_KEY` | AI 챗봇 |
| `SITE_PASSWORD` | 관리자 로그인 비밀번호 (평문은 Secrets 에만, 사이트에는 PBKDF2 해시만 배포) |
| `KMA_API_KEY` | 기상청 API허브 |

> **주의** — 저장소에 **60일간 커밋이 없으면 GitHub 가 이 워크플로를 자동으로 끕니다.**
> 그러면 날씨 갱신과 배포가 모두 멈추므로, Actions 화면에서 *Deploy to GitHub Pages* → *Enable workflow* 를 눌러 다시 켜세요.

배포 후 화면이 바뀌지 않으면 브라우저에서 강력 새로고침(Ctrl+F5)을 하세요.
