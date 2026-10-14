"""
수위로 접속개소 침수 여부를 판정해 엑셀 비고에 기록

    python scripts/infer_flood.py            # 미리보기 (엑셀 변경 없음)
    python scripts/infer_flood.py --apply    # 엑셀 비고 칸에 기록
    python scripts/infer_flood.py --report   # 맨홀별 판단 근거 CSV 저장 (로컬 검토용, git 제외)

[판정 원리] 전력케이블 접속개소의 높이는 맨홀마다 고정이므로,
    한 번이라도 침수가 기록된 수위 이상이면 그 해도 침수다.
    → 기준 = 그 맨홀에서 직접 입력한 '침수' 비고가 있는 해들 중 가장 낮은 수위
    → 수위가 기준 이상인 모든 연도(침수 비고가 없는 해)를 침수로 기록
    침수 기록이 한 번도 없는 맨홀이나 기준보다 낮은 해는 판정하지 않는다 (빈칸 유지).

[엑셀 기록] 비고 칸에 '접속제 침수(수위추정)' 을 붙인다.
    기존 비고가 있으면 '기존 비고 / 접속제 침수(수위추정)' 처럼 덧붙이며, 직접 입력한 내용은 지우지 않는다.
    다시 실행하면 '(수위추정)' 부분만 새로 계산한다.
"""
import csv
import sys

from build_manhole_history import INFER_TAG, NOTE_SEPARATOR, split_note
from excel_io import (ROOT, XLSX_PATH, NUMBER_COL, SECTION_COL,
                      data_rows, parse_columns, read_sheets, to_number, write_cells)

NOTE_FLOOD = '접속제 침수' + INFER_TAG
NOTE_STYLE_FROM = ('AD', 'Z', 'V', 'R')   # 새 비고 칸의 서식은 같은 행의 다른 비고 칸을 따름
REPORT_PATH = ROOT / 'data' / 'flood_inference_report.csv'


def is_flood_text(text):
    return '침수' in text


def infer(sheets):
    """판정 결과 목록 (수위가 있고 직접 입력한 침수 비고가 없는 해마다 1건)

    항목: sheet, row, section, no, year, level, result(flood/below/no_record), reason, col, current, new
    """
    results = []
    for sheet_name, rows in sheets.items():
        columns = parse_columns(rows)
        level_col = {y: c for c, (y, f) in columns.items() if f == 'level'}
        note_col = {y: c for c, (y, f) in columns.items() if f == 'note'}
        years = sorted(set(level_col) & set(note_col))

        for row_num, cells in data_rows(rows):
            level = {y: to_number(cells.get(level_col[y])) for y in years}
            manual = {y: split_note(cells.get(note_col[y]))[0] for y in years}

            # 기준: 직접 입력한 침수 기록이 있는 해 중 가장 낮은 수위
            flood_levels = [(level[y], y) for y in years
                            if level[y] is not None and any(map(is_flood_text, manual[y]))]
            threshold, threshold_year = min(flood_levels) if flood_levels else (None, None)

            for y in years:
                if level[y] is None or any(map(is_flood_text, manual[y])):
                    continue
                if threshold is None:
                    result, reason = 'no_record', '침수 기록이 없는 맨홀'
                elif level[y] >= threshold:
                    result, reason = 'flood', f'{threshold_year}년 {threshold}mm 에서 침수 기록 → {level[y]}mm 이상'
                else:
                    result, reason = 'below', f'침수 기록 최저수위({threshold}mm) 미만'

                parts = manual[y] + ([NOTE_FLOOD] if result == 'flood' else [])
                results.append({
                    'sheet': sheet_name, 'row': row_num, 'section': cells[SECTION_COL],
                    'no': to_number(cells[NUMBER_COL]), 'year': y, 'level': level[y],
                    'result': result, 'reason': reason, 'col': note_col[y],
                    'current': cells.get(note_col[y]), 'new': NOTE_SEPARATOR.join(parts) or None,
                })
    return results


def build_updates(results):
    """엑셀에 쓸 변경분 {시트: {행: {열: 값}}} — 바뀌는 칸만"""
    updates = {}
    for r in results:
        if r['new'] != r['current']:
            updates.setdefault(r['sheet'], {}).setdefault(r['row'], {})[r['col']] = r['new']
    return updates


def write_report(results):
    label = {'flood': '침수', 'below': '기준 미만', 'no_record': '침수 기록 없음'}
    with open(REPORT_PATH, 'w', encoding='utf-8-sig', newline='') as fp:
        w = csv.writer(fp)
        w.writerow(['호선', '구간', '번호', '연도', '수위(mm)', '결과', '근거'])
        for r in results:
            w.writerow([r['sheet'], r['section'], r['no'], r['year'], r['level'], label[r['result']], r['reason']])
    print(f'[리포트] {REPORT_PATH.relative_to(ROOT)}')


def main():
    results = infer(read_sheets())
    flood = [r for r in results if r['result'] == 'flood']
    years = sorted({r['year'] for r in flood})
    print(f'[판정] 침수 기록 수위 이상 → 침수 {len(flood)}건 (연도: {years})')

    if '--report' in sys.argv:
        write_report(results)

    updates = build_updates(results)
    if '--apply' not in sys.argv:
        print(f'[미리보기] 바뀔 비고 칸 {sum(len(c) for rows in updates.values() for c in rows.values())}개 '
              f'— 엑셀에 기록하려면 --apply 옵션으로 실행하세요.')
        return 0
    try:
        changed = write_cells(updates, style_from=NOTE_STYLE_FROM)
    except PermissionError:
        print('[오류] 엑셀 파일이 열려 있습니다. Excel을 닫고 다시 실행하세요.')
        return 1
    print(f'[적용] {XLSX_PATH.relative_to(ROOT)} 비고 칸 {changed}개 갱신')
    return 0


if __name__ == '__main__':
    sys.exit(main())
