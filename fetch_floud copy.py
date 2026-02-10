import requests
import pandas as pd
from urllib.parse import unquote
import time

# 1. API 설정
url = 'http://www.safetydata.go.kr/V2/api/DSSP-IF-00117'
service_key = unquote('8X1JX1NIW9DT3BE7')
rows_per_page = 1000  # 서버에 무리가 가지 않는 선에서 최대치 설정

all_data_list = []

# 2. 전체 개수 다시 확인
params = {
    'serviceKey': service_key,
    'returnType': 'json',
    'pageNo': '1',
    'numOfRows': '1'
}

try:
    response = requests.get(url, params=params)
    total_count = response.json().get('totalCount', 0)
    total_pages = (total_count // rows_per_page) + 1
    print(f"🚀 전체 데이터 다운로드 시작: 총 {total_count}건 (예상 호출: {total_pages}회)")

    # 3. 전체 페이지 루프
    for page in range(1, total_pages + 1):
        params['pageNo'] = str(page)
        params['numOfRows'] = str(rows_per_page)
        
        res = requests.get(url, params=params)
        if res.status_code == 200:
            items = res.json().get('body', [])
            all_data_list.extend(items) # 리스트에 통째로 추가
            print(f"📥 데이터 수집 중... {page}/{total_pages} 완료 (누적: {len(all_data_list)}건)")
        
        # 서버 매너: 과도한 트래픽 방지를 위해 아주 잠깐 쉽니다.
        time.sleep(0.1)

    # 4. CSV 파일로 저장
    if all_data_list:
        df = pd.DataFrame(all_data_list)
        # 엑셀에서 한글이 깨지지 않도록 utf-8-sig 인코딩 사용
        df.to_csv("all_flood_trace_data.csv", index=False, encoding='utf-8-sig')
        print(f"\n✅ [성공] 전체 {len(all_data_list)}건 데이터를 'all_flood_trace_data.csv'로 저장했습니다.")
    else:
        print("\n❌ 데이터를 가져오지 못했습니다.")

except Exception as e:
    print(f"에러 발생: {e}")