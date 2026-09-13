/** Read only the authenticated user's avatar; never accept a client file ID. */
function getOwnAvatar(request) {
  const auth = validateToken(request.token);
  if (!auth.success) return auth;
  const own = findOwnUserRow_(auth.user.userId);
  if (own.targetRow === -1) return { success: false, message: "ไม่พบบัญชีผู้ใช้" };
  const row = own.values[own.targetRow - 1];
  if (!isTruthyCell_(row[own.index.active])) return { success: false, message: "บัญชีถูกปิดใช้งาน" };
  let id = String(row[own.index.avatarFileId] || "").trim();
  if (!id) {
    const match = String(row[own.index.avatarUrl] || "").match(/^https:\/\/drive\.google\.com\/(?:uc\?[^#]*\bid=|file\/d\/)([\w-]+)/);
    id = match ? match[1] : "";
  }
  if (!id) return { success: true, data: null };
  const file = DriveApp.getFileById(id);
  if (file.isTrashed()) return { success: false, message: "ไม่พบไฟล์รูปโปรไฟล์เดิม กรุณาเลือกรูปใหม่" };
  if (file.getSize() > AVATAR_MAX_BYTES) return { success: false, message: "รูปโปรไฟล์มีขนาดเกินกำหนด" };
  const bytes = file.getBlob().getBytes();
  const mimeType = detectImageMimeType_(bytes);
  if (!mimeType) return { success: false, message: "รูปแบบไฟล์ไม่รองรับ" };
  return { success: true, data: { mimeType: mimeType, base64Data: Utilities.base64Encode(bytes) } };
}
