# คู่มือเร่งความเร็ว Google Sheets (Apps Script)

โค้ดหลักอยู่ใน `Performance.gs` — **วางเป็นไฟล์ใหม่** ใน Apps Script editor ได้เลย
ไม่ทับของเดิม แล้วทำตามขั้นตอนด้านล่างทีละข้อ (ทำข้อ 1–2 ก็เร็วขึ้นชัดเจนแล้ว)

> ลำดับความคุ้ม: ข้อ 3 (รวม request) > ข้อ 1 (cache) > ข้อ 4 (openById)

---

## ขั้นที่ 0 — วางไฟล์

1. เปิด Apps Script editor ของโปรเจกต์
2. Files → `+` → Script → ตั้งชื่อ `Performance`
3. คัดลอกเนื้อหา `Performance.gs` ทั้งไฟล์ไปวาง

ยังไม่ต้อง deploy — ทำขั้นถัดไปให้ครบก่อน

---

## ขั้นที่ 1 — เปิดใช้ cache ฝั่งอ่าน (แก้ Code.gs 4 บรรทัด)

ใน `doPost` เปลี่ยน case อ่านรายการให้ชี้ไปตัวที่มี cache:

```js
case "getRooms":
  return jsonResponse(getRoomsCached(request));

case "getTenants":
  return jsonResponse(getTenantsCached(request));

case "getMeters":
  return jsonResponse(getMetersCached(request));

case "getBills":
  return jsonResponse(getBillsCached(request));
```

## ขั้นที่ 2 — ล้าง cache เมื่อมีการเขียน (สำคัญ! ห้ามข้าม)

ถ้าเปิด cache โดยไม่ล้างตอนเขียน หน้าจอจะไม่เห็นข้อมูลใหม่หลังบันทึก
เพิ่ม **บรรทัดเดียว** ก่อน `return` ที่สำเร็จ ในทุกฟังก์ชันเขียน:

```js
bumpDormCache_();
```

จุดที่ต้องเพิ่ม:

| ไฟล์ | ฟังก์ชัน |
|---|---|
| Room.gs | `createRoom`, `updateRoom`, `deleteRoom` |
| Tenant.gs | `createTenant`, `updateTenant`, `checkoutTenant`, `deleteTenant` |
| Meter.gs | `createMeter`, `updateMeter`, `deleteMeter` |
| Bill.gs | `createBill`, `updateBill`, `markBillPaid`, `deleteBill` |

ตัวอย่าง (createRoom ใน Room.gs):

```js
    sheet.appendRow([ ... ]);

    bumpDormCache_();   // ← เพิ่มบรรทัดนี้

    return {
      success: true,
      message: "เพิ่มห้องพักสำเร็จ",
      data: createdRoom
    };
```

> เหตุผลที่ bump ทีเดียวล้างหมด: สถานะห้อง (ว่าง/ไม่ว่าง) คำนวณจากชีต Tenants
> ดังนั้นแก้ผู้เช่าก็ต้องล้าง cache ห้องด้วย — ใช้ version เดียวปลอดภัยสุด

---

## ขั้นที่ 3 — endpoint รวม (ลดเวลาโหลดหน้า ~60–70%)

เพิ่ม case ใหม่ใน `doPost` (Code.gs):

```js
case "getBillPageData":
  return jsonResponse(getBillPageData(request));

case "getMeterPageData":
  return jsonResponse(getMeterPageData(request));

case "getTenantPageData":
  return jsonResponse(getTenantPageData(request));

case "getReportPageData":
  return jsonResponse(getReportPageData(request));
```

หลัง deploy แล้ว บอกได้เลย เดี๋ยวแก้ฝั่ง frontend ให้เรียก action เดียวแทน
(ตอนนี้หน้า Bill ยิง 3 request, Report 3, Meter 2, Tenant 2 —
แต่ละ request มี overhead ของ Apps Script ~1–2 วินาที)

---

## ขั้นที่ 4 — เลิกเปิด Spreadsheet ซ้ำ

ในไฟล์เดิมทุกจุดที่เขียน:

```js
SpreadsheetApp.openById(SPREADSHEET_ID)
```

เปลี่ยนเป็น:

```js
getSpreadsheet_()
```

จุดที่เจอในโค้ดชุดนี้: `Room.gs` (`getRoomsSheet_`, `getOccupiedRoomIds_`),
`Auth.gs` (`login`), และจุดลักษณะเดียวกันใน Tenant.gs / Meter.gs / Bill.gs
— request เดียวที่เคยเปิด 2–3 รอบจะเหลือรอบเดียว (ประหยัดหลายร้อย ms/รอบ)

---

## ขั้นที่ 5 — deploy

Deploy → Manage deployments → เลือก deployment เดิม → ✏️ Edit →
Version: **New version** → Deploy (URL เดิม ไม่ต้องแก้ frontend)

## ทดสอบว่าได้ผล

1. เปิดหน้าห้องพัก 2 ครั้งติดกัน — ครั้งที่สองควรเร็วขึ้นชัดเจน (cache hit)
2. เพิ่มห้องใหม่ → รายการต้องแสดงห้องใหม่ทันที (bumpDormCache_ ทำงาน)
3. ถ้ารายการไม่อัปเดตหลังบันทึก = ลืมใส่ `bumpDormCache_()` ในฟังก์ชันเขียนตัวใดตัวหนึ่ง

---

## เคล็ดลับเสริม: sync โค้ดกับ GitHub อัตโนมัติด้วย clasp

แทนที่จะคัดลอกมือทุกครั้ง:

```bash
npm i -g @google/clasp
clasp login
cd backend
clasp clone <SCRIPT_ID>   # ครั้งแรกครั้งเดียว
clasp pull                # ดึงโค้ดล่าสุดจาก Apps Script
clasp push                # ส่งโค้ดในเครื่องขึ้น Apps Script
```

`SCRIPT_ID` ดูได้จาก Apps Script → Project Settings
(ตอนนี้ mirror ใน repo ขาดไฟล์ Bill/Report/Register อยู่ — `clasp pull` ทีเดียวได้ครบ)
