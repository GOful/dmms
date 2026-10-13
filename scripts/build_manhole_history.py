"""
data/맨홀이력.xlsx → manhole_history.admin.json 변환 스크립트

엑셀이 원본(Source of Truth)이며, 엑셀을 수정한 뒤 이 스크립트를 다시 실행하면 웹에 반영된다.
    python scripts/build_manhole_history.py

- 외부 패키지 없이 표준 라이브러리만 사용 (xlsx = zip + xml)
- 맨홀 매칭: 엑셀 '구간' + '번호' → manholes.admin.json 의 name ("월배기지 #1")
- 침수 판정: 비고에 '침수'가 포함된 연도 (전력케이블 접속개소 침수 기록)
- 보수 사진: data/{연도}_repair/{구간}{번호}.png
"""
import json
import os
import re
import sys
import zipfile
import xml.etree.ElementTree as ET
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
XLSX_PATH = os.path.join(ROOT, 'data', '맨홀이력.xlsx')
MANHOLES_PATH = os.path.join(ROOT, 'manholes.admin.json')
OUTPUT_PATH = os.path.join(ROOT, 'manhole_history.admin.json')

NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}
INFER_TAG = '(수위추정)'  # scripts/infer_flood.py 가 기록한 비고 표시
FIELD_NAMES = {'보수': 'repair', '수위': 'level', '등급': 'grade', '비고': 'note'}


def col_index(col):
    """'AB' → 27 (0-based)"""
    n = 0
    for ch in col:
        n = n * 26 + (ord(ch) - 64)
    return n - 1


def read_sheets(path):
    """{시트명: {행번호: {열문자: 값}}} 형태로 모든 셀 값을 읽는다."""
    z = zipfile.ZipFile(path)
    shared = []
    if 'xl/sharedStrings.xml' in z.namelist():
        for si in ET.fromstring(z.read('xl/sharedStrings.xml')).findall('m:si', NS):
            shared.append(''.join(t.text or '' for t in si.iter(f"{{{NS['m']}}}t")))

    rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {r.get('Id'): r.get('Target') for r in rels}
    workbook = ET.fromstring(z.read('xl/workbook.xml'))

    sheets = {}
    for s in workbook.find('m:sheets', NS):
        target = rel_map[s.get(f"{{{NS['r']}}}id")].lstrip('/')
        if not target.startswith('xl/'):
            target = 'xl/' + target
        rows = {}
        for row in ET.fromstring(z.read(target)).iter(f"{{{NS['m']}}}row"):
            cells = {}
            for c in row.findall('m:c', NS):
                v = c.find('m:v', NS)
                if c.get('t') == 'inlineStr':
                    val = ''.join(t.text or '' for t in c.iter(f"{{{NS['m']}}}t"))
                elif v is None:
                    continue
                elif c.get('t') == 's':
                    val = shared[int(v.text)]
                else:
                    val = v.text
                val = val.strip() if isinstance(val, str) else val
                if val != '':
                    cells[re.match(r'[A-Z]+', c.get('r')).group()] = val
            rows[int(row.get('r'))] = cells
        sheets[s.get('name')] = rows
    return sheets


def parse_columns(rows):
    """1행(연도, 병합셀) + 2행(보수/수위/등급/비고)으로 {열문자: (연도, 필드)} 매핑을 만든다."""
    year_starts = sorted(
        ((col_index(col), int(float(v))) for col, v in rows.get(1, {}).items() if re.fullmatch(r'\d{4}(\.0)?', str(v))),
    )
    mapping = {}
    for col, header in rows.get(2, {}).items():
        field = FIELD_NAMES.get(header)
        if not field:
            continue
        idx = col_index(col)
        year = None
        for start, y in year_starts:
            if start <= idx:
                year = y
        if year is not None:
            mapping[col] = (year, field)
    return mapping


def to_number(v):
    try:
        f = float(v)
        return int(f) if f.is_integer() else f
    except (TypeError, ValueError):
        return None


def find_photos():
    """{(연도, '구간번호'): '상대경로'}"""
    photos = {}
    data_dir = os.path.join(ROOT, 'data')
    for d in os.listdir(data_dir):
        m = re.fullmatch(r'(\d{4})_repair', d)
        if not m:
            continue
        for f in os.listdir(os.path.join(data_dir, d)):
            stem, ext = os.path.splitext(f)
            if ext.lower() in ('.png', '.jpg', '.jpeg', '.webp'):
                photos[(int(m.group(1)), stem)] = f'data/{d}/{f}'
    return photos


def main():
    with open(MANHOLES_PATH, encoding='utf-8') as fp:
        manholes = json.load(fp)
    name_to_id = {}
    for line in manholes['lines']:
        for st in line['stations']:
            for mh in st['manholes']:
                name_to_id[mh['name'].replace(' ', '')] = mh['id']

    sheets = read_sheets(XLSX_PATH)
    photos = find_photos()
    used_photos = set()
    result = {}
    unmatched = []
    all_years = set()
    note_years = set()  # 비고가 한 건이라도 기록된 연도 = 침수 판정 가능 연도
    for sheet_name, rows in sheets.items():
        columns = parse_columns(rows)
        for r in sorted(rows):
            cells = rows[r]
            if r < 3 or 'B' not in cells or 'C' not in cells:
                continue
            section, no = cells['B'], to_number(cells['C'])
            key = f'{section}#{no}'
            mh_id = name_to_id.get(key)
            if not mh_id:
                unmatched.append(f'{sheet_name} {key}')
                continue

            by_year = {}
            for col, (year, field) in columns.items():
                all_years.add(year)
                rec = by_year.setdefault(year, {'year': year, 'repair': False, 'level': None, 'grade': None, 'note': None})
                val = cells.get(col)
                if val is None:
                    continue
                if field == 'repair':
                    rec['repair'] = str(val).upper() == 'O'
                elif field == 'level':
                    rec['level'] = to_number(val)
                else:
                    rec[field] = str(val)

            # 엑셀에 없는 연도(예: 2026)의 사진도 이력에 포함
            for (year, stem), path in photos.items():
                if stem == f'{section}{no}':
                    by_year.setdefault(year, {'year': year, 'repair': False, 'level': None, 'grade': None, 'note': None})
                    by_year[year]['photo'] = path
                    used_photos.add((year, stem))

            records = []
            for year in sorted(by_year):
                rec = by_year[year]
                if rec['note']:
                    # 수위추정 표시는 엑셀 관리용 — 웹 데이터에는 남기지 않음
                    rec['note'] = rec['note'].replace(INFER_TAG, '').strip()
                    note_years.add(year)
                rec['flood'] = bool(rec['note'] and '침수' in rec['note'])
                rec.setdefault('photo', None)
                # 아무 값도 없는 연도는 제외
                if rec['repair'] or rec['level'] is not None or rec['grade'] or rec['note'] or rec['photo']:
                    records.append(rec)

            levels = [x for x in records if x['level'] is not None]
            grades = [x for x in records if x['grade']]
            latest = levels[-1] if levels else None
            prev = levels[-2] if len(levels) > 1 else None
            # 최대/최저가 여러 해면 가장 최근 연도 기준
            max_rec = max(reversed(levels), key=lambda x: x['level']) if levels else None
            min_rec = min(reversed(levels), key=lambda x: x['level']) if levels else None
            result[mh_id] = {
                'line': sheet_name,
                'section': section,
                'no': no,
                'repair_cnt': sum(1 for x in records if x['repair']),
                'flood_cnt': sum(1 for x in records if x['flood']),                'latest_level': latest['level'] if latest else None,
                'latest_level_year': latest['year'] if latest else None,
                'prev_level': prev['level'] if prev else None,
                'avg_level': round(sum(x['level'] for x in levels) / len(levels)) if levels else None,
                'max_level': max_rec['level'] if max_rec else None,
                'max_level_year': max_rec['year'] if max_rec else None,
                'min_level': min_rec['level'] if min_rec else None,
                'min_level_year': min_rec['year'] if min_rec else None,
                'level_years': [levels[0]['year'], levels[-1]['year']] if levels else None,
                'flood_years': [x['year'] for x in records if x['flood']],
                'grade': grades[-1]['grade'] if grades else None,
                'grade_year': grades[-1]['year'] if grades else None,
                'last_repair_year': max((x['year'] for x in records if x['repair']), default=None),
                'records': records,
            }

    output = {
        'generated_at': datetime.now().isoformat(timespec='seconds'),
        'years': sorted(all_years),
        'flood_check_years': sorted(note_years),
        'manholes': result,
    }
    with open(OUTPUT_PATH, 'w', encoding='utf-8') as fp:
        json.dump(output, fp, ensure_ascii=False, indent=1)

    # --- 검증 리포트 ---
    print(f'[완료] {len(result)}개 맨홀 → {os.path.relpath(OUTPUT_PATH, ROOT)}')
    missing_in_excel = sorted(set(name_to_id.values()) - set(result))
    if unmatched:
        print(f'[경고] manholes.admin.json 에 없는 엑셀 행 {len(unmatched)}개: {", ".join(unmatched)}')
    if missing_in_excel:
        print(f'[경고] 엑셀에 없는 맨홀 {len(missing_in_excel)}개: {", ".join(missing_in_excel)}')
    orphan_photos = sorted(set(photos) - used_photos)
    if orphan_photos:
        print(f'[경고] 매칭되지 않은 사진: {", ".join(f"{y} {s}" for y, s in orphan_photos)}')
    photo_no_mark = [f'{r["year"]} {v["section"]}{v["no"]}' for v in result.values() for r in v['records'] if r['photo'] and not r['repair']]
    if photo_no_mark:
        print(f'[확인] 보수 사진은 있으나 엑셀 보수 표시(O)가 없음: {", ".join(photo_no_mark)}')


if __name__ == '__main__':
    sys.exit(main())
