YAK POS V4.4.43 - FRONT STORE LOGIN FIX

สาเหตุที่เข้าหน้าร้านไม่ได้:
V4.4.38 มี renderProducts() อ้างตัวแปร searchInput ที่ไม่มีอยู่จริง
เมื่อ Login สำเร็จ JavaScript จึงหยุดก่อน showView('frontView').

แก้แล้ว:
- ใช้ #productSearch โดยตรง
- ใช้ #productGrid โดยตรง
- แยก try/catch งาน render หน้าร้าน ไม่ให้ส่วนหนึ่งพังแล้วบล็อกการเข้า
- บังคับ body เป็น yak-front หลัง Login สำเร็จ
- ปุ่มหน้าร้านใช้ yakOpenFrontLogin() เพื่อเปิด Login อย่างปลอดภัย
