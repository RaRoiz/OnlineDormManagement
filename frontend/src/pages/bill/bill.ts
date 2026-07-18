import "../shared-page.css";

import {
  requireLogin,
  setupLogoutButton
} from "../../utils/auth.guard";

function initializeBillPage(): void {
  if (!requireLogin()) {
    return;
  }

  setupLogoutButton();
}

initializeBillPage();