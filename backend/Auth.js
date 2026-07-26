// เก็บ ID จริงใน Script Properties (ไม่ขึ้น GitHub)
// Apps Script → Project Settings → Script Properties
// เพิ่ม property ชื่อ SPREADSHEET_ID
const SPREADSHEET_ID =
  PropertiesService
    .getScriptProperties()
    .getProperty("SPREADSHEET_ID") || "1EjKqetYjCLDe6D-Xuqz6BJXZat9skeYmhnQ-TAmFWYM";
const USERS_SHEET = "Users";
const SESSION_SECONDS = 21600; // 6 ชั่วโมง

function login(request) {
  const username = String(request.username || "").trim().toLowerCase();
  const password = String(request.password || "");

  if (!username || !password) {
    return {
      success: false,
      message: "กรุณากรอกชื่อผู้ใช้และรหัสผ่าน"
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

      const dormId = String(
        row[userIndex.dormId] || ""
      );

      const user = {
        userId: String(row[userIndex.userId]),
        username: String(row[userIndex.username]),
        fullName: String(row[userIndex.fullName]),
        role: String(row[userIndex.role]),
        dormId: dormId,
        dormName: findDormName_(dormId)
      };

      const token = Utilities.getUuid();
      const cache = CacheService.getScriptCache();

      cache.put(
        `session:${token}`,
        JSON.stringify(user),
        SESSION_SECONDS
      );

      return {
        success: true,
        message: "เข้าสู่ระบบสำเร็จ",
        token,
        user
      };
    }
  }

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
 * ชั่วคราว — ลบบัญชีทดสอบเก่า 3 บัญชีที่ระบุชื่อผู้ใช้ตรงๆ
 * (adtae67, tayler, tae04) ออกจาก Users sheet
 * รันครั้งเดียวจาก Apps Script editor แล้วลบฟังก์ชันนี้ทิ้งได้
 */
function deleteTestStaffAccounts() {
  const usernamesToDelete = [
    "adtae67",
    "tayler",
    "tae04"
  ];

  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();
  const index = createHeaderIndex(values[0]);

  let deletedCount = 0;

  for (let i = values.length - 1; i >= 1; i--) {
    const username = String(
      values[i][index.username] || ""
    )
      .trim()
      .toLowerCase();

    if (usernamesToDelete.indexOf(username) !== -1) {
      sheet.deleteRow(i + 1);
      deletedCount++;
      Logger.log("ลบแถว: " + username);
    }
  }

  Logger.log(
    "ลบบัญชีทดสอบสำเร็จ " + deletedCount + " บัญชี"
  );
}

/**
 * DEBUG ชั่วคราว — รันจาก Apps Script editor เพื่อดูค่า
 * username/role/dormId ของทุกแถวใน Users sheet ตรงๆ
 * (แค่ดู ไม่แก้ไขอะไร) ลบทิ้งได้เมื่อเช็คปัญหาเสร็จแล้ว
 */
function debugListUsers() {
  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();
  const index = createHeaderIndex(values[0]);

  Logger.log("คอลัมน์ dormId อยู่ตำแหน่ง (0-based): " + index.dormId);

  values.slice(1).forEach(function (row) {
    const username = String(row[index.username] || "");
    const role = String(row[index.role] || "");

    const dormId =
      index.dormId === undefined
        ? "(ไม่มีคอลัมน์ dormId)"
        : "[" + String(row[index.dormId] || "") + "]";

    Logger.log(
      username + " | role=" + role + " | dormId=" + dormId
    );
  });
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

/**
 * ให้ OWNER อัปโหลดรูปโปรไฟล์ของตัวเอง (เก็บบน Google Drive)
 * ลบไฟล์รูปเก่าทิ้งถ้ามี เพื่อไม่ให้ไฟล์ค้างสะสม
 */
function uploadAvatar(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const fileName = String(
    request.fileName || "avatar"
  ).trim();

  const mimeType = String(
    request.mimeType || "image/jpeg"
  ).trim();

  const base64Data = String(
    request.base64Data || ""
  );

  if (!base64Data) {
    return {
      success: false,
      message: "ไม่พบไฟล์รูปภาพ"
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

    const blob = Utilities.newBlob(
      Utilities.base64Decode(base64Data),
      mimeType,
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
  const spreadsheet =
    SpreadsheetApp.openById(SPREADSHEET_ID);

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
  const password = "Admin@1234";
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
  Logger.log("Password: Admin@1234");
}

/**
 * รันครั้งเดียวจาก Apps Script editor เพื่อสร้างบัญชี SUPER_ADMIN
 * (เห็น/จัดการได้ทุกหอ — ไม่มี dormId ประจำตัว ปล่อยคอลัมน์ dormId ว่างไว้)
 * ควรรันหลัง migrateAddDormId_() (Dorm.js) เพื่อให้ชีต Users มีคอลัมน์ dormId แล้ว
 */
function createInitialSuperAdmin() {
  const sheet = getUsersSheet_();
  const values = sheet.getDataRange().getValues();

  const superAdminExists = values
    .slice(1)
    .some(row =>
      String(row[1]).trim().toLowerCase() === "superadmin"
    );

  if (superAdminExists) {
    Logger.log("มีบัญชี superadmin อยู่แล้ว");
    return;
  }

  const username = "superadmin";
  const password = "SuperAdmin@1234";
  const salt = Utilities.getUuid();
  const passwordHash = hashPassword(password, salt);

  sheet.appendRow([
    Utilities.getUuid(),
    username,
    passwordHash,
    salt,
    "ผู้ดูแลระบบ",
    "SUPER_ADMIN",
    true
  ]);

  Logger.log("สร้างบัญชี superadmin สำเร็จ");
  Logger.log("Username: superadmin");
  Logger.log("Password: SuperAdmin@1234");
}

/**
 * รายชื่อพนักงาน (role USER) ของหอตัวเอง — ใช้เฉพาะ OWNER
 */
function getStaff(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const dormId = String(
    auth.user.dormId || ""
  ).trim();

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
    .filter(function (row) {
      if (index.dormId === undefined) {
        return true;
      }

      return (
        String(row[index.dormId] || "").trim() ===
        dormId
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

  const dormName = String(
    input.dormName || ""
  ).trim();

  const requestedDormId = String(
    input.dormId || ""
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

  if (isOwnerSignup && !dormName) {
    return {
      success: false,
      message: "กรุณากรอกชื่อหอ"
    };
  }

  if (!isOwnerSignup && !requestedDormId) {
    return {
      success: false,
      message:
        "ลิงก์สมัครไม่ถูกต้อง กรุณาขอลิงก์จากเจ้าของหอ"
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

    let dormId = requestedDormId;

    if (isOwnerSignup) {
      dormId = Utilities.getUuid();

      getDormsSheet_().appendRow([
        dormId,
        dormName,
        fullName,
        "",
        "",
        "ACTIVE",
        new Date().toISOString()
      ]);
    } else if (!findDormName_(dormId)) {
      return {
        success: false,
        message:
          "ไม่พบหอที่ระบุ ลิงก์อาจไม่ถูกต้อง"
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

    const finalRole =
      isOwnerSignup ? "OWNER" : "USER";

    newRow[index.role] =
      finalRole;

    newRow[index.active] =
      true;

    if (index.dormId !== undefined) {
      newRow[index.dormId] = dormId;
    }

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