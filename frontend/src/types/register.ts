/* ระบบหอเดียว: สมัครผ่านหน้าเว็บได้เฉพาะพนักงาน */
export type RegisterRole = "USER";

export interface RegisterInput {
  username: string;
  fullName: string;
  password: string;
  role: RegisterRole;

  /** รหัสเชิญที่เจ้าของหอออกให้ (มาจาก ?code= บน URL) */
  signupCode: string;
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