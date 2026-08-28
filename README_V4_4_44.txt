YAK POS V4.4.44 - FRONT ENTRY STANDALONE

แก้ปุ่มหน้าร้านที่กดแล้วไม่ตอบสนอง:
- ปุ่มหน้าร้านไม่พึ่ง openLogin() เดิม
- front-entry-v4444.js เปิดหน้า Login เอง
- โหลดสาขาจากฐานข้อมูล LocalStorage เอง
- ดักปุ่มเข้าสู่ระบบและ Enter สำหรับหน้าร้าน
- ถ้า logic เดิมทำงาน จะใช้ระบบเดิม
- ถ้า logic เดิมล้มเหลว มี fallback เปิด frontView
