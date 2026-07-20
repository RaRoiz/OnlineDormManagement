function doGet(e) {
  return jsonResponse({
    success: true,
    message: "Dorm Management API is running"
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
      case "login":
        return jsonResponse(login(request));

      case "logout":
        return jsonResponse(logout(request.token));

      case "validateToken":
        return jsonResponse(validateToken(request.token));

      case "getRooms":
        return jsonResponse(getRooms(request));

      case "createRoom":
        return jsonResponse(createRoom(request));

      case "updateRoom":
        return jsonResponse(updateRoom(request));

      case "deleteRoom":
        return jsonResponse(deleteRoom(request));

      default:
        return jsonResponse({
          success: false,
          message:
            "ไม่พบ action ที่ร้องขอ: " +
            String(request.action || "(ไม่มีค่า)")
        });

case "getTenants":
  return jsonResponse(getTenants(request));

case "createTenant":
  return jsonResponse(createTenant(request));

case "updateTenant":
  return jsonResponse(updateTenant(request));

case "checkoutTenant":
  return jsonResponse(checkoutTenant(request));

case "deleteTenant":
  return jsonResponse(deleteTenant(request));

  case "getMeters":
  return jsonResponse(getMeters(request));

case "createMeter":
  return jsonResponse(createMeter(request));

case "updateMeter":
  return jsonResponse(updateMeter(request));

case "deleteMeter":
  return jsonResponse(deleteMeter(request));

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

function jsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}