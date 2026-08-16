/**
 * Dorm.gs — ค่าตั้งของหอพัก (ระบบหอเดียว)
 *
 * เดิมระบบรองรับหลายหอ ค่าตั้งของแต่ละหอเก็บเป็นแถวในชีต "Dorms"
 * และทุกชีตมีคอลัมน์ dormId กำกับว่าแถวนั้นเป็นของหอไหน
 *
 * ตอนนี้ระบบเป็นหอเดียว ค่าตั้งย้ายมาอยู่ใน Script Properties
 * ไม่ต้องมีชีต Dorms และไม่ต้องมีคอลัมน์ dormId อีกต่อไป
 *
 * ตั้งค่าที่ Apps Script → Project Settings → Script Properties
 */

const DORM_NAME_PROPERTY = "DORM_NAME";
const PROMPTPAY_ID_PROPERTY = "PROMPTPAY_ID";
const LINE_TOKEN_PROPERTY = "LINE_CHANNEL_ACCESS_TOKEN";
const LINE_BOT_USER_ID_PROPERTY = "LINE_BOT_USER_ID";

/** ชื่อหอ — สตริงว่างถ้ายังไม่ได้ตั้ง */
function getDormName_() {
  return getOptionalProperty_(DORM_NAME_PROPERTY);
}

/** เลขพร้อมเพย์สำหรับสร้าง QR บนบิล */
function getPromptPayId_() {
  return getOptionalProperty_(PROMPTPAY_ID_PROPERTY);
}

/** คืน { token, botUserId } — สตริงว่างถ้ายังไม่ได้เชื่อม LINE */
function getLineCredentials_() {
  return {
    token: getOptionalProperty_(LINE_TOKEN_PROPERTY),
    botUserId: getOptionalProperty_(
      LINE_BOT_USER_ID_PROPERTY
    )
  };
}

/**
 * ดูชื่อหอแบบสาธารณะ — ไม่ต้อง login
 * (หน้า register เรียกเพื่อโชว์ว่ากำลังสมัครเข้าหอชื่ออะไร)
 */
function getDormPublicInfo(request) {
  const dormName = getDormName_();

  if (!dormName) {
    return {
      success: false,
      message: "ยังไม่ได้ตั้งชื่อหอในระบบ"
    };
  }

  return {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: { dormName: dormName }
  };
}

/**
 * ให้ OWNER แก้ไขค่าตั้งของหอ (ชื่อหอ / พร้อมเพย์ / LINE OA)
 */
function updateOwnDorm(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const dormName = String(
    request.dormName || ""
  ).trim();

  if (!dormName) {
    return {
      success: false,
      message: "กรุณากรอกชื่อหอ"
    };
  }

  const promptPayDigits = String(
    request.promptPayId || ""
  ).replace(/\D/g, "");

  if (
    promptPayDigits &&
    promptPayDigits.length !== 10 &&
    promptPayDigits.length !== 13
  ) {
    return {
      success: false,
      message:
        "เบอร์พร้อมเพย์ต้องเป็นเบอร์โทร 10 หลัก หรือเลขบัตรประชาชน 13 หลัก"
    };
  }

  // ไม่ส่ง token ดิบกลับไปให้ frontend เก็บไว้เลย (แสดงแค่สถานะ
  // เชื่อมต่อ) ดังนั้นถ้าช่องนี้ว่าง แปลว่า "ไม่ได้ตั้งใจแก้"
  // ไม่ใช่ "อยากล้างค่าเดิม" — คงค่า token/botUserId เดิมไว้
  const existingLineCredentials = getLineCredentials_();

  const lineChannelAccessToken = String(
    request.lineChannelAccessToken || ""
  ).trim();

  let lineTokenToSave = existingLineCredentials.token;
  let lineBotUserId = existingLineCredentials.botUserId;

  if (
    lineChannelAccessToken &&
    lineChannelAccessToken !== existingLineCredentials.token
  ) {
    const botInfoResponse = UrlFetchApp.fetch(
      "https://api.line.me/v2/bot/info",
      {
        headers: {
          Authorization:
            "Bearer " + lineChannelAccessToken
        },
        muteHttpExceptions: true
      }
    );

    if (botInfoResponse.getResponseCode() >= 300) {
      return {
        success: false,
        message:
          "LINE Channel Access Token ไม่ถูกต้อง " +
          "กรุณาตรวจสอบอีกครั้ง"
      };
    }

    const botInfo = JSON.parse(
      botInfoResponse.getContentText()
    );

    lineBotUserId = String(
      botInfo.userId || ""
    ).trim();

    lineTokenToSave = lineChannelAccessToken;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    setProperty_(DORM_NAME_PROPERTY, dormName);

    setProperty_(
      PROMPTPAY_ID_PROPERTY,
      promptPayDigits
    );

    setProperty_(
      LINE_TOKEN_PROPERTY,
      lineTokenToSave
    );

    setProperty_(
      LINE_BOT_USER_ID_PROPERTY,
      lineBotUserId
    );

    const updatedUser = Object.assign(
      {},
      auth.user,
      {
        dormName: dormName,
        promptPayId: promptPayDigits,
        lineBotUserId: lineBotUserId
      }
    );

    CacheService.getScriptCache().put(
      `session:${request.token}`,
      JSON.stringify(updatedUser),
      SESSION_SECONDS
    );

    return {
      success: true,
      message: "บันทึกค่าตั้งของหอสำเร็จ",
      user: updatedUser
    };
  } finally {
    lock.releaseLock();
  }
}

/* =========================================
   ย้ายจากระบบหลายหอ → หอเดียว (รันครั้งเดียว)
   -----------------------------------------
   ลำดับที่ต้องทำ:

   1. สำรองสเปรดชีตก่อน (ไฟล์ → ทำสำเนา) — ขั้นตอนนี้
      ลบข้อมูลถาวร กู้คืนจากในสคริปต์ไม่ได้
   2. ตั้ง Script Property ชื่อ KEEP_DORM_ID เป็น dormId
      ของหอที่จะเก็บไว้ (ดูรายชื่อด้วย listDormsForCleanup)
   3. รัน importDormSettingsFromSheet() — คัดลอกชื่อหอ /
      พร้อมเพย์ / LINE token ของหอนั้นมาเป็น Script Properties
   4. deploy โค้ดใหม่ แล้วทดสอบว่าระบบใช้งานได้ครบ
   5. รัน previewCollapseToSingleDorm() ดูว่าจะลบอะไรบ้าง
   6. รัน collapseToSingleDorm() เมื่อมั่นใจแล้ว
========================================= */

const DORM_SCOPED_SHEETS = [
  "Users",
  "Rooms",
  "Tenants",
  "Meters",
  "Bills",
  "LineLinks"
];

/** พิมพ์รายชื่อหอทั้งหมดใน Log เพื่อเลือกว่าจะเก็บหอไหน */
function listDormsForCleanup() {
  const sheet =
    getSpreadsheet_().getSheetByName("Dorms");

  if (!sheet) {
    Logger.log("ไม่พบชีต Dorms (อาจย้ายมาระบบหอเดียวแล้ว)");
    return;
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    Logger.log("ชีต Dorms ว่าง");
    return;
  }

  Logger.log("dormId | ชื่อหอ | เจ้าของ | มี LINE token");

  values.slice(1).forEach(function (row) {
    Logger.log(
      String(row[0] || "") + " | " +
      String(row[1] || "") + " | " +
      String(row[2] || "") + " | " +
      (String(row[8] || "").trim() ? "มี" : "ไม่มี")
    );
  });

  Logger.log(
    "\nเลือก dormId ที่จะเก็บ แล้วตั้งเป็น Script Property " +
    "ชื่อ KEEP_DORM_ID"
  );
}

/**
 * คัดลอกค่าตั้งของหอที่เลือก จากชีต Dorms มาเป็น Script Properties
 * (ทำก่อน collapseToSingleDorm เพื่อไม่ต้องพิมพ์ LINE token เอง)
 */
function importDormSettingsFromSheet() {
  const keepDormId = getRequiredProperty_("KEEP_DORM_ID");

  const sheet =
    getSpreadsheet_().getSheetByName("Dorms");

  if (!sheet) {
    throw new Error("ไม่พบชีต Dorms");
  }

  const values = sheet.getDataRange().getValues();

  const row = values.slice(1).find(function (r) {
    return String(r[0] || "").trim() === keepDormId;
  });

  if (!row) {
    throw new Error(
      "ไม่พบหอ " + keepDormId + " ในชีต Dorms"
    );
  }

  setProperty_(DORM_NAME_PROPERTY, row[1]);
  setProperty_(PROMPTPAY_ID_PROPERTY, row[7]);
  setProperty_(LINE_TOKEN_PROPERTY, row[8]);
  setProperty_(LINE_BOT_USER_ID_PROPERTY, row[9]);

  Logger.log(
    "คัดลอกค่าตั้งของหอ \"" + String(row[1] || "") +
    "\" มาเป็น Script Properties แล้ว"
  );

  Logger.log(
    "พร้อมเพย์: " +
    (String(row[7] || "").trim() || "(ยังไม่ได้ตั้ง)")
  );

  Logger.log(
    "LINE token: " +
    (String(row[8] || "").trim() ? "มี" : "(ยังไม่ได้ตั้ง)")
  );
}

/** ดูว่า collapseToSingleDorm() จะลบอะไรบ้าง โดยยังไม่ลบจริง */
function previewCollapseToSingleDorm() {
  collapseToSingleDorm_(true);
}

/** ลบข้อมูลของหออื่นและคอลัมน์ dormId ออกจริง — ย้อนกลับไม่ได้ */
function collapseToSingleDorm() {
  collapseToSingleDorm_(false);
}

function collapseToSingleDorm_(isDryRun) {
  const keepDormId = getRequiredProperty_("KEEP_DORM_ID");

  Logger.log(
    (isDryRun ? "[ทดลอง] " : "[ลบจริง] ") +
    "เก็บเฉพาะหอ " + keepDormId
  );

  const spreadsheet = getSpreadsheet_();

  DORM_SCOPED_SHEETS.forEach(function (sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log(sheetName + ": ไม่พบชีต — ข้าม");
      return;
    }

    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      Logger.log(sheetName + ": ว่าง — ข้าม");
      return;
    }

    const dormIdColumn = values[0].indexOf("dormId");

    if (dormIdColumn === -1) {
      Logger.log(
        sheetName + ": ไม่มีคอลัมน์ dormId แล้ว — ข้าม"
      );

      return;
    }

    let deleted = 0;
    let blank = 0;

    // ไล่จากล่างขึ้นบน เพื่อให้เลขแถวที่ยังไม่ได้ลบไม่เลื่อน
    for (let i = values.length - 1; i >= 1; i--) {
      const rowDormId = String(
        values[i][dormIdColumn] || ""
      ).trim();

      // แถวที่ไม่มี dormId (เช่น superadmin) ไม่แตะ —
      // ปล่อยให้เจ้าของระบบตัดสินใจเองทีหลัง
      if (!rowDormId) {
        blank++;
        continue;
      }

      if (rowDormId === keepDormId) {
        continue;
      }

      if (!isDryRun) {
        sheet.deleteRow(i + 1);
      }

      deleted++;
    }

    if (!isDryRun) {
      sheet.deleteColumn(dormIdColumn + 1);
    }

    Logger.log(
      sheetName + ": " +
      (isDryRun ? "จะลบ " : "ลบแล้ว ") + deleted + " แถว" +
      (blank
        ? " (ข้าม " + blank + " แถวที่ไม่มี dormId)"
        : "") +
      (isDryRun ? " และจะลบคอลัมน์ dormId" : "")
    );
  });

  const dormsSheet = spreadsheet.getSheetByName("Dorms");

  if (dormsSheet) {
    if (!isDryRun) {
      spreadsheet.deleteSheet(dormsSheet);
    }

    Logger.log(
      isDryRun
        ? "Dorms: จะลบทั้งชีต"
        : "Dorms: ลบทั้งชีตแล้ว"
    );
  }

  if (!isDryRun) {
    bumpDormCache_();
  }

  Logger.log(
    isDryRun
      ? "\nนี่คือการทดลองเท่านั้น ยังไม่มีอะไรถูกลบ " +
        "ถ้าถูกต้องแล้วให้รัน collapseToSingleDorm()"
      : "\nย้ายมาระบบหอเดียวเรียบร้อย"
  );
}
