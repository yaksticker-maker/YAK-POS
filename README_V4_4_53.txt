YAK POS V4.4.53 - STABLE RECOVERY

ฐานระบบ:
- ย้อนกลับไป V4.4.49 ซึ่งหน้าร้าน / วัตถุดิบ / รายงานยังอยู่ในชุดเสถียรกว่า
- ไม่ใช้ V4.4.50 / 51 / 52 ที่มี employee patches ซ้อนกัน

พนักงาน:
- แยก employee-v453.js ออกจาก app.js
- เพิ่ม / แก้ไข / ระงับ / ลบ
- ไม่แก้ระบบวัตถุดิบ ไม่แก้หน้าร้าน ไม่แก้รายงาน

ตรวจ:
- node --check ทุกไฟล์ JS ที่ส่ง
- ยืนยัน m33SaveLink / m35ToggleDropdown / yakCheckLinkedMaterialAvailability ยังอยู่
