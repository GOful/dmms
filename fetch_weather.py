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

    # 1. 대구 지하철 역 위경도 데이터
    stations = {
        "대구역": {"lat": 35.8759, "lon": 128.5961},
        "중앙로역": {"lat": 35.8711, "lon": 128.5939},
        "반월당역(1호선)": {"lat": 35.8647, "lon": 128.5933},
        "명덕역": {"lat": 35.8578, "lon": 128.5910},
        "교대역": {"lat": 35.8502, "lon": 128.5908},
        "상인역": {"lat": 35.8188, "lon": 128.5367},
        "월촌역": {"lat": 35.8242, "lon": 128.5442},
        "성당못역": {"lat": 35.8358, "lon": 128.5583},
        "대명역": {"lat": 35.8395, "lon": 128.5645},
        "안지랑역": {"lat": 35.8443, "lon": 128.5703},
        "범어역": {"lat": 35.8589, "lon": 128.6247},
        "대구은행역": {"lat": 35.8602, "lon": 128.6152},
        "경대병원역": {"lat": 35.8631, "lon": 128.6033},
        "청라언덕역": {"lat": 35.8643, "lon": 128.5833},
        "반고개역": {"lat": 35.8625, "lon": 128.5710},
        "내당역": {"lat": 35.8602, "lon": 128.5613},
        "두류역": {"lat": 35.8572, "lon": 128.5528},
        "감삼역": {"lat": 35.8528, "lon": 128.5435},
        "죽전역": {"lat": 35.8488, "lon": 128.5335},
        "용산역": {"lat": 35.8505, "lon": 128.5235}
    }

    # 시간 설정
    now = datetime.now()
    tm2 = now.strftime('%Y%m%d%H%M')
    tm1 = (now - timedelta(minutes=20)).strftime('%Y%m%d%H%M')

    final_data_dict = {}
    print(f"[{now.strftime('%H:%M:%S')}] 총 {len(stations)}개 지점 데이터 수집 시작...")

    for station_name, coords in stations.items():
        url = (
            f"https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-sfc_obs_nc_pt_api?"
            f"obs=ta&tm1={tm1}&tm2={tm2}&itv=10"
            f"&lon={coords['lon']}&lat={coords['lat']}&authKey={auth_key}"
        )
        
        try:
            # 타임아웃을 5초로 설정
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
                        final_data_dict[station_name] = item
                        break 
            
            # API 서버 부하 방지
            time.sleep(0.1)

        except Exception as e:
            print(f"{station_name} 수집 중 오류: {e}")

    # 결과 저장
    with open("weather_data.json", "w", encoding="utf-8") as f:
        json.dump(final_data_dict, f, ensure_ascii=False, indent=4)
    
    print(f"수집 완료: {len(final_data_dict)}개 데이터 저장됨.")

if __name__ == "__main__":
    fetch_and_save_as_json()