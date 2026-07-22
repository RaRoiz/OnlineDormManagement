import "./meter.css";
import "../../utils/theme";

import {
  requireLogin,
  setupLogoutButton
} from "../../utils/auth.guard";

import {
  createMeter,
  deleteMeter,
  getMeters,
  updateMeter
} from "../../services/meter.service";

import { confirmDialog } from "../../utils/dialog";
import { showToast } from "../../utils/toast";

import { getRooms } from "../../services/room.service";
import { getTenants } from "../../services/tenant.service";

import type {
  MeterInput,
  MeterRecord
} from "../../types/meter";

import type { Room } from "../../types/room";
import type { Tenant } from "../../types/tenant";

const formPanel =
  document.querySelector<HTMLElement>(
    "#meter-form-panel"
  );

const form =
  document.querySelector<HTMLFormElement>(
    "#meter-form"
  );

const formTitle =
  document.querySelector<HTMLElement>(
    "#form-title"
  );

const roomInput =
  document.querySelector<HTMLSelectElement>(
    "#meter-room"
  );

const billingMonthInput =
  document.querySelector<HTMLInputElement>(
    "#billing-month"
  );

const waterPreviousInput =
  document.querySelector<HTMLInputElement>(
    "#water-previous"
  );

const waterCurrentInput =
  document.querySelector<HTMLInputElement>(
    "#water-current"
  );

const waterRateInput =
  document.querySelector<HTMLInputElement>(
    "#water-rate"
  );

const electricPreviousInput =
  document.querySelector<HTMLInputElement>(
    "#electric-previous"
  );

const electricCurrentInput =
  document.querySelector<HTMLInputElement>(
    "#electric-current"
  );

const electricRateInput =
  document.querySelector<HTMLInputElement>(
    "#electric-rate"
  );

const waterUnitsPreview =
  document.querySelector<HTMLElement>(
    "#water-units-preview"
  );

const waterAmountPreview =
  document.querySelector<HTMLElement>(
    "#water-amount-preview"
  );

const electricUnitsPreview =
  document.querySelector<HTMLElement>(
    "#electric-units-preview"
  );

const electricAmountPreview =
  document.querySelector<HTMLElement>(
    "#electric-amount-preview"
  );

const totalUtilityPreview =
  document.querySelector<HTMLElement>(
    "#total-utility-preview"
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
    "#meter-table-body"
  );

const searchInput =
  document.querySelector<HTMLInputElement>(
    "#search-input"
  );

const monthFilter =
  document.querySelector<HTMLInputElement>(
    "#month-filter"
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

const clearMonthFilterButton =
  document.querySelector<HTMLButtonElement>(
    "#clear-month-filter"
  );

let meterRecords: MeterRecord[] = [];
let rooms: Room[] = [];
let tenants: Tenant[] = [];

let editingMeterId: string | null = null;

function escapeHtml(value: string): string {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function numberValue(
  input: HTMLInputElement | null
): number {
  return Number(input?.value || 0);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(value);
}

function normalizeBillingMonth(
  value: string
): string {
  const text = String(value ?? "").trim();

  // กรณี API ส่งมาเป็น YYYY-MM อยู่แล้ว
  if (/^\d{4}-(0[1-9]|1[0-2])$/.test(text)) {
    return text;
  }

  // กรณี Google Sheets ส่งมาเป็นข้อความวันที่
  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const year = date.getFullYear();

  const month = String(
    date.getMonth() + 1
  ).padStart(2, "0");

  return `${year}-${month}`;
}

function formatBillingDate(
  value: string
): string {
  const normalized =
    normalizeBillingMonth(value);

  if (!normalized) {
    return "-";
  }

  const [year, month] =
    normalized.split("-");

  // วันที่ 01 หมายถึงวันเริ่มต้นของรอบเดือน
  return `01/${month}/${year}`;
}
function currentMonth(): string {
  const now = new Date();
  const month =
    String(now.getMonth() + 1).padStart(2, "0");

  return `${now.getFullYear()}-${month}`;
}

function showFormMessage(message: string): void {
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
  pageMessage.className = "page-message";
}

function getActiveTenant(
  roomId: string
): Tenant | undefined {
  return tenants.find(tenant => {
    return (
      tenant.roomId === roomId &&
      tenant.status === "ACTIVE"
    );
  });
}

function populateRoomOptions(
  currentRoomId = "",
  currentTenantName = ""
): void {
  if (!roomInput) {
    return;
  }

  const selectableRooms = rooms.filter(room => {
    return (
      room.status === "ไม่ว่าง" ||
      room.roomId === currentRoomId
    );
  });

  roomInput.innerHTML = `
    <option value="">
      เลือกห้องพัก
    </option>

    ${selectableRooms
      .map(room => {
        // ตอนแก้ไข ให้ใช้ชื่อผู้เช่าตามที่บันทึกไว้
        // ในเรคคอร์ด (ผู้เช่าห้องอาจเปลี่ยนคนไปแล้ว)
        const tenantName =
          room.roomId === currentRoomId &&
          currentTenantName
            ? currentTenantName
            : getActiveTenant(room.roomId)
                ?.fullName ?? "";

        return `
          <option value="${escapeHtml(room.roomId)}">
            ห้อง ${escapeHtml(room.roomNo)}
            ${
              tenantName
                ? `— ${escapeHtml(tenantName)}`
                : ""
            }
          </option>
        `;
      })
      .join("")}
  `;

  roomInput.value = currentRoomId;
}

function updateCalculationPreview(): void {
  const waterPrevious =
    numberValue(waterPreviousInput);

  const waterCurrent =
    numberValue(waterCurrentInput);

  const waterRate =
    numberValue(waterRateInput);

  const electricPrevious =
    numberValue(electricPreviousInput);

  const electricCurrent =
    numberValue(electricCurrentInput);

  const electricRate =
    numberValue(electricRateInput);

  const waterUnits = Math.max(
    0,
    waterCurrent - waterPrevious
  );

  const electricUnits = Math.max(
    0,
    electricCurrent - electricPrevious
  );

  const waterAmount =
    waterUnits * waterRate;

  const electricAmount =
    electricUnits * electricRate;

  const total =
    waterAmount + electricAmount;

  if (waterUnitsPreview) {
    waterUnitsPreview.textContent =
      `${waterUnits.toLocaleString("th-TH")} หน่วย`;
  }

  if (waterAmountPreview) {
    waterAmountPreview.textContent =
      formatMoney(waterAmount);
  }

  if (electricUnitsPreview) {
    electricUnitsPreview.textContent =
      `${electricUnits.toLocaleString("th-TH")} หน่วย`;
  }

  if (electricAmountPreview) {
    electricAmountPreview.textContent =
      formatMoney(electricAmount);
  }

  if (totalUtilityPreview) {
    totalUtilityPreview.textContent =
      formatMoney(total);
  }
}

function findPreviousRecord(
  roomId: string,
  billingMonth: string
): MeterRecord | undefined {
  const selectedMonth =
    normalizeBillingMonth(billingMonth);

  const sortLatestFirst = (
    a: MeterRecord,
    b: MeterRecord
  ): number => {
    return normalizeBillingMonth(
      b.billingMonth
    ).localeCompare(
      normalizeBillingMonth(a.billingMonth)
    );
  };

  const roomRecords = meterRecords.filter(
    record =>
      record.roomId === roomId &&
      record.meterId !== editingMeterId
  );

  // อันดับแรก: เรคคอร์ดล่าสุดที่อยู่ก่อนเดือนที่เลือก
  const beforeSelected = roomRecords
    .filter(record => {
      return (
        normalizeBillingMonth(
          record.billingMonth
        ) < selectedMonth
      );
    })
    .sort(sortLatestFirst)[0];

  if (beforeSelected) {
    return beforeSelected;
  }

  // ไม่มีเดือนก่อนหน้า → ใช้เรคคอร์ดล่าสุด
  // ของห้องนั้นแทน จะได้ไม่ต้องกรอกใหม่จากศูนย์
  return roomRecords.sort(sortLatestFirst)[0];
}

function autoFillPreviousReadings(): void {
  if (editingMeterId) {
    return;
  }

  const roomId =
    roomInput?.value ?? "";

  const billingMonth =
    billingMonthInput?.value ?? "";

  if (!roomId || !billingMonth) {
    return;
  }

  const previousRecord =
    findPreviousRecord(
      roomId,
      billingMonth
    );

  if (waterPreviousInput) {
    waterPreviousInput.value =
      previousRecord
        ? String(previousRecord.waterCurrent)
        : "0";
  }

  if (electricPreviousInput) {
    electricPreviousInput.value =
      previousRecord
        ? String(previousRecord.electricCurrent)
        : "0";
  }

  updateCalculationPreview();
}

function openForm(
  record?: MeterRecord
): void {
  if (!formPanel || !formTitle) {
    return;
  }

  formPanel.hidden = false;
  showFormMessage("");

  if (record) {
    editingMeterId = record.meterId;
    formTitle.textContent =
      "แก้ไขข้อมูลมิเตอร์";

    populateRoomOptions(
      record.roomId,
      record.tenantName
    );

    if (billingMonthInput) {
      billingMonthInput.value = normalizeBillingMonth(record.billingMonth);
    }

    if (waterPreviousInput) {
      waterPreviousInput.value =
        String(record.waterPrevious);
    }

    if (waterCurrentInput) {
      waterCurrentInput.value =
        String(record.waterCurrent);
    }

    if (waterRateInput) {
      waterRateInput.value =
        String(record.waterRate);
    }

    if (electricPreviousInput) {
      electricPreviousInput.value =
        String(record.electricPrevious);
    }

    if (electricCurrentInput) {
      electricCurrentInput.value =
        String(record.electricCurrent);
    }

    if (electricRateInput) {
      electricRateInput.value =
        String(record.electricRate);
    }
  } else {
    editingMeterId = null;
    formTitle.textContent =
      "เพิ่มข้อมูลมิเตอร์";

    form?.reset();
    populateRoomOptions();

    if (billingMonthInput) {
      billingMonthInput.value =
        currentMonth();
    }

    if (waterPreviousInput) {
      waterPreviousInput.value = "0";
    }

    if (waterRateInput) {
      waterRateInput.value = "18";
    }

    if (electricPreviousInput) {
      electricPreviousInput.value = "0";
    }

    if (electricRateInput) {
      electricRateInput.value = "8";
    }
  }

  updateCalculationPreview();

  formPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeForm(): void {
  editingMeterId = null;
  form?.reset();
  showFormMessage("");

  if (formPanel) {
    formPanel.hidden = true;
  }
}

function readForm(): MeterInput | null {
  const roomId =
    roomInput?.value.trim() ?? "";

  const billingMonth =
    billingMonthInput?.value.trim() ?? "";

  const waterPrevious =
    numberValue(waterPreviousInput);

  const waterCurrent =
    numberValue(waterCurrentInput);

  const waterRate =
    numberValue(waterRateInput);

  const electricPrevious =
    numberValue(electricPreviousInput);

  const electricCurrent =
    numberValue(electricCurrentInput);

  const electricRate =
    numberValue(electricRateInput);

  if (!roomId) {
    showFormMessage(
      "กรุณาเลือกห้องพัก"
    );

    roomInput?.focus();
    return null;
  }

  if (!billingMonth) {
    showFormMessage(
      "กรุณาเลือกเดือน"
    );

    billingMonthInput?.focus();
    return null;
  }

  if (
    waterPrevious < 0 ||
    waterCurrent < waterPrevious
  ) {
    showFormMessage(
      "มิเตอร์น้ำปัจจุบันต้องไม่น้อยกว่าครั้งก่อน"
    );

    waterCurrentInput?.focus();
    return null;
  }

  if (waterRate < 0) {
    showFormMessage(
      "ราคาค่าน้ำต่อหน่วยไม่ถูกต้อง"
    );

    waterRateInput?.focus();
    return null;
  }

  if (
    electricPrevious < 0 ||
    electricCurrent < electricPrevious
  ) {
    showFormMessage(
      "มิเตอร์ไฟปัจจุบันต้องไม่น้อยกว่าครั้งก่อน"
    );

    electricCurrentInput?.focus();
    return null;
  }

  if (electricRate < 0) {
    showFormMessage(
      "ราคาค่าไฟต่อหน่วยไม่ถูกต้อง"
    );

    electricRateInput?.focus();
    return null;
  }

  return {
    roomId,
    billingMonth,
    waterPrevious,
    waterCurrent,
    waterRate,
    electricPrevious,
    electricCurrent,
    electricRate
  };
}

function getFilteredRecords(): MeterRecord[] {
  const keyword =
    searchInput?.value
      .trim()
      .toLowerCase() ?? "";

  const selectedMonth =
    normalizeBillingMonth(
      monthFilter?.value ?? ""
    );

  return meterRecords.filter(record => {
    const recordMonth =
      normalizeBillingMonth(
        record.billingMonth
      );

    const searchableText = [
      record.roomNo,
      record.tenantName
    ]
      .join(" ")
      .toLowerCase();

    const matchesKeyword =
      !keyword ||
      searchableText.includes(keyword);

    const matchesMonth =
      !selectedMonth ||
      recordMonth === selectedMonth;

    return matchesKeyword && matchesMonth;
  });
}

function renderRecords(): void {
  if (!tableBody) {
    return;
  }

  const records =
    getFilteredRecords();

  if (records.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td
          class="empty-cell"
          colspan="9"
        >
          ไม่พบข้อมูลมิเตอร์
        </td>
      </tr>
    `;

    return;
  }

  tableBody.innerHTML = records
    .map(record => `
      <tr>
        <td>
          ${formatBillingDate(record.billingMonth)}
        </td>

        <td>
          <strong>
            ${escapeHtml(record.roomNo)}
          </strong>
        </td>

        <td>
          ${escapeHtml(record.tenantName || "-")}
        </td>

        <td>
          ${record.waterUnits.toLocaleString("th-TH")}
        </td>

        <td>
          ${formatMoney(record.waterAmount)}
        </td>

        <td>
          ${record.electricUnits.toLocaleString("th-TH")}
        </td>

        <td>
          ${formatMoney(record.electricAmount)}
        </td>

        <td>
          <strong>
            ${formatMoney(record.totalUtility)}
          </strong>
        </td>

        <td class="action-column">
          <button
            class="table-button edit-button"
            type="button"
            data-action="edit"
            data-meter-id="${record.meterId}"
          >
            แก้ไข
          </button>

          <button
            class="table-button delete-button"
            type="button"
            data-action="delete"
            data-meter-id="${record.meterId}"
          >
            ลบ
          </button>
        </td>
      </tr>
    `)
    .join("");
}

async function loadData(): Promise<void> {
  try {
    clearPageMessage();

    const [
      meterResult,
      roomResult,
      tenantResult
    ] = await Promise.all([
      getMeters(),
      getRooms(),
      getTenants()
    ]);

    if (!meterResult.success) {
      throw new Error(meterResult.message);
    }

    if (!roomResult.success) {
      throw new Error(roomResult.message);
    }

    if (!tenantResult.success) {
      throw new Error(tenantResult.message);
    }

  meterRecords = (
    meterResult.data ?? []
    ).map(record => ({
  ...record,

  billingMonth:
    normalizeBillingMonth(
      record.billingMonth
      )
  }));

    rooms = roomResult.data ?? [];
    tenants = tenantResult.data ?? [];

    renderRecords();
  } catch (error) {
    console.error(
      "Load meter error:",
      error
    );

    showPageMessage(
      error instanceof Error
        ? error.message
        : "ไม่สามารถโหลดข้อมูลมิเตอร์ได้",
      "error"
    );

    meterRecords = [];
    renderRecords();
  }
}

form?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    showFormMessage("");
    clearPageMessage();

    const meterInput = readForm();

    if (!meterInput) {
      return;
    }

    const isEditing =
      Boolean(editingMeterId);

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent =
        "กำลังบันทึก...";
    }

    try {
      const result = editingMeterId
        ? await updateMeter(
            editingMeterId,
            meterInput
          )
        : await createMeter(meterInput);

      if (!result.success) {
        showFormMessage(result.message);
        return;
      }

      closeForm();

      showPageMessage(
        isEditing
          ? "แก้ไขข้อมูลมิเตอร์สำเร็จ"
          : "เพิ่มข้อมูลมิเตอร์สำเร็จ",
        "success"
      );

      await loadData();
    } catch (error) {
      showFormMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถบันทึกข้อมูลได้"
      );
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = "บันทึก";
      }
    }
  }
);

tableBody?.addEventListener(
  "click",
  async event => {
    const target = event.target;

    if (!(target instanceof HTMLButtonElement)) {
      return;
    }

    const meterId =
      target.dataset.meterId;

    const action =
      target.dataset.action;

    if (!meterId) {
      return;
    }

    const record = meterRecords.find(
      item => item.meterId === meterId
    );

    if (!record) {
      return;
    }

    if (action === "edit") {
      openForm(record);
      return;
    }

    if (action !== "delete") {
      return;
    }

    const confirmed = await confirmDialog({
      title: "ลบข้อมูลมิเตอร์",
      message: `ต้องการลบข้อมูลมิเตอร์ห้อง ${record.roomNo} ประจำเดือน ${record.billingMonth} หรือไม่`,
      confirmText: "ลบข้อมูล",
      tone: "danger"
    });

    if (!confirmed) {
      return;
    }

    const result =
      await deleteMeter(meterId);

    if (!result.success) {
      showPageMessage(
        result.message,
        "error"
      );

      return;
    }

    showPageMessage(
      "ลบข้อมูลมิเตอร์สำเร็จ",
      "success"
    );

    await loadData();
  }
);

[
  waterPreviousInput,
  waterCurrentInput,
  waterRateInput,
  electricPreviousInput,
  electricCurrentInput,
  electricRateInput
].forEach(input => {
  input?.addEventListener(
    "input",
    updateCalculationPreview
  );
});

roomInput?.addEventListener(
  "change",
  autoFillPreviousReadings
);

billingMonthInput?.addEventListener(
  "change",
  autoFillPreviousReadings
);

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
  renderRecords
);

monthFilter?.addEventListener(
  "change",
  renderRecords
);

clearMonthFilterButton?.addEventListener(
  "click",
  () => {
    if (monthFilter) {
      monthFilter.value = "";
    }

    renderRecords();
  }
);

async function initializeMeterPage(): Promise<void> {
  if (!requireLogin()) {
    return;
  }

  setupLogoutButton();
  await loadData();
}

void initializeMeterPage();