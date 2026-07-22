import { apiRequest } from "../types/api";
import { getToken } from "./auth.service";

import type {
  ApiResponse,
  Bill,
  BillInput
} from "../types/bill";

function requireToken(): string {
  const token = getToken();

  if (!token) {
    throw new Error(
      "ไม่พบข้อมูลการเข้าสู่ระบบ"
    );
  }

  return token;
}

export function getBills(): Promise<
  ApiResponse<Bill[]>
> {
  return apiRequest<ApiResponse<Bill[]>>({
    action: "getBills",
    token: requireToken()
  });
}

export function createBill(
  bill: BillInput
): Promise<ApiResponse<Bill>> {
  return apiRequest<ApiResponse<Bill>>({
    action: "createBill",
    token: requireToken(),
    bill
  });
}

export function updateBill(
  billId: string,
  bill: BillInput
): Promise<ApiResponse<Bill>> {
  return apiRequest<ApiResponse<Bill>>({
    action: "updateBill",
    token: requireToken(),
    billId,
    bill
  });
}

export function markBillPaid(
  billId: string
): Promise<ApiResponse<Bill>> {
  return apiRequest<ApiResponse<Bill>>({
    action: "markBillPaid",
    token: requireToken(),
    billId
  });
}

export function sendBillLine(
  billId: string
): Promise<ApiResponse<null>> {
  return apiRequest<ApiResponse<null>>({
    action: "sendBillLine",
    token: requireToken(),
    billId
  });
}

export function deleteBill(
  billId: string
): Promise<ApiResponse<null>> {
  return apiRequest<ApiResponse<null>>({
    action: "deleteBill",
    token: requireToken(),
    billId
  });
}