import requests
import pandas as pd
from urllib.parse import unquote
import time

# 1. API 설정
url = 'http://www.safetydata.go.kr/V2/api/DSSP-IF-00117'
service_key = unquote('8X1JX1NIW9DT3BE7') # 발급받은 키
rows_per_page = 1000  # 성능 최적화를 위한 최대 호출 단위

all_daegu_data = []

# 2. 전체 개수 파악
params = {
    'serviceKey': service_key,
    'returnType': 'json',
    'pageNo': '1',
    'numOfRows': '1'
}

try:
    response = requests.get(url, params=params)
    res_data = response.json()
    total_count = res_data.get('totalCount', 0)
    total_pages = (total_count // rows_per_page) + 1
    print(f"시스템 연결 성공: 전체 {total_count}건 데이터를 분석합니다.")

    # 3. 페이지 루프 (Dump 시작)
    for page in range(1, total_pages + 1):
        params['pageNo'] = str(page)
        params['numOfRows'] = str(rows_per_page)
        
        res = requests.get(url, params=params)
        if res.status_code == 200:
            items = res.json().get('body', [])
            
            # 명세서의 'STDG_CTPV_CD' (시도코드) 활용 필터링
            for item in items:
                # 대구 광역시 코드인 '27' 확인 (문자열 또는 숫자 대응)
                if str(item.get('STDG_CTPV_CD')) == '27':
                    all_daegu_data.append(item)
            
            print(f"분석 중... {page}/{total_pages} 페이지 완료 (대구 데이터 {len(all_daegu_data)}건 누적)")
        
        time.sleep(0.1) # 서버 부하 방지용 매너 타임

    # 4. CSV 저장
    if all_daegu_data:
        df = pd.DataFrame(all_daegu_data)
        # 명세서의 한글 필드명으로 컬럼명 변경 (선택사항)
        column_map = {
            'SN': '일련번호', 'FLDN_DOWA': '침수수심', 'FLDN_GRD': '침수등급',
            'FLDN_AREA': '침수면적', 'FLDN_YR': '침수연도', 'FLDN_DST_NM': '침수재해명',
            'FLDN_CS_DTL_NM': '침수원인상세명', 'FLDN_BGNG_YMD': '침수시작일자',
            'STDG_CTPV_CD': '시도코드', 'STDG_SGG_CD': '시군구코드', 'GEOM': '지오메트리'
        }
        df.rename(columns=column_map, inplace=True)
        df.to_csv("daegu_flood_history_all.csv", index=False, encoding='utf-8-sig')
        print(f"\n✅ 완료: 대구 지역 {len(all_daegu_data)}건의 침수 사실 데이터를 저장했습니다.")
    else:
        print("\n❌ 검색 조건에 맞는 대구 데이터가 없습니다.")

except Exception as e:
    print(f"실행 오류: {e}")