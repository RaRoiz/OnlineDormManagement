import "./report.css";
import "../../utils/theme";

import { renderSidebar } from "../../utils/sidebar";

import {
  requireOwner,
  setupLogoutButton
} from "../../utils/auth.guard";

import { showToast } from "../../utils/toast";

import {
  getDashboardSummary,
  getReport
} from "../../services/report.service";

import {
  getRooms
} from "../../services/room.service";

import {
  paginate,
  getTotalPages,
  renderPaginationControls
} from "../../utils/pagination";

import type {
  DashboardSummary,
  DebtorItem,
  ReportCellValue,
  ReportColumn,
  ReportData,
  ReportFilter,
  ReportType
} from "../../types/report";

import type {
  Room
} from "../../types/room";
import { escapeHtml } from "../../utils/html";

const PAGE_SIZE = 10;

const dashboardMonthInput =
  document.querySelector<HTMLInputElement>(
    "#dashboard-month"
  );

const reportTypeInput =
  document.querySelector<HTMLSelectElement>(
    "#report-type"
  );

const reportMonthInput =
  document.querySelector<HTMLInputElement>(
    "#report-month"
  );

const roomFilterInput =
  document.querySelector<HTMLSelectElement>(
    "#room-filter"
  );

const statusFilterInput =
  document.querySelector<HTMLSelectElement>(
    "#status-filter"
  );

const keywordInput =
  document.querySelector<HTMLInputElement>(
    "#keyword-filter"
  );

const searchButton =
  document.querySelector<HTMLButtonElement>(
    "#search-report-button"
  );

const clearButton =
  document.querySelector<HTMLButtonElement>(
    "#clear-filter-button"
  );

const tableHead =
  document.querySelector<HTMLTableSectionElement>(
    "#report-table-head"
  );

const tableBody =
  document.querySelector<HTMLTableSectionElement>(
    "#report-table-body"
  );

const pageMessage =
  document.querySelector<HTMLElement>(
    "#page-message"
  );

const paginationContainer =
  document.querySelector<HTMLElement>(
    "#report-pagination"
  );

let rooms: Room[] = [];
let currentPage = 1;

function currentMonth(): string {
  const date = new Date();

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0")
  ].join("-");
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function formatMonth(value: string): string {
  if (
    !/^\d{4}-\d{2}$/.test(value)
  ) {
    return value || "-";
  }

  const [year, month] =
    value.split("-");

  return `${month}/${year}`;
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

function formatDateTime(
  value: string
): string {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat("th-TH", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

/**
 * ตารางผู้เช่าที่ค้างชำระ — ซ่อนทั้งส่วนถ้าไม่มีใครค้าง
 */
function renderDebtors(
  debtors: DebtorItem[]
): void {
  const section =
    document.querySelector<HTMLElement>(
      "#debtors-section"
    );

  const tableBody =
    document.querySelector<HTMLTableSectionElement>(
      "#debtors-table-body"
    );

  if (!section || !tableBody) {
    return;
  }

  if (debtors.length === 0) {
    section.hidden = true;
    tableBody.innerHTML = "";
    return;
  }

  section.hidden = false;

  tableBody.innerHTML = debtors
    .map(debtor => `
      <tr>
        <td>${escapeHtml(debtor.roomNo || "-")}</td>

        <td>${escapeHtml(
          debtor.tenantName || "-"
        )}</td>

        <td>${debtor.count} บิล</td>

        <td>${escapeHtml(
          debtor.oldestMonth || "-"
        )}</td>

        <td>
          <strong class="arrears-amount">
            ${formatMoney(debtor.amount)}
          </strong>
        </td>
      </tr>
    `)
    .join("");
}

function setText(
  selector: string,
  value: string
): void {
  const element =
    document.querySelector<HTMLElement>(
      selector
    );

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
  pageMessage.className =
    `page-message ${type}`;
}

function clearMessage(): void {
  if (!pageMessage) {
    return;
  }

  pageMessage.textContent = "";
  pageMessage.className = "page-message";
}

function renderDashboard(
  summary: DashboardSummary
): void {
  setText(
    "#total-rooms",
    String(summary.totalRooms)
  );

  setText(
    "#vacant-rooms",
    String(summary.vacantRooms)
  );

  setText(
    "#occupied-rooms",
    String(summary.occupiedRooms)
  );

  setText(
    "#occupancy-rate",
    `อัตราเข้าพัก ${summary.occupancyRate.toFixed(1)}%`
  );

  setText(
    "#active-tenants",
    String(summary.activeTenants)
  );

  setText(
    "#unpaid-bills",
    String(summary.unpaidBills)
  );

  setText(
    "#overdue-bills",
    `เกินกำหนด ${summary.overdueBills} บิล`
  );

  setText(
    "#outstanding-amount",
    formatMoney(summary.outstandingAmount)
  );

  setText(
    "#arrears-amount",
    formatMoney(summary.arrearsAmount ?? 0)
  );

  setText(
    "#arrears-detail",
    summary.pendingBills
      ? `${summary.arrearsBills ?? 0} บิล · รอตรวจสอบอีก ` +
        `${formatMoney(summary.pendingAmount ?? 0)}`
      : `${summary.arrearsBills ?? 0} บิล`
  );

  renderDebtors(summary.topDebtors ?? []);

  setText(
    "#paid-amount",
    formatMoney(summary.paidAmount)
  );

  setText(
    "#utility-amount",
    formatMoney(
      summary.waterAmount +
      summary.electricAmount
    )
  );

  setText(
    "#utility-detail",
    `น้ำ ${formatMoney(summary.waterAmount)} · ไฟ ${formatMoney(summary.electricAmount)}`
  );
}

async function loadDashboard(): Promise<void> {
  const billingMonth =
    dashboardMonthInput?.value ||
    currentMonth();

  const result =
    await getDashboardSummary(
      billingMonth
    );

  if (!result.success || !result.data) {
    throw new Error(result.message);
  }

  renderDashboard(result.data);
}

function populateRoomOptions(): void {
  if (!roomFilterInput) {
    return;
  }

  roomFilterInput.innerHTML = `
    <option value="">
      ทุกห้อง
    </option>

    ${rooms
      .map(room => `
        <option
          value="${escapeHtml(room.roomId)}"
        >
          ห้อง ${escapeHtml(room.roomNo)}
        </option>
      `)
      .join("")}
  `;
}

function updateStatusOptions(): void {
  if (
    !reportTypeInput ||
    !statusFilterInput
  ) {
    return;
  }

  const reportType =
    reportTypeInput.value as ReportType;

  const optionMap: Record<
    ReportType,
    Array<{
      value: string;
      label: string;
    }>
  > = {
    ROOM: [
      {
        value: "",
        label: "ทุกสถานะ"
      },
      {
        value: "VACANT",
        label: "ว่าง"
      },
      {
        value: "OCCUPIED",
        label: "ไม่ว่าง"
      }
    ],

    TENANT: [
      {
        value: "",
        label: "ทุกสถานะ"
      },
      {
        value: "ACTIVE",
        label: "กำลังพัก"
      },
      {
        value: "INACTIVE",
        label: "ย้ายออกแล้ว"
      }
    ],

    UTILITY: [
      {
        value: "",
        label: "ทุกสถานะ"
      }
    ],

    BILL: [
      {
        value: "",
        label: "ทุกสถานะ"
      },
      {
        value: "UNPAID",
        label: "ยังไม่ชำระ"
      },
      {
        value: "PAID",
        label: "ชำระแล้ว"
      },
      {
        value: "OVERDUE",
        label: "เกินกำหนด"
      }
    ]
  };

  statusFilterInput.innerHTML =
    optionMap[reportType]
      .map(option => `
        <option value="${option.value}">
          ${option.label}
        </option>
      `)
      .join("");

  if (reportMonthInput) {
    reportMonthInput.disabled =
      reportType === "ROOM" ||
      reportType === "TENANT";
  }
}

function readFilter(): ReportFilter {
  return {
    reportType:
      (reportTypeInput?.value ||
        "ROOM") as ReportType,

    billingMonth:
      reportMonthInput &&
      !reportMonthInput.disabled
        ? reportMonthInput.value
        : "",

    roomId:
      roomFilterInput?.value ?? "",

    status:
      statusFilterInput?.value ?? "",

    keyword:
      keywordInput?.value.trim() ?? ""
  };
}

function statusModifierClass(value: string): string {
  switch (value.trim()) {
    case "ว่าง":
      return "status-vacant";
    case "ไม่ว่าง":
      return "status-occupied";
    case "ACTIVE":
    case "กำลังพัก":
      return "status-active";
    case "INACTIVE":
    case "ย้ายออกแล้ว":
      return "status-inactive";
    case "PAID":
    case "ชำระแล้ว":
      return "status-paid";
    case "UNPAID":
    case "ยังไม่ชำระ":
      return "status-unpaid";
    case "OVERDUE":
    case "เกินกำหนด":
      return "status-overdue";
    default:
      return "status-neutral";
  }
}

function formatCell(
  value: ReportCellValue,
  column: ReportColumn
): string {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "-";
  }

  switch (column.type) {
    case "money":
      return formatMoney(Number(value));

    case "number":
      return Number(value).toLocaleString(
        "th-TH"
      );

    case "date":
      return formatDate(String(value));

    case "datetime":
      return formatDateTime(
        String(value)
      );

    case "month":
      return formatMonth(String(value));

    case "status": {
      const raw = String(value);
      const modifier = statusModifierClass(raw);

      return `
        <span class="status-badge ${modifier}">
          ${escapeHtml(raw)}
        </span>
      `;
    }

    default:
      return escapeHtml(String(value));
  }
}

function renderReport(
  data: ReportData
): void {
  if (!tableHead || !tableBody) {
    return;
  }

  tableHead.innerHTML = `
    <tr>
      ${data.columns
        .map(column => `
          <th>
            ${escapeHtml(column.label)}
          </th>
        `)
        .join("")}
    </tr>
  `;

  if (data.rows.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td
          class="empty-cell"
          colspan="${Math.max(
            1,
            data.columns.length
          )}"
        >
          ไม่พบข้อมูลรายงาน
        </td>
      </tr>
    `;
  } else {
    const pageRows = paginate(
      data.rows,
      currentPage,
      PAGE_SIZE
    );

    tableBody.innerHTML =
      pageRows
        .map(row => `
        <tr>
          ${data.columns
            .map(column => `
              <td>
                ${formatCell(
                  row[column.key],
                  column
                )}
              </td>
            `)
            .join("")}
        </tr>
      `)
        .join("");
  }

  if (paginationContainer) {
    renderPaginationControls(
      paginationContainer,
      currentPage,
      getTotalPages(data.rows.length, PAGE_SIZE),
      page => {
        currentPage = page;
        renderReport(data);
      }
    );
  }
}

async function loadReport(): Promise<void> {
  currentPage = 1;

  if (tableBody) {
    const columnCount = Math.max(
      1,
      tableHead?.querySelectorAll("th").length ?? 1
    );

    tableBody.innerHTML = `
      <tr>
        <td
          class="loading-cell"
          colspan="${columnCount}"
        >
          กำลังโหลดรายงาน...
        </td>
      </tr>
    `;
  }

  try {
    const result =
      await getReport(readFilter());

    if (!result.success || !result.data) {
      throw new Error(result.message);
    }

    renderReport(result.data);
  } catch (error) {
    // อย่าปล่อยให้ตารางค้างคำว่า "กำลังโหลด..."
    if (tableBody) {
      const columnCount = Math.max(
        1,
        tableHead?.querySelectorAll("th")
          .length ?? 1
      );

      tableBody.innerHTML = `
        <tr>
          <td
            class="empty-cell"
            colspan="${columnCount}"
          >
            ไม่สามารถโหลดรายงานได้
          </td>
        </tr>
      `;
    }

    throw error;
  }
}

async function loadAll(): Promise<void> {
  try {
    clearMessage();

    await Promise.all([
      loadDashboard(),
      loadReport()
    ]);
  } catch (error) {
    console.error(
      "Report page error:",
      error
    );

    showMessage(
      error instanceof Error
        ? error.message
        : "ไม่สามารถโหลดข้อมูลได้",
      "error"
    );
  }
}

reportTypeInput?.addEventListener(
  "change",
  async () => {
    updateStatusOptions();
    currentPage = 1;

    try {
      await loadReport();
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถโหลดรายงานได้",
        "error"
      );
    }
  }
);

dashboardMonthInput?.addEventListener(
  "change",
  async () => {
    try {
      await loadDashboard();
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถโหลด Dashboard ได้",
        "error"
      );
    }
  }
);

searchButton?.addEventListener(
  "click",
  async () => {
    currentPage = 1;

    try {
      clearMessage();
      await loadReport();
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถโหลดรายงานได้",
        "error"
      );
    }
  }
);

clearButton?.addEventListener(
  "click",
  async () => {
    if (reportMonthInput) {
      reportMonthInput.value =
        currentMonth();
    }

    if (roomFilterInput) {
      roomFilterInput.value = "";
    }

    if (statusFilterInput) {
      statusFilterInput.value = "";
    }

    if (keywordInput) {
      keywordInput.value = "";
    }

    currentPage = 1;

    try {
      clearMessage();
      await loadReport();
    } catch (error) {
      showMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถโหลดรายงานได้",
        "error"
      );
    }
  }
);

async function initializeReportPage():
  Promise<void> {
  // หน้า Report ดูได้เฉพาะ OWNER
  if (!requireOwner()) {
    return;
  }

  setupLogoutButton();
  renderSidebar();

  const month = currentMonth();

  if (dashboardMonthInput) {
    dashboardMonthInput.value = month;
  }

  if (reportMonthInput) {
    reportMonthInput.value = month;
  }

  updateStatusOptions();

  try {
    const roomResult = await getRooms();

    if (!roomResult.success) {
      throw new Error(roomResult.message);
    }

    rooms = roomResult.data ?? [];

    populateRoomOptions();

    await loadAll();
  } catch (error) {
    showMessage(
      error instanceof Error
        ? error.message
        : "ไม่สามารถเริ่มต้นหน้า Report ได้",
      "error"
    );
  }
}

void initializeReportPage();