export type UserRole = "OWNER" | "ADMIN" | "STAFF";

export interface User {
  userId: string;
  username: string;
  fullName: string;
  role: UserRole;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

export interface ApiErrorResponse {
  success: false;
  message: string;
}