export type BillStatus =
  | "UNPAID"
  | "PAID";

export interface Bill {
  billId: string;
  billNo: string;

  meterId: string;

  roomId: string;
  roomNo: string;

  tenantId: string;
  tenantName: string;

  billingMonth: string;

  roomRent: number;
  waterAmount: number;
  electricAmount: number;

  depositAmount: number;
  repairAmount: number;
  damageAmount: number;

  totalAmount: number;

  dueDate: string;
  paymentStatus: BillStatus;
  paidAt: string;

  note: string;

  createdAt: string;
  updatedAt: string;
}

export interface BillInput {
  meterId: string;

  depositAmount: number;
  repairAmount: number;
  damageAmount: number;

  dueDate: string;
  note: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}