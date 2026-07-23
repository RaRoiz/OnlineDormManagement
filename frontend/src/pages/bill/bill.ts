import "./bill.css";
import "../../utils/theme";

import { renderSidebar } from "../../utils/sidebar";

import {
  requireLogin,
  setupLogoutButton
} from "../../utils/auth.guard";

import {
  createBill,
  deleteBill,
  getBills,
  markBillPaid,
  sendBillLine,
  updateBill
} from "../../services/bill.service";

import { confirmDialog } from "../../utils/dialog";
import { showToast } from "../../utils/toast";

import {
  getMeters
} from "../../services/meter.service";

import {
  getRooms
} from "../../services/room.service";

import type {
  Bill,
  BillInput
} from "../../types/bill";

import type {
  MeterRecord
} from "../../types/meter";

import type {
  Room
} from "../../types/room";

const formPanel =
  document.querySelector<HTMLElement>(
    "#bill-form-panel"
  );

const form =
  document.querySelector<HTMLFormElement>(
    "#bill-form"
  );

const formTitle =
  document.querySelector<HTMLElement>(
    "#form-title"
  );

const meterInput =
  document.querySelector<HTMLSelectElement>(
    "#bill-meter"
  );

const dueDateInput =
  document.querySelector<HTMLInputElement>(
    "#due-date"
  );

const depositAmountInput =
  document.querySelector<HTMLInputElement>(
    "#deposit-amount"
  );

const repairAmountInput =
  document.querySelector<HTMLInputElement>(
    "#repair-amount"
  );

const damageAmountInput =
  document.querySelector<HTMLInputElement>(
    "#damage-amount"
  );

const noteInput =
  document.querySelector<HTMLTextAreaElement>(
    "#bill-note"
  );

const monthPreview =
  document.querySelector<HTMLElement>(
    "#month-preview"
  );

const roomPreview =
  document.querySelector<HTMLElement>(
    "#room-preview"
  );

const tenantPreview =
  document.querySelector<HTMLElement>(
    "#tenant-preview"
  );

const roomRentPreview =
  document.querySelector<HTMLElement>(
    "#room-rent-preview"
  );

const waterPreview = document.querySelector<HTMLElement>("#water-preview");

const electricPreview = document.querySelector<HTMLElement>("#electric-preview");

const totalPreview = document.querySelector<HTMLElement>("#total-preview");

const formMessage = document.querySelector<HTMLElement>("#form-message");

const pageMessage = document.querySelector<HTMLElement>("#page-message");

const tableBody = document.querySelector<HTMLTableSectionElement>("#bill-table-body");

const searchInput = document.querySelector<HTMLInputElement>("#search-input");

const statusFilter = document.querySelector<HTMLSelectElement>("#status-filter");

const roomFilter = document.querySelector<HTMLSelectElement>("#room-filter");

const openFormButton = document.querySelector<HTMLButtonElement>("#open-form-button");

const closeFormButton = document.querySelector<HTMLButtonElement>("#close-form-button");

const cancelButton = document.querySelector<HTMLButtonElement>("#cancel-button");

const saveButton = document.querySelector<HTMLButtonElement>("#save-button");

let bills: Bill[] = [];
let meters: MeterRecord[] = [];
let rooms: Room[] = [];

let editingBillId: string | null = null;

function escapeHtml(value: string): string {
  const element =
    document.createElement("div");

  element.textContent = value;

  return element.innerHTML;
}

function numberValue(
  input: HTMLInputElement | null
): number {
  const value = Number(input?.value ?? 0);

  return Number.isFinite(value)
    ? value
    : 0;
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
  if (!value) {
    return "-";
  }

  const normalized =
    /^\d{4}-\d{2}$/.test(value)
      ? value
      : "";

  if (!normalized) {
    return value;
  }

  const [year, month] =
    normalized.split("-");

  return `${month}/${year}`;
}

function formatDate(value: string): string {
  if (!value) {
    return "-";
  }

  const dateOnly =
    value.slice(0, 10);

  const parts =
    dateOnly.split("-");

  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  // ข้อมูลเก่าบางแถวเก็บมาแบบ "Wed Jul 29"
  // — แปลงให้เป็น วว/ดด/ปปปป เหมือนกัน
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  // ถ้าข้อความไม่มีปี ให้ถือว่าเป็นปีปัจจุบัน
  const year = /\d{4}/.test(value)
    ? parsed.getFullYear()
    : new Date().getFullYear();

  const day = String(
    parsed.getDate()
  ).padStart(2, "0");

  const month = String(
    parsed.getMonth() + 1
  ).padStart(2, "0");

  return `${day}/${month}/${year}`;
}

function addDays(
  date: Date,
  days: number
): Date {
  const result = new Date(date);

  result.setDate(
    result.getDate() + days
  );

  return result;
}

function toDateInputValue(
  date: Date
): string {
  const offset =
    date.getTimezoneOffset();

  return new Date(
    date.getTime() -
      offset * 60 * 1000
  )
    .toISOString()
    .slice(0, 10);
}

function defaultDueDate(): string {
  return toDateInputValue(
    addDays(new Date(), 7)
  );
}

function showFormMessage(
  message: string
): void {
  if (formMessage) {
    formMessage.textContent = message;
  }
}

function showPageMessage(
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

function clearPageMessage(): void {
  if (!pageMessage) {
    return;
  }

  pageMessage.textContent = "";
  pageMessage.className =
    "page-message";
}

function getSelectedMeter():
  MeterRecord | undefined {
  const meterId =
    meterInput?.value ?? "";

  return meters.find(
    meter => meter.meterId === meterId
  );
}

function getRoomById(
  roomId: string
): Room | undefined {
  return rooms.find(
    room => room.roomId === roomId
  );
}

function getBillStatus(
  bill: Bill
): "UNPAID" | "PAID" | "OVERDUE" {
  if (bill.paymentStatus === "PAID") {
    return "PAID";
  }

  // dueDate อาจมาเป็น "YYYY-MM-DD" หรือ ISO เต็ม
  // ตัดเหลือเฉพาะวันที่ก่อนต่อเวลาสิ้นวัน
  const dueDate = new Date(
    `${bill.dueDate.slice(0, 10)}T23:59:59`
  );

  if (
    !Number.isNaN(dueDate.getTime()) &&
    dueDate.getTime() < Date.now()
  ) {
    return "OVERDUE";
  }

  return "UNPAID";
}

function populateMeterOptions(
  currentMeterId = ""
): void {
  if (!meterInput) {
    return;
  }

  const billedMeterIds =
    new Set(
      bills
        .filter(
          bill =>
            bill.billId !== editingBillId
        )
        .map(bill => bill.meterId)
    );

  const availableMeters =
    meters.filter(meter => {
      return (
        !billedMeterIds.has(
          meter.meterId
        ) ||
        meter.meterId ===
          currentMeterId
      );
    });

  meterInput.innerHTML = `
    <option value="">
      เลือกรายการมิเตอร์
    </option>

    ${availableMeters
      .map(meter => `
        <option
          value="${escapeHtml(meter.meterId)}"
        >
          ${formatMonth(meter.billingMonth)}
          — ห้อง ${escapeHtml(meter.roomNo)}
          — ${escapeHtml(
            meter.tenantName || "-"
          )}
        </option>
      `)
      .join("")}
  `;

  meterInput.value =
    currentMeterId;
}

function updatePreview(): void {
  const meter =
    getSelectedMeter();

  const room = meter
    ? getRoomById(meter.roomId)
    : undefined;

  const roomRent =
    room?.price ?? 0;

  const waterAmount =
    meter?.waterAmount ?? 0;

  const electricAmount =
    meter?.electricAmount ?? 0;

  const extraAmount =
    numberValue(depositAmountInput) +
    numberValue(repairAmountInput) +
    numberValue(damageAmountInput);

  const total =
    roomRent +
    waterAmount +
    electricAmount +
    extraAmount;

  if (monthPreview) {
    monthPreview.textContent =
      meter
        ? formatMonth(
            meter.billingMonth
          )
        : "-";
  }

  if (roomPreview) {
    roomPreview.textContent =
      meter
        ? `ห้อง ${meter.roomNo}`
        : "-";
  }

  if (tenantPreview) {
    tenantPreview.textContent =
      meter?.tenantName || "-";
  }

  if (roomRentPreview) {
    roomRentPreview.textContent =
      formatMoney(roomRent);
  }

  if (waterPreview) {
    waterPreview.textContent =
      formatMoney(waterAmount);
  }

  if (electricPreview) {
    electricPreview.textContent =
      formatMoney(electricAmount);
  }

  if (totalPreview) {
    totalPreview.textContent =
      formatMoney(total);
  }
}

function openForm(
  bill?: Bill
): void {
  if (!formPanel || !formTitle) {
    return;
  }

  formPanel.hidden = false;
  showFormMessage("");

  if (bill) {
    editingBillId =
      bill.billId;

    formTitle.textContent =
      "แก้ไขใบแจ้งหนี้";

    populateMeterOptions(
      bill.meterId
    );

    if (dueDateInput) {
      dueDateInput.value =
        bill.dueDate.slice(0, 10);
    }

    if (depositAmountInput) {
      depositAmountInput.value =
        String(bill.depositAmount);
    }

    if (repairAmountInput) {
      repairAmountInput.value =
        String(bill.repairAmount);
    }

    if (damageAmountInput) {
      damageAmountInput.value =
        String(bill.damageAmount);
    }

    if (noteInput) {
      noteInput.value =
        bill.note ?? "";
    }
  } else {
    editingBillId = null;

    formTitle.textContent =
      "สร้างใบแจ้งหนี้";

    form?.reset();
    populateMeterOptions();

    if (dueDateInput) {
      dueDateInput.value =
        defaultDueDate();
    }

    if (depositAmountInput) {
      depositAmountInput.value = "0";
    }

    if (repairAmountInput) {
      repairAmountInput.value = "0";
    }

    if (damageAmountInput) {
      damageAmountInput.value = "0";
    }
  }

  updatePreview();

  formPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeForm(): void {
  editingBillId = null;
  form?.reset();
  showFormMessage("");

  if (formPanel) {
    formPanel.hidden = true;
  }
}

function readForm():
  BillInput | null {
  const meterId =
    meterInput?.value.trim() ?? "";

  const dueDate =
    dueDateInput?.value.trim() ?? "";

  const depositAmount =
    numberValue(depositAmountInput);

  const repairAmount =
    numberValue(repairAmountInput);

  const damageAmount =
    numberValue(damageAmountInput);

  const note =
    noteInput?.value.trim() ?? "";

  if (!meterId) {
    showFormMessage(
      "กรุณาเลือกรายการมิเตอร์"
    );

    meterInput?.focus();
    return null;
  }

  if (!dueDate) {
    showFormMessage(
      "กรุณาเลือกวันครบกำหนดชำระ"
    );

    dueDateInput?.focus();
    return null;
  }

  if (
    depositAmount < 0 ||
    repairAmount < 0 ||
    damageAmount < 0
  ) {
    showFormMessage(
      "ค่าใช้จ่ายเพิ่มเติมต้องไม่ติดลบ"
    );

    return null;
  }

  return {
    meterId,
    depositAmount,
    repairAmount,
    damageAmount,
    dueDate,
    note
  };
}

function getFilteredBills(): Bill[] {
  const keyword =
    searchInput?.value
      .trim()
      .toLowerCase() ?? "";

  const selectedStatus =
    statusFilter?.value ?? "";

  return bills.filter(bill => {
    const searchableText = [
      bill.billNo,
      bill.roomNo,
      bill.tenantName
    ]
      .join(" ")
      .toLowerCase();

    const status =
      getBillStatus(bill);

    const matchesSearch =
      !keyword ||
      searchableText.includes(keyword);

    const matchesStatus =
      !selectedStatus ||
      status === selectedStatus;

    const selectedRoomId =
      roomFilter?.value ?? "";

    const matchesRoom =
      !selectedRoomId ||
      bill.roomId === selectedRoomId;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesRoom
    );
  });
}

/** เติมตัวเลือกห้องพักในฟิลเตอร์ */
function populateRoomFilterOptions(): void {
  if (!roomFilter) {
    return;
  }

  const previous = roomFilter.value;

  roomFilter.innerHTML =
    `<option value="">ทุกห้อง</option>` +
    rooms
      .map(room => `
        <option value="${escapeHtml(room.roomId)}">
          ห้อง ${escapeHtml(room.roomNo)}
        </option>
      `)
      .join("");

  roomFilter.value = previous;
}

function renderBills(): void {
  if (!tableBody) {
    return;
  }

  const filteredBills =
    getFilteredBills();

  if (filteredBills.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td
          class="empty-cell"
          colspan="12"
        >
          ไม่พบข้อมูลใบแจ้งหนี้
        </td>
      </tr>
    `;

    return;
  }

  tableBody.innerHTML =
    filteredBills
      .map(bill => {
        const status =
          getBillStatus(bill);

        const statusText =
          status === "PAID"
            ? "ชำระแล้ว"
            : status === "OVERDUE"
              ? "เกินกำหนด"
              : "ยังไม่ชำระ";

        const statusClass =
          status === "PAID"
            ? "status-paid"
            : status === "OVERDUE"
              ? "status-overdue"
              : "status-unpaid";

        const extraAmount =
          bill.depositAmount +
          bill.repairAmount +
          bill.damageAmount;

        const safeBillId =
          escapeHtml(bill.billId);

        return `
          <tr>
            <td>
              <strong>
                ${escapeHtml(bill.billNo)}
              </strong>
            </td>

            <td>
              ${formatMonth(
                bill.billingMonth
              )}
            </td>

            <td>
              ${escapeHtml(bill.roomNo)}
            </td>

            <td>
              ${escapeHtml(
                bill.tenantName
              )}
            </td>

            <td>
              ${formatMoney(
                bill.roomRent
              )}
            </td>

            <td>
              ${formatMoney(
                bill.waterAmount
              )}
            </td>

            <td>
              ${formatMoney(
                bill.electricAmount
              )}
            </td>

            <td>
              ${formatMoney(
                extraAmount
              )}
            </td>

            <td>
              <strong>
                ${formatMoney(
                  bill.totalAmount
                )}
              </strong>
            </td>

            <td>
              ${formatDate(
                bill.dueDate
              )}
            </td>

            <td>
              <span
                class="status-badge ${statusClass}"
              >
                ${statusText}
              </span>
            </td>

            <td class="action-column">
              <button
                class="table-button print-button"
                type="button"
                data-action="print"
                data-bill-id="${safeBillId}"
              >
                พิมพ์
              </button>

              ${
                bill.paymentStatus ===
                "UNPAID"
                  ? `
                    <button
                      class="table-button line-button"
                      type="button"
                      data-action="line"
                      data-bill-id="${safeBillId}"
                    >
                      ส่ง LINE
                    </button>

                    <button
                      class="table-button edit-button"
                      type="button"
                      data-action="edit"
                      data-bill-id="${safeBillId}"
                    >
                      แก้ไข
                    </button>

                    <button
                      class="table-button paid-button"
                      type="button"
                      data-action="paid"
                      data-bill-id="${safeBillId}"
                    >
                      ชำระแล้ว
                    </button>

                    <button
                      class="table-button delete-button"
                      type="button"
                      data-action="delete"
                      data-bill-id="${safeBillId}"
                    >
                      ลบ
                    </button>
                  `
                  : `
                    <span class="paid-at-text">
                      ชำระ ${formatDate(
                        bill.paidAt
                      )}
                    </span>
                  `
              }
            </td>
          </tr>
        `;
      })
      .join("");
}

/**
 * เปิดหน้าใบแจ้งหนี้แบบพร้อมพิมพ์
 * ผู้ใช้กด "พิมพ์" ในหน้าต่างที่เด้งขึ้น
 * แล้วเลือกเครื่องพิมพ์ หรือ Save as PDF ได้เลย
 */
function printBill(bill: Bill): void {
  const status = getBillStatus(bill);

  const statusText =
    status === "PAID"
      ? "ชำระแล้ว"
      : status === "OVERDUE"
        ? "เกินกำหนดชำระ"
        : "รอชำระ";

  const itemRow = (
    label: string,
    amount: number
  ): string => `
    <tr>
      <td>${escapeHtml(label)}</td>
      <td class="num">${formatMoney(amount)}</td>
    </tr>
  `;

  let itemsHtml =
    itemRow("ค่าเช่าห้อง", bill.roomRent) +
    itemRow("ค่าน้ำ", bill.waterAmount) +
    itemRow("ค่าไฟ", bill.electricAmount);

  if (bill.depositAmount > 0) {
    itemsHtml += itemRow(
      "ค่าประกันเพิ่มเติม",
      bill.depositAmount
    );
  }

  if (bill.repairAmount > 0) {
    itemsHtml += itemRow(
      "ค่าซ่อมแซม",
      bill.repairAmount
    );
  }

  if (bill.damageAmount > 0) {
    itemsHtml += itemRow(
      "ค่าเสียหาย",
      bill.damageAmount
    );
  }

  const noteHtml = bill.note
    ? `<p class="note">หมายเหตุ: ${escapeHtml(bill.note)}</p>`
    : "";

  const paidHtml =
    bill.paymentStatus === "PAID"
      ? `<p class="paid">ชำระเงินแล้วเมื่อ ${formatDate(bill.paidAt)}</p>`
      : "";

  const html = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<title>${escapeHtml(bill.billNo)}</title>
<style>
  * { box-sizing: border-box; }

  body {
    max-width: 720px;
    margin: 0 auto;
    padding: 32px 28px;

    color: #1c1c1c;
    font-family: "Anuphan", "Noto Sans Thai",
      "Leelawadee UI", Tahoma, sans-serif;
    font-size: 15px;
    line-height: 1.6;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;

    padding-bottom: 18px;
    margin-bottom: 22px;

    border-bottom: 2px solid #1c1c1c;
  }

  .head h1 {
    margin: 0;
    font-size: 24px;
  }

  .head p {
    margin: 4px 0 0;
    color: #666;
    font-size: 13px;
  }

  .bill-no {
    text-align: right;
    font-size: 13px;
    color: #444;
  }

  .bill-no strong {
    display: block;
    font-size: 16px;
    color: #1c1c1c;
  }

  .meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px 24px;

    margin-bottom: 24px;
  }

  .meta span {
    color: #777;
    font-size: 13px;
  }

  table {
    width: 100%;
    margin-bottom: 8px;
    border-collapse: collapse;
  }

  th, td {
    padding: 10px 12px;
    border-bottom: 1px solid #ddd;
    text-align: left;
  }

  th {
    background: #f3f3f3;
    font-size: 13px;
  }

  .num {
    text-align: right;
    white-space: nowrap;
  }

  .total td {
    border-top: 2px solid #1c1c1c;
    border-bottom: 0;

    font-size: 18px;
    font-weight: 700;
  }

  .status {
    display: inline-block;
    margin-top: 8px;
    padding: 4px 14px;

    border: 1.5px solid #1c1c1c;
    border-radius: 999px;

    font-size: 13px;
    font-weight: 700;
  }

  .note { color: #555; font-size: 13px; }
  .paid { color: #1a7a43; font-weight: 700; }

  .footer {
    margin-top: 36px;
    padding-top: 14px;

    border-top: 1px solid #ddd;

    color: #999;
    font-size: 12px;
    text-align: center;
  }

  @media print {
    body { padding: 0; }
  }
</style>
</head>
<body>
  <div class="head">
    <div>
      <h1>ใบแจ้งค่าใช้จ่าย</h1>
      <p>ระบบจัดการหอพักออนไลน์</p>
    </div>

    <div class="bill-no">
      เลขที่
      <strong>${escapeHtml(bill.billNo)}</strong>
      ประจำเดือน ${formatMonth(bill.billingMonth)}
    </div>
  </div>

  <div class="meta">
    <div>
      <span>ผู้เช่า</span><br>
      <strong>${escapeHtml(bill.tenantName)}</strong>
    </div>

    <div>
      <span>ห้องพัก</span><br>
      <strong>ห้อง ${escapeHtml(bill.roomNo)}</strong>
    </div>

    <div>
      <span>วันครบกำหนดชำระ</span><br>
      <strong>${formatDate(bill.dueDate)}</strong>
    </div>

    <div>
      <span>สถานะ</span><br>
      <span class="status">${statusText}</span>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>รายการ</th>
        <th class="num">จำนวนเงิน</th>
      </tr>
    </thead>

    <tbody>
      ${itemsHtml}

      <tr class="total">
        <td>ยอดรวมทั้งหมด</td>
        <td class="num">
          ${formatMoney(bill.totalAmount)}
        </td>
      </tr>
    </tbody>
  </table>

  ${paidHtml}
  ${noteHtml}

  <div class="footer">
    ออกเอกสารเมื่อ ${new Date().toLocaleDateString("th-TH")}
    · Online Dorm Management
  </div>
</body>
</html>`;

  const printWindow = window.open(
    "",
    "_blank",
    "width=800,height=920"
  );

  if (!printWindow) {
    showPageMessage(
      "เบราว์เซอร์บล็อกหน้าต่างพิมพ์ กรุณาอนุญาต popup",
      "error"
    );

    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // รอให้เรนเดอร์เสร็จก่อนเด้ง dialog พิมพ์
  window.setTimeout(() => {
    printWindow.focus();
    printWindow.print();
  }, 400);
}

async function loadData(): Promise<void> {
  try {
    clearPageMessage();

    const [
      billResult,
      meterResult,
      roomResult
    ] = await Promise.all([
      getBills(),
      getMeters(),
      getRooms()
    ]);

    if (!billResult.success) {
      throw new Error(
        billResult.message
      );
    }

    if (!meterResult.success) {
      throw new Error(
        meterResult.message
      );
    }

    if (!roomResult.success) {
      throw new Error(
        roomResult.message
      );
    }

    bills =
      billResult.data ?? [];

    meters =
      meterResult.data ?? [];

    rooms =
      roomResult.data ?? [];

    populateRoomFilterOptions();
    renderBills();
  } catch (error) {
    console.error(
      "Load bill error:",
      error
    );

    showPageMessage(
      error instanceof Error
        ? error.message
        : "ไม่สามารถโหลดข้อมูลใบแจ้งหนี้ได้",
      "error"
    );

    bills = [];
    renderBills();
  }
}

form?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    showFormMessage("");
    clearPageMessage();

    const billInput =
      readForm();

    if (!billInput) {
      return;
    }

    const isEditing =
      Boolean(editingBillId);

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent =
        "กำลังบันทึก...";
    }

    try {
      const result = editingBillId
        ? await updateBill(
            editingBillId,
            billInput
          )
        : await createBill(
            billInput
          );

      if (!result.success) {
        showFormMessage(
          result.message
        );

        return;
      }

      closeForm();

      showPageMessage(
        isEditing
          ? "แก้ไขใบแจ้งหนี้สำเร็จ"
          : "สร้างใบแจ้งหนี้สำเร็จ",
        "success"
      );

      await loadData();
    } catch (error) {
      showFormMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถบันทึกใบแจ้งหนี้ได้"
      );
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent =
          "บันทึกใบแจ้งหนี้";
      }
    }
  }
);

tableBody?.addEventListener(
  "click",
  async event => {
    const target = event.target;

    if (
      !(
        target instanceof
        HTMLButtonElement
      )
    ) {
      return;
    }

    const billId =
      target.dataset.billId;

    const action =
      target.dataset.action;

    if (!billId) {
      return;
    }

    const bill = bills.find(
      item => item.billId === billId
    );

    if (!bill) {
      return;
    }

    if (action === "print") {
      printBill(bill);
      return;
    }

    if (action === "edit") {
      openForm(bill);
      return;
    }

    if (action === "line") {
      const confirmed = await confirmDialog({
        title: "ส่งใบแจ้งหนี้ทาง LINE",
        message: `ส่งบิล ${bill.billNo} ให้ ${bill.tenantName} ทาง LINE หรือไม่`,
        confirmText: "ส่ง LINE"
      });

      if (!confirmed) {
        return;
      }

      target.disabled = true;

      try {
        const result =
          await sendBillLine(billId);

        if (!result.success) {
          showPageMessage(
            result.message,
            "error"
          );

          return;
        }

        showPageMessage(
          result.message,
          "success"
        );
      } catch (error) {
        showPageMessage(
          error instanceof Error
            ? error.message
            : "ส่ง LINE ไม่สำเร็จ",
          "error"
        );
      } finally {
        target.disabled = false;
      }

      return;
    }

    if (action === "paid") {
      const confirmed = await confirmDialog({
        title: "ยืนยันการชำระเงิน",
        message: `ยืนยันว่าบิล ${bill.billNo} ชำระเงินแล้วหรือไม่`,
        confirmText: "ชำระแล้ว"
      });

      if (!confirmed) {
        return;
      }

      const result =
        await markBillPaid(billId);

      if (!result.success) {
        showPageMessage(
          result.message,
          "error"
        );

        return;
      }

      showPageMessage(
        "บันทึกการชำระเงินสำเร็จ",
        "success"
      );

      await loadData();
      return;
    }

    if (action === "delete") {
      const confirmed = await confirmDialog({
        title: "ลบใบแจ้งหนี้",
        message: `ต้องการลบบิล ${bill.billNo} หรือไม่`,
        confirmText: "ลบบิล",
        tone: "danger"
      });

      if (!confirmed) {
        return;
      }

      const result =
        await deleteBill(billId);

      if (!result.success) {
        showPageMessage(
          result.message,
          "error"
        );

        return;
      }

      showPageMessage(
        "ลบใบแจ้งหนี้สำเร็จ",
        "success"
      );

      await loadData();
    }
  }
);

meterInput?.addEventListener(
  "change",
  updatePreview
);

[
  depositAmountInput,
  repairAmountInput,
  damageAmountInput
].forEach(input => {
  input?.addEventListener(
    "input",
    updatePreview
  );
});

openFormButton?.addEventListener(
  "click",
  () => openForm()
);

closeFormButton?.addEventListener("click",closeForm);

cancelButton?.addEventListener("click",closeForm);

searchInput?.addEventListener("input",renderBills);

statusFilter?.addEventListener("change",renderBills);
roomFilter?.addEventListener("change", renderBills);

async function initializeBillPage(): Promise<void> {
  if (!requireLogin()) {
    return;
  }

  setupLogoutButton();
  renderSidebar();
  await loadData();
}

void initializeBillPage();