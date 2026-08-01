import "./line-guide.css";
import "../../utils/theme";

import { renderSidebar } from "../../utils/sidebar";

import {
  requireLogin,
  setupLogoutButton
} from "../../utils/auth.guard";

import { API_URL } from "../../types/api";

function initializeLineGuidePage(): void {
  if (!requireLogin()) {
    return;
  }

  setupLogoutButton();
  renderSidebar();

  const webhookUrlBox =
    document.querySelector<HTMLElement>(
      "#webhook-url-box"
    );

  if (webhookUrlBox) {
    webhookUrlBox.textContent = API_URL;
  }
}

initializeLineGuidePage();
