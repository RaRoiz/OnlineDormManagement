function getDashboardSummary(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const billingMonth =
    normalizeReportMonth_(
      request.billingMonth
    ) || currentReportMonth_();

  const roomsData =
    readReportSheet_("Rooms");

  const tenantsData =
    readReportSheet_("Tenants");

  const metersData =
    readReportSheet_("Meters");

  const billsData =
    readReportSheet_("Bills");

  const rooms =
    getValidReportRows_(
      roomsData,
      "roomId"
    );

  const tenants =
    getValidReportRows_(
      tenantsData,
      "tenantId"
    );

  const meters =
    getValidReportRows_(
      metersData,
      "meterId"
    );

  const bills =
    getValidReportRows_(
      billsData,
      "billId"
    );

  const occupiedRoomIds =
    new Set();

  let activeTenants = 0;

  tenants.forEach(function (row) {
    const status = reportText_(
      row,
      tenantsData.index,
      "status"
    ).toUpperCase();

    if (status !== "ACTIVE") {
      return;
    }

    activeTenants++;

    const roomId = reportText_(
      row,
      tenantsData.index,
      "roomId"
    );

    if (roomId) {
      occupiedRoomIds.add(roomId);
    }
  });

  const totalRooms = rooms.length;

  const occupiedRooms =
    occupiedRoomIds.size;

  const vacantRooms =
    Math.max(
      0,
      totalRooms - occupiedRooms
    );

  const occupancyRate =
    totalRooms > 0
      ? occupiedRooms /
        totalRooms *
        100
      : 0;

  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );

  let unpaidBills = 0;
  let overdueBills = 0;

  let outstandingAmount = 0;
  let paidAmount = 0;

  const recentBills = [];

  bills.forEach(function (row) {
    const month =
      normalizeReportMonth_(
        reportValue_(
          row,
          billsData.index,
          "billingMonth"
        )
      );

    const paymentStatus =
      reportText_(
        row,
        billsData.index,
        "paymentStatus"
      ).toUpperCase();

    const totalAmount =
      reportNumber_(
        row,
        billsData.index,
        "totalAmount"
      );

    const dueDate =
      normalizeReportDate_(
        reportValue_(
          row,
          billsData.index,
          "dueDate"
        )
      );

    if (month === billingMonth) {
      if (paymentStatus === "PAID") {
        paidAmount += totalAmount;
      } else {
        unpaidBills++;
        outstandingAmount += totalAmount;

        if (
          dueDate &&
          dueDate < today
        ) {
          overdueBills++;
        }
      }
    }

    recentBills.push({
      billId: reportText_(
        row,
        billsData.index,
        "billId"
      ),

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

      totalAmount: totalAmount,
      dueDate: dueDate,

      status:
        paymentStatus === "PAID"
          ? "ชำระแล้ว"
          : dueDate &&
              dueDate < today
            ? "เกินกำหนด"
            : "ยังไม่ชำระ",

      createdAt:
        reportDateTime_(
          reportValue_(
            row,
            billsData.index,
            "createdAt"
          )
        )
    });
  });

  let waterAmount = 0;
  let electricAmount = 0;

  meters.forEach(function (row) {
    const month =
      normalizeReportMonth_(
        reportValue_(
          row,
          metersData.index,
          "billingMonth"
        )
      );

    if (month !== billingMonth) {
      return;
    }

    waterAmount +=
      reportNumber_(
        row,
        metersData.index,
        "waterAmount"
      );

    electricAmount +=
      reportNumber_(
        row,
        metersData.index,
        "electricAmount"
      );
  });

  recentBills.sort(function (a, b) {
    return String(
      b.createdAt
    ).localeCompare(
      String(a.createdAt)
    );
  });

  const monthList =
    getPreviousReportMonths_(
      billingMonth,
      6
    );

  const monthlyRevenue =
    monthList.map(function (month) {
      let monthPaid = 0;
      let monthOutstanding = 0;

      bills.forEach(function (row) {
        const rowMonth =
          normalizeReportMonth_(
            reportValue_(
              row,
              billsData.index,
              "billingMonth"
            )
          );

        if (rowMonth !== month) {
          return;
        }

        const status =
          reportText_(
            row,
            billsData.index,
            "paymentStatus"
          ).toUpperCase();

        const amount =
          reportNumber_(
            row,
            billsData.index,
            "totalAmount"
          );

        if (status === "PAID") {
          monthPaid += amount;
        } else {
          monthOutstanding += amount;
        }
      });

      return {
        billingMonth: month,
        paidAmount: monthPaid,
        outstandingAmount:
          monthOutstanding
      };
    });

  return {
    success: true,
    message:
      "โหลดข้อมูล Dashboard สำเร็จ",

    data: {
      billingMonth: billingMonth,

      totalRooms: totalRooms,
      occupiedRooms: occupiedRooms,
      vacantRooms: vacantRooms,
      occupancyRate: occupancyRate,

      activeTenants: activeTenants,

      unpaidBills: unpaidBills,
      overdueBills: overdueBills,

      outstandingAmount:
        outstandingAmount,

      paidAmount: paidAmount,

      waterAmount: waterAmount,
      electricAmount:
        electricAmount,

      monthlyRevenue:
        monthlyRevenue,

      recentBills:
        recentBills.slice(0, 5)
    }
  };
}

function getRoomReport(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const filter =
    request.filter || {};

  const roomsData =
    readReportSheet_("Rooms");

  const tenantsData =
    readReportSheet_("Tenants");

  const occupiedMap = new Map();

  getValidReportRows_(
    tenantsData,
    "tenantId"
  ).forEach(function (row) {
    const status =
      reportText_(
        row,
        tenantsData.index,
        "status"
      ).toUpperCase();

    if (status !== "ACTIVE") {
      return;
    }

    const roomId =
      reportText_(
        row,
        tenantsData.index,
        "roomId"
      );

    if (roomId) {
      occupiedMap.set(
        roomId,
        reportText_(
          row,
          tenantsData.index,
          "fullName"
        )
      );
    }
  });

  let rows =
    getValidReportRows_(
      roomsData,
      "roomId"
    ).map(function (row) {
      const roomId =
        reportText_(
          row,
          roomsData.index,
          "roomId"
        );

      const occupied =
        occupiedMap.has(roomId);

      return {
        roomId: roomId,

        roomNo:
          reportText_(
            row,
            roomsData.index,
            "roomNo"
          ),

        roomType:
          reportText_(
            row,
            roomsData.index,
            "roomType"
          ),

        roomDetail:
          reportText_(
            row,
            roomsData.index,
            "roomDetail"
          ),

        floor:
          reportNumber_(
            row,
            roomsData.index,
            "floor"
          ),

        price:
          reportNumber_(
            row,
            roomsData.index,
            "price"
          ),

        status:
          occupied
            ? "ไม่ว่าง"
            : "ว่าง",

        statusCode:
          occupied
            ? "OCCUPIED"
            : "VACANT",

        tenantName:
          occupiedMap.get(roomId) || ""
      };
    });

  rows = rows.filter(function (row) {
    if (
      filter.roomId &&
      row.roomId !== filter.roomId
    ) {
      return false;
    }

    if (
      filter.status &&
      row.statusCode !== filter.status
    ) {
      return false;
    }

    return reportMatchesKeyword_(
      [
        row.roomNo,
        row.roomType,
        row.roomDetail,
        row.tenantName
      ],
      filter.keyword
    );
  });

  rows.sort(function (a, b) {
    if (a.floor !== b.floor) {
      return a.floor - b.floor;
    }

    return String(a.roomNo)
      .localeCompare(
        String(b.roomNo),
        undefined,
        { numeric: true }
      );
  });

  return {
    success: true,
    message: "โหลดรายงานห้องพักสำเร็จ",

    data: {
      columns: [
        {
          key: "roomNo",
          label: "เลขห้อง"
        },
        {
          key: "roomType",
          label: "ประเภทห้อง"
        },
        {
          key: "roomDetail",
          label: "ลักษณะห้อง"
        },
        {
          key: "floor",
          label: "ชั้น",
          type: "number"
        },
        {
          key: "price",
          label: "ค่าเช่า",
          type: "money"
        },
        {
          key: "status",
          label: "สถานะ",
          type: "status"
        },
        {
          key: "tenantName",
          label: "ผู้เช่าปัจจุบัน"
        }
      ],

      rows: rows
    }
  };
}

function getTenantReport(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const filter =
    request.filter || {};

  const tenantsData =
    readReportSheet_("Tenants");

  const roomsData =
    readReportSheet_("Rooms");

  const roomMap = new Map();

  getValidReportRows_(
    roomsData,
    "roomId"
  ).forEach(function (row) {
    roomMap.set(
      reportText_(
        row,
        roomsData.index,
        "roomId"
      ),
      reportText_(
        row,
        roomsData.index,
        "roomNo"
      )
    );
  });

  let rows =
    getValidReportRows_(
      tenantsData,
      "tenantId"
    ).map(function (row) {
      const roomId =
        reportText_(
          row,
          tenantsData.index,
          "roomId"
        );

      const status =
        reportText_(
          row,
          tenantsData.index,
          "status"
        ).toUpperCase();

      return {
        tenantId:
          reportText_(
            row,
            tenantsData.index,
            "tenantId"
          ),

        fullName:
          reportText_(
            row,
            tenantsData.index,
            "fullName"
          ),

        citizenId:
          reportText_(
            row,
            tenantsData.index,
            "citizenId"
          ),

        phone:
          reportText_(
            row,
            tenantsData.index,
            "phone"
          ),

        lineId:
          reportText_(
            row,
            tenantsData.index,
            "lineId"
          ),

        email:
          reportText_(
            row,
            tenantsData.index,
            "email"
          ),

        roomId: roomId,
        roomNo:
          roomMap.get(roomId) || "",

        checkInDate:
          reportDateTime_(
            reportValue_(
              row,
              tenantsData.index,
              "checkInDate"
            )
          ),

        checkOutDate:
          reportDateTime_(
            reportValue_(
              row,
              tenantsData.index,
              "checkOutDate"
            )
          ),

        statusCode: status,

        status:
          status === "ACTIVE"
            ? "กำลังพัก"
            : "ย้ายออกแล้ว"
      };
    });

  rows = rows.filter(function (row) {
    if (
      filter.roomId &&
      row.roomId !== filter.roomId
    ) {
      return false;
    }

    if (
      filter.status &&
      row.statusCode !== filter.status
    ) {
      return false;
    }

    return reportMatchesKeyword_(
      [
        row.fullName,
        row.citizenId,
        row.phone,
        row.lineId,
        row.email,
        row.roomNo
      ],
      filter.keyword
    );
  });

  return {
    success: true,
    message: "โหลดรายงานผู้เช่าสำเร็จ",

    data: {
      columns: [
        {
          key: "fullName",
          label: "ชื่อผู้เช่า"
        },
        {
          key: "citizenId",
          label: "เลขประจำตัว"
        },
        {
          key: "phone",
          label: "เบอร์โทร"
        },
        {
          key: "lineId",
          label: "Line ID"
        },
        {
          key: "email",
          label: "E-mail"
        },
        {
          key: "roomNo",
          label: "ห้อง"
        },
        {
          key: "checkInDate",
          label: "วันที่เข้าพัก",
          type: "datetime"
        },
        {
          key: "checkOutDate",
          label: "วันที่ย้ายออก",
          type: "datetime"
        },
        {
          key: "status",
          label: "สถานะ",
          type: "status"
        }
      ],

      rows: rows
    }
  };
}

function getUtilityReport(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const filter =
    request.filter || {};

  const metersData =
    readReportSheet_("Meters");

  const roomsData =
    readReportSheet_("Rooms");

  const roomMap = new Map();

  getValidReportRows_(
    roomsData,
    "roomId"
  ).forEach(function (row) {
    roomMap.set(
      reportText_(
        row,
        roomsData.index,
        "roomId"
      ),
      reportText_(
        row,
        roomsData.index,
        "roomNo"
      )
    );
  });

  let rows =
    getValidReportRows_(
      metersData,
      "meterId"
    ).map(function (row) {
      const roomId =
        reportText_(
          row,
          metersData.index,
          "roomId"
        );

      return {
        meterId:
          reportText_(
            row,
            metersData.index,
            "meterId"
          ),

        billingMonth:
          normalizeReportMonth_(
            reportValue_(
              row,
              metersData.index,
              "billingMonth"
            )
          ),

        roomId: roomId,

        roomNo:
          roomMap.get(roomId) || "",

        tenantName:
          reportText_(
            row,
            metersData.index,
            "tenantName"
          ),

        waterUnits:
          reportNumber_(
            row,
            metersData.index,
            "waterUnits"
          ),

        waterAmount:
          reportNumber_(
            row,
            metersData.index,
            "waterAmount"
          ),

        electricUnits:
          reportNumber_(
            row,
            metersData.index,
            "electricUnits"
          ),

        electricAmount:
          reportNumber_(
            row,
            metersData.index,
            "electricAmount"
          ),

        totalUtility:
          reportNumber_(
            row,
            metersData.index,
            "totalUtility"
          )
      };
    });

  rows = rows.filter(function (row) {
    if (
      filter.billingMonth &&
      row.billingMonth !==
        filter.billingMonth
    ) {
      return false;
    }

    if (
      filter.roomId &&
      row.roomId !== filter.roomId
    ) {
      return false;
    }

    return reportMatchesKeyword_(
      [
        row.roomNo,
        row.tenantName
      ],
      filter.keyword
    );
  });

  rows.sort(function (a, b) {
    return String(
      b.billingMonth
    ).localeCompare(
      String(a.billingMonth)
    );
  });

  return {
    success: true,
    message:
      "โหลดรายงานค่าน้ำและค่าไฟสำเร็จ",

    data: {
      columns: [
        {
          key: "billingMonth",
          label: "เดือน",
          type: "month"
        },
        {
          key: "roomNo",
          label: "ห้อง"
        },
        {
          key: "tenantName",
          label: "ผู้เช่า"
        },
        {
          key: "waterUnits",
          label: "หน่วยน้ำ",
          type: "number"
        },
        {
          key: "waterAmount",
          label: "ค่าน้ำ",
          type: "money"
        },
        {
          key: "electricUnits",
          label: "หน่วยไฟ",
          type: "number"
        },
        {
          key: "electricAmount",
          label: "ค่าไฟ",
          type: "money"
        },
        {
          key: "totalUtility",
          label: "ยอดรวม",
          type: "money"
        }
      ],

      rows: rows
    }
  };
}

function getBillReport(request) {
  const auth =
    validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const filter =
    request.filter || {};

  const billsData =
    readReportSheet_("Bills");

  const today =
    Utilities.formatDate(
      new Date(),
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );

  let rows =
    getValidReportRows_(
      billsData,
      "billId"
    ).map(function (row) {
      const paymentStatus =
        reportText_(
          row,
          billsData.index,
          "paymentStatus"
        ).toUpperCase();

      const dueDate =
        normalizeReportDate_(
          reportValue_(
            row,
            billsData.index,
            "dueDate"
          )
        );

      const statusCode =
        paymentStatus === "PAID"
          ? "PAID"
          : dueDate &&
              dueDate < today
            ? "OVERDUE"
            : "UNPAID";

      return {
        billId:
          reportText_(
            row,
            billsData.index,
            "billId"
          ),

        billNo:
          reportText_(
            row,
            billsData.index,
            "billNo"
          ),

        billingMonth:
          normalizeReportMonth_(
            reportValue_(
              row,
              billsData.index,
              "billingMonth"
            )
          ),

        roomId:
          reportText_(
            row,
            billsData.index,
            "roomId"
          ),

        roomNo:
          reportText_(
            row,
            billsData.index,
            "roomNo"
          ),

        tenantName:
          reportText_(
            row,
            billsData.index,
            "tenantName"
          ),

        roomRent:
          reportNumber_(
            row,
            billsData.index,
            "roomRent"
          ),

        waterAmount:
          reportNumber_(
            row,
            billsData.index,
            "waterAmount"
          ),

        electricAmount:
          reportNumber_(
            row,
            billsData.index,
            "electricAmount"
          ),

        extraAmount:
          reportNumber_(
            row,
            billsData.index,
            "depositAmount"
          ) +
          reportNumber_(
            row,
            billsData.index,
            "repairAmount"
          ) +
          reportNumber_(
            row,
            billsData.index,
            "damageAmount"
          ),

        totalAmount:
          reportNumber_(
            row,
            billsData.index,
            "totalAmount"
          ),

        dueDate: dueDate,

        paidAt:
          reportDateTime_(
            reportValue_(
              row,
              billsData.index,
              "paidAt"
            )
          ),

        statusCode: statusCode,

        status:
          statusCode === "PAID"
            ? "ชำระแล้ว"
            : statusCode === "OVERDUE"
              ? "เกินกำหนด"
              : "ยังไม่ชำระ"
      };
    });

  rows = rows.filter(function (row) {
    if (
      filter.billingMonth &&
      row.billingMonth !==
        filter.billingMonth
    ) {
      return false;
    }

    if (
      filter.roomId &&
      row.roomId !== filter.roomId
    ) {
      return false;
    }

    if (
      filter.status &&
      row.statusCode !== filter.status
    ) {
      return false;
    }

    return reportMatchesKeyword_(
      [
        row.billNo,
        row.roomNo,
        row.tenantName
      ],
      filter.keyword
    );
  });

  rows.sort(function (a, b) {
    return String(
      b.billingMonth
    ).localeCompare(
      String(a.billingMonth)
    );
  });

  return {
    success: true,
    message:
      "โหลดรายงานใบแจ้งหนี้สำเร็จ",

    data: {
      columns: [
        {
          key: "billNo",
          label: "เลขที่บิล"
        },
        {
          key: "billingMonth",
          label: "เดือน",
          type: "month"
        },
        {
          key: "roomNo",
          label: "ห้อง"
        },
        {
          key: "tenantName",
          label: "ผู้เช่า"
        },
        {
          key: "roomRent",
          label: "ค่าเช่า",
          type: "money"
        },
        {
          key: "waterAmount",
          label: "ค่าน้ำ",
          type: "money"
        },
        {
          key: "electricAmount",
          label: "ค่าไฟ",
          type: "money"
        },
        {
          key: "extraAmount",
          label: "เพิ่มเติม",
          type: "money"
        },
        {
          key: "totalAmount",
          label: "ยอดรวม",
          type: "money"
        },
        {
          key: "dueDate",
          label: "ครบกำหนด",
          type: "date"
        },
        {
          key: "paidAt",
          label: "วันที่ชำระ",
          type: "datetime"
        },
        {
          key: "status",
          label: "สถานะ",
          type: "status"
        }
      ],

      rows: rows
    }
  };
}

/* =========================
   Report helpers
========================= */

function readReportSheet_(sheetName) {
  // ใช้ handle กลางจาก Performance.js
  // (ถูกเรียกหลายรอบต่อ request — เดิมเปิดซ้ำทุกรอบ)
  const spreadsheet = getSpreadsheet_();

  const sheet =
    spreadsheet.getSheetByName(
      sheetName
    );

  if (!sheet) {
    return {
      index: {},
      rows: []
    };
  }

  const values =
    sheet.getDataRange().getValues();

  if (values.length === 0) {
    return {
      index: {},
      rows: []
    };
  }

  const index = {};

  values[0].forEach(function (
    header,
    position
  ) {
    index[
      String(header).trim()
    ] = position;
  });

  return {
    index: index,
    rows: values.slice(1)
  };
}

function getValidReportRows_(
  data,
  idField
) {
  return data.rows.filter(
    function (row) {
      return Boolean(
        reportText_(
          row,
          data.index,
          idField
        )
      );
    }
  );
}

function reportValue_(
  row,
  index,
  field
) {
  const position =
    index[field];

  if (position === undefined) {
    return "";
  }

  return row[position];
}

function reportText_(
  row,
  index,
  field
) {
  return String(
    reportValue_(
      row,
      index,
      field
    ) || ""
  ).trim();
}

function reportNumber_(
  row,
  index,
  field
) {
  const value = Number(
    reportValue_(
      row,
      index,
      field
    ) || 0
  );

  return Number.isFinite(value)
    ? value
    : 0;
}

function normalizeReportMonth_(value) {
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

function normalizeReportDate_(value) {
  if (!value) {
    return "";
  }

  if (value instanceof Date) {
    return Utilities.formatDate(
      value,
      Session.getScriptTimeZone(),
      "yyyy-MM-dd"
    );
  }

  const text =
    String(value).trim();

  if (
    /^\d{4}-\d{2}-\d{2}/.test(
      text
    )
  ) {
    return text.slice(0, 10);
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return Utilities.formatDate(
    date,
    Session.getScriptTimeZone(),
    "yyyy-MM-dd"
  );
}

function reportDateTime_(value) {
  if (!value) {
    return "";
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString();
}

function currentReportMonth_() {
  return Utilities.formatDate(
    new Date(),
    Session.getScriptTimeZone(),
    "yyyy-MM"
  );
}

function getPreviousReportMonths_(
  billingMonth,
  count
) {
  const parts =
    billingMonth.split("-");

  const date = new Date(
    Number(parts[0]),
    Number(parts[1]) - 1,
    1
  );

  const months = [];

  for (
    let index = count - 1;
    index >= 0;
    index--
  ) {
    const monthDate =
      new Date(
        date.getFullYear(),
        date.getMonth() - index,
        1
      );

    months.push(
      Utilities.formatDate(
        monthDate,
        Session.getScriptTimeZone(),
        "yyyy-MM"
      )
    );
  }

  return months;
}

function reportMatchesKeyword_(
  values,
  keyword
) {
  const search =
    String(keyword || "")
      .trim()
      .toLowerCase();

  if (!search) {
    return true;
  }

  return values
    .join(" ")
    .toLowerCase()
    .includes(search);
}