/**
 * Setup.gs — ตั้งค่า Script Properties จากในโค้ด
 *
 * ใช้เมื่อหาเมนู Script Properties ใน UI ไม่เจอ
 * (หน้าตั้งค่าเป็นภาษาไทยจะใช้ชื่อว่า "พร็อพเพอร์ตี้สคริปต์"
 *  อยู่ล่างสุดของหน้า "การตั้งค่าโปรเจ็กต์")
 *
 * วิธีใช้:
 *   1. เติมค่าใน SETUP_VALUES ด้านล่าง (เว้นว่างไว้ = ไม่ตั้งค่านั้น)
 *   2. เลือกฟังก์ชัน setupScriptProperties ในแถบด้านบนของ editor
 *   3. กด Run แล้วดูผลที่ Execution log
 *   4. ตั้งค่าเสร็จแล้ว "ลบค่าที่เติมไว้ออก" เพื่อไม่ให้ค้างในโค้ด
 *
 * ค่าที่ตั้งจะอยู่ในโปรเจกต์ถาวร ไม่ผูกกับ deployment
 * และไม่ต้อง push โค้ดใหม่เพื่อให้มีผล
 */

const SETUP_VALUES = {
  /* จำเป็นเสมอ — ID ของสเปรดชีต
     ดูได้จาก URL: docs.google.com/spreadsheets/d/<ตรงนี้>/edit */
  SPREADSHEET_ID: "",

  /* รหัสเชิญพนักงาน — ตั้งเป็นอะไรก็ได้ที่เดายาก
     ลิงก์สมัครจะเป็น .../register.html?code=<รหัสนี้>
     เว้นว่าง = ปิดรับสมัครพนักงาน */
  STAFF_SIGNUP_CODE: "",

  /* ใช้ตอนย้ายมาระบบหอเดียว — dormId ของหอที่จะเก็บไว้
     (ดูรายชื่อได้จาก listDormsForCleanup ใน Migration.gs) */
  KEEP_DORM_ID: "",

  /* ค่าตั้งของหอ — ปกติไม่ต้องกรอกเอง
     ให้รัน importDormSettingsFromSheet() คัดลอกมาจากชีต Dorms */
  DORM_NAME: "",
  PROMPTPAY_ID: "",
  LINE_CHANNEL_ACCESS_TOKEN: "",
  LINE_BOT_USER_ID: ""
};

/** ชื่อค่าที่เป็นความลับ — แสดงผลแบบปิดบังเสมอ */
const SETUP_SECRET_KEYS = [
  "LINE_CHANNEL_ACCESS_TOKEN",
  "STAFF_SIGNUP_CODE",
  "INITIAL_ADMIN_PASSWORD"
];

function maskSetupValue_(name, value) {
  if (SETUP_SECRET_KEYS.indexOf(name) === -1) {
    return value;
  }

  return value.length <= 4
    ? "****"
    : "****" + value.slice(-4);
}

/**
 * เขียนค่าจาก SETUP_VALUES ลง Script Properties
 * ค่าที่เว้นว่างจะถูกข้าม (ไม่ลบของเดิม)
 */
function setupScriptProperties() {
  const properties =
    PropertiesService.getScriptProperties();

  let saved = 0;
  let skipped = 0;

  Object.keys(SETUP_VALUES).forEach(function (name) {
    const value = String(
      SETUP_VALUES[name] || ""
    ).trim();

    if (!value) {
      skipped++;
      return;
    }

    properties.setProperty(name, value);
    saved++;

    Logger.log(
      "ตั้งค่า " + name + " = " +
      maskSetupValue_(name, value)
    );
  });

  Logger.log(
    "\nบันทึก " + saved + " ค่า / ข้าม " + skipped + " ค่าที่เว้นว่าง"
  );

  if (saved > 0) {
    Logger.log(
      "อย่าลืมลบค่าที่เติมใน SETUP_VALUES ออก " +
      "เพื่อไม่ให้ความลับค้างอยู่ในโค้ด"
    );
  }

  showScriptProperties();
}

/** ดูว่าตอนนี้ตั้งค่าอะไรไว้แล้วบ้าง (ปิดบังค่าที่เป็นความลับ) */
function showScriptProperties() {
  const properties =
    PropertiesService.getScriptProperties();

  const all = properties.getProperties();
  const names = Object.keys(all).sort();

  Logger.log("\n=== Script Properties ปัจจุบัน ===");

  if (names.length === 0) {
    Logger.log("(ยังไม่มีค่าใดถูกตั้งไว้)");
    return;
  }

  names.forEach(function (name) {
    Logger.log(
      name + " = " +
      maskSetupValue_(name, String(all[name] || ""))
    );
  });

  if (!all.SPREADSHEET_ID) {
    Logger.log(
      "\n!! ยังไม่ได้ตั้ง SPREADSHEET_ID — ระบบจะใช้งานไม่ได้เลย"
    );
  }
}
