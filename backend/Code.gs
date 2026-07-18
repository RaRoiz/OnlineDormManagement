function doGet(e) {
  return jsonResponse({
    success: true,
    message: "Dorm Management API is running"
  });
}

function doPost(e) {
  try {
    const request = JSON.parse(e.postData.contents || "{}");
    const action = String(request.action || "");

    switch (action) {
      case "login":
        return jsonResponse(login(request));

      case "validateToken":
        return jsonResponse(validateToken(request.token));

      case "logout":
        return jsonResponse(logout(request.token));

      default:
        return jsonResponse({
          success: false,
          message: "ไม่พบ action ที่ร้องขอ"
        });
    }
  } catch (error) {
    return jsonResponse({
      success: false,
      message: error.message || "เกิดข้อผิดพลาดจากเซิร์ฟเวอร์"
    });
  }
}

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}