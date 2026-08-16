import "./register.css";
import "../../utils/theme";

import {
  getDormPublicInfo,
  registerUser
} from "../../services/register.service";

import type { RegisterInput } from "../../types/register";

/**
 * ระบบหอเดียว: สมัครผ่านหน้านี้ได้เฉพาะ "พนักงาน" และต้องมา
 * ด้วยลิงก์เชิญที่เจ้าของหอออกให้ (?code=...) เท่านั้น
 * บัญชีเจ้าของหอสร้างจาก Apps Script editor เท่านั้น
 */

const form =
  document.querySelector<HTMLFormElement>(
    "#register-form"
  );

const dormInviteNameElement =
  document.querySelector<HTMLElement>(
    "#dorm-invite-name"
  );

const fullNameInput =
  document.querySelector<HTMLInputElement>(
    "#full-name"
  );

const usernameInput =
  document.querySelector<HTMLInputElement>(
    "#username"
  );

const passwordInput =
  document.querySelector<HTMLInputElement>(
    "#password"
  );

const confirmPasswordInput =
  document.querySelector<HTMLInputElement>(
    "#confirm-password"
  );

const message =
  document.querySelector<HTMLElement>(
    "#register-message"
  );

const registerButton =
  document.querySelector<HTMLButtonElement>(
    "#register-button"
  );

let signupCode: string | null = null;

function showMessage(
  text: string,
  type: "success" | "error"
): void {
  if (!message) {
    return;
  }

  message.textContent = text;
  message.className =
    `register-message ${type}`;
}

function clearMessage(): void {
  if (!message) {
    return;
  }

  message.textContent = "";
  message.className =
    "register-message";
}

function setInviteStatus(
  text: string,
  isError: boolean
): void {
  if (!dormInviteNameElement) {
    return;
  }

  dormInviteNameElement.textContent = text;

  dormInviteNameElement.classList.toggle(
    "is-error",
    isError
  );
}

function setFormEnabled(enabled: boolean): void {
  if (registerButton) {
    registerButton.disabled = !enabled;
  }
}

/**
 * โชว์ชื่อหอให้ผู้สมัครเห็นว่ากำลังสมัครเข้าที่ไหน
 * (ตัวรหัสเชิญตรวจจริงที่ฝั่ง backend ตอนกดสมัคร —
 * ไม่ตรวจที่นี่ เพื่อไม่ให้กลายเป็นเครื่องมือเดารหัส)
 */
async function loadDormName(): Promise<void> {
  setInviteStatus("กำลังโหลดข้อมูลหอ...", false);

  try {
    const result = await getDormPublicInfo();

    if (!result.success || !result.data) {
      setInviteStatus(
        result.message || "ไม่พบข้อมูลหอ",
        true
      );

      return;
    }

    setInviteStatus(result.data.dormName, false);
  } catch (error) {
    setInviteStatus(
      error instanceof Error
        ? error.message
        : "ไม่สามารถโหลดข้อมูลหอได้",
      true
    );
  }
}

function readForm(): RegisterInput | null {
  const fullName =
    fullNameInput?.value.trim() ?? "";

  const username =
    usernameInput?.value.trim() ?? "";

  const password =
    passwordInput?.value ?? "";

  const confirmPassword =
    confirmPasswordInput?.value ?? "";

  if (!fullName) {
    showMessage(
      "กรุณากรอกชื่อและนามสกุล",
      "error"
    );

    fullNameInput?.focus();
    return null;
  }

  if (username.length < 4) {
    showMessage(
      "ชื่อผู้ใช้ต้องมีอย่างน้อย 4 ตัวอักษร",
      "error"
    );

    usernameInput?.focus();
    return null;
  }

  if (
    !/^[a-zA-Z0-9._-]+$/.test(username)
  ) {
    showMessage(
      "ชื่อผู้ใช้ใช้ได้เฉพาะภาษาอังกฤษ ตัวเลข จุด ขีดกลาง และขีดล่าง",
      "error"
    );

    usernameInput?.focus();
    return null;
  }

  if (password.length < 8) {
    showMessage(
      "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
      "error"
    );

    passwordInput?.focus();
    return null;
  }

  if (password !== confirmPassword) {
    showMessage(
      "รหัสผ่านและการยืนยันรหัสผ่านไม่ตรงกัน",
      "error"
    );

    confirmPasswordInput?.focus();
    return null;
  }

  if (!signupCode) {
    showMessage(
      "ต้องใช้ลิงก์เชิญจากเจ้าของหอ กรุณาขอลิงก์จากเจ้าของหอของคุณ",
      "error"
    );

    return null;
  }

  return {
    fullName,
    username,
    password,
    role: "USER",
    signupCode
  };
}

form?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();
    clearMessage();

    const input = readForm();

    if (!input) {
      return;
    }

    if (registerButton) {
      registerButton.disabled = true;
      registerButton.textContent =
        "กำลังเพิ่มบัญชี...";
    }

    try {
      const result =
        await registerUser(input);

      if (!result.success) {
        showMessage(
          result.message,
          "error"
        );

        return;
      }

      sessionStorage.setItem(
        "register_success_message",
        "สมัครสมาชิกสำเร็จ กรุณาเข้าสู่ระบบ"
      );

      window.location.href = "/login.html";
    } catch (error) {
      console.error(
        "Register error:",
        error
      );

      showMessage(
        error instanceof Error
          ? error.message
          : "ไม่สามารถเพิ่มบัญชีผู้ใช้ได้",
        "error"
      );
    } finally {
      if (registerButton) {
        registerButton.disabled = false;
        registerButton.textContent =
          "เพิ่มบัญชีผู้ใช้";
      }
    }
  }
);

function initializeRegisterPage(): void {
  const params = new URLSearchParams(
    window.location.search
  );

  signupCode = params.get("code");

  if (!signupCode) {
    setInviteStatus(
      "ต้องใช้ลิงก์เชิญจากเจ้าของหอ กรุณาขอลิงก์จากเจ้าของหอของคุณ",
      true
    );

    setFormEnabled(false);
    return;
  }

  setFormEnabled(true);
  void loadDormName();
}

initializeRegisterPage();
