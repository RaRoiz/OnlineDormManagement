import { apiRequest } from "../types/api";

import type {
  ApiResponse,
  DormPublicInfo,
  RegisteredUser,
  RegisterInput
} from "../types/register";

export function registerUser(
  user: RegisterInput
): Promise<ApiResponse<RegisteredUser>> {
  return apiRequest<
    ApiResponse<RegisteredUser>
  >({
    action: "registerUser",
    user
  });
}

export function getDormPublicInfo(): Promise<
  ApiResponse<DormPublicInfo>
> {
  return apiRequest<
    ApiResponse<DormPublicInfo>
  >({
    action: "getDormPublicInfo"
  });
}