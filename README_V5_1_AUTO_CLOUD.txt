YAK POS V5.1 AUTO CLOUD

เพิ่มจาก V5.0:
- จำ Project URL + Publishable Key ใน browser เดิม
- เปิดเว็บครั้งถัดไปเชื่อมต่อ Supabase อัตโนมัติ
- ดึงข้อมูล Cloud ล่าสุดอัตโนมัติ
- saveDB จะส่งขึ้น Cloud อัตโนมัติเมื่อ Online
- Realtime รับข้อมูลจากเครื่องอื่น
- ปุ่มคัดลอกการตั้งค่า Cloud
- ปุ่มนำเข้าการตั้งค่า Cloud สำหรับเครื่องใหม่

หมายเหตุ:
- เครื่องใหม่ยังต้องตั้งค่า Cloud ครั้งแรก 1 ครั้ง เพราะ browser คนละเครื่องไม่มี localStorage ร่วมกัน
- ใช้ปุ่ม “คัดลอกการตั้งค่า Cloud” จากเครื่องหลัก แล้ว “นำเข้าการตั้งค่า Cloud” ที่เครื่องใหม่ได้
- Publishable/Anon key เท่านั้น ห้ามใช้ service_role/secret key
