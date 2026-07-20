export interface MeterRecord {
  meterId: string;

  roomId: string;
  roomNo: string;

  tenantId: string;
  tenantName: string;

  billingMonth: string;

  waterPrevious: number;
  waterCurrent: number;
  waterUnits: number;
  waterRate: number;
  waterAmount: number;

  electricPrevious: number;
  electricCurrent: number;
  electricUnits: number;
  electricRate: number;
  electricAmount: number;

  totalUtility: number;

  recordedAt: string;
  updatedAt: string;
}

export interface MeterInput {
  roomId: string;
  billingMonth: string;

  waterPrevious: number;
  waterCurrent: number;
  waterRate: number;

  electricPrevious: number;
  electricCurrent: number;
  electricRate: number;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}