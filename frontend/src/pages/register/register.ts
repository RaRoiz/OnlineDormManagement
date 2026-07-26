import "./register.css";
import "../../utils/theme";

import {
  getDormPublicInfo,
  registerUser
} from "../../services/register.service";

import type {
  RegisterInput,
  RegisterRole
} from "../../types/register";

const form =
  document.querySelector<HTMLFormElement>(
    "#register-form"
  );

const ownerTab =
  document.querySelector<HTMLButtonElement>(
    "#role-owner-tab"
  );

const staffTab =
  document.querySelector<HTMLButtonElement>(
    "#role-staff-tab"
  );

const dormNameGroup =
  document.querySelector<HTMLElement>(
    "#dorm-name-group"
  );

const dormNameInput =
  document.querySelector<HTMLInputElement>(
    "#dorm-name"
  );

const dormInviteGroup =
  document.querySelector<HTMLElement>(
    "#dorm-invite-group"
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

let currentRole: RegisterRole = "OWNER";
let inviteDormId: string | null = null;

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

function applyRoleView(): void {
  ownerTab?.classList.toggle(
    "is-active",
    currentRole === "OWNER"
  );

  staffTab?.classList.toggle(
    "is-active",
    currentRole === "USER"
  );

  if (dormNameGroup) {
    dormNameGroup.hidden =
      currentRole !== "OWNER";
  }

  if (dormInviteGroup) {
    dormInviteGroup.hidden =
      currentRole !== "USER";
  }

  if (currentRole === "USER" && !inviteDormId) {
    setInviteStatus(
      "ต้องใช้ลิงก์เชิญจากเจ้าของหอ กรุณาขอลิงก์จากเจ้าของหอของคุณ",
      true
    );

    if (registerButton) {
      registerButton.disabled = true;
    }
  } else if (registerButton) {
    registerButton.disabled = false;
  }
}

async function resolveInviteDorm(
  dormId: string
): Promise<void> {
  setInviteStatus("กำลังตรวจสอบลิงก์...", false);

  try {
    const result = await getDormPublicInfo(dormId);

    if (!result.success || !result.data) {
      inviteDormId = null;
      setInviteStatus(
        result.message || "ไม่พบหอที่ระบุ",
        true
      );

      applyRoleView();
      return;
    }

    inviteDormId = dormId;
    setInviteStatus(result.data.dormName, false);
    applyRoleView();
  } catch (error) {
    inviteDormId = null;

    setInviteStatus(
      error instanceof Error
        ? error.message
        : "ไม่สามารถตรวจสอบลิงก์ได้",
      true
    );

    applyRoleView();
  }
}

ownerTab?.addEventListener("click", () => {
  currentRole = "OWNER";
  applyRoleView();
});

staffTab?.addEventListener("click", () => {
  currentRole = "USER";
  applyRoleView();
});

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

  if (currentRole === "OWNER") {
    const dormName =
      dormNameInput?.value.trim() ?? "";

    if (!dormName) {
      showMessage(
        "กรุณากรอกชื่อหอ",
        "error"
      );

      dormNameInput?.focus();
      return null;
    }

    return {
      fullName,
      username,
      password,
      role: "OWNER",
      dormName
    };
  }

  if (!inviteDormId) {
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
    dormId: inviteDormId
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

  const dormParam = params.get("dorm");

  if (dormParam) {
    currentRole = "USER";
    applyRoleView();
    void resolveInviteDorm(dormParam);
    return;
  }

  currentRole = "OWNER";
  applyRoleView();
}

initializeRegisterPage();
