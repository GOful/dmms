import requests
import json
import urllib3
import os
import time
from datetime import datetime, timedelta

# SSL 경고 무시
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def fetch_and_save_as_json():
    auth_key = os.environ.get('KMA_API_KEY')
    if not auth_key:
        print("오류: API 키가 설정되지 않았습니다.")
        return

    # 1. 특정 50개 지역 위경도 데이터 (주요 도시 및 거점 관측소)
    locations = [
        {"name": "서울", "lon": 126.965, "lat": 37.571},
        {"name": "인천", "lon": 126.624, "lat": 37.477},
        {"name": "수원", "lon": 127.012, "lat": 37.272},
        {"name": "파주", "lon": 126.766, "lat": 37.885},
        {"name": "강화", "lon": 126.446, "lat": 37.746},
        {"name": "춘천", "lon": 127.730, "lat": 37.902},
        {"name": "원주", "lon": 127.946, "lat": 37.337},
        {"name": "강릉", "lon": 128.890, "lat": 37.751},
        {"name": "속초", "lon": 128.591, "lat": 38.250},
        {"name": "동해", "lon": 129.114, "lat": 37.507},
        {"name": "철원", "lon": 127.304, "lat": 38.147},
        {"name": "대전", "lon": 127.374, "lat": 36.371},
        {"name": "청주", "lon": 127.441, "lat": 36.639},
        {"name": "충주", "lon": 127.908, "lat": 36.970},
        {"name": "천안", "lon": 127.113, "lat": 36.776},
        {"name": "서산", "lon": 126.493, "lat": 36.776},
        {"name": "보령", "lon": 126.554, "lat": 36.326},
        {"name": "전주", "lon": 127.118, "lat": 35.840},
        {"name": "군산", "lon": 126.716, "lat": 35.975},
        {"name": "목포", "lon": 126.381, "lat": 34.817},
        {"name": "여수", "lon": 127.730, "lat": 34.736},
        {"name": "순천", "lon": 127.501, "lat": 34.945},
        {"name": "광주", "lon": 126.851, "lat": 35.155},
        {"name": "대구", "lon": 128.624, "lat": 35.877},
        {"name": "안동", "lon": 128.711, "lat": 36.574},
        {"name": "포항", "lon": 129.379, "lat": 36.032},
        {"name": "경주", "lon": 129.210, "lat": 35.837},
        {"name": "구미", "lon": 128.319, "lat": 36.130},
        {"name": "울릉도", "lon": 130.898, "lat": 37.484},
        {"name": "독도", "lon": 131.866, "lat": 37.239},
        {"name": "부산", "lon": 129.075, "lat": 35.179},
        {"name": "울산", "lon": 129.332, "lat": 35.538},
        {"name": "창원", "lon": 128.673, "lat": 35.228},
        {"name": "진주", "lon": 128.115, "lat": 35.191},
        {"name": "통영", "lon": 128.435, "lat": 34.845},
        {"name": "거제", "lon": 128.604, "lat": 34.888},
        {"name": "제주", "lon": 126.532, "lat": 33.361},
        {"name": "서귀포", "lon": 126.561, "lat": 33.246},
        {"name": "고산", "lon": 126.162, "lat": 33.293},
        {"name": "성산", "lon": 126.880, "lat": 33.386},
        {"name": "백령도", "lon": 124.630, "lat": 37.966},
        {"name": "흑산도", "lon": 125.435, "lat": 34.686},
        {"name": "진도", "lon": 126.257, "lat": 34.481},
        {"name": "완도", "lon": 126.698, "lat": 34.316},
        {"name": "고흥", "lon": 127.275, "lat": 34.618},
        {"name": "광양", "lon": 127.691, "lat": 34.943},
        {"name": "양산", "lon": 129.029, "lat": 35.343},
        {"name": "김해", "lon": 128.879, "lat": 35.233},
        {"name": "밀양", "lon": 128.744, "lat": 35.491},
        {"name": "의령", "lon": 128.261, "lat": 35.322}
    ]

    # 시간 설정
    now = datetime.now()
    tm2 = now.strftime('%Y%m%d%H%M')
    tm1 = (now - timedelta(minutes=20)).strftime('%Y%m%d%H%M')

    final_data_list = []
    print(f"[{now.strftime('%H:%M:%S')}] 총 {len(locations)}개 지점 데이터 수집 시작...")

    for loc in locations:
        url = (
            f"https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-sfc_obs_nc_pt_api?"
            f"obs=ta&tm1={tm1}&tm2={tm2}&itv=10"
            f"&lon={loc['lon']}&lat={loc['lat']}&authKey={auth_key}"
        )
        
        try:
            # 50번 호출하므로 타임아웃을 5초로 짧게 설정
            response = requests.get(url, verify=False, timeout=5)
            if response.status_code != 200: continue

            lines = response.text.strip().split('\n')
            headers = []
            
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
                        item = dict(zip(headers, row))
                        item['LOCATION_NAME'] = loc['name'] # 지정한 한글 이름 추가
                        final_data_list.append(item)
                        break 
            
            # API 서버 부하 방지
            time.sleep(0.1)

        except Exception as e:
            print(f"{loc['name']} 수집 중 오류: {e}")

    # 결과 저장
    with open("weather_data.json", "w", encoding="utf-8") as f:
        json.dump(final_data_list, f, ensure_ascii=False, indent=4)
    
    print(f"수집 완료: {len(final_data_list)}개 데이터 저장됨.")

if __name__ == "__main__":
    fetch_and_save_as_json()