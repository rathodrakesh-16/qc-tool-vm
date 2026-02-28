// QC Mode State Management
// NOTE: qcModeState is now defined in state/qcModeState.js

import { handleGlobalAccountSelection } from '../workspace.js';
import { initializeAccountFiles } from '../sharedComponents/accountData.js';
import { qcModeState } from '../state/qcModeState.js';
import { initializeQCSection, refreshQCReviewData } from './qcReview.js';
import { initializeQCReportTab } from './workspaceQcReport.js';

// Initialize QC Mode
export function initializeQCMode() {
    setupQCModeEventListeners();
    populateQCAccountsDropdown();

    // Immediately initialize QC Section if qc-review tab is active
    const qcReviewTab = document.getElementById('qcReviewTab');
    if (qcReviewTab && qcReviewTab.classList.contains('active')) {
        if (typeof initializeQCSection === 'function') {
            // Small delay to ensure DOM is ready
            setTimeout(() => {
                initializeQCSection();
            }, 50);
        }
    }

}

// Setup QC Mode Event Listeners
export function setupQCModeEventListeners() {
    const accountSelect = document.getElementById('qcAccountSelect');
    if (accountSelect) {
        accountSelect.addEventListener('change', handleQCAccountSelection);
    }
}

// Switch QC Tab
export function switchQCTab(tabName) {
    const tabMap = {
        'qc-review': 'qcReviewTab',

        'qc-report': 'qcReportTab',
        'account-files': 'qcAccountFilesTab'
    };

    const targetTabId = tabMap[tabName];

    if (!targetTabId) {
        return;
    }

    // Remove active class from all tab buttons
    const allTabBtns = document.querySelectorAll('.qc-tab-btn');
    allTabBtns.forEach(btn => btn.classList.remove('active'));

    // Add active class to clicked tab button
    const activeBtn = document.querySelector(`.qc-tab-btn[data-tab="${tabName}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }

    // Remove active class from all tab content
    const allTabContent = document.querySelectorAll('.qc-tab-content');
    allTabContent.forEach(content => content.classList.remove('active'));

    // Add active class to target tab content
    const targetTab = document.getElementById(targetTabId);
    if (targetTab) {
        targetTab.classList.add('active');
    }

    // Update state
    qcModeState.currentTab = tabName;

    // Tab-specific initialization logic with small delay for DOM
    if (tabName === 'qc-review') {
        if (typeof initializeQCSection === 'function') {
            setTimeout(() => {
                initializeQCSection();
            }, 150);
        }

    } else if (tabName === 'qc-report') {
        if (typeof initializeQCReportTab === 'function') {
            initializeQCReportTab();
        }
    } else if (tabName === 'account-files') {
        // Initialize Account Files tab - shared with Editor mode
        if (typeof initializeAccountFiles === 'function') {
            initializeAccountFiles();
        }
    }

    document.dispatchEvent(new CustomEvent('workspace:tab-changed', {
        detail: {
            mode: 'qc',
            tabName
        }
    }));

}

// Populate QC Accounts Dropdown
export function populateQCAccountsDropdown() {
    const select = document.getElementById('qcAccountSelect');
    if (!select) return;

    select.innerHTML = '<option value="">Select Account</option>';

    // Sample accounts - replace with actual data source
    const accounts = [
        { id: 'ACC001', name: 'Account A', assignedQC: 'QC User 1' },
        { id: 'ACC002', name: 'Account B', assignedQC: 'QC User 2' },
        { id: 'ACC003', name: 'Account C', assignedQC: 'QC User 1' }
    ];

    qcModeState.availableAccounts = accounts;

    accounts.forEach(account => {
        const option = document.createElement('option');
        option.value = account.id;
        option.textContent = `${account.id} - ${account.name}`;
        select.appendChild(option);
    });
}

// Handle QC Account Selection
export function handleQCAccountSelection(e) {
    const accountId = e.target.value;

    if (!accountId) {
        qcModeState.selectedAccount = null;

        // Keep global workspace account selection in sync if available
        if (typeof handleGlobalAccountSelection === 'function') {
            handleGlobalAccountSelection('');
        }
        return;
    }

    const account = qcModeState.availableAccounts.find(acc => acc.id === accountId);
    qcModeState.selectedAccount = account;


    // Keep global workspace account selection in sync if available
    if (typeof handleGlobalAccountSelection === 'function') {
        handleGlobalAccountSelection(accountId);
    }

    // Refresh current tab content based on selected account
    refreshCurrentQCTab();
}

// Refresh Current QC Tab
export function refreshCurrentQCTab() {
    const currentTab = qcModeState.currentTab;

    // Refresh based on current tab
    switch (currentTab) {
        case 'qc-review':
            // Refresh QC Section data
            if (typeof refreshQCReviewData === 'function') {
                refreshQCReviewData();
            }
            break;

        case 'qc-report':
            // Refresh QC Report data
            break;
        case 'account-files':
            // Refresh Account Files data
            break;
    }
}

// Window bridges removed - exports are imported where needed
