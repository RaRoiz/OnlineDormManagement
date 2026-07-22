import "./room.css";
import "../../utils/theme";

import {
  requireLogin,
  setupLogoutButton
} from "../../utils/auth.guard";

import {createRoom,deleteRoom,getRooms,updateRoom} from "../../services/room.service";

import { confirmDialog } from "../../utils/dialog";
import { showToast } from "../../utils/toast";

import type {Room,RoomInput,} from "../../types/room";

const formPanel = document.querySelector<HTMLElement>("#room-form-panel");

const form = document.querySelector<HTMLFormElement>("#room-form");

const formTitle = document.querySelector<HTMLElement>("#form-title");

const roomNoInput = document.querySelector<HTMLInputElement>("#room-no");

const floorInput = document.querySelector<HTMLInputElement>("#room-floor");

const priceInput = document.querySelector<HTMLInputElement>("#room-price");

const formMessage = document.querySelector<HTMLElement>("#form-message");

const pageMessage = document.querySelector<HTMLElement>("#page-message");

const tableBody = document.querySelector<HTMLTableSectionElement>("#room-table-body");

const searchInput = document.querySelector<HTMLInputElement>("#search-input");

const statusFilter = document.querySelector<HTMLSelectElement>("#status-filter");

const typeFilter = document.querySelector<HTMLSelectElement>("#type-filter");

const roomNoFilter = document.querySelector<HTMLSelectElement>("#room-no-filter");

const floorFilter = document.querySelector<HTMLSelectElement>("#floor-filter");

const openFormButton = document.querySelector<HTMLButtonElement>("#open-form-button");

const closeFormButton = document.querySelector<HTMLButtonElement>("#close-form-button");

const cancelButton = document.querySelector<HTMLButtonElement>("#cancel-button");

const saveButton = document.querySelector<HTMLButtonElement>("#save-button");

const roomTypeInput = document.querySelector<HTMLInputElement>("#room-type");

const roomDetailInput = document.querySelector<HTMLTextAreaElement>("#room-detail");

let rooms: Room[] = [];
let editingRoomId: string | null = null;

function formatMoney(value: number): string {
  return new Intl.NumberFormat("th-TH", {
    style: "currency",
    currency: "THB",
    minimumFractionDigits: 0
  }).format(value);
}

function escapeHtml(value: string): string {
  const element = document.createElement("div");
  element.textContent = value;
  return element.innerHTML;
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
  pageMessage.className = `page-message ${type}`;
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

function clearFormMessage(): void {
  showFormMessage("");
}

function openForm(room?: Room): void {
  if (!formPanel || !formTitle) {
    return;
  }

  clearFormMessage();
  formPanel.hidden = false;

  if (room) {
    editingRoomId = room.roomId;
    formTitle.textContent = "แก้ไขห้องพัก";

    if (roomNoInput) {
      roomNoInput.value = room.roomNo ?? "";
    }

    if (roomTypeInput) {
      roomTypeInput.value = room.roomType ?? "";
    }

    if (roomDetailInput) {
      roomDetailInput.value = room.roomDetail ?? "";
    }

    if (floorInput) {
      floorInput.value = String(room.floor ?? "");
    }

    if (priceInput) {
      priceInput.value = String(room.price ?? "");
    }
  } else {
    editingRoomId = null;
    formTitle.textContent = "เพิ่มห้องพัก";
    form?.reset();
  }

  roomNoInput?.focus();
}

function closeForm(): void {
  editingRoomId = null;
  form?.reset();
  clearFormMessage();

  if (formPanel) {
    formPanel.hidden = true;
  }
}

/** เติม select จากรายการค่า โดยคงค่าที่เลือกไว้ */
function fillSelectOptions(
  select: HTMLSelectElement | null,
  values: string[],
  allLabel: string
): void {
  if (!select) {
    return;
  }

  const previous = select.value;

  select.innerHTML =
    `<option value="">${allLabel}</option>` +
    values
      .map(value => `
        <option value="${escapeHtml(value)}">
          ${escapeHtml(value)}
        </option>
      `)
      .join("");

  select.value = previous;
}

/** เติมตัวเลือกฟิลเตอร์ทั้งหมดจากข้อมูลจริง */
function populateFilterOptions(): void {
  const unique = (values: string[]): string[] =>
    [...new Set(values.filter(Boolean))];

  fillSelectOptions(
    typeFilter,
    unique(
      rooms.map(room => room.roomType.trim())
    ).sort((a, b) => a.localeCompare(b, "th")),
    "ทุกประเภท"
  );

  fillSelectOptions(
    roomNoFilter,
    unique(
      rooms.map(room => room.roomNo.trim())
    ).sort((a, b) =>
      a.localeCompare(b, undefined, {
        numeric: true
      })
    ),
    "ทุกห้อง"
  );

  fillSelectOptions(
    floorFilter,
    unique(
      rooms.map(room => String(room.floor))
    ).sort((a, b) => Number(a) - Number(b)),
    "ทุกชั้น"
  );
}

function getFilteredRooms(): Room[] {
  const keyword =
    searchInput?.value.trim().toLowerCase() ?? "";

  const selectedStatus =
    statusFilter?.value ?? "";

  const selectedType =
    typeFilter?.value ?? "";

  return rooms.filter(room => {
    const searchableText = [
      room.roomNo,
      room.roomType,
      room.roomDetail,
      String(room.floor)
    ]
      .join(" ")
      .toLowerCase();

    const matchesKeyword =
      !keyword ||
      searchableText.includes(keyword);

    const matchesStatus =
      !selectedStatus ||
      room.status === selectedStatus;

    const matchesType =
      !selectedType ||
      room.roomType.trim() === selectedType;

    const selectedRoomNo =
      roomNoFilter?.value ?? "";

    const matchesRoomNo =
      !selectedRoomNo ||
      room.roomNo.trim() === selectedRoomNo;

    const selectedFloor =
      floorFilter?.value ?? "";

    const matchesFloor =
      !selectedFloor ||
      String(room.floor) === selectedFloor;

    return (
      matchesKeyword &&
      matchesStatus &&
      matchesType &&
      matchesRoomNo &&
      matchesFloor
    );
  });
}

function renderRooms(): void {
  if (!tableBody) {
    return;
  }

  const filteredRooms = getFilteredRooms();

  if (filteredRooms.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td class="empty-cell" colspan="7">
          ไม่พบข้อมูลห้องพัก
        </td>
      </tr>
    `;

    return;
  }

  tableBody.innerHTML = filteredRooms
    .map(room => {
      const statusClass =
        room.status === "ว่าง"
          ? "status-vacant"
          : "status-occupied";

      return `
  <tr>
    <td>
      <strong>${escapeHtml(room.roomNo)}</strong>
    </td>

    <td>
      ${escapeHtml(room.roomType || "-")}
    </td>

    <td class="room-detail-cell">
      ${escapeHtml(room.roomDetail || "-")}
    </td>

    <td>${room.floor}</td>

    <td>${formatMoney(room.price)}</td>

    <td>
      <span class="status-badge ${statusClass}">
        ${room.status}
      </span>
    </td>

    <td class="action-column">
      <button
        class="table-button edit-button"
        type="button"
        data-action="edit"
        data-room-id="${room.roomId}"
      >
        แก้ไข
      </button>

      <button
        class="table-button delete-button"
        type="button"
        data-action="delete"
        data-room-id="${room.roomId}"
      >
        ลบ
      </button>
    </td>
  </tr>
`;
    })
    .join("");
}

async function loadRooms(): Promise<void> {
  if (tableBody) {
    tableBody.innerHTML = `
      <tr>
        <td class="loading-cell" colspan="7">
          กำลังโหลดข้อมูล...
        </td>
      </tr>
    `;
  }

  try {
    clearPageMessage();

    const result = await getRooms();

    if (!result.success) {
      showPageMessage(result.message, "error");
      rooms = [];
      renderRooms();
      return;
    }

    rooms = result.data ?? [];
    populateFilterOptions();
    renderRooms();
  } catch (error) {
    console.error("Load rooms error:", error);

    showPageMessage(
      error instanceof Error
        ? error.message
        : "ไม่สามารถโหลดข้อมูลห้องพักได้",
      "error"
    );
  }
}

function readForm(): RoomInput | null {
  const roomNo =
    roomNoInput?.value.trim() ?? "";

  const roomType =
    roomTypeInput?.value.trim() ?? "";

  const roomDetail =
    roomDetailInput?.value.trim() ?? "";

  const floor = Number(floorInput?.value);
  const price = Number(priceInput?.value);

  if (!roomNo) {
    showFormMessage("กรุณากรอกเลขห้อง");
    roomNoInput?.focus();
    return null;
  }

  if (!roomType) {
    showFormMessage("กรุณาเลือกประเภทห้อง");
    roomTypeInput?.focus();
    return null;
  }

  if (!Number.isInteger(floor) || floor < 1) {
    showFormMessage("กรุณากรอกชั้นให้ถูกต้อง");
    floorInput?.focus();
    return null;
  }

  if (!Number.isFinite(price) || price < 0) {
    showFormMessage("กรุณากรอกค่าเช่าให้ถูกต้อง");
    priceInput?.focus();
    return null;
  }

  return {
    roomNo,
    roomType,
    roomDetail,
    floor,
    price
  };
}

form?.addEventListener("submit", async event => {
  event.preventDefault();
  clearFormMessage();
  clearPageMessage();

  const roomInput = readForm();

  if (!roomInput) {
    return;
  }

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "กำลังบันทึก...";
  }

  try {
    const isEditing = Boolean(editingRoomId);

    const result = editingRoomId
      ? await updateRoom(editingRoomId, roomInput)
      : await createRoom(roomInput);

    if (!result.success) {
      showFormMessage(result.message);
      return;
    }

    closeForm();

    showPageMessage(
      isEditing
        ? "แก้ไขข้อมูลห้องพักสำเร็จ"
        : "เพิ่มห้องพักสำเร็จ",
      "success"
    );

    await loadRooms();
  } catch (error) {
    console.error("Save room error:", error);

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
});

tableBody?.addEventListener("click", async event => {
  const target = event.target;

  if (!(target instanceof HTMLButtonElement)) {
    return;
  }

  const roomId = target.dataset.roomId;
  const action = target.dataset.action;

  if (!roomId) {
    return;
  }

  const room = rooms.find(
    item => item.roomId === roomId
  );

  if (!room) {
    return;
  }

  if (action === "edit") {
    openForm(room);
    return;
  }

  if (action !== "delete") {
    return;
  }

  const confirmed = await confirmDialog({
    title: "ลบห้องพัก",
    message: `ต้องการลบห้อง ${room.roomNo} หรือไม่`,
    confirmText: "ลบห้อง",
    tone: "danger"
  });

  if (!confirmed) {
    return;
  }

  target.disabled = true;

  try {
    const result = await deleteRoom(roomId);

    if (!result.success) {
      showPageMessage(result.message, "error");
      return;
    }

    showPageMessage(
      `ลบห้อง ${room.roomNo} สำเร็จ`,
      "success"
    );

    await loadRooms();
  } catch (error) {
    console.error("Delete room error:", error);

    showPageMessage(
      error instanceof Error
        ? error.message
        : "ไม่สามารถลบห้องพักได้",
      "error"
    );
  } finally {
    target.disabled = false;
  }
});

openFormButton?.addEventListener("click", () => {
  openForm();
});

closeFormButton?.addEventListener("click", closeForm);
cancelButton?.addEventListener("click", closeForm);
searchInput?.addEventListener("input", renderRooms);
statusFilter?.addEventListener("change", renderRooms);
typeFilter?.addEventListener("change", renderRooms);
roomNoFilter?.addEventListener("change", renderRooms);
floorFilter?.addEventListener("change", renderRooms);

async function initializeRoomPage(): Promise<void> {
  if (!requireLogin()) {
    return;
  }

  setupLogoutButton();
  await loadRooms();
}

void initializeRoomPage();