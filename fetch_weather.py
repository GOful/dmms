import requests
import json
import urllib3
from datetime import datetime, timedelta

# SSL 경고 무시
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def fetch_and_save_as_json():
    auth_key = "-MBhNUogT9uAYTVKIL_bWA"
    
    # 1. 현재 시간과 12분 전 시간 계산
    now = datetime.now()
    twelve_minutes_ago = now - timedelta(minutes=12)
    
    # API 형식에 맞게 변환 (YYYYMMDDHHMM)
    tm2 = now.strftime('%Y%m%d%H%M')
    tm1 = twelve_minutes_ago.strftime('%Y%m%d%H%M')
    
    print(f"조회 기간: {tm1} ~ {tm2}")
    
    # 2. 동적으로 생성된 시간을 URL에 적용
    url = (
        f"https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-sfc_obs_nc_pt_api?"
        f"obs=ta&tm1={tm1}&tm2={tm2}&itv=10&lon=126.5329&lat=33.361&authKey={auth_key}"
    )
    
    try:
        response = requests.get(url, verify=False)
        if response.status_code != 200:
            print(f"API 요청 실패: {response.status_code}")
            return

        lines = response.text.strip().split('\n')
        headers = []
        data_rows = []

        for line in lines:
            line = line.strip()
            if not line or "77777" in line: continue

            if line.startswith('#'):
                raw_headers = line.replace('#', '').strip().split(',')
                headers = [h.strip() for h in raw_headers if h.strip() and h.strip() != '=']
            else:
                raw_row = line.split(',')
                row = [r.strip() for r in raw_row if r.strip() and r.strip() != '=']
                
                if len(row) == len(headers):
                    data_rows.append(dict(zip(headers, row)))

        # 결과 저장
        with open("weather_data.json", "w", encoding="utf-8") as f:
            json.dump(data_rows, f, ensure_ascii=False, indent=4)
        
        print(f"성공! {len(data_rows)}개의 데이터를 가공하여 저장했습니다.")
        if data_rows:
            print("최신 데이터 샘플:", data_rows[-1]) # 가장 최근 데이터 출력

    except Exception as e:
        print(f"오류 발생: {e}")

if __name__ == "__main__":
    fetch_and_save_as_json()