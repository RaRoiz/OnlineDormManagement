const ROOMS_SHEET = "Rooms";

const ROOM_HEADERS = [
  "roomId",
  "roomNo",
  "roomType",
  "roomDetail",
  "price",
  "floor",
  "createdAt",
  "updatedAt"
];

function getRooms(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const sheet = getRoomsSheet_();
  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    return {
      success: true,
      message: "โหลดข้อมูลสำเร็จ",
      data: []
    };
  }

  const index = getRoomHeaderIndex_(values[0]);
  const occupiedRoomIds = getOccupiedRoomIds_();

  const rooms = values
    .slice(1)
    .filter(function (row) {
      return String(
        row[index.roomId] || ""
      ).trim() !== "";
    })
    .map(function (row) {
      return roomFromRow_(
        row,
        index,
        occupiedRoomIds
      );
    })
    .sort(function (a, b) {
      if (a.floor !== b.floor) {
        return a.floor - b.floor;
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
    data: rooms
  };
}

function createRoom(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  // ต้องใช้ request.room ไม่ใช่ room
  const input = validateRoomInput_(request.room);

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getRoomsSheet_();
    const values = sheet.getDataRange().getValues();
    const index = getRoomHeaderIndex_(values[0]);

    const duplicate = values
      .slice(1)
      .some(row => {
        const existingRoomNo = String(
          row[index.roomNo] || ""
        )
          .trim()
          .toLowerCase();

        return (
          existingRoomNo ===
          input.roomNo.toLowerCase()
        );
      });

    if (duplicate) {
      return {
        success: false,
        message: "เลขห้องนี้มีอยู่ในระบบแล้ว"
      };
    }

    const now = new Date().toISOString();

    // ประกาศ object ก่อนนำไปใช้
    const createdRoom = {
  roomId: Utilities.getUuid(),
  roomNo: input.roomNo,
  roomType: input.roomType,
  roomDetail: input.roomDetail,
  price: input.price,
  floor: input.floor,
  status: "ว่าง",
  createdAt: now,
  updatedAt: now
};

sheet.appendRow([
  createdRoom.roomId,
  createdRoom.roomNo,
  createdRoom.roomType,
  createdRoom.roomDetail,
  createdRoom.price,
  createdRoom.floor,
  createdRoom.createdAt,
  createdRoom.updatedAt
]);

return {
  success: true,
  message: "เพิ่มห้องพักสำเร็จ",
  data: createdRoom
};
  } finally {
    lock.releaseLock();
  }
}

function updateRoom(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const roomId = String(
    request.roomId || ""
  ).trim();

  if (!roomId) {
    return {
      success: false,
      message: "ไม่พบรหัสห้องพัก"
    };
  }

  const input = validateRoomInput_(
    request.room
  );

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getRoomsSheet_();

    const values = sheet
      .getDataRange()
      .getValues();

    const index = getRoomHeaderIndex_(
      values[0]
    );

    let targetRow = -1;

    // ค้นหาแถวของห้องที่ต้องการแก้ไข
    for (let i = 1; i < values.length; i++) {
      const currentRoomId = String(
        values[i][index.roomId] || ""
      ).trim();

      if (currentRoomId === roomId) {
        targetRow = i + 1;
        break;
      }
    }

    if (targetRow === -1) {
      return {
        success: false,
        message: "ไม่พบข้อมูลห้องพัก"
      };
    }

    // ตรวจสอบเลขห้องซ้ำ โดยไม่ตรวจแถวของตัวเอง
    const duplicate = values
      .slice(1)
      .some(row => {
        const currentRoomId = String(
          row[index.roomId] || ""
        ).trim();

        const currentRoomNo = String(
          row[index.roomNo] || ""
        )
          .trim()
          .toLowerCase();

        return (
          currentRoomId !== roomId &&
          currentRoomNo ===
            input.roomNo.toLowerCase()
        );
      });

    if (duplicate) {
      return {
        success: false,
        message: "เลขห้องนี้มีอยู่ในระบบแล้ว"
      };
    }

    const originalRow =
      values[targetRow - 1];

    // กรณีข้อมูลเก่าไม่มีวันที่สร้าง
    const createdAt =
      formatSheetDate_(
        originalRow[index.createdAt]
      ) || new Date().toISOString();

    const updatedAt =
      new Date().toISOString();

    const occupiedRoomIds =
      getOccupiedRoomIds_();

    const updatedRoom = {
      roomId: roomId,
      roomNo: input.roomNo,
      roomType: input.roomType,
      roomDetail: input.roomDetail,
      price: input.price,
      floor: input.floor,

      status: occupiedRoomIds.has(roomId)
        ? "ไม่ว่าง"
        : "ว่าง",

      createdAt: createdAt,
      updatedAt: updatedAt
    };

    sheet
      .getRange(
        targetRow,
        1,
        1,
        ROOM_HEADERS.length
      )
      .setValues([[
        updatedRoom.roomId,
        updatedRoom.roomNo,
        updatedRoom.roomType,
        updatedRoom.roomDetail,
        updatedRoom.price,
        updatedRoom.floor,
        updatedRoom.createdAt,
        updatedRoom.updatedAt
      ]]);

    return {
      success: true,
      message: "แก้ไขห้องพักสำเร็จ",
      data: updatedRoom
    };
  } finally {
    lock.releaseLock();
  }
}

function deleteRoom(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const roomId = String(
    request.roomId || ""
  ).trim();

  if (!roomId) {
    return {
      success: false,
      message: "ไม่พบรหัสห้องพัก"
    };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);

  try {
    const sheet = getRoomsSheet_();
    const values = sheet.getDataRange().getValues();
    const index = getRoomHeaderIndex_(values[0]);

    const occupiedRoomIds =
      getOccupiedRoomIds_();

    if (occupiedRoomIds.has(roomId)) {
      return {
        success: false,
        message:
          "ไม่สามารถลบห้องที่มีผู้เช่าพักอยู่ได้"
      };
    }

    for (let i = 1; i < values.length; i++) {
      const currentRoomId = String(
        values[i][index.roomId] || ""
      ).trim();

      if (currentRoomId !== roomId) {
        continue;
      }

      sheet.deleteRow(i + 1);

      return {
        success: true,
        message: "ลบห้องพักสำเร็จ",
        data: null
      };
    }

    return {
      success: false,
      message: "ไม่พบข้อมูลห้องพัก"
    };
  } finally {
    lock.releaseLock();
  }
}

function getRoomsSheet_() {
  const spreadsheet =
    SpreadsheetApp.openById(SPREADSHEET_ID);

  let sheet =
    spreadsheet.getSheetByName(ROOMS_SHEET);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(ROOMS_SHEET);
    sheet.appendRow(ROOM_HEADERS);
    return sheet;
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(ROOM_HEADERS);
    return sheet;
  }

  const actualHeaders = sheet
    .getRange(1, 1, 1, ROOM_HEADERS.length)
    .getDisplayValues()[0]
    .map(header => String(header).trim());

  const headerIsCorrect = ROOM_HEADERS.every(
    (header, index) =>
      actualHeaders[index] === header
  );

  if (!headerIsCorrect) {
    throw new Error(
      "หัวตารางชีต Rooms ไม่ถูกต้อง กรุณาเรียงเป็น: " +
      ROOM_HEADERS.join(" | ")
    );
  }

  return sheet;
}
function getRoomHeaderIndex_(headers) {
  const index = {};

  headers.forEach((header, position) => {
    index[String(header).trim()] = position;
  });

  ROOM_HEADERS.forEach(header => {
    if (index[header] === undefined) {
      throw new Error(
        "ไม่พบคอลัมน์ " + header + " ในชีต Rooms"
      );
    }
  });

  return index;
}

function validateRoomInput_(roomInput) {
  const input = roomInput || {};

  const roomNo =
    String(input.roomNo || "").trim();

  const roomType =
    String(input.roomType || "").trim();

  const roomDetail =
    String(input.roomDetail || "").trim();

  if (!roomNo) {
    throw new Error("กรุณากรอกเลขห้อง");
  }

  if (!roomType) {
    throw new Error("กรุณากรอกประเภทห้อง");
  }

  if (
    input.price === "" ||
    input.price === null ||
    input.price === undefined
  ) {
    throw new Error("กรุณากรอกค่าเช่า");
  }

  if (
    input.floor === "" ||
    input.floor === null ||
    input.floor === undefined
  ) {
    throw new Error("กรุณากรอกชั้น");
  }

  const price = Number(input.price);
  const floor = Number(input.floor);

  if (!Number.isFinite(price) || price < 0) {
    throw new Error("ค่าเช่าไม่ถูกต้อง");
  }

  if (!Number.isInteger(floor) || floor < 1) {
    throw new Error("ชั้นของห้องไม่ถูกต้อง");
  }

  return {
    roomNo,
    roomType,
    roomDetail,
    price,
    floor
  };
}

function roomFromRow_(
  row,
  index,
  occupiedRoomIds
) {
  const roomId = String(
    row[index.roomId] || ""
  ).trim();

  return {
    roomId: roomId,

    roomNo: String(
      row[index.roomNo] || ""
    ).trim(),

    roomType: String(
      row[index.roomType] || ""
    ).trim(),

    roomDetail: String(
      row[index.roomDetail] || ""
    ).trim(),

    price: Number(
      row[index.price] || 0
    ),

    floor: Number(
      row[index.floor] || 0
    ),

    status: occupiedRoomIds.has(roomId)
      ? "ไม่ว่าง"
      : "ว่าง",

    createdAt: formatSheetDate_(
      row[index.createdAt]
    ),

    updatedAt: formatSheetDate_(
      row[index.updatedAt]
    )
  };
}

function formatSheetDate_(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  return String(value || "");
}

function getOccupiedRoomIds_() {
  const spreadsheet =
    SpreadsheetApp.openById(SPREADSHEET_ID);

  const tenantSheet =
    spreadsheet.getSheetByName("Tenants");

  const occupiedRoomIds = new Set();

  if (
    !tenantSheet ||
    tenantSheet.getLastRow() < 2
  ) {
    return occupiedRoomIds;
  }

  const values =
    tenantSheet.getDataRange().getValues();

  const headers = values[0];
  const index = {};

  headers.forEach((header, position) => {
    index[String(header).trim()] = position;
  });

  if (index.roomId === undefined) {
    throw new Error(
      "ไม่พบคอลัมน์ roomId ในชีต Tenants"
    );
  }

  if (index.status === undefined) {
    throw new Error(
      "ไม่พบคอลัมน์ status ในชีต Tenants"
    );
  }

  values.slice(1).forEach(row => {
    const roomId = String(
      row[index.roomId] || ""
    ).trim();

    const tenantStatus = String(
      row[index.status] || ""
    )
      .trim()
      .toUpperCase();

    if (
      roomId &&
      tenantStatus === "ACTIVE"
    ) {
      occupiedRoomIds.add(roomId);
    }
  });

  return occupiedRoomIds;
}