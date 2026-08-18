/* ระบบหอเดียว: สมัครผ่านหน้าเว็บได้เฉพาะพนักงาน */
export type RegisterRole = "USER";

export interface RegisterInput {
  username: string;
  fullName: string;
  password: string;
  role: RegisterRole;

  /** รหัสเชิญที่เจ้าของหอออกให้ (มาจาก ?code= บน URL) */
  signupCode: string;
}

export interface DormPublicInfo {
  dormName: string;
}

export interface RegisteredUser {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  active: boolean;
}

/* ใช้ ApiResponse ตัวกลางจาก api.ts — re-export ไว้เพื่อให้
   โค้ดเดิมที่ import จากไฟล์นี้ยังทำงานได้เหมือนเดิม */
export type { ApiResponse } from "./api";
