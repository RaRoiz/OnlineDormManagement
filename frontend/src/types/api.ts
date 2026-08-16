export const API_URL =
  "https://script.google.com/macros/s/AKfycbzFmXKql5ctO9TDkW7XFRGwr72CFFUOjbBM3tVPe-KYFyw50A98GDYnc325ZFLpYeMG3Q/exec";


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

  const responseText = await response.text();

  if (!response.ok) {
    throw new Error(
      `HTTP ${response.status}: ${responseText}`
    );
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    throw new Error(
      "ข้อมูลจาก API ไม่ใช่ JSON: " + responseText
    );
  }
}