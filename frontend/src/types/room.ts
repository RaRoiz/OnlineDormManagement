export type RoomStatus = "ว่าง" | "ไม่ว่าง";

export interface Room {
  roomId: string;
  roomNo: string;
  roomType: string;
  roomDetail: string;
  price: number;
  floor: number;
  status: RoomStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RoomInput {
  roomNo: string;
  roomType: string;
  roomDetail: string;
  price: number;
  floor: number;
}
/* ใช้ ApiResponse ตัวกลางจาก api.ts — re-export ไว้เพื่อให้
   โค้ดเดิมที่ import จากไฟล์นี้ยังทำงานได้เหมือนเดิม */
export type { ApiResponse } from "./api";
