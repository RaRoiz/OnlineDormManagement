/**
 * อ่านค่าลับจาก Script Properties — ไม่มีค่า fallback ในโค้ด
 * เพราะไฟล์นี้ขึ้น GitHub ถ้า property หาย ให้ล้มทันที
 * ดีกว่าเผลอไปใช้ค่าที่ฝังไว้ในโค้ด
 *
 * Apps Script → Project Settings → Script Properties
 */
function getRequiredProperty_(name) {
  const value = String(
    PropertiesService
      .getScriptProperties()
      .getProperty(name) || ""
  ).trim();

  if (!value) {
    throw new Error(
      "ยังไม่ได้ตั้งค่า Script Property: " + name +
      " (Apps Script → Project Settings → Script Properties)"
    );
  }

  return value;
}

/** อ่านค่าตั้งที่ "ไม่มีก็ได้" — คืนสตริงว่างถ้ายังไม่ได้ตั้ง */
function getOptionalProperty_(name) {
  return String(
    PropertiesService
      .getScriptProperties()
      .getProperty(name) || ""
  ).trim();
}

/** เขียนค่าตั้ง — ค่าว่างคือลบ property นั้นทิ้ง */
function setProperty_(name, value) {
  const properties =
    PropertiesService.getScriptProperties();

  const text = String(value || "").trim();

  if (text) {
    properties.setProperty(name, text);
  } else {
    properties.deleteProperty(name);
  }
}

/**
 * ID ของสเปรดชีต — อ่าน "ตอนใช้งาน" ไม่ใช่ตอนโหลดสคริปต์
 *
 * ถ้าอ่านเป็น const ระดับบนสุด แล้วยังไม่ได้ตั้งค่า Property
 * สคริปต์จะ throw ตั้งแต่ก่อนเข้า doPost ทำให้ Apps Script
 * ตอบกลับเป็นหน้า HTML error ซึ่งไม่มี CORS header
 * หน้าเว็บจึงเห็นแค่ "Failed to fetch" โดยไม่รู้สาเหตุ
 *
 * พออ่านตอนรัน error จะเกิดข้างใน doPost ซึ่งมี try/catch
 * ครอบอยู่แล้ว ผู้ใช้เลยได้ข้อความบอกสาเหตุจริงเป็น JSON
 */
function getSpreadsheetId_() {
  return getRequiredProperty_("SPREADSHEET_ID");
}

const USERS_SHEET = "Users";
const SESSION_SECONDS = 21600; // 6 ชั่วโมง

/* ========== กันเดารหัสผ่านรัวๆ ==========
   Apps Script อ่าน IP ของผู้เรียกไม่ได้ จึงนับตาม
   username ได้อย่างเดียว — แลกมากับการที่คนอื่น
   จงใจยิงผิดเพื่อล็อกบัญชีเราได้ (ยอมรับได้กว่า
   ปล่อยให้เดารหัสผ่านไม่จำกัด) */

const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_LOCKOUT_SECONDS = 900; // 15 นาที

function loginFailureKey_(username) {
  return "loginfail:" + username;
}

function loginFailureCount_(username) {
  const value = CacheService
    .getScriptCache()
    .get(loginFailureKey_(username));

  return value ? Number(value) : 0;
}

function recordLoginFailure_(username) {
  CacheService.getScriptCache().put(
    loginFailureKey_(username),
    String(loginFailureCount_(username) + 1),
    LOGIN_LOCKOUT_SECONDS
  );
}

function clearLoginFailures_(username) {
  CacheService
    .getScriptCache()
    .remove(loginFailureKey_(username));
}

function login(request) {
  const username = String(request.username || "").trim().toLowerCase();
  const password = String(request.password || "");

  if (!username || !password) {
    return {
      success: false,
      message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน"
    };
  }

  if (loginFailureCount_(username) >= LOGIN_MAX_ATTEMPTS) {
    return {
      success: false,
      message:
        "ใส่รหัสผ่านผิดเกินกำหนด กรุณารอ 15 นาทีแล้วลองใหม่"
    };
  }

  // ใช้ handle กลางจาก Performance.js
  const sheet = getSpreadsheet_()
    .getSheetByName(USERS_SHEET);

  if (!sheet) {
    throw new Error("ไม่พบชีต Users");
  }

  const values = sheet.getDataRange().getValues();

  if (values.length < 2) {
    return {
      success: false,
      message: "ยังไม่มีผู้ใช้งานในระบบ"
    };
  }

  const headers = values[0];
  const userIndex = createHeaderIndex(headers);

  for (let rowIndex = 1; rowIndex < values.length; rowIndex++) {
    const row = values[rowIndex];

    const storedUsername = String(row[userIndex.username] || "")
      .trim()
      .toLowerCase();

    const activeValue = row[userIndex.active];

    const isActive = activeValue === true ||String(activeValue)
    .trim()
    .toLowerCase() === "true" ||
  String(activeValue).trim() === "1";

    if ( storedUsername === username &&isActive
    ) 
      {
      const salt = String(row[userIndex.salt] || "");
      const storedHash = String(row[userIndex.passwordHash] || "");
      const passwordHash = hashPassword(password, salt);

      if (passwordHash !== storedHash) {
        break;
      }

      const user = {
        userId: String(row[userIndex.userId]),
        username: String(row[userIndex.username]),
        fullName: String(row[userIndex.fullName]),
        role: String(row[userIndex.role]),
        dormName: getDormName_(),
        promptPayId: getPromptPayId_(),
        lineBotUserId: getLineCredentials_().botUserId
      };

      const token = Utilities.getUuid();
      const cache = CacheService.getScriptCache();

      cache.put(
        `session:${token}`,
        JSON.stringify(user),
        SESSION_SECONDS
      );

      clearLoginFailures_(username);

      return {
        success: true,
        message: "เข้าสู่ระบบสำเร็จ",
        token,
        user
      };
    }
  }

  recordLoginFailure_(username);

  return {
    success: false,
    message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"
  };
}

function validateToken(token) {
  if (!token) {
    return {
      success: false,
      message: "ไม่พบ Token"
    };
  }

  const cache = CacheService.getScriptCache();
  const session = cache.get(`session:${token}`);

  if (!session) {
    return {
      success: false,
      message: "Session หมดอายุ กรุณาเข้าสู่ระบบใหม่"
    };
  }

  return {
    success: true,
    user: JSON.parse(session)
  };
}

function logout(token) {
  if (token) {
    CacheService
      .getScriptCache()
      .remove(`session:${token}`);
  }

  return {
    success: true,
    message: "ออกจากระบบเรียบร้อย"
  };
}

/**
 * หาแถวของผู้ใช้ใน Users sheet จาก userId
 * คืน { sheet, values, index, targetRow } หรือ targetRow = -1
 * ถ้าไม่พบ — ใช้ร่วมกันใน updateOwnProfile/changeOwnPassword/uploadAvatar
 */
function findOwnUserRow_(userId) {
  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();
  const index = createHeaderIndex(values[0]);

  let targetRow = -1;

  for (let i = 1; i < values.length; i++) {
    const currentUserId = String(
      values[i][index.userId] || ""
    ).trim();

    if (currentUserId === userId) {
      targetRow = i + 1;
      break;
    }
  }

  return { sheet, values, index, targetRow };
}

/**
 * ให้ OWNER แก้ไขชื่อ-นามสกุล + เบอร์โทรของตัวเอง
 * (ownerOnly_ ใน Code.js ตรวจ role ให้แล้ว แต่ต้อง
 * validateToken ซ้ำเองเพื่อดึง userId ของผู้เรียก)
 */
function updateOwnProfile(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const fullName = String(
    request.fullName || ""
  ).trim();

  const phone = String(
    request.phone || ""
  ).trim();

  if (!fullName) {
    return {
      success: false,
      message: "กรุณากรอกชื่อ-นามสกุล"
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const {
      sheet,
      index,
      targetRow
    } = findOwnUserRow_(auth.user.userId);

    if (targetRow === -1) {
      return {
        success: false,
        message: "ไม่พบบัญชีผู้ใช้"
      };
    }

    // แก้เฉพาะคอลัมน์ fullName/phone — ไม่แตะคอลัมน์อื่น
    // (รวมถึง dormId/avatar ที่ต่อท้ายมาทีหลัง ไม่อยู่ใน header ที่บังคับ)
    sheet
      .getRange(targetRow, index.fullName + 1, 1, 1)
      .setValue(fullName);

    sheet
      .getRange(targetRow, index.phone + 1, 1, 1)
      .setValue(phone);

    const updatedUser = Object.assign(
      {},
      auth.user,
      { fullName: fullName, phone: phone }
    );

    CacheService.getScriptCache().put(
      `session:${request.token}`,
      JSON.stringify(updatedUser),
      SESSION_SECONDS
    );

    return {
      success: true,
      message: "บันทึกข้อมูลส่วนตัวสำเร็จ",
      user: updatedUser
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ให้ OWNER เปลี่ยนรหัสผ่านของตัวเอง
 * ต้องยืนยันรหัสผ่านปัจจุบันก่อนเสมอ
 */
function changeOwnPassword(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const currentPassword = String(
    request.currentPassword || ""
  );

  const newPassword = String(
    request.newPassword || ""
  );

  if (newPassword.length < 8) {
    return {
      success: false,
      message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const {
      sheet,
      values,
      index,
      targetRow
    } = findOwnUserRow_(auth.user.userId);

    if (targetRow === -1) {
      return {
        success: false,
        message: "ไม่พบบัญชีผู้ใช้"
      };
    }

    const row = values[targetRow - 1];

    const storedSalt = String(
      row[index.salt] || ""
    );

    const storedHash = String(
      row[index.passwordHash] || ""
    );

    if (
      hashPassword(currentPassword, storedSalt) !==
      storedHash
    ) {
      return {
        success: false,
        message: "รหัสผ่านปัจจุบันไม่ถูกต้อง"
      };
    }

    const newSalt = Utilities.getUuid().replace(/-/g, "");
    const newHash = hashPassword(newPassword, newSalt);

    sheet
      .getRange(targetRow, index.salt + 1, 1, 1)
      .setValue(newSalt);

    sheet
      .getRange(targetRow, index.passwordHash + 1, 1, 1)
      .setValue(newHash);

    return {
      success: true,
      message: "เปลี่ยนรหัสผ่านสำเร็จ"
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * หา (หรือสร้าง) โฟลเดอร์ Drive สำหรับเก็บรูปโปรไฟล์
 */
function getAvatarFolder_() {
  const folderName = "DormManagement Avatars";
  const folders = DriveApp.getFoldersByName(folderName);

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(folderName);
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

/* นามสกุลไฟล์ตามชนิดรูปที่รองรับ — ใช้ตั้งชื่อไฟล์เอง
   ไม่เอาชื่อที่ผู้ใช้ส่งมาไปตั้งบน Drive */
const AVATAR_EXTENSION_BY_MIME = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

/**
 * ตรวจชนิดไฟล์จาก magic bytes จริง ไม่เชื่อ mimeType ที่ client ส่งมา
 * (base64Decode คืน byte แบบมีเครื่องหมาย ต้องแปลงเป็น 0-255 ก่อน)
 * คืนค่า mime type ที่ตรวจได้ หรือ "" ถ้าไม่ใช่รูปที่รองรับ
 */
function detectImageMimeType_(bytes) {
  if (!bytes || bytes.length < 12) {
    return "";
  }

  const at = function (position) {
    const value = bytes[position];
    return value < 0 ? value + 256 : value;
  };

  if (
    at(0) === 0xff && at(1) === 0xd8 && at(2) === 0xff
  ) {
    return "image/jpeg";
  }

  if (
    at(0) === 0x89 && at(1) === 0x50 &&
    at(2) === 0x4e && at(3) === 0x47
  ) {
    return "image/png";
  }

  if (
    at(0) === 0x52 && at(1) === 0x49 &&
    at(2) === 0x46 && at(3) === 0x46 &&
    at(8) === 0x57 && at(9) === 0x45 &&
    at(10) === 0x42 && at(11) === 0x50
  ) {
    return "image/webp";
  }

  return "";
}

/**
 * ให้ OWNER อัปโหลดรูปโปรไฟล์ของตัวเอง (เก็บบน Google Drive)
 * ลบไฟล์รูปเก่าทิ้งถ้ามี เพื่อไม่ให้ไฟล์ค้างสะสม
 *
 * ไฟล์ที่อัปโหลดถูกตั้งเป็นสาธารณะ (ANYONE_WITH_LINK) จึงต้อง
 * ตรวจให้แน่ว่าเป็นรูปจริงและไม่ใหญ่เกินไป มิฉะนั้นจะกลายเป็น
 * ที่ฝากไฟล์ให้คนอื่นและกิน quota ของ Drive เจ้าของระบบ
 */
function uploadAvatar(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const base64Data = String(
    request.base64Data || ""
  );

  if (!base64Data) {
    return {
      success: false,
      message: "ไม่พบไฟล์รูปภาพ"
    };
  }

  let bytes;

  try {
    bytes = Utilities.base64Decode(base64Data);
  } catch (error) {
    return {
      success: false,
      message: "ไฟล์รูปภาพไม่ถูกต้อง"
    };
  }

  if (bytes.length > AVATAR_MAX_BYTES) {
    return {
      success: false,
      message: "ไฟล์รูปต้องมีขนาดไม่เกิน 2 MB"
    };
  }

  // เชื่อ magic bytes เท่านั้น ไม่เชื่อ request.mimeType
  const detectedMimeType = detectImageMimeType_(bytes);

  if (!detectedMimeType) {
    return {
      success: false,
      message:
        "รองรับเฉพาะไฟล์รูป JPG, PNG และ WebP เท่านั้น"
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const {
      sheet,
      values,
      index,
      targetRow
    } = findOwnUserRow_(auth.user.userId);

    if (targetRow === -1) {
      return {
        success: false,
        message: "ไม่พบบัญชีผู้ใช้"
      };
    }

    // ตั้งชื่อไฟล์เองจาก userId — กันชื่อไฟล์แปลกๆ ที่ผู้ใช้ส่งมา
    const fileName =
      "avatar-" +
      auth.user.userId +
      "." +
      AVATAR_EXTENSION_BY_MIME[detectedMimeType];

    const blob = Utilities.newBlob(
      bytes,
      detectedMimeType,
      fileName
    );

    const folder = getAvatarFolder_();
    const file = folder.createFile(blob);

    file.setSharing(
      DriveApp.Access.ANYONE_WITH_LINK,
      DriveApp.Permission.VIEW
    );

    const oldFileId = String(
      values[targetRow - 1][index.avatarFileId] || ""
    ).trim();

    if (oldFileId) {
      try {
        DriveApp.getFileById(oldFileId).setTrashed(true);
      } catch (error) {
        // ไฟล์เก่าอาจถูกลบไปแล้ว — ข้ามได้ ไม่ใช่ error ร้ายแรง
        Logger.log(
          "ลบไฟล์รูปเก่าไม่สำเร็จ: " + error
        );
      }
    }

    const avatarUrl =
      "https://drive.google.com/uc?export=view&id=" +
      file.getId();

    sheet
      .getRange(targetRow, index.avatarUrl + 1, 1, 1)
      .setValue(avatarUrl);

    sheet
      .getRange(targetRow, index.avatarFileId + 1, 1, 1)
      .setValue(file.getId());

    const updatedUser = Object.assign(
      {},
      auth.user,
      { avatarUrl: avatarUrl }
    );

    CacheService.getScriptCache().put(
      `session:${request.token}`,
      JSON.stringify(updatedUser),
      SESSION_SECONDS
    );

    return {
      success: true,
      message: "อัปโหลดรูปโปรไฟล์สำเร็จ",
      user: updatedUser
    };
  } finally {
    lock.releaseLock();
  }
}

function hashPassword(password, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    `${salt}:${password}`,
    Utilities.Charset.UTF_8
  );

  return digest
    .map(byte => {
      const value = byte < 0 ? byte + 256 : byte;
      return value.toString(16).padStart(2, "0");
    })
    .join("");
}

function createHeaderIndex(headers) {
  const index = {};

  headers.forEach((header, position) => {
    index[String(header).trim()] = position;
  });

  const requiredHeaders = [
    "userId",
    "username",
    "passwordHash",
    "salt",
    "fullName",
    "role",
    "active"
  ];

  requiredHeaders.forEach(header => {
    if (index[header] === undefined) {
      throw new Error(`ไม่พบคอลัมน์ ${header} ในชีต Users`);
    }
  });

  return index;
}

function createInitialAdmin() {
  // ใช้ handle กลางจาก Performance.js
  const spreadsheet = getSpreadsheet_();

  let sheet =
    spreadsheet.getSheetByName(USERS_SHEET);

  // หากยังไม่มีชีต Users ให้สร้างอัตโนมัติ
  if (!sheet) {
    sheet = spreadsheet.insertSheet(USERS_SHEET);
  }

  const headers = [
    "userId",
    "username",
    "passwordHash",
    "salt",
    "fullName",
    "role",
    "active"
  ];

  // สร้างหัวตารางเมื่อชีตยังว่าง
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  // ตรวจสอบว่ามี admin อยู่แล้วหรือไม่
  const values = sheet.getDataRange().getValues();

  const adminExists = values
    .slice(1)
    .some(row =>
      String(row[1]).trim().toLowerCase() === "admin"
    );

  if (adminExists) {
    Logger.log("มีบัญชี admin อยู่แล้ว");
    return;
  }

  const username = "admin";

  // อ่านจาก Script Properties — ห้ามฝังรหัสผ่านในโค้ดที่ขึ้น GitHub
  const password = getRequiredProperty_(
    "INITIAL_ADMIN_PASSWORD"
  );

  const salt = Utilities.getUuid();
  const passwordHash = hashPassword(password, salt);

  sheet.appendRow([
    Utilities.getUuid(),
    username,
    passwordHash,
    salt,
    "ผู้ดูแลระบบ",
    "OWNER",
    true
  ]);

  Logger.log("สร้างบัญชี admin สำเร็จ");
  Logger.log("Username: admin");
  Logger.log("Password: ตามค่าใน Script Property INITIAL_ADMIN_PASSWORD");
}

/**
 * รายชื่อพนักงาน (role USER) ทั้งหมด — ใช้เฉพาะ OWNER
 * (เดิมกรองเฉพาะหอตัวเอง ตอนนี้เลิกแยกตามหอแล้ว)
 */
function getStaff(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return {
      success: true,
      message: "โหลดข้อมูลสำเร็จ",
      data: []
    };
  }

  const index = createHeaderIndex(values[0]);

  const staff = values
    .slice(1)
    .filter(function (row) {
      return String(
        row[index.userId] || ""
      ).trim() !== "";
    })
    .filter(function (row) {
      return (
        String(row[index.role] || "")
          .trim()
          .toUpperCase() === "USER"
      );
    })
    .map(function (row) {
      const activeValue = row[index.active];

      const active =
        activeValue === true ||
        String(activeValue).trim().toLowerCase() ===
          "true" ||
        String(activeValue).trim() === "1";

      return {
        userId: String(row[index.userId]),
        fullName: String(row[index.fullName] || ""),
        username: String(row[index.username] || ""),
        phone: String(
          row[index.phone] || ""
        ),
        active: active
      };
    });

  return {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: staff
  };
}

function registerUser(request) {
  const input =
    request.user || {};

  const username = String(
    input.username || ""
  )
    .trim()
    .toLowerCase();

  const fullName = String(
    input.fullName || ""
  ).trim();

  const password = String(
    input.password || ""
  );

  const role = String(
    input.role || "USER"
  )
    .trim()
    .toUpperCase();

  const isOwnerSignup = role === "OWNER";

  const signupCode = String(
    input.signupCode || ""
  ).trim();

  if (!fullName) {
    return {
      success: false,
      message:
        "กรุณากรอกชื่อและนามสกุล"
    };
  }

  if (username.length < 4) {
    return {
      success: false,
      message:
        "ชื่อผู้ใช้ต้องมีอย่างน้อย 4 ตัวอักษร"
    };
  }

  if (
    !/^[a-z0-9._-]+$/.test(
      username
    )
  ) {
    return {
      success: false,
      message:
        "ชื่อผู้ใช้ใช้ได้เฉพาะภาษาอังกฤษ ตัวเลข จุด ขีดกลาง และขีดล่าง"
    };
  }

  if (password.length < 8) {
    return {
      success: false,
      message:
        "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
    };
  }

  /* ระบบหอเดียว: สมัครเป็น OWNER ผ่านหน้าเว็บไม่ได้อีกแล้ว
     เดิมการสมัครเป็น OWNER จะสร้าง "หอใหม่" ที่ข้อมูลแยกขาด
     จากคนอื่น จึงไม่มีอันตราย แต่พอเหลือหอเดียว OWNER ใหม่
     จะเห็นข้อมูลทั้งระบบทันที ถ้ายังเปิดให้สมัครอิสระ
     ใครก็ยึดระบบได้ — ต้องสร้างจาก Apps Script editor เท่านั้น */
  if (isOwnerSignup) {
    return {
      success: false,
      message:
        "ไม่สามารถสมัครเป็นเจ้าของหอผ่านหน้าเว็บได้ " +
        "กรุณาติดต่อผู้ดูแลระบบ"
    };
  }

  /* พนักงานต้องกรอกรหัสเชิญที่ตรงกับ Script Property
     ชื่อ STAFF_SIGNUP_CODE — ทำหน้าที่แทนลิงก์ที่มี dormId
     ของระบบเดิม ถ้าไม่ได้ตั้งค่าไว้ = ปิดรับสมัคร */
  const expectedSignupCode = getOptionalProperty_(
    "STAFF_SIGNUP_CODE"
  );

  if (!expectedSignupCode) {
    return {
      success: false,
      message: "ระบบปิดรับสมัครพนักงานอยู่ในขณะนี้"
    };
  }

  if (signupCode !== expectedSignupCode) {
    return {
      success: false,
      message:
        "รหัสเชิญไม่ถูกต้อง กรุณาขอลิงก์สมัครจากเจ้าของหอ"
    };
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet =
      getUsersSheet_();

    const values =
      sheet
        .getDataRange()
        .getValues();

    /*
     * ใช้ชื่อฟังก์ชันที่มีอยู่จริง
     * ไม่ใช่ getUserHeaderIndex_
     */
    const index =
      createHeaderIndex(
        values[0]
      );

    const duplicate =
      values
        .slice(1)
        .some(function (row) {
          const existingUsername =
            String(
              row[index.username] || ""
            )
              .trim()
              .toLowerCase();

          return (
            existingUsername ===
            username
          );
        });

    if (duplicate) {
      return {
        success: false,
        message:
          "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว"
      };
    }

    const userId =
      Utilities.getUuid();

    const salt =
      Utilities
        .getUuid()
        .replace(/-/g, "");

    /*
     * ใช้ชื่อเดียวกับ Login
     * ไม่ใช่ hashPassword_
     */
    const passwordHash =
      hashPassword(
        password,
        salt
      );

    const newRow =
      new Array(
        values[0].length
      ).fill("");

    newRow[index.userId] =
      userId;

    newRow[index.username] =
      username;

    newRow[index.passwordHash] =
      passwordHash;

    newRow[index.salt] =
      salt;

    newRow[index.fullName] =
      fullName;

    // สมัครผ่านหน้าเว็บได้เฉพาะพนักงาน (ดูเงื่อนไขด้านบน)
    const finalRole = "USER";

    newRow[index.role] =
      finalRole;

    newRow[index.active] =
      true;

    sheet.appendRow(newRow);

    bumpDormCache_();

    return {
      success: true,
      message:
        "สมัครสมาชิกสำเร็จ",

      data: {
        userId,
        username,
        fullName,
        role: finalRole,
        active: true
      }
    };
  } finally {
    lock.releaseLock();
  }
}

function getUsersSheet_() {
  // ใช้ handle กลางจาก Performance.js
  const spreadsheet = getSpreadsheet_();

  let sheet =
    spreadsheet.getSheetByName(
      USERS_SHEET
    );

  const headers = [
    "userId",
    "username",
    "passwordHash",
    "salt",
    "fullName",
    "role",
    "active"
  ];

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet(
        USERS_SHEET
      );
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(
        1,
        1,
        1,
        headers.length
      )
      .setValues([headers]);
  }

  const actualHeaders = sheet
    .getRange(
      1,
      1,
      1,
      headers.length
    )
    .getDisplayValues()[0]
    .map(function (header) {
      return String(header).trim();
    });

  const headersCorrect =
    headers.every(function (
      header,
      position
    ) {
      return (
        actualHeaders[position] ===
        header
      );
    });

  if (!headersCorrect) {
    throw new Error(
      "หัวตารางชีต Users ไม่ถูกต้อง " +
      "กรุณาเรียงเป็น: " +
      headers.join(" | ")
    );
  }

  return sheet;
}