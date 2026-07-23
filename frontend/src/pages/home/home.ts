import "./home.css";
import "../../utils/theme";

import { renderSidebar } from "../../utils/sidebar";

import {
  getCurrentUser,
  isLoggedIn,
  isOwner,
  logout,
  roleLabel
} from "../../services/auth.service";

import { getRooms } from "../../services/room.service";
import { getTenants } from "../../services/tenant.service";

import type { Room } from "../../types/room";
import type { Tenant } from "../../types/tenant";

const authButton =
  document.querySelector<HTMLButtonElement>(
    "#auth-button"
  );

const heroLoginButton =
  document.querySelector<HTMLButtonElement>(
    "#hero-login-button"
  );

const userInfo =
  document.querySelector<HTMLElement>(
    "#user-info"
  );

const currentUserElement =
  document.querySelector<HTMLElement>(
    "#current-user"
  );

const currentRoleElement =
  document.querySelector<HTMLElement>(
    "#current-role"
  );

const welcomeHero =
  document.querySelector<HTMLElement>(
    "#welcome-hero"
  );

const dashboardSection =
  document.querySelector<HTMLElement>(
    "#dashboard-section"
  );

const dashboardMessage =
  document.querySelector<HTMLElement>(
    "#dashboard-message"
  );

/* =========================
   Helpers
========================= */

function thaiMonthLabel(): string {
  return new Intl.DateTimeFormat("th-TH", {
    month: "long",
    year: "numeric"
  }).format(new Date());
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

function sortByRoomNo(
  a: Room,
  b: Room
): number {
  return a.roomNo.localeCompare(
    b.roomNo,
    "th",
    { numeric: true }
  );
}

/* =========================
   Auth state → layout
========================= */

function updateHome(): void {
  const loggedIn = isLoggedIn();
  const user = getCurrentUser();

  if (welcomeHero) {
    welcomeHero.hidden = loggedIn;
  }

  if (dashboardSection) {
    dashboardSection.hidden = !loggedIn;
  }

  if (loggedIn && user) {
    if (userInfo) {
      userInfo.hidden = false;
    }

    if (currentUserElement) {
      currentUserElement.textContent =
        user.fullName || user.username;
    }

    if (currentRoleElement) {
      currentRoleElement.textContent =
        roleLabel(user.role);
    }

    if (authButton) {
      authButton.textContent = "ออกจากระบบ";
      authButton.dataset.action = "logout";
    }
  } else {
    if (userInfo) {
      userInfo.hidden = true;
    }

    if (authButton) {
      authButton.textContent = "เข้าสู่ระบบ";
      authButton.dataset.action = "login";
    }
  }

  // CSS ใช้ซ่อนสิ่งที่ USER ไม่มีสิทธิ์เห็น
  document.body.classList.toggle(
    "role-user",
    loggedIn && !isOwner()
  );
}

/* =========================
   Dashboard rendering
========================= */

function renderStats(rooms: Room[]): void {
  const totalRooms = rooms.length;

  const vacantRooms = rooms.filter(
    room => room.status === "ว่าง"
  ).length;

  const occupiedRooms =
    totalRooms - vacantRooms;

  setText(
    "#stat-total-rooms",
    `${totalRooms} ห้อง`
  );

  setText(
    "#stat-vacant-rooms",
    `${vacantRooms} ห้อง`
  );

  setText(
    "#stat-occupied-rooms",
    `${occupiedRooms} ห้อง`
  );
}

function renderOccupiedRooms(
  rooms: Room[],
  tenants: Tenant[]
): void {
  const list =
    document.querySelector<HTMLElement>(
      "#occupied-room-list"
    );

  if (!list) {
    return;
  }

  // จับคู่ห้อง → ชื่อผู้เช่าที่กำลังพักอยู่
  const tenantByRoomId = new Map<
    string,
    string
  >();

  tenants.forEach(tenant => {
    if (tenant.status === "ACTIVE") {
      tenantByRoomId.set(
        tenant.roomId,
        tenant.fullName
      );
    }
  });

  const occupied = rooms
    .filter(
      room => room.status === "ไม่ว่าง"
    )
    .sort(sortByRoomNo);

  list.innerHTML = "";

  if (occupied.length === 0) {
    const empty =
      document.createElement("li");

    empty.className = "mini-empty";
    empty.textContent =
      "ยังไม่มีห้องที่มีผู้เช่า";

    list.append(empty);
    return;
  }

  occupied.forEach(room => {
    const item = document.createElement("li");
    item.className = "mini-item";

    const roomNo =
      document.createElement("span");
    roomNo.className = "mini-room";
    roomNo.textContent = room.roomNo;

    const info = document.createElement("div");
    info.className = "mini-info";

    const name =
      document.createElement("strong");
    name.textContent =
      tenantByRoomId.get(room.roomId) ||
      "ไม่พบชื่อผู้เช่า";

    info.append(name);

    item.append(roomNo, info);
    list.append(item);
  });
}

function renderVacantRooms(
  rooms: Room[]
): void {
  const list =
    document.querySelector<HTMLElement>(
      "#vacant-room-list"
    );

  if (!list) {
    return;
  }

  const vacant = rooms
    .filter(room => room.status === "ว่าง")
    .sort(sortByRoomNo);

  list.innerHTML = "";

  if (vacant.length === 0) {
    const empty =
      document.createElement("span");

    empty.className = "mini-empty";
    empty.textContent =
      "ตอนนี้ห้องเต็มทุกห้อง";

    list.append(empty);
    return;
  }

  vacant.forEach(room => {
    const chip =
      document.createElement("span");

    chip.className = "room-chip";
    chip.textContent = `ห้อง ${room.roomNo}`;

    if (room.roomType) {
      const type =
        document.createElement("small");

      type.textContent = room.roomType;
      chip.append(type);
    }

    list.append(chip);
  });
}

async function loadDashboard(): Promise<void> {
  setText(
    "#dashboard-subtitle",
    `สรุปข้อมูลเดือน${thaiMonthLabel()}`
  );

  try {
    const [roomResult, tenantResult] =
      await Promise.all([
        getRooms(),
        getTenants()
      ]);

    if (
      !roomResult.success ||
      !tenantResult.success
    ) {
      throw new Error(
        roomResult.message ||
        tenantResult.message
      );
    }

    const rooms = roomResult.data ?? [];
    const tenants = tenantResult.data ?? [];

    renderStats(rooms);
    renderOccupiedRooms(rooms, tenants);
    renderVacantRooms(rooms);
  } catch (error) {
    console.error(
      "Dashboard error:",
      error
    );

    if (dashboardMessage) {
      dashboardMessage.textContent =
        error instanceof Error
          ? error.message
          : "ไม่สามารถโหลดข้อมูลภาพรวมได้";

      dashboardMessage.className =
        "page-message error";
    }
  }
}

/* =========================
   Events + init
========================= */

authButton?.addEventListener("click", async () => {
  if (
    authButton.dataset.action !== "logout"
  ) {
    window.location.href = "/login.html";
    return;
  }

  authButton.disabled = true;

  try {
    await logout();
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    window.location.href = "/index.html";
  }
});

heroLoginButton?.addEventListener(
  "click",
  () => {
    window.location.href = "/login.html";
  }
);

renderSidebar();
updateHome();

if (isLoggedIn()) {
  void loadDashboard();
}
