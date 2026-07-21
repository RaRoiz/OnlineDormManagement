import { apiRequest } from "../types/api";
import { getToken } from "./auth.service";

import type {
  ApiResponse,
  DashboardSummary,
  ReportData,
  ReportFilter
} from "../types/report";

function requireToken(): string {
  const token = getToken();

  if (!token) {
    throw new Error(
      "ไม่พบข้อมูลการเข้าสู่ระบบ"
    );
  }

  return token;
}

export function getDashboardSummary(
  billingMonth: string
): Promise<ApiResponse<DashboardSummary>> {
  return apiRequest<
    ApiResponse<DashboardSummary>
  >({
    action: "getDashboardSummary",
    token: requireToken(),
    billingMonth
  });
}

export function getReport(
  filter: ReportFilter
): Promise<ApiResponse<ReportData>> {
  const actionMap = {
    ROOM: "getRoomReport",
    TENANT: "getTenantReport",
    UTILITY: "getUtilityReport",
    BILL: "getBillReport"
  } as const;

  return apiRequest<ApiResponse<ReportData>>({
    action: actionMap[filter.reportType],
    token: requireToken(),
    filter
  });
}