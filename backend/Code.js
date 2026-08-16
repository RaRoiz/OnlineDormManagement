function doGet(e) {
  return jsonResponse({
    success: true,
    message: "Online Dorm Management API is running"
  });
}

function doPost(e) {
  try {
    const request = JSON.parse(
      e.postData?.contents || "{}"
    );

    // ห้าม log ตัว request ทั้งก้อน — มี password และ token ปนอยู่
    console.log("Action:", request.action);

    // Webhook จาก LINE (มี events ไม่มี action)
    if (
      !request.action &&
      Array.isArray(request.events)
    ) {
      return jsonResponse(
        handleLineWebhook_(request)
      );
    }

    switch (request.action) {

      /* ========== Auth ========== */

      case "login":
        return jsonResponse(login(request));

      case "registerUser":
        return jsonResponse(registerUser(request));

      /* ดูชื่อหอก่อนสมัคร — สาธารณะ ไม่ต้อง login */
      case "getDormPublicInfo":
        return jsonResponse(getDormPublicInfo(request));

      case "logout":
        return jsonResponse(logout(request.token));

      case "validateToken":
        return jsonResponse(validateToken(request.token));

      /* โปรไฟล์ตัวเอง — ทุก role แก้ไขได้ (handler เช็ค token เองอยู่แล้ว) */
      case "updateOwnProfile":
        return jsonResponse(updateOwnProfile(request));

      case "changeOwnPassword":
        return jsonResponse(changeOwnPassword(request));

      case "uploadAvatar":
        return jsonResponse(uploadAvatar(request));

      /* ชื่อหอ: แก้ได้เฉพาะ OWNER */
      case "updateOwnDorm":
        return jsonResponse(ownerOnly_(request, updateOwnDorm));

      /* รายชื่อพนักงานของหอตัวเอง — เฉพาะ OWNER */
      case "getStaff":
        return jsonResponse(ownerOnly_(request, getStaff));

      /* ========== Rooms ========== */

      // อ่านผ่าน cache (Performance.gs) — เขียนยังใช้ตัวเดิม
      case "getRooms":
        return jsonResponse(getRoomsCached(request));

      /* เพิ่มห้องได้เฉพาะ OWNER */
      case "createRoom":
        return jsonResponse(ownerOnly_(request, createRoom));

      /* ห้องพัก: USER ดูได้อย่างเดียว */
      case "updateRoom":
        return jsonResponse(ownerOnly_(request, updateRoom));

      case "deleteRoom":
        return jsonResponse(ownerOnly_(request, deleteRoom));

      /* ========== Tenants ========== */

      case "getTenants":
        return jsonResponse(getTenantsCached(request));

      case "createTenant":
        return jsonResponse(createTenant(request));

      case "updateTenant":
        return jsonResponse(updateTenant(request));

      case "checkoutTenant":
        return jsonResponse(checkoutTenant(request));

      case "deleteTenant":
        return jsonResponse(ownerOnly_(request, deleteTenant));

      /* ========== Meters ========== */

      case "getMeters":
        return jsonResponse(getMetersCached(request));

      case "createMeter":
        return jsonResponse(createMeter(request));

      case "updateMeter":
        return jsonResponse(updateMeter(request));

      case "deleteMeter":
        return jsonResponse(ownerOnly_(request, deleteMeter));

      /* ========== Bills ========== */

      case "getBills":
        return jsonResponse(getBillsCached(request));

      case "createBill":
        return jsonResponse(createBill(request));

      case "updateBill":
        return jsonResponse(updateBill(request));

      case "markBillPaid":
        return jsonResponse(markBillPaid(request));

      case "sendBillLine":
        return jsonResponse(sendBillLine(request));

      /* บิล: USER ลบได้ */
      case "deleteBill":
        return jsonResponse(deleteBill(request));

      /* ========== Dashboard / Report ========== */

      /* Report ทั้งหมดดูได้เฉพาะ OWNER */

      case "getDashboardSummary":
        return jsonResponse(ownerOnly_(request, getDashboardSummary));

      case "getRoomReport":
        return jsonResponse(ownerOnly_(request, getRoomReport));

      case "getTenantReport":
        return jsonResponse(ownerOnly_(request, getTenantReport));

      case "getUtilityReport":
        return jsonResponse(ownerOnly_(request, getUtilityReport));

      case "getBillReport":
        return jsonResponse(ownerOnly_(request, getBillReport));

      /* ========== Endpoint รวมต่อหน้า (Performance.gs) ==========
         โหลดข้อมูลทั้งหน้าใน request เดียว ลด overhead ของ
         Apps Script (~1-2 วิ/request) */

      case "getBillPageData":
        return jsonResponse(getBillPageData(request));

      case "getMeterPageData":
        return jsonResponse(getMeterPageData(request));

      case "getTenantPageData":
        return jsonResponse(getTenantPageData(request));

      case "getReportPageData":
        return jsonResponse(ownerOnly_(request, getReportPageData));

      /* ========== จัดการบัญชีผู้ใช้ (SUPER_ADMIN) ========== */

      case "getUsers":
        return jsonResponse(superAdminOnly_(request, getUsers));

      case "createManagedUser":
        return jsonResponse(
          superAdminOnly_(request, createManagedUser)
        );

      case "setUserActive":
        return jsonResponse(
          superAdminOnly_(request, setUserActive)
        );

      case "resetUserPassword":
        return jsonResponse(
          superAdminOnly_(request, resetUserPassword)
        );

      /* default ต้องอยู่ท้ายสุดเสมอ */

      default:
        return jsonResponse({
          success: false,
          message:
            "ไม่พบ action ที่ร้องขอ: " +
            String(request.action || "(ไม่มีค่า)")
        });
    }
  } catch (error) {
    console.error(error);

    return jsonResponse({
      success: false,
      message:
        error instanceof Error
          ? error.message
          : String(error)
    });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}
