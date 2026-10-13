"""
비고가 없는 최근 연도(2023~)의 접속개소 침수 여부를 수위로 판정해 엑셀에 기록

    python scripts/infer_flood.py            # 미리보기 (엑셀 변경 없음)
    python scripts/infer_flood.py --apply    # 엑셀 비고 칸에 기록
    python scripts/infer_flood.py --report   # 맨홀별 판단 근거 CSV 저장 (로컬 검토용, git 제외)

[판정 원리] 전력케이블 접속개소의 높이는 맨홀마다 고정이므로
    기준연도에 '침수'였던 최저 수위 이상  → 침수
    기준연도에 '정상'이었던 최고 수위 이하 → 정상
    그 사이이거나 기준 기록이 없으면      → 수위만으로 알 수 없음 (빈칸 유지)
[기준연도] 2020~2022 ('접속제 침수'가 명시된 연도)
    2019년 '침수' 표시는 이후 기록과 모순되는 맨홀이 많아 기준에서 제외했다.

[엑셀 기록] 침수 → '접속제 침수(수위추정)', 그 외 → 빈칸
    '(수위추정)' 칸만 다시 계산하며, 직접 입력한 비고는 건드리지 않는다.
"""
import csv
import sys

from build_manhole_history import INFER_TAG
from excel_io import (ROOT, XLSX_PATH, NUMBER_COL, SECTION_COL,
                      data_rows, parse_columns, read_sheets, to_number, write_cells)

REFERENCE_YEARS = (2020, 2021, 2022)
NOTE_FLOOD = '접속제 침수' + INFER_TAG
NOTE_STYLE_FROM = ('AD', 'Z', 'V', 'R')   # 새 비고 칸의 서식은 같은 행의 다른 비고 칸을 따름
REPORT_PATH = ROOT / 'data' / 'flood_inference_report.csv'


def is_flood(note):
    return bool(note) and '침수' in note


def judge(level, flood_min, safe_max):
    """(결과, 근거) — 결과: flood / normal / unknown"""
    above = flood_min is not None and level >= flood_min
    below = safe_max is not None and level <= safe_max
    if above and not below:
        return 'flood', f'침수기록 최저수위 {flood_min}mm 이상'
    if below and not above:
        return 'normal', f'정상기록 최고수위 {safe_max}mm 이하'
    if above and below:
        return 'unknown', f'기존 기록 모순 (침수 {flood_min}mm ≤ 정상 {safe_max}mm)'
    if flood_min is None and safe_max is None:
        return 'unknown', '기준연도 수위 기록 없음'
    low = '?' if safe_max is None else safe_max
    high = '?' if flood_min is None else flood_min
    return 'unknown', f'판정 경계 구간 ({low}~{high}mm) 내'


def infer(sheets):
    """판정 결과 목록. 항목: sheet, row, section, no, year, level, result, reason, col, current"""
    results = []
    for sheet_name, rows in sheets.items():
        columns = parse_columns(rows)
        level_col = {y: c for c, (y, f) in columns.items() if f == 'level'}
        note_col = {y: c for c, (y, f) in columns.items() if f == 'note'}
        rows_ = data_rows(rows)

        # 판정 대상 연도: 기준연도 이후이면서 직접 입력한 비고가 하나도 없는 연도
        def has_manual_note(year):
            return any(cells.get(note_col[year]) and INFER_TAG not in cells[note_col[year]] for _, cells in rows_)

        target_years = [y for y in sorted(note_col)
                        if y in level_col and y > max(REFERENCE_YEARS) and not has_manual_note(y)]

        for row_num, cells in rows_:
            ref = [(to_number(cells.get(level_col[y])), cells.get(note_col[y]))
                   for y in REFERENCE_YEARS if y in level_col]
            flood_min = min((lv for lv, note in ref if lv is not None and is_flood(note)), default=None)
            safe_max = max((lv for lv, note in ref if lv is not None and not is_flood(note)), default=None)

            for year in target_years:
                level = to_number(cells.get(level_col[year]))
                if level is None:
                    continue
                result, reason = judge(level, flood_min, safe_max)
                results.append({
                    'sheet': sheet_name, 'row': row_num, 'section': cells[SECTION_COL],
                    'no': to_number(cells[NUMBER_COL]), 'year': year, 'level': level,
                    'result': result, 'reason': reason,
                    'col': note_col[year], 'current': cells.get(note_col[year]),
                })
    return results


def build_updates(results):
    """엑셀에 쓸 변경분 {시트: {행: {열: 값}}} — 직접 입력한 비고는 제외"""
    updates = {}
    for r in results:
        text = NOTE_FLOOD if r['result'] == 'flood' else None
        if text == r['current'] or (text is None and not r['current']):
            continue
        if r['current'] and INFER_TAG not in r['current']:
            continue
        updates.setdefault(r['sheet'], {}).setdefault(r['row'], {})[r['col']] = text
    return updates


def write_report(results):
    label = {'flood': '침수', 'normal': '정상', 'unknown': '현장 확인 필요'}
    with open(REPORT_PATH, 'w', encoding='utf-8-sig', newline='') as fp:
        w = csv.writer(fp)
        w.writerow(['호선', '구간', '번호', '연도', '수위(mm)', '결과', '근거'])
        for r in results:
            w.writerow([r['sheet'], r['section'], r['no'], r['year'], r['level'], label[r['result']], r['reason']])
    print(f'[리포트] {REPORT_PATH.relative_to(ROOT)}')


def main():
    results = infer(read_sheets())
    count = {k: sum(r['result'] == k for r in results) for k in ('flood', 'normal', 'unknown')}
    years = sorted({r['year'] for r in results})
    print(f"[판정] 대상연도 {years} · 침수 {count['flood']}건 / 정상 {count['normal']}건 / "
          f"수위만으로 알 수 없음 {count['unknown']}건(빈칸)")

    if '--report' in sys.argv:
        write_report(results)

    if '--apply' not in sys.argv:
        print('[미리보기] 엑셀에 기록하려면 --apply 옵션으로 실행하세요.')
        return 0
    try:
        changed = write_cells(build_updates(results), style_from=NOTE_STYLE_FROM)
    except PermissionError:
        print('[오류] 엑셀 파일이 열려 있습니다. Excel을 닫고 다시 실행하세요.')
        return 1
    print(f'[적용] {XLSX_PATH.relative_to(ROOT)} 비고 칸 {changed}개 갱신')
    return 0


if __name__ == '__main__':
    sys.exit(main())
