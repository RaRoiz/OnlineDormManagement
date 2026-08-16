const METERS_SHEET_NAME = "Meters";

const METER_HEADERS = [
  "meterId",
  "roomId",
  "tenantId",
  "tenantName",
  "billingMonth",
  "waterPrevious",
  "waterCurrent",
  "waterUnits",
  "waterRate",
  "waterAmount",
  "electricPrevious",
  "electricCurrent",
  "electricUnits",
  "electricRate",
  "electricAmount",
  "totalUtility",
  "recordedAt",
  "updatedAt"
];

function getMeters(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const sheet = getMetersSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return {
      success: true,
      message: "โหลดข้อมูลสำเร็จ",
      data: []
    };
  }

  const index =
    getMeterHeaderIndex_(values[0]);

  const roomMap = getRoomMap_();

  const records = values
    .slice(1)
    .filter(function (row) {
      return String(
        row[index.meterId] || ""
      ).trim();
    })
    .map(function (row) {
      return meterFromRow_(
        row,
        index,
        roomMap
      );
    })
    .sort(function (a, b) {
      const monthCompare =
        b.billingMonth.localeCompare(
          a.billingMonth
        );

      if (monthCompare !== 0) {
        return monthCompare;
      }

      return String(a.roomNo).localeCompare(
        String(b.roomNo),
        undefined,
        { numeric: true }
      );
    });

  return {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: records
  };
}

function createMeter(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const input =
    validateMeterInput_(request.meter);

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet = getMetersSheet_();
    const values =
      sheet.getDataRange().getValues();

    const index =
      getMeterHeaderIndex_(values[0]);

    const roomMap = getRoomMap_();

    if (!roomMap.has(input.roomId)) {
      return {
        success: false,
        message: "ไม่พบห้องพักที่เลือก"
      };
    }

    const activeTenantMap =
      getActiveTenantByRoomMap_();

    const activeTenant =
      activeTenantMap.get(input.roomId);

    if (!activeTenant) {
      return {
        success: false,
        message:
          "ห้องนี้ยังไม่มีผู้เช่าที่กำลังพัก"
      };
    }

    const duplicate = values
      .slice(1)
      .some(function (row) {
        const roomId = String(
          row[index.roomId] || ""
        ).trim();

        const billingMonth = String(
          row[index.billingMonth] || ""
        ).trim();

        return (
          roomId === input.roomId &&
          billingMonth === input.billingMonth
        );
      });

    if (duplicate) {
      return {
        success: false,
        message:
          "ห้องนี้มีข้อมูลมิเตอร์ของเดือนดังกล่าวแล้ว"
      };
    }

    const calculated =
      calculateMeter_(input);

    const now =
      new Date().toISOString();

    const createdMeter = {
      meterId: Utilities.getUuid(),
      roomId: input.roomId,
      roomNo:
        roomMap.get(input.roomId) || "",

      tenantId: activeTenant.tenantId,
      tenantName: activeTenant.fullName,

      billingMonth: input.billingMonth,

      waterPrevious: input.waterPrevious,
      waterCurrent: input.waterCurrent,
      waterUnits: calculated.waterUnits,
      waterRate: input.waterRate,
      waterAmount: calculated.waterAmount,

      electricPrevious:
        input.electricPrevious,

      electricCurrent:
        input.electricCurrent,

      electricUnits:
        calculated.electricUnits,

      electricRate:
        input.electricRate,

      electricAmount:
        calculated.electricAmount,

      totalUtility:
        calculated.totalUtility,

      recordedAt: now,
      updatedAt: now
    };

    sheet.appendRow([
      createdMeter.meterId,
      createdMeter.roomId,
      createdMeter.tenantId,
      createdMeter.tenantName,
      createdMeter.billingMonth,
      createdMeter.waterPrevious,
      createdMeter.waterCurrent,
      createdMeter.waterUnits,
      createdMeter.waterRate,
      createdMeter.waterAmount,
      createdMeter.electricPrevious,
      createdMeter.electricCurrent,
      createdMeter.electricUnits,
      createdMeter.electricRate,
      createdMeter.electricAmount,
      createdMeter.totalUtility,
      createdMeter.recordedAt,
      createdMeter.updatedAt
    ]);

    // ล้าง cache ให้หน้าอื่นเห็นข้อมูลใหม่ทันที
    bumpDormCache_();

    return {
      success: true,
      message:
        "เพิ่มข้อมูลมิเตอร์สำเร็จ",
      data: createdMeter
    };
  } finally {
    lock.releaseLock();
  }
}

function updateMeter(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const meterId = String(
    request.meterId || ""
  ).trim();

  if (!meterId) {
    return {
      success: false,
      message: "ไม่พบรหัสข้อมูลมิเตอร์"
    };
  }

  const input =
    validateMeterInput_(request.meter);

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet = getMetersSheet_();
    const values =
      sheet.getDataRange().getValues();

    const index =
      getMeterHeaderIndex_(values[0]);

    let targetRow = -1;

    for (let i = 1; i < values.length; i++) {
      const currentMeterId = String(
        values[i][index.meterId] || ""
      ).trim();

      if (currentMeterId === meterId) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) {
      return {
        success: false,
        message:
          "ไม่พบข้อมูลมิเตอร์"
      };
    }

    const duplicate = values
      .slice(1)
      .some(function (row) {
        const currentMeterId = String(
          row[index.meterId] || ""
        ).trim();

        const roomId = String(
          row[index.roomId] || ""
        ).trim();

        const billingMonth = String(
          row[index.billingMonth] || ""
        ).trim();

        return (
          currentMeterId !== meterId &&
          roomId === input.roomId &&
          billingMonth === input.billingMonth
        );
      });

    if (duplicate) {
      return {
        success: false,
        message:
          "ห้องนี้มีข้อมูลมิเตอร์ของเดือนดังกล่าวแล้ว"
      };
    }

    const originalRow =
      values[targetRow - 1];

    const roomMap = getRoomMap_();

    if (!roomMap.has(input.roomId)) {
      return {
        success: false,
        message: "ไม่พบห้องพักที่เลือก"
      };
    }

    const calculated =
      calculateMeter_(input);

    const recordedAt =
      formatSheetDate_(
        originalRow[index.recordedAt]
      ) || new Date().toISOString();

    const updatedAt =
      new Date().toISOString();

    const updatedMeter = {
      meterId,
      roomId: input.roomId,
      roomNo:
        roomMap.get(input.roomId) || "",

      tenantId: String(
        originalRow[index.tenantId] || ""
      ).trim(),

      tenantName: String(
        originalRow[index.tenantName] || ""
      ).trim(),

      billingMonth: input.billingMonth,

      waterPrevious: input.waterPrevious,
      waterCurrent: input.waterCurrent,
      waterUnits: calculated.waterUnits,
      waterRate: input.waterRate,
      waterAmount: calculated.waterAmount,

      electricPrevious:
        input.electricPrevious,

      electricCurrent:
        input.electricCurrent,

      electricUnits:
        calculated.electricUnits,

      electricRate:
        input.electricRate,

      electricAmount:
        calculated.electricAmount,

      totalUtility:
        calculated.totalUtility,

      recordedAt,
      updatedAt
    };

    sheet
      .getRange(
        targetRow,
        1,
        1,
        METER_HEADERS.length
      )
      .setValues([[
        updatedMeter.meterId,
        updatedMeter.roomId,
        updatedMeter.tenantId,
        updatedMeter.tenantName,
        updatedMeter.billingMonth,
        updatedMeter.waterPrevious,
        updatedMeter.waterCurrent,
        updatedMeter.waterUnits,
        updatedMeter.waterRate,
        updatedMeter.waterAmount,
        updatedMeter.electricPrevious,
        updatedMeter.electricCurrent,
        updatedMeter.electricUnits,
        updatedMeter.electricRate,
        updatedMeter.electricAmount,
        updatedMeter.totalUtility,
        updatedMeter.recordedAt,
        updatedMeter.updatedAt
      ]]);

    // ล้าง cache ให้หน้าอื่นเห็นข้อมูลใหม่ทันที
    bumpDormCache_();

    return {
      success: true,
      message:
        "แก้ไขข้อมูลมิเตอร์สำเร็จ",
      data: updatedMeter
    };
  } finally {
    lock.releaseLock();
  }
}

function deleteMeter(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const meterId = String(
    request.meterId || ""
  ).trim();

  if (!meterId) {
    return {
      success: false,
      message: "ไม่พบรหัสข้อมูลมิเตอร์"
    };
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet = getMetersSheet_();
    const values =
      sheet.getDataRange().getValues();

    const index =
      getMeterHeaderIndex_(values[0]);

    for (let i = 1; i < values.length; i++) {
      const currentMeterId = String(
        values[i][index.meterId] || ""
      ).trim();

      if (currentMeterId !== meterId) {
        continue;
      }

      sheet.deleteRow(i + 1);

      // ล้าง cache ให้หน้าอื่นเห็นข้อมูลใหม่ทันที
      bumpDormCache_();

      return {
        success: true,
        message:
          "ลบข้อมูลมิเตอร์สำเร็จ",
        data: null
      };
    }

    return {
      success: false,
      message: "ไม่พบข้อมูลมิเตอร์"
    };
  } finally {
    lock.releaseLock();
  }
}

function validateMeterInput_(meterInput) {
  const input = meterInput || {};

  const roomId = String(
    input.roomId || ""
  ).trim();

  const billingMonth =
    normalizeBillingMonth_(
      input.billingMonth
    );

  if (!roomId) {
    throw new Error(
      "กรุณาเลือกห้องพัก"
    );
  }

  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/.test(
      billingMonth
    )
  ) {
    throw new Error(
      "รูปแบบเดือนเรียกเก็บไม่ถูกต้อง"
    );
  }

  const waterPrevious =
    Number(input.waterPrevious);

  const waterCurrent =
    Number(input.waterCurrent);

  const waterRate =
    Number(input.waterRate);

  const electricPrevious =
    Number(input.electricPrevious);

  const electricCurrent =
    Number(input.electricCurrent);

  const electricRate =
    Number(input.electricRate);

  const numericValues = [
    waterPrevious,
    waterCurrent,
    waterRate,
    electricPrevious,
    electricCurrent,
    electricRate
  ];

  if (
    numericValues.some(function (value) {
      return !Number.isFinite(value);
    })
  ) {
    throw new Error(
      "ข้อมูลมิเตอร์ต้องเป็นตัวเลข"
    );
  }

  if (
    waterPrevious < 0 ||
    waterCurrent < waterPrevious
  ) {
    throw new Error(
      "มิเตอร์น้ำปัจจุบันต้องไม่น้อยกว่าครั้งก่อน"
    );
  }

  if (waterRate < 0) {
    throw new Error(
      "ราคาค่าน้ำต่อหน่วยไม่ถูกต้อง"
    );
  }

  if (
    electricPrevious < 0 ||
    electricCurrent < electricPrevious
  ) {
    throw new Error(
      "มิเตอร์ไฟปัจจุบันต้องไม่น้อยกว่าครั้งก่อน"
    );
  }

  if (electricRate < 0) {
    throw new Error(
      "ราคาค่าไฟต่อหน่วยไม่ถูกต้อง"
    );
  }

  return {
    roomId,
    billingMonth,
    waterPrevious,
    waterCurrent,
    waterRate,
    electricPrevious,
    electricCurrent,
    electricRate
  };
}

function calculateMeter_(input) {
  const waterUnits =
    input.waterCurrent -
    input.waterPrevious;

  const waterAmount =
    waterUnits * input.waterRate;

  const electricUnits =
    input.electricCurrent -
    input.electricPrevious;

  const electricAmount =
    electricUnits * input.electricRate;

  return {
    waterUnits,
    waterAmount,
    electricUnits,
    electricAmount,

    totalUtility:
      waterAmount + electricAmount
  };
}

function getMetersSheet_() {
  // ใช้ handle กลางจาก Performance.gs
  // แทนการ openById ใหม่ทุกครั้ง
  const spreadsheet = getSpreadsheet_();

  let sheet =
    spreadsheet.getSheetByName(
      METERS_SHEET_NAME
    );

  if (!sheet) {
    sheet = spreadsheet.insertSheet(
      METERS_SHEET_NAME
    );
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(
        1,
        1,
        1,
        METER_HEADERS.length
      )
      .setValues([METER_HEADERS]);

    // ป้องกัน Google Sheets แปลง 2026-01 เป็น Date
    // ตั้งครั้งเดียวตอนสร้างชีต ไม่ต้องตั้งซ้ำทุกการอ่าน
    sheet
      .getRange("E:E")
      .setNumberFormat("@");
  }

  const actualHeaders = sheet
    .getRange(
      1,
      1,
      1,
      METER_HEADERS.length
    )
    .getDisplayValues()[0]
    .map(function (header) {
      return String(header).trim();
    });

  const headersCorrect =
    METER_HEADERS.every(
      function (header, position) {
        return (
          actualHeaders[position] === header
        );
      }
    );

  if (!headersCorrect) {
    throw new Error(
      "หัวตารางชีต Meters ไม่ถูกต้อง " +
      "กรุณาเรียงเป็น: " +
      METER_HEADERS.join(" | ")
    );
  }

  return sheet;
}

function getMeterHeaderIndex_(headers) {
  const index = {};

  headers.forEach(function (
    header,
    position
  ) {
    index[String(header).trim()] =
      position;
  });

  METER_HEADERS.forEach(
    function (header) {
      if (index[header] === undefined) {
        throw new Error(
          "ไม่พบคอลัมน์ " +
          header +
          " ในชีต Meters"
        );
      }
    }
  );

  return index;
}

function meterFromRow_(
  row,
  index,
  roomMap
) {
  const roomId = String(
    row[index.roomId] || ""
  ).trim();

  return {
    meterId: String(
      row[index.meterId] || ""
    ).trim(),

    roomId,

    roomNo:
      roomMap.get(roomId) || "",

    tenantId: String(
      row[index.tenantId] || ""
    ).trim(),

    tenantName: String(
      row[index.tenantName] || ""
    ).trim(),

    billingMonth:
      normalizeBillingMonth_(
        row[index.billingMonth]
      ),

    waterPrevious: Number(
      row[index.waterPrevious] || 0
    ),

    waterCurrent: Number(
      row[index.waterCurrent] || 0
    ),

    waterUnits: Number(
      row[index.waterUnits] || 0
    ),

    waterRate: Number(
      row[index.waterRate] || 0
    ),

    waterAmount: Number(
      row[index.waterAmount] || 0
    ),

    electricPrevious: Number(
      row[index.electricPrevious] || 0
    ),

    electricCurrent: Number(
      row[index.electricCurrent] || 0
    ),

    electricUnits: Number(
      row[index.electricUnits] || 0
    ),

    electricRate: Number(
      row[index.electricRate] || 0
    ),

    electricAmount: Number(
      row[index.electricAmount] || 0
    ),

    totalUtility: Number(
      row[index.totalUtility] || 0
    ),

    recordedAt: formatSheetDate_(
      row[index.recordedAt]
    ),

    updatedAt: formatSheetDate_(
      row[index.updatedAt]
    )
  };
}

function getActiveTenantByRoomMap_() {
  const sheet = getTenantsSheet_();
  const values =
    sheet.getDataRange().getValues();

  const tenantMap = new Map();

  if (values.length <= 1) {
    return tenantMap;
  }

  const index =
    getTenantHeaderIndex_(values[0]);

  values.slice(1).forEach(function (row) {
    const status = String(
      row[index.status] || ""
    )
      .trim()
      .toUpperCase();

    const roomId = String(
      row[index.roomId] || ""
    ).trim();

    if (
      status === "ACTIVE" &&
      roomId
    ) {
      tenantMap.set(roomId, {
        tenantId: String(
          row[index.tenantId] || ""
        ).trim(),

        fullName: String(
          row[index.fullName] || ""
        ).trim()
      });
    }
  });

  return tenantMap;
}

function normalizeBillingMonth_(value) {
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM"
    );
  }

  const text = String(
    value || ""
  ).trim();

  if (
    /^\d{4}-(0[1-9]|1[0-2])$/.test(
      text
    )
  ) {
    return text;
  }

  const date = new Date(text);

  if (!Number.isNaN(date.getTime())) {
    return Utilities.formatDate(
      date,
      Session.getScriptTimeZone(),
      "yyyy-MM"
    );
  }

  return "";
}

function migrateMeterBillingMonths() {
  const sheet = getMetersSheet_();

  const values =
    sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return;
  }

  const index =
    getMeterHeaderIndex_(
      values[0]
    );

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    const billingMonth =
      normalizeBillingMonth_(
        values[i][index.billingMonth]
      );

    if (!billingMonth) {
      continue;
    }

    sheet
      .getRange(
        i + 1,
        index.billingMonth + 1
      )
      .setNumberFormat("@")
      .setValue(billingMonth);
  }

  SpreadsheetApp.flush();
}
