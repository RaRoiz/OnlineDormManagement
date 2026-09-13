const SLIP_REVIEW_HEADERS = [
  "eventId", "billId", "tenantId", "slipUrl", "decision", "reason",
  "reviewedBy", "recordedAt", "lineUserId"
];

function getSlipReviewSheet_() {
  const spreadsheet = getSpreadsheet_();
  let sheet = spreadsheet.getSheetByName("SlipReviews");
  if (!sheet) sheet = spreadsheet.insertSheet("SlipReviews");
  if (!sheet.getLastRow()) sheet.appendRow(SLIP_REVIEW_HEADERS);
  return sheet;
}

function slipReviewVersion_(billRow, slipUrl) {
  return hashPassword(JSON.stringify(billRow), slipUrl);
}

function appendSlipEvent_(billId, tenantId, slipUrl, decision, reason, userId, lineUserId) {
  getSlipReviewSheet_().appendRow([
    Utilities.getUuid(), billId, tenantId, slipUrl, decision,
    // เก็บข้อความผู้ใช้เป็นข้อความ ไม่ให้กลายเป็นสูตรในชีต
    String(reason || "").startsWith("=") ? "'" + reason : reason || "",
    userId || "", new Date().toISOString(), lineUserId || ""
  ]);
}

function getLatestSlipEvents_() {
  const sheet = getSpreadsheet_().getSheetByName("SlipReviews");
  const latest = {};
  if (!sheet) return latest;
  sheet.getDataRange().getValues().slice(1).forEach(function (row) {
    const billId = String(row[1] || "").trim();
    if (billId) latest[billId] = { decision: String(row[4]), slipUrl: String(row[3]) };
  });
  return latest;
}

function reviewBillSlip(request) {
  const auth = authorizeSlipUser_(request);
  if (!auth.success) return auth;
  const decision = String(request.decision || "");
  const reason = String(request.reason || "").trim();
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    return { success: false, message: "ผลการตรวจสอบไม่ถูกต้อง" };
  }
  if (decision === "REJECTED" && (!reason || reason.length > 500)) {
    return { success: false, message: "กรุณาระบุเหตุผลที่ปฏิเสธสลิป ไม่เกิน 500 ตัวอักษร" };
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let bill;
  try {
    const sheet = getBillsSheet_();
    const values = sheet.getDataRange().getValues();
    const index = getBillHeaderIndex_(values[0]);
    const billId = String(request.billId || "").trim();
    const position = values.findIndex((row, i) => i > 0 && String(row[index.billId]) === billId);
    if (position < 1) return { success: false, message: "ไม่พบบิล" };
    const original = values[position];
    if (String(original[index.paymentStatus]).toUpperCase() !== "PENDING") {
      return { success: false, message: "บิลนี้ไม่ได้รอตรวจสอบแล้ว กรุณาโหลดข้อมูลใหม่" };
    }
    const slipUrl = getSlipUrlByBillId_()[billId];
    if (!slipUrl || request.reviewVersion !== slipReviewVersion_(original, slipUrl)) {
      return { success: false, message: "ข้อมูลบิลหรือสลิปเปลี่ยนแล้ว กรุณาปิดแล้วเปิดตรวจสอบใหม่" };
    }
    const now = new Date().toISOString();
    const updated = original.slice();
    updated[index.paymentStatus] = decision === "APPROVED" ? "PAID" : "UNPAID";
    updated[index.paidAt] = decision === "APPROVED" ? now : "";
    updated[index.updatedAt] = now;
    const range = sheet.getRange(position + 1, 1, 1, original.length);
    try {
      range.setValues([updated]);
      SpreadsheetApp.flush();
      appendSlipEvent_(billId, String(original[index.tenantId]), slipUrl,
        decision, decision === "REJECTED" ? reason : "", auth.user.userId, "");
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
    const token = getLineCredentials_().token;
    if (!lineUserId || !token) throw new Error("ยังไม่ได้เชื่อม LINE ของผู้เช่า");
    const text = decision === "APPROVED"
      ? "ยืนยันการชำระเงินบิล " + bill.billNo + " เรียบร้อยแล้วครับ ✅"
      : "สลิปของบิล " + bill.billNo + " ไม่ผ่านการตรวจสอบ\nเหตุผล: " + reason +
        "\nกรุณาส่งรูปสลิปใหม่ ระบบจะรับสำหรับบิลเดิมที่ถูกปฏิเสธ";
    pushLineMessage_(token, lineUserId, [{ type: "text", text: text }]);
  } catch (error) {
    console.error("แจ้งผลตรวจสลิปทาง LINE ไม่สำเร็จ:", error);
    warning = "บันทึกผลแล้ว แต่แจ้ง LINE ไม่สำเร็จ กรุณาติดต่อผู้เช่าโดยตรง";
  }
  return {
    success: true,
    message: decision === "APPROVED" ? "ยืนยันการชำระเงินแล้ว" : "ปฏิเสธสลิปแล้ว บิลกลับเป็นยังไม่ชำระ",
    warning: warning,
    data: bill
  };
}

/* กันภาพซ้ำไหลไปบิลค้างใบอื่น และให้สลิปที่ส่งแก้ไขกลับเข้าบิลเดิม */
function selectSlipTarget_(tenantId) {
  const sheet = getBillsSheet_();
  const values = sheet.getDataRange().getValues();
  const index = getBillHeaderIndex_(values[0]);
  const candidates = values.map((row, i) => ({ row: row, position: i })).filter(item =>
    item.position > 0 && String(item.row[index.tenantId]) === tenantId);
  if (candidates.some(item => String(item.row[index.paymentStatus]).toUpperCase() === "PENDING")) {
    return { message: "มีสลิปของคุณรอตรวจสอบอยู่แล้ว กรุณารอผลหรือติดต่อเจ้าของหอ ก่อนส่งสลิปเพิ่ม" };
  }
  const latest = getLatestSlipEvents_();
  const rejected = candidates.filter(item =>
    String(item.row[index.paymentStatus]).toUpperCase() === "UNPAID" &&
    latest[String(item.row[index.billId])]?.decision === "REJECTED");
  if (rejected.length > 1) {
    return { message: "มีหลายบิลที่ต้องส่งสลิปใหม่ กรุณาติดต่อเจ้าของหอเพื่อระบุบิลก่อนส่ง" };
  }
  if (rejected.length === 1) {
    const item = rejected[0];
    return { target: { sheet: sheet, index: index, row: item.position, bill: billFromRow_(item.row, index) } };
  }
  return { target: findOldestUnpaidBillByTenantId_(tenantId) };
}

function recordIncomingSlip_(target, slipUrl, lineUserId) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    // อ่านแถวใหม่ภายใต้ lock เพราะระหว่างโหลดรูปอาจมีการแก้บิล/ลบบิล
    const selection = selectSlipTarget_(target.bill.tenantId);
    const current = selection.target;
    if (!current || current.bill.billId !== target.bill.billId) {
      throw new Error("สถานะบิลเปลี่ยนระหว่างรับสลิป กรุณาตรวจสอบข้อมูลบิล");
    }
    savePaymentSlip_(current.bill.billId, slipUrl, lineUserId);
    current.sheet.getRange(current.row + 1, current.index.paymentStatus + 1).setValue("PENDING");
    current.sheet.getRange(current.row + 1, current.index.updatedAt + 1).setValue(new Date().toISOString());
    appendSlipEvent_(current.bill.billId, current.bill.tenantId, slipUrl,
      "SUBMITTED", "", "", lineUserId);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
}
