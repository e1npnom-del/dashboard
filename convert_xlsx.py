"""
convert_xlsx.py — รันโดย GitHub Actions อัตโนมัติ
แปลง event_outage_data.xlsx → event_outage_data.csv
"""
import csv, re
from openpyxl import load_workbook

THAI_MONTHS = {
    'ม.ค.':'01','ก.พ.':'02','มี.ค.':'03','เม.ย.':'04',
    'พ.ค.':'05','มิ.ย.':'06','ก.ค.':'07','ส.ค.':'08',
    'ก.ย.':'09','ต.ค.':'10','พ.ย.':'11','ธ.ค.':'12'
}

def parse_date(s):
    s = str(s).strip()
    for th, num in THAI_MONTHS.items():
        s = s.replace(th, num)
    parts = s.split()
    if len(parts) == 3:
        d, m, y = parts
        try: return f'{int(y)-543}-{m}-{int(d):02d}'
        except: pass
    return s

THAI_DIGITS = str.maketrans('๐๑๒๓๔๕๖๗๘๙', '0123456789')

def cell(v):
    if v is None: return ''
    s = str(v).strip().translate(THAI_DIGITS)
    return '' if s in ('None', 'nan', '-') else s

def to_int(v, d=0):
    try: return int(float(str(v))) if str(v).strip() not in ('', 'None', 'nan') else d
    except: return d

wb = load_workbook('event_outage_data.xlsx', data_only=True)
ws = wb.active

HEADERS = [
    'ลำดับ','วันที่','เวลาเริ่ม','เวลาสิ้นสุด','ระยะเวลาดับ_นาที',
    'สถานที่','รหัสอุปกรณ์','จำนวนผชฟ_กระทบ','สภาพอากาศ','สาเหตุ',
    'ช่องทางการแจ้ง','เวลารับแจ้ง','เวลาออกปฏิบัติงาน','เวลาเสร็จงาน',
    'เวลาแก้ไข_นาที','ผู้ปฏิบัติงาน','ยานพาหนะ',
    'อุปกรณ์_รายการ','อุปกรณ์_จำนวน','หมายเหตุ','date_iso'
]

# หา row ที่เป็นข้อมูลจริง: col B (index 1) เป็นตัวเลขจำนวนเต็ม > 0
rows_out = []
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
        cell(row[4]),   # เวลาเริ่ม
        cell(row[6]),   # เวลาสิ้นสุด
        to_int(row[7]), # ระยะเวลาดับ
        cell(row[8]),   # สถานที่
        cell(row[9]),   # รหัสอุปกรณ์
        to_int(row[10]),# จำนวนผชฟ
        cell(row[11]),  # สภาพอากาศ
        cell(row[12]),  # สาเหตุ
        cell(row[14]),  # ช่องทางการแจ้ง
        cell(row[15]),  # เวลารับแจ้ง
        cell(row[17]),  # เวลาออกปฏิบัติงาน
        cell(row[18]),  # เวลาเสร็จงาน
        to_int(row[19]),# เวลาแก้ไข
        cell(row[20]).replace('\n', ' | '),  # ผู้ปฏิบัติงาน
        cell(row[21]),  # ยานพาหนะ
        cell(row[24]),  # อุปกรณ์_รายการ
        cell(row[25]),  # อุปกรณ์_จำนวน
        cell(row[29]) if len(row) > 29 else '',  # หมายเหตุ
        parse_date(date_str),
    ]
    rows_out.append(r)

with open('event_outage_data.csv', 'w', newline='', encoding='utf-8-sig') as f:
    w = csv.writer(f)
    w.writerow(HEADERS)
    w.writerows(rows_out)

print(f'✅ แปลงสำเร็จ: {len(rows_out)} records → event_outage_data.csv')
