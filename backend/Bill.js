const BILLS_SHEET_NAME = "Bills";

const BILL_HEADERS = [
  "billId",
  "billNo",
  "meterId",
  "roomId",
  "roomNo",
  "tenantId",
  "tenantName",
  "billingMonth",
  "roomRent",
  "waterAmount",
  "electricAmount",
  "depositAmount",
  "repairAmount",
  "damageAmount",
  "totalAmount",
  "dueDate",
  "paymentStatus",
  "paidAt",
  "note",
  "createdAt",
  "updatedAt"
];

function getBills(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const sheet =
    getBillsSheet_();

  const values =
    sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return {
      success: true,
      message: "โหลดข้อมูลสำเร็จ",
      data: []
    };
  }

  const index =
    getBillHeaderIndex_(
      values[0]
    );

  const bills = values
    .slice(1)
    .filter(function (row) {
      return String(
        row[index.billId] || ""
      ).trim();
    })
    .map(function (row) {
      return billFromRow_(
        row,
        index
      );
    })
    .sort(function (a, b) {
      return String(
        b.billingMonth
      ).localeCompare(
        String(a.billingMonth)
      );
    });

  return {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: bills
  };
}

function createBill(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const input =
    validateBillInput_(
      request.bill
    );

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet =
      getBillsSheet_();

    const values =
      sheet.getDataRange().getValues();

    const index =
      getBillHeaderIndex_(
        values[0]
      );

    const duplicate = values
      .slice(1)
      .some(function (row) {
        return (
          String(
            row[index.meterId] || ""
          ).trim() === input.meterId
        );
      });

    if (duplicate) {
      return {
        success: false,
        message:
          "รายการมิเตอร์นี้ถูกสร้างใบแจ้งหนี้แล้ว"
      };
    }

    const meter =
      getBillMeterById_(
        input.meterId
      );

    if (!meter) {
      return {
        success: false,
        message:
          "ไม่พบข้อมูลมิเตอร์ที่เลือก"
      };
    }

    const room =
      getBillRoomById_(
        meter.roomId
      );

    if (!room) {
      return {
        success: false,
        message:
          "ไม่พบข้อมูลห้องพัก"
      };
    }

    const totalAmount =
      room.price +
      meter.waterAmount +
      meter.electricAmount +
      input.depositAmount +
      input.repairAmount +
      input.damageAmount;

    const now =
      new Date().toISOString();

    const billNo =
      "INV-" +
      meter.billingMonth
        .replace("-", "") +
      "-" +
      room.roomNo;

    const createdBill = {
      billId:
        Utilities.getUuid(),

      billNo,
      meterId: meter.meterId,

      roomId: room.roomId,
      roomNo: room.roomNo,

      tenantId:
        meter.tenantId,

      tenantName:
        meter.tenantName,

      billingMonth:
        meter.billingMonth,

      roomRent: room.price,

      waterAmount:
        meter.waterAmount,

      electricAmount:
        meter.electricAmount,

      depositAmount:
        input.depositAmount,

      repairAmount:
        input.repairAmount,

      damageAmount:
        input.damageAmount,

      totalAmount,

      dueDate: input.dueDate,

      paymentStatus:
        "UNPAID",

      paidAt: "",
      note: input.note,

      createdAt: now,
      updatedAt: now
    };

    sheet.appendRow([
      createdBill.billId,
      createdBill.billNo,
      createdBill.meterId,
      createdBill.roomId,
      createdBill.roomNo,
      createdBill.tenantId,
      createdBill.tenantName,
      createdBill.billingMonth,
      createdBill.roomRent,
      createdBill.waterAmount,
      createdBill.electricAmount,
      createdBill.depositAmount,
      createdBill.repairAmount,
      createdBill.damageAmount,
      createdBill.totalAmount,
      createdBill.dueDate,
      createdBill.paymentStatus,
      createdBill.paidAt,
      createdBill.note,
      createdBill.createdAt,
      createdBill.updatedAt
    ]);

bumpDormCache_();

    return {
      success: true,
      message:
        "สร้างใบแจ้งหนี้สำเร็จ",
      data: createdBill
    };
  } finally {
    lock.releaseLock();
  }
}

function updateBill(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const billId = String(
    request.billId || ""
  ).trim();

  if (!billId) {
    return {
      success: false,
      message:
        "ไม่พบรหัสใบแจ้งหนี้"
    };
  }

  const input =
    validateBillInput_(
      request.bill
    );

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet =
      getBillsSheet_();

    const values =
      sheet.getDataRange().getValues();

    const index =
      getBillHeaderIndex_(
        values[0]
      );

    let targetRow = -1;

    for (
      let i = 1;
      i < values.length;
      i++
    ) {
      const currentBillId =
        String(
          values[i][index.billId] ||
            ""
        ).trim();

      if (
        currentBillId === billId
      ) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) {
      return {
        success: false,
        message:
          "ไม่พบข้อมูลใบแจ้งหนี้"
      };
    }

    const originalRow =
      values[targetRow - 1];

    const paymentStatus =
      String(
        originalRow[
          index.paymentStatus
        ] || ""
      )
        .trim()
        .toUpperCase();

    if (paymentStatus === "PAID") {
      return {
        success: false,
        message:
          "ไม่สามารถแก้ไขบิลที่ชำระแล้ว"
      };
    }

    const duplicate = values
      .slice(1)
      .some(function (row) {
        const currentBillId =
          String(
            row[index.billId] || ""
          ).trim();

        const currentMeterId =
          String(
            row[index.meterId] || ""
          ).trim();

        return (
          currentBillId !== billId &&
          currentMeterId ===
            input.meterId
        );
      });

    if (duplicate) {
      return {
        success: false,
        message:
          "รายการมิเตอร์นี้ถูกสร้างใบแจ้งหนี้แล้ว"
      };
    }

    const meter =
      getBillMeterById_(
        input.meterId
      );

    if (!meter) {
      return {
        success: false,
        message:
          "ไม่พบข้อมูลมิเตอร์"
      };
    }

    const room =
      getBillRoomById_(
        meter.roomId
      );

    if (!room) {
      return {
        success: false,
        message:
          "ไม่พบข้อมูลห้องพัก"
      };
    }

    const totalAmount =
      room.price +
      meter.waterAmount +
      meter.electricAmount +
      input.depositAmount +
      input.repairAmount +
      input.damageAmount;

    const createdAt =
      formatSheetDate_(
        originalRow[
          index.createdAt
        ]
      ) || new Date().toISOString();

    const updatedAt =
      new Date().toISOString();

    const updatedBill = {
      billId,

      billNo:
        "INV-" +
        meter.billingMonth
          .replace("-", "") +
        "-" +
        room.roomNo,

      meterId: meter.meterId,
      roomId: room.roomId,
      roomNo: room.roomNo,

      tenantId:
        meter.tenantId,

      tenantName:
        meter.tenantName,

      billingMonth:
        meter.billingMonth,

      roomRent: room.price,

      waterAmount:
        meter.waterAmount,

      electricAmount:
        meter.electricAmount,

      depositAmount:
        input.depositAmount,

      repairAmount:
        input.repairAmount,

      damageAmount:
        input.damageAmount,

      totalAmount,
      dueDate: input.dueDate,

      paymentStatus: "UNPAID",
      paidAt: "",

      note: input.note,

      createdAt,
      updatedAt
    };

    sheet
      .getRange(
        targetRow,
        1,
        1,
        BILL_HEADERS.length
      )
      .setValues([[
        updatedBill.billId,
        updatedBill.billNo,
        updatedBill.meterId,
        updatedBill.roomId,
        updatedBill.roomNo,
        updatedBill.tenantId,
        updatedBill.tenantName,
        updatedBill.billingMonth,
        updatedBill.roomRent,
        updatedBill.waterAmount,
        updatedBill.electricAmount,
        updatedBill.depositAmount,
        updatedBill.repairAmount,
        updatedBill.damageAmount,
        updatedBill.totalAmount,
        updatedBill.dueDate,
        updatedBill.paymentStatus,
        updatedBill.paidAt,
        updatedBill.note,
        updatedBill.createdAt,
        updatedBill.updatedAt
      ]]);

    // ล้าง cache ให้หน้าอื่นเห็นข้อมูลใหม่ทันที
    bumpDormCache_();

    return {
      success: true,
      message:
        "แก้ไขใบแจ้งหนี้สำเร็จ",
      data: updatedBill
    };
  } finally {
    lock.releaseLock();
  }
}

function markBillPaid(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const billId = String(
    request.billId || ""
  ).trim();

  if (!billId) {
    return {
      success: false,
      message:
        "ไม่พบรหัสใบแจ้งหนี้"
    };
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet =
      getBillsSheet_();

    const values =
      sheet.getDataRange().getValues();

    const index =
      getBillHeaderIndex_(
        values[0]
      );

    for (
      let i = 1;
      i < values.length;
      i++
    ) {
      const row = values[i];

      if (
        String(
          row[index.billId] || ""
        ).trim() !== billId
      ) {
        continue;
      }

      const currentStatus =
        String(
          row[
            index.paymentStatus
          ] || ""
        )
          .trim()
          .toUpperCase();

      if (
        currentStatus === "PAID"
      ) {
        return {
          success: false,
          message:
            "ใบแจ้งหนี้นี้ชำระแล้ว"
        };
      }

      const paidAt =
        new Date().toISOString();

      sheet
        .getRange(
          i + 1,
          index.paymentStatus + 1
        )
        .setValue("PAID");

      sheet
        .getRange(
          i + 1,
          index.paidAt + 1
        )
        .setValue(paidAt);

      sheet
        .getRange(
          i + 1,
          index.updatedAt + 1
        )
        .setValue(paidAt);

      const updatedValues =
        sheet
          .getRange(
            i + 1,
            1,
            1,
            BILL_HEADERS.length
          )
          .getValues()[0];

      // ล้าง cache ให้หน้าอื่นเห็นข้อมูลใหม่ทันที
      bumpDormCache_();

      return {
        success: true,
        message:
          "บันทึกการชำระเงินสำเร็จ",
        data: billFromRow_(
          updatedValues,
          index
        )
      };
    }

    return {
      success: false,
      message:
        "ไม่พบข้อมูลใบแจ้งหนี้"
    };
  } finally {
    lock.releaseLock();
  }
}

function deleteBill(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const billId = String(
    request.billId || ""
  ).trim();

  if (!billId) {
    return {
      success: false,
      message:
        "ไม่พบรหัสใบแจ้งหนี้"
    };
  }

  const lock =
    LockService.getScriptLock();

  lock.waitLock(10000);

  try {
    const sheet =
      getBillsSheet_();

    const values =
      sheet.getDataRange().getValues();

    const index =
      getBillHeaderIndex_(
        values[0]
      );

    for (
      let i = 1;
      i < values.length;
      i++
    ) {
      const row = values[i];

      if (
        String(
          row[index.billId] || ""
        ).trim() !== billId
      ) {
        continue;
      }

      const paymentStatus =
        String(
          row[
            index.paymentStatus
          ] || ""
        )
          .trim()
          .toUpperCase();

      if (
        paymentStatus === "PAID"
      ) {
        return {
          success: false,
          message:
            "ไม่สามารถลบบิลที่ชำระแล้ว"
        };
      }

      sheet.deleteRow(i + 1);

      // ล้าง cache ให้หน้าอื่นเห็นข้อมูลใหม่ทันที
      bumpDormCache_();

      return {
        success: true,
        message:
          "ลบใบแจ้งหนี้สำเร็จ",
        data: null
      };
    }

    return {
      success: false,
      message:
        "ไม่พบข้อมูลใบแจ้งหนี้"
    };
  } finally {
    lock.releaseLock();
  }
}

function validateBillInput_(
  billInput
) {
  const input =
    billInput || {};

  const meterId = String(
    input.meterId || ""
  ).trim();

  const dueDate = String(
    input.dueDate || ""
  ).trim();

  const note = String(
    input.note || ""
  ).trim();

  if (!meterId) {
    throw new Error(
      "กรุณาเลือกรายการมิเตอร์"
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      dueDate
    )
  ) {
    throw new Error(
      "รูปแบบวันครบกำหนดไม่ถูกต้อง"
    );
  }

  const depositAmount =
    Number(
      input.depositAmount || 0
    );

  const repairAmount =
    Number(
      input.repairAmount || 0
    );

  const damageAmount =
    Number(
      input.damageAmount || 0
    );

  const values = [
    depositAmount,
    repairAmount,
    damageAmount
  ];

  if (
    values.some(function (value) {
      return (
        !Number.isFinite(value) ||
        value < 0
      );
    })
  ) {
    throw new Error(
      "ค่าใช้จ่ายเพิ่มเติมไม่ถูกต้อง"
    );
  }

  return {
    meterId,
    depositAmount,
    repairAmount,
    damageAmount,
    dueDate,
    note
  };
}

function getBillsSheet_() {
  // ใช้ handle กลางจาก Performance.js
  const spreadsheet = getSpreadsheet_();

  let sheet =
    spreadsheet.getSheetByName(
      BILLS_SHEET_NAME
    );

  if (!sheet) {
    sheet =
      spreadsheet.insertSheet(
        BILLS_SHEET_NAME
      );
  }

  if (sheet.getLastRow() === 0) {
    sheet
      .getRange(
        1,
        1,
        1,
        BILL_HEADERS.length
      )
      .setValues([BILL_HEADERS]);

    // ตั้ง format ครั้งเดียวตอนสร้างชีต
    // ไม่ต้องสั่งซ้ำทุกการอ่าน
    sheet
      .getRange("B:H")
      .setNumberFormat("@");

    sheet
      .getRange("P:S")
      .setNumberFormat("@");
  }

  const actualHeaders = sheet
    .getRange(
      1,
      1,
      1,
      BILL_HEADERS.length
    )
    .getDisplayValues()[0]
    .map(function (header) {
      return String(
        header
      ).trim();
    });

  const headersCorrect =
    BILL_HEADERS.every(
      function (
        header,
        position
      ) {
        return (
          actualHeaders[position] ===
          header
        );
      }
    );

  if (!headersCorrect) {
    throw new Error(
      "หัวตารางชีต Bills ไม่ถูกต้อง " +
      "กรุณาเรียงเป็น: " +
      BILL_HEADERS.join(" | ")
    );
  }

  return sheet;
}

function getBillHeaderIndex_(
  headers
) {
  const index = {};

  headers.forEach(function (
    header,
    position
  ) {
    index[
      String(header).trim()
    ] = position;
  });

  BILL_HEADERS.forEach(
    function (header) {
      if (
        index[header] ===
        undefined
      ) {
        throw new Error(
          "ไม่พบคอลัมน์ " +
          header +
          " ในชีต Bills"
        );
      }
    }
  );

  return index;
}

function billFromRow_(
  row,
  index
) {
  return {
    billId: String(
      row[index.billId] || ""
    ).trim(),

    billNo: String(
      row[index.billNo] || ""
    ).trim(),

    meterId: String(
      row[index.meterId] || ""
    ).trim(),

    roomId: String(
      row[index.roomId] || ""
    ).trim(),

    roomNo: String(
      row[index.roomNo] || ""
    ).trim(),

    tenantId: String(
      row[index.tenantId] || ""
    ).trim(),

    tenantName: String(
      row[index.tenantName] || ""
    ).trim(),

    billingMonth:
      normalizeBillMonth_(
        row[index.billingMonth]
      ),

    roomRent: Number(
      row[index.roomRent] || 0
    ),

    waterAmount: Number(
      row[index.waterAmount] || 0
    ),

    electricAmount: Number(
      row[index.electricAmount] || 0
    ),

    depositAmount: Number(
      row[index.depositAmount] || 0
    ),

    repairAmount: Number(
      row[index.repairAmount] || 0
    ),

    damageAmount: Number(
      row[index.damageAmount] || 0
    ),

    totalAmount: Number(
      row[index.totalAmount] || 0
    ),

    dueDate: String(
      row[index.dueDate] || ""
    ).slice(0, 10),

    paymentStatus: String(
      row[index.paymentStatus] ||
        "UNPAID"
    )
      .trim()
      .toUpperCase(),

    paidAt:
      formatSheetDate_(
        row[index.paidAt]
      ),

    note: String(
      row[index.note] || ""
    ),

    createdAt:
      formatSheetDate_(
        row[index.createdAt]
      ),

    updatedAt:
      formatSheetDate_(
        row[index.updatedAt]
      )
  };
}

function normalizeBillMonth_(
  value
) {
  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM"
    );
  }

  const text =
    String(value || "").trim();

  if (
    /^\d{4}-(0[1-9]|1[0-2])$/.test(
      text
    )
  ) {
    return text;
  }

  const date =
    new Date(text);

  if (
    !Number.isNaN(
      date.getTime()
    )
  ) {
    return Utilities.formatDate(
      date,
      Session.getScriptTimeZone(),
      "yyyy-MM"
    );
  }

  return "";
}

function getBillMeterById_(meterId) {
  const sheet = getMetersSheet_();

  const values =
    sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return null;
  }

  const index =
    getMeterHeaderIndex_(values[0]);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];

    const currentMeterId = String(
      row[index.meterId] || ""
    ).trim();

    if (currentMeterId !== meterId) {
      continue;
    }

    return {
      meterId: currentMeterId,

      roomId: String(
        row[index.roomId] || ""
      ).trim(),

      tenantId: String(
        row[index.tenantId] || ""
      ).trim(),

      tenantName: String(
        row[index.tenantName] || ""
      ).trim(),

      billingMonth:
        normalizeBillMonth_(
          row[index.billingMonth]
        ),

      waterAmount: Number(
        row[index.waterAmount] || 0
      ),

      electricAmount: Number(
        row[index.electricAmount] || 0
      )
    };
  }

  return null;
}

function getBillRoomById_(
  roomId
) {
  const sheet =
    getRoomsSheet_();

  const values =
    sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return null;
  }

  const index =
    getRoomHeaderIndex_(
      values[0]
    );

  for (
    let i = 1;
    i < values.length;
    i++
  ) {
    const row = values[i];

    if (
      String(
        row[index.roomId] || ""
      ).trim() !== roomId
    ) {
      continue;
    }

    return {
      roomId,

      roomNo: String(
        row[index.roomNo] || ""
      ).trim(),

      price: Number(
        row[index.price] || 0
      )
    };
  }

  return null;
}