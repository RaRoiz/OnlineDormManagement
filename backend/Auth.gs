const SPREADSHEET_ID = 
  "SPREADSHEET_ID";
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

  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
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

    const active = String(row[userIndex.active]).toLowerCase();

    if (
      storedUsername === username &&
      active !== "false" &&
      active !== "0"
    ) {
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