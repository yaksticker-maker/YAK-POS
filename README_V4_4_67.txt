YAK POS V4.4.67 - BACK PAGE VISIBILITY FIX

สาเหตุหน้าตกแต่งสลิปว่าง:
CSS มี:
body.yak-backoffice [data-backpage-panel]{display:none!important}
body.yak-backoffice [data-backpage-panel].yak-page-active{display:block!important}

Navigation V4.4.61-66 ใส่เพียง class active แต่ไม่ได้ใส่ yak-page-active
จึงเห็นปุ่มถูกเลือกแต่เนื้อหายัง display:none

แก้:
- showElement เพิ่ม yak-page-active
- hideAllBackPages ลบ yak-page-active
- receipt fallback เพิ่ม yak-page-active
- hardening CSS สำหรับ receiptDesignerPanel
