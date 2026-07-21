export type ReportType =
  | "ROOM"
  | "TENANT"
  | "UTILITY"
  | "BILL";

export type ReportColumnType =
  | "text"
  | "number"
  | "money"
  | "date"
  | "datetime"
  | "month"
  | "status";

export interface ReportColumn {
  key: string;
  label: string;
  type?: ReportColumnType;
}

export type ReportCellValue =
  | string
  | number
  | boolean
  | null;

export interface ReportData {
  columns: ReportColumn[];
  rows: Array<
    Record<string, ReportCellValue>
  >;
}

export interface ReportFilter {
  reportType: ReportType;
  billingMonth: string;
  roomId: string;
  status: string;
  keyword: string;
}

export interface MonthlyRevenueItem {
  billingMonth: string;
  paidAmount: number;
  outstandingAmount: number;
}

export interface RecentBillItem {
  billId: string;
  billNo: string;
  roomNo: string;
  tenantName: string;
  totalAmount: number;
  dueDate: string;
  status: string;
}

export interface DashboardSummary {
  billingMonth: string;

  totalRooms: number;
  occupiedRooms: number;
  vacantRooms: number;
  occupancyRate: number;

  activeTenants: number;

  unpaidBills: number;
  overdueBills: number;

  outstandingAmount: number;
  paidAmount: number;

  waterAmount: number;
  electricAmount: number;

  monthlyRevenue: MonthlyRevenueItem[];
  recentBills: RecentBillItem[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}