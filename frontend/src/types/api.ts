export const API_URL =
  "https://script.google.com/macros/s/AKfycbzFmXKql5ctO9TDkW7XFRGwr72CFFUOjbBM3tVPe-KYFyw50A98GDYnc325ZFLpYeMG3Q/exec";


/**
 * รูปแบบผลลัพธ์มาตรฐานของทุก action ที่ backend ตอบกลับ
 *
 * เดิมประกาศซ้ำเหมือนกันเป๊ะในไฟล์ types ทุกไฟล์ (8 ที่)
 * ย้ายมาไว้ที่เดียว แล้วให้ไฟล์อื่น re-export ต่อ
 * เพื่อไม่ให้ import path ของหน้าเพจต้องเปลี่ยน
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}

interface ApiRequest {
  action: string;
  [key: string]: unknown;
}

export async function apiRequest<T>(
  data: ApiRequest
): Promise<T> {
  let response: Response;

  // ห้าม log request/response — มี password และ token ปนอยู่
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(data),
      redirect: "follow"
    });
  } catch {
    /* fetch โยน TypeError ("Failed to fetch") เมื่อ request
       ไปไม่ถึงเลย — เน็ตหลุด, ยังไม่ได้ deploy, หรือฝั่ง
       Apps Script ล้มก่อนถึง doPost จนตอบเป็นหน้า HTML error
       ที่ไม่มี CORS header */
    throw new Error(
      "ติดต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต " +
        "หรือแจ้งผู้ดูแลระบบให้ตรวจการตั้งค่า Apps Script"
    );
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(
        "ไม่พบปลายทางของระบบ (HTTP 404) กรุณาแจ้งผู้ดูแลให้ตรวจ URL และการเผยแพร่ Web App"
      );
    }
    if (response.status === 401 || response.status === 403) {
      throw new Error(
        `เข้าถึงระบบไม่ได้ (HTTP ${response.status}) กรุณาแจ้งผู้ดูแลให้ตรวจสิทธิ์ Web App`
      );
    }
    throw new Error(
      `ระบบตอบกลับผิดพลาด (HTTP ${response.status}) กรุณาลองใหม่ภายหลัง`
    );
  }

  let result: unknown;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "ระบบส่งข้อมูลกลับมาไม่ถูกต้อง กรุณาแจ้งผู้ดูแลให้ตรวจการเผยแพร่ Web App"
    );
  }
  if (!result || typeof result !== "object" ||
      !("success" in result) || typeof result.success !== "boolean") {
    throw new Error("รูปแบบข้อมูลจากระบบไม่ถูกต้อง กรุณาแจ้งผู้ดูแลระบบ");
  }
  return result as T;
}
