import "./staff.css";
import "../../utils/theme";

import { renderSidebar } from "../../utils/sidebar";

import {
  requireOwner,
  setupLogoutButton
} from "../../utils/auth.guard";

import { showToast } from "../../utils/toast";
import { getStaff } from "../../services/staff.service";
import { matchesKeyword } from "../../utils/search";

import {
  getTotalPages,
  paginate,
  renderPaginationControls
} from "../../utils/pagination";

import type { StaffMember } from "../../types/staff";
import { escapeHtml } from "../../utils/html";

const PAGE_SIZE = 10;

let allStaff: StaffMember[] = [];
let currentPage = 1;

const totalStaffElement =
  document.querySelector<HTMLElement>(
    "#total-staff"
  );

const tableBody =
  document.querySelector<HTMLTableSectionElement>(
    "#staff-table-body"
  );

const paginationContainer =
  document.querySelector<HTMLElement>(
    "#staff-pagination"
  );

const searchInput =
  document.querySelector<HTMLInputElement>(
    "#search-input"
  );

const pageMessage =
  document.querySelector<HTMLElement>(
    "#page-message"
  );

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

function getFilteredStaff(): StaffMember[] {
  const keyword = searchInput?.value ?? "";

  return allStaff.filter(member =>
    matchesKeyword(member, keyword, item => [
      item.fullName,
      item.username,
      item.phone
    ])
  );
}

function renderStaffTable(): void {
  if (totalStaffElement) {
    totalStaffElement.textContent = String(
      allStaff.length
    );
  }

  if (!tableBody) {
    return;
  }

  const filteredStaff = getFilteredStaff();

  if (filteredStaff.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td class="empty-cell" colspan="4">
          ${
            allStaff.length === 0
              ? "ยังไม่มีพนักงานในหอนี้"
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

  const pageStaff = paginate(
    filteredStaff,
    currentPage,
    PAGE_SIZE
  );

  tableBody.innerHTML = pageStaff
    .map(member => `
      <tr>
        <td>${escapeHtml(member.fullName)}</td>
        <td>${escapeHtml(member.username)}</td>
        <td>${
          member.phone
            ? escapeHtml(member.phone)
            : "-"
        }</td>
        <td>
          <span class="status-badge ${
            member.active
              ? "status-active"
              : "status-inactive"
          }">
            ${
              member.active
                ? "เปิดใช้งาน"
                : "ปิดใช้งาน"
            }
          </span>
        </td>
      </tr>
    `)
    .join("");

  if (paginationContainer) {
    renderPaginationControls(
      paginationContainer,
      currentPage,
      getTotalPages(
        filteredStaff.length,
        PAGE_SIZE
      ),
      page => {
        currentPage = page;
        renderStaffTable();
      }
    );
  }
}

searchInput?.addEventListener("input", () => {
  currentPage = 1;
  renderStaffTable();
});

async function loadStaff(): Promise<void> {
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td class="loading-cell" colspan="4">
          กำลังโหลดข้อมูล...
        </td>
      </tr>
    `;
  }

  try {
    const result = await getStaff();

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    allStaff = result.data;
    currentPage = 1;
    renderStaffTable();
  } catch (error) {
    if (tableBody) {
      tableBody.innerHTML = `
        <tr>
          <td class="empty-cell" colspan="4">
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

async function initializeStaffPage(): Promise<void> {
  if (!requireOwner()) {
    return;
  }

  setupLogoutButton();
  renderSidebar();

  await loadStaff();
}

void initializeStaffPage();
