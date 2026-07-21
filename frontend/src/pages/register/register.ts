import "./register.css";

import {
  registerUser
} from "../../services/register.service";

import type {
  RegisterInput
} from "../../types/register";

const form =
  document.querySelector<HTMLFormElement>(
    "#register-form"
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

  return {
    fullName,
    username,
    password
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

  window.location.href =
  "/src/pages/Login/login.html";
      fullNameInput?.focus();
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