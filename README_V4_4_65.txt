YAK POS V4.4.65 - PRODUCT EDIT ISOLATED

สาเหตุที่ V4.4.64 ยังไม่ตอบสนอง:
- ระบบแก้สินค้าอยู่ท้าย app.js
- ถ้า app.js มี runtime error ก่อนถึง controller ส่วนนี้ จะไม่มี listener ถูก bind
- node --check ตรวจได้แค่ syntax ไม่ตรวจ runtime path

V4.4.65:
- ย้ายระบบแก้สินค้าไป product-edit-v465.js
- โหลดเป็น script แยกหลัง app.js
- ใช้ capture click บน data-prod65-edit
- Modal แยก z-index สูงสุด
- บันทึกข้อมูลโดยตรงและคง Product ID
- การเชื่อมวัตถุดิบไม่หาย
