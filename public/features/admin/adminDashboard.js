// scripts/pages/adminDashboard.js
import { handleLogout } from '../../pages/login/loginPage.js';
import {
    renderUserManagementSectionMarkup,
    initializeUserManagementSection,
} from './sections/userManagementSection.js';

function initializeAdminPanelEvents() {
    const logoutBtn = document.querySelector('.admin-logout-btn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            handleLogout(e.currentTarget);
        });
    }
}

export function renderAdminDashboard() {
    const container = document.getElementById('adminPanel');
    if (!container) return;

    container.innerHTML = `
      <div class="admin-header-container">
        <h1>Admin Dashboard</h1>
        <div class="admin-header-right">
          <button class="admin-logout-btn">
              <i class="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>
      </div>

      <div class="admin-panel" id="admin-users-tab" style="display: block;">
        ${renderUserManagementSectionMarkup()}
      </div>

      <span class="scroll-to-top-icon" title="Scroll to Top">
        <i class="fas fa-chevron-up"></i>
      </span>
    `;

    initializeAdminPanelEvents();
    initializeAdminPanel();
}

export function initializeAdminPanel() {
    initializeUserManagementSection();
}
