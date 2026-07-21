import "./bill.css";

import {
  requireLogin,
  setupLogoutButton
} from "../../utils/auth.guard";

import {
  createBill,
  deleteBill,
  getBills,
  markBillPaid,
  updateBill
} from "../../services/bill.service";

import { confirmDialog } from "../../utils/dialog";

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

const waterPreview =
  document.querySelector<HTMLElement>(
    "#water-preview"
  );

const electricPreview =
  document.querySelector<HTMLElement>(
    "#electric-preview"
  );

const totalPreview =
  document.querySelector<HTMLElement>(
    "#total-preview"
  );

const formMessage =
  document.querySelector<HTMLElement>(
    "#form-message"
  );

const pageMessage =
  document.querySelector<HTMLElement>(
    "#page-message"
  );

const tableBody =
  document.querySelector<HTMLTableSectionElement>(
    "#bill-table-body"
  );

const searchInput =
  document.querySelector<HTMLInputElement>(
    "#search-input"
  );

const statusFilter =
  document.querySelector<HTMLSelectElement>(
    "#status-filter"
  );

const openFormButton =
  document.querySelector<HTMLButtonElement>(
    "#open-form-button"
  );

const closeFormButton =
  document.querySelector<HTMLButtonElement>(
    "#close-form-button"
  );

const cancelButton =
  document.querySelector<HTMLButtonElement>(
    "#cancel-button"
  );

const saveButton =
  document.querySelector<HTMLButtonElement>(
    "#save-button"
  );

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

  if (parts.length !== 3) {
    return value;
  }

  return `${parts[2]}/${parts[1]}/${parts[0]}`;
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

  const dueDate =
    new Date(`${bill.dueDate}T23:59:59`);

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

    return (
      matchesSearch &&
      matchesStatus
    );
  });
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
              ${
                bill.paymentStatus ===
                "UNPAID"
                  ? `
                    <button
                      class="table-button edit-button"
                      type="button"
                      data-action="edit"
                      data-bill-id="${bill.billId}"
                    >
                      แก้ไข
                    </button>

                    <button
                      class="table-button paid-button"
                      type="button"
                      data-action="paid"
                      data-bill-id="${bill.billId}"
                    >
                      ชำระแล้ว
                    </button>

                    <button
                      class="table-button delete-button"
                      type="button"
                      data-action="delete"
                      data-bill-id="${bill.billId}"
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

    if (action === "edit") {
      openForm(bill);
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

closeFormButton?.addEventListener(
  "click",
  closeForm
);

cancelButton?.addEventListener(
  "click",
  closeForm
);

searchInput?.addEventListener(
  "input",
  renderBills
);

statusFilter?.addEventListener(
  "change",
  renderBills
);

async function initializeBillPage(): Promise<void> {
  if (!requireLogin()) {
    return;
  }

  setupLogoutButton();
  await loadData();
}

void initializeBillPage();