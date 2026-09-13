/** Run from the Apps Script editor; no public API and no password reset. */
function migrateSuperAdminRoleToAdmin() {
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    const sheet = getUsersSheet_();
    const rows = sheet.getDataRange().getValues();
    const index = createHeaderIndex(rows[0]);
    if (typeof index.role !== "number") throw new Error("ไม่พบคอลัมน์ role ในชีต Users");
    let updated = 0;
    rows.slice(1).forEach(function (row, i) {
      if (String(row[index.role] || "").trim().toUpperCase() === "SUPER_ADMIN") {
        sheet.getRange(i + 2, index.role + 1).setValue("ADMIN");
        updated++;
      }
    });
    SpreadsheetApp.flush();
    console.log("เปลี่ยนบทบาทเป็น ADMIN แล้ว " + updated + " บัญชี");
    return { updated: updated };
  } finally {
    lock.releaseLock();
  }
}
