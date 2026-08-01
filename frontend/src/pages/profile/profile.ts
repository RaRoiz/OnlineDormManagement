import "./profile.css";
import "../../utils/theme";

import { renderSidebar } from "../../utils/sidebar";

import {
  requireLogin,
  setupLogoutButton
} from "../../utils/auth.guard";

import { showToast } from "../../utils/toast";
import { renderAvatar } from "../../utils/avatar";

import {
  changeOwnPassword,
  getCurrentUser,
  isOwner,
  roleLabel,
  updateOwnDorm,
  updateOwnProfile,
  uploadAvatar
} from "../../services/auth.service";

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;

const avatarPreview =
  document.querySelector<HTMLElement>(
    "#avatar-preview"
  );

const changeAvatarButton =
  document.querySelector<HTMLButtonElement>(
    "#change-avatar-button"
  );

const avatarFileInput =
  document.querySelector<HTMLInputElement>(
    "#avatar-file-input"
  );

const profileForm =
  document.querySelector<HTMLFormElement>(
    "#profile-form"
  );

const usernameInput =
  document.querySelector<HTMLInputElement>(
    "#profile-username"
  );

const roleInput =
  document.querySelector<HTMLInputElement>(
    "#profile-role"
  );

const fullNameInput =
  document.querySelector<HTMLInputElement>(
    "#profile-fullname"
  );

const phoneInput =
  document.querySelector<HTMLInputElement>(
    "#profile-phone"
  );

const profileMessage =
  document.querySelector<HTMLElement>(
    "#profile-message"
  );

const profileSaveButton =
  document.querySelector<HTMLButtonElement>(
    "#profile-save-button"
  );

const passwordForm =
  document.querySelector<HTMLFormElement>(
    "#password-form"
  );

const currentPasswordInput =
  document.querySelector<HTMLInputElement>(
    "#current-password"
  );

const newPasswordInput =
  document.querySelector<HTMLInputElement>(
    "#new-password"
  );

const confirmNewPasswordInput =
  document.querySelector<HTMLInputElement>(
    "#confirm-new-password"
  );

const passwordMessage =
  document.querySelector<HTMLElement>(
    "#password-message"
  );

const passwordSaveButton =
  document.querySelector<HTMLButtonElement>(
    "#password-save-button"
  );

const dormSection =
  document.querySelector<HTMLElement>(
    "#dorm-section"
  );

const dormForm =
  document.querySelector<HTMLFormElement>(
    "#dorm-form"
  );

const dormNameInput =
  document.querySelector<HTMLInputElement>(
    "#dorm-name-input"
  );

const promptPayIdInput =
  document.querySelector<HTMLInputElement>(
    "#promptpay-id-input"
  );

const lineTokenInput =
  document.querySelector<HTMLInputElement>(
    "#line-token-input"
  );

const lineConnectionStatus =
  document.querySelector<HTMLElement>(
    "#line-connection-status"
  );

const dormMessage =
  document.querySelector<HTMLElement>(
    "#dorm-message"
  );

const dormSaveButton =
  document.querySelector<HTMLButtonElement>(
    "#dorm-save-button"
  );

const inviteLinkInput =
  document.querySelector<HTMLInputElement>(
    "#invite-link-input"
  );

const copyInviteLinkButton =
  document.querySelector<HTMLButtonElement>(
    "#copy-invite-link-button"
  );

function setMessage(
  element: HTMLElement | null,
  text: string,
  type: "success" | "error"
): void {
  if (!element) {
    return;
  }

  element.textContent = text;
  element.className = text
    ? `page-message ${type}`
    : "page-message";
}

function loadUserIntoForm(): void {
  const user = getCurrentUser();

  if (!user) {
    return;
  }

  // ชื่อหอ + ลิงก์เชิญพนักงาน เป็นเรื่องจัดการหอ
  // ไม่ใช่ข้อมูลส่วนตัว — เห็นได้เฉพาะ OWNER
  if (dormSection && !isOwner()) {
    dormSection.hidden = true;
  }

  if (avatarPreview) {
    renderAvatar(avatarPreview, user);
  }

  if (usernameInput) {
    usernameInput.value = user.username;
  }

  if (roleInput) {
    roleInput.value = roleLabel(user.role);
  }

  if (fullNameInput) {
    fullNameInput.value = user.fullName;
  }

  if (phoneInput) {
    phoneInput.value = user.phone ?? "";
  }

  if (dormNameInput) {
    dormNameInput.value = user.dormName ?? "";
  }

  if (promptPayIdInput) {
    promptPayIdInput.value = user.promptPayId ?? "";
  }

  // ไม่ส่ง token จริงกลับมาเก็บที่ฝั่งเว็บเลย (เก็บแค่สถานะ
  // เชื่อมต่อ) ช่องนี้เลยปล่อยว่างเสมอ — ถ้าไม่แก้ ระบบจะคง
  // ค่าที่ตั้งไว้เดิม ไม่ได้แปลว่าล้างค่า
  const isLineConnected = Boolean(user.lineBotUserId);

  if (lineTokenInput) {
    lineTokenInput.placeholder = isLineConnected
      ? "•••••••••••• (ตั้งค่าไว้แล้ว — กรอกใหม่เพื่อเปลี่ยน)"
      : "วาง Channel Access Token จาก LINE Developers Console";
  }

  if (lineConnectionStatus) {
    lineConnectionStatus.textContent = isLineConnected
      ? "เชื่อมต่อแล้ว ✅"
      : "ยังไม่ได้เชื่อมต่อ";

    lineConnectionStatus.className = isLineConnected
      ? "status-badge status-paid"
      : "status-badge status-unpaid";
  }

  if (inviteLinkInput && user.dormId) {
    inviteLinkInput.value =
      `${window.location.origin}/src/pages/register/register.html?dorm=${user.dormId}`;
  }
}

function readFileAsBase64(
  file: File
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = String(
        reader.result || ""
      );

      const base64 =
        result.split(",")[1] ?? "";

      resolve(base64);
    };

    reader.onerror = () => {
      reject(new Error("ไม่สามารถอ่านไฟล์ได้"));
    };

    reader.readAsDataURL(file);
  });
}

changeAvatarButton?.addEventListener(
  "click",
  () => {
    avatarFileInput?.click();
  }
);

avatarFileInput?.addEventListener(
  "change",
  async () => {
    const file = avatarFileInput.files?.[0];

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/")) {
      showToast(
        "กรุณาเลือกไฟล์รูปภาพ",
        "error"
      );

      avatarFileInput.value = "";
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      showToast(
        "ไฟล์รูปต้องมีขนาดไม่เกิน 2MB",
        "error"
      );

      avatarFileInput.value = "";
      return;
    }

    if (changeAvatarButton) {
      changeAvatarButton.disabled = true;
      changeAvatarButton.textContent =
        "กำลังอัปโหลด...";
    }

    try {
      const base64Data =
        await readFileAsBase64(file);

      const result = await uploadAvatar(
        file.name,
        file.type,
        base64Data
      );

      if (!result.success) {
        showToast(
          result.message ||
            "อัปโหลดรูปไม่สำเร็จ",
          "error"
        );

        return;
      }

      if (avatarPreview) {
        renderAvatar(
          avatarPreview,
          getCurrentUser()
        );
      }

      showToast(
        "อัปโหลดรูปโปรไฟล์สำเร็จ",
        "success"
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : "อัปโหลดรูปไม่สำเร็จ",
        "error"
      );
    } finally {
      avatarFileInput.value = "";

      if (changeAvatarButton) {
        changeAvatarButton.disabled = false;
        changeAvatarButton.textContent =
          "เปลี่ยนรูป";
      }
    }
  }
);

profileForm?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();
    setMessage(profileMessage, "", "success");

    const fullName =
      fullNameInput?.value.trim() ?? "";

    const phone =
      phoneInput?.value.trim() ?? "";

    if (!fullName) {
      setMessage(
        profileMessage,
        "กรุณากรอกชื่อ-นามสกุล",
        "error"
      );

      return;
    }

    if (profileSaveButton) {
      profileSaveButton.disabled = true;
      profileSaveButton.textContent =
        "กำลังบันทึก...";
    }

    try {
      const result = await updateOwnProfile(
        fullName,
        phone
      );

      if (!result.success) {
        setMessage(
          profileMessage,
          result.message,
          "error"
        );

        return;
      }

      showToast(
        "บันทึกข้อมูลส่วนตัวสำเร็จ",
        "success"
      );
    } catch (error) {
      setMessage(
        profileMessage,
        error instanceof Error
          ? error.message
          : "บันทึกข้อมูลไม่สำเร็จ",
        "error"
      );
    } finally {
      if (profileSaveButton) {
        profileSaveButton.disabled = false;
        profileSaveButton.textContent =
          "บันทึกข้อมูล";
      }
    }
  }
);

passwordForm?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();
    setMessage(passwordMessage, "", "success");

    const currentPassword =
      currentPasswordInput?.value ?? "";

    const newPassword =
      newPasswordInput?.value ?? "";

    const confirmNewPassword =
      confirmNewPasswordInput?.value ?? "";

    if (!currentPassword) {
      setMessage(
        passwordMessage,
        "กรุณากรอกรหัสผ่านปัจจุบัน",
        "error"
      );

      return;
    }

    if (newPassword.length < 8) {
      setMessage(
        passwordMessage,
        "รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร",
        "error"
      );

      return;
    }

    if (newPassword !== confirmNewPassword) {
      setMessage(
        passwordMessage,
        "รหัสผ่านใหม่และการยืนยันไม่ตรงกัน",
        "error"
      );

      return;
    }

    if (passwordSaveButton) {
      passwordSaveButton.disabled = true;
      passwordSaveButton.textContent =
        "กำลังบันทึก...";
    }

    try {
      const result = await changeOwnPassword(
        currentPassword,
        newPassword
      );

      if (!result.success) {
        setMessage(
          passwordMessage,
          result.message,
          "error"
        );

        return;
      }

      passwordForm.reset();

      showToast(
        "เปลี่ยนรหัสผ่านสำเร็จ",
        "success"
      );
    } catch (error) {
      setMessage(
        passwordMessage,
        error instanceof Error
          ? error.message
          : "เปลี่ยนรหัสผ่านไม่สำเร็จ",
        "error"
      );
    } finally {
      if (passwordSaveButton) {
        passwordSaveButton.disabled = false;
        passwordSaveButton.textContent =
          "เปลี่ยนรหัสผ่าน";
      }
    }
  }
);

dormForm?.addEventListener(
  "submit",
  async event => {
    event.preventDefault();
    setMessage(dormMessage, "", "success");

    const dormName =
      dormNameInput?.value.trim() ?? "";

    const promptPayId =
      promptPayIdInput?.value.trim() ?? "";

    const lineChannelAccessToken =
      lineTokenInput?.value.trim() ?? "";

    if (!dormName) {
      setMessage(
        dormMessage,
        "กรุณากรอกชื่อหอ",
        "error"
      );

      return;
    }

    if (dormSaveButton) {
      dormSaveButton.disabled = true;
      dormSaveButton.textContent =
        "กำลังบันทึก...";
    }

    try {
      const result = await updateOwnDorm(
        dormName,
        promptPayId,
        lineChannelAccessToken
      );

      if (!result.success) {
        setMessage(
          dormMessage,
          result.message,
          "error"
        );

        return;
      }

      if (lineTokenInput) {
        lineTokenInput.value = "";
      }

      loadUserIntoForm();

      showToast("บันทึกข้อมูลหอสำเร็จ", "success");
    } catch (error) {
      setMessage(
        dormMessage,
        error instanceof Error
          ? error.message
          : "บันทึกข้อมูลหอไม่สำเร็จ",
        "error"
      );
    } finally {
      if (dormSaveButton) {
        dormSaveButton.disabled = false;
        dormSaveButton.textContent =
          "บันทึกข้อมูลหอ";
      }
    }
  }
);

copyInviteLinkButton?.addEventListener(
  "click",
  async () => {
    if (!inviteLinkInput?.value) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        inviteLinkInput.value
      );

      showToast("คัดลอกลิงก์แล้ว", "success");
    } catch {
      inviteLinkInput.select();

      showToast(
        "คัดลอกไม่สำเร็จ ลองกด Ctrl+C เอง",
        "error"
      );
    }
  }
);

function initializeProfilePage(): void {
  if (!requireLogin()) {
    return;
  }

  setupLogoutButton();
  renderSidebar();
  loadUserIntoForm();
}

initializeProfilePage();
