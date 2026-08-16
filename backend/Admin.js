/**
 * Admin.gs — จัดการผู้ใช้ สำหรับ SUPER_ADMIN เท่านั้น
 *
 * ลำดับสิทธิ์ในระบบ (หอเดียว):
 *   SUPER_ADMIN — ผู้ดูแลระบบ ทำได้ทุกอย่างที่ OWNER ทำได้
 *                 บวกกับสร้าง/ปิด/รีเซ็ตรหัสผ่านบัญชีอื่น
 *   OWNER       — เจ้าของหอ ใช้งานทุกฟีเจอร์ของหอ
 *   USER        — พนักงาน ดู/เพิ่ม/แก้ไขได้ แต่ลบไม่ได้
 *                 และเข้าหน้า Report ไม่ได้
 *
 * ทุก action ในไฟล์นี้ต้องผ่าน superAdminOnly_() ใน Code.gs
 * (ตัวฟังก์ชันเช็ค token ซ้ำเองด้วย เพื่อดึง userId ของผู้เรียก)
 */

const MANAGEABLE_ROLES = ["OWNER", "USER"];

function normalizeRole_(value) {
  return String(value || "")
    .trim()
    .toUpperCase();
}

function isTruthyCell_(value) {
  return (
    value === true ||
    String(value).trim().toLowerCase() === "true" ||
    String(value).trim() === "1"
  );
}

/** รายชื่อผู้ใช้ทั้งหมดทุกบทบาท — ไม่ส่ง passwordHash/salt ออกไป */
function getUsers(request) {
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

  const users = values
    .slice(1)
    .filter(function (row) {
      return String(
        row[index.userId] || ""
      ).trim() !== "";
    })
    .map(function (row) {
      return {
        userId: String(row[index.userId] || ""),
        username: String(row[index.username] || ""),
        fullName: String(row[index.fullName] || ""),
        role: normalizeRole_(row[index.role]),
        active: isTruthyCell_(row[index.active]),

        phone:
          index.phone === undefined
            ? ""
            : String(row[index.phone] || ""),

        isSelf:
          String(row[index.userId] || "") ===
          auth.user.userId
      };
    })
    .sort(function (a, b) {
      // SUPER_ADMIN ก่อน แล้ว OWNER แล้ว USER
      const order = {
        SUPER_ADMIN: 0,
        OWNER: 1,
        USER: 2
      };

      const rankA = order[a.role] ?? 3;
      const rankB = order[b.role] ?? 3;

      if (rankA !== rankB) {
        return rankA - rankB;
      }

      return a.username.localeCompare(b.username);
    });

  return {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: users
  };
}

/** หาแถวของผู้ใช้จาก userId — คืน -1 ถ้าไม่พบ */
function findUserRow_(values, index, userId) {
  for (let i = 1; i < values.length; i++) {
    if (
      String(values[i][index.userId] || "").trim() ===
      userId
    ) {
      return i + 1;
    }
  }

  return -1;
}

/**
 * สร้างบัญชีใหม่ (OWNER หรือ USER)
 * สร้าง SUPER_ADMIN จากหน้าเว็บไม่ได้ — ต้องรัน
 * createInitialSuperAdmin() จาก Apps Script editor เท่านั้น
 * เพื่อไม่ให้บัญชีที่ถูกยึดสร้างผู้ดูแลเพิ่มเองได้
 */
function createManagedUser(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const input = request.user || {};

  const username = String(input.username || "")
    .trim()
    .toLowerCase();

  const fullName = String(
    input.fullName || ""
  ).trim();

  const password = String(input.password || "");
  const role = normalizeRole_(input.role);

  if (MANAGEABLE_ROLES.indexOf(role) === -1) {
    return {
      success: false,
      message:
        "สร้างได้เฉพาะบัญชีเจ้าของหอ (OWNER) และพนักงาน (USER)"
    };
  }

  if (!fullName) {
    return {
      success: false,
      message: "กรุณากรอกชื่อและนามสกุล"
    };
  }

  if (username.length < 4) {
    return {
      success: false,
      message: "ชื่อผู้ใช้ต้องมีอย่างน้อย 4 ตัวอักษร"
    };
  }

  if (!/^[a-z0-9._-]+$/.test(username)) {
    return {
      success: false,
      message:
        "ชื่อผู้ใช้ใช้ได้เฉพาะภาษาอังกฤษ ตัวเลข จุด ขีดกลาง และขีดล่าง"
    };
  }

  if (password.length < 8) {
    return {
      success: false,
      message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getUsersSheet_();
    const values = sheet.getDataRange().getValues();
    const index = createHeaderIndex(values[0]);

    const duplicate = values
      .slice(1)
      .some(function (row) {
        return (
          String(row[index.username] || "")
            .trim()
            .toLowerCase() === username
        );
      });

    if (duplicate) {
      return {
        success: false,
        message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว"
      };
    }

    const userId = Utilities.getUuid();

    const salt = Utilities
      .getUuid()
      .replace(/-/g, "");

    const newRow = new Array(
      values[0].length
    ).fill("");

    newRow[index.userId] = userId;
    newRow[index.username] = username;
    newRow[index.passwordHash] = hashPassword(password, salt);
    newRow[index.salt] = salt;
    newRow[index.fullName] = fullName;
    newRow[index.role] = role;
    newRow[index.active] = true;

    sheet.appendRow(newRow);

    return {
      success: true,
      message: "สร้างบัญชีสำเร็จ",

      data: {
        userId: userId,
        username: username,
        fullName: fullName,
        role: role,
        active: true
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/** เปิด/ปิดการใช้งานบัญชี — ปิดบัญชีตัวเองไม่ได้ */
function setUserActive(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const userId = String(request.userId || "").trim();
  const active = request.active === true;

  if (!userId) {
    return {
      success: false,
      message: "ไม่พบรหัสผู้ใช้"
    };
  }

  /* กันล็อกตัวเองออกจากระบบ — ถ้าปิดบัญชีตัวเองแล้ว
     ไม่มี SUPER_ADMIN คนอื่น จะไม่มีใครเปิดกลับได้อีกเลย */
  if (userId === auth.user.userId && !active) {
    return {
      success: false,
      message: "ปิดใช้งานบัญชีของตัวเองไม่ได้"
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getUsersSheet_();
    const values = sheet.getDataRange().getValues();
    const index = createHeaderIndex(values[0]);

    const targetRow = findUserRow_(values, index, userId);

    if (targetRow === -1) {
      return {
        success: false,
        message: "ไม่พบบัญชีผู้ใช้"
      };
    }

    sheet
      .getRange(targetRow, index.active + 1, 1, 1)
      .setValue(active);

    return {
      success: true,

      message: active
        ? "เปิดใช้งานบัญชีแล้ว"
        : "ปิดใช้งานบัญชีแล้ว",

      data: { userId: userId, active: active }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * ตั้งรหัสผ่านใหม่ให้บัญชีอื่น (กรณีผู้ใช้ลืมรหัส)
 *
 * หมายเหตุ: session เดิมของบัญชีนั้นยังใช้ได้จนหมดอายุ 6 ชม.
 * เพราะ CacheService ไล่ลบ key ตาม userId ไม่ได้ —
 * ถ้าสงสัยว่าบัญชีถูกยึด ให้ปิดใช้งานบัญชีควบคู่ไปด้วย
 */
function resetUserPassword(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const userId = String(request.userId || "").trim();
  const newPassword = String(request.newPassword || "");

  if (!userId) {
    return {
      success: false,
      message: "ไม่พบรหัสผู้ใช้"
    };
  }

  if (newPassword.length < 8) {
    return {
      success: false,
      message: "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร"
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getUsersSheet_();
    const values = sheet.getDataRange().getValues();
    const index = createHeaderIndex(values[0]);

    const targetRow = findUserRow_(values, index, userId);

    if (targetRow === -1) {
      return {
        success: false,
        message: "ไม่พบบัญชีผู้ใช้"
      };
    }

    const salt = Utilities
      .getUuid()
      .replace(/-/g, "");

    sheet
      .getRange(targetRow, index.salt + 1, 1, 1)
      .setValue(salt);

    sheet
      .getRange(targetRow, index.passwordHash + 1, 1, 1)
      .setValue(hashPassword(newPassword, salt));

    // ล้างตัวนับล็อกอินผิด เผื่อบัญชีนั้นโดนล็อกอยู่
    clearLoginFailures_(
      String(values[targetRow - 1][index.username] || "")
        .trim()
        .toLowerCase()
    );

    return {
      success: true,
      message: "ตั้งรหัสผ่านใหม่สำเร็จ",
      data: { userId: userId }
    };
  } finally {
    lock.releaseLock();
  }
}
