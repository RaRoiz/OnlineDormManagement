import { apiRequest } from "./api";
import { getToken } from "./auth.service";

import type {
  ApiResponse,
  Room,
  RoomInput
} from "../types/room";

function requireToken(): string {
  const token = getToken();

  if (!token) {
    throw new Error("ไม่พบข้อมูลการเข้าสู่ระบบ");
  }

  return token;
}

export function getRooms(): Promise<
  ApiResponse<Room[]>
> {
  return apiRequest<ApiResponse<Room[]>>({
    action: "getRooms",
    token: requireToken()
  });
}

export function createRoom(
  roomInput: RoomInput
): Promise<ApiResponse<Room>> {
  return apiRequest<ApiResponse<Room>>({
    action: "createRoom",
    token: requireToken(),
    room: roomInput
  });
}

export function updateRoom(
  roomId: string,
  roomInput: RoomInput
): Promise<ApiResponse<Room>> {
  return apiRequest<ApiResponse<Room>>({
    action: "updateRoom",
    token: requireToken(),
    roomId,
    room: roomInput
  });
}

export function deleteRoom(
  roomId: string
): Promise<ApiResponse<null>> {
  return apiRequest<ApiResponse<null>>({
    action: "deleteRoom",
    token: requireToken(),
    roomId
  });
}