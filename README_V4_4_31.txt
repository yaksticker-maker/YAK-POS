YAK POS V4.4.31 - REPORT BUTTON FIX

แก้ปุ่มหน้ารายงานที่กดไม่ทำงาน:
- เลือกวันที่
- เลือกเดือน
- ช่วงวันที่

เปลี่ยนจากพึ่ง inline onclick เป็น direct event binding สำหรับ Electron
และแก้ DOM reference ของตารางสัดส่วนสินค้าเพื่อไม่ให้ JavaScript หยุดกลางทาง
เพิ่มการ bind ซ้ำเมื่อเปิดแท็บรายงาน
