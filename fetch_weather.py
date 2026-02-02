import requests
import json
import os

def fetch_and_save_as_json():
    # GitHub Secrets에서 가져온 API 키 사용
    auth_key = os.environ.get('KMA_API_KEY')
    url = f"https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-sfc_obs_nc_pt_api?obs=ta&tm1=202306110000&tm2=202306110300&itv=10&lon=126.5329&lat=33.361&authKey={auth_key}"
    
    response = requests.get(url)
    if response.status_code != 200: return

    lines = response.text.strip().split('\n')
    headers = []
    data_rows = []
    
    for line in lines:
        if line.startswith('#'):
            headers = line.replace('#', '').split()
        elif not line.startswith('77777'):
            data_rows.append(line.split())

    json_data = [dict(zip(headers, row)) for row in data_rows if len(row) == len(headers)]

    with open("weather_data.json", "w", encoding="utf-8") as f:
        json.dump(json_data, f, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    fetch_and_save_as_json()