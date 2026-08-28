YAK POS V4.4.57
แก้สาเหตุจริงของกราฟโดนัทบิด:
1. report-v4432.js เดิมสั่ง maintainAspectRatio:false
2. CSS เดิมสั่ง productPie กว้าง 100% แต่สูง 320px
แก้เป็นกรอบ 280x280 และ aspectRatio 1 โดยตรง
