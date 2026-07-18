export type TenantStatus =
  | "ACTIVE"
  | "INACTIVE";

export interface Tenant {
  tenantId: string;
  fullName: string;
  citizenId: string;
  phone: string;
  lineId: string;
  email: string;

  roomId: string;
  roomNo: string;

  checkInDate: string;
  checkOutDate: string;

  status: TenantStatus;

  createdAt: string;
  updatedAt: string;
}

export interface TenantInput {
  fullName: string;
  citizenId: string;
  phone: string;
  lineId: string;
  email: string;
  roomId: string;
  checkInDate: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}