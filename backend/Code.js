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

    console.log("Request:", JSON.stringify(request));
    console.log("Action:", request.action);

    switch (request.action) {

      /* ========== Auth ========== */

      case "login":
        return jsonResponse(login(request));

      case "registerUser":
        return jsonResponse(registerUser(request));

      case "logout":
        return jsonResponse(logout(request.token));

      case "validateToken":
        return jsonResponse(validateToken(request.token));

      /* ========== Rooms ========== */

      // อ่านผ่าน cache (Performance.gs) — เขียนยังใช้ตัวเดิม
      case "getRooms":
        return jsonResponse(getRoomsCached(request));

      /* เพิ่มห้องได้เฉพาะ OWNER */
      case "createRoom":
        return jsonResponse(ownerOnly_(request, createRoom));

      case "updateRoom":
        return jsonResponse(updateRoom(request));

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

      case "deleteBill":
        return jsonResponse(ownerOnly_(request, deleteBill));

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
