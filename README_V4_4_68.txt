YAK POS V4.4.68 - FULL SIDEBAR NAV FIX

แก้ปัญหา:
- เปิดหน้าตกแต่งสลิปแล้วกดไปหน้าอื่นไม่ได้

สาเหตุ:
- เมนูซ้ายใช้ openBackTab แบบเก่า
- หน้าตกแต่งสลิปใช้ Navigation แบบใหม่ + yak-page-active
- สองระบบชนกัน

แก้ใหม่:
- Dashboard / สาขา / พนักงาน / สินค้า / ยอดขาย / รายงาน / ตกแต่งสลิป
  ใช้ Navigation Controller ชุดเดียว
- ทุกครั้งที่เปลี่ยนหน้า จะล้าง hidden/active/yak-page-active ของหน้าก่อน
- เมนูล่าง sync กับเมนูซ้าย
- Settings ยังใช้งานจากเมนูล่าง
