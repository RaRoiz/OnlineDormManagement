// เก็บ ID จริงใน Script Properties (ไม่ขึ้น GitHub)
// Apps Script → Project Settings → Script Properties
// เพิ่ม property ชื่อ SPREADSHEET_ID
const SPREADSHEET_ID =
  PropertiesService
    .getScriptProperties()
    .getProperty("SPREADSHEET_ID") || "";
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

      const user = {
        userId: String(row[userIndex.userId]),
        username: String(row[userIndex.username]),
        fullName: String(row[userIndex.fullName]),
        role: String(row[userIndex.role])
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

    /*
     * ผู้สมัครทั่วไปเป็น USER เท่านั้น
     */
    newRow[index.role] =
      "USER";

    newRow[index.active] =
      true;

    sheet.appendRow(newRow);

    return {
      success: true,
      message:
        "สมัครสมาชิกสำเร็จ",

      data: {
        userId,
        username,
        fullName,
        role: "USER",
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