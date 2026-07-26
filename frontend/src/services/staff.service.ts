import { apiRequest } from "../types/api";
import { getToken } from "./auth.service";

import type {
  ApiResponse,
  StaffMember
} from "../types/staff";

function requireToken(): string {
  const token = getToken();

  if (!token) {
    throw new Error(
      "ไม่พบข้อมูลการเข้าสู่ระบบ"
    );
  }

  return token;
}

export function getStaff(): Promise<
  ApiResponse<StaffMember[]>
> {
  return apiRequest<
    ApiResponse<StaffMember[]>
  >({
    action: "getStaff",
    token: requireToken()
  });
}
