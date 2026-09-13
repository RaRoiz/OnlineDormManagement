/**
 * Settings.gs — ค่าตั้งของหอพัก (ระบบหอเดียว)
 *
 * เดิมระบบรองรับหลายหอ ค่าตั้งของแต่ละหอเก็บเป็นแถวในชีต "Dorms"
 * และทุกชีตมีคอลัมน์ dormId กำกับว่าแถวนั้นเป็นของหอไหน
 *
 * ตอนนี้ระบบเป็นหอเดียว ค่าตั้งย้ายมาอยู่ใน Script Properties
 * ไม่ต้องมีชีต Dorms และไม่ต้องมีคอลัมน์ dormId อีกต่อไป
 *
 * ตั้งค่าที่ Apps Script → Project Settings → Script Properties
 * (หรือใช้ setupScriptProperties() ใน Setup.gs)
 *
 * ส่วนฟังก์ชันย้ายข้อมูลครั้งเดียวอยู่ใน Migration.gs
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

/** อ่านรหัสเชิญเฉพาะบัญชีเจ้าของหอ/ผู้ดูแลที่ยังเปิดใช้งาน */
function getStaffInvite(request) {
  const auth = validateToken(request.token);
  if (!auth.success) return auth;

  const own = findOwnUserRow_(auth.user.userId);
  if (own.targetRow === -1) return { success: false, message: "ไม่พบบัญชีผู้ใช้" };
  const row = own.values[own.targetRow - 1];
  const role = normalizeRole_(row[own.index.role]);
  if (!isTruthyCell_(row[own.index.active]) ||
      (role !== "OWNER" && role !== "ADMIN")) {
    return { success: false, message: "เฉพาะเจ้าของหอและผู้ดูแลระบบเท่านั้นที่ดูลิงก์เชิญได้" };
  }
  const signupCode = getOptionalProperty_("STAFF_SIGNUP_CODE");
  if (!signupCode) {
    return {
      success: false,
      message: "ยังไม่ได้ตั้งรหัสเชิญ กรุณาตั้ง STAFF_SIGNUP_CODE ใน Script Properties แล้วโหลดหน้านี้ใหม่"
    };
  }
  // ไม่ใส่รหัสเชิญใน login/session หรือ public info และไม่ cache ผลลัพธ์นี้
  return {
    success: true,
    message: "โหลดลิงก์เชิญสำเร็จ",
    data: {
      signupCode: signupCode,
      frontendUrl: getOptionalProperty_("FRONTEND_URL")
    }
  };
}

/** ดูชื่อหอแบบสาธารณะ โดยไม่ส่งรหัสเชิญ */
function getDormPublicInfo(request) {
  const dormName = getDormName_();

  if (!dormName) {
    return {
      success: false,
      message: "ลิงค์เชิญเฉพาะสมัครตำแหน่ง Staff/พนักงานเท่านั้น"
    };
  }

  return {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: { dormName: dormName }
  };
}

/**
 * ให้ OWNER แก้ไขค่าตั้งของหอ (พร้อมเพย์ / LINE OA)
 *
 * ชื่อหอไม่มีช่องให้แก้ในหน้าเว็บแล้ว — ถ้า request ไม่ส่ง
 * dormName มา จะคงค่าเดิมไว้ ไม่ล้างทิ้ง (ตั้งค่าได้ที่
 * Script Property ชื่อ DORM_NAME หรือผ่าน Setup.gs)
 */
function updateOwnDorm(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const requestedDormName = String(
    request.dormName || ""
  ).trim();

  const dormName =
    requestedDormName || getDormName_();

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
