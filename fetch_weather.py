import requests
import json
import urllib3
import os
import time
from datetime import datetime, timedelta

# SSL 경고 무시
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

"""
기상청 APIHub를 통해 대구 지하철 역 인근의 실시간 기상 데이터를 수집하고
JSON 파일로 저장하는 스크립트입니다.
"""

def fetch_and_save_as_json():
    auth_key = "-MBhNUogT9uAYTVKIL_bWA"

    # 1. 수집 대상 지점 정의 (대구 지하철 역 좌표)
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

    # 2. 조회 시간 설정 (최근 30분 데이터 조회)
    now = datetime.now()
    # API는 약 10분 단위로 갱신되므로, 누락 방지를 위해 30분 전부터 현재까지 조회
    tm2 = now.strftime('%Y%m%d%H%M')
    tm1 = (now - timedelta(minutes=30)).strftime('%Y%m%d%H%M') # 30분 전부터 조회

    final_data_dict = {}
    print(f"[{now.strftime('%H:%M:%S')}] 총 {len(stations)}개 지점 데이터 수집 시작...")

    for station_name, coords in stations.items():
        url = (
            f"https://apihub.kma.go.kr/api/typ01/url/sfc_nc_var.php?"
            f"tm1={tm1}&tm2={tm2}&obs=ta,rn_ox,rn_60m,vs"
            f"&lon={coords['lon']}&lat={coords['lat']}&authKey={auth_key}"
        )
        
        try:
            # API 호출 (SSL 인증서 검증 무시, 타임아웃 5초)
            response = requests.get(url, verify=False, timeout=5)
            
            if response.status_code != 200:
                print(f" - {station_name}: API 호출 실패 (상태 코드: {response.status_code})")
                continue

            lines = response.text.strip().split('\n')
            
            # 3. 응답 데이터 파싱
            # API 응답이 텍스트 형식이므로 헤더를 직접 매핑 (순서: 시간, 기온, 강수유무, 강수량, 시정)
            headers = ['tm', 'ta', 'rn_ox', 'rn_60m', 'vs']

            # 최신 데이터부터 순회하며 유효한 첫 번째 데이터를 사용
            for line in lines:
                line = line.strip()
                # 주석('#'), 빈 줄, 결측값('77777', 'No data')은 무시합니다.
                if line.startswith('#') or not line or "77777" in line:
                    continue

                raw_row = line.split(',')
                row = [r.strip() for r in raw_row]
                
                if len(row) == len(headers):
                    item = dict(zip(headers, row))
                    # 필수 데이터 필드가 모두 존재하는지 검증
                    if all(k in item for k in ['ta', 'rn_ox', 'rn_60m', 'vs']):
                        final_data_dict[station_name] = {
                            "LAT": coords['lat'],
                            "LON": coords['lon'],
                            "TA": item.get('ta', 'N/A'),
                            "RN_OX": item.get('rn_ox', 'N/A'),
                            "RN_60M": item.get('rn_60m', 'N/A'),
                            "VS": item.get('vs', 'N/A')
                        }
                        # 유효 데이터를 찾으면 해당 역 처리를 종료하고 다음 역으로 이동
                        print(f" - {station_name}: 데이터 수집 성공")
                        break
            
            # API 서버 부하 방지를 위한 대기
            time.sleep(0.1)

        except Exception as e:
            print(f" - {station_name}: 수집 중 오류: {e}")


    # 4. 결과 JSON 파일 저장
    with open("weather_data.json", "w", encoding="utf-8") as f:
        json.dump(final_data_dict, f, ensure_ascii=False, indent=4)
    
    print(f"수집 완료: {len(final_data_dict)}개 데이터 저장됨.")

if __name__ == "__main__":
    fetch_and_save_as_json()