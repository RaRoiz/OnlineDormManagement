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

/* เลขห้องที่จะใช้ตรวจใน diagnoseBillLine() — แก้ตรงนี้แล้วกด Run */
const DIAGNOSE_ROOM_NO = "203";

/**
 * ไล่ตรวจการจับคู่ "บิล -> ผู้เช่า -> LINE" ของห้องหนึ่ง
 *
 * ใช้ตอนลงทะเบียน LINE สำเร็จแล้ว แต่กดส่งบิลไม่ออก
 * แก้ค่า DIAGNOSE_ROOM_NO ด้านบนให้เป็นเลขห้องที่ต้องการ
 * แล้วเลือกฟังก์ชัน diagnoseBillLine ใน editor กด Run
 */
function diagnoseBillLine() {
  const roomNo = String(DIAGNOSE_ROOM_NO).trim();

  Logger.log("=== ตรวจการส่งบิลทาง LINE ห้อง " + roomNo + " ===\n");

  /* 1) ห้อง -> roomId */
  const roomMap = getRoomMap_();
  let roomId = "";

  roomMap.forEach(function (no, id) {
    if (String(no).trim() === roomNo) {
      roomId = id;
    }
  });

  if (!roomId) {
    Logger.log("x ไม่พบห้องเลข " + roomNo + " ในชีต Rooms");
    return;
  }

  Logger.log("1. ห้อง " + roomNo + " -> roomId " + roomId);

  /* 2) ผู้เช่า ACTIVE ของห้องนี้ */
  const tenantSheet = getTenantsSheet_();
  const tenantValues = tenantSheet.getDataRange().getValues();
  const tenantIndex = getTenantHeaderIndex_(tenantValues[0]);

  let tenant = null;

  for (let i = 1; i < tenantValues.length; i++) {
    const row = tenantValues[i];

    const sameRoom =
      String(row[tenantIndex.roomId] || "").trim() === roomId;

    const isActive =
      String(row[tenantIndex.status] || "")
        .trim()
        .toUpperCase() === "ACTIVE";

    if (sameRoom && isActive) {
      tenant = {
        tenantId: String(
          row[tenantIndex.tenantId] || ""
        ).trim(),

        fullName: String(
          row[tenantIndex.fullName] || ""
        ).trim()
      };

      break;
    }
  }

  if (!tenant) {
    Logger.log(
      "x ห้องนี้ไม่มีผู้เช่าสถานะ ACTIVE — ส่งบิลไม่ได้"
    );

    return;
  }

  Logger.log(
    "2. ผู้เช่า \"" + tenant.fullName + "\"" +
    " -> tenantId [" + tenant.tenantId + "]"
  );

  /* 3) การลงทะเบียน LINE */
  const linkSheet = getLineLinksSheet_();
  const linkValues = linkSheet.getDataRange().getValues();

  let linkedTenantId = "";
  let lineUserId = "";

  for (let i = 1; i < linkValues.length; i++) {
    if (
      String(linkValues[i][3] || "").trim() === roomNo ||
      String(linkValues[i][1] || "").trim() === tenant.tenantId
    ) {
      linkedTenantId = String(linkValues[i][1] || "").trim();
      lineUserId = String(linkValues[i][0] || "").trim();
      break;
    }
  }

  if (!lineUserId) {
    Logger.log(
      "x ไม่พบการลงทะเบียน LINE ของห้องนี้ในชีต LineLinks\n" +
      "  -> ให้ผู้เช่าแอด OA แล้วพิมพ์ " + roomNo + " อีกครั้ง"
    );

    return;
  }

  Logger.log(
    "3. LineLinks -> tenantId [" + linkedTenantId + "]" +
    " lineUserId ****" + lineUserId.slice(-6)
  );

  if (linkedTenantId !== tenant.tenantId) {
    Logger.log(
      "\n!! tenantId ใน LineLinks ไม่ตรงกับผู้เช่าปัจจุบัน\n" +
      "   -> ให้ผู้เช่าพิมพ์เลขห้องใหม่อีกครั้งเพื่ออัปเดต"
    );
  }

  /* 4) บิลของผู้เช่าคนนี้ */
  const billSheet = getBillsSheet_();
  const billValues = billSheet.getDataRange().getValues();
  const billIndex = getBillHeaderIndex_(billValues[0]);

  let roomBills = 0;
  let matched = 0;

  Logger.log("\n4. บิลของห้อง " + roomNo + ":");

  for (let i = 1; i < billValues.length; i++) {
    const row = billValues[i];

    if (String(row[billIndex.roomNo] || "").trim() !== roomNo) {
      continue;
    }

    roomBills++;

    const billTenantId = String(
      row[billIndex.tenantId] || ""
    ).trim();

    const ok = billTenantId === tenant.tenantId;

    if (ok) {
      matched++;
    }

    Logger.log(
      "   " + (ok ? "ok  " : "x   ") +
      "บิล " + String(row[billIndex.billNo] || "") +
      " (" + String(row[billIndex.billingMonth] || "") + ")" +
      " สถานะ " + String(row[billIndex.paymentStatus] || "") +
      " tenantId [" + billTenantId + "]"
    );
  }

  if (roomBills === 0) {
    Logger.log("   (ยังไม่มีบิลของห้องนี้)");
    return;
  }

  Logger.log("");

  if (matched === 0) {
    Logger.log(
      "x ไม่มีบิลใบไหนที่ tenantId ตรงกับผู้เช่าปัจจุบันเลย\n" +
      "  นี่คือสาเหตุที่กดส่ง LINE แล้วขึ้นว่า " +
      "\"ยังไม่ได้ลงทะเบียน LINE\"\n\n" +
      "  เกิดจากตอนสร้างบิล ระบบคัดลอก tenantId มาจาก" +
      "รายการมิเตอร์ (Bill.gs) ถ้ามิเตอร์ถูกบันทึกตอนที่" +
      "ห้องยังไม่มีผู้เช่า หรือเป็นผู้เช่าคนก่อน ค่าจะไม่ตรง\n\n" +
      "  วิธีแก้: แก้คอลัมน์ tenantId ของบิลในชีต Bills " +
      "ให้เป็น [" + tenant.tenantId + "]\n" +
      "  หรือลบบิลแล้วสร้างใหม่จากมิเตอร์รอบใหม่"
    );

    return;
  }

  Logger.log(
    "ok มีบิลที่จับคู่ได้ " + matched + " / " + roomBills + " ใบ\n" +
    "  ใบที่ขึ้น ok ส่ง LINE ได้ ใบที่ขึ้น x จะส่งไม่ได้"
  );
}

/**
 * ตรวจการตั้งค่า LINE ทั้งเส้นทาง — ใช้ตอนกด "ส่ง LINE" แล้วเงียบ
 *
 * เลือกฟังก์ชัน diagnoseLine ใน editor แล้วกด Run
 * จะบอกว่าติดตรงไหน: token, การเชื่อมต่อ LINE, หรือยังไม่มี
 * ผู้เช่าคนไหนลงทะเบียนเลย
 */
function diagnoseLine() {
  Logger.log("=== ตรวจการตั้งค่า LINE ===\n");

  /* 1) token อยู่ใน Script Properties หรือยัง */
  const credentials = getLineCredentials_();

  if (!credentials.token) {
    Logger.log(
      "x ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN\n" +
      "  -> กดส่ง LINE จะขึ้นว่า \"ยังไม่ได้เชื่อมต่อ LINE " +
      "Official Account\"\n" +
      "  -> และ webhook จะไม่ทำงาน ผู้เช่าลงทะเบียนไม่ได้"
    );

    return;
  }

  Logger.log(
    "ok มี token แล้ว (****" +
    credentials.token.slice(-4) + ")"
  );

  Logger.log(
    credentials.botUserId
      ? "ok มี LINE_BOT_USER_ID แล้ว"
      : "!  ยังไม่มี LINE_BOT_USER_ID — ระบบยังทำงานได้ " +
        "แต่จะข้ามการตรวจว่า webhook มาจาก OA ของเราจริง\n" +
        "  -> แก้ได้โดยกรอก token ใหม่ที่หน้าโปรไฟล์ " +
        "(ระบบจะดึงค่านี้มาให้เอง)"
  );

  /* 2) token ใช้ได้จริงไหม — ถามตรงกับ LINE */
  const response = UrlFetchApp.fetch(
    "https://api.line.me/v2/bot/info",
    {
      headers: {
        Authorization: "Bearer " + credentials.token
      },
      muteHttpExceptions: true
    }
  );

  if (response.getResponseCode() >= 300) {
    Logger.log(
      "\nx LINE ปฏิเสธ token นี้ (HTTP " +
      response.getResponseCode() + ")\n" +
      "  " + response.getContentText() + "\n" +
      "  -> token หมดอายุหรือถูก revoke ให้ออกใหม่ใน " +
      "LINE Developers แล้วกรอกที่หน้าโปรไฟล์"
    );

    return;
  }

  const botInfo = JSON.parse(response.getContentText());

  Logger.log(
    "\nok LINE ยอมรับ token — OA ชื่อ \"" +
    String(botInfo.displayName || "") + "\""
  );

  if (
    credentials.botUserId &&
    credentials.botUserId !== String(botInfo.userId || "")
  ) {
    Logger.log(
      "x LINE_BOT_USER_ID ไม่ตรงกับ OA ของ token นี้!\n" +
      "  ที่เก็บไว้: " + credentials.botUserId + "\n" +
      "  ที่ถูกต้อง: " + String(botInfo.userId || "") + "\n" +
      "  -> webhook ทั้งหมดจะถูกปฏิเสธ ผู้เช่าลงทะเบียนไม่ได้\n" +
      "  -> แก้โดยกรอก token ใหม่ที่หน้าโปรไฟล์"
    );
  }

  /* 3) มีผู้เช่าลงทะเบียน LINE ไว้กี่คน */
  const sheet = getSpreadsheet_()
    .getSheetByName("LineLinks");

  if (!sheet) {
    Logger.log(
      "\nx ยังไม่มีชีต LineLinks — แปลว่ายังไม่เคยมีใคร" +
      "ลงทะเบียนสำเร็จเลยสักคน\n" +
      "  -> ให้ผู้เช่าแอด OA แล้วพิมพ์เลขห้อง (เช่น 101)\n" +
      "  -> ถ้าพิมพ์แล้วบอทไม่ตอบ = webhook ยังไม่ทำงาน " +
      "ให้เช็ค Webhook URL ใน LINE Developers"
    );

    return;
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    Logger.log(
      "\nx ชีต LineLinks ว่าง — ยังไม่มีผู้เช่าลงทะเบียน\n" +
      "  -> กดส่ง LINE จะขึ้นว่า \"ผู้เช่า ... ยังไม่ได้ลงทะเบียน LINE\""
    );

    return;
  }

  Logger.log(
    "\nok มีผู้เช่าลงทะเบียนแล้ว " +
    (values.length - 1) + " คน:"
  );

  values.slice(1).forEach(function (row) {
    Logger.log(
      "   " + String(row[2] || "(ไม่มีชื่อ)") +
      " ห้อง " + String(row[3] || "-")
    );
  });

  Logger.log(
    "\nถ้ากดส่งบิลให้คนที่อยู่ในรายชื่อนี้แล้วยังไม่ได้รับ " +
    "ให้ดูรายละเอียดข้อผิดพลาดที่เมนู \"การดำเนินการ\" " +
    "(Executions) ของ Apps Script"
  );
}
