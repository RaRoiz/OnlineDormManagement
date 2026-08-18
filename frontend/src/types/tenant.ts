export type TenantStatus =
  | "ACTIVE"
  | "INACTIVE";

export interface Tenant {
  tenantId: string;
  fullName: string;
  citizenId: string;
  phone: string;
  lineId: string;
  email: string;

  roomId: string;
  roomNo: string;

  checkInDate: string;
  checkOutDate: string;

  status: TenantStatus;

  createdAt: string;
  updatedAt: string;
}

export interface TenantInput {
  fullName: string;
  citizenId: string;
  phone: string;
  lineId: string;
  email: string;
  roomId: string;
  checkInDate: string;
}

/* ใช้ ApiResponse ตัวกลางจาก api.ts — re-export ไว้เพื่อให้
   โค้ดเดิมที่ import จากไฟล์นี้ยังทำงานได้เหมือนเดิม */
export type { ApiResponse } from "./api";
