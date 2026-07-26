export interface StaffMember {
  userId: string;
  fullName: string;
  username: string;
  phone: string;
  active: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}
