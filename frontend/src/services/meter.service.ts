import { apiRequest } from "../types/api";
import { requireToken } from "./auth.service";

import type {
  ApiResponse,
  MeterInput,
  MeterRecord
} from "../types/meter";

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