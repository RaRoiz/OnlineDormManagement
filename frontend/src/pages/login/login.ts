import "./login.css";
import "../../utils/theme";

import {
  getCurrentUser,
  isLoggedIn,
  login
} from "../../services/auth.service";

const RETURN_URL_KEY = "dorm_return_url";

const form =
  document.querySelector<HTMLFormElement>(
    "#login-form"
  );

const usernameInput =
  document.querySelector<HTMLInputElement>(
    "#username"
  );

const passwordInput =
  document.querySelector<HTMLInputElement>(
    "#password"
  );

const usernameError =
  document.querySelector<HTMLElement>(
    "#username-error"
  );

const passwordError =
  document.querySelector<HTMLElement>(
    "#password-error"
  );

const loginMessage =
  document.querySelector<HTMLElement>(
    "#login-message"
  );

const loginButton =
  document.querySelector<HTMLButtonElement>(
    "#login-button"
  );

const loginButtonText =
  document.querySelector<HTMLElement>(
    "#login-button-text"
  );

const loginSpinner =
  document.querySelector<HTMLElement>(
    "#login-spinner"
  );

const togglePasswordButton =
  document.querySelector<HTMLButtonElement>(
    "#toggle-password"
  );

/**
 * คืน URL ที่ผู้ใช้ต้องการเข้า หลัง Login สำเร็จ
 */
function getRedirectUrl(): string {
  const searchParams =
    new URLSearchParams(window.location.search);

  const queryRedirect =
    searchParams.get("redirect");

  const storedRedirect =
    sessionStorage.getItem(RETURN_URL_KEY);

  sessionStorage.removeItem(RETURN_URL_KEY);

  const explicitRedirect =
    queryRedirect ?? storedRedirect;

  const defaultUrl = "/index.html";

  const redirectUrl =
    explicitRedirect ?? defaultUrl;

  // อนุญาตเฉพาะ URL ภายในเว็บไซต์
  if (
    !redirectUrl.startsWith("/") ||
    redirectUrl.startsWith("//")
  ) {
    return defaultUrl;
  }

  return redirectUrl;
}

const CONFETTI_COLORS = [
  "var(--brand)",
  "#3b82f6",
  "#10b981",
  "#f97316",
  "#ec4899",
  "#8b5cf6"
];

/**
 * เจ็คมาร์ก + confetti สั้นๆ ตอน login สำเร็จ
 * ก่อนค่อย redirect (คืน Promise ที่ resolve
 * เมื่อเล่นจบแล้ว)
 */
function playLoginSuccessAnimation(): Promise<void> {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "login-success-overlay";

    const check = document.createElement("div");
    check.className = "login-success-check";
    check.textContent = "✓";
    overlay.append(check);

    const dotCount = 10;

    for (let i = 0; i < dotCount; i++) {
      const dot = document.createElement("span");
      dot.className = "confetti-dot";

      const angle =
        (Math.PI * 2 * i) / dotCount +
        Math.random() * 0.4;

      const distance = 70 + Math.random() * 60;

      dot.style.setProperty(
        "--dx",
        `${Math.cos(angle) * distance}px`
      );

      dot.style.setProperty(
        "--dy",
        `${Math.sin(angle) * distance}px`
      );

      dot.style.setProperty(
        "--dot-color",
        CONFETTI_COLORS[i % CONFETTI_COLORS.length]
      );

      dot.style.setProperty(
        "--delay",
        `${0.1 + Math.random() * 0.15}s`
      );

      overlay.append(dot);
    }

    document.body.append(overlay);

    window.setTimeout(() => {
      overlay.remove();
      resolve();
    }, 800);
  });
}

function setFieldError(
  element: HTMLElement | null,
  message: string
): void {
  if (element) {
    element.textContent = message;
  }
}

function clearErrors(): void {
  setFieldError(usernameError, "");
  setFieldError(passwordError, "");

  usernameInput?.classList.remove("input-error");
  passwordInput?.classList.remove("input-error");

  if (loginMessage) {
    loginMessage.textContent = "";
    loginMessage.className = "login-message";
  }
}

function showMessage(
  message: string,
  type: "success" | "error"
): void {
  if (!loginMessage) {
    return;
  }

  loginMessage.textContent = message;
  loginMessage.className =
    `login-message ${type}`;
}

/**
 * แสดงข้อความจากหน้าสมัครสมาชิก (ถ้ามี) ครั้งเดียวตอนเปิดหน้า
 */
function showRegisterSuccessMessage(): void {
  const registerSuccessMessage =
    sessionStorage.getItem(
      "register_success_message"
    );

  if (!registerSuccessMessage) {
    return;
  }

  sessionStorage.removeItem(
    "register_success_message"
  );

  showMessage(
    registerSuccessMessage,
    "success"
  );
}

function setLoading(loading: boolean): void {
  if (loginButton) {
    loginButton.disabled = loading;
  }

  if (loginButtonText) {
    loginButtonText.textContent = loading
      ? "กำลังเข้าสู่ระบบ..."
      : "เข้าสู่ระบบ";
  }

  loginSpinner?.classList.toggle(
    "hidden",
    !loading
  );
}

function validateForm(
  username: string,
  password: string
): boolean {
  let valid = true;

  if (!username) {
    setFieldError(
      usernameError,
      "กรุณากรอกชื่อผู้ใช้"
    );

    usernameInput?.classList.add("input-error");
    valid = false;
  }

  if (!password) {
    setFieldError(
      passwordError,
      "กรุณากรอกรหัสผ่าน"
    );

    passwordInput?.classList.add("input-error");
    valid = false;
  }

  return valid;
}

togglePasswordButton?.addEventListener(
  "click",
  () => {
    if (!passwordInput) {
      return;
    }

    const currentlyHidden =
      passwordInput.type === "password";

    passwordInput.type =
      currentlyHidden ? "text" : "password";

    if (togglePasswordButton) {
      togglePasswordButton.textContent =
        currentlyHidden ? "ซ่อน" : "แสดง";
    }
  }
);

usernameInput?.addEventListener("input", () => {
  setFieldError(usernameError, "");
  usernameInput.classList.remove("input-error");
});

passwordInput?.addEventListener("input", () => {
  setFieldError(passwordError, "");
  passwordInput.classList.remove("input-error");
});

form?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();
    clearErrors();

    const username =
      usernameInput?.value.trim() ?? "";

    const password =
      passwordInput?.value ?? "";

    if (!validateForm(username, password)) {
      return;
    }

    try {
      setLoading(true);

      const result = await login(
        username,
        password
      );

      if (!result.success) {
        showMessage(
          result.message ||
            "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง",
          "error"
        );

        return;
      }

      showMessage(
        "เข้าสู่ระบบสำเร็จ",
        "success"
      );

      const redirectUrl = getRedirectUrl();

      await playLoginSuccessAnimation();
      window.location.replace(redirectUrl);
    } catch (error) {
      console.error("Login error:", error);

      const message =
        error instanceof Error
          ? error.message
          : "เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ";

      showMessage(
        `ไม่สามารถเข้าสู่ระบบได้: ${message}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  }
);

function initializeLoginPage(): void {
  if (isLoggedIn()) {
    window.location.replace(getRedirectUrl());

    return;
  }

  showRegisterSuccessMessage();
  usernameInput?.focus();
}

initializeLoginPage();