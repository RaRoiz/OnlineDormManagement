import "./room.css";
import "../../utils/theme";

import { renderSidebar } from "../../utils/sidebar";

import {
  requireLogin,
  setupLogoutButton
} from "../../utils/auth.guard";

import {createRoom,deleteRoom,getRooms,updateRoom} from "../../services/room.service";
import { getTenants } from "../../services/tenant.service";

import { confirmDialog, detailDialog } from "../../utils/dialog";
import { showToast } from "../../utils/toast";

import type {Room,RoomInput,} from "../../types/room";
import type { Tenant } from "../../types/tenant";

const formPanel = document.querySelector<HTMLElement>("#room-form-panel");

const form = document.querySelector<HTMLFormElement>("#room-form");

const formTitle = document.querySelector<HTMLElement>("#form-title");

const roomNoInput = document.querySelector<HTMLInputElement>("#room-no");

const floorInput = document.querySelector<HTMLInputElement>("#room-floor");

const priceInput = document.querySelector<HTMLInputElement>("#room-price");

const formMessage = document.querySelector<HTMLElement>("#form-message");

const pageMessage = document.querySelector<HTMLElement>("#page-message");

const groupsContainer = document.querySelector<HTMLElement>("#room-groups");

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
let tenants: Tenant[] = [];
let editingRoomId: string | null = null;
const expandedFloors = new Set<number>();

function getActiveTenantName(
  roomId: string
): string {
  const tenant = tenants.find(
    item =>
      item.roomId === roomId &&
      item.status === "ACTIVE"
  );

  return tenant?.fullName ?? "";
}

function sortByRoomNo(a: Room, b: Room): number {
  return a.roomNo.localeCompare(b.roomNo, "th", {
    numeric: true
  });
}

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

function hasActiveFilter(): boolean {
  return Boolean(
    (searchInput?.value.trim() ?? "") ||
    (statusFilter?.value ?? "") ||
    (typeFilter?.value ?? "") ||
    (roomNoFilter?.value ?? "") ||
    (floorFilter?.value ?? "")
  );
}

function openRoomDetail(room: Room): void {
  void detailDialog(`รายละเอียดห้อง ${room.roomNo}`, [
    { label: "เลขห้อง", value: room.roomNo },
    { label: "ประเภทห้อง", value: room.roomType || "-" },
    { label: "ลักษณะห้อง", value: room.roomDetail || "-" },
    { label: "ชั้น", value: String(room.floor) },
    { label: "ค่าเช่า", value: formatMoney(room.price) },
    { label: "สถานะ", value: room.status },
    {
      label: "ผู้เช่าปัจจุบัน",
      value:
        getActiveTenantName(room.roomId) ||
        "ไม่มีผู้เช่า"
    }
  ]);
}

function renderRoomRow(room: Room): string {
  const statusClass =
    room.status === "ว่าง"
      ? "status-vacant"
      : "status-occupied";

  return `
  <tr tabindex="0" data-room-id="${room.roomId}">
    <td>
      <strong>${escapeHtml(room.roomNo)}</strong>
    </td>

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
}

function renderRooms(): void {
  if (!groupsContainer) {
    return;
  }

  const filteredRooms = getFilteredRooms();

  if (filteredRooms.length === 0) {
    groupsContainer.innerHTML = `
      <p class="empty-cell">ไม่พบข้อมูลห้องพัก</p>
    `;
    return;
  }

  const activeFilter = hasActiveFilter();

  const floors = [
    ...new Set(filteredRooms.map(room => room.floor))
  ].sort((a, b) => a - b);

  groupsContainer.innerHTML = floors
    .map(floor => {
      const floorRooms = filteredRooms
        .filter(room => room.floor === floor)
        .sort(sortByRoomNo);

      const isOpen =
        activeFilter || expandedFloors.has(floor);

      return `
    <details class="floor-group" data-floor="${floor}" ${isOpen ? "open" : ""}>
      <summary class="floor-group-summary">
        <span class="floor-group-title">
          <span class="floor-group-arrow" aria-hidden="true">▸</span>
          ชั้น ${floor}
        </span>
        <span class="floor-group-count">${floorRooms.length} ห้อง</span>
      </summary>

      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>เลขห้อง</th>
              <th>ค่าเช่า</th>
              <th>สถานะ</th>
              <th class="action-column">จัดการ</th>
            </tr>
          </thead>

          <tbody>
            ${floorRooms.map(renderRoomRow).join("")}
          </tbody>
        </table>
      </div>
    </details>
  `;
    })
    .join("");
}

async function loadRooms(): Promise<void> {
  if (groupsContainer) {
    groupsContainer.innerHTML = `
      <p class="loading-cell">กำลังโหลดข้อมูล...</p>
    `;
  }

  try {
    clearPageMessage();

    const [result, tenantsResult] =
      await Promise.all([
        getRooms(),
        getTenants()
      ]);

    if (!result.success) {
      showPageMessage(result.message, "error");
      rooms = [];
      renderRooms();
      return;
    }

    rooms = result.data ?? [];
    tenants = tenantsResult.success
      ? tenantsResult.data ?? []
      : [];

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

  const isEditing = Boolean(editingRoomId);

  const confirmed = await confirmDialog({
    title: isEditing ? "ยืนยันการแก้ไข" : "ยืนยันการเพิ่ม",
    message: `ต้องการ${
      isEditing ? "บันทึกการแก้ไข" : "เพิ่ม"
    }ห้อง ${roomInput.roomNo} หรือไม่`,
    confirmText: isEditing ? "บันทึกการแก้ไข" : "เพิ่มห้อง"
  });

  if (!confirmed) {
    return;
  }

  if (saveButton) {
    saveButton.disabled = true;
    saveButton.textContent = "กำลังบันทึก...";
  }

  try {
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

async function handleRoomAction(
  button: HTMLButtonElement
): Promise<void> {
  const roomId = button.dataset.roomId;
  const action = button.dataset.action;

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

  button.disabled = true;

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
    button.disabled = false;
  }
}

groupsContainer?.addEventListener("click", async event => {
  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  const button = target.closest("button");

  if (button instanceof HTMLButtonElement) {
    await handleRoomAction(button);
    return;
  }

  const row = target.closest("tr[data-room-id]");

  if (row instanceof HTMLTableRowElement) {
    const roomId = row.dataset.roomId;
    const room = rooms.find(item => item.roomId === roomId);

    if (room) {
      openRoomDetail(room);
    }
  }
});

groupsContainer?.addEventListener("keydown", event => {
  if (event.key !== "Enter" && event.key !== " ") {
    return;
  }

  const target = event.target;

  if (!(target instanceof HTMLElement)) {
    return;
  }

  if (target.closest("button")) {
    return;
  }

  const row = target.closest("tr[data-room-id]");

  if (row instanceof HTMLTableRowElement) {
    event.preventDefault();

    const roomId = row.dataset.roomId;
    const room = rooms.find(item => item.roomId === roomId);

    if (room) {
      openRoomDetail(room);
    }
  }
});

groupsContainer?.addEventListener(
  "toggle",
  event => {
    const details = event.target;

    if (!(details instanceof HTMLDetailsElement)) {
      return;
    }

    const floor = Number(details.dataset.floor);

    if (details.open) {
      expandedFloors.add(floor);
    } else {
      expandedFloors.delete(floor);
    }
  },
  true
);

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
  renderSidebar();
  await loadRooms();
}

void initializeRoomPage();