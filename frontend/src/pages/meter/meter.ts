import "../shared-page.css";

import {
  requireLogin,
  setupLogoutButton
} from "../../utils/auth.guard";

function initializeMeterPage(): void {
  if (!requireLogin()) {
    return;
  }

  setupLogoutButton();
}

initializeMeterPage();