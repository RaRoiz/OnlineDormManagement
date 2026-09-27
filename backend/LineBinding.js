/** Fail closed when old or duplicate LINE links make the target ambiguous. */
function resolveSlipSender_(lineUserId) {
  const sender = String(lineUserId || "").trim();
  if (!sender) throw new Error("ไม่พบบัญชี LINE ผู้ส่ง");
  const rows = getLineLinksSheet_().getDataRange().getValues().slice(1);
  const links = rows.filter(row => String(row[0] || "").trim() === sender);
  if (links.length !== 1) throw new Error("ยังไม่ได้ผูกห้อง หรือข้อมูล LINE ซ้ำ กรุณาแจ้งเจ้าของหอตรวจสอบก่อนส่งสลิป");
  const tenantId = String(links[0][1] || "").trim();
  if (!tenantId || rows.filter(row => String(row[1] || "").trim() === tenantId).length !== 1) {
    throw new Error("ผู้เช่ามีการผูก LINE ซ้ำ กรุณาแจ้งเจ้าของหอตรวจสอบ");
  }
  const tenants = getTenantsSheet_().getDataRange().getValues();
  const index = getTenantHeaderIndex_(tenants[0]);
  const matches = tenants.slice(1).filter(row => String(row[index.tenantId] || "").trim() === tenantId);
  if (matches.length !== 1 || String(matches[0][index.status]).trim().toUpperCase() !== "ACTIVE") {
    throw new Error("ข้อมูลผู้เช่าไม่พร้อมใช้งาน กรุณาแจ้งเจ้าของหอ");
  }
  const roomId = String(matches[0][index.roomId] || "").trim();
  const roomNo = String(getRoomMap_().get(roomId) || "").trim();
  if (!roomId || !roomNo || roomNo !== String(links[0][3] || "").trim()) {
    throw new Error("ห้องที่ผูก LINE ไม่ตรงกับข้อมูลผู้เช่า กรุณาแจ้งเจ้าของหอตรวจสอบ");
  }
  return { tenantId: tenantId, roomId: roomId, roomNo: roomNo };
}

function assertSlipSenderMatches_(lineUserId, bill) {
  const sender = resolveSlipSender_(lineUserId);
  if (String(bill.tenantId || "").trim() !== sender.tenantId ||
      String(bill.roomId || "").trim() !== sender.roomId ||
      String(bill.roomNo || "").trim() !== sender.roomNo) {
    throw new Error("ห้องหรือผู้เช่าในบิลไม่ตรงกับ LINE ผู้ส่ง ระบบยังไม่ผูกสลิป กรุณาแจ้งเจ้าของหอ");
  }
}

/** Called under the registration lock. Never silently replace another person's link. */
function assertLineRegistration_(values, lineUserId, tenantId) {
  const sender = String(lineUserId || "").trim();
  const tenant = String(tenantId || "").trim();
  if (!sender || !tenant) throw new Error("ข้อมูลลงทะเบียนไม่ครบ");
  const related = values.slice(1).filter(row => String(row[0] || "").trim() === sender || String(row[1] || "").trim() === tenant);
  if (related.length > 1 || related.some(row => String(row[0] || "").trim() !== sender || String(row[1] || "").trim() !== tenant)) {
    throw new Error("LINE หรือห้องนี้มีการลงทะเบียนไว้แล้ว หากต้องการเปลี่ยนห้องหรือบัญชี LINE กรุณาแจ้งเจ้าของหอ");
  }
}
