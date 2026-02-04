import requests
import json
import urllib3
import time
from datetime import datetime, timedelta
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# SSL 경고 무시
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def fetch_and_save_as_json():
    auth_key = "-MBhNUogT9uAYTVKIL_bWA"
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

    # 세션 관리 및 재시도 로직 (443 에러 방지)
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
    session.mount("https://", HTTPAdapter(max_retries=retries))

    now = datetime.now()
    tm2 = now.strftime('%Y%m%d%H%M')
    tm1 = (now - timedelta(minutes=30)).strftime('%Y%m%d%H%M')

    final_data_dict = {}
    print(f"[{now.strftime('%H:%M:%S')}] 데이터 수집 및 Raw Data 출력 시작...\n")

    for station_name, coords in stations.items():
        url = (
            f"https://apihub.kma.go.kr/api/typ01/url/sfc_nc_var.php?"
            f"tm1={tm1}&tm2={tm2}&obs=ta,rn_ox,rn_60m,vs"
            f"&lon={coords['lon']}&lat={coords['lat']}&authKey={auth_key}"
        )
        
        try:
            # 타임아웃을 넉넉히 주어 연결 안정성 확보
            response = session.get(url, verify=False, timeout=(5, 10))
            
            # --- 터미널에 Raw Data 출력 영역 ---
            print(f"DEBUG [{station_name}] Response Status: {response.status_code}")
            print(f"DEBUG [{station_name}] URL: {url}")
            print(f"--- Raw Data Start ---")
            print(response.text.strip())
            print(f"--- Raw Data End ---\n")
            # -----------------------------------

            if response.status_code != 200:
                continue

            lines = response.text.strip().split('\n')
            headers = ['tm', 'ta', 'rn_ox', 'rn_60m', 'vs']

            for line in lines:
                line = line.strip()
                if line.startswith('#') or not line or "77777" in line:
                    continue

                raw_row = line.split(',')
                row = [r.strip() for r in raw_row]
                
                if len(row) == len(headers):
                    item = dict(zip(headers, row))
                    final_data_dict[station_name] = {
                        "LAT": coords['lat'],
                        "LON": coords['lon'],
                        "TA": item.get('ta'),
                        "RN_OX": item.get('rn_ox'),
                        "RN_60M": item.get('rn_60m'),
                        "VS": item.get('vs')
                    }
                    break
            
            time.sleep(0.5) # 서버 부하 방지 및 안정적인 출력을 위해 0.5초 대기

        except Exception as e:
            print(f"ERROR [{station_name}]: {e}\n")

    with open("weather_data.json", "w", encoding="utf-8") as f:
        json.dump(final_data_dict, f, ensure_ascii=False, indent=4)
    
    print(f"최종 수집 완료: {len(final_data_dict)}개 지점 데이터 저장됨.")

if __name__ == "__main__":
    fetch_and_save_as_json()