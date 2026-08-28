YAK POS V4.4.32
แก้ระบบรายงานโดยแยกออกเป็น report-v4432.js อิสระจาก app.js เดิม
- ปุ่มเลือกวันที่/เดือน/ช่วงวันที่ทำงานจาก event listener โดยตรง
- อ่านยอดขายจาก localStorage yak_pos_db_v2/v1 โดยตรง
- ยอดขาย/ต้นทุน/กำไร/กำไร% คำนวณเอง
- กราฟมี fallback แม้ Chart.js มีปัญหา
- ตารางสินค้าและบิลแสดงเอง
- PDF/Print ทำงานผ่าน Electron bridge หรือ fallback
- Real-time ทุก 3 วินาที
