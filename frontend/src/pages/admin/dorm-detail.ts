import "./admin.css";
import "../../utils/theme";

import { renderSidebar } from "../../utils/sidebar";

import {
  requireSuperAdmin,
  setupLogoutButton
} from "../../utils/auth.guard";

import { getDormDetail } from "../../services/dorm.service";
import { matchesKeyword } from "../../utils/search";

import {
  getTotalPages,
  paginate,
  renderPaginationControls
} from "../../utils/pagination";

import type {
  DormDetailBill,
  DormDetailRoom,
  DormDetailStaff,
  DormDetailTenant
} from "../../types/dorm";

const PAGE_SIZE = 10;

let allRooms: DormDetailRoom[] = [];
let allTenants: DormDetailTenant[] = [];
let allStaff: DormDetailStaff[] = [];
let allBills: DormDetailBill[] = [];

let roomsPage = 1;
let tenantsPage = 1;
let staffPage = 1;
let billsPage = 1;

const pageMessage =
  document.querySelector<HTMLElement>(
    "#page-message"
  );

const dormNameElement =
  document.querySelector<HTMLElement>(
    "#dorm-name"
  );

const dormOwnerElement =
  document.querySelector<HTMLElement>(
    "#dorm-owner"
  );

const dormStatusElement =
  document.querySelector<HTMLElement>(
    "#dorm-status"
  );

const roomsTableBody =
  document.querySelector<HTMLTableSectionElement>(
    "#rooms-table-body"
  );

const roomsSearchInput =
  document.querySelector<HTMLInputElement>(
    "#rooms-search"
  );

const roomsPagination =
  document.querySelector<HTMLElement>(
    "#rooms-pagination"
  );

const tenantsTableBody =
  document.querySelector<HTMLTableSectionElement>(
    "#tenants-table-body"
  );

const tenantsSearchInput =
  document.querySelector<HTMLInputElement>(
    "#tenants-search"
  );

const tenantsPagination =
  document.querySelector<HTMLElement>(
    "#tenants-pagination"
  );

const staffTableBody =
  document.querySelector<HTMLTableSectionElement>(
    "#staff-table-body"
  );

const staffSearchInput =
  document.querySelector<HTMLInputElement>(
    "#staff-search"
  );

const staffPagination =
  document.querySelector<HTMLElement>(
    "#staff-pagination"
  );

const billsTableBody =
  document.querySelector<HTMLTableSectionElement>(
    "#bills-table-body"
  );

const billsSearchInput =
  document.querySelector<HTMLInputElement>(
    "#bills-search"
  );

const billsPagination =
  document.querySelector<HTMLElement>(
    "#bills-pagination"
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

function showMessage(
  message: string,
  type: "success" | "error"
): void {
  if (!pageMessage) {
    return;
  }

  pageMessage.textContent = message;
  pageMessage.className = `page-message ${type}`;
}

function statusModifierClass(status: string): string {
  const value = status.trim().toUpperCase();

  if (value === "ACTIVE" || value === "ว่าง") {
    return value === "ว่าง"
      ? "status-vacant"
      : "status-active";
  }

  if (value === "ไม่ว่าง") {
    return "status-occupied";
  }

  if (value === "PAID" || value === "ชำระแล้ว") {
    return "status-paid";
  }

  if (value === "UNPAID" || value === "ยังไม่ชำระ") {
    return "status-unpaid";
  }

  if (value === "OVERDUE" || value === "เกินกำหนด") {
    return "status-overdue";
  }

  return "status-inactive";
}

/* =========================
   ห้องพัก
========================= */

function getFilteredRooms(): DormDetailRoom[] {
  const keyword = roomsSearchInput?.value ?? "";

  return allRooms.filter(room =>
    matchesKeyword(room, keyword, item => [
      item.roomNo,
      item.roomType
    ])
  );
}

function renderRooms(): void {
  if (!roomsTableBody) {
    return;
  }

  const filtered = getFilteredRooms();

  if (filtered.length === 0) {
    roomsTableBody.innerHTML = `
      <tr><td class="empty-cell" colspan="5">
        ${
          allRooms.length === 0
            ? "ยังไม่มีห้องพัก"
            : "ไม่พบข้อมูลที่ค้นหา"
        }
      </td></tr>
    `;

    if (roomsPagination) {
      roomsPagination.innerHTML = "";
    }

    return;
  }

  const pageItems = paginate(
    filtered,
    roomsPage,
    PAGE_SIZE
  );

  roomsTableBody.innerHTML = pageItems
    .map(room => `
      <tr>
        <td>${escapeHtml(room.roomNo)}</td>
        <td>${escapeHtml(room.roomType)}</td>
        <td>${formatMoney(room.price)}</td>
        <td>${room.floor}</td>
        <td>
          <span class="status-badge ${statusModifierClass(room.status)}">
            ${escapeHtml(room.status)}
          </span>
        </td>
      </tr>
    `)
    .join("");

  if (roomsPagination) {
    renderPaginationControls(
      roomsPagination,
      roomsPage,
      getTotalPages(filtered.length, PAGE_SIZE),
      page => {
        roomsPage = page;
        renderRooms();
      }
    );
  }
}

roomsSearchInput?.addEventListener("input", () => {
  roomsPage = 1;
  renderRooms();
});

/* =========================
   ผู้เช่า
========================= */

function getFilteredTenants(): DormDetailTenant[] {
  const keyword = tenantsSearchInput?.value ?? "";

  return allTenants.filter(tenant =>
    matchesKeyword(tenant, keyword, item => [
      item.fullName,
      item.roomNo
    ])
  );
}

function renderTenants(): void {
  if (!tenantsTableBody) {
    return;
  }

  const filtered = getFilteredTenants();

  if (filtered.length === 0) {
    tenantsTableBody.innerHTML = `
      <tr><td class="empty-cell" colspan="4">
        ${
          allTenants.length === 0
            ? "ยังไม่มีผู้เช่า"
            : "ไม่พบข้อมูลที่ค้นหา"
        }
      </td></tr>
    `;

    if (tenantsPagination) {
      tenantsPagination.innerHTML = "";
    }

    return;
  }

  const pageItems = paginate(
    filtered,
    tenantsPage,
    PAGE_SIZE
  );

  tenantsTableBody.innerHTML = pageItems
    .map(tenant => `
      <tr>
        <td>${escapeHtml(tenant.fullName)}</td>
        <td>${
          tenant.roomNo
            ? escapeHtml(tenant.roomNo)
            : "-"
        }</td>
        <td>
          <span class="status-badge ${statusModifierClass(tenant.status)}">
            ${escapeHtml(tenant.status)}
          </span>
        </td>
        <td>${
          tenant.checkInDate
            ? escapeHtml(
                tenant.checkInDate.slice(0, 10)
              )
            : "-"
        }</td>
      </tr>
    `)
    .join("");

  if (tenantsPagination) {
    renderPaginationControls(
      tenantsPagination,
      tenantsPage,
      getTotalPages(filtered.length, PAGE_SIZE),
      page => {
        tenantsPage = page;
        renderTenants();
      }
    );
  }
}

tenantsSearchInput?.addEventListener(
  "input",
  () => {
    tenantsPage = 1;
    renderTenants();
  }
);

/* =========================
   พนักงาน + เจ้าของ
========================= */

function getFilteredStaff(): DormDetailStaff[] {
  const keyword = staffSearchInput?.value ?? "";

  return allStaff.filter(member =>
    matchesKeyword(member, keyword, item => [
      item.fullName,
      item.username
    ])
  );
}

function renderStaff(): void {
  if (!staffTableBody) {
    return;
  }

  const filtered = getFilteredStaff();

  if (filtered.length === 0) {
    staffTableBody.innerHTML = `
      <tr><td class="empty-cell" colspan="4">
        ${
          allStaff.length === 0
            ? "ไม่พบข้อมูล"
            : "ไม่พบข้อมูลที่ค้นหา"
        }
      </td></tr>
    `;

    if (staffPagination) {
      staffPagination.innerHTML = "";
    }

    return;
  }

  const pageItems = paginate(
    filtered,
    staffPage,
    PAGE_SIZE
  );

  staffTableBody.innerHTML = pageItems
    .map(member => `
      <tr>
        <td>${escapeHtml(member.fullName)}</td>
        <td>${escapeHtml(member.username)}</td>
        <td>${
          member.role === "OWNER"
            ? "เจ้าของหอ"
            : "พนักงาน"
        }</td>
        <td>
          <span class="status-badge ${
            member.active
              ? "status-active"
              : "status-inactive"
          }">
            ${
              member.active
                ? "ใช้งานอยู่"
                : "ปิดใช้งาน"
            }
          </span>
        </td>
      </tr>
    `)
    .join("");

  if (staffPagination) {
    renderPaginationControls(
      staffPagination,
      staffPage,
      getTotalPages(filtered.length, PAGE_SIZE),
      page => {
        staffPage = page;
        renderStaff();
      }
    );
  }
}

staffSearchInput?.addEventListener("input", () => {
  staffPage = 1;
  renderStaff();
});

/* =========================
   บิล
========================= */

function formatMonth(value: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return value || "-";
  }

  const [year, month] = value.split("-");
  return `${month}/${year}`;
}

function getFilteredBills(): DormDetailBill[] {
  const keyword = billsSearchInput?.value ?? "";

  return allBills.filter(bill =>
    matchesKeyword(bill, keyword, item => [
      item.billNo,
      item.roomNo,
      item.tenantName
    ])
  );
}

function renderBills(): void {
  if (!billsTableBody) {
    return;
  }

  const filtered = getFilteredBills();

  if (filtered.length === 0) {
    billsTableBody.innerHTML = `
      <tr><td class="empty-cell" colspan="7">
        ${
          allBills.length === 0
            ? "ยังไม่มีบิล"
            : "ไม่พบข้อมูลที่ค้นหา"
        }
      </td></tr>
    `;

    if (billsPagination) {
      billsPagination.innerHTML = "";
    }

    return;
  }

  const pageItems = paginate(
    filtered,
    billsPage,
    PAGE_SIZE
  );

  billsTableBody.innerHTML = pageItems
    .map(bill => `
      <tr>
        <td>${escapeHtml(bill.billNo)}</td>
        <td>${escapeHtml(bill.roomNo)}</td>
        <td>${escapeHtml(bill.tenantName)}</td>
        <td>${formatMonth(bill.billingMonth)}</td>
        <td>${formatMoney(bill.totalAmount)}</td>
        <td>
          <span class="status-badge ${statusModifierClass(bill.paymentStatus)}">
            ${escapeHtml(bill.paymentStatus)}
          </span>
        </td>
        <td>${
          bill.dueDate
            ? escapeHtml(bill.dueDate.slice(0, 10))
            : "-"
        }</td>
      </tr>
    `)
    .join("");

  if (billsPagination) {
    renderPaginationControls(
      billsPagination,
      billsPage,
      getTotalPages(filtered.length, PAGE_SIZE),
      page => {
        billsPage = page;
        renderBills();
      }
    );
  }
}

billsSearchInput?.addEventListener("input", () => {
  billsPage = 1;
  renderBills();
});

/* =========================
   Load
========================= */

async function loadDormDetail(): Promise<void> {
  const params = new URLSearchParams(
    window.location.search
  );

  const dormId = params.get("dormId") ?? "";

  if (!dormId) {
    showMessage("ไม่พบรหัสหอที่ต้องการดู", "error");
    return;
  }

  try {
    const result = await getDormDetail(dormId);

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    const detail = result.data;

    if (dormNameElement) {
      dormNameElement.textContent =
        detail.dorm.dormName;
    }

    if (dormOwnerElement) {
      dormOwnerElement.textContent =
        detail.dorm.ownerName || "-";
    }

    if (dormStatusElement) {
      dormStatusElement.textContent =
        detail.dorm.status === "ACTIVE"
          ? "ใช้งานอยู่"
          : detail.dorm.status;

      dormStatusElement.className = `status-badge ${
        detail.dorm.status === "ACTIVE"
          ? "status-active"
          : "status-inactive"
      }`;
    }

    allRooms = detail.rooms;
    allTenants = detail.tenants;
    allStaff = detail.staff;
    allBills = detail.bills;

    roomsPage = 1;
    tenantsPage = 1;
    staffPage = 1;
    billsPage = 1;

    renderRooms();
    renderTenants();
    renderStaff();
    renderBills();
  } catch (error) {
    showMessage(
      error instanceof Error
        ? error.message
        : "ไม่สามารถโหลดข้อมูลได้",
      "error"
    );
  }
}

async function initializeDormDetailPage(): Promise<void> {
  if (!requireSuperAdmin()) {
    return;
  }

  setupLogoutButton();
  renderSidebar();

  await loadDormDetail();
}

void initializeDormDetailPage();
