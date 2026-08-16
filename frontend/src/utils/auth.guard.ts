import {
  getCurrentUser,
  isLoggedIn,
  isOwner,
  isSuperAdmin,
  logout,
  roleLabel
} from "../services/auth.service";

import { renderAvatar } from "./avatar";
import { attachDropdown } from "./dropdown";

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
 * สำหรับหน้าที่ใช้ได้เฉพาะผู้ดูแลระบบ (SUPER_ADMIN)
 * เช่น หน้าจัดการบัญชีผู้ใช้
 */
export function requireSuperAdmin(): boolean {
  if (!requireLogin()) {
    return false;
  }

  if (!isSuperAdmin()) {
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

  parent.insertBefore(area, logoutButton);

  const avatar = document.createElement("div");
  renderAvatar(avatar, user);

  const info = document.createElement("div");
  info.className = "header-user-info";

  const name = document.createElement("strong");
  name.textContent =
    user.fullName || user.username;

  const role = document.createElement("small");
  role.textContent = roleLabel(user.role);

  info.append(name, role);

  const trigger =
    document.createElement("button");

  trigger.type = "button";
  trigger.className = "header-profile-trigger";
  trigger.append(avatar, info);

  const menu = document.createElement("div");
  menu.className = "header-dropdown-menu";
  menu.hidden = true;

  // ทุก role แก้ไขโปรไฟล์ของตัวเองได้
  const profileLink =
    document.createElement("a");

  profileLink.className = "header-dropdown-item";
  profileLink.href =
    "/src/pages/profile/profile.html";
  profileLink.textContent = "โปรไฟล์ของฉัน";

  menu.append(profileLink);

  logoutButton.classList.add(
    "header-dropdown-item"
  );

  menu.append(logoutButton);

  area.append(trigger, menu);
  attachDropdown(trigger, menu);
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