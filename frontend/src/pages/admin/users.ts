import "./users.css";
import "../../utils/theme";

import { renderSidebar } from "../../utils/sidebar";

import {
  requireSuperAdmin,
  setupLogoutButton
} from "../../utils/auth.guard";

import { showToast } from "../../utils/toast";
import { matchesKeyword } from "../../utils/search";
import { roleLabel } from "../../services/auth.service";

import {
  confirmDialog,
  promptDialog
} from "../../utils/dialog";

import {
  createManagedUser,
  getUsers,
  resetUserPassword,
  setUserActive
} from "../../services/admin.service";

import {
  getTotalPages,
  paginate,
  renderPaginationControls
} from "../../utils/pagination";

import type {
  ManagedRole,
  ManagedUser
} from "../../types/admin";

const PAGE_SIZE = 10;

let allUsers: ManagedUser[] = [];
let currentPage = 1;

const totalUsersElement =
  document.querySelector<HTMLElement>(
    "#total-users"
  );

const tableBody =
  document.querySelector<HTMLTableSectionElement>(
    "#users-table-body"
  );

const paginationContainer =
  document.querySelector<HTMLElement>(
    "#users-pagination"
  );

const searchInput =
  document.querySelector<HTMLInputElement>(
    "#search-input"
  );

const pageMessage =
  document.querySelector<HTMLElement>(
    "#page-message"
  );

const createForm =
  document.querySelector<HTMLFormElement>(
    "#create-user-form"
  );

const createButton =
  document.querySelector<HTMLButtonElement>(
    "#create-user-button"
  );

const fullNameInput =
  document.querySelector<HTMLInputElement>(
    "#new-full-name"
  );

const usernameInput =
  document.querySelector<HTMLInputElement>(
    "#new-username"
  );

const passwordInput =
  document.querySelector<HTMLInputElement>(
    "#new-password"
  );

const roleSelect =
  document.querySelector<HTMLSelectElement>(
    "#new-role"
  );

function escapeHtml(value: string): string {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function showMessage(
  message: string,
  type: "success" | "error"
): void {
  showToast(message, type);

  if (!pageMessage) {
    return;
  }

  pageMessage.textContent = message;
  pageMessage.className = `page-message ${type}`;
}

function roleBadgeClass(role: string): string {
  if (role === "SUPER_ADMIN") {
    return "role-super-admin";
  }

  if (role === "OWNER") {
    return "role-owner";
  }

  return "role-user";
}

function getFilteredUsers(): ManagedUser[] {
  const keyword = searchInput?.value ?? "";

  return allUsers.filter(user =>
    matchesKeyword(user, keyword, item => [
      item.fullName,
      item.username,
      item.role,
      roleLabel(item.role)
    ])
  );
}

function renderUsersTable(): void {
  if (totalUsersElement) {
    totalUsersElement.textContent = String(
      allUsers.length
    );
  }

  if (!tableBody) {
    return;
  }

  const filteredUsers = getFilteredUsers();

  if (filteredUsers.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td class="empty-cell" colspan="5">
          ${
            allUsers.length === 0
              ? "ยังไม่มีบัญชีในระบบ"
              : "ไม่พบข้อมูลที่ค้นหา"
          }
        </td>
      </tr>
    `;

    if (paginationContainer) {
      paginationContainer.innerHTML = "";
    }

    return;
  }

  const pageUsers = paginate(
    filteredUsers,
    currentPage,
    PAGE_SIZE
  );

  tableBody.innerHTML = pageUsers
    .map(user => `
      <tr>
        <td>
          ${escapeHtml(user.fullName)}
          ${
            user.isSelf
              ? `<span class="self-tag">(คุณ)</span>`
              : ""
          }
        </td>

        <td>${escapeHtml(user.username)}</td>

        <td>
          <span class="role-badge ${roleBadgeClass(user.role)}">
            ${escapeHtml(roleLabel(user.role))}
          </span>
        </td>

        <td>
          <span class="status-badge ${
            user.active
              ? "status-active"
              : "status-inactive"
          }">
            ${
              user.active
                ? "เปิดใช้งาน"
                : "ปิดใช้งาน"
            }
          </span>
        </td>

        <td>
          <div class="row-actions">
            <button
              type="button"
              data-action="reset"
              data-user-id="${escapeHtml(user.userId)}"
            >
              ตั้งรหัสผ่านใหม่
            </button>

            <button
              type="button"
              class="${user.active ? "danger" : ""}"
              data-action="toggle"
              data-user-id="${escapeHtml(user.userId)}"
              ${user.isSelf && user.active ? "disabled" : ""}
            >
              ${user.active ? "ปิดใช้งาน" : "เปิดใช้งาน"}
            </button>
          </div>
        </td>
      </tr>
    `)
    .join("");

  if (paginationContainer) {
    renderPaginationControls(
      paginationContainer,
      currentPage,
      getTotalPages(
        filteredUsers.length,
        PAGE_SIZE
      ),
      page => {
        currentPage = page;
        renderUsersTable();
      }
    );
  }
}

async function handleToggleActive(
  user: ManagedUser
): Promise<void> {
  const nextActive = !user.active;

  const confirmed = await confirmDialog({
    title: nextActive
      ? "เปิดใช้งานบัญชี"
      : "ปิดใช้งานบัญชี",

    message: nextActive
      ? `เปิดใช้งานบัญชี "${user.username}" ให้เข้าสู่ระบบได้อีกครั้ง?`
      : `ปิดใช้งานบัญชี "${user.username}" ผู้ใช้จะเข้าสู่ระบบไม่ได้`,

    confirmText: nextActive ? "เปิดใช้งาน" : "ปิดใช้งาน"
  });

  if (!confirmed) {
    return;
  }

  try {
    const result = await setUserActive(
      user.userId,
      nextActive
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    showMessage(result.message, "success");
    await loadUsers();
  } catch (error) {
    showMessage(
      error instanceof Error
        ? error.message
        : "ไม่สามารถเปลี่ยนสถานะบัญชีได้",
      "error"
    );
  }
}

async function handleResetPassword(
  user: ManagedUser
): Promise<void> {
  const newPassword = await promptDialog({
    title: "ตั้งรหัสผ่านใหม่",
    message: `ตั้งรหัสผ่านใหม่ให้บัญชี "${user.username}"`,
    label: "รหัสผ่านใหม่ (อย่างน้อย 8 ตัวอักษร)",
    inputType: "password",
    confirmText: "บันทึก"
  });

  if (!newPassword) {
    return;
  }

  if (newPassword.length < 8) {
    showMessage(
      "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร",
      "error"
    );

    return;
  }

  try {
    const result = await resetUserPassword(
      user.userId,
      newPassword
    );

    if (!result.success) {
      throw new Error(result.message);
    }

    showMessage(result.message, "success");
  } catch (error) {
    showMessage(
      error instanceof Error
        ? error.message
        : "ไม่สามารถตั้งรหัสผ่านใหม่ได้",
      "error"
    );
  }
}

tableBody?.addEventListener("click", event => {
  const button = (event.target as HTMLElement)
    .closest<HTMLButtonElement>("button[data-action]");

  if (!button) {
    return;
  }

  const user = allUsers.find(
    item => item.userId === button.dataset.userId
  );

  if (!user) {
    return;
  }

  if (button.dataset.action === "toggle") {
    void handleToggleActive(user);
    return;
  }

  if (button.dataset.action === "reset") {
    void handleResetPassword(user);
  }
});

searchInput?.addEventListener("input", () => {
  currentPage = 1;
  renderUsersTable();
});

createForm?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const fullName =
      fullNameInput?.value.trim() ?? "";

    const username =
      usernameInput?.value.trim() ?? "";

    const password = passwordInput?.value ?? "";

    const role = (roleSelect?.value ??
      "USER") as ManagedRole;

    if (!fullName) {
      showMessage("กรุณากรอกชื่อ-นามสกุล", "error");
      fullNameInput?.focus();
      return;
    }

    if (username.length < 4) {
      showMessage(
        "ชื่อผู้ใช้ต้องมีอย่างน้อย 4 ตัวอักษร",
        "error"
      );

      usernameInput?.focus();
      return;
    }

    if (password.length < 8) {
      showMessage(
        "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
        "error"
      );

      passwordInput?.focus();
      return;
    }

    if (createButton) {
      createButton.disabled = true;
      createButton.textContent = "กำลังสร้าง...";
    }

    try {
      const result = await createManagedUser({
        fullName,
        username,
        password,
        role
      });

      if (!result.success) {
        throw new Error(result.message);
      }

      showMessage(result.message, "success");
      createForm.reset();

      await loadUsers();
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถสร้างบัญชีได้",
        "error"
      );
    } finally {
      if (createButton) {
        createButton.disabled = false;
        createButton.textContent = "สร้างบัญชี";
      }
    }
  }
);

async function loadUsers(): Promise<void> {
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td class="loading-cell" colspan="5">
          กำลังโหลดข้อมูล...
        </td>
      </tr>
    `;
  }

  try {
    const result = await getUsers();

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    allUsers = result.data;
    renderUsersTable();
  } catch (error) {
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td class="empty-cell" colspan="5">
            ไม่สามารถโหลดข้อมูลได้
          </td>
        </tr>
      `;
    }

    showMessage(
      error instanceof Error
        ? error.message
        : "ไม่สามารถโหลดข้อมูลได้",
      "error"
    );
  }
}

async function initializeUsersPage(): Promise<void> {
  if (!requireSuperAdmin()) {
    return;
  }

  setupLogoutButton();
  renderSidebar();

  await loadUsers();
}

void initializeUsersPage();
