import { authManager } from '../../core/auth/AuthManager.js';
import { showAlert } from '../../components/notification.js';
import {
    fetchDashboardMetadata,
    getCachedDashboardMetadata
} from './api/dashboardApi.js';
import {
    assignedAccountsData,
    setAssignedAccountsStatusOptionsProvider,
    setAccountsLoading,
    upsertAssignedAccount,
    removeAssignedAccount,
    refreshDashboardAccounts,
    loadAssignedAccounts,
    saveAssignedAccounts,
    renderAssignedAccounts,
    getStatusText,
    getStatusIcon,
    viewAccountInWorkspace,
    updatePaginationInfo,
    previousPage,
    nextPage,
    updateAccountStatus,
    filterAccounts,
    syncRowsPerPageWithViewport
} from './sections/assignedAccountsSection.js';
import {
    documentsData,
    setDocumentsLoading,
    prependDashboardDocument,
    removeDashboardDocument,
    refreshDashboardDocuments,
    deleteDocument,
    bindDocumentsPanelEvents,
    renderDocuments,
    saveDashboardDocuments
} from './sections/documentsSection.js';

let dashboardMetadata = getCachedDashboardMetadata();
let dashboardListenersInitialized = false;
let isDashboardInitializing = false;

function getStatusOptions() {
    return Array.isArray(dashboardMetadata?.statuses) ? dashboardMetadata.statuses : [];
}

function getDocumentTypeOptions() {
    return Array.isArray(dashboardMetadata?.documentTypes) ? dashboardMetadata.documentTypes : [];
}

function hydrateStatusFilterOptions() {
    const statusFilter = document.getElementById('dashboardStatusFilter');
    if (!statusFilter) return;

    const previous = statusFilter.value || 'all';
    let html = '<option value="all">All Status</option>';

    getStatusOptions().forEach(option => {
        html += `<option value="${option.value}">${option.label}</option>`;
    });

    statusFilter.innerHTML = html;
    const validValues = ['all', ...getStatusOptions().map(option => option.value)];
    statusFilter.value = validValues.includes(previous) ? previous : 'all';
}

setAssignedAccountsStatusOptionsProvider(getStatusOptions);

export function getDashboardMetadata() {
    return {
        statuses: getStatusOptions(),
        documentTypes: getDocumentTypeOptions(),
        noteSubjects: Array.isArray(dashboardMetadata?.noteSubjects) ? [...dashboardMetadata.noteSubjects] : [],
        accountFileTypes: Array.isArray(dashboardMetadata?.accountFileTypes) ? [...dashboardMetadata.accountFileTypes] : [],
        accountIdPolicy: {
            ...(dashboardMetadata?.accountIdPolicy || {})
        }
    };
}

// Initialize Dashboard
export async function initializeDashboard() {
    if (isDashboardInitializing) {
        return;
    }

    isDashboardInitializing = true;
    setAccountsLoading(true);
    setDocumentsLoading(true);
    renderAssignedAccounts();
    renderDocuments();

    try {
        try {
            dashboardMetadata = await fetchDashboardMetadata();
        } catch (error) {
            dashboardMetadata = getCachedDashboardMetadata();
        }

        hydrateStatusFilterOptions();

        const [accountsResult, documentsResult] = await Promise.allSettled([
            refreshDashboardAccounts(),
            refreshDashboardDocuments()
        ]);

        setAccountsLoading(false);
        setDocumentsLoading(false);

        if (accountsResult.status === 'rejected') {
            throw accountsResult.reason;
        }

        if (documentsResult.status === 'rejected') {
            showAlert('warning', documentsResult.reason?.message || 'Documents could not be loaded.');
        }

        filterAccounts();
        renderDocuments();
    } catch (error) {
        setAccountsLoading(false);
        setDocumentsLoading(false);
        filterAccounts();
        renderDocuments();
        showAlert('error', error?.message || 'Failed to load dashboard data.');
    } finally {
        checkDashboardPermissions();
        setupDashboardEventListeners();
        isDashboardInitializing = false;
    }
}

// Setup Event Listeners
export function setupDashboardEventListeners() {
    if (dashboardListenersInitialized) {
        return;
    }

    const searchInput = document.getElementById('dashboardSearchInput');
    const statusFilter = document.getElementById('dashboardStatusFilter');

    if (searchInput) {
        searchInput.addEventListener('input', filterAccounts);
    }

    if (statusFilter) {
        statusFilter.addEventListener('change', filterAccounts);
    }

    window.addEventListener('resize', () => {
        if (!syncRowsPerPageWithViewport()) {
            return;
        }

        renderAssignedAccounts();
    });

    bindDocumentsPanelEvents();

    dashboardListenersInitialized = true;
}

/**
 * Check dashboard permissions and hide restricted controls for non-admins.
 */
export function checkDashboardPermissions() {
    const isAdmin = authManager.isAdmin();

    const addDocBtn = document.querySelector('.header-right .add-document-btn');
    if (addDocBtn) {
        addDocBtn.style.display = isAdmin ? 'flex' : 'none';
    }
}

export {
    assignedAccountsData,
    upsertAssignedAccount,
    removeAssignedAccount,
    refreshDashboardAccounts,
    loadAssignedAccounts,
    saveAssignedAccounts,
    renderAssignedAccounts,
    getStatusText,
    getStatusIcon,
    viewAccountInWorkspace,
    updatePaginationInfo,
    previousPage,
    nextPage,
    updateAccountStatus,
    filterAccounts,
    documentsData,
    prependDashboardDocument,
    removeDashboardDocument,
    refreshDashboardDocuments,
    deleteDocument,
    renderDocuments,
    saveDashboardDocuments
};
