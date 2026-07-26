/**
 * ผูกพฤติกรรม dropdown ทั่วไป: กด trigger เพื่อเปิด/ปิด
 * menu, ปิดเองเมื่อคลิกนอกเมนู/กด Escape/คลิกลิงก์ในเมนู
 * ใช้ร่วมกันทั้ง header ของ auth.guard.ts และ home.ts
 */
export function attachDropdown(
  trigger: HTMLElement,
  menu: HTMLElement
): void {
  trigger.setAttribute("aria-haspopup", "true");
  trigger.setAttribute("aria-expanded", "false");

  function close(): void {
    menu.hidden = true;
    trigger.setAttribute("aria-expanded", "false");
  }

  function open(): void {
    menu.hidden = false;
    trigger.setAttribute("aria-expanded", "true");
  }

  trigger.addEventListener("click", event => {
    event.stopPropagation();

    if (menu.hidden) {
      open();
    } else {
      close();
    }
  });

  document.addEventListener("click", event => {
    if (menu.hidden) {
      return;
    }

    const target = event.target as Node;

    if (
      !menu.contains(target) &&
      !trigger.contains(target)
    ) {
      close();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !menu.hidden) {
      close();
    }
  });

  menu.addEventListener("click", event => {
    const target = event.target as HTMLElement;

    if (target.closest("a, button")) {
      close();
    }
  });
}
