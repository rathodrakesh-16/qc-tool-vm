// Workspace State Management
// NOTE: workspaceState and workspaceAccountsState are now defined in state/ directory

import { workspaceState } from './state/workspaceState.js';
import { workspaceAccountsState } from './state/workspaceAccountsState.js';
import { qcModeState } from './state/qcModeState.js';
import { authManager } from '../../core/auth/AuthManager.js';
import { assignedAccountsData } from '../dashboard/dashboard.js';
import { initializeEditorMode, switchEditorTab } from './editor/editorWorkspace.js';
import { initializeQCMode, refreshCurrentQCTab, switchQCTab } from './qc/qcWorkspace.js';
import { loadAccountData } from './sharedComponents/accountData.js';
import { HistoryManager } from './modals/changeLogModal.js';

// Flag to prevent saves during data clearing (exported for cross-file access)
export let isDataClearing = false;
const WORKSPACE_BASE_PATH = '/workspace';
let suppressWorkspaceRouteSync = false;

const WORKSPACE_ROUTE_SLUGS = {
    production: 'production',
    accountData: 'account-data',
    productionReport: 'production-report',
    qcReview: 'qc-review',
    qcReport: 'qc-report'
};

const WORKSPACE_ROUTE_CONTEXT_BY_KEY = {
    workspaceProduction: { mode: 'editor', tabName: 'workspace' },
    workspaceAccountData: { tabName: 'account-files' },
    workspaceProductionReport: { mode: 'editor', tabName: 'production-report' },
    workspaceQcReview: { mode: 'qc', tabName: 'qc-review' },
    workspaceQcReport: { mode: 'qc', tabName: 'qc-report' }
};

function normalizeAccountId(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';
    if (!/^\d+$/.test(trimmed)) return trimmed;

    const stored = String(parseInt(trimmed, 10));
    if (!/^\d+$/.test(stored) || stored === '0') {
        return '';
    }

    return stored.padStart(8, '0');
}

export function buildAccountDataRoutePath(accountId) {
    return buildWorkspaceAccountRoutePath(accountId, 'accountData');
}

function isWorkspacePath(pathname = window.location.pathname) {
    return pathname === WORKSPACE_BASE_PATH
        || /^\/[^/]+\/(production|account-data|production-report|qc-review|qc-report)\/?$/.test(pathname);
}

function getActiveWorkspaceMode() {
    const editorModeContainer = document.getElementById('editorModeContainer');
    const qcModeContainer = document.getElementById('qcModeContainer');

    if (qcModeContainer && qcModeContainer.classList.contains('active')) {
        return 'qc';
    }

    if (editorModeContainer && editorModeContainer.classList.contains('active')) {
        return 'editor';
    }

    const persistedMode = localStorage.getItem('qc_tool_active_mode');
    return persistedMode === 'qc' ? 'qc' : 'editor';
}

function setWorkspaceModeImmediate(mode, options = {}) {
    const initialize = options.initialize !== false;
    const normalizedMode = mode === 'qc' ? 'qc' : 'editor';
    const editorModeContainer = document.getElementById('editorModeContainer');
    const qcModeContainer = document.getElementById('qcModeContainer');
    const sharedSection = document.getElementById('sharedWorkspaceAccountSection');

    localStorage.setItem('qc_tool_active_mode', normalizedMode);
    updateWorkspaceSettingsModeHighlight(normalizedMode);

    if (!editorModeContainer || !qcModeContainer) {
        return normalizedMode;
    }

    if (normalizedMode === 'editor') {
        editorModeContainer.classList.add('active');
        qcModeContainer.classList.remove('active');

        const editorWrapper = document.getElementById('editorHeaderActionsWrapper');
        if (editorWrapper && sharedSection) {
            editorWrapper.appendChild(sharedSection);
        }

        if (initialize && typeof initializeEditorMode === 'function') {
            initializeEditorMode();
        }
    } else {
        editorModeContainer.classList.remove('active');
        qcModeContainer.classList.add('active');

        const qcWrapper = document.getElementById('qcHeaderActionsWrapper');
        if (qcWrapper && sharedSection) {
            qcWrapper.appendChild(sharedSection);
        }

        if (initialize && typeof initializeQCMode === 'function') {
            initializeQCMode();
        }
    }

    return normalizedMode;
}

function getCurrentWorkspaceRouteType() {
    const mode = getActiveWorkspaceMode();

    if (mode === 'qc') {
        const qcReviewTab = document.getElementById('qcReviewTab');
        if (qcReviewTab && qcReviewTab.classList.contains('active')) {
            return 'qcReview';
        }

        const qcReportTab = document.getElementById('qcReportTab');
        if (qcReportTab && qcReportTab.classList.contains('active')) {
            return 'qcReport';
        }

        return 'accountData';
    }

    const productionReportTab = document.getElementById('productionReportTab');
    if (productionReportTab && productionReportTab.classList.contains('active')) {
        return 'productionReport';
    }

    const accountDataTab = document.getElementById('accountFilesTab');
    if (accountDataTab && accountDataTab.classList.contains('active')) {
        return 'accountData';
    }

    return 'production';
}

export function buildWorkspaceAccountRoutePath(accountId, routeType = 'production') {
    const normalized = normalizeAccountId(accountId);
    if (!normalized) return WORKSPACE_BASE_PATH;

    const slug = WORKSPACE_ROUTE_SLUGS[routeType] || WORKSPACE_ROUTE_SLUGS.production;
    return `/${encodeURIComponent(normalized)}/${slug}`;
}

export function getWorkspaceEntryRoute() {
    const selectedAccountId = normalizeAccountId(workspaceAccountsState.selectedAccountId || workspaceState.selectedAccount);
    return selectedAccountId
        ? buildWorkspaceAccountRoutePath(selectedAccountId, 'production')
        : WORKSPACE_BASE_PATH;
}

export function syncWorkspaceRouteWithState(options = {}) {
    if (suppressWorkspaceRouteSync) {
        return;
    }

    if (!isWorkspacePath(window.location.pathname)) {
        return;
    }

    const replace = !!options.replace;
    const selectedAccountId = normalizeAccountId(workspaceAccountsState.selectedAccountId || workspaceState.selectedAccount);
    const targetPath = selectedAccountId
        ? buildWorkspaceAccountRoutePath(selectedAccountId, getCurrentWorkspaceRouteType())
        : WORKSPACE_BASE_PATH;

    if (window.location.pathname === targetPath) {
        return;
    }

    const historyMethod = replace ? 'replaceState' : 'pushState';
    window.history[historyMethod]({}, '', targetPath);
}

// Sync workspace accounts with dashboard accounts
export function syncWorkspaceAccounts() {
    // Get accounts from dashboard
    if (typeof assignedAccountsData !== 'undefined') {
        workspaceAccountsState.allAccounts = assignedAccountsData.map(acc => ({
            id: normalizeAccountId(acc.id),
            name: acc.name,
            editor: acc.editor,
            qc: acc.qc,
            status: acc.status
        }));
    }

    // Update filtered accounts
    if (workspaceAccountsState.searchQuery) {
        const query = workspaceAccountsState.searchQuery.toLowerCase();
        workspaceAccountsState.filteredAccounts = workspaceAccountsState.allAccounts.filter(acc => {
            const label = `${acc.id} ${acc.name}`.toLowerCase();
            return label.includes(query);
        });
    } else {
        workspaceAccountsState.filteredAccounts = [...workspaceAccountsState.allAccounts];
    }

    // Re-render if initialized
    if (workspaceAccountsState.initialized) {
        renderWorkspaceAccountOptions();
    }
}

// --- Shared Utility Functions (Keep here for common access) ---

export function getCurrentUser() {
    const currentUser = authManager.getUser();
    return currentUser ? currentUser.username : 'Unknown User';
}

// --- Headings Registry Helper Functions ---

/**
 * Get heading from registry by ID
 * @param {string} headingId - The heading ID
 * @returns {Object|null} - The heading object or null if not found
 */
export function getHeadingFromRegistry(headingId) {
    return workspaceState.headingsRegistry[headingId] || null;
}

/**
 * Add or update heading in registry
 * @param {Object} heading - The heading object with id, name, families, etc.
 * @returns {Object} - The heading object in registry
 */
export function addHeadingToRegistry(heading) {
    if (!heading.id) {
        return null;
    }

    workspaceState.headingsRegistry[heading.id] = heading;
    return workspaceState.headingsRegistry[heading.id];
}

/**
 * Get multiple headings from registry by IDs
 * @param {Array<string>} headingIds - Array of heading IDs
 * @returns {Array<Object>} - Array of heading objects
 */
export function getHeadingsFromRegistry(headingIds) {
    return headingIds
        .map(id => workspaceState.headingsRegistry[id])
        .filter(h => h !== undefined && h !== null);
}

/**
 * Merge families into existing heading (for duplicate handling)
 * @param {string} headingId - Existing heading ID
 * @param {Array<string>} newFamilies - New families to merge
 * @returns {Object|null} - Updated heading or null if not found
 */
export function mergeFamiliesToHeading(headingId, newFamilies) {
    const heading = workspaceState.headingsRegistry[headingId];
    if (!heading) return null;

    // Merge families (no duplicates)
    const existingFamilies = heading.families || [];
    const mergedFamilies = [...new Set([...existingFamilies, ...newFamilies])];

    heading.families = mergedFamilies;

    // If groupingFamily not set, use first family
    if (!heading.groupingFamily && mergedFamilies.length > 0) {
        heading.groupingFamily = mergedFamilies[0];
    }

    return heading;
}

export function formatTimestamp(isoString) {
    const date = new Date(isoString);
    const dateStr = date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
    });
    const timeStr = date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit'
    });
    return { date: dateStr, time: timeStr };
}

export function formatTimestampWithUser(isoString, username) {
    const date = new Date(isoString);

    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');

    const user = username ? `by ${username}` : 'by Unknown User';

    return `${day} ${month} ${year}, ${hours}:${mins} ${user}`;
}

// --- Core Workspace Controller Functions ---

let workspaceListenersInitialized = false;

export function initializeWorkspace() {
    if (!workspaceListenersInitialized) {
        setupWorkspaceEventListeners();
        workspaceListenersInitialized = true;
    }

    initializeWorkspaceAccounts();

    // Prompt account selection if none selected
    ensureAccountSelected();

    const editorModeContainer = document.getElementById('editorModeContainer');
    const qcModeContainer = document.getElementById('qcModeContainer');
    const sharedSection = document.getElementById('sharedWorkspaceAccountSection');

    // RESTORE PERSISTED MODE
    const savedMode = localStorage.getItem('qc_tool_active_mode');
    if (savedMode && editorModeContainer && qcModeContainer) {
        if (savedMode === 'qc') {
            editorModeContainer.classList.remove('active');
            qcModeContainer.classList.add('active');

            // Move shared section to QC header if initialized
            const qcWrapper = document.getElementById('qcHeaderActionsWrapper');
            if (qcWrapper && sharedSection) {
                qcWrapper.appendChild(sharedSection);
            }

            // Update UI
            if (typeof updateWorkspaceSettingsModeHighlight === 'function') {
                updateWorkspaceSettingsModeHighlight('qc');
            }
        } else {
            editorModeContainer.classList.add('active');
            qcModeContainer.classList.remove('active');

            // Move shared section to Editor header if initialized
            const editorWrapper = document.getElementById('editorHeaderActionsWrapper');
            if (editorWrapper && sharedSection) {
                editorWrapper.appendChild(sharedSection);
            }

            // Update UI
            if (typeof updateWorkspaceSettingsModeHighlight === 'function') {
                updateWorkspaceSettingsModeHighlight('editor');
            }
        }
    } else {
        // Default move to editor header if no saved mode
        const editorWrapper = document.getElementById('editorHeaderActionsWrapper');
        if (editorWrapper && sharedSection) {
            editorWrapper.appendChild(sharedSection);
        }
    }

    if (editorModeContainer && editorModeContainer.classList.contains('active')) {
        // The core editor logic is now in editorMode.js
        if (typeof initializeEditorMode === 'function') {
            initializeEditorMode();
        }
    } else if (qcModeContainer && qcModeContainer.classList.contains('active')) {
        // QC mode logic is in qcWorkspace.js
        if (typeof initializeQCMode === 'function') {
            initializeQCMode();
        }
    } else {
        // Default to editor mode if no mode is active
        setWorkspaceMode('editor');
    }

}

export function setupWorkspaceEventListeners() {
    // Workspace Settings Button Logic
    const settingsBtn = document.getElementById('workspaceSettingsBtn');
    const settingsModal = document.getElementById('workspaceSettingsModalOverlay');
    const closeBtn = document.getElementById('workspaceSettingsCloseBtn');
    const searchInput = document.getElementById('workspaceSettingsAccountSearch');

    function openWorkspaceSettingsModal() {
        if (settingsModal) {
            settingsModal.style.display = 'flex';
            // Sync accounts
            syncWorkspaceAccounts();

            // Reset search
            if (searchInput) {
                searchInput.value = '';
                workspaceAccountsState.searchQuery = '';
                workspaceAccountsState.filteredAccounts = [...workspaceAccountsState.allAccounts];
            }
            renderWorkspaceAccountOptions();

            // Highlight current mode
            const currentMode = localStorage.getItem('qc_tool_active_mode') || 'editor';
            updateWorkspaceSettingsModeHighlight(currentMode);

            setTimeout(() => {
                if (searchInput) searchInput.focus();
            }, 50);
        }
    }

    function closeWorkspaceSettingsModal() {
        if (settingsModal) settingsModal.style.display = 'none';
    }

    if (settingsBtn) {
        settingsBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openWorkspaceSettingsModal();
        });
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeWorkspaceSettingsModal);
    }

    if (settingsModal) {
        settingsModal.addEventListener('click', (e) => {
            if (e.target === settingsModal) closeWorkspaceSettingsModal();
        });
    }

    // Stop propagation on modal body
    const modalBody = document.querySelector('.workspace-settings-modal');
    if (modalBody) {
        modalBody.addEventListener('click', e => e.stopPropagation());
    }
}

export function updateWorkspaceSettingsModeHighlight(mode) {
    const options = document.querySelectorAll('.header-mode-option');
    options.forEach(option => {
        if (option.getAttribute('data-mode') === mode) {
            option.classList.add('selected');
        } else {
            option.classList.remove('selected');
        }
    });
}

// Export function for mode selection from modal (window bridge removed)
export function selectWorkspaceSettingsMode(mode) {
    setWorkspaceMode(mode);
    updateWorkspaceSettingsModeHighlight(mode);
    // Optional: Close modal after mode switch? User might want to switch account too.
    // Let's keep it open allow multiple changes or close it?
    // User requested "select account AND mode", so allow both.
    // If we close, it might be annoying if they wanted to do both.
    // But mode switch takes 2 seconds and reloads UI...
    // The setWorkspaceMode function has a 2 second delay.
    // We should probably close logic handled inside setWorkspaceMode or let user close.
    // For now, let's leave it open so they see the selection change.
};

// Initialize workspace-level account select + search
export function initializeWorkspaceAccounts() {
    // Sync with dashboard accounts first
    syncWorkspaceAccounts();

    // Initialize filtered list and listeners only once
    if (!workspaceAccountsState.initialized) {
        workspaceAccountsState.filteredAccounts = [...workspaceAccountsState.allAccounts];

        // Restore persisted selection
        const savedAccountId = normalizeAccountId(localStorage.getItem('qc_tool_active_account_id'));
        if (savedAccountId) {
            // Validate it still exists
            const exists = workspaceAccountsState.allAccounts.some(acc => normalizeAccountId(acc.id) === savedAccountId);
            if (exists) {
                handleGlobalAccountSelection(savedAccountId, { syncRoute: false });
            }
        }

        const searchInput = document.getElementById('workspaceSettingsAccountSearch');

        if (searchInput) {
            searchInput.addEventListener('input', handleWorkspaceAccountSearch);
        }

        workspaceAccountsState.initialized = true;
    }

    renderWorkspaceAccountOptions();
}

export function handleWorkspaceAccountSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    workspaceAccountsState.searchQuery = query;

    if (!query) {
        workspaceAccountsState.filteredAccounts = [...workspaceAccountsState.allAccounts];
    } else {
        workspaceAccountsState.filteredAccounts = workspaceAccountsState.allAccounts.filter(acc => {
            const label = `${acc.id} ${acc.name}`.toLowerCase();
            return label.includes(query);
        });
    }

    renderWorkspaceAccountOptions();
}

export function renderWorkspaceAccountOptions() {
    const list = document.getElementById('workspaceSettingsAccountList');
    if (!list) return;

    const currentValue = workspaceAccountsState.selectedAccountId || '';

    if (workspaceAccountsState.filteredAccounts.length === 0) {
        list.innerHTML = '<div class="workspace-settings-account-item" style="color:#6b7280; cursor:default;">No accounts found</div>';
        return;
    }

    list.innerHTML = workspaceAccountsState.filteredAccounts.map(account => {
        const label = `${account.id} - ${account.name}`;
        const isSelected = account.id === currentValue;
        return `
            <div class="workspace-settings-account-item${isSelected ? ' selected' : ''}" data-account-id="${account.id}">
                <span>${label}</span>
                <i class="fas fa-check check-icon"></i>
            </div>
        `;
    }).join('');

    // Attach click listeners for account selection
    list.querySelectorAll('.workspace-settings-account-item[data-account-id]').forEach(item => {
        item.addEventListener('click', () => {
            handleGlobalAccountSelection(item.getAttribute('data-account-id'));
        });
    });
}

export function handleGlobalAccountSelection(accountId, options = {}) {
    const syncRoute = options.syncRoute !== false;
    accountId = normalizeAccountId(accountId);

    // Note: We don't auto-close modal here to allow mode switching too.

    workspaceAccountsState.selectedAccountId = accountId || '';

    // Refresh list to update selection highlight
    renderWorkspaceAccountOptions();

    // Update Account Name Display in Header
    const editorNameContainer = document.getElementById('editorSelectedAccount');
    const qcNameContainer = document.getElementById('qcSelectedAccount');

    let accountName = 'NO Account Selected';
    if (accountId) {
        const found = workspaceAccountsState.allAccounts.find(acc => acc.id === accountId);
        if (found) accountName = found.name;
    }

    if (editorNameContainer) editorNameContainer.textContent = accountName;
    if (qcNameContainer) qcNameContainer.textContent = accountName;

    // Update workspace state
    if (!accountId) {
        // Save data for the previous account if it was selected
        if (workspaceState.selectedAccount) {
            saveCurrentWorkspaceData();
        }

        workspaceState.selectedAccount = null;
        localStorage.removeItem('qc_tool_active_account_id');
        localStorage.removeItem('qc_tool_active_mode'); // Clear mode on logout/account clear

        // Reset workspace data to empty defaults
        resetWorkspaceData();
    } else {
        // Save data for the previous account if it was selected and different
        if (workspaceState.selectedAccount && workspaceState.selectedAccount !== accountId) {
            saveCurrentWorkspaceData();
        }

        workspaceState.selectedAccount = accountId;
        localStorage.setItem('qc_tool_active_account_id', accountId);

        // Load data for the new account
        loadWorkspaceData(accountId);
    }

    // Update QC mode state if available (assuming qcModeState is defined in qcWorkspace.js)
    if (typeof qcModeState !== 'undefined') {
        if (!accountId) {
            qcModeState.selectedAccount = null;
        } else {
            let accountObj = null;

            if (Array.isArray(qcModeState.availableAccounts) && qcModeState.availableAccounts.length > 0) {
                accountObj = qcModeState.availableAccounts.find(acc => acc.id === accountId) || null;
            }

            if (!accountObj) {
                accountObj = workspaceAccountsState.allAccounts.find(acc => acc.id === accountId) || { id: accountId };
            }

            qcModeState.selectedAccount = accountObj;
        }

        if (typeof refreshCurrentQCTab === 'function') {
            refreshCurrentQCTab();
        }
    }

    // Update Editor Mode state if active
    const editorModeContainer = document.getElementById('editorModeContainer');
    if (editorModeContainer && editorModeContainer.classList.contains('active')) {
        if (typeof initializeEditorMode === 'function') {
            initializeEditorMode();
        }
    }

    // Update Account Files Data (Shared across Dashboard, Editor, QC)
    if (typeof loadAccountData === 'function') {
        loadAccountData(accountId);
    }

    // Refresh History Summary for the selected account
    if (typeof HistoryManager !== 'undefined') {
        HistoryManager.refresh(accountId);
    }

    if (syncRoute) {
        syncWorkspaceRouteWithState();
    }
}

/**
 * Switches the main workspace view between Editor Mode and QC Mode.
 * @param {string} mode - 'editor' or 'qc'
 */
export function setWorkspaceMode(mode) {
    // Ensure account is selected before switching modes
    if (!ensureAccountSelected()) {
        return; // Don't switch modes if no account selected
    }

    const editorModeContainer = document.getElementById('editorModeContainer');
    const qcModeContainer = document.getElementById('qcModeContainer');

    const normalizedMode = mode === 'qc' ? 'qc' : 'editor';

    // Persist Mode
    localStorage.setItem('qc_tool_active_mode', normalizedMode);

    // determine current active history container to show loader in
    let activeHistoryContainer = null;
    let originalHistoryContent = '';

    // We show the loader in the CURRENT active view before switching
    if (editorModeContainer && editorModeContainer.classList.contains('active')) {
        activeHistoryContainer = document.getElementById('editorChangeLogsContainer');
    } else if (qcModeContainer && qcModeContainer.classList.contains('active')) {
        activeHistoryContainer = document.getElementById('qcChangeLogsContainer');
    }

    // 1. Show Loader in Current View
    if (activeHistoryContainer) {
        // Save original content to restore later
        originalHistoryContent = activeHistoryContainer.innerHTML;

        // Update content to loader
        activeHistoryContainer.innerHTML = `
            <i class="fas fa-circle-notch fa-spin" style="color: #64748b; font-size: 13px;"></i>
            <span class="change-logs-text" style="font-weight: 500; color: #64748b;">Switching to ${normalizedMode === 'editor' ? 'Editor Workspace' : 'QC Workspace'}</span>
        `;
    }

    // Update Modal Visual State
    if (typeof updateWorkspaceSettingsModeHighlight === 'function') {
        updateWorkspaceSettingsModeHighlight(normalizedMode);
    } else {
        // Fallback if function not ready
        const options = document.querySelectorAll('.header-mode-option');
        options.forEach(option => {
            if (option.getAttribute('data-mode') === normalizedMode) {
                option.classList.add('selected');
            } else {
                option.classList.remove('selected');
            }
        });
    }

    // 2. Wait 2 seconds THEN switch views
    setTimeout(() => {
        // Restore History Content in the view we are leaving
        if (activeHistoryContainer) {
            activeHistoryContainer.innerHTML = originalHistoryContent;
        }

        // Perform Switch
        setWorkspaceModeImmediate(normalizedMode, { initialize: true });

        syncWorkspaceRouteWithState({ replace: true });

    }, 2000); // 2 Second Delay
}


// --- Workspace Data Persistence ---

const WORKSPACE_DATA_KEY = 'qc_tool_workspace_data';

export function getAllWorkspaceData() {
    return JSON.parse(localStorage.getItem(WORKSPACE_DATA_KEY)) || {};
}

export function saveAllWorkspaceData(data) {
    localStorage.setItem(WORKSPACE_DATA_KEY, JSON.stringify(data));
}

export function saveCurrentWorkspaceData() {
    if (!workspaceState.selectedAccount) return;

    const allData = getAllWorkspaceData();
    const accountId = workspaceState.selectedAccount;

    allData[accountId] = {
        // Registry-based storage
        headingsRegistry: workspaceState.headingsRegistry || {},
        importedHeadingIds: workspaceState.importedHeadingIds || [],
        supportedHeadingIds: workspaceState.supportedHeadingIds || [],

        savedPDMs: workspaceState.savedPDMs || [],
        importHistory: workspaceState.importHistory || [],
        existingHeadings: workspaceState.existingHeadings || [],
        qcReviews: workspaceState.qcReviews || [],
        accountLevelErrors: workspaceState.accountLevelErrors || [] // Persist Account Level Errors
    };

    saveAllWorkspaceData(allData);
}

export function loadWorkspaceData(accountId) {
    if (!accountId) return;

    const allData = getAllWorkspaceData();
    const accountData = allData[accountId] || {};

    // Restore registry-based state
    workspaceState.headingsRegistry = accountData.headingsRegistry || {};
    workspaceState.importedHeadingIds = accountData.importedHeadingIds || [];
    workspaceState.supportedHeadingIds = accountData.supportedHeadingIds || [];

    workspaceState.savedPDMs = accountData.savedPDMs || [];
    workspaceState.importHistory = accountData.importHistory || [];
    workspaceState.existingHeadings = accountData.existingHeadings || [];
    workspaceState.qcReviews = accountData.qcReviews || [];
    workspaceState.accountLevelErrors = accountData.accountLevelErrors || []; // Restore Account Level Errors

    // Clear current PDM in progress when switching accounts
    workspaceState.currentPDM = { headings: [], url: '', description: '', companyType: [], typeOfProof: '', comment: '' };

}

export function resetWorkspaceData() {
    // Reset registry-based structures
    workspaceState.headingsRegistry = {};
    workspaceState.importedHeadingIds = [];
    workspaceState.supportedHeadingIds = [];
    workspaceState.savedPDMs = [];
    workspaceState.importHistory = [];
    workspaceState.existingHeadings = [];
    workspaceState.qcReviews = [];
    workspaceState.accountLevelErrors = []; // Reset
    workspaceState.currentPDM = { headings: [], url: '', description: '', companyType: [], typeOfProof: '', comment: '' };
}

// --- Initialization Logic ---

export function initializeWorkspaceOnLoad() {
    const sessionUser = authManager.getUser();
    const lastSheet = localStorage.getItem('lastSheet');
    if (sessionUser && lastSheet === 'workspace') {
        initializeWorkspace();
    }
}

document.addEventListener('showSheet', (e) => {
    if (e.detail === 'workspace') {
        initializeWorkspace();
    }
});

document.addEventListener('workspace:tab-changed', (event) => {
    const detail = event?.detail || {};
    if (!detail.tabName) return;
    syncWorkspaceRouteWithState();
});

document.addEventListener('route:change', (event) => {
    const detail = event?.detail || {};
    const route = detail.route || {};
    const params = detail.params || {};

    if (route.sheetId !== 'workspace') {
        return;
    }

    const routeAccountId = normalizeAccountId(params.accountId);
    if (routeAccountId && routeAccountId !== normalizeAccountId(workspaceAccountsState.selectedAccountId)) {
        handleGlobalAccountSelection(routeAccountId, { syncRoute: false });
    }

    const routeContext = WORKSPACE_ROUTE_CONTEXT_BY_KEY[route.key];
    if (!routeContext) {
        if (route.path === WORKSPACE_BASE_PATH) {
            syncWorkspaceRouteWithState({ replace: true });
        }
        return;
    }

    suppressWorkspaceRouteSync = true;
    try {
        if (routeContext.mode) {
            setWorkspaceModeImmediate(routeContext.mode, { initialize: true });
        }

        if (routeContext.tabName === 'account-files') {
            if (getActiveWorkspaceMode() === 'qc') {
                switchQCTab('account-files');
            } else {
                switchEditorTab('account-files');
            }
        } else if (routeContext.mode === 'qc') {
            switchQCTab(routeContext.tabName);
        } else {
            switchEditorTab(routeContext.tabName);
        }
    } finally {
        suppressWorkspaceRouteSync = false;
    }

    syncWorkspaceRouteWithState({ replace: true });
});

// Self-initialization removed — initializeWorkspaceOnLoad() is called from app.js after templates load

/**
 * Checks if an account is selected and opens workspace settings if not
 * @returns {boolean} - true if account is selected, false if settings modal was opened
 */
export function ensureAccountSelected() {
    const hasAccount = workspaceAccountsState.selectedAccountId && workspaceAccountsState.selectedAccountId !== '' && workspaceState.selectedAccount;

    if (!hasAccount) {
        // Auto-open workspace settings modal
        const settingsBtn = document.getElementById('workspaceSettingsBtn');
        if (settingsBtn) {
            settingsBtn.click();
        }
        return false;
    }

    return true;
}

// Ensure data is saved before unloading
window.addEventListener('beforeunload', () => {
    // Don't save if data is being cleared
    if (isDataClearing || window.isDataClearing) return;

    if (workspaceState.selectedAccount) {
        saveCurrentWorkspaceData();
    }
});

// Window bridges removed - all functions are exported
