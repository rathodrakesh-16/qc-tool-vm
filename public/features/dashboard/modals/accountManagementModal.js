// scripts/modals/accountManagementModal.js
import { assignedAccountsData, upsertAssignedAccount, removeAssignedAccount, filterAccounts, getDashboardMetadata } from '../dashboard.js';
import { authManager } from '../../../core/auth/AuthManager.js';
import { showAlert } from '../../../components/notification.js';
import { workspaceState } from '../../workspace/state/workspaceState.js';
import { workspaceAccountsState } from '../../workspace/state/workspaceAccountsState.js';
import { qcModeState } from '../../workspace/state/qcModeState.js';
import { purgeAccountFilesData } from '../../workspace/sharedComponents/accountData.js';
import { HistoryManager } from '../../workspace/modals/changeLogModal.js';
import {
    createAccount as createAccountApi,
    updateAccount as updateAccountApi,
    deleteAccount as deleteAccountApi
} from '../api/dashboardApi.js';

let isEditingAccount = false;
let editingAccountId = null;
let isSavingAccount = false;
let isDeletingAccount = false;
let cachedUsers = [];

const STORAGE_KEYS = {
    WORKSPACE_DATA: 'qc_tool_workspace_data',
    HISTORY: 'qc_tool_history',
    ACTIVE_ACCOUNT_ID: 'qc_tool_active_account_id',
    ACTIVE_MODE: 'qc_tool_active_mode',
    ACCOUNT_DETAILS: 'accountDetails',
    COMPANY_PROFILE: 'companyProfile'
};

function getAccountIdDisplayLength() {
    const rawLength = Number(getDashboardMetadata()?.accountIdPolicy?.displayLength);
    return Number.isInteger(rawLength) && rawLength > 0 ? rawLength : 8;
}

function getDefaultStatusValue() {
    const statuses = getDashboardMetadata()?.statuses;
    if (!Array.isArray(statuses) || statuses.length === 0) {
        return 'assigned';
    }

    return statuses[0]?.value || 'assigned';
}

function formatAccountId8(value) {
    const trimmed = String(value || '').trim();
    const maxLength = getAccountIdDisplayLength();

    if (!new RegExp(`^\\d{1,${maxLength}}$`).test(trimmed)) {
        return null;
    }

    const stored = String(parseInt(trimmed, 10));
    if (!/^\d+$/.test(stored) || stored === '0') {
        return null;
    }

    return stored.padStart(maxLength, '0');
}

function normalizeAccountId(value) {
    const trimmed = String(value || '').trim();
    if (!trimmed) return '';

    const formatted = formatAccountId8(trimmed);
    return formatted || trimmed;
}

async function loadUsersIntoDropdowns() {
    const editorSelect = document.getElementById('newEditorName');
    const qcSelect = document.getElementById('newQcName');
    if (!editorSelect || !qcSelect) return;

    if (cachedUsers.length === 0) {
        try {
            cachedUsers = await authManager.fetchUserNames();
        } catch {
            cachedUsers = [];
        }
    }

    const sorted = [...cachedUsers].sort((a, b) => (a.username || '').localeCompare(b.username || ''));

    [editorSelect, qcSelect].forEach(select => {
        const currentValue = select.value;
        select.innerHTML = '<option value="">-- Select --</option>';
        sorted.forEach(user => {
            const option = document.createElement('option');
            option.value = user.username;
            option.textContent = user.username;
            select.appendChild(option);
        });
        if (currentValue) select.value = currentValue;
    });
}

function resetWorkspaceStateData() {
    workspaceState.headingsRegistry = {};
    workspaceState.importedHeadingIds = [];
    workspaceState.supportedHeadingIds = [];
    workspaceState.savedPDMs = [];
    workspaceState.importHistory = [];
    workspaceState.existingHeadings = [];
    workspaceState.qcReviews = [];
    workspaceState.accountLevelErrors = [];
    workspaceState.currentPDM = {
        headings: [],
        url: '',
        description: '',
        companyType: [],
        typeOfProof: '',
        comment: ''
    };
}

function toggleDeleteConfirmPanel(show) {
    const panel = document.getElementById('deleteAccountConfirmPanel');
    if (panel) {
        panel.style.display = show ? 'block' : 'none';
    }
}

function updateDeleteConfirmButtonState() {
    const input = document.getElementById('deleteAccountConfirmInput');
    const confirmBtn = document.getElementById('confirmDeleteAccountBtn');
    const targetId = normalizeAccountId(editingAccountId);

    if (!input || !confirmBtn) return;

    if (isDeletingAccount) {
        confirmBtn.disabled = true;
        return;
    }

    confirmBtn.disabled = !targetId || normalizeAccountId(input.value) !== targetId;
}

function resetDeleteConfirmationState() {
    const input = document.getElementById('deleteAccountConfirmInput');
    if (input) {
        input.value = '';
    }
    toggleDeleteConfirmPanel(false);
    updateDeleteConfirmButtonState();
}

function updateDeleteControlsVisibility() {
    const section = document.getElementById('deleteAccountSection');
    const showDeleteBtn = document.getElementById('showDeleteAccountConfirmBtn');
    const accountIdLabel = document.getElementById('deleteAccountIdLabel');
    const actionsRow = document.querySelector('.account-management-modal-actions');

    if (!section || !showDeleteBtn) return;

    const isEditMode = isEditingAccount && normalizeAccountId(editingAccountId) !== '';
    const editingAccount = assignedAccountsData.find(acc => normalizeAccountId(acc.id) === normalizeAccountId(editingAccountId));
    const canDelete = isEditMode && !editingAccount?.isSystem;
    showDeleteBtn.style.display = canDelete ? 'flex' : 'none';
    section.style.display = canDelete ? 'block' : 'none';

    if (actionsRow) {
        actionsRow.classList.toggle('has-delete', isEditMode);
    }

    if (accountIdLabel) {
        accountIdLabel.textContent = normalizeAccountId(editingAccountId);
    }

    resetDeleteConfirmationState();
}

function purgeWorkspaceDataForAccount(accountId) {
    const raw = localStorage.getItem(STORAGE_KEYS.WORKSPACE_DATA);
    if (!raw) return;

    try {
        const allWorkspaceData = JSON.parse(raw);
        if (!allWorkspaceData || typeof allWorkspaceData !== 'object') {
            return;
        }

        if (Object.prototype.hasOwnProperty.call(allWorkspaceData, accountId)) {
            delete allWorkspaceData[accountId];
            localStorage.setItem(STORAGE_KEYS.WORKSPACE_DATA, JSON.stringify(allWorkspaceData));
        }
    } catch (error) {
    }
}

function purgeHistoryForAccount(accountId) {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (!raw) return;

    try {
        const history = JSON.parse(raw);
        if (!Array.isArray(history)) {
            return;
        }

        const filtered = history.filter(entry => entry?.accountId !== accountId);
        localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(filtered));
    } catch (error) {
    }
}

function purgeAccountDetailsIfMatched(accountId) {
    const raw = localStorage.getItem(STORAGE_KEYS.ACCOUNT_DETAILS);
    if (!raw) return;

    try {
        const details = JSON.parse(raw);
        const detailsAccountId = normalizeAccountId(details?.accountId);
        if (detailsAccountId && detailsAccountId === accountId) {
            localStorage.removeItem(STORAGE_KEYS.ACCOUNT_DETAILS);
            localStorage.removeItem(STORAGE_KEYS.COMPANY_PROFILE);
        }
    } catch (error) {
    }
}

function clearActiveAccountIfMatched(accountId) {
    const activeAccountId = normalizeAccountId(localStorage.getItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID));
    if (activeAccountId === accountId) {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_ACCOUNT_ID);
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_MODE);
    }
}

function resetInMemoryAccountState(accountId) {
    workspaceAccountsState.allAccounts = (workspaceAccountsState.allAccounts || []).filter(
        account => normalizeAccountId(account?.id) !== accountId
    );
    workspaceAccountsState.filteredAccounts = (workspaceAccountsState.filteredAccounts || []).filter(
        account => normalizeAccountId(account?.id) !== accountId
    );

    if (normalizeAccountId(workspaceAccountsState.selectedAccountId) === accountId) {
        workspaceAccountsState.selectedAccountId = '';
    }

    if (normalizeAccountId(workspaceState.selectedAccount) === accountId) {
        workspaceState.selectedAccount = null;
        resetWorkspaceStateData();

        const editorSelectedAccount = document.getElementById('editorSelectedAccount');
        const qcSelectedAccount = document.getElementById('qcSelectedAccount');
        if (editorSelectedAccount) {
            editorSelectedAccount.textContent = 'NO Account Selected';
        }
        if (qcSelectedAccount) {
            qcSelectedAccount.textContent = 'NO Account Selected';
        }
    }

    if (normalizeAccountId(qcModeState.selectedAccount?.id) === accountId) {
        qcModeState.selectedAccount = null;
    }
}

function setSaveButtonLoading(isLoading) {
    const saveButton = document.getElementById('saveAccountBtn');
    const saveText = document.getElementById('saveAccountBtnText');

    if (!saveButton || !saveText) return;

    saveButton.disabled = isLoading;

    if (isLoading) {
        saveText.textContent = isEditingAccount ? 'Updating...' : 'Saving...';
    } else {
        saveText.textContent = isEditingAccount ? 'Update Account' : 'Save Account';
    }
}

function setDeleteButtonLoading(isLoading) {
    const confirmDeleteBtn = document.getElementById('confirmDeleteAccountBtn');
    if (!confirmDeleteBtn) return;

    if (isLoading) {
        confirmDeleteBtn.disabled = true;
        confirmDeleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    } else {
        confirmDeleteBtn.innerHTML = 'Confirm Delete';
        updateDeleteConfirmButtonState();
    }
}

function buildAccountPayloadFromForm() {
    const nameInput = document.getElementById('newAccountName');
    const idInput = document.getElementById('newAccountId');
    const editorInput = document.getElementById('newEditorName');
    const qcInput = document.getElementById('newQcName');

    if (!nameInput || !idInput || !editorInput || !qcInput) {
        throw new Error('Form elements not found. Please reload the page.');
    }

    const account_name = nameInput.value.trim();
    const account_id_raw = idInput.value.trim();
    const editor = editorInput.value.trim();
    const qc = qcInput.value.trim();

    const assignedDateInput = document.getElementById('newAccountAssignedDate');
    const deliveryDateInput = document.getElementById('newAccountDeliveryDate');

    const assigned_date = assignedDateInput ? assignedDateInput.value || null : null;
    const delivery_date = deliveryDateInput ? deliveryDateInput.value || null : null;

    if (!account_name || !account_id_raw || !editor || !qc) {
        throw new Error('Please fill in all required fields.');
    }

    const maxLength = getAccountIdDisplayLength();
    if (!new RegExp(`^\\d{1,${maxLength}}$`).test(account_id_raw)) {
        throw new Error(`Account ID must be numeric and up to ${maxLength} digits.`);
    }

    const account_id = formatAccountId8(account_id_raw);
    if (!account_id) {
        throw new Error('Account ID cannot be all zeros.');
    }

    idInput.value = account_id;

    const existingStatus = assignedAccountsData.find(acc => normalizeAccountId(acc.id) === normalizeAccountId(editingAccountId))?.status;

    const defaultStatus = getDefaultStatusValue();

    return {
        account_id,
        account_name,
        editor,
        qc,
        status: existingStatus || defaultStatus,
        assigned_date,
        delivery_date
    };
}

export function createCreateAccountModal() {
    if (document.getElementById('createAccountModal')) return;

    const modalHtml = `
      <div id="createAccountModal" class="account-management-modal-overlay" style="display: none;">
        <div class="account-management-modal">
          <div class="account-management-modal-header">
            <h2 class="account-management-modal-title" id="createAccountModalTitle">Create New Account Card</h2>
            <button class="account-management-modal-close-btn">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <form id="newAccountForm">
            <div class="account-management-form-group">
              <label for="newAccountName">Account Name *</label>
              <input type="text" id="newAccountName" required placeholder="Account Name"/> 
            </div>
            <div class="account-management-form-group">
              <label for="newAccountId">Account ID *</label>
              <input type="text" id="newAccountId" required pattern="\\d{1,8}" title="Account ID must be numeric and up to 8 digits." placeholder="Account ID" />
            </div>
            <div class="account-management-form-group">
              <label for="newEditorName">Editor Name *</label>
              <select id="newEditorName" required>
                <option value="">-- Select Editor --</option>
              </select>
            </div>
            <div class="account-management-form-group">
              <label for="newQcName">QC Name *</label>
              <select id="newQcName" required>
                <option value="">-- Select QC --</option>
              </select>
            </div>

            <div class="account-management-form-group">
              <label for="newAccountAssignedDate">Assigned Date</label>
              <input type="date" id="newAccountAssignedDate" />
            </div>

            <div class="account-management-form-group">
              <label for="newAccountDeliveryDate">Delivery Date</label>
              <input type="date" id="newAccountDeliveryDate" />
            </div>

            <div class="account-management-modal-actions">
              <button type="button" id="showDeleteAccountConfirmBtn" class="account-management-btn account-management-btn-danger" style="display: none;">
                <i class="fas fa-trash"></i> Delete Account
              </button>

              <button type="submit" class="account-management-btn account-management-btn-primary" id="saveAccountBtn">
                <i class="fas fa-save"></i> <span id="saveAccountBtnText">Save Account</span>
              </button>
            </div>

            <div id="deleteAccountSection" class="delete-account-section" style="display: none;">
              <div id="deleteAccountConfirmPanel" class="delete-account-confirm-panel" style="display: none;">
                <p class="delete-account-warning-text">
                  This will permanently delete this account and all related account data.
                </p>
                <p class="delete-account-warning-text">
                  Type account ID <strong id="deleteAccountIdLabel"></strong> to confirm:
                </p>
                <input
                  type="text"
                  id="deleteAccountConfirmInput"
                  class="delete-account-confirm-input"
                  placeholder="Enter Account ID"
                />
                <div class="delete-account-confirm-actions">
                  <button type="button" id="cancelDeleteAccountBtn" class="account-management-btn account-management-btn-secondary">
                    Cancel
                  </button>
                  <button type="button" id="confirmDeleteAccountBtn" class="account-management-btn account-management-btn-danger" disabled>
                    Confirm Delete
                  </button>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);

    const modal = document.getElementById('createAccountModal');

    const closeBtn = modal.querySelector('.account-management-modal-close-btn');
    if (closeBtn) closeBtn.addEventListener('click', closeCreateAccountModal);

    const form = document.getElementById('newAccountForm');
    if (form) form.addEventListener('submit', (e) => {
        e.preventDefault();
        handleSaveAccount();
    });

    const accountIdInput = document.getElementById('newAccountId');
    if (accountIdInput) {
        const maxLength = getAccountIdDisplayLength();
        accountIdInput.setAttribute('pattern', `\\d{1,${maxLength}}`);
        accountIdInput.setAttribute('title', `Account ID must be numeric and up to ${maxLength} digits.`);

        accountIdInput.addEventListener('blur', () => {
            if (isEditingAccount) {
                return;
            }

            const formatted = formatAccountId8(accountIdInput.value);
            if (formatted) {
                accountIdInput.value = formatted;
            }
        });
    }

    const showDeleteConfirmBtn = document.getElementById('showDeleteAccountConfirmBtn');
    if (showDeleteConfirmBtn) {
        showDeleteConfirmBtn.addEventListener('click', () => {
            toggleDeleteConfirmPanel(true);
            updateDeleteConfirmButtonState();
        });
    }

    const cancelDeleteBtn = document.getElementById('cancelDeleteAccountBtn');
    if (cancelDeleteBtn) {
        cancelDeleteBtn.addEventListener('click', () => {
            resetDeleteConfirmationState();
        });
    }

    const deleteConfirmInput = document.getElementById('deleteAccountConfirmInput');
    if (deleteConfirmInput) {
        deleteConfirmInput.addEventListener('input', updateDeleteConfirmButtonState);
        deleteConfirmInput.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                const confirmDeleteBtn = document.getElementById('confirmDeleteAccountBtn');
                if (confirmDeleteBtn && !confirmDeleteBtn.disabled) {
                    handleDeleteAccount();
                }
            }
        });
    }

    const confirmDeleteBtn = document.getElementById('confirmDeleteAccountBtn');
    if (confirmDeleteBtn) {
        confirmDeleteBtn.addEventListener('click', handleDeleteAccount);
    }

    modal.addEventListener('click', function (event) {
        if (event.target === modal) {
            closeCreateAccountModal();
        }
    });

    document.addEventListener('keydown', function (event) {
        if (event.key === 'Escape' && modal.style.display === 'flex') {
            closeCreateAccountModal();
        }
    });
}

export function openCreateAccountModal(accountToEdit = null) {
    createCreateAccountModal();

    const modal = document.getElementById('createAccountModal');
    if (!modal) {
        return;
    }

    modal.style.display = 'flex';
    const form = document.getElementById('newAccountForm');
    const title = document.getElementById('createAccountModalTitle');
    const saveBtnText = document.getElementById('saveAccountBtnText');
    const idInput = document.getElementById('newAccountId');
    const assignedDateInput = document.getElementById('newAccountAssignedDate');
    const deliveryDateInput = document.getElementById('newAccountDeliveryDate');

    if (form) form.reset();

    loadUsersIntoDropdowns().then(() => {
        if (accountToEdit) {
            document.getElementById('newEditorName').value = accountToEdit.editor;
            document.getElementById('newQcName').value = accountToEdit.qc;
        }
    });

    if (accountToEdit) {
        isEditingAccount = true;
        editingAccountId = accountToEdit.id;

        title.textContent = 'Edit Account Details';
        saveBtnText.textContent = 'Update Account';

        document.getElementById('newAccountName').value = accountToEdit.name;
        idInput.value = accountToEdit.id;

        if (assignedDateInput) {
            assignedDateInput.value = accountToEdit.assignedDate || '';
        }
        if (deliveryDateInput) {
            deliveryDateInput.value = accountToEdit.deliveryDate || '';
        }

        idInput.disabled = true;
        idInput.style.backgroundColor = '#f1f5f9';
        idInput.style.cursor = 'not-allowed';
        updateDeleteControlsVisibility();
    } else {
        isEditingAccount = false;
        editingAccountId = null;

        title.textContent = 'Create New Account Card';
        saveBtnText.textContent = 'Save Account';

        idInput.disabled = false;
        idInput.style.backgroundColor = '';
        idInput.style.cursor = '';

        if (assignedDateInput) {
            assignedDateInput.value = new Date().toISOString().split('T')[0];
        }
        if (deliveryDateInput) {
            deliveryDateInput.value = '';
        }
        updateDeleteControlsVisibility();
    }

    setSaveButtonLoading(false);
    setDeleteButtonLoading(false);
}

export function openEditAccount(accountId) {
    const account = assignedAccountsData.find(acc => acc.id == accountId); // loose equality for string/number match
    if (account) {
        openCreateAccountModal(account);
    } else {
        showAlert('warning', 'Account not found for editing.');
    }
}

export function closeCreateAccountModal() {
    const modal = document.getElementById('createAccountModal');
    if (modal) {
        modal.style.display = 'none';
    }

    isEditingAccount = false;
    editingAccountId = null;
    isSavingAccount = false;
    isDeletingAccount = false;
    updateDeleteControlsVisibility();
    resetDeleteConfirmationState();
    setSaveButtonLoading(false);
    setDeleteButtonLoading(false);
}

export function createAccount() {
    // This function is called by the button in index.html
    openCreateAccountModal();
}

export async function handleDeleteAccount() {
    if (isDeletingAccount) {
        return;
    }

    if (!isEditingAccount || !editingAccountId) {
        showAlert('warning', 'Delete is only available while editing an existing account.');
        return;
    }

    const accountId = normalizeAccountId(editingAccountId);
    const confirmationInput = document.getElementById('deleteAccountConfirmInput');
    const typedAccountId = normalizeAccountId(confirmationInput?.value);

    if (typedAccountId !== accountId) {
        showAlert('warning', `Please type the exact Account ID (${accountId}) to confirm deletion.`);
        return;
    }

    const deletedAccount = assignedAccountsData.find(acc => normalizeAccountId(acc.id) === accountId);
    if (!deletedAccount) {
        showAlert('warning', 'Account not found. Please refresh and try again.');
        return;
    }

    isDeletingAccount = true;
    setDeleteButtonLoading(true);

    try {
        await deleteAccountApi(accountId);

        removeAssignedAccount(accountId);

        // Purge account-scoped local data (account files/workspace/history/account metadata)
        purgeWorkspaceDataForAccount(accountId);
        purgeAccountFilesData(accountId);
        purgeHistoryForAccount(accountId);
        purgeAccountDetailsIfMatched(accountId);
        clearActiveAccountIfMatched(accountId);

        resetInMemoryAccountState(accountId);

        filterAccounts();
        closeCreateAccountModal();

        showAlert('success', `Account "${deletedAccount.name}" (${accountId}) deleted permanently.`);
    } catch (error) {
        showAlert('error', error?.message || 'Failed to delete account.');
    } finally {
        isDeletingAccount = false;
        setDeleteButtonLoading(false);
    }
}

export async function handleSaveAccount() {
    if (isSavingAccount) {
        return;
    }

    let payload;
    try {
        payload = buildAccountPayloadFromForm();
    } catch (error) {
        showAlert('warning', error?.message || 'Invalid account data.');
        return;
    }

    // Validate account ID immutability during edit.
    if (isEditingAccount && normalizeAccountId(payload.account_id) !== normalizeAccountId(editingAccountId)) {
        showAlert('warning', 'Account ID cannot be changed during edit.');
        return;
    }

    // Fast local duplicate check before backend request.
    if (!isEditingAccount && assignedAccountsData.some(acc => normalizeAccountId(acc.id) === normalizeAccountId(payload.account_id))) {
        showAlert('warning', `Account ID ${payload.account_id} already exists.`);
        return;
    }

    isSavingAccount = true;
    setSaveButtonLoading(true);

    try {
        if (isEditingAccount) {
            const updatedAccount = await updateAccountApi(editingAccountId, payload);
            upsertAssignedAccount(updatedAccount);

            const currentUser = authManager.getUser()?.username || 'Unknown';
            HistoryManager.addEntry('Account Updated', `Updated details for "${updatedAccount.name}" (${updatedAccount.id})`, currentUser, updatedAccount.id);

            showAlert('success', `Account "${updatedAccount.name}" (${updatedAccount.id}) updated successfully!`);
        } else {
            const createdAccount = await createAccountApi(payload);
            upsertAssignedAccount(createdAccount);

            const currentUser = authManager.getUser()?.username || 'Unknown';
            HistoryManager.addEntry('Account Created', `Created account "${createdAccount.name}" (${createdAccount.id})`, currentUser, createdAccount.id);

            showAlert('success', `Account "${createdAccount.name}" (${createdAccount.id}) created successfully!`);
        }

        filterAccounts();
        closeCreateAccountModal();
    } catch (error) {
        showAlert('error', error?.message || 'Failed to save account.');
    } finally {
        isSavingAccount = false;
        setSaveButtonLoading(false);
    }
}

// Window bridges removed - functions are exported and imported where needed
