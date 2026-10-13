"""
비고가 기록되지 않은 연도(2023~)의 접속개소 침수 여부를 수위로 추정해 data/맨홀이력.xlsx 에 기록한다.

    python scripts/infer_flood.py            # 미리보기 (엑셀 변경 없음)
    python scripts/infer_flood.py --apply    # 엑셀 비고 칸에 기록
    python scripts/infer_flood.py --report   # 맨홀별 판단 근거 CSV 저장 (로컬 검토용, git 제외)

[판정 원리] 전력케이블 접속개소의 높이는 맨홀마다 고정이므로,
  - 기준연도에 '침수'였던 최저 수위(hi) 이상이면 → 침수
  - 기준연도에 '침수 아님'이었던 최고 수위(lo) 이하이면 → 정상
  - 그 사이이거나 기준 기록이 없으면 → 수위만으로 알 수 없음
[기준연도] 2020~2022 ('접속제 침수'가 명시적으로 기록된 연도).
  2019년 '침수' 표시는 이후 연도 기록과 모순되는 맨홀이 많아(예: 같은 수위에서 2019 침수 / 2020 정상) 기준에서 제외.

엑셀 기록 규칙
  - 침수        → '접속제 침수(수위추정)'
  - 그 외       → 비워둠 (기존 연도와 동일한 관례)
'(수위추정)'이 붙은 칸은 다시 실행하면 최신 수위로 재계산되고, 그 외 직접 입력한 비고는 건드리지 않는다.
"""
import csv
import os
import re
import shutil
import sys
import zipfile
from xml.sax.saxutils import escape

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from build_manhole_history import ROOT, XLSX_PATH, INFER_TAG, read_sheets, parse_columns, to_number  # noqa: E402

REFERENCE_YEARS = (2020, 2021, 2022)
NOTE_FLOOD = '접속제 침수' + INFER_TAG
REPORT_PATH = os.path.join(ROOT, 'data', 'flood_inference_report.csv')


def is_flood(note):
    return bool(note) and '침수' in note


def infer(sheets):
    """판정 결과 목록: dict(sheet, row, section, no, year, level, result, col, reason)"""
    results = []
    for sheet_name, rows in sheets.items():
        columns = parse_columns(rows)
        level_col = {y: c for c, (y, f) in columns.items() if f == 'level'}
        note_col = {y: c for c, (y, f) in columns.items() if f == 'note'}

        # 대상 연도: 수위·비고 열이 있고, 사람이 직접 쓴 비고가 시트 전체에 하나도 없는 연도
        def manual_note_exists(year):
            col = note_col[year]
            return any(cells.get(col) and INFER_TAG not in cells[col] for r, cells in rows.items() if r >= 3)
        target_years = [y for y in sorted(note_col) if y in level_col and y not in REFERENCE_YEARS and y > max(REFERENCE_YEARS) and not manual_note_exists(y)]

        for r in sorted(rows):
            cells = rows[r]
            if r < 3 or 'B' not in cells:
                continue
            ref = [(to_number(cells.get(level_col[y])), cells.get(note_col[y])) for y in REFERENCE_YEARS if y in level_col]
            flood_levels = [lv for lv, note in ref if lv is not None and is_flood(note)]
            safe_levels = [lv for lv, note in ref if lv is not None and not is_flood(note)]
            hi = min(flood_levels) if flood_levels else None
            lo = max(safe_levels) if safe_levels else None

            for y in target_years:
                level = to_number(cells.get(level_col[y]))
                if level is None:
                    continue
                above = hi is not None and level >= hi
                below = lo is not None and level <= lo
                if above and not below:
                    result, reason = 'flood', f'침수기록 최저수위 {hi}mm 이상'
                elif below and not above:
                    result, reason = 'normal', f'정상기록 최고수위 {lo}mm 이하'
                elif above and below:
                    result, reason = 'unknown', f'기존 기록 모순 (침수 {hi}mm ≤ 정상 {lo}mm)'
                elif hi is None and lo is None:
                    result, reason = 'unknown', '기준연도 수위 기록 없음'
                else:
                    rng = f"{lo if lo is not None else '?'}~{hi if hi is not None else '?'}mm"
                    result, reason = 'unknown', f'판정 경계 구간 ({rng}) 내'
                results.append(dict(sheet=sheet_name, row=r, section=cells['B'], no=to_number(cells['C']),
                                    year=y, level=level, result=result, reason=reason,
                                    col=note_col[y], current=cells.get(note_col[y])))
    return results


# ---------------------------------------------------------------- xlsx 쓰기

def col_to_num(col):
    n = 0
    for ch in col:
        n = n * 26 + ord(ch) - 64
    return n


CELL_RE = re.compile(r'<c r="([A-Z]+)(\d+)"([^>]*?)(?:/>|>(.*?)</c>)', re.S)


def set_row_cells(row_xml, row_num, updates, shared_index):
    """row_xml 안의 셀들을 updates({열: 문자열 또는 None})로 갱신. None이면 값 삭제."""
    head = re.match(r'<row[^>]*>', row_xml).group()
    cells = [(m.group(1), m.group(0)) for m in CELL_RE.finditer(row_xml)]
    styles = {col: re.search(r'\bs="(\d+)"', xml) for col, xml in cells}
    # 같은 행의 다른 비고 칸 스타일을 따라감
    note_style = next((styles[c].group(1) for c in ('AD', 'Z', 'V', 'R') if styles.get(c)), '5')

    cell_map = dict(cells)
    for col, text in updates.items():
        existing = cell_map.get(col)
        style = styles[col].group(1) if existing and styles[col] else note_style
        if text is None:
            if existing:
                cell_map[col] = f'<c r="{col}{row_num}" s="{style}"/>'
        else:
            cell_map[col] = f'<c r="{col}{row_num}" s="{style}" t="s"><v>{shared_index(text)}</v></c>'
    body = ''.join(cell_map[c] for c in sorted(cell_map, key=col_to_num))
    return f'{head}{body}</row>'


def write_xlsx(results):
    z = zipfile.ZipFile(XLSX_PATH)
    files = {i.filename: (i, z.read(i.filename)) for i in z.infolist()}
    z.close()

    # sharedStrings
    sst_xml = files['xl/sharedStrings.xml'][1].decode('utf-8')
    strings = [re.sub(r'<[^>]+>', '', m) for m in re.findall(r'<si>(.*?)</si>', sst_xml, re.S)]
    new_strings = []

    def shared_index(text):
        if text in strings:
            return strings.index(text)
        strings.append(text)
        new_strings.append(text)
        return len(strings) - 1

    # 시트명 → 시트 파일
    wb = files['xl/workbook.xml'][1].decode('utf-8')
    rels = files['xl/_rels/workbook.xml.rels'][1].decode('utf-8')
    rel_map = dict(re.findall(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels))
    rel_map.update({k: v for v, k in re.findall(r'Target="([^"]+)"[^>]*Id="([^"]+)"', rels)})
    sheet_files = {name: 'xl/' + rel_map[rid].lstrip('/').replace('xl/', '')
                   for name, rid in re.findall(r'<sheet name="([^"]+)"[^>]*r:id="([^"]+)"', wb)}

    by_sheet = {}
    for r in results:
        text = NOTE_FLOOD if r['result'] == 'flood' else None
        if text == r['current'] or (text is None and not r['current']):
            continue
        if r['current'] and INFER_TAG not in r['current']:
            continue  # 사람이 직접 입력한 비고는 보존
        by_sheet.setdefault(sheet_files[r['sheet']], {}).setdefault(r['row'], {})[r['col']] = text

    changed = 0
    for path, row_updates in by_sheet.items():
        xml = files[path][1].decode('utf-8')
        for row_num, updates in row_updates.items():
            m = re.search(rf'<row r="{row_num}"[^>]*>.*?</row>', xml, re.S)
            xml = xml[:m.start()] + set_row_cells(m.group(), row_num, updates, shared_index) + xml[m.end():]
            changed += len(updates)
        files[path] = (files[path][0], xml.encode('utf-8'))

    if new_strings:
        added = ''.join(f'<si><t>{escape(s)}</t></si>' for s in new_strings)
        sst_xml = sst_xml.replace('</sst>', added + '</sst>')
    total = sum(len(re.findall(r'<c [^>]*t="s"', files[p][1].decode('utf-8'))) for p in sheet_files.values())
    sst_xml = re.sub(r'count="\d+"', f'count="{total}"', sst_xml, count=1)
    sst_xml = re.sub(r'uniqueCount="\d+"', f'uniqueCount="{len(strings)}"', sst_xml, count=1)
    files['xl/sharedStrings.xml'] = (files['xl/sharedStrings.xml'][0], sst_xml.encode('utf-8'))

    tmp = XLSX_PATH + '.tmp'
    with zipfile.ZipFile(tmp, 'w') as out:
        for info, data in files.values():
            out.writestr(info, data, compress_type=info.compress_type)
    shutil.move(tmp, XLSX_PATH)
    return changed


def main():
    apply = '--apply' in sys.argv
    results = infer(read_sheets(XLSX_PATH))

    counts = {k: sum(1 for r in results if r['result'] == k) for k in ('flood', 'normal', 'unknown')}
    years = sorted({r['year'] for r in results})
    print(f"[판정] 대상연도 {years} · 침수 {counts['flood']}건 / 정상 {counts['normal']}건 / 수위만으로 알 수 없음 {counts['unknown']}건(빈칸)")

    if '--report' in sys.argv:
        with open(REPORT_PATH, 'w', encoding='utf-8-sig', newline='') as fp:
            w = csv.writer(fp)
            w.writerow(['호선', '구간', '번호', '연도', '수위(mm)', '결과', '근거'])
            label = {'flood': '침수', 'normal': '정상', 'unknown': '현장 확인 필요'}
            for r in results:
                w.writerow([r['sheet'], r['section'], r['no'], r['year'], r['level'], label[r['result']], r['reason']])
        print(f'[리포트] {os.path.relpath(REPORT_PATH, ROOT)}')

    if apply:
        try:
            changed = write_xlsx(results)
        except PermissionError:
            print('[오류] 엑셀 파일이 열려 있습니다. Excel을 닫고 다시 실행하세요.')
            return 1
        print(f'[적용] {os.path.relpath(XLSX_PATH, ROOT)} 비고 칸 {changed}개 갱신')
    else:
        print('[미리보기] 엑셀에 기록하려면 --apply 옵션으로 실행하세요.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
