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

  /* ย้ายที่เก็บรูปสลิป — ID ของโฟลเดอร์ปลายทาง
     ดูได้จาก URL: drive.google.com/drive/folders/<ตรงนี้>
     ใช้ Shared Drive (ไดรฟ์ที่แชร์) ได้ ช่วยเรื่องโควตาพื้นที่
     เว้นว่าง = ใช้โฟลเดอร์ "DormManagement Slips" ใน My Drive ตามเดิม */
  SLIP_FOLDER_ID: "",

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

/**
 * ตรวจการตั้งค่า LINE ฝั่ง "ขาเข้า" (webhook)
 *
 * ใช้ตอนที่ส่งบิลออกไปได้ แต่ผู้เช่าส่งข้อความ/สลิปกลับมาแล้วเงียบ
 * เพราะการส่งออกใช้แค่ token ส่วนการรับต้องตั้ง Webhook URL ด้วย
 *
 * เลือกฟังก์ชัน diagnoseLineSetup ใน editor แล้วกด Run
 */
function diagnoseLineSetup() {
  Logger.log("=== ตรวจการตั้งค่า LINE ===\n");

  const credentials = getLineCredentials_();

  if (!credentials.token) {
    Logger.log(
      "x ยังไม่ได้ตั้ง LINE_CHANNEL_ACCESS_TOKEN — จบเลย"
    );

    return;
  }

  Logger.log("1. token: ตั้งไว้แล้ว");

  /* ถาม LINE ว่า token นี้เป็นของบอทตัวไหน */
  const infoResponse = UrlFetchApp.fetch(
    "https://api.line.me/v2/bot/info",
    {
      headers: {
        Authorization: "Bearer " + credentials.token
      },
      muteHttpExceptions: true
    }
  );

  if (infoResponse.getResponseCode() >= 300) {
    Logger.log(
      "x token ใช้ไม่ได้: " + infoResponse.getContentText()
    );

    return;
  }

  const info = JSON.parse(infoResponse.getContentText());
  const realBotUserId = String(info.userId || "").trim();

  Logger.log(
    "2. บอทชื่อ \"" + String(info.displayName || "") + "\"" +
    " userId ****" + realBotUserId.slice(-6)
  );

  /* จุดที่พลาดง่ายสุด — handleLineWebhook_ จะทิ้ง event เงียบๆ
     ถ้า LINE_BOT_USER_ID ที่เก็บไว้ไม่ตรงกับ destination ที่ส่งมา */
  if (!credentials.botUserId) {
    Logger.log(
      "3. LINE_BOT_USER_ID: ยังไม่ได้ตั้ง " +
      "(ไม่เป็นไร ระบบจะข้ามการตรวจ destination)"
    );
  } else if (credentials.botUserId !== realBotUserId) {
    Logger.log(
      "3. x LINE_BOT_USER_ID ไม่ตรงกับบอทจริง!\n" +
      "   ที่เก็บไว้ ****" + credentials.botUserId.slice(-6) +
      " แต่จริงคือ ****" + realBotUserId.slice(-6) + "\n" +
      "   -> ทุก webhook จะถูกทิ้งเงียบๆ นี่คือสาเหตุ\n" +
      "   -> แก้โดยตั้ง LINE_BOT_USER_ID ใหม่ให้ตรง " +
      "หรือเข้าหน้าโปรไฟล์แล้ววาง token ใหม่อีกครั้ง"
    );
  } else {
    Logger.log("3. LINE_BOT_USER_ID: ตรงกับบอทจริง");
  }

  /* ถาม LINE ว่าตั้ง Webhook URL ไว้หรือยัง */
  const hookResponse = UrlFetchApp.fetch(
    "https://api.line.me/v2/bot/channel/webhook/endpoint",
    {
      headers: {
        Authorization: "Bearer " + credentials.token
      },
      muteHttpExceptions: true
    }
  );

  if (hookResponse.getResponseCode() >= 300) {
    Logger.log(
      "4. x ยังไม่ได้ตั้ง Webhook URL ใน LINE Developers Console\n" +
      "   -> นี่คือสาเหตุที่ส่งข้อความกลับมาแล้วเงียบ\n" +
      "   (" + hookResponse.getContentText() + ")"
    );
  } else {
    const hook = JSON.parse(hookResponse.getContentText());

    Logger.log(
      "4. Webhook URL: " + String(hook.endpoint || "(ว่าง)")
    );

    Logger.log(
      "   เปิดใช้งาน: " +
      (hook.active ? "ใช่" : "x ไม่ได้เปิด — ต้องเปิด Use webhook")
    );

    /* getUrl() ต้องขอสิทธิ์เพิ่ม บางโปรเจกต์เรียกไม่ได้ —
       ไม่ให้ล้มทั้งการตรวจเพราะข้อนี้ */
    let deployedUrl = "";

    try {
      deployedUrl = ScriptApp.getService().getUrl() || "";
    } catch (error) {
      Logger.log("   (อ่าน URL ของสคริปต์ไม่ได้: " + error + ")");
    }

    if (deployedUrl) {
      Logger.log("   URL ของสคริปต์นี้: " + deployedUrl);

      if (
        hook.endpoint &&
        String(hook.endpoint).indexOf(deployedUrl) !== 0
      ) {
        Logger.log(
          "   !! Webhook ชี้ไปคนละ URL กับ deployment ปัจจุบัน\n" +
          "      -> แก้ URL ใน LINE Developers Console ให้ตรง"
        );
      }
    }
  }

  /* Drive ใช้เก็บรูปสลิป — ทำซ้ำทั้ง 3 ขั้นที่โค้ดรับสลิปทำจริง
     (หาโฟลเดอร์ / สร้างไฟล์ / ตั้งค่าแชร์) เพื่อชี้ให้ชัดว่าล้มขั้นไหน
     แล้วลบไฟล์ทดสอบทิ้ง */
  let testFolder;

  try {
    testFolder = getSlipFolder_();

    Logger.log(
      "5a. Drive: เข้าถึงโฟลเดอร์ \"" +
      testFolder.getName() + "\" ได้ (" +
      (getOptionalProperty_("SLIP_FOLDER_ID")
        ? "จาก SLIP_FOLDER_ID"
        : "โฟลเดอร์เริ่มต้นใน My Drive") +
      ")\n    " + testFolder.getUrl()
    );
  } catch (error) {
    Logger.log(
      "5a. x หาโฟลเดอร์เก็บสลิปไม่ได้: " + error + "\n" +
      "    -> ต้องอนุญาตสิทธิ์ Drive ใหม่ " +
      "(รันฟังก์ชันนี้จาก editor แล้วกดอนุญาต)"
    );
  }

  if (testFolder) {
    let testFile;

    try {
      testFile = testFolder.createFile(
        Utilities.newBlob(
          "diagnose",
          "text/plain",
          "diagnose-slip-test.txt"
        )
      );

      Logger.log("5b. Drive: สร้างไฟล์ได้");
    } catch (error) {
      Logger.log(
        "5b. x สร้างไฟล์ใน Drive ไม่ได้: " + error + "\n" +
        "    -> มักเกิดจากพื้นที่ Drive เต็ม " +
        "หรือสิทธิ์ Drive ยังไม่ได้อนุญาต"
      );
    }

    if (testFile) {
      try {
        testFile.setSharing(
          DriveApp.Access.ANYONE_WITH_LINK,
          DriveApp.Permission.VIEW
        );

        Logger.log("5c. Drive: ตั้งค่าแชร์ลิงก์ได้");
      } catch (error) {
        Logger.log(
          "5c. ! ตั้งค่าแชร์ลิงก์ไม่ได้: " + error + "\n" +
          "    -> สลิปยังบันทึกได้ปกติ แต่ลิงก์จะเปิดได้เฉพาะ" +
          "บัญชีเจ้าของหอ (บัญชีองค์กรมักปิดการแชร์ออกนอก)"
        );
      }

      testFile.setTrashed(true);
    }
  }

  /* มีใครลงทะเบียน LINE ไว้บ้าง */
  const links = getLineLinksSheet_()
    .getDataRange()
    .getValues();

  Logger.log(
    "6. ผู้เช่าที่ลงทะเบียน LINE แล้ว: " +
    Math.max(0, links.length - 1) + " คน"
  );

  Logger.log(
    "\nถ้าทุกข้อผ่านแต่ยังเงียบ ให้ส่งข้อความหาบอทแล้วดูที่เมนู " +
    "\"การดำเนินการ\" (Executions) ว่ามี doPost วิ่งหรือไม่\n" +
    "ถ้าไม่มีเลย = webhook ไม่ถึงสคริปต์\n" +
    "ถ้ามีแต่ Failed = กดดูรายละเอียดข้อผิดพลาดได้"
  );
}

/**
 * บอกว่าสคริปต์ทำงานด้วยบัญชี Google ไหน
 *
 * ใช้ตอนจะให้คนอื่นแชร์โฟลเดอร์เก็บสลิปมาให้ — ต้องแชร์มาที่อีเมล
 * ที่ฟังก์ชันนี้พิมพ์ออกมา และให้สิทธิ์ระดับ "ผู้แก้ไข" (Editor)
 */
function showScriptAccount() {
  Logger.log(
    "สคริปต์ทำงานด้วยบัญชี: " +
    Session.getEffectiveUser().getEmail() + "\n" +
    "-> ให้เจ้าของโฟลเดอร์แชร์มาที่อีเมลนี้ สิทธิ์ \"ผู้แก้ไข\""
  );
}

/**
 * ตรวจว่า SLIP_FOLDER_ID ที่ตั้งไว้ใช้ได้จริงหรือไม่
 *
 * ทดสอบครบทั้งเข้าถึง / เขียนไฟล์ แล้วลบไฟล์ทดสอบทิ้ง
 * รันก่อนใช้งานจริงเพื่อไม่ให้ไปพังตอนผู้เช่าส่งสลิป
 */
function checkSlipFolder() {
  const folderId = getOptionalProperty_("SLIP_FOLDER_ID");

  if (!folderId) {
    Logger.log(
      "ยังไม่ได้ตั้ง SLIP_FOLDER_ID\n" +
      "-> ระบบจะใช้โฟลเดอร์ \"DormManagement Slips\" " +
      "ใน My Drive ของบัญชีสคริปต์"
    );

    return;
  }

  let folder;

  try {
    folder = DriveApp.getFolderById(folderId);
  } catch (error) {
    Logger.log(
      "x เปิดโฟลเดอร์ตาม SLIP_FOLDER_ID ไม่ได้: " + error + "\n" +
      "-> ตรวจว่าคัดลอก ID มาถูก (เอาเฉพาะส่วนหลัง /folders/)\n" +
      "-> และเจ้าของโฟลเดอร์แชร์มาให้ " +
      Session.getEffectiveUser().getEmail() +
      " แล้วหรือยัง"
    );

    return;
  }

  Logger.log(
    "โฟลเดอร์: \"" + folder.getName() + "\"\n" +
    "เจ้าของ: " +
    (folder.getOwner()
      ? folder.getOwner().getEmail()
      : "ไดรฟ์ที่แชร์ (Shared Drive)") + "\n" +
    folder.getUrl()
  );

  try {
    const testFile = folder.createFile(
      Utilities.newBlob(
        "check",
        "text/plain",
        "check-slip-folder.txt"
      )
    );

    testFile.setTrashed(true);

    Logger.log("OK เขียนไฟล์ลงโฟลเดอร์นี้ได้ พร้อมใช้งาน");
  } catch (error) {
    Logger.log(
      "x เขียนไฟล์ไม่ได้: " + error + "\n" +
      "-> ต้องได้สิทธิ์ระดับ \"ผู้แก้ไข\" (Editor) ไม่ใช่ \"ผู้อ่าน\""
    );
  }
}
