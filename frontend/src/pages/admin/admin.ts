import "./admin.css";
import "../../utils/theme";

import { renderSidebar } from "../../utils/sidebar";

import {
  requireSuperAdmin,
  setupLogoutButton
} from "../../utils/auth.guard";

import { showToast } from "../../utils/toast";
import { matchesKeyword } from "../../utils/search";

import {
  getTotalPages,
  paginate,
  renderPaginationControls
} from "../../utils/pagination";

import {
  createDorm,
  getDorms,
  getPlatformSummary
} from "../../services/dorm.service";

import type {
  CreateDormInput,
  Dorm,
  PlatformSummary
} from "../../types/dorm";

const PAGE_SIZE = 10;

let allDorms: Dorm[] = [];
let currentPage = 1;

const pageMessage =
  document.querySelector<HTMLElement>(
    "#page-message"
  );

const tableBody =
  document.querySelector<HTMLTableSectionElement>(
    "#dorm-table-body"
  );

const paginationContainer =
  document.querySelector<HTMLElement>(
    "#dorm-pagination"
  );

const searchInput =
  document.querySelector<HTMLInputElement>(
    "#search-input"
  );

const toggleCreateButton =
  document.querySelector<HTMLButtonElement>(
    "#toggle-create-dorm"
  );

const createDormSection =
  document.querySelector<HTMLElement>(
    "#create-dorm-section"
  );

const createDormForm =
  document.querySelector<HTMLFormElement>(
    "#create-dorm-form"
  );

const createDormMessage =
  document.querySelector<HTMLElement>(
    "#create-dorm-message"
  );

const cancelCreateButton =
  document.querySelector<HTMLButtonElement>(
    "#cancel-create-dorm"
  );

const submitCreateButton =
  document.querySelector<HTMLButtonElement>(
    "#submit-create-dorm"
  );

function escapeHtml(value: string): string {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function formatDate(value: string): string {
  if (!value) {
    return "-";
  }

  const text = value.slice(0, 10);
  const parts = text.split("-");

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function setText(
  selector: string,
  value: string
): void {
  const element =
    document.querySelector<HTMLElement>(selector);

  if (element) {
    element.textContent = value;
  }
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

function clearMessage(): void {
  if (!pageMessage) {
    return;
  }

  pageMessage.textContent = "";
  pageMessage.className = "page-message";
}

function showCreateMessage(
  message: string,
  type: "success" | "error"
): void {
  if (!createDormMessage) {
    return;
  }

  createDormMessage.textContent = message;
  createDormMessage.className = `page-message ${type}`;
}

/* =========================
   Summary
========================= */

function renderSummary(
  summary: PlatformSummary
): void {
  setText("#total-dorms", String(summary.totalDorms));
  setText("#active-dorms", String(summary.activeDorms));
  setText("#total-rooms", String(summary.totalRooms));
  setText("#total-tenants", String(summary.totalTenants));
  setText("#new-dorms", String(summary.newDormsThisMonth));
}

/* =========================
   Dorm table
========================= */

function statusModifierClass(status: string): string {
  return status.trim().toUpperCase() === "ACTIVE"
    ? "status-active"
    : "status-inactive";
}

function statusLabel(status: string): string {
  return status.trim().toUpperCase() === "ACTIVE"
    ? "ใช้งานอยู่"
    : "ปิดใช้งาน";
}

function getFilteredDorms(): Dorm[] {
  const keyword = searchInput?.value ?? "";

  return allDorms.filter(dorm =>
    matchesKeyword(dorm, keyword, item => [
      item.dormName,
      item.ownerName
    ])
  );
}

function renderDormTable(): void {
  if (!tableBody) {
    return;
  }

  const filteredDorms = getFilteredDorms();

  if (filteredDorms.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td class="empty-cell" colspan="9">
          ${
            allDorms.length === 0
              ? "ยังไม่มีหอในระบบ"
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

  const pageDorms = paginate(
    filteredDorms,
    currentPage,
    PAGE_SIZE
  );

  tableBody.innerHTML = pageDorms
    .map(dorm => `
      <tr>
        <td>${escapeHtml(dorm.dormName)}</td>
        <td>${escapeHtml(dorm.ownerName)}</td>
        <td>${dorm.roomCount.toLocaleString("th-TH")}</td>
        <td>${dorm.occupancyRate.toFixed(1)}%</td>
        <td>${dorm.activeTenants.toLocaleString("th-TH")}</td>
        <td>${formatMoney(dorm.unpaidAmount)}</td>
        <td>
          <span class="status-badge ${statusModifierClass(dorm.status)}">
            ${statusLabel(dorm.status)}
          </span>
        </td>
        <td>${formatDate(dorm.createdAt)}</td>
        <td>
          <a
            class="secondary-button"
            href="/src/pages/admin/dorm-detail.html?dormId=${encodeURIComponent(dorm.dormId)}"
          >
            ดูรายละเอียด
          </a>
        </td>
      </tr>
    `)
    .join("");

  if (paginationContainer) {
    renderPaginationControls(
      paginationContainer,
      currentPage,
      getTotalPages(
        filteredDorms.length,
        PAGE_SIZE
      ),
      page => {
        currentPage = page;
        renderDormTable();
      }
    );
  }
}

searchInput?.addEventListener("input", () => {
  currentPage = 1;
  renderDormTable();
});

/* =========================
   Load
========================= */

async function loadAll(): Promise<void> {
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td class="loading-cell" colspan="9">
          กำลังโหลดข้อมูล...
        </td>
      </tr>
    `;
  }

  try {
    clearMessage();

    const [summaryResult, dormsResult] =
      await Promise.all([
        getPlatformSummary(),
        getDorms()
      ]);

    if (!summaryResult.success || !summaryResult.data) {
      throw new Error(summaryResult.message);
    }

    if (!dormsResult.success || !dormsResult.data) {
      throw new Error(dormsResult.message);
    }

    renderSummary(summaryResult.data);
    allDorms = dormsResult.data;
    currentPage = 1;
    renderDormTable();
  } catch (error) {
    console.error("Admin page error:", error);

    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td class="empty-cell" colspan="9">
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

/* =========================
   Create dorm form
========================= */

function setCreateFormVisible(visible: boolean): void {
  if (!createDormSection) {
    return;
  }

  createDormSection.hidden = !visible;

  if (visible) {
    showCreateMessage("", "success");
    document
      .querySelector<HTMLInputElement>("#dorm-name")
      ?.focus();
  }
}

toggleCreateButton?.addEventListener("click", () => {
  const isHidden = createDormSection?.hidden ?? true;
  setCreateFormVisible(isHidden);
});

cancelCreateButton?.addEventListener("click", () => {
  createDormForm?.reset();
  setCreateFormVisible(false);
});

createDormForm?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    if (!createDormForm) {
      return;
    }

    const formData = new FormData(createDormForm);

    const input: CreateDormInput = {
      dormName: String(
        formData.get("dormName") || ""
      ).trim(),

      ownerName: String(
        formData.get("ownerName") || ""
      ).trim(),

      phone: String(
        formData.get("phone") || ""
      ).trim(),

      address: String(
        formData.get("address") || ""
      ).trim(),

      ownerUsername: String(
        formData.get("ownerUsername") || ""
      ).trim(),

      ownerPassword: String(
        formData.get("ownerPassword") || ""
      )
    };

    if (!input.dormName || !input.ownerName) {
      showCreateMessage(
        "กรุณากรอกชื่อหอและชื่อเจ้าของหอ",
        "error"
      );

      return;
    }

    if (input.ownerUsername.length < 4) {
      showCreateMessage(
        "ชื่อผู้ใช้ต้องมีอย่างน้อย 4 ตัวอักษร",
        "error"
      );

      return;
    }

    if (input.ownerPassword.length < 8) {
      showCreateMessage(
        "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
        "error"
      );

      return;
    }

    if (submitCreateButton) {
      submitCreateButton.disabled = true;
      submitCreateButton.textContent = "กำลังบันทึก...";
    }

    try {
      const result = await createDorm(input);

      if (!result.success) {
        throw new Error(result.message);
      }

      showToast(
        `เพิ่มหอ "${input.dormName}" สำเร็จ ` +
        `(ผู้ใช้: ${input.ownerUsername})`,
        "success"
      );

      createDormForm.reset();
      setCreateFormVisible(false);

      await loadAll();
    } catch (error) {
      showCreateMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถเพิ่มหอใหม่ได้",
        "error"
      );
    } finally {
      if (submitCreateButton) {
        submitCreateButton.disabled = false;
        submitCreateButton.textContent = "บันทึกหอใหม่";
      }
    }
  }
);

/* =========================
   Init
========================= */

async function initializeAdminPage(): Promise<void> {
  if (!requireSuperAdmin()) {
    return;
  }

  setupLogoutButton();
  renderSidebar();

  await loadAll();
}

void initializeAdminPage();
