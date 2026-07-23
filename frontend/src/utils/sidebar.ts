import {
  isLoggedIn,
  isOwner
} from "../services/auth.service";

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
}

const MENU_ITEMS: SidebarItem[] = [
  {
    href: "/index.html",
    icon: "🏠",
    label: "หน้าหลัก"
  },
  {
    href: "/src/pages/room/room.html",
    icon: "🚪",
    label: "ห้องพัก"
  },
  {
    href: "/src/pages/tenant/tenant.html",
    icon: "👤",
    label: "ผู้เช่า",
    accent: "#3b82f6"
  },
  {
    href: "/src/pages/meter/meter.html",
    icon: "⚡",
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
    href: "/src/pages/report/report.html",
    icon: "📊",
    label: "Dashboard / Report",
    accent: "#ec4899",
    ownerOnly: true
  }
];

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

  // ยังไม่ล็อกอิน — พาไปหน้า login
  // แล้วเด้งกลับมาหน้าที่ตั้งใจจะเข้า
  link.addEventListener("click", event => {
    if (
      item.href === "/index.html" ||
      isLoggedIn()
    ) {
      return;
    }

    event.preventDefault();

    sessionStorage.setItem(
      "dorm_return_url",
      item.href
    );

    window.location.href =
      `/login.html?redirect=${encodeURIComponent(
        item.href
      )}`;
  });

  return link;
}

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
  logo.textContent = "DM";

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

  MENU_ITEMS.forEach(item => {
    if (item.ownerOnly && hideOwnerMenu) {
      return;
    }

    aside.append(createLink(item));
  });

  document.body.prepend(aside);
  document.body.classList.add("has-sidebar");
}
