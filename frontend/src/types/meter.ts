export interface MeterRecord {
  meterId: string;

  roomId: string;
  roomNo: string;

  tenantId: string;
  tenantName: string;

  billingMonth: string;

  waterPrevious: number;
  waterCurrent: number;
  waterUnits: number;
  waterRate: number;
  waterAmount: number;

  electricPrevious: number;
  electricCurrent: number;
  electricUnits: number;
  electricRate: number;
  electricAmount: number;

  totalUtility: number;

  recordedAt: string;
  updatedAt: string;
}

export interface MeterInput {
  roomId: string;
  billingMonth: string;

  waterPrevious: number;
  waterCurrent: number;
  waterRate: number;

  electricPrevious: number;
  electricCurrent: number;
  electricRate: number;
}

/* ใช้ ApiResponse ตัวกลางจาก api.ts — re-export ไว้เพื่อให้
   โค้ดเดิมที่ import จากไฟล์นี้ยังทำงานได้เหมือนเดิม */
export type { ApiResponse } from "./api";
