import {
  isLoggedIn,
  isOwner,
  isSuperAdmin
} from "../services/auth.service";

import { redirectToLogin } from "./auth.guard";

/**
 * เมนูหลักฝั่งซ้าย (จอเล็กเป็นแถบล่าง)
 * ใช้ร่วมกันทุกหน้า — เรียก renderSidebar()
 * หลังตรวจสิทธิ์ของหน้านั้นแล้ว
 */

interface SidebarItem {
  href: string;
  icon: string;
  label: string;
  accent?: string;
  ownerOnly?: boolean;
  superAdminOnly?: boolean;
}

const MENU_ITEMS: SidebarItem[] = [
  {
    href: "/index.html",
    icon: "🏡",
    label: "หน้าหลัก"
  },
  {
    href: "/src/pages/room/room.html",
    icon: "🛏️",
    label: "ห้องพัก"
  },
  {
    href: "/src/pages/tenant/tenant.html",
    icon: "👥",
    label: "ผู้เช่า",
    accent: "#3b82f6"
  },
  {
    href: "/src/pages/meter/meter.html",
    icon: "🔌",
    label: "มิเตอร์น้ำ-ไฟ",
    accent: "#f97316"
  },
  {
    href: "/src/pages/bill/bill.html",
    icon: "🧾",
    label: "บิล / ใบแจ้งหนี้",
    accent: "#10b981"
  },
  {
    href: "/src/pages/staff/staff.html",
    icon: "🧑‍💼",
    label: "พนักงาน",
    accent: "#14b8a6",
    ownerOnly: true
  },

  {
    href: "/src/pages/report/report.html",
    icon: "📊",
    label: "Dashboard / Report",
    accent: "#ec4899",
    ownerOnly: true
  },

  {
    href: "/src/pages/admin/users.html",
    icon: "🛡️",
    label: "จัดการผู้ใช้",
    accent: "#8b5cf6",
    superAdminOnly: true
  }
];

const PAGE_FADE_OUT_MS = 160;

/**
 * เล่น fade ออกก่อนค่อย navigate จริง (ตาม
 * keyframe page-fade-out ใน theme.css)
 */
function fadeNavigate(href: string): void {
  document.body.classList.add("page-fade-out");

  window.setTimeout(() => {
    window.location.href = href;
  }, PAGE_FADE_OUT_MS);
}

function isActivePath(href: string): boolean {
  const path = window.location.pathname;

  if (href === "/index.html") {
    return path === "/" || path === "/index.html";
  }

  return path === href;
}

function createLink(
  item: SidebarItem
): HTMLAnchorElement {
  const link = document.createElement("a");

  link.className = "sidebar-link";
  link.href = item.href;

  if (item.accent) {
    link.style.setProperty(
      "--accent",
      item.accent
    );
  }

  if (isActivePath(item.href)) {
    link.classList.add("is-active");
    link.setAttribute("aria-current", "page");
  }

  const icon = document.createElement("span");
  icon.className = "sidebar-icon";
  icon.textContent = item.icon;

  const label = document.createElement("span");
  label.textContent = item.label;

  link.append(icon, label);

  link.addEventListener("click", event => {
    if (
      item.href === "/index.html" ||
      isLoggedIn()
    ) {
      // ล็อกอินแล้ว — เล่น fade ก่อนค่อยเปลี่ยนหน้า
      if (!isActivePath(item.href)) {
        event.preventDefault();
        fadeNavigate(item.href);
      }

      return;
    }

    // ยังไม่ล็อกอิน — พาไปหน้า login
    // แล้วเด้งกลับมาหน้าที่ตั้งใจจะเข้า
    event.preventDefault();

    redirectToLogin(item.href, false);
  });

  return link;
}

const BRAND_MARK_SVG = `<svg class="brand-mark" viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M32 12.5 55 32.5a2.6 2.6 0 0 1-1.7 4.6H10.7A2.6 2.6 0 0 1 9 32.5z"/><rect x="16" y="31" width="32" height="21.5" rx="3.5"/><rect class="brand-mark-cut" x="20.5" y="35.5" width="7.5" height="7.5" rx="1.8"/><rect class="brand-mark-cut" x="36" y="35.5" width="7.5" height="7.5" rx="1.8"/><path class="brand-mark-cut" d="M27.5 46.5h9a1 1 0 0 1 1 1v5H26.5v-5a1 1 0 0 1 1-1z"/></svg>`;

export function renderSidebar(): void {
  if (document.querySelector(".app-sidebar")) {
    return;
  }

  const aside = document.createElement("aside");
  aside.className = "app-sidebar";
  aside.setAttribute("aria-label", "เมนูหลัก");

  const brand = document.createElement("a");
  brand.className = "sidebar-brand";
  brand.href = "/index.html";

  const logo = document.createElement("span");
  logo.className = "sidebar-brand-logo";
  logo.innerHTML = BRAND_MARK_SVG;

  const brandText =
    document.createElement("span");
  brandText.className = "sidebar-brand-text";

  const brandName =
    document.createElement("strong");
  brandName.textContent = "Dorm Management";

  const brandSub =
    document.createElement("small");
  brandSub.textContent = "ระบบจัดการหอพัก";

  brandText.append(brandName, brandSub);
  brand.append(logo, brandText);

  const label = document.createElement("p");
  label.className = "sidebar-label";
  label.textContent = "เมนู";

  aside.append(brand, label);

  const hideOwnerMenu =
    isLoggedIn() && !isOwner();

  // เมนูจัดการผู้ใช้เห็นเฉพาะ SUPER_ADMIN
  const superAdminUser =
    isLoggedIn() && isSuperAdmin();

  MENU_ITEMS.forEach(item => {
    if (item.ownerOnly && hideOwnerMenu) {
      return;
    }

    if (item.superAdminOnly && !superAdminUser) {
      return;
    }

    aside.append(createLink(item));
  });

  document.body.prepend(aside);
  document.body.classList.add("has-sidebar");
}
