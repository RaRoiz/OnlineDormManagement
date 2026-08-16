import { apiRequest } from "../types/api";
import { getToken } from "./auth.service";

import type {
  ApiResponse,
  CreateUserInput,
  ManagedUser
} from "../types/admin";

function requireToken(): string {
  const token = getToken();

  if (!token) {
    throw new Error(
      "ไม่พบข้อมูลการเข้าสู่ระบบ"
    );
  }

  return token;
}

export function getUsers(): Promise<
  ApiResponse<ManagedUser[]>
> {
  return apiRequest<ApiResponse<ManagedUser[]>>({
    action: "getUsers",
    token: requireToken()
  });
}

export function createManagedUser(
  user: CreateUserInput
): Promise<ApiResponse<ManagedUser>> {
  return apiRequest<ApiResponse<ManagedUser>>({
    action: "createManagedUser",
    token: requireToken(),
    user
  });
}

export function setUserActive(
  userId: string,
  active: boolean
): Promise<ApiResponse<null>> {
  return apiRequest<ApiResponse<null>>({
    action: "setUserActive",
    token: requireToken(),
    userId,
    active
  });
}

export function resetUserPassword(
  userId: string,
  newPassword: string
): Promise<ApiResponse<null>> {
  return apiRequest<ApiResponse<null>>({
    action: "resetUserPassword",
    token: requireToken(),
    userId,
    newPassword
  });
}
