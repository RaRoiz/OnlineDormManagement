import { apiRequest } from "../types/api";

import type {
  ApiResponse,
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