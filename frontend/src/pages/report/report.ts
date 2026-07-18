import "../shared-page.css";

import {
  requireLogin,
  setupLogoutButton
} from "../../utils/auth.guard";

function initializeReportPage(): void {
  if (!requireLogin()) {
    return;
  }

  setupLogoutButton();
}

initializeReportPage();