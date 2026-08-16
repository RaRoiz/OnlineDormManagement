import { apiRequest } from "../types/api";

export interface User {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  dormName?: string;
  promptPayId?: string;
  lineBotUserId?: string;
  phone?: string;
  avatarUrl?: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  token?: string;
  user?: User;
}

const TOKEN_KEY = "dorm_access_token";
const USER_KEY = "dorm_current_user";

export async function login(
  username: string,
  password: string
): Promise<LoginResponse> {
  const result =
    await apiRequest<LoginResponse>({
      action: "login",
      username,
      password
    });

  if (
    result.success &&
    result.token &&
    result.user
  ) {
    sessionStorage.setItem(
      TOKEN_KEY,
      result.token
    );

    sessionStorage.setItem(
      USER_KEY,
      JSON.stringify(result.user)
    );
  }

  return result;
}

export function isLoggedIn(): boolean {
  return Boolean(
    sessionStorage.getItem(TOKEN_KEY) &&
    sessionStorage.getItem(USER_KEY)
  );
}

export function getCurrentUser(): User | null {
  const storedUser =
    sessionStorage.getItem(USER_KEY);

  if (!storedUser) {
    return null;
  }

  try {
    return JSON.parse(storedUser) as User;
  } catch {
    sessionStorage.removeItem(USER_KEY);
    return null;
  }
}

export function setCurrentUser(user: User): void {
  sessionStorage.setItem(
    USER_KEY,
    JSON.stringify(user)
  );
}

export function isOwner(): boolean {
  const user = getCurrentUser();

  return (
    String(user?.role ?? "")
      .trim()
      .toUpperCase() === "OWNER"
  );
}

/**
 * ชื่อบทบาทที่ใช้แสดงผลบนหน้าจอ
 * (ค่าในระบบยังเก็บเป็น USER เหมือนเดิม)
 */
export function roleLabel(
  role: string | undefined
): string {
  const value = String(role ?? "")
    .trim()
    .toUpperCase();

  if (value === "USER") {
    return "STAFF";
  }

  return value || "-";
}

export async function logout(): Promise<void> {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}

export interface ProfileResponse {
  success: boolean;
  message: string;
  user?: User;
}

export async function updateOwnProfile(
  fullName: string,
  phone: string
): Promise<ProfileResponse> {
  const result =
    await apiRequest<ProfileResponse>({
      action: "updateOwnProfile",
      token: getToken(),
      fullName,
      phone
    });

  if (result.success && result.user) {
    setCurrentUser(result.user);
  }

  return result;
}

export interface ChangePasswordResponse {
  success: boolean;
  message: string;
}

export async function changeOwnPassword(
  currentPassword: string,
  newPassword: string
): Promise<ChangePasswordResponse> {
  return apiRequest<ChangePasswordResponse>({
    action: "changeOwnPassword",
    token: getToken(),
    currentPassword,
    newPassword
  });
}

export async function uploadAvatar(
  fileName: string,
  mimeType: string,
  base64Data: string
): Promise<ProfileResponse> {
  const result =
    await apiRequest<ProfileResponse>({
      action: "uploadAvatar",
      token: getToken(),
      fileName,
      mimeType,
      base64Data
    });

  if (result.success && result.user) {
    setCurrentUser(result.user);
  }

  return result;
}

export async function updateOwnDorm(
  dormName: string,
  promptPayId: string,
  lineChannelAccessToken: string
): Promise<ProfileResponse> {
  const result =
    await apiRequest<ProfileResponse>({
      action: "updateOwnDorm",
      token: getToken(),
      dormName,
      promptPayId,
      lineChannelAccessToken
    });

  if (result.success && result.user) {
    setCurrentUser(result.user);
  }

  return result;
}