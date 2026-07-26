const DORMS_SHEET = "Dorms";

const DORM_HEADERS = [
  "dormId",
  "dormName",
  "ownerName",
  "phone",
  "address",
  "status",
  "createdAt"
];

/* หอเริ่มต้นที่ migrateAddDormId_() สร้างให้ข้อมูลเดิมก่อนมีระบบหลายหอ */
const DEFAULT_DORM_ID = "DORM-DEFAULT";

function getDormsSheet_() {
  // ใช้ handle กลางจาก Performance.js
  const spreadsheet = getSpreadsheet_();

  let sheet = spreadsheet.getSheetByName(DORMS_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(DORMS_SHEET);
    sheet.appendRow(DORM_HEADERS);
    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(DORM_HEADERS);
    return sheet;
  }

  const actualHeaders = sheet
    .getRange(1, 1, 1, DORM_HEADERS.length)
    .getDisplayValues()[0]
    .map(header => String(header).trim());

  const headerIsCorrect = DORM_HEADERS.every(
    (header, index) => actualHeaders[index] === header
  );

  if (!headerIsCorrect) {
    throw new Error(
      "หัวตารางชีต Dorms ไม่ถูกต้อง กรุณาเรียงเป็น: " +
      DORM_HEADERS.join(" | ")
    );
  }

  return sheet;
}

function getDormHeaderIndex_(headers) {
  const index = {};

  headers.forEach((header, position) => {
    index[String(header).trim()] = position;
  });

  DORM_HEADERS.forEach(header => {
    if (index[header] === undefined) {
      throw new Error(
        "ไม่พบคอลัมน์ " + header + " ในชีต Dorms"
      );
    }
  });

  return index;
}

/**
 * หาชื่อหอจาก dormId — คืนสตริงว่างถ้าไม่พบ/ไม่มี dormId
 * ใช้ทั้งใน login() (Auth.js), registerUser() (Auth.js),
 * และ getDormPublicInfo() ด้านล่าง
 */
function findDormName_(dormId) {
  if (!dormId) {
    return "";
  }

  const sheet = getDormsSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return "";
  }

  const index = getDormHeaderIndex_(values[0]);

  const row = values.slice(1).find(function (r) {
    return (
      String(r[index.dormId] || "").trim() === dormId
    );
  });

  return row
    ? String(row[index.dormName] || "").trim()
    : "";
}

/**
 * ดูชื่อหอจาก dormId แบบสาธารณะ — ไม่ต้อง login
 * (เรียกจากหน้า register ก่อนสมัคร เพื่อโชว์ว่ากำลัง
 * สมัครเป็นพนักงานของหอไหน) คืนแค่ชื่อ ไม่มีข้อมูลอื่น
 */
function getDormPublicInfo(request) {
  const dormId = String(
    request.dormId || ""
  ).trim();

  if (!dormId) {
    return {
      success: false,
      message: "ไม่พบรหัสหอ"
    };
  }

  const dormName = findDormName_(dormId);

  if (!dormName) {
    return {
      success: false,
      message: "ไม่พบหอที่ระบุ"
    };
  }

  return {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: { dormName: dormName }
  };
}

/**
 * ให้ OWNER แก้ไขชื่อหอของตัวเอง (แก้ได้เฉพาะหอตัวเอง)
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

  const dormId = String(
    auth.user.dormId || ""
  ).trim();

  if (!dormId) {
    return {
      success: false,
      message: "ไม่พบหอของบัญชีนี้"
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getDormsSheet_();
    const values = sheet.getDataRange().getValues();
    const index = getDormHeaderIndex_(values[0]);

    let targetRow = -1;

    for (let i = 1; i < values.length; i++) {
      const currentDormId = String(
        values[i][index.dormId] || ""
      ).trim();

      if (currentDormId === dormId) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) {
      return {
        success: false,
        message: "ไม่พบหอของบัญชีนี้"
      };
    }

    sheet
      .getRange(targetRow, index.dormName + 1, 1, 1)
      .setValue(dormName);

    const updatedUser = Object.assign(
      {},
      auth.user,
      { dormName: dormName }
    );

    CacheService.getScriptCache().put(
      `session:${request.token}`,
      JSON.stringify(updatedUser),
      SESSION_SECONDS
    );

    return {
      success: true,
      message: "แก้ไขชื่อหอสำเร็จ",
      user: updatedUser
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * สรุปสถิติของแต่ละหอ (จำนวนห้อง/อัตราเข้าพัก/ผู้เช่า/ยอดค้างชำระ)
 * ใช้เฉพาะ SUPER_ADMIN — เห็นได้ทุกหอ
 */
function getDorms(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const sheet = getDormsSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return {
      success: true,
      message: "โหลดข้อมูลสำเร็จ",
      data: []
    };
  }

  const index = getDormHeaderIndex_(values[0]);

  const roomsData = readReportSheet_("Rooms");
  const tenantsData = readReportSheet_("Tenants");
  const billsData = readReportSheet_("Bills");

  const rooms = getValidReportRows_(
    roomsData,
    "roomId",
    auth
  );

  const tenants = getValidReportRows_(
    tenantsData,
    "tenantId",
    auth
  );

  const bills = getValidReportRows_(
    billsData,
    "billId",
    auth
  );

  const roomCountByDorm = {};

  rooms.forEach(function (row) {
    const dormId = reportText_(
      row,
      roomsData.index,
      "dormId"
    );

    roomCountByDorm[dormId] =
      (roomCountByDorm[dormId] || 0) + 1;
  });

  const occupiedRoomsByDorm = {};
  const activeTenantsByDorm = {};

  tenants.forEach(function (row) {
    const status = reportText_(
      row,
      tenantsData.index,
      "status"
    ).toUpperCase();

    if (status !== "ACTIVE") {
      return;
    }

    const dormId = reportText_(
      row,
      tenantsData.index,
      "dormId"
    );

    activeTenantsByDorm[dormId] =
      (activeTenantsByDorm[dormId] || 0) + 1;

    const roomId = reportText_(
      row,
      tenantsData.index,
      "roomId"
    );

    if (!roomId) {
      return;
    }

    if (!occupiedRoomsByDorm[dormId]) {
      occupiedRoomsByDorm[dormId] = new Set();
    }

    occupiedRoomsByDorm[dormId].add(roomId);
  });

  const unpaidAmountByDorm = {};

  bills.forEach(function (row) {
    const paymentStatus = reportText_(
      row,
      billsData.index,
      "paymentStatus"
    ).toUpperCase();

    if (paymentStatus === "PAID") {
      return;
    }

    const dormId = reportText_(
      row,
      billsData.index,
      "dormId"
    );

    const totalAmount = reportNumber_(
      row,
      billsData.index,
      "totalAmount"
    );

    unpaidAmountByDorm[dormId] =
      (unpaidAmountByDorm[dormId] || 0) + totalAmount;
  });

  const dorms = values
    .slice(1)
    .filter(function (row) {
      return String(row[index.dormId] || "").trim() !== "";
    })
    .map(function (row) {
      const dormId = String(row[index.dormId]).trim();
      const roomCount = roomCountByDorm[dormId] || 0;

      const occupiedCount = occupiedRoomsByDorm[dormId]
        ? occupiedRoomsByDorm[dormId].size
        : 0;

      return {
        dormId: dormId,

        dormName: String(
          row[index.dormName] || ""
        ).trim(),

        ownerName: String(
          row[index.ownerName] || ""
        ).trim(),

        phone: String(
          row[index.phone] || ""
        ).trim(),

        address: String(
          row[index.address] || ""
        ).trim(),

        status: String(
          row[index.status] || ""
        ).trim(),

        createdAt: formatSheetDate_(
          row[index.createdAt]
        ),

        roomCount: roomCount,
        occupiedCount: occupiedCount,

        occupancyRate: roomCount > 0
          ? Math.round(
            (occupiedCount / roomCount) * 1000
          ) / 10
          : 0,

        activeTenants:
          activeTenantsByDorm[dormId] || 0,

        unpaidAmount:
          unpaidAmountByDorm[dormId] || 0
      };
    })
    .sort(function (a, b) {
      return b.createdAt.localeCompare(a.createdAt);
    });

  return {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: dorms
  };
}

/**
 * รายละเอียดเต็มของหอเดียว (ห้อง/ผู้เช่า/พนักงาน+เจ้าของ/บิล)
 * ใช้เฉพาะ SUPER_ADMIN — กด "ดูรายละเอียด" จากหน้า Admin
 */
function getDormDetail(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const dormId = String(
    request.dormId || ""
  ).trim();

  if (!dormId) {
    return {
      success: false,
      message: "ไม่พบรหัสหอ"
    };
  }

  const dormsSheet = getDormsSheet_();
  const dormValues = dormsSheet.getDataRange().getValues();
  const dormIndex = getDormHeaderIndex_(dormValues[0]);

  const dormRow = dormValues.slice(1).find(function (row) {
    return (
      String(row[dormIndex.dormId] || "").trim() ===
      dormId
    );
  });

  if (!dormRow) {
    return {
      success: false,
      message: "ไม่พบหอที่ระบุ"
    };
  }

  const dorm = {
    dormId: dormId,
    dormName: String(
      dormRow[dormIndex.dormName] || ""
    ).trim(),
    ownerName: String(
      dormRow[dormIndex.ownerName] || ""
    ).trim(),
    status: String(
      dormRow[dormIndex.status] || ""
    ).trim()
  };

  const roomsData = readReportSheet_("Rooms");
  const tenantsData = readReportSheet_("Tenants");
  const billsData = readReportSheet_("Bills");

  const belongsToDorm = function (row, data) {
    return (
      reportText_(row, data.index, "dormId") === dormId
    );
  };

  const roomRows = getValidReportRows_(
    roomsData,
    "roomId",
    auth
  ).filter(function (row) {
    return belongsToDorm(row, roomsData);
  });

  const tenantRows = getValidReportRows_(
    tenantsData,
    "tenantId",
    auth
  ).filter(function (row) {
    return belongsToDorm(row, tenantsData);
  });

  const billRows = getValidReportRows_(
    billsData,
    "billId",
    auth
  ).filter(function (row) {
    return belongsToDorm(row, billsData);
  });

  const roomNoById = {};

  roomRows.forEach(function (row) {
    const roomId = reportText_(
      row,
      roomsData.index,
      "roomId"
    );

    roomNoById[roomId] = reportText_(
      row,
      roomsData.index,
      "roomNo"
    );
  });

  const occupiedRoomIds = {};

  tenantRows.forEach(function (row) {
    const status = reportText_(
      row,
      tenantsData.index,
      "status"
    ).toUpperCase();

    if (status !== "ACTIVE") {
      return;
    }

    const roomId = reportText_(
      row,
      tenantsData.index,
      "roomId"
    );

    if (roomId) {
      occupiedRoomIds[roomId] = true;
    }
  });

  const rooms = roomRows
    .map(function (row) {
      const roomId = reportText_(
        row,
        roomsData.index,
        "roomId"
      );

      return {
        roomNo: reportText_(
          row,
          roomsData.index,
          "roomNo"
        ),
        roomType: reportText_(
          row,
          roomsData.index,
          "roomType"
        ),
        price: reportNumber_(
          row,
          roomsData.index,
          "price"
        ),
        floor: reportNumber_(
          row,
          roomsData.index,
          "floor"
        ),
        status: occupiedRoomIds[roomId]
          ? "ไม่ว่าง"
          : "ว่าง"
      };
    })
    .sort(function (a, b) {
      return a.floor - b.floor;
    });

  const tenants = tenantRows.map(function (row) {
    const roomId = reportText_(
      row,
      tenantsData.index,
      "roomId"
    );

    return {
      fullName: reportText_(
        row,
        tenantsData.index,
        "fullName"
      ),
      roomNo: roomNoById[roomId] || "",
      status: reportText_(
        row,
        tenantsData.index,
        "status"
      ),
      checkInDate: reportText_(
        row,
        tenantsData.index,
        "checkInDate"
      )
    };
  });

  const bills = billRows
    .map(function (row) {
      return {
        billNo: reportText_(
          row,
          billsData.index,
          "billNo"
        ),
        roomNo: reportText_(
          row,
          billsData.index,
          "roomNo"
        ),
        tenantName: reportText_(
          row,
          billsData.index,
          "tenantName"
        ),
        billingMonth: reportText_(
          row,
          billsData.index,
          "billingMonth"
        ),
        totalAmount: reportNumber_(
          row,
          billsData.index,
          "totalAmount"
        ),
        paymentStatus: reportText_(
          row,
          billsData.index,
          "paymentStatus"
        ),
        dueDate: reportText_(
          row,
          billsData.index,
          "dueDate"
        )
      };
    })
    .sort(function (a, b) {
      return b.billingMonth.localeCompare(
        a.billingMonth
      );
    });

  const usersSheet = getUsersSheet_();
  const userValues = usersSheet.getDataRange().getValues();
  const userIndex = createHeaderIndex(userValues[0]);

  const staff = userValues
    .slice(1)
    .filter(function (row) {
      return (
        String(row[userIndex.userId] || "").trim() !==
        ""
      );
    })
    .filter(function (row) {
      if (userIndex.dormId === undefined) {
        return false;
      }

      return (
        String(row[userIndex.dormId] || "").trim() ===
        dormId
      );
    })
    .map(function (row) {
      const activeValue = row[userIndex.active];

      const active =
        activeValue === true ||
        String(activeValue).trim().toLowerCase() ===
          "true" ||
        String(activeValue).trim() === "1";

      return {
        fullName: String(
          row[userIndex.fullName] || ""
        ),
        username: String(
          row[userIndex.username] || ""
        ),
        role: String(
          row[userIndex.role] || ""
        ).trim().toUpperCase(),
        active: active
      };
    });

  return {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: {
      dorm: dorm,
      rooms: rooms,
      tenants: tenants,
      staff: staff,
      bills: bills
    }
  };
}

/**
 * สรุปภาพรวมทั้งแพลตฟอร์ม (ทุกหอรวมกัน) — ใช้เฉพาะ SUPER_ADMIN
 */
function getPlatformSummary(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const dormsResult = getDorms(request);

  if (!dormsResult.success) {
    return dormsResult;
  }

  const dorms = dormsResult.data || [];

  const currentMonth = Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM"
  );

  const summary = {
    totalDorms: dorms.length,

    activeDorms: dorms.filter(function (dorm) {
      return dorm.status.toUpperCase() === "ACTIVE";
    }).length,

    totalRooms: dorms.reduce(function (sum, dorm) {
      return sum + dorm.roomCount;
    }, 0),

    totalTenants: dorms.reduce(function (sum, dorm) {
      return sum + dorm.activeTenants;
    }, 0),

    totalUnpaidAmount: dorms.reduce(function (sum, dorm) {
      return sum + dorm.unpaidAmount;
    }, 0),

    newDormsThisMonth: dorms.filter(function (dorm) {
      return dorm.createdAt.slice(0, 7) === currentMonth;
    }).length
  };

  return {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: summary
  };
}

/**
 * สร้างหอใหม่ + บัญชี OWNER คนแรกของหอนั้นในคราวเดียว
 * ใช้เฉพาะ SUPER_ADMIN
 */
function createDorm(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const input = request.dorm || {};

  const dormName = String(
    input.dormName || ""
  ).trim();

  const ownerName = String(
    input.ownerName || ""
  ).trim();

  const phone = String(input.phone || "").trim();
  const address = String(input.address || "").trim();

  const ownerUsername = String(
    input.ownerUsername || ""
  )
    .trim()
    .toLowerCase();

  const ownerPassword = String(
    input.ownerPassword || ""
  );

  if (!dormName) {
    return {
      success: false,
      message: "กรุณากรอกชื่อหอ"
    };
  }

  if (!ownerName) {
    return {
      success: false,
      message: "กรุณากรอกชื่อเจ้าของหอ"
    };
  }

  if (ownerUsername.length < 4) {
    return {
      success: false,
      message: "ชื่อผู้ใช้ต้องมีอย่างน้อย 4 ตัวอักษร"
    };
  }

  if (!/^[a-z0-9._-]+$/.test(ownerUsername)) {
    return {
      success: false,
      message:
        "ชื่อผู้ใช้ใช้ได้เฉพาะภาษาอังกฤษ ตัวเลข จุด ขีดกลาง และขีดล่าง"
    };
  }

  if (ownerPassword.length < 8) {
    return {
      success: false,
      message: "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const usersSheet = getUsersSheet_();
    const userValues = usersSheet.getDataRange().getValues();
    const userIndex = createHeaderIndex(userValues[0]);

    const duplicateUsername = userValues
      .slice(1)
      .some(function (row) {
        return (
          String(row[userIndex.username] || "")
            .trim()
            .toLowerCase() === ownerUsername
        );
      });

    if (duplicateUsername) {
      return {
        success: false,
        message: "ชื่อผู้ใช้นี้มีอยู่ในระบบแล้ว"
      };
    }

    const dormId = Utilities.getUuid();
    const now = new Date().toISOString();

    const dormsSheet = getDormsSheet_();

    dormsSheet.appendRow([
      dormId,
      dormName,
      ownerName,
      phone,
      address,
      "ACTIVE",
      now
    ]);

    const userId = Utilities.getUuid();
    const salt = Utilities.getUuid().replace(/-/g, "");
    const passwordHash = hashPassword(ownerPassword, salt);

    usersSheet.appendRow([
      userId,
      ownerUsername,
      passwordHash,
      salt,
      ownerName,
      "OWNER",
      true,
      dormId
    ]);

    bumpDormCache_();

    return {
      success: true,
      message: "เพิ่มหอใหม่สำเร็จ",
      data: {
        dormId: dormId,
        dormName: dormName,
        ownerUsername: ownerUsername
      }
    };
  } finally {
    lock.releaseLock();
  }
}

/**
 * รันครั้งเดียวจาก Apps Script editor (ไม่เปิดผ่าน doPost)
 * เพิ่มคอลัมน์ dormId ต่อท้ายชีต Users/Rooms/Tenants/Meters/Bills
 * แล้วเติมค่า DEFAULT_DORM_ID ให้ทุกแถวเดิม + สร้างชีต Dorms
 * พร้อม 1 แถวสำหรับหอเดิมที่มีอยู่ก่อนระบบหลายหอ
 *
 * ใช้ตำแหน่งคอลัมน์คงที่ (ไม่ใช้ getLastColumn()) เพื่อไม่ให้
 * การรันสลับลำดับกับ deploy โค้ดใหม่ทำให้คอลัมน์เพี้ยน
 */
function migrateAddDormId_() {
  const targets = [
    { sheetName: "Users", headerLength: 7 },
    { sheetName: "Rooms", headerLength: 8 },
    { sheetName: "Tenants", headerLength: 12 },
    { sheetName: "Meters", headerLength: 18 },
    { sheetName: "Bills", headerLength: 21 }
  ];

  const spreadsheet = getSpreadsheet_();

  targets.forEach(function (target) {
    const sheet = spreadsheet.getSheetByName(target.sheetName);

    if (!sheet) {
      Logger.log("ข้าม (ไม่พบชีต): " + target.sheetName);
      return;
    }

    const dormIdColumn = target.headerLength + 1;

    const headerCell = sheet.getRange(1, dormIdColumn);

    if (
      String(headerCell.getValue() || "").trim() !== "dormId"
    ) {
      headerCell.setValue("dormId");
    }

    const lastRow = sheet.getLastRow();

    if (lastRow < 2) {
      return;
    }

    const dataRange = sheet.getRange(
      2,
      dormIdColumn,
      lastRow - 1,
      1
    );

    const currentValues = dataRange.getValues();

    const filledValues = currentValues.map(function (row) {
      const current = String(row[0] || "").trim();
      return [current === "" ? DEFAULT_DORM_ID : current];
    });

    dataRange.setValues(filledValues);

    Logger.log(
      "อัปเดต dormId คอลัมน์ " + dormIdColumn +
      " ของชีต " + target.sheetName +
      " (" + filledValues.length + " แถว)"
    );
  });

  const dormsSheet = getDormsSheet_();
  const dormValues = dormsSheet.getDataRange().getValues();

  const defaultDormExists = dormValues
    .slice(1)
    .some(function (row) {
      return String(row[0] || "").trim() === DEFAULT_DORM_ID;
    });

  if (!defaultDormExists) {
    dormsSheet.appendRow([
      DEFAULT_DORM_ID,
      "หอพักหลัก",
      "",
      "",
      "",
      "ACTIVE",
      new Date().toISOString()
    ]);

    Logger.log("สร้างหอเริ่มต้น (" + DEFAULT_DORM_ID + ") สำเร็จ");
  } else {
    Logger.log("มีหอเริ่มต้นอยู่แล้ว");
  }

  Logger.log("migrateAddDormId_() เสร็จสมบูรณ์");
}

/**
 * รันครั้งเดียวจาก Apps Script editor (ไม่เปิดผ่าน doPost)
 * เพิ่มคอลัมน์ phone / avatarUrl / avatarFileId ต่อท้ายชีต Users
 * (dormId อยู่คอลัมน์ 8 จาก migrateAddDormId_() แล้ว จึงเริ่มที่ 9)
 *
 * ใช้ตำแหน่งคอลัมน์คงที่เหมือน migrateAddDormId_() —
 * ไม่ต้องเติมค่า default เพราะปล่อยว่างไว้ได้ตามปกติ
 */
function migrateAddProfileFields_() {
  const sheet = getSpreadsheet_().getSheetByName("Users");

  if (!sheet) {
    Logger.log("ข้าม (ไม่พบชีต): Users");
    return;
  }

  const columns = [
    { name: "phone", index: 9 },
    { name: "avatarUrl", index: 10 },
    { name: "avatarFileId", index: 11 }
  ];

  columns.forEach(function (column) {
    const headerCell = sheet.getRange(1, column.index);

    if (
      String(headerCell.getValue() || "").trim() !== column.name
    ) {
      headerCell.setValue(column.name);
    }
  });

  Logger.log("migrateAddProfileFields_() เสร็จสมบูรณ์");
}

/**
 * รันครั้งเดียวจาก Apps Script editor — ตัวนี้ตั้งชื่อ
 * แบบไม่มี "_" ต่อท้าย เพื่อให้โผล่ใน dropdown "เรียกใช้"
 * (ฟังก์ชันที่ลงท้ายด้วย _ จะถูกซ่อนจาก dropdown อัตโนมัติ)
 *
 * รวม 3 ขั้นตอน setup ที่ต้องทำครั้งเดียวไว้ในปุ่มเดียว:
 * เพิ่มคอลัมน์ dormId, เพิ่มคอลัมน์ phone/avatarUrl/avatarFileId,
 * และสร้างบัญชี superadmin
 */
function runOneTimeSetup() {
  migrateAddDormId_();
  migrateAddProfileFields_();
  createInitialSuperAdmin();

  Logger.log(
    "runOneTimeSetup() เสร็จสมบูรณ์ทั้งหมด — " +
    "login superadmin / SuperAdmin@1234 ได้แล้ว"
  );
}
