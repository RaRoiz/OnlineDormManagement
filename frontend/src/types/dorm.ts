export interface Dorm {
  dormId: string;
  dormName: string;
  ownerName: string;
  phone: string;
  address: string;
  status: string;
  createdAt: string;

  roomCount: number;
  occupiedCount: number;
  occupancyRate: number;
  activeTenants: number;
  unpaidAmount: number;
}

export interface PlatformSummary {
  totalDorms: number;
  activeDorms: number;
  totalRooms: number;
  totalTenants: number;
  totalUnpaidAmount: number;
  newDormsThisMonth: number;
}

export interface CreateDormInput {
  dormName: string;
  ownerName: string;
  phone: string;
  address: string;
  ownerUsername: string;
  ownerPassword: string;
}

export interface DormDetailRoom {
  roomNo: string;
  roomType: string;
  price: number;
  floor: number;
  status: string;
}

export interface DormDetailTenant {
  fullName: string;
  roomNo: string;
  status: string;
  checkInDate: string;
}

export interface DormDetailStaff {
  fullName: string;
  username: string;
  role: string;
  active: boolean;
}

export interface DormDetailBill {
  billNo: string;
  roomNo: string;
  tenantName: string;
  billingMonth: string;
  totalAmount: number;
  paymentStatus: string;
  dueDate: string;
}

export interface DormDetail {
  dorm: {
    dormId: string;
    dormName: string;
    ownerName: string;
    status: string;
  };
  rooms: DormDetailRoom[];
  tenants: DormDetailTenant[];
  staff: DormDetailStaff[];
  bills: DormDetailBill[];
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}
