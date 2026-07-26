import type { User } from "../services/auth.service";

/**
 * วาดวงกลม avatar ลงใน container ที่ส่งมา —
 * รูปโปรไฟล์ถ้ามี ไม่งั้น fallback เป็นวงกลมสีพื้น + ไอคอนคน
 * ใช้ร่วมกันทั้ง header (2 หน้า) และหน้าโปรไฟล์
 */
export function renderAvatar(
  container: HTMLElement,
  user: User | null
): void {
  container.classList.add("avatar-circle");

  if (user?.avatarUrl) {
    container.classList.add("has-photo");
    container.style.backgroundImage =
      `url(${user.avatarUrl})`;
    container.textContent = "";
  } else {
    container.classList.remove("has-photo");
    container.style.backgroundImage = "";
    container.textContent = "👤";
  }
}
