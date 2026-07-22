/**
 * Performance.gs — ตัวช่วยเร่งความเร็วการอ่านข้อมูล
 *
 * ไฟล์นี้ "เพิ่มอย่างเดียว" ไม่แก้ logic เดิม:
 * วางเป็นไฟล์ใหม่ใน Apps Script editor ได้ทันที
 * แล้วแก้ Code.gs ตามคู่มือใน PERFORMANCE.md
 *
 * มี 3 ส่วน:
 * 1) Spreadsheet handle ที่เปิดครั้งเดียวต่อ request
 * 2) Cache ผลอ่าน (หมดอายุเองใน 5 นาที + ล้างทันทีเมื่อมีการเขียน)
 * 3) Endpoint รวม โหลดข้อมูลทั้งหน้าใน request เดียว
 */

/* =========================================
   1) เปิด Spreadsheet ครั้งเดียวต่อ request
   -----------------------------------------
   ของเดิมเรียก SpreadsheetApp.openById ซ้ำ
   หลายรอบใน request เดียว (ครั้งละหลายร้อย ms)
   ให้เปลี่ยนทุกจุดในไฟล์เดิมมาเรียก
   getSpreadsheet_() แทน
========================================= */

let dormSpreadsheet_ = null;

function getSpreadsheet_() {
  if (!dormSpreadsheet_) {
    dormSpreadsheet_ =
      SpreadsheetApp.openById(SPREADSHEET_ID);
  }

  return dormSpreadsheet_;
}

/* =========================================
   2) Cache ผลอ่านข้อมูล
   -----------------------------------------
   ใช้เทคนิค version key: การเขียนทุกครั้ง
   แค่ bump version เดียว cache เก่าทั้งหมด
   ก็ใช้ไม่ได้ทันที (ไม่ต้องไล่ลบทีละ key)

   ในฟังก์ชันเขียน (create/update/delete/
   checkout/markPaid) ให้เพิ่มบรรทัดเดียว
   ก่อน return สำเร็จ:

     bumpDormCache_();
========================================= */

const DORM_CACHE_TTL_SECONDS = 300; // 5 นาที
const DORM_CACHE_VERSION_KEY = "dorm:cacheVersion";

function dormCacheVersion_() {
  const cache = CacheService.getScriptCache();

  let version = cache.get(DORM_CACHE_VERSION_KEY);

  if (!version) {
    version = String(Date.now());

    cache.put(
      DORM_CACHE_VERSION_KEY,
      version,
      21600
    );
  }

  return version;
}

function bumpDormCache_() {
  CacheService.getScriptCache().put(
    DORM_CACHE_VERSION_KEY,
    String(Date.now()),
    21600
  );
}

function getDormCache_(name) {
  const cached = CacheService
    .getScriptCache()
    .get("dorm:" + name + ":" + dormCacheVersion_());

  return cached ? JSON.parse(cached) : null;
}

function putDormCache_(name, result) {
  try {
    CacheService.getScriptCache().put(
      "dorm:" + name + ":" + dormCacheVersion_(),
      JSON.stringify(result),
      DORM_CACHE_TTL_SECONDS
    );
  } catch (error) {
    // ข้อมูลใหญ่เกิน 100KB ต่อ key — ข้าม cache ไปเฉยๆ
    console.warn("Cache put failed:", error);
  }
}

/**
 * ห่อฟังก์ชันอ่านเดิมด้วย cache
 * ตรวจ token ก่อนเสมอ (session อยู่ใน cache อยู่แล้ว เร็ว)
 */
function cachedList_(name, request, loader) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const cached = getDormCache_(name);

  if (cached) {
    return cached;
  }

  const result = loader(request);

  if (result && result.success) {
    putDormCache_(name, result);
  }

  return result;
}

/* =========================================
   สิทธิ์ตามบทบาท (Role)
   -----------------------------------------
   OWNER: ใช้ได้ทุกอย่าง
   USER : ดู/เพิ่ม/แก้ไขได้ แต่ห้ามลบ
          และเข้าหน้า Report ไม่ได้
========================================= */

function ownerOnly_(request, handler) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const role = String(
    (auth.user && auth.user.role) || ""
  )
    .trim()
    .toUpperCase();

  if (role !== "OWNER") {
    return {
      success: false,
      message:
        "สิทธิ์ไม่เพียงพอ ฟีเจอร์นี้ใช้ได้เฉพาะเจ้าของระบบ (OWNER)"
    };
  }

  return handler(request);
}

/* ตัวห่อสำหรับ action อ่านรายการเดิม —
   ใน Code.gs เปลี่ยน case ให้ชี้มาที่ตัว Cached แทน */

function getRoomsCached(request) {
  return cachedList_("rooms", request, getRooms);
}

function getTenantsCached(request) {
  return cachedList_("tenants", request, getTenants);
}

function getMetersCached(request) {
  return cachedList_("meters", request, getMeters);
}

function getBillsCached(request) {
  return cachedList_("bills", request, getBills);
}

/* =========================================
   3) Endpoint รวม — 1 request ต่อ 1 หน้า
   -----------------------------------------
   คอขวดใหญ่สุดคือ overhead ต่อ request ของ
   Apps Script (~1-2 วิ) หน้า Bill ยิง 3 ครั้ง
   = 3-6 วิ ทั้งที่ข้อมูลนิดเดียว

   เพิ่ม case ใน doPost ตาม PERFORMANCE.md
   แล้วให้ frontend เรียก action เดียวจบ
========================================= */

function getBillPageData(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const cached = getDormCache_("page:bill");

  if (cached) {
    return cached;
  }

  const bills = getBills(request);

  if (!bills.success) {
    return bills;
  }

  const meters = getMeters(request);

  if (!meters.success) {
    return meters;
  }

  const rooms = getRooms(request);

  if (!rooms.success) {
    return rooms;
  }

  const result = {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: {
      bills: bills.data || [],
      meters: meters.data || [],
      rooms: rooms.data || []
    }
  };

  putDormCache_("page:bill", result);

  return result;
}

function getMeterPageData(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const cached = getDormCache_("page:meter");

  if (cached) {
    return cached;
  }

  const meters = getMeters(request);

  if (!meters.success) {
    return meters;
  }

  const rooms = getRooms(request);

  if (!rooms.success) {
    return rooms;
  }

  const result = {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: {
      meters: meters.data || [],
      rooms: rooms.data || []
    }
  };

  putDormCache_("page:meter", result);

  return result;
}

function getTenantPageData(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const cached = getDormCache_("page:tenant");

  if (cached) {
    return cached;
  }

  const tenants = getTenants(request);

  if (!tenants.success) {
    return tenants;
  }

  const rooms = getRooms(request);

  if (!rooms.success) {
    return rooms;
  }

  const result = {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: {
      tenants: tenants.data || [],
      rooms: rooms.data || []
    }
  };

  putDormCache_("page:tenant", result);

  return result;
}

/**
 * หน้า Report: รวม rooms + dashboard + report แรก
 * (report ตามฟิลเตอร์ไม่ cache เพราะเปลี่ยนตามผู้ใช้)
 */
function getReportPageData(request) {
  const auth = validateToken(request.token);

  if (!auth.success) {
    return auth;
  }

  const rooms = getRooms(request);

  if (!rooms.success) {
    return rooms;
  }

  const summary = getDashboardSummary(request);

  if (!summary.success) {
    return summary;
  }

  const reportType = String(
    (request.filter &&
      request.filter.reportType) ||
    "ROOM"
  );

  const reportHandlers = {
    ROOM: getRoomReport,
    TENANT: getTenantReport,
    UTILITY: getUtilityReport,
    BILL: getBillReport
  };

  const handler =
    reportHandlers[reportType] || getRoomReport;

  const report = handler(request);

  if (!report.success) {
    return report;
  }

  return {
    success: true,
    message: "โหลดข้อมูลสำเร็จ",
    data: {
      rooms: rooms.data || [],
      summary: summary.data || null,
      report: report.data || null
    }
  };
}
