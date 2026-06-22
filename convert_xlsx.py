"""
convert_xlsx.py — แปลง event_outage_data.xlsx → event_outage_data.csv
รองรับ:
  - หลาย sheet ในไฟล์เดียว (เช่น แยกเป็นรายปี)
  - ต่อข้อมูลเข้ากับ CSV เก่า (event_outage_data.csv) อัตโนมัติ
  - กรองข้อมูลซ้ำด้วย (วันที่ + เวลาเริ่ม + สถานที่ + รหัสอุปกรณ์)
  - เรียงตาม date_iso แล้วนับ ลำดับ ใหม่ตั้งแต่ 1
"""
import csv, os
from openpyxl import load_workbook

THAI_MONTHS = {
    'ม.ค.':'01','ก.พ.':'02','มี.ค.':'03','เม.ย.':'04',
    'พ.ค.':'05','มิ.ย.':'06','ก.ค.':'07','ส.ค.':'08',
    'ก.ย.':'09','ต.ค.':'10','พ.ย.':'11','ธ.ค.':'12'
}
THAI_DIGITS = str.maketrans('๐๑๒๓๔๕๖๗๘๙', '0123456789')

HEADERS = [
    'ลำดับ','วันที่','เวลาเริ่ม','เวลาสิ้นสุด','ระยะเวลาดับ_นาที',
    'สถานที่','รหัสอุปกรณ์','จำนวนผชฟ_กระทบ','สภาพอากาศ','สาเหตุ',
    'ช่องทางการแจ้ง','เวลารับแจ้ง','เวลาออกปฏิบัติงาน','เวลาเสร็จงาน',
    'เวลาแก้ไข_นาที','ผู้ปฏิบัติงาน','ยานพาหนะ',
    'อุปกรณ์_รายการ','อุปกรณ์_จำนวน','หมายเหตุ','date_iso'
]

CSV_PATH  = 'event_outage_data.csv'
XLSX_PATH = 'event_outage_data.xlsx'

# ── helpers ──────────────────────────────────────────────────────
def parse_date(s):
    s = str(s).strip().translate(THAI_DIGITS)
    for th, num in THAI_MONTHS.items():
        s = s.replace(th, num)
    parts = s.split()
    if len(parts) == 3:
        d, m, y = parts
        try: return f'{int(y)-543}-{m}-{int(d):02d}'
        except: pass
    # รองรับ ISO ที่ถูกต้องอยู่แล้ว
    import re
    if re.match(r'^\d{4}-\d{2}-\d{2}$', s): return s
    return ''

def cell(v):
    if v is None: return ''
    s = str(v).strip().translate(THAI_DIGITS)
    return '' if s in ('None', 'nan', '-') else s

def to_int(v, d=0):
    try: return max(0, int(float(str(v)))) if str(v).strip() not in ('', 'None', 'nan') else d
    except: return d

def dedup_key(row_list):
    """key สำหรับตรวจซ้ำ: วันที่ + เวลาเริ่ม + สถานที่ + รหัสอุปกรณ์"""
    return (str(row_list[1]), str(row_list[2]), str(row_list[5]), str(row_list[6]))

# ── 1. โหลดข้อมูลเก่าจาก CSV (ถ้ามี) ────────────────────────────
existing = []
if os.path.exists(CSV_PATH):
    with open(CSV_PATH, newline='', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        headers_old = next(reader, None)
        for row in reader:
            if row: existing.append(row)
    print(f'📂 โหลดข้อมูลเก่า: {len(existing)} records จาก {CSV_PATH}')
else:
    print(f'📂 ไม่พบ {CSV_PATH} — สร้างใหม่')

existing_keys = {dedup_key(r) for r in existing}

# ── 2. อ่าน xlsx ทุก sheet ───────────────────────────────────────
wb = load_workbook(XLSX_PATH, data_only=True)
new_rows = []

for ws in wb.worksheets:
    sheet_count = 0
    for row in ws.iter_rows(min_row=9, values_only=True):
        v = row[1] if len(row) > 1 else None
        try:
            seq = int(float(str(v)))
            if seq <= 0: continue
        except: continue

        date_str = cell(row[2])
        r = [
            seq,
            date_str,
            cell(row[4]),                              # เวลาเริ่ม
            cell(row[6]),                              # เวลาสิ้นสุด
            to_int(row[7]),                            # ระยะเวลาดับ
            cell(row[8]),                              # สถานที่
            cell(row[9]),                              # รหัสอุปกรณ์
            to_int(row[10]),                           # จำนวนผชฟ
            cell(row[11]),                             # สภาพอากาศ
            cell(row[12]),                             # สาเหตุ
            cell(row[14]),                             # ช่องทางการแจ้ง
            cell(row[15]),                             # เวลารับแจ้ง
            cell(row[17]),                             # เวลาออกปฏิบัติงาน
            cell(row[18]),                             # เวลาเสร็จงาน
            to_int(row[19]),                           # เวลาแก้ไข
            cell(row[20]).replace('\n', ' | '),        # ผู้ปฏิบัติงาน
            cell(row[21]),                             # ยานพาหนะ
            cell(row[24]),                             # อุปกรณ์_รายการ
            cell(row[25]),                             # อุปกรณ์_จำนวน
            cell(row[29]) if len(row) > 29 else '',   # หมายเหตุ
            parse_date(date_str),
        ]

        key = dedup_key(r)
        if key not in existing_keys:
            new_rows.append(r)
            existing_keys.add(key)
            sheet_count += 1

    print(f'  📄 Sheet "{ws.title}": พบใหม่ {sheet_count} records')

print(f'➕ ข้อมูลใหม่ที่จะเพิ่ม: {len(new_rows)} records')

# ── 3. รวม + เรียง + นับลำดับใหม่ ────────────────────────────────
all_rows = existing + new_rows

# เรียงตาม date_iso (col index 20) แล้วตาม เวลาเริ่ม (col index 2)
all_rows.sort(key=lambda r: (str(r[20]), str(r[2])))

# นับลำดับใหม่ตั้งแต่ 1
for i, r in enumerate(all_rows, 1):
    r[0] = i

# ── 4. เขียน CSV ──────────────────────────────────────────────────
with open(CSV_PATH, 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.writer(f)
    w.writerow(HEADERS)
    w.writerows(all_rows)

print(f'✅ บันทึกสำเร็จ: {len(all_rows)} records รวม → {CSV_PATH}')
if all_rows:
    print(f'   ช่วงข้อมูล: {all_rows[0][20]} ถึง {all_rows[-1][20]}')
