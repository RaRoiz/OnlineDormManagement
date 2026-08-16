/**
 * Migration.gs — ย้ายจากระบบหลายหอ → หอเดียว (รันครั้งเดียว)
 *
 * ไฟล์นี้ใช้ครั้งเดียวตอนย้ายระบบ **ลบทั้งไฟล์ได้เมื่อย้ายเสร็จ**
 * และควรลบด้วย เพราะ collapseToSingleDorm() ลบข้อมูลถาวร
 * ไม่มีเหตุผลให้ค้างอยู่ในโปรเจกต์หลังใช้งานจบ
 *
 * ลำดับที่ต้องทำ:
 *
 *   1. สำรองสเปรดชีตก่อน (ไฟล์ → ทำสำเนา) — ขั้นตอนนี้
 *      ลบข้อมูลถาวร กู้คืนจากในสคริปต์ไม่ได้
 *   2. รัน listDormsForCleanup() ดูรายชื่อหอ แล้วตั้ง Script Property
 *      ชื่อ KEEP_DORM_ID เป็น dormId ของหอที่จะเก็บไว้
 *   3. รัน importDormSettingsFromSheet() — คัดลอกชื่อหอ /
 *      พร้อมเพย์ / LINE token ของหอนั้นมาเป็น Script Properties
 *   4. deploy โค้ดใหม่ แล้วทดสอบว่าระบบใช้งานได้ครบ
 *   5. รัน previewCollapseToSingleDorm() ดูว่าจะลบอะไรบ้าง
 *   6. รัน collapseToSingleDorm() เมื่อมั่นใจแล้ว
 */

const DORM_SCOPED_SHEETS = [
  "Users",
  "Rooms",
  "Tenants",
  "Meters",
  "Bills",
  "LineLinks"
];

/** พิมพ์รายชื่อหอทั้งหมดใน Log เพื่อเลือกว่าจะเก็บหอไหน */
function listDormsForCleanup() {
  const sheet =
    getSpreadsheet_().getSheetByName("Dorms");

  if (!sheet) {
    Logger.log("ไม่พบชีต Dorms (อาจย้ายมาระบบหอเดียวแล้ว)");
    return;
  }

  const values = sheet.getDataRange().getValues();

  if (values.length <= 1) {
    Logger.log("ชีต Dorms ว่าง");
    return;
  }

  Logger.log("dormId | ชื่อหอ | เจ้าของ | มี LINE token");

  values.slice(1).forEach(function (row) {
    Logger.log(
      String(row[0] || "") + " | " +
      String(row[1] || "") + " | " +
      String(row[2] || "") + " | " +
      (String(row[8] || "").trim() ? "มี" : "ไม่มี")
    );
  });

  Logger.log(
    "\nเลือก dormId ที่จะเก็บ แล้วตั้งเป็น Script Property " +
    "ชื่อ KEEP_DORM_ID"
  );
}

/**
 * คัดลอกค่าตั้งของหอที่เลือก จากชีต Dorms มาเป็น Script Properties
 * (ทำก่อน collapseToSingleDorm เพื่อไม่ต้องพิมพ์ LINE token เอง)
 */
function importDormSettingsFromSheet() {
  const keepDormId = getRequiredProperty_("KEEP_DORM_ID");

  const sheet =
    getSpreadsheet_().getSheetByName("Dorms");

  if (!sheet) {
    throw new Error("ไม่พบชีต Dorms");
  }

  const values = sheet.getDataRange().getValues();

  const row = values.slice(1).find(function (r) {
    return String(r[0] || "").trim() === keepDormId;
  });

  if (!row) {
    throw new Error(
      "ไม่พบหอ " + keepDormId + " ในชีต Dorms"
    );
  }

  setProperty_(DORM_NAME_PROPERTY, row[1]);
  setProperty_(PROMPTPAY_ID_PROPERTY, row[7]);
  setProperty_(LINE_TOKEN_PROPERTY, row[8]);
  setProperty_(LINE_BOT_USER_ID_PROPERTY, row[9]);

  Logger.log(
    "คัดลอกค่าตั้งของหอ \"" + String(row[1] || "") +
    "\" มาเป็น Script Properties แล้ว"
  );

  Logger.log(
    "พร้อมเพย์: " +
    (String(row[7] || "").trim() || "(ยังไม่ได้ตั้ง)")
  );

  Logger.log(
    "LINE token: " +
    (String(row[8] || "").trim() ? "มี" : "(ยังไม่ได้ตั้ง)")
  );
}

/** ดูว่า collapseToSingleDorm() จะลบอะไรบ้าง โดยยังไม่ลบจริง */
function previewCollapseToSingleDorm() {
  collapseToSingleDorm_(true);
}

/** ลบข้อมูลของหออื่นและคอลัมน์ dormId ออกจริง — ย้อนกลับไม่ได้ */
function collapseToSingleDorm() {
  collapseToSingleDorm_(false);
}

function collapseToSingleDorm_(isDryRun) {
  const keepDormId = getRequiredProperty_("KEEP_DORM_ID");

  Logger.log(
    (isDryRun ? "[ทดลอง] " : "[ลบจริง] ") +
    "เก็บเฉพาะหอ " + keepDormId
  );

  const spreadsheet = getSpreadsheet_();

  DORM_SCOPED_SHEETS.forEach(function (sheetName) {
    const sheet = spreadsheet.getSheetByName(sheetName);

    if (!sheet) {
      Logger.log(sheetName + ": ไม่พบชีต — ข้าม");
      return;
    }

    const values = sheet.getDataRange().getValues();

    if (values.length <= 1) {
      Logger.log(sheetName + ": ว่าง — ข้าม");
      return;
    }

    const dormIdColumn = values[0].indexOf("dormId");

    if (dormIdColumn === -1) {
      Logger.log(
        sheetName + ": ไม่มีคอลัมน์ dormId แล้ว — ข้าม"
      );

      return;
    }

    let deleted = 0;
    let blank = 0;

    // ไล่จากล่างขึ้นบน เพื่อให้เลขแถวที่ยังไม่ได้ลบไม่เลื่อน
    for (let i = values.length - 1; i >= 1; i--) {
      const rowDormId = String(
        values[i][dormIdColumn] || ""
      ).trim();

      // แถวที่ไม่มี dormId (เช่น superadmin) ไม่แตะ —
      // ปล่อยให้เจ้าของระบบตัดสินใจเองทีหลัง
      if (!rowDormId) {
        blank++;
        continue;
      }

      if (rowDormId === keepDormId) {
        continue;
      }

      if (!isDryRun) {
        sheet.deleteRow(i + 1);
      }

      deleted++;
    }

    if (!isDryRun) {
      sheet.deleteColumn(dormIdColumn + 1);
    }

    Logger.log(
      sheetName + ": " +
      (isDryRun ? "จะลบ " : "ลบแล้ว ") + deleted + " แถว" +
      (blank
        ? " (ข้าม " + blank + " แถวที่ไม่มี dormId)"
        : "") +
      (isDryRun ? " และจะลบคอลัมน์ dormId" : "")
    );
  });

  const dormsSheet = spreadsheet.getSheetByName("Dorms");

  if (dormsSheet) {
    if (!isDryRun) {
      spreadsheet.deleteSheet(dormsSheet);
    }

    Logger.log(
      isDryRun
        ? "Dorms: จะลบทั้งชีต"
        : "Dorms: ลบทั้งชีตแล้ว"
    );
  }

  if (!isDryRun) {
    bumpDormCache_();
  }

  Logger.log(
    isDryRun
      ? "\nนี่คือการทดลองเท่านั้น ยังไม่มีอะไรถูกลบ " +
        "ถ้าถูกต้องแล้วให้รัน collapseToSingleDorm()"
      : "\nย้ายมาระบบหอเดียวเรียบร้อย"
  );
}
