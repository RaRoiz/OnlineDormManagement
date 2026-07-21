export interface RegisterInput {
  username: string;
  fullName: string;
  password: string;
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