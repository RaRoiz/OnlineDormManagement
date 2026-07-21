import { apiRequest } from "../types/api";
import { getToken } from "./auth.service";

import type {
  ApiResponse,
  Tenant,
  TenantInput
} from "../types/tenant";

function requireToken(): string {
  const token = getToken();

  if (!token) {
    throw new Error(
      "ไม่พบข้อมูลการเข้าสู่ระบบ"
    );
  }

  return token;
}

export function getTenants(): Promise<
  ApiResponse<Tenant[]>
> {
  return apiRequest<ApiResponse<Tenant[]>>({
    action: "getTenants",
    token: requireToken()
  });
}

export function createTenant(
  tenantInput: TenantInput
): Promise<ApiResponse<Tenant>> {
  return apiRequest<ApiResponse<Tenant>>({
    action: "createTenant",
    token: requireToken(),
    tenant: tenantInput
  });
}

export function updateTenant(
  tenantId: string,
  tenantInput: TenantInput
): Promise<ApiResponse<Tenant>> {
  return apiRequest<ApiResponse<Tenant>>({
    action: "updateTenant",
    token: requireToken(),
    tenantId,
    tenant: tenantInput
  });
}

export function checkoutTenant(
  tenantId: string,
  checkOutDate: string
): Promise<ApiResponse<Tenant>> {
  return apiRequest<ApiResponse<Tenant>>({
    action: "checkoutTenant",
    token: requireToken(),
    tenantId,
    checkOutDate
  });
}

export function deleteTenant(
  tenantId: string
): Promise<ApiResponse<null>> {
  return apiRequest<ApiResponse<null>>({
    action: "deleteTenant",
    token: requireToken(),
    tenantId
  });
}