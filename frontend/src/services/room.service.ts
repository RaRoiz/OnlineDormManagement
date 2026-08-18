import { apiRequest } from "../types/api";
import { requireToken } from "./auth.service";

import type {
  ApiResponse,
  Room,
  RoomInput
} from "../types/room";

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