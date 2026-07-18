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
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}