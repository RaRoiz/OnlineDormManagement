# 🏠 Online Dorm Management — ระบบจัดการหอพักออนไลน์

เว็บแอปสำหรับบริหารหอพักครบวงจร: จัดการห้องพัก ผู้เช่า จดมิเตอร์น้ำ-ไฟ
ออกใบแจ้งหนี้ ส่งบิลเข้า LINE ของผู้เช่า และดูรายงานสรุปภาพรวม
— ใช้ **Google Sheets เป็นฐานข้อมูล** ผ่าน Google Apps Script จึงไม่มีค่าเซิร์ฟเวอร์

## ✨ ฟีเจอร์หลัก

| ฟีเจอร์ | รายละเอียด |
|---|---|
| 🔐 ระบบผู้ใช้ | สมัครสมาชิก / เข้าสู่ระบบ พร้อมสิทธิ์ 2 ระดับ (OWNER / USER) |
| 🏠 ห้องพัก | เพิ่ม แก้ไข ค้นหา กรองตามเลขห้อง ชั้น ประเภท สถานะว่าง/ไม่ว่าง |
| 👤 ผู้เช่า | ทะเบียนผู้เช่า เช็คอิน / ย้ายออก ผูกกับห้องพักอัตโนมัติ |
| ⚡ มิเตอร์น้ำ-ไฟ | จดหน่วยประจำเดือน คำนวณค่าใช้จ่ายอัตโนมัติ ดึงเลขมิเตอร์ครั้งก่อนให้เอง |
| 🧾 ใบแจ้งหนี้ | สร้างบิลจากค่าเช่า + ค่าน้ำ-ไฟ + ค่าใช้จ่ายเพิ่มเติม ติดตามสถานะ ชำระ/ค้าง/เกินกำหนด |
| 💬 ส่งบิลทาง LINE | ผู้เช่าแอด LINE OA แล้วพิมพ์เลขห้องเพื่อลงทะเบียน จากนั้นกดส่งบิลจากหน้าเว็บได้เลย |
| 🖨️ พิมพ์บิล / PDF | ปุ่มพิมพ์ต่อบิล เปิดใบแจ้งหนี้พร้อมพิมพ์หรือ Save as PDF |
| 📊 Dashboard & Report | การ์ดสรุป (อัตราเข้าพัก บิลค้าง รายรับ) + รายงานแยกประเภทพร้อมฟิลเตอร์ |
| 🌗 ธีมสว่าง/มืด | สลับได้จากปุ่มลอยมุมจอ จำค่าที่เลือกไว้ และตามการตั้งค่าระบบโดยอัตโนมัติ |
| 📱 Responsive | ใช้ได้ทั้งคอมพิวเตอร์และมือถือ (ตารางตรึงคอลัมน์แรก ปุ่มขนาดนิ้วกด) |

## 🧱 สถาปัตยกรรม

```
┌────────────────┐   fetch (JSON)   ┌───────────────────┐   read/write   ┌───────────────┐
│  Frontend       │ ───────────────► │  Google Apps       │ ─────────────► │  Google Sheets │
│  Vite + TS      │ ◄─────────────── │  Script (Web App)  │ ◄───────────── │  (Database)    │
└────────────────┘                  └─────────┬─────────┘                └───────────────┘
                                              │ Messaging API
                                              ▼
                                        ┌──────────┐
                                        │ LINE OA  │ ──► ผู้เช่า
                                        └──────────┘
```

- **Frontend** — Vite + TypeScript (ไม่มี framework), multi-page app, CSS design token กลางไฟล์เดียว
- **Backend** — Google Apps Script deploy เป็น Web App รับ action ผ่าน `doPost`
- **Database** — Google Sheets (ชีต `Users`, `Rooms`, `Tenants`, `Meters`, `Bills`, `LineLinks`)
- **Cache** — CacheService ฝั่ง Apps Script (session + ผลอ่านข้อมูล ล้างอัตโนมัติเมื่อมีการเขียน)

## 📁 โครงสร้างโปรเจ็กต์

```
OnlineDormManagement/
├── frontend/
│   ├── index.html              # หน้า Home (เมนูหลัก)
│   ├── login.html              # เข้าสู่ระบบ
│   └── src/
│       ├── pages/              # หน้า room / tenant / meter / bill / report / register
│       ├── services/           # ตัวเรียก API แยกตามโมดูล
│       ├── styles/theme.css    # Design tokens + คอมโพเนนต์กลาง (สว่าง/มืด)
│       ├── types/              # TypeScript types + apiRequest
│       └── utils/              # auth guard, dialog, toast, theme toggle
└── backend/                    # โค้ด Apps Script (sync ด้วย clasp)
    ├── Code.js                 # Router (doPost) + ตรวจสิทธิ์ตามบทบาท
    ├── Auth.js                 # login / register / session
    ├── Room.js  Tenant.js  Meter.js  Bill.js  Report.js
    ├── Line.js                 # Webhook + ส่งบิลทาง LINE
    └── Performance.js          # Cache, endpoint รวม, spreadsheet handle กลาง
```

## 🔑 สิทธิ์การใช้งาน (Role)

| การกระทำ | OWNER | USER |
|---|:-:|:-:|
| ดูข้อมูลทุกหน้า (ยกเว้น Report) | ✅ | ✅ |
| ห้องพัก: เพิ่ม / แก้ไข / ลบ | ✅ | ❌ (ดูอย่างเดียว) |
| ผู้เช่า & มิเตอร์: เพิ่ม / แก้ไข | ✅ | ✅ |
| ผู้เช่า & มิเตอร์: ลบ | ✅ | ❌ |
| บิล: สร้าง / แก้ไข / ชำระ / ลบ / ส่ง LINE | ✅ | ✅ |
| Dashboard / Report | ✅ | ❌ |

> สิทธิ์ถูกบังคับ 2 ชั้น: ซ่อนปุ่มที่ frontend และตรวจ role ซ้ำที่ backend (`ownerOnly_`)

## 🚀 เริ่มต้นใช้งาน

### 1) Frontend (dev)

```bash
cd frontend
npm install
npm run dev        # เปิด http://localhost:5173
npm run build      # build ลง dist/
```

### 2) Backend (Google Apps Script)

1. สร้าง Google Sheet แล้วคัดลอก Spreadsheet ID
2. สร้างโปรเจ็กต์ Apps Script แล้ว sync โค้ดจากโฟลเดอร์ `backend/` ด้วย [clasp](https://github.com/google/clasp)
   ```bash
   npm i -g @google/clasp
   clasp login
   cd backend
   clasp push
   ```
3. ตั้งค่า **Script Properties** (Project Settings → Script Properties)

   | Property | ค่า |
   |---|---|
   | `SPREADSHEET_ID` | ID ของ Google Sheet |
   | `LINE_CHANNEL_ACCESS_TOKEN` | token จาก LINE Developers (ถ้าใช้ฟีเจอร์ LINE) |

4. รันฟังก์ชัน `createInitialAdmin` หนึ่งครั้งเพื่อสร้างบัญชีแอดมินเริ่มต้น
5. **Deploy → New deployment → Web app** (Execute as: Me · Access: Anyone)
   แล้วนำ URL `/exec` ไปใส่ใน `frontend/src/types/api.ts`

> ⚠️ ทุกครั้งที่แก้โค้ด backend: `clasp push` → Manage deployments → ✏️ → **New version** → Deploy

### 3) LINE Messaging API (ถ้าต้องการส่งบิลทาง LINE)

1. สร้าง LINE Official Account ที่ [manager.line.biz](https://manager.line.biz) แล้วเปิดใช้ Messaging API
2. คัดลอก Channel Access Token ใส่ Script Properties ตามตารางด้านบน
3. ตั้ง **Webhook URL** = Web App URL (`/exec`) และเปิด Use webhook
   (ปุ่ม Verify จะขึ้น error 302 — เป็นข้อจำกัดปกติของ Apps Script ใช้งานจริงได้)
4. ปิด Auto-reply / Greeting messages ของ OA
5. ให้ผู้เช่าแอด OA แล้วพิมพ์เลขห้องของตัวเอง ระบบจะจับคู่อัตโนมัติ

## ☁️ Deploy Frontend

แนะนำ [Vercel](https://vercel.com) (ฟรี, deploy อัตโนมัติเมื่อ push GitHub):

- Root Directory: `frontend`
- Build Command: `npm run build`
- Output Directory: `dist`

## 🛠️ เทคโนโลยี

`Vite` · `TypeScript` · `CSS Custom Properties` · `Google Apps Script` ·
`Google Sheets` · `LINE Messaging API` · ฟอนต์ `Kanit` + `Anuphan`
