import {
  getCurrentUser,
  isLoggedIn,
  isOwner,
  logout,
  roleLabel
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

/**
 * สำหรับหน้าที่ใช้ได้เฉพาะเจ้าของระบบ (OWNER)
 * เช่น หน้า Dashboard / Report
 */
export function requireOwner(): boolean {
  if (!requireLogin()) {
    return false;
  }

  if (!isOwner()) {
    window.location.replace("/index.html");
    return false;
  }

  return true;
}

/**
 * แสดงชื่อผู้ใช้และบทบาทข้างปุ่มออกจากระบบ
 * เพื่อให้รู้ว่ากำลังล็อกอินเป็นบัญชีไหนอยู่ (ทุกหน้า)
 */
function renderHeaderUserInfo(
  logoutButton: HTMLButtonElement
): void {
  const user = getCurrentUser();
  const parent = logoutButton.parentElement;

  if (!user || !parent) {
    return;
  }

  const area = document.createElement("div");
  area.className = "header-user-area";

  const info = document.createElement("div");
  info.className = "header-user-info";

  const name = document.createElement("strong");
  name.textContent =
    user.fullName || user.username;

  const role = document.createElement("small");
  role.textContent = roleLabel(user.role);

  info.append(name, role);

  parent.insertBefore(area, logoutButton);
  area.append(info, logoutButton);
}

export function setupLogoutButton(): void {
  // ติด class บอกบทบาทที่ body —
  // CSS ใช้ซ่อนปุ่มที่ USER ไม่มีสิทธิ์ (เช่น ปุ่มลบ)
  document.body.classList.toggle(
    "role-user",
    !isOwner()
  );

  const logoutButton =
    document.querySelector<HTMLButtonElement>(
      "#logout-button"
    );

  if (logoutButton) {
    renderHeaderUserInfo(logoutButton);
  }

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