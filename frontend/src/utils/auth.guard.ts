import {
  isLoggedIn,
  logout
} from "../services/auth.service";

const RETURN_URL_KEY = "dorm_return_url";

export function requireLogin(): boolean {
  if (isLoggedIn()) {
    return true;
  }

  const currentPath =
    window.location.pathname +
    window.location.search;

  sessionStorage.setItem(
    RETURN_URL_KEY,
    currentPath
  );

  const loginUrl =
    `/login.html?redirect=${encodeURIComponent(
      currentPath
    )}`;

  window.location.replace(loginUrl);

  return false;
}

export function setupLogoutButton(): void {
  const logoutButton =
    document.querySelector<HTMLButtonElement>(
      "#logout-button"
    );

  logoutButton?.addEventListener(
    "click",
    async () => {
      logoutButton.disabled = true;
      logoutButton.textContent =
        "กำลังออกจากระบบ...";

      try {
        await logout();
      } catch (error) {
        console.error("Logout error:", error);
      } finally {
        window.location.replace("/index.html");
      }
    }
  );
}