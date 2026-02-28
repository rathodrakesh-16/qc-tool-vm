// Main Application JavaScript
import { ROUTES } from './router/routes.js';
import { Router } from './router/Router.js';
import { loginRedirectGuard, authGuard, roleGuard } from './router/guards.js';
import { authManager } from './auth/AuthManager.js';
import { initializeAllEvents } from './events/eventHandlers.js';
import { loadAllTemplates } from './templateLoader.js';
import { APP_VERSION } from './version.js';

// Module init imports — called after templates are loaded
import { initializeLoginPage } from '../pages/login/loginPage.js';
import { initializeWorkspaceOnLoad } from '../features/workspace/workspace.js';
import { initializeTable, initializeImportSection } from '../features/qualityControl/importSection/importSection.js';
import { initializeQCReport } from '../features/qualityControl/qcReport/qcReport.js';
import { initializeExport } from '../features/qualityControl/qcReport/qcExport.js';
import { initializeQCFeedbackModal } from '../features/workspace/modals/qcFeedbackModal.js';
import { initializeChangeLogModal } from '../features/workspace/modals/changeLogModal.js';
import { initializeFilters } from '../features/workspace/sharedComponents/filters.js';

// Export router instance for use in other modules
export let router = null;

async function initializeApp() {

    // Load all HTML views into .main-content before any DOM queries
    await loadAllTemplates('.main-content');

    // Initialize all modules that need DOM access (templates are now loaded)
    await authManager.initialize();
    initializeLoginPage();
    initializeTable();
    initializeImportSection();
    initializeWorkspaceOnLoad();
    initializeQCReport();
    initializeExport();
    initializeQCFeedbackModal();
    initializeChangeLogModal();
    initializeFilters();
    initializeScrollToTop();
    initializeRouter();

    // Initialize all event listeners (Phase 7: ES Modules migration)
    initializeAllEvents();
}

/**
 * Initialize the Router system
 */
function initializeRouter() {
    router = new Router(ROUTES, {
        defaultRoute: '/dashboard',
        loginRoute: '/login'
    });

    // Add guards in order (they run sequentially)
    router.addGuard(loginRedirectGuard);
    router.addGuard(authGuard);
    router.addGuard(roleGuard);

    router.init();

}

function initializeScrollToTop() {
    const scrollIcons = document.querySelectorAll('.scroll-to-top-icon');
    const mainContent = document.querySelector('.main-content');

    if (!mainContent || scrollIcons.length === 0) {
        return;
    }

    // Find the currently active scrollable container
    function getActiveScrollable() {
        // Check for visible blank-sheet (import section, etc.)
        const visibleSheet = mainContent.querySelector('.blank-sheet[style*="display: block"], .blank-sheet[style*="display: flex"]');
        if (visibleSheet && visibleSheet.scrollHeight > visibleSheet.clientHeight) {
            return visibleSheet;
        }
        // Fallback to main-content itself
        return mainContent;
    }

    const toggleScrollIcon = () => {
        const target = getActiveScrollable();
        scrollIcons.forEach(icon => {
            if (target.scrollTop > 200) {
                icon.classList.add('visible');
            } else {
                icon.classList.remove('visible');
            }
        });
    };

    scrollIcons.forEach(icon => {
        icon.addEventListener('click', () => {
            const target = getActiveScrollable();
            target.scrollTo({
                top: 0,
                behavior: 'smooth'
            });
        });
    });

    // Listen on main-content and all blank-sheets for scroll events
    mainContent.addEventListener('scroll', toggleScrollIcon);
    document.querySelectorAll('.blank-sheet').forEach(sheet => {
        sheet.addEventListener('scroll', toggleScrollIcon);
    });
}

function showTab(tabId) {
    document.querySelectorAll('.admin-tab-content').forEach(tab => {
        tab.style.display = 'none';
    });
    document.getElementById(tabId).style.display = 'block';
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`.tab-btn[data-tab="${tabId}"]`)
        || document.querySelector(`.tab-btn[data-tab-id="${tabId}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}

document.addEventListener('DOMContentLoaded', initializeApp);



// Global click handler for closing modals
window.onclick = function (event) {
    const createModal = document.getElementById('createAccountModal');
    if (createModal && event.target == createModal) {
        if (typeof closeCreateAccountModal === 'function') closeCreateAccountModal();
    }
}

export function showChangelog() {
    alert(`Currently running ${APP_VERSION} -- Application is still under development!`);
}

// Window bridges removed - functions are exported and imported where needed


