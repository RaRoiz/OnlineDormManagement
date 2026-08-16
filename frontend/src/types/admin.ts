export type ManagedRole = "OWNER" | "USER";

export type UserRole = ManagedRole | "SUPER_ADMIN";

export interface ManagedUser {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
  active: boolean;
  phone: string;

  /** true = แถวนี้คือบัญชีที่กำลังล็อกอินอยู่ */
  isSelf: boolean;
}

export interface CreateUserInput {
  username: string;
  fullName: string;
  password: string;
  role: ManagedRole;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}
