/**
 * แปลงข้อความให้ปลอดภัยก่อนต่อเข้า template string ของ HTML
 *
 * เดิมฟังก์ชันนี้ถูกก็อปซ้ำไว้ในหน้าเพจ 7 หน้า และใช้วิธี
 * textContent -> innerHTML ซึ่ง "ไม่ escape เครื่องหมายคำพูด"
 * พอเอาไปวางในค่า attribute เช่น value="${...}" ข้อความที่มี
 * เครื่องหมาย " จะหลุดออกนอก attribute ได้
 *
 * ตัวนี้ escape ครบทั้ง 5 ตัวตามมาตรฐาน OWASP จึงใช้ได้ทั้งใน
 * เนื้อหาและในค่า attribute
 */
const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;"
};

export function escapeHtml(value: string): string {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character]
  );
}
