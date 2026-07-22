import "./tenant.css";
import "../../utils/theme";

import {
  requireLogin,
  setupLogoutButton
} from "../../utils/auth.guard";

import {
  createTenant,
  deleteTenant,
  getTenants,
  checkoutTenant,
  updateTenant
} from "../../services/tenant.service";

import {
  confirmDialog,
  promptDialog
} from "../../utils/dialog";

import {
  getRooms
} from "../../services/room.service";

import type {
  Tenant,
  TenantInput
} from "../../types/tenant";

import type {
  Room
} from "../../types/room";

const formPanel = document.querySelector<HTMLElement>("#tenant-form-panel");

const form = document.querySelector<HTMLFormElement>("#tenant-form");

const formTitle = document.querySelector<HTMLElement>("#form-title");

const fullNameInput = document.querySelector<HTMLInputElement>("#full-name");

const citizenIdInput = document.querySelector<HTMLInputElement>("#citizen-id");

const phoneInput = document.querySelector<HTMLInputElement>("#phone");

const roomInput = document.querySelector<HTMLSelectElement>("#tenant-room");

const checkInDateInput = document.querySelector<HTMLInputElement>("#check-in-date");

const formMessage = document.querySelector<HTMLElement>("#form-message");

const pageMessage = document.querySelector<HTMLElement>("#page-message");

const tableBody = document.querySelector<HTMLTableSectionElement>("#tenant-table-body");

const searchInput = document.querySelector<HTMLInputElement>("#search-input");

const statusFilter = document.querySelector<HTMLSelectElement>("#status-filter");

const openFormButton = document.querySelector<HTMLButtonElement>("#open-form-button");

const closeFormButton = document.querySelector<HTMLButtonElement>("#close-form-button");

const cancelButton = document.querySelector<HTMLButtonElement>("#cancel-button");

const saveButton = document.querySelector<HTMLButtonElement>("#save-button");

const lineIdInput = document.querySelector<HTMLInputElement>("#line-id");

const emailInput = document.querySelector<HTMLInputElement>("#email");

let tenants: Tenant[] = [];
let rooms: Room[] = [];

let editingTenantId: string | null = null;

function escapeHtml(value: string): string {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
}

function formatDateTime(value: string): string {
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
 * คืนค่าวันและเวลาปัจจุบันในรูปแบบของ input[type="datetime-local"]
 * (YYYY-MM-DDTHH:mm) โดยอิงเวลาท้องถิ่นของเครื่อง
 */
function nowDateTimeLocal(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset();

  return new Date(
    now.getTime() - offset * 60 * 1000
  )
    .toISOString()
    .slice(0, 16);
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
  pageMessage.className = "page-message";
}

function showFormMessage(message: string): void {
  if (formMessage) {
    formMessage.textContent = message;
  }
}

function populateRoomOptions(
  currentRoomId = ""
): void {
  if (!roomInput) {
    return;
  }

  const selectableRooms = rooms.filter(room => {
    return (
      room.status === "ว่าง" ||
      room.roomId === currentRoomId
    );
  });

  roomInput.innerHTML = `
    <option value="">
      เลือกห้องพัก
    </option>

    ${selectableRooms
      .map(room => `
        <option value="${escapeHtml(room.roomId)}">
          ห้อง ${escapeHtml(room.roomNo)}
          — ${escapeHtml(room.roomType || "-")}
        </option>
      `)
      .join("")}
  `;

  roomInput.value = currentRoomId;
}

function toDateTimeLocalValue(value: string): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 16);
  }

  const offset = date.getTimezoneOffset();
  const local = new Date(
    date.getTime() - offset * 60 * 1000
  );

  return local.toISOString().slice(0, 16);
}

function openForm(tenant?: Tenant): void {
  if (!formPanel || !formTitle) {
    return;
  }

  formPanel.hidden = false;
  showFormMessage("");

  if (tenant) {
    editingTenantId = tenant.tenantId;
    formTitle.textContent = "แก้ไขผู้เช่า";

    if (fullNameInput) {
      fullNameInput.value = tenant.fullName ?? "";
    }

    if (citizenIdInput) {
      citizenIdInput.value = tenant.citizenId ?? "";
    }

    if (phoneInput) {
      phoneInput.value = tenant.phone ?? "";
    }

    if (lineIdInput) {
      lineIdInput.value = tenant.lineId ?? "";
    }

    if (emailInput) {
      emailInput.value = tenant.email ?? "";
    }

    if (checkInDateInput) {
      checkInDateInput.value =
        toDateTimeLocalValue(tenant.checkInDate);
    }

    populateRoomOptions(tenant.roomId);
  } else {
    editingTenantId = null;
    formTitle.textContent = "เพิ่มผู้เช่า";

    form?.reset();
    populateRoomOptions();

    if (checkInDateInput) {
      checkInDateInput.value =
        nowDateTimeLocal();
    }
  }

  fullNameInput?.focus();

  formPanel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function closeForm(): void {
  editingTenantId = null;
  form?.reset();
  showFormMessage("");

  if (formPanel) {
    formPanel.hidden = true;
  }
}

function readForm(): TenantInput | null {
  const fullName =
    fullNameInput?.value.trim() ?? "";

  const citizenId =
    citizenIdInput?.value.trim() ?? "";

  const phoneRaw =
    phoneInput?.value.trim() ?? "";

  const lineId =
    lineIdInput?.value.trim() ?? "";

  const email =
    emailInput?.value.trim() ?? "";

  const roomId =
    roomInput?.value.trim() ?? "";

  const checkInDate =
    checkInDateInput?.value ?? "";

  const phone = phoneRaw.replace(/\D/g, "");

  if (!fullName) {
    showFormMessage("กรุณากรอกชื่อผู้เช่า");
    fullNameInput?.focus();
    return null;
  }

  if (!citizenId) {
    showFormMessage(
      "กรุณากรอกเลขบัตรประชาชนหรือ Passport"
    );
    citizenIdInput?.focus();
    return null;
  }

  if (!/^\d{10}$/.test(phone)) {
    showFormMessage(
      "เบอร์โทรต้องเป็นตัวเลข 10 หลัก"
    );
    phoneInput?.focus();
    return null;
  }

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFormMessage("รูปแบบ E-mail ไม่ถูกต้อง");
    emailInput?.focus();
    return null;
  }

  if (!roomId) {
    showFormMessage("กรุณาเลือกห้องพัก");
    roomInput?.focus();
    return null;
  }

  if (!checkInDate) {
    showFormMessage("กรุณาเลือกวันและเวลาเข้าพัก");
    checkInDateInput?.focus();
    return null;
  }

  return {
    fullName,
    citizenId,
    phone,
    lineId,
    email,
    roomId,
    checkInDate
  };
}

function getFilteredTenants(): Tenant[] {
  const keyword =
    searchInput?.value.trim().toLowerCase() ?? "";

  const selectedStatus =
    statusFilter?.value ?? "";

  return tenants.filter(tenant => {
    const searchableText = [
      tenant.fullName,
      tenant.citizenId,
      tenant.phone,
      tenant.lineId,
      tenant.email,
      tenant.roomNo
    ]
      .join(" ")
      .toLowerCase();

    const matchesSearch =
      !keyword ||
      searchableText.includes(keyword);

    const matchesStatus =
      !selectedStatus ||
      tenant.status === selectedStatus;

    return matchesSearch && matchesStatus;
  });
}

function renderTenants(): void {
  if (!tableBody) {
    return;
  }

  const filteredTenants =
    getFilteredTenants();

  if (filteredTenants.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td class="empty-cell" colspan="10">
          ไม่พบข้อมูลผู้เช่า
        </td>
      </tr>
    `;
    return;
  }

  tableBody.innerHTML = filteredTenants
    .map(tenant => {
      const active =
        tenant.status === "ACTIVE";

      const statusText = active
        ? "กำลังพัก"
        : "ย้ายออกแล้ว";

      const statusClass = active
        ? "status-active"
        : "status-inactive";

      return `
        <tr>
          <td><strong>${escapeHtml(tenant.fullName)}</strong></td>
          <td>${escapeHtml(tenant.citizenId)}</td>
          <td>${escapeHtml(tenant.phone || "-")}</td>
          <td>${escapeHtml(tenant.lineId || "-")}</td>
          <td>${escapeHtml(tenant.email || "-")}</td>
          <td>${escapeHtml(tenant.roomNo || "-")}</td>
          <td>${formatDateTime(tenant.checkInDate)}</td>
          <td>${formatDateTime(tenant.checkOutDate)}</td>
          <td>
            <span class="status-badge ${statusClass}">
              ${statusText}
            </span>
          </td>
          <td class="action-column">
            ${
              active
                ? `
                  <button
                    class="table-button edit-button"
                    type="button"
                    data-action="edit"
                    data-tenant-id="${tenant.tenantId}"
                  >
                    แก้ไข
                  </button>

                  <button
                    class="table-button checkout-button"
                    type="button"
                    data-action="checkout"
                    data-tenant-id="${tenant.tenantId}"
                  >
                    ย้ายออก
                  </button>
                `
                : `
                  <button
                    class="table-button delete-button"
                    type="button"
                    data-action="delete"
                    data-tenant-id="${tenant.tenantId}"
                  >
                    ลบ
                  </button>
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

    const [tenantResult, roomResult] =
      await Promise.all([
        getTenants(),
        getRooms()
      ]);

    if (!tenantResult.success) {
      throw new Error(tenantResult.message);
    }

    if (!roomResult.success) {
      throw new Error(roomResult.message);
    }

    tenants = tenantResult.data ?? [];
    rooms = roomResult.data ?? [];

    renderTenants();
  } catch (error) {
    console.error("Load tenant error:", error);

    showPageMessage(
      error instanceof Error
        ? error.message
        : "ไม่สามารถโหลดข้อมูลผู้เช่าได้",
      "error"
    );

    tenants = [];
    renderTenants();
  }
}

form?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    showFormMessage("");
    clearPageMessage();

    const tenantInput = readForm();

    if (!tenantInput) {
      return;
    }

    const isEditing =
      Boolean(editingTenantId);

    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent =
        "กำลังบันทึก...";
    }

    try {
      const result = editingTenantId
        ? await updateTenant(
            editingTenantId,
            tenantInput
          )
        : await createTenant(tenantInput);

      if (!result.success) {
        showFormMessage(result.message);
        return;
      }

      closeForm();

      showPageMessage(
        isEditing
          ? "แก้ไขข้อมูลผู้เช่าสำเร็จ"
          : "เพิ่มผู้เช่าสำเร็จ",
        "success"
      );

      await loadData();
    } catch (error) {
      console.error("Save tenant error:", error);

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

    const tenantId =
      target.dataset.tenantId;

    const action =
      target.dataset.action;

    if (!tenantId) {
      return;
    }

    const tenant = tenants.find(
      item => item.tenantId === tenantId
    );

    if (!tenant) {
      return;
    }

    if (action === "edit") {
      openForm(tenant);
      return;
    }

    if (action === "checkout") {
      const checkOutDate = await promptDialog({
        title: "ยืนยันการย้ายออก",
        message: `บันทึกการย้ายออกของ ${tenant.fullName}`,
        label: "วันที่และเวลาย้ายออก",
        inputType: "datetime-local",
        initialValue: nowDateTimeLocal(),
        confirmText: "ย้ายออก"
      });

      if (!checkOutDate) {
        return;
      }

      target.disabled = true;

      try {
        const result = await checkoutTenant(
          tenantId,
          checkOutDate
        );

        if (!result.success) {
          showPageMessage(
            result.message,
            "error"
          );

          return;
        }

        showPageMessage(
          "บันทึกการย้ายออกสำเร็จ",
          "success"
        );

        await loadData();
      } catch (error) {
        console.error(
          "Checkout tenant error:",
          error
        );

        showPageMessage(
          error instanceof Error
            ? error.message
            : "ไม่สามารถบันทึกการย้ายออกได้",
          "error"
        );
      } finally {
        target.disabled = false;
      }

      return;
    }

    if (action === "delete") {
      const confirmed = await confirmDialog({
        title: "ลบประวัติผู้เช่า",
        message: `ต้องการลบประวัติของ ${tenant.fullName} หรือไม่`,
        confirmText: "ลบประวัติ",
        tone: "danger"
      });

      if (!confirmed) {
        return;
      }

      target.disabled = true;

      try {
        const result = await deleteTenant(
          tenantId
        );

        if (!result.success) {
          showPageMessage(
            result.message,
            "error"
          );

          return;
        }

        showPageMessage(
          "ลบข้อมูลผู้เช่าสำเร็จ",
          "success"
        );

        await loadData();
      } catch (error) {
        console.error(
          "Delete tenant error:",
          error
        );

        showPageMessage(
          error instanceof Error
            ? error.message
            : "ไม่สามารถลบข้อมูลผู้เช่าได้",
          "error"
        );
      } finally {
        target.disabled = false;
      }
    }
  }
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
  renderTenants
);

statusFilter?.addEventListener(
  "change",
  renderTenants
);

async function initializeTenantPage(): Promise<void> {
  if (!requireLogin()) {
    return;
  }

  setupLogoutButton();
  await loadData();
}

void initializeTenantPage();
