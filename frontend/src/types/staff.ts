export interface StaffMember {
  userId: string;
  fullName: string;
  username: string;
  phone: string;
  active: boolean;
}

/* ใช้ ApiResponse ตัวกลางจาก api.ts — re-export ไว้เพื่อให้
   โค้ดเดิมที่ import จากไฟล์นี้ยังทำงานได้เหมือนเดิม */
export type { ApiResponse } from "./api";
