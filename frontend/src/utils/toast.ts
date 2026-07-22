/**
 * Toast แจ้งเตือนมุมขวาบน — เด้งเมื่อทำรายการ
 * (เพิ่ม/แก้ไข/บันทึก/ลบ) สำเร็จหรือล้มเหลว
 * หายเองใน 3.5 วินาที · สไตล์อยู่ใน styles/theme.css
 */

type ToastType = "success" | "error";

const TOAST_DURATION_MS = 3500;

function getContainer(): HTMLElement {
  let container =
    document.querySelector<HTMLElement>(
      "#toast-container"
    );

  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    document.body.append(container);
  }

  return container;
}

export function showToast(
  message: string,
  type: ToastType = "success"
): void {
  if (!message) {
    return;
  }

  const container = getContainer();

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "status");

  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.textContent =
    type === "success" ? "✓" : "✕";

  const text = document.createElement("span");
  text.textContent = message;

  toast.append(icon, text);
  container.append(toast);

  // เด้งเข้า
  requestAnimationFrame(() => {
    toast.classList.add("is-visible");
  });

  // หายเอง
  window.setTimeout(() => {
    toast.classList.remove("is-visible");

    toast.addEventListener(
      "transitionend",
      () => toast.remove(),
      { once: true }
    );

    // กันค้างกรณี transition ไม่ยิง
    window.setTimeout(
      () => toast.remove(),
      600
    );
  }, TOAST_DURATION_MS);
}
