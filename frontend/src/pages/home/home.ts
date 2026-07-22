import "./home.css";
import "../../utils/theme";

import {
  getCurrentUser,
  isLoggedIn,
  isOwner,
  logout
} from "../../services/auth.service";

const protectedLinks =
  document.querySelectorAll<HTMLAnchorElement>(
    "[data-protected-link]"
  );

const authButton =
  document.querySelector<HTMLButtonElement>(
    "#auth-button"
  );

const userInfo =
  document.querySelector<HTMLElement>(
    "#user-info"
  );

const currentUserElement =
  document.querySelector<HTMLElement>(
    "#current-user"
  );

const currentRoleElement =
  document.querySelector<HTMLElement>(
    "#current-role"
  );

function updateHome(): void {
  const loggedIn = isLoggedIn();
  const user = getCurrentUser();

  if (loggedIn && user) {
    if (userInfo) {
      userInfo.hidden = false;
    }

    if (currentUserElement) {
      currentUserElement.textContent =
        user.fullName || user.username;
    }

    if (currentRoleElement) {
      currentRoleElement.textContent = user.role;
    }

    if (authButton) {
      authButton.textContent = "ออกจากระบบ";
      authButton.dataset.action = "logout";
    }
  } else {
    if (userInfo) {
      userInfo.hidden = true;
    }

    if (authButton) {
      authButton.textContent = "เข้าสู่ระบบ";
      authButton.dataset.action = "login";
    }
  }

  document
    .querySelectorAll<HTMLElement>(
      ".menu-status"
    )
    .forEach(element => {
      element.textContent = "→";
    });

  // เมนูเฉพาะ OWNER (เช่น Dashboard / Report)
  // ซ่อนเมื่อล็อกอินด้วยบทบาทอื่น
  document
    .querySelectorAll<HTMLElement>(
      "[data-owner-only]"
    )
    .forEach(element => {
      element.hidden =
        loggedIn && !isOwner();
    });
}

protectedLinks.forEach(link => {
  link.addEventListener("click", event => {
    if (isLoggedIn()) {
      return;
    }

    event.preventDefault();

    const destination =
      link.getAttribute("href") ||
      "/index.html";

    sessionStorage.setItem(
      "dorm_return_url",
      destination
    );

    window.location.href =
      `/login.html?redirect=${encodeURIComponent(
        destination
      )}`;
  });
});

authButton?.addEventListener("click", async () => {
  if (
    authButton.dataset.action !== "logout"
  ) {
    window.location.href = "/login.html";
    return;
  }

  authButton.disabled = true;

  try {
    await logout();
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    window.location.href = "/index.html";
  }
});

updateHome();