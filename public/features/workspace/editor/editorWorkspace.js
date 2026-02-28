// Editor Mode Initialization and Tab Switching Logic

import { initializeAccountFiles } from '../sharedComponents/accountData.js';
import { initializeEditorWorkspace, renderProductionPDMLibrary } from './production.js';
import { initializeProductionReportTab } from './productionReport.js';

/**
 * Initializes the Editor Mode container and sets up the default tab.
 */
export function initializeEditorMode() {

    // Default to the 'workspace' (Production) tab on mode switch
    const defaultTab = 'workspace';

    // Check if a tab button is already active, otherwise activate default
    const activeBtn = document.querySelector('.editor-mode-tabs .editor-tab-btn.active');
    const tabToActivate = activeBtn ? activeBtn.getAttribute('data-tab') : defaultTab;

    // Call the tab switch function to render the correct content
    switchEditorTab(tabToActivate);
}

/**
 * Handles switching between tabs within the Editor Mode (Production, PDM Details, Account Files, etc.).
 * @param {string} tabName - The name of the tab to switch to ('workspace', 'family-pdm', 'account-files', 'errors')
 */
export function switchEditorTab(tabName) {
    const tabMap = {
        'workspace': 'productionTab',
        'account-files': 'accountFilesTab',
        'production-report': 'productionReportTab'
    };

    const targetTabId = tabMap[tabName];

    if (!targetTabId) {
        return;
    }

    // 1. Update Buttons
    const allTabBtns = document.querySelectorAll('.editor-tab-btn');
    allTabBtns.forEach(btn => btn.classList.remove('active'));

    const activeBtn = document.querySelector(`.editor-tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // 2. Update Content
    const allTabContent = document.querySelectorAll('.editor-tab-content');
    allTabContent.forEach(content => content.classList.remove('active'));

    const targetTab = document.getElementById(targetTabId);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // 3. Call Initialization Functions for specific tabs
    // Note: These functions are assumed to be globally available from their respective files.
    if (tabName === 'workspace') {
        if (typeof initializeEditorWorkspace === 'function') {
            initializeEditorWorkspace();
            // Ensure library is refreshed when switching back
            if (typeof renderProductionPDMLibrary === 'function') {
                renderProductionPDMLibrary();
            }
        }
    } else if (tabName === 'account-files') {
        if (typeof initializeAccountFiles === 'function') {
            initializeAccountFiles();
        }
    } else if (tabName === 'production-report') {
        if (typeof initializeProductionReportTab === 'function') {
            initializeProductionReportTab();
        }
    }

    document.dispatchEvent(new CustomEvent('workspace:tab-changed', {
        detail: {
            mode: 'editor',
            tabName
        }
    }));

}

// Window bridges removed - functions are exported and imported where needed
