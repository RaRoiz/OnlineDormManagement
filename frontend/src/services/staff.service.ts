import { apiRequest } from "../types/api";
import { requireToken } from "./auth.service";

import type {
  ApiResponse,
  StaffMember
} from "../types/staff";

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
