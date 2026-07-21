import { apiRequest } from "../types/api";

export interface User {
  userId: string;
  username: string;
  fullName: string;
  role: string;
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

export async function logout(): Promise<void> {
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(USER_KEY);
}

export function getToken(): string | null {
  return sessionStorage.getItem(TOKEN_KEY);
}