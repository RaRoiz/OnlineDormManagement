/**
 * Custom confirm/notify popups — replaces native window.confirm / alert
 * with styled, accessible modals. Styles live in styles/theme.css.
 */

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  tone?: "default" | "danger";
}

let activeOverlay: HTMLElement | null = null;

export function confirmDialog(
  input: ConfirmOptions | string
): Promise<boolean> {
  const options: ConfirmOptions =
    typeof input === "string"
      ? { message: input }
      : input;

  const {
    title = "ยืนยันการทำรายการ",
    message,
    confirmText = "ยืนยัน",
    cancelText = "ยกเลิก",
    tone = "default"
  } = options;

  // Only one dialog at a time
  activeOverlay?.remove();

  return new Promise<boolean>(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const heading = document.createElement("h3");
    heading.className = "modal-title";
    heading.textContent = title;

    const body = document.createElement("p");
    body.className = "modal-message";
    body.textContent = message;

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const cancelButton =
      document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className =
      "secondary-button modal-cancel";
    cancelButton.textContent = cancelText;

    const confirmButton =
      document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className =
      tone === "danger"
        ? "primary-button is-danger modal-confirm"
        : "primary-button modal-confirm";
    confirmButton.textContent = confirmText;

    actions.append(cancelButton, confirmButton);
    modal.append(heading, body, actions);
    overlay.append(modal);
    document.body.append(overlay);
    activeOverlay = overlay;

    const previousFocus =
      document.activeElement as HTMLElement | null;

    function close(result: boolean): void {
      document.removeEventListener(
        "keydown",
        onKeydown
      );

      overlay.classList.add("is-closing");

      overlay.addEventListener(
        "animationend",
        () => {
          overlay.remove();

          if (activeOverlay === overlay) {
            activeOverlay = null;
          }

          previousFocus?.focus?.();
          resolve(result);
        },
        { once: true }
      );
    }

    function onKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        close(false);
      }

      if (event.key === "Enter") {
        close(true);
      }
    }

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        close(false);
      }
    });

    cancelButton.addEventListener("click", () =>
      close(false)
    );

    confirmButton.addEventListener("click", () =>
      close(true)
    );

    document.addEventListener("keydown", onKeydown);

    // Trigger enter animation + focus
    requestAnimationFrame(() => {
      overlay.classList.add("is-open");
      confirmButton.focus();
    });
  });
}

interface PromptOptions {
  title?: string;
  message?: string;
  label?: string;
  inputType?: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  required?: boolean;
}

export function promptDialog(
  options: PromptOptions
): Promise<string | null> {
  const {
    title = "กรอกข้อมูล",
    message,
    label,
    inputType = "text",
    initialValue = "",
    placeholder = "",
    confirmText = "ยืนยัน",
    cancelText = "ยกเลิก",
    required = true
  } = options;

  activeOverlay?.remove();

  return new Promise<string | null>(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const heading = document.createElement("h3");
    heading.className = "modal-title";
    heading.textContent = title;
    modal.append(heading);

    if (message) {
      const body = document.createElement("p");
      body.className = "modal-message";
      body.textContent = message;
      modal.append(body);
    }

    const field = document.createElement("label");
    field.className = "modal-field";

    if (label) {
      const labelText =
        document.createElement("span");
      labelText.textContent = label;
      field.append(labelText);
    }

    const input = document.createElement("input");
    input.className = "modal-input";
    input.type = inputType;
    input.value = initialValue;
    input.placeholder = placeholder;
    field.append(input);
    modal.append(field);

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const cancelButton =
      document.createElement("button");
    cancelButton.type = "button";
    cancelButton.className =
      "secondary-button modal-cancel";
    cancelButton.textContent = cancelText;

    const confirmButton =
      document.createElement("button");
    confirmButton.type = "button";
    confirmButton.className =
      "primary-button modal-confirm";
    confirmButton.textContent = confirmText;

    actions.append(cancelButton, confirmButton);
    modal.append(actions);
    overlay.append(modal);
    document.body.append(overlay);
    activeOverlay = overlay;

    const previousFocus =
      document.activeElement as HTMLElement | null;

    function syncDisabled(): void {
      confirmButton.disabled =
        required && input.value.trim() === "";
    }

    function close(value: string | null): void {
      document.removeEventListener(
        "keydown",
        onKeydown
      );

      overlay.classList.add("is-closing");

      overlay.addEventListener(
        "animationend",
        () => {
          overlay.remove();

          if (activeOverlay === overlay) {
            activeOverlay = null;
          }

          previousFocus?.focus?.();
          resolve(value);
        },
        { once: true }
      );
    }

    function submit(): void {
      if (confirmButton.disabled) {
        return;
      }

      close(input.value.trim());
    }

    function onKeydown(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        close(null);
      }

      if (event.key === "Enter") {
        event.preventDefault();
        submit();
      }
    }

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        close(null);
      }
    });

    cancelButton.addEventListener("click", () =>
      close(null)
    );

    confirmButton.addEventListener("click", submit);
    input.addEventListener("input", syncDisabled);

    document.addEventListener("keydown", onKeydown);

    syncDisabled();

    requestAnimationFrame(() => {
      overlay.classList.add("is-open");
      input.focus();
      input.select();
    });
  });
}

/**
 * Popup แสดง QR code ขนาดใหญ่กลางจอ (ใช้กับ QR พร้อมเพย์)
 * พร้อมคำอธิบายสั้นๆ ใต้ภาพ — ปิดได้ทางเดียว ไม่มี confirm/cancel
 */
export function qrDialog(
  title: string,
  imageDataUrl: string,
  caption?: string
): Promise<void> {
  activeOverlay?.remove();

  return new Promise<void>(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const heading = document.createElement("h3");
    heading.className = "modal-title";
    heading.textContent = title;

    const image = document.createElement("img");
    image.className = "qr-dialog-image";
    image.src = imageDataUrl;
    image.alt = title;

    modal.append(heading, image);

    if (caption) {
      const captionEl = document.createElement("p");
      captionEl.className = "qr-dialog-caption";
      captionEl.textContent = caption;
      modal.append(captionEl);
    }

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    const closeButton =
      document.createElement("button");
    closeButton.type = "button";
    closeButton.className =
      "secondary-button modal-cancel";
    closeButton.textContent = "ปิด";

    actions.append(closeButton);
    modal.append(actions);
    overlay.append(modal);
    document.body.append(overlay);
    activeOverlay = overlay;

    const previousFocus =
      document.activeElement as HTMLElement | null;

    function close(): void {
      document.removeEventListener(
        "keydown",
        onKeydown
      );

      overlay.classList.add("is-closing");

      overlay.addEventListener(
        "animationend",
        () => {
          overlay.remove();

          if (activeOverlay === overlay) {
            activeOverlay = null;
          }

          previousFocus?.focus?.();
          resolve();
        },
        { once: true }
      );
    }

    function onKeydown(event: KeyboardEvent): void {
      if (
        event.key === "Escape" ||
        event.key === "Enter"
      ) {
        close();
      }
    }

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        close();
      }
    });

    closeButton.addEventListener("click", close);

    document.addEventListener("keydown", onKeydown);

    requestAnimationFrame(() => {
      overlay.classList.add("is-open");
      closeButton.focus();
    });
  });
}

export interface DetailField {
  label: string;
  value: string;
}

export interface DetailAction {
  label: string;
  onClick: () => void;
  tone?: "default" | "danger";
}

/**
 * Popup แสดงรายละเอียดแบบอ่านอย่างเดียว (label/value ทุกฟิลด์
 * ของเรคคอร์ด) ใช้กับการกดแถวในตารางที่คอลัมน์เยอะ — ใส่
 * actions เพิ่มได้ (เช่น "ส่ง LINE"/"แก้ไข") เพื่อทำรายการ
 * ต่อได้เลยจากในนี้ ไม่ต้องปิดแล้วไปหาปุ่มในตารางอีกที
 */
export function detailDialog(
  title: string,
  fields: DetailField[],
  actionButtons: DetailAction[] = []
): Promise<void> {
  activeOverlay?.remove();

  return new Promise<void>(resolve => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");

    const heading = document.createElement("h3");
    heading.className = "modal-title";
    heading.textContent = title;

    const list = document.createElement("dl");
    list.className = "modal-detail-list";

    fields.forEach(field => {
      const dt = document.createElement("dt");
      dt.textContent = field.label;

      const dd = document.createElement("dd");
      dd.textContent = field.value || "-";

      list.append(dt, dd);
    });

    const actions = document.createElement("div");
    actions.className = "modal-actions";

    actionButtons.forEach(action => {
      const button = document.createElement("button");
      button.type = "button";
      button.className =
        action.tone === "danger"
          ? "primary-button is-danger"
          : "secondary-button";
      button.textContent = action.label;

      button.addEventListener("click", () => {
        close();
        action.onClick();
      });

      actions.append(button);
    });

    const closeButton =
      document.createElement("button");
    closeButton.type = "button";
    closeButton.className =
      "secondary-button modal-cancel";
    closeButton.textContent = "ปิด";

    actions.append(closeButton);
    modal.append(heading, list, actions);
    overlay.append(modal);
    document.body.append(overlay);
    activeOverlay = overlay;

    const previousFocus =
      document.activeElement as HTMLElement | null;

    function close(): void {
      document.removeEventListener(
        "keydown",
        onKeydown
      );

      overlay.classList.add("is-closing");

      overlay.addEventListener(
        "animationend",
        () => {
          overlay.remove();

          if (activeOverlay === overlay) {
            activeOverlay = null;
          }

          previousFocus?.focus?.();
          resolve();
        },
        { once: true }
      );
    }

    function onKeydown(event: KeyboardEvent): void {
      if (
        event.key === "Escape" ||
        event.key === "Enter"
      ) {
        close();
      }
    }

    overlay.addEventListener("click", event => {
      if (event.target === overlay) {
        close();
      }
    });

    closeButton.addEventListener("click", close);

    document.addEventListener("keydown", onKeydown);

    requestAnimationFrame(() => {
      overlay.classList.add("is-open");
      closeButton.focus();
    });
  });
}
