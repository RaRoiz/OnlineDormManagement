import { apiRequest } from "./api";
import { getToken } from "./auth.service";

import type {
  ApiResponse,
  MeterInput,
  MeterRecord
} from "../types/meter";

function requireToken(): string {
  const token = getToken();

  if (!token) {
    throw new Error(
      "ไม่พบข้อมูลการเข้าสู่ระบบ"
    );
  }

  return token;
}

export function getMeters(): Promise<
  ApiResponse<MeterRecord[]>
> {
  return apiRequest<ApiResponse<MeterRecord[]>>({
    action: "getMeters",
    token: requireToken()
  });
}

export function createMeter(
  meterInput: MeterInput
): Promise<ApiResponse<MeterRecord>> {
  return apiRequest<ApiResponse<MeterRecord>>({
    action: "createMeter",
    token: requireToken(),
    meter: meterInput
  });
}

export function updateMeter(
  meterId: string,
  meterInput: MeterInput
): Promise<ApiResponse<MeterRecord>> {
  return apiRequest<ApiResponse<MeterRecord>>({
    action: "updateMeter",
    token: requireToken(),
    meterId,
    meter: meterInput
  });
}

export function deleteMeter(
  meterId: string
): Promise<ApiResponse<null>> {
  return apiRequest<ApiResponse<null>>({
    action: "deleteMeter",
    token: requireToken(),
    meterId
  });
}