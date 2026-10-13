"""
맨홀이력 엑셀(xlsx) 읽기·쓰기 공용 모듈

외부 패키지 없이 표준 라이브러리만 사용한다 (xlsx = zip + xml).
쓰기는 지정한 셀만 XML에서 직접 바꾸므로 서식·병합·수식 등 나머지 내용은 그대로 보존된다.

엑셀 시트 구조 (시트 = 호선)
    1행: 연도 (연도별 병합셀)          예) D1:F1 = 2014
    2행: 연도별 항목 (보수/수위/등급/비고)
    3행~: 맨홀 1개 = 1행  (B열: 구간, C열: 번호)
"""
import re
import shutil
import zipfile
import xml.etree.ElementTree as ET
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parent.parent
XLSX_PATH = ROOT / 'data' / '맨홀이력.xlsx'

HEADER_ROWS = 2          # 1행 연도, 2행 항목
SECTION_COL = 'B'        # 구간
NUMBER_COL = 'C'         # 번호
FIELD_NAMES = {'보수': 'repair', '수위': 'level', '등급': 'grade', '비고': 'note'}

_NS = {
    'm': 'http://schemas.openxmlformats.org/spreadsheetml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}
_T = f"{{{_NS['m']}}}t"
_CELL_RE = re.compile(r'<c r="([A-Z]+)(\d+)"([^>]*?)(?:/>|>(.*?)</c>)', re.S)


# ── 공통 유틸 ─────────────────────────────────────────────

def col_number(col):
    """열 문자 → 번호 (A=1, Z=26, AA=27)"""
    n = 0
    for ch in col:
        n = n * 26 + ord(ch) - 64
    return n


def to_number(value):
    """셀 값 → int/float (숫자가 아니면 None)"""
    try:
        f = float(value)
        return int(f) if f.is_integer() else f
    except (TypeError, ValueError):
        return None


def _sheet_files(files):
    """{시트명: 시트 XML 경로} — workbook.xml 과 관계(rels) 파일로 매핑"""
    rels = ET.fromstring(files['xl/_rels/workbook.xml.rels'])
    targets = {r.get('Id'): r.get('Target') for r in rels}
    workbook = ET.fromstring(files['xl/workbook.xml'])
    result = {}
    for sheet in workbook.find('m:sheets', _NS):
        target = targets[sheet.get(f"{{{_NS['r']}}}id")].lstrip('/')
        result[sheet.get('name')] = target if target.startswith('xl/') else f'xl/{target}'
    return result


# ── 읽기 ─────────────────────────────────────────────────

def read_sheets(path=XLSX_PATH):
    """모든 시트의 셀 값을 읽는다. 반환: {시트명: {행번호: {열문자: 값}}}"""
    with zipfile.ZipFile(path) as z:
        files = {name: z.read(name) for name in z.namelist()}

    shared = []
    if 'xl/sharedStrings.xml' in files:
        for si in ET.fromstring(files['xl/sharedStrings.xml']).findall('m:si', _NS):
            shared.append(''.join(t.text or '' for t in si.iter(_T)))

    sheets = {}
    for name, sheet_path in _sheet_files(files).items():
        rows = {}
        for row in ET.fromstring(files[sheet_path]).iter(f"{{{_NS['m']}}}row"):
            cells = {}
            for c in row.findall('m:c', _NS):
                v = c.find('m:v', _NS)
                if c.get('t') == 'inlineStr':
                    value = ''.join(t.text or '' for t in c.iter(_T))
                elif v is None:
                    continue
                elif c.get('t') == 's':
                    value = shared[int(v.text)]
                else:
                    value = v.text
                value = value.strip()
                if value:
                    cells[re.match(r'[A-Z]+', c.get('r')).group()] = value
            rows[int(row.get('r'))] = cells
        sheets[name] = rows
    return sheets


def parse_columns(rows):
    """1행(연도)·2행(항목) 머리글로 {열문자: (연도, 항목)} 매핑을 만든다. 항목: repair/level/grade/note"""
    year_starts = sorted(
        (col_number(col), int(float(v))) for col, v in rows.get(1, {}).items() if re.fullmatch(r'\d{4}(\.0)?', v)
    )
    mapping = {}
    for col, header in rows.get(2, {}).items():
        field = FIELD_NAMES.get(header)
        years = [year for start, year in year_starts if start <= col_number(col)]
        if field and years:
            mapping[col] = (years[-1], field)
    return mapping


def data_rows(rows):
    """맨홀 데이터 행만 (행번호, 셀) 순서대로 반환"""
    return [(r, rows[r]) for r in sorted(rows)
            if r > HEADER_ROWS and SECTION_COL in rows[r] and NUMBER_COL in rows[r]]


# ── 쓰기 ─────────────────────────────────────────────────

def write_cells(updates, path=XLSX_PATH, style_from=()):
    """지정한 셀의 문자열 값을 바꾼다. 셀 서식은 기존 셀 → 같은 행의 style_from 열 순서로 따른다.

    updates: {시트명: {행번호: {열문자: 문자열 | None(값 삭제)}}}
    반환: 변경한 셀 수 (엑셀이 열려 있으면 PermissionError)
    """
    with zipfile.ZipFile(path) as z:
        infos = z.infolist()
        files = {i.filename: z.read(i.filename) for i in infos}

    sst = files['xl/sharedStrings.xml'].decode('utf-8')
    strings = [re.sub(r'<[^>]+>', '', s) for s in re.findall(r'<si>(.*?)</si>', sst, re.S)]
    added = []

    def string_index(text):
        if text not in strings:
            strings.append(text)
            added.append(text)
        return strings.index(text)

    changed = 0
    sheet_files = _sheet_files(files)
    for sheet_name, row_updates in updates.items():
        sheet_path = sheet_files[sheet_name]
        xml = files[sheet_path].decode('utf-8')
        for row_num, cell_updates in row_updates.items():
            m = re.search(rf'<row r="{row_num}"[^>]*>.*?</row>', xml, re.S)
            new_row = _update_row(m.group(), row_num, cell_updates, string_index, style_from)
            xml = xml[:m.start()] + new_row + xml[m.end():]
            changed += len(cell_updates)
        files[sheet_path] = xml.encode('utf-8')

    # 공유 문자열 표: 새 문자열 추가 + 개수 갱신
    if added:
        sst = sst.replace('</sst>', ''.join(f'<si><t>{escape(s)}</t></si>' for s in added) + '</sst>')
    total = sum(len(re.findall(r'<c [^>]*t="s"', files[p].decode('utf-8'))) for p in sheet_files.values())
    sst = re.sub(r'count="\d+"', f'count="{total}"', sst, count=1)
    sst = re.sub(r'uniqueCount="\d+"', f'uniqueCount="{len(strings)}"', sst, count=1)
    files['xl/sharedStrings.xml'] = sst.encode('utf-8')

    tmp = Path(f'{path}.tmp')
    with zipfile.ZipFile(tmp, 'w') as out:
        for info in infos:
            out.writestr(info, files[info.filename], compress_type=info.compress_type)
    shutil.move(tmp, path)
    return changed


def _update_row(row_xml, row_num, cell_updates, string_index, style_from):
    """행 XML 안의 셀을 갱신하고 열 순서대로 다시 조립한다."""
    head = re.match(r'<row[^>]*>', row_xml).group()
    cells = {m.group(1): m.group(0) for m in _CELL_RE.finditer(row_xml)}
    styles = {col: re.search(r'\bs="(\d+)"', xml) for col, xml in cells.items()}
    fallback = next((styles[c].group(1) for c in style_from if styles.get(c)), None)

    for col, text in cell_updates.items():
        style = styles[col].group(1) if styles.get(col) else fallback
        s_attr = f' s="{style}"' if style else ''
        if text is None:
            if col in cells:
                cells[col] = f'<c r="{col}{row_num}"{s_attr}/>'
        else:
            cells[col] = f'<c r="{col}{row_num}"{s_attr} t="s"><v>{string_index(text)}</v></c>'
    return head + ''.join(cells[c] for c in sorted(cells, key=col_number)) + '</row>'
