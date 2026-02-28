// Centralized Event Handler Module for ES Modules Migration
// Purpose: Replace all inline onclick handlers with programmatic addEventListener

// Core imports
import { router } from '../app.js';
import { authManager } from '../auth/AuthManager.js';

// Login page imports
import { handleLogin, togglePassword } from '../../pages/login/loginPage.js';

// User profile imports
import { openUserProfilePage } from '../../pages/user/userProfilePage.js';

// Dashboard imports
import {
    previousPage,
    nextPage,
    updateAccountStatus,
    viewAccountInWorkspace
} from '../../features/dashboard/dashboard.js';

// Modal imports
import {
    openCreateAccountModal,
    closeCreateAccountModal
} from '../../features/dashboard/modals/accountManagementModal.js';

import { openDocumentManagementModal, closeDocumentManagementModal } from '../../features/dashboard/modals/documentManagementModal.js';
import { QCFeedbackModal } from '../../features/workspace/modals/qcFeedbackModal.js';

// Import Section imports
import {
    switchImportSectionTab,
    generateDetails,
    clearClassificationDetails,
    toggleNestedButtons,
    importData
} from '../../features/qualityControl/importSection/importSection.js';

// Workspace imports
import { getWorkspaceEntryRoute, setWorkspaceMode, updateWorkspaceSettingsModeHighlight } from '../../features/workspace/workspace.js';
import { switchEditorTab } from '../../features/workspace/editor/editorWorkspace.js';
import { toggleProductionReportSection } from '../../features/workspace/editor/production.js';
import { PdmUtils } from '../../features/workspace/sharedComponents/pdmUtils.js';

// QC imports
import { switchQCTab } from '../../features/workspace/qc/qcWorkspace.js';
import { switchReportView } from '../../features/workspace/qc/workspaceQcReport.js';

// App-level imports
import { showChangelog } from '../app.js';

/**
 * Main initialization function - called after DOM is ready
 */
export function initializeAllEvents() {

    initializeLoginEvents();
    initializeSidebarEvents();
    initializeDashboardEvents();
    initializeImportSectionEvents();
    initializeWorkspaceEvents();
    initializeProductionEvents();
    initializeQCEvents();
    initializeModalEvents();
    initializeUserProfileEvents();

    // Re-initialize import section events when the sheet is shown
    document.addEventListener('showSheet', (e) => {
        if (e.detail === 'importSection') {
            // Wait a bit for DOM to be ready
            setTimeout(() => {
                initializeImportSectionEvents();
            }, 100);
        }
    });

}

/**
 * Initialize login page event handlers
 */
function initializeLoginEvents() {
    const loginBtn = document.querySelector('.login-btn');
    if (loginBtn) {
        loginBtn.removeAttribute('onclick');
        loginBtn.addEventListener('click', handleLogin);
    }

    const togglePasswordIcon = document.querySelector('.login-toggle-password');
    if (togglePasswordIcon) {
        togglePasswordIcon.removeAttribute('onclick');
        togglePasswordIcon.addEventListener('click', togglePassword);
    }

    // Enter key support for login fields
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    [usernameInput, passwordInput].forEach(input => {
        if (input) {
            input.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') handleLogin();
            });
        }
    });
}

/**
 * Initialize sidebar navigation event handlers
 */
function initializeSidebarEvents() {
    // Dashboard button
    const dashboardBtn = document.querySelector('.sidebar > div > button:not(.workspace-btn):not(.quality-control-btn)');
    if (dashboardBtn && dashboardBtn.textContent.includes('Dashboard')) {
        dashboardBtn.removeAttribute('onclick');
        dashboardBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            router.navigate('/dashboard');
        });
    }

    // Workspace button (toggle nested)
    const workspaceBtn = document.querySelector('.workspace-btn');
    if (workspaceBtn) {
        workspaceBtn.removeAttribute('onclick');
        workspaceBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            toggleNestedButtons('workspaceButtons');
        });
    }

    // Workspace nested button
    const workspaceNestedBtn = document.querySelector('#workspaceButtons .nested-btn');
    if (workspaceNestedBtn) {
        workspaceNestedBtn.removeAttribute('onclick');
        workspaceNestedBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            router.navigate(getWorkspaceEntryRoute());
        });
    }

    // Quality Control button (toggle nested)
    const qcBtn = document.querySelector('.quality-control-btn');
    if (qcBtn) {
        qcBtn.removeAttribute('onclick');
        qcBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            toggleNestedButtons('qualityControlButtons');
        });
    }

    // QC nested buttons
    const qcNestedButtons = document.querySelectorAll('#qualityControlButtons .nested-btn');
    if (qcNestedButtons.length >= 2) {
        qcNestedButtons[0].removeAttribute('onclick');
        qcNestedButtons[0].addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            router.navigate('/import-section');
        });

        qcNestedButtons[1].removeAttribute('onclick');
        qcNestedButtons[1].addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            router.navigate('/qc-report');
        });
    }

    // Knowledge Hub button (external link)
    const knowledgeButtons = document.querySelectorAll('.sidebar button');
    knowledgeButtons.forEach(btn => {
        if (btn.textContent.includes('Knowledge Hub')) {
            btn.removeAttribute('onclick');
            btn.addEventListener('click', () => {
                window.open('https://suppliercontent.vercel.app/', '_blank');
            });
        }
    });

    // Version info icon (changelog)
    const versionIcon = document.querySelector('.version-info-icon');
    if (versionIcon) {
        versionIcon.removeAttribute('onclick');
        versionIcon.addEventListener('click', showChangelog);
    }
}

/**
 * Initialize user profile event handlers
 */
function initializeUserProfileEvents() {
    const currentUserDisplay = document.getElementById('currentUserDisplay');
    if (currentUserDisplay) {
        currentUserDisplay.removeAttribute('onclick');
        currentUserDisplay.addEventListener('click', openUserProfilePage);
    }
}

/**
 * Initialize dashboard event handlers
 */
function initializeDashboardEvents() {
    // Create Account button
    const createAccountBtn = document.querySelector('.create-account-btn:not(.add-document-btn)');
    if (createAccountBtn) {
        createAccountBtn.removeAttribute('onclick');
        createAccountBtn.addEventListener('click', () => openCreateAccountModal());
    }

    // Add Document button
    const addDocumentBtn = document.querySelector('.create-account-btn.add-document-btn');
    if (addDocumentBtn) {
        addDocumentBtn.removeAttribute('onclick');
        addDocumentBtn.addEventListener('click', openDocumentManagementModal);
    }

    // Pagination buttons - use event delegation on container
    const paginationContainer = document.querySelector('.assigned-accounts-pagination');
    if (paginationContainer) {
        // Remove inline onclick from pagination buttons
        const prevBtn = paginationContainer.querySelector('button:first-of-type');
        const nextBtn = paginationContainer.querySelector('button:last-of-type');

        if (prevBtn) {
            prevBtn.removeAttribute('onclick');
            prevBtn.addEventListener('click', previousPage);
        }

        if (nextBtn) {
            nextBtn.removeAttribute('onclick');
            nextBtn.addEventListener('click', nextPage);
        }
    }

    // Account cards - event delegation for dynamic content
    const accountsContainer = document.getElementById('assignedAccountsContainer');
    if (accountsContainer) {
        accountsContainer.addEventListener('click', (e) => {
            // View details button — navigate to workspace with account files tab
            const viewBtn = e.target.closest('.view-details-btn');
            if (viewBtn) {
                const accountCard = viewBtn.closest('.account-card');
                if (accountCard) {
                    const accountId = accountCard.getAttribute('data-account-id');
                    if (accountId) {
                        viewAccountInWorkspace(accountId);
                    }
                }
            }

            // Edit button (if exists)
            const editBtn = e.target.closest('.edit-accounts-btn');
            if (editBtn) {
                const accountCard = editBtn.closest('.account-card');
                if (accountCard) {
                    const accountId = accountCard.getAttribute('data-account-id');
                    if (accountId) {
                        // Import and call edit function when needed
                        import('../../features/dashboard/modals/accountManagementModal.js')
                            .then(module => module.openEditAccount(accountId));
                    }
                }
            }
        });

        // Status dropdown changes
        accountsContainer.addEventListener('change', (e) => {
            if (e.target.classList.contains('status-dropdown')) {
                const accountCard = e.target.closest('.account-card');
                if (accountCard) {
                    const accountId = accountCard.getAttribute('data-account-id');
                    if (accountId) {
                        updateAccountStatus(accountId, e.target.value);
                    }
                }
            }
        });
    }
}

/**
 * Initialize import section event handlers
 */
function initializeImportSectionEvents() {
    const bindClickOnce = (element, dataKey, handler) => {
        if (!element) return;
        if (element.dataset[dataKey] === 'true') return;
        element.addEventListener('click', handler);
        element.dataset[dataKey] = 'true';
    };

    const bindChangeOnce = (element, dataKey, handler) => {
        if (!element) return;
        if (element.dataset[dataKey] === 'true') return;
        element.addEventListener('change', handler);
        element.dataset[dataKey] = 'true';
    };

    // Import Section tabs
    const importSectionTab = document.getElementById('importSectionTab');
    if (importSectionTab) {
        importSectionTab.removeAttribute('onclick');
        bindClickOnce(importSectionTab, 'boundImportSectionTabClick', () => switchImportSectionTab('importContent'));
    }

    const classificationDetailsTab = document.getElementById('classificationDetailsTab');
    if (classificationDetailsTab) {
        classificationDetailsTab.removeAttribute('onclick');
        bindClickOnce(classificationDetailsTab, 'boundClassificationDetailsTabClick', () => switchImportSectionTab('classificationDetailsContent'));
    }

    // Generate and Clear buttons
    const generateBtn = document.querySelector('.sync-btn');
    if (generateBtn) {
        generateBtn.removeAttribute('onclick');
        bindClickOnce(generateBtn, 'boundSyncBtnClick', generateDetails);
    }

    const clearBtn = document.querySelector('.clear-btn');
    if (clearBtn) {
        clearBtn.removeAttribute('onclick');
        bindClickOnce(clearBtn, 'boundClearBtnClick', clearClassificationDetails);
    }

    // File input handlers for data import
    const afterproofClassificationInput = document.getElementById('afterproofClassificationImport');
    if (afterproofClassificationInput) {
        afterproofClassificationInput.removeAttribute('onchange');
        bindChangeOnce(afterproofClassificationInput, 'boundAfterproofClassificationChange', function () {
            importData('AfterproofClassification', this);
        });
    }

    const afterproofPDMInput = document.getElementById('afterproofPDMImport');
    if (afterproofPDMInput) {
        afterproofPDMInput.removeAttribute('onchange');
        bindChangeOnce(afterproofPDMInput, 'boundAfterproofPDMChange', function () {
            importData('AfterproofPDM', this);
        });
    }

    const beforeproofDataInput = document.getElementById('backupScraperImport')
        || document.getElementById('beforeproofDataImport');
    if (beforeproofDataInput) {
        beforeproofDataInput.removeAttribute('onchange');
        bindChangeOnce(beforeproofDataInput, 'boundBeforeproofChange', function () {
            importData('BeforeproofData', this);
        });
    }

    const qcToolDataInput = document.getElementById('qcToolDataImport');
    if (qcToolDataInput) {
        qcToolDataInput.removeAttribute('onchange');
        bindChangeOnce(qcToolDataInput, 'boundQCToolDataChange', function () {
            importData('QCToolData', this);
        });
    }
}

/**
 * Initialize workspace event handlers
 */
function initializeWorkspaceEvents() {
    // Workspace settings mode selection
    const editorModeOption = document.querySelector('.header-mode-option[data-mode="editor"]');
    if (editorModeOption) {
        editorModeOption.removeAttribute('onclick');
        editorModeOption.addEventListener('click', () => {
            setWorkspaceMode('editor');
            updateWorkspaceSettingsModeHighlight('editor');
        });
    }

    const qcModeOption = document.querySelector('.header-mode-option[data-mode="qc"]');
    if (qcModeOption) {
        qcModeOption.removeAttribute('onclick');
        qcModeOption.addEventListener('click', () => {
            setWorkspaceMode('qc');
            updateWorkspaceSettingsModeHighlight('qc');
        });
    }
}

/**
 * Initialize production tab event handlers
 */
function initializeProductionEvents() {
    // Editor tabs - use event delegation
    const editorTabsContainer = document.querySelector('.editor-tabs-container, .editor-mode-tabs');
    if (editorTabsContainer) {
        const editorTabs = editorTabsContainer.querySelectorAll('.editor-tab-btn');
        editorTabs.forEach(tab => {
            tab.removeAttribute('onclick');
            const tabName = tab.getAttribute('data-tab');
            if (tabName) {
                tab.addEventListener('click', () => switchEditorTab(tabName));
            }
        });
    }

    // Export PDM button
    const exportPdmBtn = document.getElementById('exportPdmBtn');
    if (exportPdmBtn) {
        exportPdmBtn.removeAttribute('onclick');
        exportPdmBtn.addEventListener('click', () => PdmUtils.exportPdmData());
    }

    // Production Report menu buttons
    const prodRepFamilyTab = document.getElementById('prodRepFamilyTab');
    if (prodRepFamilyTab) {
        prodRepFamilyTab.removeAttribute('onclick');
        prodRepFamilyTab.addEventListener('click', () => toggleProductionReportSection('family'));
    }

    const prodRepErrorsTab = document.getElementById('prodRepErrorsTab');
    if (prodRepErrorsTab) {
        prodRepErrorsTab.removeAttribute('onclick');
        prodRepErrorsTab.addEventListener('click', () => toggleProductionReportSection('errors'));
    }

    const prodRepExistingTab = document.getElementById('prodRepExistingTab');
    if (prodRepExistingTab) {
        prodRepExistingTab.removeAttribute('onclick');
        prodRepExistingTab.addEventListener('click', () => toggleProductionReportSection('existing'));
    }
}

/**
 * Initialize QC workspace event handlers
 */
function initializeQCEvents() {
    // QC tabs - use event delegation
    const qcTabsContainer = document.querySelector('.qc-tabs-container, .qc-mode-tabs');
    if (qcTabsContainer) {
        const qcTabs = qcTabsContainer.querySelectorAll('.qc-tab-btn');
        qcTabs.forEach(tab => {
            tab.removeAttribute('onclick');
            const tabName = tab.getAttribute('data-tab');
            if (tabName) {
                tab.addEventListener('click', () => switchQCTab(tabName));
            }
        });
    }

    // QC Report menu buttons
    const menuSummary = document.getElementById('menuSummary');
    if (menuSummary) {
        menuSummary.removeAttribute('onclick');
        menuSummary.addEventListener('click', () => switchReportView('summary'));
    }

    const menuProductionErrors = document.getElementById('menuProductionErrors');
    if (menuProductionErrors) {
        menuProductionErrors.removeAttribute('onclick');
        menuProductionErrors.addEventListener('click', () => switchReportView('errors'));
    }

    const menuFamilyWise = document.getElementById('menuFamilyWise');
    if (menuFamilyWise) {
        menuFamilyWise.removeAttribute('onclick');
        menuFamilyWise.addEventListener('click', () => switchReportView('family'));
    }

    const menuExisting = document.getElementById('menuExisting');
    if (menuExisting) {
        menuExisting.removeAttribute('onclick');
        menuExisting.addEventListener('click', () => switchReportView('existing'));
    }
}

/**
 * Initialize modal event handlers
 */
function initializeModalEvents() {
    // QC Feedback Modal buttons
    const qcFeedbackBtn = document.querySelector('.qc-validation-btn.qc-btn-feedback');
    if (qcFeedbackBtn) {
        qcFeedbackBtn.removeAttribute('onclick');
        qcFeedbackBtn.addEventListener('click', () => QCFeedbackModal.submitFeedback());
    }

    const qcModalCloseBtn = document.querySelector('.qc-modal-close-text');
    if (qcModalCloseBtn) {
        qcModalCloseBtn.removeAttribute('onclick');
        qcModalCloseBtn.addEventListener('click', () => QCFeedbackModal.closeFeedbackModal());
    }

    // Generic modal close handlers
    document.addEventListener('click', (e) => {
        // Close button clicks (for dynamically created modals)
        if (e.target.classList.contains('modal-close-btn')) {
            const modalOverlay = e.target.closest('.modal-overlay');
            if (modalOverlay) {
                const modalId = modalOverlay.id;
                closeModalById(modalId);
            }
        }

        // Click outside modal to close
        if (e.target.classList.contains('modal-overlay')) {
            closeModalById(e.target.id);
        }
    });

    // ESC key closes modals
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            const visibleModal = document.querySelector('.modal-overlay[style*="flex"]');
            if (visibleModal) {
                closeModalById(visibleModal.id);
            }
        }
    });
}

/**
 * Helper function to close modals by ID
 */
function closeModalById(modalId) {
    const closeHandlers = {
        'createAccountModal': closeCreateAccountModal,
        'documentManagementModal': closeDocumentManagementModal,
        'qcFeedbackModal': () => QCFeedbackModal.closeFeedbackModal(),
    };

    const handler = closeHandlers[modalId];
    if (handler) {
        handler();
    } else {
        // Generic close for unknown modals
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.style.display = 'none';
        }
    }
}

/**
 * Re-initialize events for dynamically added content
 * Call this after rendering new DOM elements
 */
export function reinitializeDynamicEvents() {
    // Re-run specific initializers for dynamic content
    initializeDashboardEvents();
    initializeProductionEvents();
    initializeQCEvents();
}
