import { apiRequest } from "../types/api";
import { requireToken } from "./auth.service";

import type {
  ApiResponse,
  Bill,
  BillInput
} from "../types/bill";

export function getBillSlip(billId: string): Promise<
  ApiResponse<{ mimeType: string; base64Data: string; reviewVersion: string; paymentStatus: string }>
> {
  return apiRequest({
    action: "getBillSlip",
    token: requireToken(),
    billId
  });
}

export function getBills(): Promise<
  ApiResponse<Bill[]>
> {
  return apiRequest<ApiResponse<Bill[]>>({
    action: "getBills",
    token: requireToken()
  });
}

export function reviewBillSlip(billId: string, reviewVersion: string,
  decision: "APPROVED" | "REJECTED", reason: string): Promise<ApiResponse<Bill> & { warning?: string }> {
  return apiRequest({ action: "reviewBillSlip", token: requireToken(), billId, reviewVersion, decision, reason });
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
