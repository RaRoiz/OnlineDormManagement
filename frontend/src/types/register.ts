export type RegisterRole = "OWNER" | "USER";

export interface RegisterInput {
  username: string;
  fullName: string;
  password: string;
  role: RegisterRole;
  dormName?: string;
  dormId?: string;
}

export interface DormPublicInfo {
  dormName: string;
}

export interface RegisteredUser {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  active: boolean;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
}