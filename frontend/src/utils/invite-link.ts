const DEFAULT_FRONTEND_URL = "https://online-dorm-management-nwfw.vercel.app/";

export function buildStaffInviteLink(
  signupCode: string,
  configuredUrl: string
): string {
  const code = signupCode.trim();
  if (!code) throw new Error("ยังไม่มีรหัสเชิญ จึงไม่สามารถสร้างลิงก์ได้");

  let base: URL;
  try {
    base = new URL(configuredUrl.trim() || DEFAULT_FRONTEND_URL);
  } catch {
    throw new Error("URL เว็บไม่ถูกต้อง กรุณาตรวจ FRONTEND_URL ใน Script Properties");
  }
  const host = base.hostname.toLowerCase().replace(/\.$/, "");
  if (!["http:", "https:"].includes(base.protocol) || base.username || base.password ||
      base.search || base.hash) {
    throw new Error("กรุณาตั้ง FRONTEND_URL เป็น URL เว็บไซต์ โดยไม่มีข้อมูลล็อกอินหรือพารามิเตอร์");
  }
  if (host === "localhost" || host.endsWith(".localhost") ||
      host === "[::1]" || host === "[::]" || host === "0.0.0.0" || host.startsWith("127.")) {
    throw new Error("ลิงก์ localhost ใช้ส่งให้พนักงานเครื่องอื่นไม่ได้ กรุณาตั้ง FRONTEND_URL ใน Script Properties เป็น URL เว็บที่พนักงานเข้าถึงได้");
  }
  if (!base.pathname.endsWith("/")) base.pathname += "/";
  const link = new URL("src/pages/register/register.html", base);
  link.searchParams.set("code", code);
  return link.href;
}
