import { apiRequest } from "../types/api";
import { requireToken } from "./auth.service";

import type {
  ApiResponse,
  DashboardSummary,
  ReportData,
  ReportFilter
} from "../types/report";

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