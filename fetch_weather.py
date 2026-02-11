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
    "설화명곡역": {"lat": 35.7986, "lon": 128.4894},
    "상인역": {"lat": 35.8186, "lon": 128.5369},
    "서부정류장역": {"lat": 35.8362, "lon": 128.5584},
    "용계역": {"lat": 35.8765, "lon": 128.6826},
    "안심역": {"lat": 35.8719, "lon": 128.7330},
    "중앙로역": {"lat": 35.8714, "lon": 128.5945},
    "동대구역": {"lat": 35.8780, "lon": 128.6275},
    "부호역": {"lat": 35.8998, "lon": 128.8034},
    "하양역": {"lat": 35.9127, "lon": 128.8184},
    "문양역": {"lat": 35.8644, "lon": 128.4385},
    "신매역": {"lat": 35.8411, "lon": 128.7053},
    "성서산업단지역": {"lat": 35.8518, "lon": 128.5073},
    "수성알파시티역": {"lat": 35.8425, "lon": 128.6805},
    "반고개역": {"lat": 35.8627, "lon": 128.5734},
    "반월당역": {"lat": 35.8648, "lon": 128.5938},
    "범어역": {"lat": 35.8601, "lon": 128.6256},
    "만촌역": {"lat": 35.8533, "lon": 128.6507},
    "임당역": {"lat": 35.8345, "lon": 128.7415},
    "영남대역": {"lat": 35.8377, "lon": 128.7544}
    }

    # 세션 관리 및 재시도 로직 (443 에러 방지)
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
    session.mount("https://", HTTPAdapter(max_retries=retries))

    now = datetime.now()
    tm2 = now.strftime('%Y%m%d%H%M')
    tm1 = (now - timedelta(minutes=12)).strftime('%Y%m%d%H%M')

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