const TENANTS_SHEET_NAME = "Tenants";

const TENANT_HEADERS = [
  "tenantId",
  "fullName",
  "citizenId",
  "phone",
  "lineId",
  "email",
  "roomId",
  "checkInDate",
  "checkOutDate",
  "status",
  "createdAt",
  "updatedAt"
];

function getTenants(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const sheet = getTenantsSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return {
      success: true,
      message: "โหลดข้อมูลสำเร็จ",
      data: []
    };
  }

  const index =
    getTenantHeaderIndex_(values[0]);

  const roomMap = getRoomMap_();

  const tenants = values
    .slice(1)
    .filter(function (row) {
      return String(
        row[index.tenantId] || ""
      ).trim();
    })
    .map(function (row) {
      return tenantFromRow_(
        row,
        index,
        roomMap
      );
    });

  return {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: tenants
  };
}

function createTenant(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const input = validateTenantInput_(
    request.tenant
  );

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getTenantsSheet_();
    const values = sheet.getDataRange().getValues();
    const index =
      getTenantHeaderIndex_(values[0]);

    const roomMap = getRoomMap_();

    if (!roomMap.has(input.roomId)) {
      return {
        success: false,
        message: "ไม่พบห้องพักที่เลือก"
      };
    }

    const occupiedRoomIds =
      getOccupiedRoomIds_();

    if (occupiedRoomIds.has(input.roomId)) {
      return {
        success: false,
        message:
          "ห้องนี้มีผู้เช่าพักอยู่แล้ว"
      };
    }

    const duplicateActiveTenant = values
      .slice(1)
      .some(function (row) {
        const citizenId = String(
          row[index.citizenId] || ""
        ).trim();

        const status = String(
          row[index.status] || ""
        )
          .trim()
          .toUpperCase();

        return (
          citizenId === input.citizenId &&
          status === "ACTIVE"
        );
      });

    if (duplicateActiveTenant) {
      return {
        success: false,
        message:
          "ผู้เช่ารายนี้กำลังพักอยู่ในระบบแล้ว"
      };
    }

    const now = new Date().toISOString();

    const createdTenant = {
  tenantId: Utilities.getUuid(),
  fullName: input.fullName,
  citizenId: input.citizenId,
  phone: input.phone,
  lineId: input.lineId,
  email: input.email,
  roomId: input.roomId,
  roomNo: roomMap.get(input.roomId) || "",
  checkInDate: input.checkInDate,
  checkOutDate: "",
  status: "ACTIVE",
  createdAt: now,
  updatedAt: now
};

sheet.appendRow([
  createdTenant.tenantId,
  createdTenant.fullName,
  createdTenant.citizenId,
  createdTenant.phone,
  createdTenant.lineId,
  createdTenant.email,
  createdTenant.roomId,
  createdTenant.checkInDate,
  createdTenant.checkOutDate,
  createdTenant.status,
  createdTenant.createdAt,
  createdTenant.updatedAt
]);

    return {
      success: true,
      message: "เพิ่มผู้เช่าสำเร็จ",
      data: createdTenant
    };
  } finally {
    lock.releaseLock();
  }
}

function updateTenant(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const tenantId = String(
    request.tenantId || ""
  ).trim();

  if (!tenantId) {
    return {
      success: false,
      message: "ไม่พบรหัสผู้เช่า"
    };
  }

  const input = validateTenantInput_(
    request.tenant
  );

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getTenantsSheet_();
    const values = sheet.getDataRange().getValues();
    const index =
      getTenantHeaderIndex_(values[0]);

    let targetRow = -1;

    for (let i = 1; i < values.length; i++) {
      const currentTenantId = String(
        values[i][index.tenantId] || ""
      ).trim();

      if (currentTenantId === tenantId) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) {
      return {
        success: false,
        message: "ไม่พบข้อมูลผู้เช่า"
      };
    }

    const originalRow =
      values[targetRow - 1];

    const originalStatus = String(
      originalRow[index.status] || ""
    )
      .trim()
      .toUpperCase();

    if (originalStatus !== "ACTIVE") {
      return {
        success: false,
        message:
          "ไม่สามารถแก้ไขผู้เช่าที่ออกแล้ว"
      };
    }

    const originalRoomId = String(
      originalRow[index.roomId] || ""
    ).trim();

    const roomMap = getRoomMap_();

    if (!roomMap.has(input.roomId)) {
      return {
        success: false,
        message: "ไม่พบห้องพักที่เลือก"
      };
    }

    if (input.roomId !== originalRoomId) {
      const occupiedRoomIds =
        getOccupiedRoomIds_();

      if (occupiedRoomIds.has(input.roomId)) {
        return {
          success: false,
          message:
            "ห้องใหม่มีผู้เช่าพักอยู่แล้ว"
        };
      }
    }

    const duplicateActiveTenant = values
      .slice(1)
      .some(function (row) {
        const currentTenantId = String(
          row[index.tenantId] || ""
        ).trim();

        const citizenId = String(
          row[index.citizenId] || ""
        ).trim();

        const status = String(
          row[index.status] || ""
        )
          .trim()
          .toUpperCase();

        return (
          currentTenantId !== tenantId &&
          citizenId === input.citizenId &&
          status === "ACTIVE"
        );
      });

    if (duplicateActiveTenant) {
      return {
        success: false,
        message:
          "ผู้เช่ารายนี้กำลังพักอยู่ในระบบแล้ว"
      };
    }

    const createdAt =
      formatSheetDate_(
        originalRow[index.createdAt]
      ) || new Date().toISOString();

    const updatedAt =
      new Date().toISOString();

    const updatedTenant = {
  tenantId,
  fullName: input.fullName,
  citizenId: input.citizenId,
  phone: input.phone,
  lineId: input.lineId,
  email: input.email,
  roomId: input.roomId,
  roomNo: roomMap.get(input.roomId) || "",
  checkInDate: input.checkInDate,
  checkOutDate: "",
  status: "ACTIVE",
  createdAt,
  updatedAt
};

sheet
  .getRange(
    targetRow,
    1,
    1,
    TENANT_HEADERS.length
  )
  .setValues([[
    updatedTenant.tenantId,
    updatedTenant.fullName,
    updatedTenant.citizenId,
    updatedTenant.phone,
    updatedTenant.lineId,
    updatedTenant.email,
    updatedTenant.roomId,
    updatedTenant.checkInDate,
    updatedTenant.checkOutDate,
    updatedTenant.status,
    updatedTenant.createdAt,
    updatedTenant.updatedAt
  ]]);
    return {
      success: true,
      message: "แก้ไขผู้เช่าสำเร็จ",
      data: updatedTenant
    };
  } finally {
    lock.releaseLock();
  }
}

function checkoutTenant(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const tenantId = String(
    request.tenantId || ""
  ).trim();

  if (!tenantId) {
    return {
      success: false,
      message: "ไม่พบรหัสผู้เช่า"
    };
  }

  const checkOutDate =
    normalizeDateTime_(
      request.checkOutDate,
      "วันและเวลาย้ายออก"
    );

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet =
      getTenantsSheet_();

    const values =
      sheet.getDataRange().getValues();

    const index =
      getTenantHeaderIndex_(
        values[0]
      );

    const roomMap =
      getRoomMap_();

    for (
      let i = 1;
      i < values.length;
      i++
    ) {
      const row = values[i];

      const currentTenantId = String(
        row[index.tenantId] || ""
      ).trim();

      if (currentTenantId !== tenantId) {
        continue;
      }

      const currentStatus = String(
        row[index.status] || ""
      )
        .trim()
        .toUpperCase();

      if (currentStatus !== "ACTIVE") {
        return {
          success: false,
          message:
            "ผู้เช่ารายนี้ย้ายออกแล้ว"
        };
      }

      const checkInDate =
        formatSheetDate_(
          row[index.checkInDate]
        );

      const checkInTime =
        new Date(checkInDate).getTime();

      const checkOutTime =
        new Date(checkOutDate).getTime();

      if (
        Number.isNaN(checkInTime) ||
        Number.isNaN(checkOutTime)
      ) {
        return {
          success: false,
          message:
            "ข้อมูลวันและเวลาไม่ถูกต้อง"
        };
      }

      if (checkOutTime < checkInTime) {
        return {
          success: false,
          message:
            "วันย้ายออกต้องไม่ก่อนวันเข้าพัก"
        };
      }

      const roomId = String(
        row[index.roomId] || ""
      ).trim();

      const updatedAt =
        new Date().toISOString();

      const checkedOutTenant = {
        tenantId,

        fullName: String(
          row[index.fullName] || ""
        ).trim(),

        citizenId: String(
          row[index.citizenId] || ""
        ).trim(),

        phone: String(
          row[index.phone] || ""
        ).trim(),

        lineId: String(
          row[index.lineId] || ""
        ).trim(),

        email: String(
          row[index.email] || ""
        ).trim(),

        roomId,

        roomNo:
          roomMap.get(roomId) || "",

        checkInDate,
        checkOutDate,
        status: "INACTIVE",

        createdAt:
          formatSheetDate_(
            row[index.createdAt]
          ) || updatedAt,

        updatedAt
      };

      sheet
        .getRange(
          i + 1,
          1,
          1,
          TENANT_HEADERS.length
        )
        .setValues([[
          checkedOutTenant.tenantId,
          checkedOutTenant.fullName,
          checkedOutTenant.citizenId,
          checkedOutTenant.phone,
          checkedOutTenant.lineId,
          checkedOutTenant.email,
          checkedOutTenant.roomId,
          checkedOutTenant.checkInDate,
          checkedOutTenant.checkOutDate,
          checkedOutTenant.status,
          checkedOutTenant.createdAt,
          checkedOutTenant.updatedAt
        ]]);

      return {
        success: true,
        message:
          "บันทึกการย้ายออกสำเร็จ",
        data: checkedOutTenant
      };
    }

    return {
      success: false,
      message: "ไม่พบข้อมูลผู้เช่า"
    };
  } finally {
    lock.releaseLock();
  }
}

function deleteTenant(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const tenantId = String(
    request.tenantId || ""
  ).trim();

  if (!tenantId) {
    return {
      success: false,
      message: "ไม่พบรหัสผู้เช่า"
    };
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet =
      getTenantsSheet_();

    const values =
      sheet.getDataRange().getValues();

    const index =
      getTenantHeaderIndex_(
        values[0]
      );

    for (
      let i = 1;
      i < values.length;
      i++
    ) {
      const row = values[i];

      const currentTenantId = String(
        row[index.tenantId] || ""
      ).trim();

      if (currentTenantId !== tenantId) {
        continue;
      }

      const status = String(
        row[index.status] || ""
      )
        .trim()
        .toUpperCase();

      if (status === "ACTIVE") {
        return {
          success: false,
          message:
            "กรุณาย้ายผู้เช่าออกก่อนลบข้อมูล"
        };
      }

      sheet.deleteRow(i + 1);

      return {
        success: true,
        message:
          "ลบข้อมูลผู้เช่าสำเร็จ",
        data: null
      };
    }

    return {
      success: false,
      message: "ไม่พบข้อมูลผู้เช่า"
    };
  } finally {
    lock.releaseLock();
  }
}

function getTenantsSheet_() {
  const spreadsheet =
    SpreadsheetApp.openById(SPREADSHEET_ID);

  let sheet =
    spreadsheet.getSheetByName(
      TENANTS_SHEET_NAME
    );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      TENANTS_SHEET_NAME
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(
        1,
        1,
        1,
        TENANT_HEADERS.length
      )
      .setValues([TENANT_HEADERS]);
  }

  const actualHeaders = sheet
    .getRange(
      1,
      1,
      1,
      TENANT_HEADERS.length
    )
    .getDisplayValues()[0]
    .map(function (header) {
      return String(header).trim();
    });

  const headerIsCorrect =
    TENANT_HEADERS.every(
      function (header, position) {
        return (
          actualHeaders[position] === header
        );
      }
    );

  if (!headerIsCorrect) {
    throw new Error(
      "หัวตารางชีต Tenants ไม่ถูกต้อง " +
      "กรุณาเรียงเป็น: " +
      TENANT_HEADERS.join(" | ")
    );
  }

  /*
   * C = citizenId
   * D = phone
   * E = lineId
   * F = email
   *
   * บังคับเป็นข้อความ ป้องกันเลข 0 ด้านหน้าหาย
   */
  sheet
    .getRange("C:F")
    .setNumberFormat("@");

  return sheet;
}

function getTenantHeaderIndex_(headers) {
  const index = {};

  headers.forEach(function (
    header,
    position
  ) {
    index[String(header).trim()] =
      position;
  });

  TENANT_HEADERS.forEach(function (header) {
    if (index[header] === undefined) {
      throw new Error(
        "ไม่พบคอลัมน์ " +
        header +
        " ในชีต Tenants"
      );
    }
  });

  return index;
}

function validateTenantInput_(tenantInput) {
  const input = tenantInput || {};

  const fullName = String(
    input.fullName || ""
  ).trim();

  const citizenId = String(
    input.citizenId || ""
  ).trim();

  const phone = String(
    input.phone || ""
  ).replace(/\D/g, "");

  const lineId = String(
    input.lineId || ""
  ).trim();

  const email = String(
    input.email || ""
  ).trim();

  const roomId = String(
    input.roomId || ""
  ).trim();

  if (!fullName) {
    throw new Error(
      "กรุณากรอกชื่อผู้เช่า"
    );
  }

  if (!citizenId) {
    throw new Error(
      "กรุณากรอกเลขบัตรประชาชนหรือ Passport"
    );
  }

  if (!/^\d{10}$/.test(phone)) {
    throw new Error(
      "เบอร์โทรต้องเป็นตัวเลข 10 หลัก"
    );
  }

  if (
    email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email
    )
  ) {
    throw new Error(
      "รูปแบบ E-mail ไม่ถูกต้อง"
    );
  }

  if (!roomId) {
    throw new Error(
      "กรุณาเลือกห้องพัก"
    );
  }

  const checkInDate =
    normalizeDateTime_(
      input.checkInDate,
      "วันและเวลาเข้าพัก"
    );

  return {
    fullName,
    citizenId,
    phone,
    lineId,
    email,
    roomId,
    checkInDate
  };
}

function normalizeDateTime_(
  value,
  fieldName
) {
  const text =
    String(value || "").trim();

  if (!text) {
    throw new Error(
      "กรุณาระบุ" + fieldName
    );
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "รูปแบบ" + fieldName + "ไม่ถูกต้อง"
    );
  }

  return date.toISOString();
}

function tenantFromRow_(
  row,
  index,
  roomMap
) {
  const roomId = String(
    row[index.roomId] || ""
  ).trim();

  return {
    tenantId: String(
      row[index.tenantId] || ""
    ).trim(),

    fullName: String(
      row[index.fullName] || ""
    ).trim(),

    citizenId: String(
      row[index.citizenId] || ""
    ).trim(),

    phone: String(
      row[index.phone] || ""
    ).trim(),

    lineId: String(
      row[index.lineId] || ""
    ).trim(),

    email: String(
      row[index.email] || ""
    ).trim(),

    roomId,

    roomNo:
      roomMap.get(roomId) || "",

    checkInDate: formatSheetDate_(
      row[index.checkInDate]
    ),

    checkOutDate: formatSheetDate_(
      row[index.checkOutDate]
    ),

    status: String(
      row[index.status] || ""
    )
      .trim()
      .toUpperCase(),

    createdAt: formatSheetDate_(
      row[index.createdAt]
    ),

    updatedAt: formatSheetDate_(
      row[index.updatedAt]
    )
  };
}

function getRoomMap_() {
  const roomSheet = getRoomsSheet_();
  const values =
    roomSheet.getDataRange().getValues();

  const roomMap = new Map();

  if (values.length <= 1) {
    return roomMap;
  }

  const index =
    getRoomHeaderIndex_(values[0]);

  values.slice(1).forEach(function (row) {
    const roomId = String(
      row[index.roomId] || ""
    ).trim();

    const roomNo = String(
      row[index.roomNo] || ""
    ).trim();

    if (roomId) {
      roomMap.set(roomId, roomNo);
    }
  });

  return roomMap;
}

