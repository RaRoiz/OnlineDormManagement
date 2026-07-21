import "./report.css";

import {
  requireLogin,
  setupLogoutButton
} from "../../utils/auth.guard";

import {
  getDashboardSummary,
  getReport
} from "../../services/report.service";

import {
  getRooms
} from "../../services/room.service";

import type {
  DashboardSummary,
  ReportCellValue,
  ReportColumn,
  ReportData,
  ReportFilter,
  ReportType
} from "../../types/report";

import type {
  Room
} from "../../types/room";

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

let rooms: Room[] = [];

function currentMonth(): string {
  const date = new Date();

  return [
    date.getFullYear(),
    String(
      date.getMonth() + 1
    ).padStart(2, "0")
  ].join("-");
}

function escapeHtml(value: string): string {
  const element =
    document.createElement("div");

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
      reportMonthInput?.value ?? "",

    roomId:
      roomFilterInput?.value ?? "",

    status:
      statusFilterInput?.value ?? "",

    keyword:
      keywordInput?.value.trim() ?? ""
  };
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

    case "status":
      return `
        <span class="status-badge">
          ${escapeHtml(String(value))}
        </span>
      `;

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

    return;
  }

  tableBody.innerHTML =
    data.rows
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

async function loadReport(): Promise<void> {
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td class="loading-cell">
          กำลังโหลดรายงาน...
        </td>
      </tr>
    `;
  }

  const result =
    await getReport(readFilter());

  if (!result.success || !result.data) {
    throw new Error(result.message);
  }

  renderReport(result.data);
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

    await loadReport();
  }
);

async function initializeReportPage():
  Promise<void> {
  if (!requireLogin()) {
    return;
  }

  setupLogoutButton();

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