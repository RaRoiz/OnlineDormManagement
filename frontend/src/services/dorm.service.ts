import { apiRequest } from "../types/api";
import { getToken } from "./auth.service";

import type {
  ApiResponse,
  CreateDormInput,
  Dorm,
  DormDetail,
  PlatformSummary
} from "../types/dorm";

function requireToken(): string {
  const token = getToken();

  if (!token) {
    throw new Error(
      "ไม่พบข้อมูลการเข้าสู่ระบบ"
    );
  }

  return token;
}

export function getDorms(): Promise<
  ApiResponse<Dorm[]>
> {
  return apiRequest<ApiResponse<Dorm[]>>({
    action: "getDorms",
    token: requireToken()
  });
}

export function getPlatformSummary(): Promise<
  ApiResponse<PlatformSummary>
> {
  return apiRequest<
    ApiResponse<PlatformSummary>
  >({
    action: "getPlatformSummary",
    token: requireToken()
  });
}

export function getDormDetail(
  dormId: string
): Promise<ApiResponse<DormDetail>> {
  return apiRequest<ApiResponse<DormDetail>>({
    action: "getDormDetail",
    token: requireToken(),
    dormId
  });
}

export function createDorm(
  dorm: CreateDormInput
): Promise<
  ApiResponse<{
    dormId: string;
    dormName: string;
    ownerUsername: string;
  }>
> {
  return apiRequest<
    ApiResponse<{
      dormId: string;
      dormName: string;
      ownerUsername: string;
    }>
  >({
    action: "createDorm",
    token: requireToken(),
    dorm
  });
}
