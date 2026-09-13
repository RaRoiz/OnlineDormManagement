function slipReviewVersion_(row, url) {
  return hashPassword(JSON.stringify(row), url);
}

function getSlipReviewSheet_() {
  const ss = getSpreadsheet_();
  let sheet = ss.getSheetByName("SlipReviews");
  if (!sheet) {
    sheet = ss.insertSheet("SlipReviews");
    sheet.appendRow(["billId", "slipUrl", "decision", "reason", "reviewedBy", "recordedAt"]);
  }
  return sheet;
}

function appendSlipReview_(billId, url, decision, reason, userId) {
  getSlipReviewSheet_().appendRow([billId, url, decision,
    /^[=+@-]/.test(reason) ? "'" + reason : reason, userId, new Date().toISOString()]);
}

function reviewBillSlip(request) {
  const auth = authorizeSlipUser_(request);
  if (!auth.success) return auth;
  const decision = String(request.decision || "");
  const reason = String(request.reason || "").trim();
  if (!["APPROVED", "REJECTED"].includes(decision)) return { success: false, message: "ผลตรวจสอบไม่ถูกต้อง" };
  if (decision === "REJECTED" && (!reason || reason.length > 500)) {
    return { success: false, message: "กรุณาระบุเหตุผลที่ปฏิเสธ ไม่เกิน 500 ตัวอักษร" };
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let bill;
  try {
    const sheet = getBillsSheet_();
    const rows = sheet.getDataRange().getValues();
    const index = getBillHeaderIndex_(rows[0]);
    const position = rows.findIndex((row, i) => i > 0 && String(row[index.billId]) === request.billId);
    if (position < 1) return { success: false, message: "ไม่พบบิล" };
    const original = rows[position];
    const url = getSlipUrlByBillId_()[request.billId];
    if (String(original[index.paymentStatus]).toUpperCase() !== "PENDING" || !url ||
        request.reviewVersion !== slipReviewVersion_(original, url)) {
      return { success: false, message: "ข้อมูลบิลหรือสลิปเปลี่ยนแล้ว กรุณาปิดและเปิดสลิปใหม่" };
    }
    const updated = original.slice();
    const now = new Date().toISOString();
    updated[index.paymentStatus] = decision === "APPROVED" ? "PAID" : "UNPAID";
    updated[index.paidAt] = decision === "APPROVED" ? now : "";
    updated[index.updatedAt] = now;
    const range = sheet.getRange(position + 1, 1, 1, original.length);
    try {
      range.setValues([updated]);
      SpreadsheetApp.flush();
      appendSlipReview_(request.billId, url, decision, reason, auth.user.userId);
      SpreadsheetApp.flush();
    } catch (error) {
      range.setValues([original]);
      SpreadsheetApp.flush();
      throw error;
    }
    bill = billFromRow_(updated, index);
    bumpDormCache_();
  } finally {
    lock.releaseLock();
  }
  let warning = "";
  try {
    const lineUserId = findLineUserIdByTenantId_(bill.tenantId);
    if (lineUserId) {
      pushLineMessage_(getLineCredentials_().token, lineUserId, [{ type: "text", text:
        decision === "APPROVED" ? "ยืนยันการชำระเงินบิล " + bill.billNo + " แล้วครับ" :
          "สลิปบิล " + bill.billNo + " ไม่ผ่านการตรวจสอบ\nเหตุผล: " + reason + "\nกรุณาส่งสลิปใหม่สำหรับบิลนี้ครับ" }]);
    } else warning = "บันทึกผลแล้ว แต่ไม่พบบัญชี LINE ของผู้เช่า";
  } catch (error) { warning = "บันทึกผลแล้ว แต่แจ้ง LINE ไม่สำเร็จ กรุณาแจ้งผู้เช่าโดยตรง"; }
  return { success: true, message: decision === "APPROVED" ? "ยืนยันการชำระเงินแล้ว" : "ปฏิเสธสลิปแล้ว ผู้เช่าส่งใหม่ได้", warning: warning, data: bill };
}

function selectSlipTarget_(tenantId) {
  const sheet = getBillsSheet_();
  const rows = sheet.getDataRange().getValues();
  const index = getBillHeaderIndex_(rows[0]);
  const own = rows.slice(1).map((row, i) => ({ bill: billFromRow_(row, index), row: i + 2, sheet: sheet, index: index }))
    .filter(target => target.bill.tenantId === tenantId);
  if (own.some(target => target.bill.paymentStatus === "PENDING")) {
    return { message: "มีสลิปรอตรวจสอบอยู่แล้ว กรุณารอผลหรือแจ้งเจ้าของหอครับ" };
  }
  const history = getSpreadsheet_().getSheetByName("SlipReviews");
  const latest = {};
  if (history) history.getDataRange().getValues().slice(1).forEach(row => { latest[String(row[0])] = row[2]; });
  const rejected = own.filter(target => target.bill.paymentStatus === "UNPAID" && latest[target.bill.billId] === "REJECTED");
  if (rejected.length > 1) return { message: "มีหลายบิลที่ต้องส่งสลิปใหม่ กรุณาแจ้งเจ้าของหอเพื่อระบุบิลครับ" };
  return { target: rejected[0] || findOldestUnpaidBillByTenantId_(tenantId) };
}

function recordIncomingSlip_(target, url, lineUserId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const selection = selectSlipTarget_(target.bill.tenantId);
    const current = selection.target;
    if (!current || current.bill.billId !== target.bill.billId) throw new Error("สถานะบิลเปลี่ยนแล้ว กรุณาแจ้งเจ้าของหอ");
    savePaymentSlip_(current.bill.billId, url, lineUserId);
    current.sheet.getRange(current.row, current.index.paymentStatus + 1).setValue("PENDING");
    current.sheet.getRange(current.row, current.index.updatedAt + 1).setValue(new Date().toISOString());
    appendSlipReview_(current.bill.billId, url, "SUBMITTED", "", lineUserId);
    SpreadsheetApp.flush();
  } finally { lock.releaseLock(); }
}
