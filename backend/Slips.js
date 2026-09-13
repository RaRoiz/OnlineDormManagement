/* สลิปเปิดผ่าน API ที่ตรวจบัญชีเท่านั้น ไม่ส่ง URL ของ Drive ให้หน้าเว็บ */
const SLIP_MAX_BYTES = 10 * 1024 * 1024;

function slipFileIdFromUrl_(value) {
  const url = String(value || "").trim();
  const match = url.match(/^https:\/\/drive\.google\.com\/uc\?export=view&id=([\w-]+)$/);
  if (!match) throw new Error("ลิงก์สลิปในระบบไม่ถูกต้อง");
  return match[1];
}

/* ไม่แก้สิทธิ์โฟลเดอร์ที่อาจใช้ร่วมกับงานอื่น ให้ผู้ดูแลเลือกโฟลเดอร์ส่วนตัว */
function assertSlipFolderPrivate_(folder) {
  const visited = {};
  function check(current) {
    const id = current.getId();
    if (visited[id]) return;
    visited[id] = true;
    if (current.getSharingAccess() !== DriveApp.Access.PRIVATE ||
        current.getViewers().length || current.getEditors().length) {
      const error = new Error("โฟลเดอร์สลิปหรือโฟลเดอร์แม่มีการแชร์ กรุณาใช้โฟลเดอร์ส่วนตัวสำหรับสลิป");
      error.code = "SLIP_SHARED_FOLDER";
      throw error;
    }
    const parents = current.getParents();
    while (parents.hasNext()) check(parents.next());
  }
  check(folder);
}

/* ถ้าโฟลเดอร์เดิมแชร์อยู่ ให้ใช้โฟลเดอร์ส่วนตัวใหม่โดยไม่แตะสิทธิ์เดิม */
function getSlipStorageFolder_() {
  const preferred = getSlipFolder_();
  try {
    assertSlipFolderPrivate_(preferred);
    return preferred;
  } catch (error) {
    if (error.code !== "SLIP_SHARED_FOLDER") throw error;
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const cachedId = getOptionalProperty_("PRIVATE_SLIP_FOLDER_ID");
    if (cachedId) {
      const existing = DriveApp.getFolderById(cachedId);
      if (!existing.isTrashed()) {
        assertSlipFolderPrivate_(existing);
        return existing;
      }
    }
    const folder = DriveApp.createFolder("DormManagement Private Slips");
    assertSlipFolderPrivate_(folder);
    setProperty_("PRIVATE_SLIP_FOLDER_ID", folder.getId());
    console.log("ใช้โฟลเดอร์ส่วนตัวสำหรับสลิป: " + folder.getUrl());
    return folder;
  } finally {
    lock.releaseLock();
  }
}

function restrictSlipFile_(file) {
  const parents = file.getParents();
  while (parents.hasNext()) assertSlipFolderPrivate_(parents.next());
  if (file.getSharingAccess() !== DriveApp.Access.PRIVATE) {
    file.setSharing(DriveApp.Access.PRIVATE, DriveApp.Permission.VIEW);
  }
  if (file.getSharingAccess() !== DriveApp.Access.PRIVATE ||
      file.getViewers().length || file.getEditors().length) {
    throw new Error("ไฟล์สลิปยังมีสิทธิ์แชร์โดยตรง กรุณาให้ผู้ดูแลตรวจสิทธิ์ไฟล์ใน Drive");
  }
}

function authorizeSlipUser_(request) {
  const auth = validateToken(request.token);
  if (!auth.success) return auth;

  // ตรวจบัญชีจริงทุกครั้ง ไม่ใช้ role/active เก่าจาก session หรือ cache รายการบิล
  const own = findOwnUserRow_(auth.user.userId);
  if (own.targetRow === -1) return { success: false, message: "ไม่พบบัญชีผู้ใช้" };
  const row = own.values[own.targetRow - 1];
  const role = normalizeRole_(row[own.index.role]);
  if (!isTruthyCell_(row[own.index.active]) ||
      ["OWNER", "ADMIN", "USER"].indexOf(role) === -1) {
    return { success: false, message: "บัญชีนี้ไม่มีสิทธิ์ดูสลิป" };
  }

  return auth;
}

function getBillSlip(request) {
  const auth = authorizeSlipUser_(request);
  if (!auth.success) return auth;
  const billId = String(request.billId || "").trim();
  if (!billId) return { success: false, message: "กรุณาระบุบิล" };
  const bills = getBillsSheet_().getDataRange().getValues();
  const index = getBillHeaderIndex_(bills[0]);
  const billRow = bills.slice(1).find(row => String(row[index.billId] || "").trim() === billId);
  if (!billRow) {
    return { success: false, message: "ไม่พบใบแจ้งหนี้" };
  }
  const slipUrl = getSlipUrlByBillId_()[billId];
  if (!slipUrl) return { success: false, message: "ไม่พบสลิปของบิลนี้" };

  const file = DriveApp.getFileById(slipFileIdFromUrl_(slipUrl));
  if (file.isTrashed()) return { success: false, message: "ไฟล์สลิปถูกย้ายไปถังขยะแล้ว" };
  if (file.getSize() > SLIP_MAX_BYTES) {
    return { success: false, message: "สลิปมีขนาดเกิน 10 MB กรุณาติดต่อผู้ดูแล" };
  }
  const blob = file.getBlob();
  const mimeType = blob.getContentType();
  if (["image/jpeg", "image/png", "image/webp", "image/gif"].indexOf(mimeType) === -1) {
    return { success: false, message: "ไฟล์สลิปไม่ใช่รูปภาพที่รองรับ" };
  }
  return {
    success: true,
    message: "โหลดสลิปสำเร็จ",
    data: {
      mimeType: mimeType, base64Data: Utilities.base64Encode(blob.getBytes()),
      reviewVersion: slipReviewVersion_(billRow, slipUrl),
      paymentStatus: String(billRow[index.paymentStatus] || "").trim().toUpperCase()
    }
  };
}

/* รันจาก Apps Script editor เท่านั้น ไม่เปิดเป็น API */
function previewSlipPrivacyMigration() {
  return migrateSlipPrivacy_(true);
}

function restrictExistingPaymentSlips() {
  return migrateSlipPrivacy_(false);
}

function migrateSlipPrivacy_(dryRun) {
  const spreadsheet = getSpreadsheet_();
  const sheet = spreadsheet.getSheetByName("PaymentSlips");
  const rows = sheet ? sheet.getDataRange().getValues().slice(1) : [];
  const seen = {};
  const results = [];
  rows.forEach(function (row) {
    const billId = String(row[0] || "").trim();
    if (!billId || !row[1]) return;
    try {
      const id = slipFileIdFromUrl_(row[1]);
      if (seen[id]) return;
      seen[id] = true;
      const file = DriveApp.getFileById(id);
      if (file.isTrashed()) {
        results.push({ billId: billId, status: "trashed" });
        return;
      }
      const parents = file.getParents();
      while (parents.hasNext()) assertSlipFolderPrivate_(parents.next());
      if (file.getViewers().length || file.getEditors().length) {
        throw new Error("ต้องตรวจสิทธิ์แชร์รายบุคคลของไฟล์นี้ก่อน");
      }
      if (!dryRun) restrictSlipFile_(file);
      results.push({ billId: billId, status: dryRun ? "ready" : "restricted" });
    } catch (error) {
      results.push({ billId: billId, status: "failed", message: String(error.message || error) });
    }
  });
  const result = { dryRun: dryRun, results: results };
  console.log(JSON.stringify(result));
  return result;
}
