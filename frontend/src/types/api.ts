const API_URL =
  "https://script.google.com/macros/s/AKfycbzFmXKql5ctO9TDkW7XFRGwr72CFFUOjbBM3tVPe-KYFyw50A98GDYnc325ZFLpYeMG3Q/exec";


interface ApiRequest {
  action: string;
  [key: string]: unknown;
}

export async function apiRequest<T>(
  data: ApiRequest
): Promise<T> {
  console.log("API request:", data);

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=utf-8"
    },
    body: JSON.stringify(data),
    redirect: "follow"
  });

  const responseText = await response.text();

  console.log("API response:", responseText);

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