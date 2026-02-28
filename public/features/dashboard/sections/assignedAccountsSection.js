import { router } from '../../../core/app.js';
import { showAlert } from '../../../components/notification.js';
import {
    renderAccountCardsSkeleton,
    setSkeletonBusyState
} from '../../../components/skeleton.js';
import { buildAccountDataRoutePath } from '../../workspace/workspace.js';
import {
    fetchAccounts as fetchAccountsApi,
    updateAccount as updateAccountApi
} from '../api/dashboardApi.js';

const DASHBOARD_STATUS_ICONS = {
    assigned: 'fa-clipboard-list',
    inprogress: 'fa-spinner',
    onhold: 'fa-pause-circle',
    completed: 'fa-check-circle'
};

// Dashboard data is backend-sourced; array stays exported for workspace compatibility.
export const assignedAccountsData = [];

let currentPage = 1;
const DEFAULT_ROWS_PER_PAGE = 8;
const REDUCED_ROWS_PER_PAGE = 3;
const ROWS_PER_PAGE_BREAKPOINT = 1900;
let rowsPerPage = getRowsPerPage();
let filteredAccounts = [];
let isAccountsLoading = false;
let statusOptionsProvider = () => [];

function getRowsPerPage() {
    if (typeof window !== 'undefined' && window.innerWidth <= ROWS_PER_PAGE_BREAKPOINT) {
        return REDUCED_ROWS_PER_PAGE;
    }

    return DEFAULT_ROWS_PER_PAGE;
}

function replaceAssignedAccounts(accounts) {
    assignedAccountsData.splice(0, assignedAccountsData.length, ...accounts);
}

function getStatusOptions() {
    const options = statusOptionsProvider();
    return Array.isArray(options) ? options : [];
}

function getAllowedStatusValues() {
    return getStatusOptions().map(option => option.value);
}

function getStatusLabel(status) {
    const option = getStatusOptions().find(item => item.value === status);
    return option?.label || status;
}

function buildStatusOptionsHtml(selectedStatus) {
    const options = getStatusOptions();
    const selected = String(selectedStatus || '');
    const hasSelected = options.some(option => option.value === selected);

    let html = options.map(option => {
        const isSelected = option.value === selected;
        return `<option value="${option.value}" ${isSelected ? 'selected' : ''}>${option.label}</option>`;
    }).join('');

    if (!hasSelected && selected) {
        html = `<option value="${selected}" selected>${selected}</option>${html}`;
    }

    return html;
}

function setPaginationLoadingState(isLoading) {
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = isLoading ? '... / ...' : pageInfo.textContent;
    }

    const prevBtn = document.querySelector('.pagination-btn:first-child');
    const nextBtn = document.querySelector('.pagination-btn:last-child');

    [prevBtn, nextBtn].forEach((button) => {
        if (!button) return;
        button.disabled = isLoading;
        button.style.opacity = isLoading ? '0.5' : '1';
        button.style.cursor = isLoading ? 'not-allowed' : 'pointer';
    });
}

function toAccountApiPayload(account, overrideStatus = null) {
    return {
        account_id: account.id,
        account_name: account.name,
        editor: account.editor,
        qc: account.qc,
        status: overrideStatus || account.status,
        assigned_date: account.assignedDate || null,
        delivery_date: account.deliveryDate || null,
    };
}

export function setAssignedAccountsStatusOptionsProvider(provider) {
    statusOptionsProvider = typeof provider === 'function' ? provider : () => [];
}

export function setAccountsLoading(isLoading) {
    isAccountsLoading = Boolean(isLoading);
}

export function syncRowsPerPageWithViewport() {
    const nextRowsPerPage = getRowsPerPage();
    if (nextRowsPerPage === rowsPerPage) {
        return false;
    }

    rowsPerPage = nextRowsPerPage;
    const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / rowsPerPage));
    if (currentPage > totalPages) {
        currentPage = totalPages;
    }

    return true;
}

export function upsertAssignedAccount(account) {
    if (!account || !account.id) return;

    const index = assignedAccountsData.findIndex(acc => acc.id === account.id);
    if (index === -1) {
        assignedAccountsData.push(account);
    } else {
        assignedAccountsData[index] = account;
    }
}

export function removeAssignedAccount(accountId) {
    const normalized = String(accountId || '').trim();
    if (!normalized) return;

    const next = assignedAccountsData.filter(acc => String(acc.id) !== normalized);
    replaceAssignedAccounts(next);
}

export async function refreshDashboardAccounts() {
    const accounts = await fetchAccountsApi();
    replaceAssignedAccounts(accounts);
    filteredAccounts = [...assignedAccountsData];
    currentPage = 1;
    return assignedAccountsData;
}

export function loadAssignedAccounts() {
    return [...assignedAccountsData];
}

// Legacy compatibility no-op (dashboard data persistence moved to backend APIs)
export function saveAssignedAccounts() {
    return;
}

export function renderAssignedAccounts() {
    const container = document.getElementById('assignedAccountsContainer');
    if (!container) return;

    if (isAccountsLoading) {
        renderAccountCardsSkeleton(container, { count: rowsPerPage });
        setPaginationLoadingState(true);
        return;
    }

    setSkeletonBusyState(container, false);

    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const pageAccounts = filteredAccounts.slice(start, end);

    if (pageAccounts.length === 0) {
        container.innerHTML = `
            <div class="no-accounts-message">
                <i class="fas fa-inbox" style="font-size: 32px; color: #ddd; margin-bottom: 10px;"></i>
                <p>No accounts found matching your criteria</p>
                <p>Click the "Add Account" button to add a new account.</p>
            </div>
        `;
        updatePaginationInfo();
        return;
    }

    let html = '';
    pageAccounts.forEach(account => {
        const statusClass = `status-${account.status}`;
        const statusText = getStatusText(account.status);
        const statusIcon = getStatusIcon(account.status);
        const statusOptionsHtml = buildStatusOptionsHtml(account.status);

        html += `
            <div class="account-card" data-account-id="${account.id}">
                <div class="account-card-header">
                    <div class="account-id-badge">${account.id}</div>
                    <div class="account-status-badge ${statusClass}">
                        <i class="fas ${statusIcon}"></i>
                        ${statusText}
                    </div>
                </div>
                <div class="account-card-body">
                    <h3 class="account-name">${account.name}</h3>
                    <div class="account-team">
                        <div class="team-member">
                            <i class="fas fa-user-edit"></i>
                            <div class="team-info">
                                <span class="team-label">Editor</span>
                                <span class="team-name">${account.editor || '-'}</span>
                            </div>
                        </div>
                        <div class="team-member">
                            <i class="fas fa-user-check"></i>
                            <div class="team-info">
                                <span class="team-label">QC</span>
                                <span class="team-name">${account.qc || '-'}</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="account-dates">
                    <div class="date-item">
                        <span class="date-label">Assigned</span>
                        <span class="date-value">${account.assignedDate || '-'}</span>
                    </div>
                    <div class="date-item">
                        <span class="date-label">Delivery</span>
                        <span class="date-value">${account.deliveryDate || '-'}</span>
                    </div>
                </div>
                <div class="account-card-footer">
                    <select class="status-dropdown">
                        ${statusOptionsHtml}
                    </select>
                    <button class="view-details-btn" title="View Files, Notes & Comments">
                        <i class="fas fa-eye"></i> View Details
                    </button>
                    <button class="edit-accounts-btn" title="Edit Account">
                        <i class="fas fa-pencil-alt"></i>
                    </button>
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
    updatePaginationInfo();
}

export function getStatusText(status) {
    return getStatusLabel(status);
}

export function getStatusIcon(status) {
    return DASHBOARD_STATUS_ICONS[status] || 'fa-circle';
}

export function viewAccountInWorkspace(accountId) {
    const account = assignedAccountsData.find(acc => acc.id === accountId);
    if (!account) {
        showAlert('warning', 'Account not found.');
        return;
    }

    router.navigate(buildAccountDataRoutePath(accountId));
}

export function updatePaginationInfo() {
    const totalPages = Math.ceil(filteredAccounts.length / rowsPerPage);
    const pageInfo = document.getElementById('pageInfo');
    if (pageInfo) {
        pageInfo.textContent = `${currentPage} / ${totalPages || 1}`;
    }

    const prevBtn = document.querySelector('.pagination-btn:first-child');
    const nextBtn = document.querySelector('.pagination-btn:last-child');

    if (prevBtn) {
        prevBtn.disabled = currentPage === 1;
        prevBtn.style.opacity = currentPage === 1 ? '0.5' : '1';
        prevBtn.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
    }

    if (nextBtn) {
        nextBtn.disabled = currentPage >= totalPages;
        nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
        nextBtn.style.cursor = currentPage >= totalPages ? 'not-allowed' : 'pointer';
    }
}

export function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderAssignedAccounts();
    }
}

export function nextPage() {
    const totalPages = Math.ceil(filteredAccounts.length / rowsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderAssignedAccounts();
    }
}

export async function updateAccountStatus(accountId, newStatus) {
    const allowedStatusValues = getAllowedStatusValues();
    if (allowedStatusValues.length > 0 && !allowedStatusValues.includes(newStatus)) {
        showAlert('error', 'Invalid account status selected.');
        renderAssignedAccounts();
        return;
    }

    const account = assignedAccountsData.find(acc => acc.id === accountId);
    if (!account) {
        showAlert('warning', 'Account not found.');
        return;
    }

    const previousStatus = account.status;
    account.status = newStatus;
    renderAssignedAccounts();

    try {
        const updatedAccount = await updateAccountApi(accountId, toAccountApiPayload(account, newStatus));
        upsertAssignedAccount(updatedAccount);
        filterAccounts();
    } catch (error) {
        account.status = previousStatus;
        renderAssignedAccounts();
        showAlert('error', error?.message || 'Failed to update account status.');
    }
}

export function filterAccounts() {
    const searchInput = document.getElementById('dashboardSearchInput');
    const statusFilter = document.getElementById('dashboardStatusFilter');

    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';
    const statusValue = statusFilter ? statusFilter.value : 'all';

    filteredAccounts = assignedAccountsData.filter(account => {
        const id = String(account.id || '').toLowerCase();
        const name = String(account.name || '').toLowerCase();
        const editor = String(account.editor || '').toLowerCase();
        const qc = String(account.qc || '').toLowerCase();

        const matchesSearch = searchTerm === ''
            || id.includes(searchTerm)
            || name.includes(searchTerm)
            || editor.includes(searchTerm)
            || qc.includes(searchTerm);

        const matchesStatus = statusValue === 'all' || account.status === statusValue;

        return matchesSearch && matchesStatus;
    });

    currentPage = 1;
    renderAssignedAccounts();
}
