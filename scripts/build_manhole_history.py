"""
맨홀이력 엑셀 → 웹 데이터(manhole_history.admin.json) 변환

    python scripts/build_manhole_history.py

엑셀(data/맨홀이력.xlsx)이 원본이며, 엑셀을 고친 뒤 다시 실행하면 웹에 반영된다.
배포(GitHub Actions) 때도 자동 실행된다.

- 맨홀 매칭 : 엑셀 '구간' + '번호'  ↔  manholes.admin.json 의 name ("월배기지 #1")
- 침수 판정 : 비고에 '침수'가 들어간 연도 (전력케이블 접속개소 침수)
- 보수 사진 : data/{연도}_repair/{구간}{번호}.png
"""
import json
import re
import sys
from datetime import datetime

from excel_io import ROOT, NUMBER_COL, SECTION_COL, data_rows, parse_columns, read_sheets, to_number

MANHOLES_PATH = ROOT / 'manholes.admin.json'
OUTPUT_PATH = ROOT / 'manhole_history.admin.json'
PHOTO_DIR_RE = re.compile(r'(\d{4})_repair')
PHOTO_EXTS = {'.png', '.jpg', '.jpeg', '.webp'}

INFER_TAG = '(수위추정)'                 # infer_flood.py 가 기록한 비고 표시 (엑셀 관리용, 웹에는 숨김)
NOTE_SEPARATOR = ' / '                   # 한 칸에 비고가 여러 개일 때 구분자 (예: '부분보수필요 / 접속제 침수(수위추정)')
HIDDEN_NOTES = {'관로구방수장치보수필요'}  # 웹에 표시하지 않는 비고 (공백 제거 후 비교)
FLOOD_ONLY_RE = re.compile(r'(접속제\s*)?침수')  # 침수 뱃지와 뜻이 같아 비고 글자로는 생략하는 문구


def load_manhole_ids():
    """{'월배기지#1': 'MH-1-A01-01'} — 공백을 뺀 맨홀 이름 → ID"""
    data = json.loads(MANHOLES_PATH.read_text(encoding='utf-8'))
    return {mh['name'].replace(' ', ''): mh['id']
            for line in data['lines'] for st in line['stations'] for mh in st['manholes']}


def find_photos():
    """{(연도, '구간번호'): 'data/2014_repair/만촌1.png'}"""
    photos = {}
    for folder in (ROOT / 'data').iterdir():
        m = PHOTO_DIR_RE.fullmatch(folder.name)
        if not (m and folder.is_dir()):
            continue
        for file in folder.iterdir():
            if file.suffix.lower() in PHOTO_EXTS:
                photos[(int(m.group(1)), file.stem)] = file.relative_to(ROOT).as_posix()
    return photos


def split_note(note):
    """비고 칸 → (직접 입력한 비고 목록, 수위추정 비고 목록)"""
    parts = [p.strip() for p in (note or '').split(NOTE_SEPARATOR.strip()) if p.strip()]
    return [p for p in parts if INFER_TAG not in p], [p for p in parts if INFER_TAG in p]


def read_note(note):
    """비고 칸 → (침수 여부, 웹에 보여줄 비고)

    침수 여부: 비고(직접 입력 + 수위추정) 어디든 '침수'가 있으면 True
    보여줄 비고: 수위추정 표시·숨김 비고·침수 뱃지와 같은 문구를 뺀 나머지 (없으면 None)
    """
    manual, inferred = split_note(note)
    parts = manual + [p.replace(INFER_TAG, '').strip() for p in inferred]
    flood = any('침수' in p for p in parts)
    shown = [p for p in parts
             if p.replace(' ', '') not in HIDDEN_NOTES and not FLOOD_ONLY_RE.fullmatch(p)]
    return flood, NOTE_SEPARATOR.join(shown) or None


def build_records(cells, columns, photos_by_year):
    """맨홀 1행 → 연도별 기록 목록 (값이 하나도 없는 연도는 제외)"""
    by_year = {}

    def record(year):
        return by_year.setdefault(year, {'year': year, 'repair': False, 'level': None,
                                         'grade': None, 'note': None, 'photo': None})

    for col, (year, field) in columns.items():
        value = cells.get(col)
        rec = record(year)
        if value is None:
            continue
        if field == 'repair':
            rec['repair'] = value.upper() == 'O'
        elif field == 'level':
            rec['level'] = to_number(value)
        else:
            rec[field] = value

    # 엑셀에 열이 없는 연도(예: 2026)의 사진도 포함
    for year, path in photos_by_year.items():
        record(year)['photo'] = path

    records = []
    for year in sorted(by_year):
        rec = by_year[year]
        rec['flood'], rec['note'] = read_note(rec['note'])
        if rec['repair'] or rec['flood'] or rec['level'] is not None or rec['grade'] or rec['note'] or rec['photo']:
            records.append(rec)
    return records


def summarize(records):
    """연도별 기록 → 화면용 요약값 (보수·침수 횟수, 수위 통계)"""
    levels = [r for r in records if r['level'] is not None]
    # 최대/최저가 여러 해면 가장 최근 연도 기준
    max_rec = max(reversed(levels), key=lambda r: r['level'], default=None)
    min_rec = min(reversed(levels), key=lambda r: r['level'], default=None)
    latest = levels[-1] if levels else None
    prev = levels[-2] if len(levels) > 1 else None
    grades = [r for r in records if r['grade']]
    return {
        'repair_cnt': sum(r['repair'] for r in records),
        'flood_cnt': sum(r['flood'] for r in records),
        'flood_years': [r['year'] for r in records if r['flood']],
        'last_repair_year': max((r['year'] for r in records if r['repair']), default=None),
        'latest_level': latest and latest['level'],
        'latest_level_year': latest and latest['year'],
        'prev_level': prev and prev['level'],
        'avg_level': round(sum(r['level'] for r in levels) / len(levels)) if levels else None,
        'max_level': max_rec and max_rec['level'],
        'max_level_year': max_rec and max_rec['year'],
        'min_level': min_rec and min_rec['level'],
        'min_level_year': min_rec and min_rec['year'],
        'level_years': [levels[0]['year'], levels[-1]['year']] if levels else None,
        # 등급은 기준이 불명확해 화면에 표시하지 않지만, 추후 사용을 위해 데이터에는 유지
        'grade': grades[-1]['grade'] if grades else None,
        'grade_year': grades[-1]['year'] if grades else None,
    }


def main():
    name_to_id = load_manhole_ids()
    photos = find_photos()
    used_photos, unmatched = set(), []
    manholes, all_years, note_years = {}, set(), set()

    for sheet_name, rows in read_sheets().items():
        columns = parse_columns(rows)
        all_years |= {year for year, _ in columns.values()}
        for _, cells in data_rows(rows):
            section, no = cells[SECTION_COL], to_number(cells[NUMBER_COL])
            mh_id = name_to_id.get(f'{section}#{no}')
            if not mh_id:
                unmatched.append(f'{sheet_name} {section}#{no}')
                continue

            photos_by_year = {y: p for (y, stem), p in photos.items() if stem == f'{section}{no}'}
            used_photos |= {(y, f'{section}{no}') for y in photos_by_year}
            records = build_records(cells, columns, photos_by_year)
            note_years |= {y for col, (y, f) in columns.items() if f == 'note' and cells.get(col)}

            manholes[mh_id] = {'line': sheet_name, 'section': section, 'no': no,
                               **summarize(records), 'records': records}

    output = {
        'generated_at': datetime.now().isoformat(timespec='seconds'),
        'years': sorted(all_years),
        'flood_check_years': sorted(note_years),  # 비고가 기록된 연도 = 침수 판정이 가능한 연도
        'manholes': manholes,
    }
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=1), encoding='utf-8')

    # ── 검증 리포트 ──
    print(f'[완료] {len(manholes)}개 맨홀 → {OUTPUT_PATH.relative_to(ROOT)}')
    if unmatched:
        print(f'[경고] manholes.admin.json 에 없는 엑셀 행 {len(unmatched)}개: {", ".join(unmatched)}')
    missing = sorted(set(name_to_id.values()) - set(manholes))
    if missing:
        print(f'[경고] 엑셀에 없는 맨홀 {len(missing)}개: {", ".join(missing)}')
    orphan = sorted(set(photos) - used_photos)
    if orphan:
        print(f'[경고] 맨홀과 연결되지 않은 사진: {", ".join(f"{y} {s}" for y, s in orphan)}')
    no_mark = [f'{r["year"]} {m["section"]}{m["no"]}'
               for m in manholes.values() for r in m['records'] if r['photo'] and not r['repair']]
    if no_mark:
        print(f'[확인] 보수 사진은 있으나 엑셀 보수 표시(O)가 없음: {", ".join(no_mark)}')
    return 0


if __name__ == '__main__':
    sys.exit(main())
