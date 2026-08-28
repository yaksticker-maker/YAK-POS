YAK POS V4.4.3 TEST RECEIPT FIX

- ปุ่มพิมพ์ทดสอบจะพิมพ์ใบ Test จริง
- ใบ Test แสดง YAK POS, TEST RECEIPT, ชื่อ Printer, กระดาษ, วันที่/เวลา
- มีรายการทดสอบ 10.00 และ TOTAL 10.00
- ข้อความ TEST PRINT SUCCESS / Printer is ready
- คำสั่งทดสอบนี้ไม่ส่งคำสั่งเปิดลิ้นชักโดยตรง
- ลิ้นชักยังควรเปิดเฉพาะตอนชำระเงินสดจากหน้าขาย

ใช้งาน:
1. แตก ZIP
2. ถ้าโฟลเดอร์ใหม่นี้ยังไม่มี node_modules ให้รัน INSTALL_FIRST.bat
3. เปิด START_YAK_POS.bat
4. เลือก POS58 Printer > 58 mm > พิมพ์ทดสอบ
