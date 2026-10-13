"""
기상청 실황(기온·강수·시정) 수집 → 지도 날씨 데이터 생성

    python scripts/fetch_weather.py      (환경변수 또는 .env 의 KMA_API_KEY 필요)

배포(GitHub Actions) 때 매시간 실행되어 Pages 에만 포함된다 (커밋하지 않음).
    weather_data.json        시연용 화면 — 역 기준 고정 지점
    weather_data.admin.json  관리용 화면 — 맨홀이 있는 기상청 500m 격자 칸 + 구간별 라벨

API: 기상청 API허브 sfc_nc_var (지점 좌표가 속한 500m 격자의 실황 값을 반환)
"""
import json
import math
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path

import requests
import urllib3
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

ROOT = Path(__file__).resolve().parent.parent
ADMIN_MANHOLES_PATH = ROOT / 'manholes.admin.json'
API_URL = 'https://apihub.kma.go.kr/api/typ01/url/sfc_nc_var.php'
OBS_FIELDS = ('ta', 'rn_ox', 'rn_day', 'vs')   # 기온, 강수 유무, 일강수량, 시정
LOOKBACK_MIN = 12                              # 최근 몇 분 안의 관측값을 조회할지
GRID_KM = 0.5                                  # 기상청 실황 격자 해상도
LABEL_MERGE_M = 1000                           # 중심점이 이보다 가까운 구간은 지도 라벨을 하나로 합침

# 시연용 지점 (역 좌표)
DEMO_STATIONS = {
    '설화명곡역': (35.7986, 128.4894), '상인역': (35.8186, 128.5369), '서부정류장역': (35.8362, 128.5584),
    '용계역': (35.8765, 128.6826), '안심역': (35.8719, 128.7330), '중앙로역': (35.8714, 128.5945),
    '동대구역': (35.8780, 128.6275), '부호역': (35.8998, 128.8034), '하양역': (35.9127, 128.8184),
    '문양역': (35.8644, 128.4385), '신매역': (35.8411, 128.7053), '성서산업단지역': (35.8518, 128.5073),
    '수성알파시티역': (35.8425, 128.6805), '반고개역': (35.8627, 128.5734), '반월당역': (35.8648, 128.5938),
    '범어역': (35.8601, 128.6256), '만촌역': (35.8533, 128.6507), '임당역': (35.8345, 128.7415),
    '영남대역': (35.8377, 128.7544),
}

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)


# ── 기상청 격자 좌표계 (람베르트 정각원추도법, 동네예보와 같은 투영 · 간격 500m) ──

_RE, _SLAT1, _SLAT2, _OLON, _OLAT = 6371.00877, 30.0, 60.0, 126.0, 38.0
_D = math.pi / 180
_SN = math.log(math.cos(_SLAT1 * _D) / math.cos(_SLAT2 * _D)) / math.log(
    math.tan(math.pi / 4 + _SLAT2 * _D / 2) / math.tan(math.pi / 4 + _SLAT1 * _D / 2))
_SF = math.tan(math.pi / 4 + _SLAT1 * _D / 2) ** _SN * math.cos(_SLAT1 * _D) / _SN
_RE_G = _RE / GRID_KM
_RO = _RE_G * _SF / math.tan(math.pi / 4 + _OLAT * _D / 2) ** _SN


def to_grid(lat, lon):
    """위경도 → 격자 좌표 (실수, 1 = 500m)"""
    ra = _RE_G * _SF / math.tan(math.pi / 4 + lat * _D / 2) ** _SN
    theta = (lon - _OLON) * _D * _SN
    return ra * math.sin(theta), _RO - ra * math.cos(theta)


def from_grid(x, y):
    """격자 좌표 → 위경도"""
    dy = _RO - y
    ra = math.copysign(math.hypot(x, dy), _SN)
    lat = 2 * math.atan((_RE_G * _SF / ra) ** (1 / _SN)) - math.pi / 2
    return lat / _D, math.atan2(x, dy) / _SN / _D + _OLON


def distance_m(lat1, lon1, lat2, lon2):
    """두 좌표 사이 거리 (m, 하버사인)"""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    h = (math.sin((p2 - p1) / 2) ** 2
         + math.cos(p1) * math.cos(p2) * math.sin(math.radians(lon2 - lon1) / 2) ** 2)
    return 2 * 6371000 * math.asin(math.sqrt(h))


# ── 관리용 격자 계산 ─────────────────────────────────────

def build_admin_grid():
    """맨홀이 들어 있는 500m 격자 칸과 구간별 라벨 정보를 계산한다.

    반환: (cells, sections)
        cells    {'x,y': {'lat', 'lon', 'corners', 'sections'}}   칸마다 날씨를 1회 조회
        sections [{'name', 'lat', 'lon', 'cells'}]                지도 라벨 (가까운 구간은 합침)
    """
    data = json.loads(ADMIN_MANHOLES_PATH.read_text(encoding='utf-8'))
    cells, groups = {}, []

    for line in data['lines']:
        for station in line['stations']:
            name = station['stationName']
            coords = [(m['lat'], m['lng']) for m in station['manholes']]
            if not coords:
                continue

            keys = set()
            for lat, lon in coords:
                x, y = to_grid(lat, lon)
                ix, iy = math.floor(x + 0.5), math.floor(y + 0.5)
                key = f'{ix},{iy}'
                if key not in cells:
                    clat, clon = from_grid(ix, iy)
                    cells[key] = {
                        'lat': round(clat, 6), 'lon': round(clon, 6),
                        'corners': [[round(v, 6) for v in from_grid(ix + dx, iy + dy)]
                                    for dx, dy in ((-.5, -.5), (.5, -.5), (.5, .5), (-.5, .5))],
                        'sections': [],
                    }
                if name not in cells[key]['sections']:
                    cells[key]['sections'].append(name)
                keys.add(key)

            center = (sum(c[0] for c in coords) / len(coords), sum(c[1] for c in coords) / len(coords))
            group = next((g for g in groups if distance_m(*center, *g['center']) < LABEL_MERGE_M), None)
            if group:
                group['names'].append(name)
                group['coords'] += coords
                group['cells'] |= keys
                n = len(group['coords'])
                group['center'] = (sum(c[0] for c in group['coords']) / n, sum(c[1] for c in group['coords']) / n)
            else:
                groups.append({'names': [name], 'coords': coords, 'cells': keys, 'center': center})

    sections = [{'name': '·'.join(g['names']), 'lat': round(g['center'][0], 6), 'lon': round(g['center'][1], 6),
                 'cells': sorted(g['cells'])} for g in groups]
    return cells, sections


# ── 기상청 API ──────────────────────────────────────────

def create_session():
    session = requests.Session()
    retries = Retry(total=3, backoff_factor=1, status_forcelist=[429, 500, 502, 503, 504])
    session.mount('https://', HTTPAdapter(max_retries=retries))
    return session


def fetch_point(session, auth_key, lat, lon, now):
    """한 지점의 최근 실황 → {'TM'(관측시각 YYYYMMDDHHMM), 'TA', 'RN_OX', 'RN_DAY', 'VS'} (값이 없으면 None)"""
    params = {
        'tm1': (now - timedelta(minutes=LOOKBACK_MIN)).strftime('%Y%m%d%H%M'),
        'tm2': now.strftime('%Y%m%d%H%M'),
        'obs': ','.join(OBS_FIELDS), 'lat': lat, 'lon': lon, 'authKey': auth_key,
    }
    res = session.get(API_URL, params=params, verify=False, timeout=(5, 10))
    res.raise_for_status()

    # 응답: '#' 주석 줄 + 'YYYYMMDDHHMM, ta, rn_ox, rn_day, vs' 줄들 (결측 -999)
    latest = None
    for line in res.text.splitlines():
        row = [v.strip() for v in line.split(',')]
        if len(row) == 1 + len(OBS_FIELDS) and row[0].isdigit() and _is_observed(row[1]):
            latest = row
    if latest is None:
        return None
    return dict(zip(('TM', 'TA', 'RN_OX', 'RN_DAY', 'VS'), latest))


def _is_observed(value):
    """결측(-999)이 아닌 숫자인지"""
    try:
        return float(value) > -90
    except ValueError:
        return False


def fetch_all(session, auth_key, points, now):
    """{이름: (lat, lon)} → {이름: {'LAT', 'LON', 'TA', ...}} (실패한 지점은 제외)"""
    result = {}
    for name, (lat, lon) in points.items():
        try:
            obs = fetch_point(session, auth_key, lat, lon, now)
            if obs:
                result[name] = {'LAT': lat, 'LON': lon, **obs}
            else:
                print(f'[누락] {name}: 최근 {LOOKBACK_MIN}분 관측값 없음')
        except (requests.RequestException, ValueError) as e:
            print(f'[오류] {name}: {e}')
        time.sleep(0.5)  # API 서버 부하 방지
    return result


def save_json(name, data, count):
    (ROOT / name).write_text(json.dumps(data, ensure_ascii=False, indent=4), encoding='utf-8')
    print(f'[완료] {name} — {count}개 지점')


def main():
    _load_dotenv()
    auth_key = os.getenv('KMA_API_KEY')
    if not auth_key:
        print('[오류] KMA_API_KEY 가 없습니다 (환경변수 또는 .env).')
        return 1

    session = create_session()
    now = datetime.now()

    demo = fetch_all(session, auth_key, DEMO_STATIONS, now)
    save_json('weather_data.json', demo, len(demo))

    cells, sections = build_admin_grid()
    weather = fetch_all(session, auth_key, {k: (c['lat'], c['lon']) for k, c in cells.items()}, now)
    for key, w in weather.items():
        w['CORNERS'] = cells[key]['corners']
        w['SECTIONS'] = cells[key]['sections']
    save_json('weather_data.admin.json',
              {'grid_m': int(GRID_KM * 1000), 'cells': weather, 'sections': sections}, len(weather))
    return 0


def _load_dotenv():
    """로컬 실행 시 .env 를 읽는다 (python-dotenv 가 없으면 생략)"""
    try:
        from dotenv import load_dotenv
    except ImportError:
        return
    load_dotenv(ROOT / '.env')


if __name__ == '__main__':
    sys.exit(main())
