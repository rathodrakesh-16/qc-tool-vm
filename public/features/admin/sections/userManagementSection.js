import { authManager } from '../../../core/auth/AuthManager.js';
import {
    renderAdminUsersSkeleton,
    setSkeletonBusyState
} from '../../../components/skeleton.js';

// Store admin users data
let adminUsers = [];
let adminUsersLoadError = null;
let isAdminUsersLoading = false;

// Pagination state
let currentPage = 1;
const ROWS_PER_PAGE = 10;

let currentEditId = null;
let currentEditType = null;

function getAdminUserDisplayPriority(user) {
    const name = String(user?.name || '').trim().toLowerCase();
    const userId = String(user?.userId || '').trim().toLowerCase();
    const email = String(user?.email || '').trim().toLowerCase();
    const role = String(user?.role || '').trim().toLowerCase();

    const isDemoUser = name.includes('demo')
        || userId.includes('demo')
        || email.includes('demo');

    if (isDemoUser) return 0;
    if (role === 'admin') return 1;
    return 2;
}

function sortAdminUsersForDisplay(users) {
    return [...users].sort((a, b) => {
        const priorityDelta = getAdminUserDisplayPriority(a) - getAdminUserDisplayPriority(b);
        if (priorityDelta !== 0) return priorityDelta;

        return String(a?.name || '').localeCompare(String(b?.name || ''), undefined, {
            sensitivity: 'base'
        });
    });
}

function getFilteredAdminUsers() {
    const search = document.getElementById('adminUserSearch');
    const searchValue = search?.value?.trim();
    if (!searchValue) {
        return adminUsers;
    }

    const term = searchValue.toLowerCase();
    return adminUsers.filter((user) => {
        const name = String(user?.name || '').toLowerCase();
        const userId = String(user?.userId || '').toLowerCase();
        const email = String(user?.email || '').toLowerCase();

        return name.includes(term)
            || userId.includes(term)
            || email.includes(term);
    });
}

function setAdminPaginationLoadingState(isLoading) {
    const pageInfo = document.getElementById('adminPageInfo');
    if (pageInfo && isLoading) {
        pageInfo.textContent = '... / ...';
    }

    const prevBtn = document.getElementById('adminPrevPage');
    const nextBtn = document.getElementById('adminNextPage');

    [prevBtn, nextBtn].forEach((button) => {
        if (!button) return;
        button.disabled = Boolean(isLoading);
    });
}

function updateAdminPaginationInfo(totalRows) {
    const totalPages = totalRows > 0 ? Math.ceil(totalRows / ROWS_PER_PAGE) : 0;
    if (totalPages > 0 && currentPage > totalPages) {
        currentPage = totalPages;
    }
    if (totalPages === 0) {
        currentPage = 1;
    }

    const pageInfo = document.getElementById('adminPageInfo');
    if (pageInfo) {
        pageInfo.textContent = totalPages > 0 ? `${currentPage} / ${totalPages}` : '0 / 0';
    }

    const prevBtn = document.getElementById('adminPrevPage');
    const nextBtn = document.getElementById('adminNextPage');

    if (prevBtn) {
        prevBtn.disabled = totalPages === 0 || currentPage === 1;
    }

    if (nextBtn) {
        nextBtn.disabled = totalPages === 0 || currentPage >= totalPages;
    }
}

function previousAdminPage() {
    if (currentPage <= 1) return;
    currentPage -= 1;
    renderAdminUsers();
}

function nextAdminPage() {
    const filteredUsers = getFilteredAdminUsers();
    const totalPages = Math.ceil(filteredUsers.length / ROWS_PER_PAGE);
    if (currentPage >= totalPages) return;
    currentPage += 1;
    renderAdminUsers();
}

export function renderUserManagementSectionMarkup() {
    return `
        <div class="um-section-header">
          <h2>User Management</h2>
          <div class="um-search-filter">
            <div class="um-search-bar">
              <i class="fas fa-search"></i>
              <input type="text" id="adminUserSearch" placeholder="Search Users...">
            </div>
            <button class="um-add-btn">
              <i class="fas fa-plus"></i> Add User
            </button>
          </div>
        </div>

        <div class="um-table-container">
          <div class="um-table-header um-table-row">
            <div class="um-table-cell">User ID</div>
            <div class="um-table-cell">Name</div>
            <div class="um-table-cell">Designation</div>
            <div class="um-table-cell">Team</div>
            <div class="um-table-cell">Location</div>
            <div class="um-table-cell">Role</div>
            <div class="um-table-cell">Status</div>
            <div class="um-table-cell">Actions</div>
          </div>
          <div id="adminUsersList" class="um-table-body">
            <!-- Rows injected by JS -->
          </div>
        </div>

        <div class="um-pagination" id="adminPagination">
          <button class="um-pagination-btn" id="adminPrevPage" title="Previous Page">
            <i class="fas fa-chevron-left"></i>
          </button>
          <span class="um-page-info" id="adminPageInfo">1 / 1</span>
          <button class="um-pagination-btn" id="adminNextPage" title="Next Page">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>

        <div id="adminModalsContainer"></div>
    `;
}

function initializeUserManagementEvents() {
    const sectionRoot = document.getElementById('admin-users-tab');
    if (sectionRoot?.dataset.umEventsBound === 'true') {
        return;
    }

    const addUserBtn = document.querySelector('.um-add-btn');
    if (addUserBtn) {
        addUserBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openAdminUserModal();
        });
    }

    const searchInput = document.getElementById('adminUserSearch');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            filterAdminUsers();
        });
    }

    const prevPageBtn = document.getElementById('adminPrevPage');
    if (prevPageBtn) {
        prevPageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            previousAdminPage();
        });
    }

    const nextPageBtn = document.getElementById('adminNextPage');
    if (nextPageBtn) {
        nextPageBtn.addEventListener('click', (e) => {
            e.preventDefault();
            nextAdminPage();
        });
    }

    if (sectionRoot) {
        sectionRoot.dataset.umEventsBound = 'true';
    }
}

export function initializeUserManagementSection() {
    const listContainer = document.getElementById('adminUsersList');
    if (!listContainer) {
        return;
    }

    generateAdminModals();
    initializeUserManagementEvents();
    loadAdminData();
}

export function generateAdminModals() {
    const container = document.getElementById('adminModalsContainer');
    if (!container) return;

    const userModal = `
        <div id="adminUserModal" class="um-modal-overlay" style="display: none;">
            <div class="um-modal">
                <div class="um-modal-header">
                    <h3 class="um-modal-title" id="adminUserModalTitle">Add New User</h3>
                </div>
                <div class="um-modal-body">
                    <form id="adminUserForm">
                        <input type="hidden" id="adminUserIdHidden">

                        <div class="um-form-grid">
                            <div class="um-form-group">
                                <label>User ID <span class="required">*</span></label>
                                <input type="text" id="adminUserId" required placeholder="e.g., rrathod@technosofteng.com">
                            </div>
                            <div class="um-form-group">
                                <label>Full Name <span class="required">*</span></label>
                                <input type="text" id="adminUserName" required placeholder="e.g., Rakesh Rathod">
                            </div>
                            <div class="um-form-group">
                                <label>Email Address <span class="required">*</span></label>
                                <input type="email" id="adminUserEmail" required placeholder="e.g., rrathod@technosofteng.com">
                            </div>
                            <div class="um-form-group">
                                <label>Designation <span class="required">*</span></label>
                                <input type="text" id="adminUserDesignation" required placeholder="e.g., Sr. QA Engineer">
                            </div>
                            <div class="um-form-group">
                                <label>Team <span class="required">*</span></label>
                                <input type="text" id="adminUserTeam" required placeholder="e.g., Client Accounts">
                            </div>
                            <div class="um-form-group">
                                <label>Department <span class="required">*</span></label>
                                <input type="text" id="adminUserDepartment" required placeholder="e.g., ITeS">
                            </div>
                            <div class="um-form-group">
                                <label>Location <span class="required">*</span></label>
                                <input type="text" id="adminUserLocation" required placeholder="e.g., Thane, Maharashtra">
                            </div>
                            <div class="um-form-group">
                                <label>Role <span class="required">*</span></label>
                                <select id="adminUserRole" required>
                                    <option value="">Select Role</option>
                                    <option value="admin">Admin</option>
                                    <option value="user">User</option>
                                </select>
                            </div>
                            <div class="um-form-group um-form-group-full">
                                <label>Password</label>
                                <input type="text" id="adminUserPassword" value="Technosoft" placeholder="Default: Technosoft">
                            </div>
                        </div>

                        <div class="um-modal-actions">
                            <button type="button" class="um-btn um-btn-secondary um-modal-cancel">
                                <i class="fas fa-times"></i> Cancel
                            </button>
                            <button type="submit" class="um-btn um-btn-primary">
                                <i class="fas fa-save"></i> Save User
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = userModal;

    const form = document.getElementById('adminUserForm');
    if (form) {
        form.addEventListener('submit', saveAdminUser);
    }

    const cancelBtn = document.querySelector('.um-modal-cancel');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeAdminUserModal);
    }
}

export async function loadAdminData() {
    isAdminUsersLoading = true;
    currentPage = 1;
    renderAdminUsers();

    try {
        const users = await authManager.fetchUsers();
        adminUsersLoadError = null;

        const mappedUsers = users.map((user, index) => ({
            id: index + 1,
            uuid: user.uuid,
            userId: user.userId,
            name: user.username,
            email: user.email || user.userId,
            designation: user.designation,
            role: user.role,
            team: user.team || 'Client Accounts',
            department: user.department || 'ITeS',
            location: user.location || 'Thane, Maharashtra',
            status: 'active',
            canDelete: typeof user?.permissions?.canDelete === 'boolean'
                ? user.permissions.canDelete
                : false
        }));

        adminUsers = sortAdminUsersForDisplay(mappedUsers);
    } catch (e) {
        adminUsers = [];
        if (e?.status === 401) {
            adminUsersLoadError = 'Session expired. Please log in again.';
        } else if (e?.status === 403) {
            adminUsersLoadError = 'Access denied. Admin role is required to view users.';
        } else {
            adminUsersLoadError = 'Unable to load users from backend.';
        }
    } finally {
        isAdminUsersLoading = false;
        renderAdminUsers();
    }
}

export function renderAdminUsers() {
    const listContainer = document.getElementById('adminUsersList');
    if (!listContainer) return;

    if (isAdminUsersLoading) {
        renderAdminUsersSkeleton(listContainer, {
            rows: ROWS_PER_PAGE,
            columns: 8,
            rowClass: 'um-table-row',
            cellClass: 'um-table-cell'
        });
        setAdminPaginationLoadingState(true);
        return;
    }

    setAdminPaginationLoadingState(false);
    setSkeletonBusyState(listContainer, false);

    listContainer.innerHTML = '';

    if (adminUsersLoadError) {
        listContainer.innerHTML = `<div style="text-align: center; padding: 40px; color: #b91c1c;">${adminUsersLoadError}</div>`;
        updateAdminPaginationInfo(0);
        return;
    }

    const filteredUsers = getFilteredAdminUsers();
    updateAdminPaginationInfo(filteredUsers.length);

    if (filteredUsers.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #666;">No users found</div>';
        return;
    }

    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    const pageUsers = filteredUsers.slice(startIndex, startIndex + ROWS_PER_PAGE);

    pageUsers.forEach((user) => {
        const row = document.createElement('div');
        row.className = 'um-table-row';

        row.innerHTML = `
            <div class="um-table-cell">${user.userId || ''}</div>
            <div class="um-table-cell"><div style="font-weight: 500;">${user.name}</div></div>
            <div class="um-table-cell">${user.designation || ''}</div>
            <div class="um-table-cell">${user.team || ''}</div>
            <div class="um-table-cell">${user.location || ''}</div>
            <div class="um-table-cell">
                <span class="um-badge ${user.role === 'admin' ? 'um-badge-warning' : 'um-badge-info'}"
                      style="padding: 4px 8px; border-radius: 4px; font-size: 11px; background-color: ${user.role === 'admin' ? '#fef3c7' : '#dbeafe'}; color: ${user.role === 'admin' ? '#92400e' : '#1e40af'};">
                    ${user.role}
                </span>
            </div>
            <div class="um-table-cell">
                <span style="color: green; font-weight: 500;">${user.status}</span>
            </div>
            <div class="um-table-cell">
                <div class="um-action-buttons" style="display: flex; gap: 6px;">
                    <button class="um-action-btn edit-btn" data-user-uuid="${user.uuid || ''}" title="Edit User">
                        <i class="fas fa-edit"></i>
                    </button>
                    ${user.canDelete ? `
                    <button class="um-action-btn delete-btn" data-user-uuid="${user.uuid || ''}" title="Delete User">
                        <i class="fas fa-trash"></i>
                    </button>` : ''}
                </div>
            </div>
        `;

        listContainer.appendChild(row);
    });

    if (!listContainer.dataset.actionsBound) {
        listContainer.addEventListener('click', (e) => {
            const editBtn = e.target.closest('.edit-btn');
            const deleteBtn = e.target.closest('.delete-btn');

            if (editBtn) {
                const userUuid = editBtn.dataset.userUuid;
                openAdminUserModal(userUuid);
            } else if (deleteBtn) {
                const userUuid = deleteBtn.dataset.userUuid;
                deleteAdminUser(userUuid);
            }
        });
        listContainer.dataset.actionsBound = 'true';
    }
}

export function openAdminUserModal(editUuid = null) {
    currentEditId = editUuid;
    currentEditType = 'user';

    const modal = document.getElementById('adminUserModal');
    if (!modal) return;

    const form = document.getElementById('adminUserForm');
    const title = document.getElementById('adminUserModalTitle');

    if (editUuid) {
        const user = adminUsers.find((u) => u.uuid === editUuid);
        if (!user) return;
        if (title) title.textContent = 'Edit User';
        document.getElementById('adminUserId').value = user.userId;
        document.getElementById('adminUserName').value = user.name;
        document.getElementById('adminUserEmail').value = user.email;
        document.getElementById('adminUserDesignation').value = user.designation;
        document.getElementById('adminUserTeam').value = user.team || 'Client Accounts';
        document.getElementById('adminUserDepartment').value = user.department || 'ITeS';
        document.getElementById('adminUserLocation').value = user.location || 'Thane, Maharashtra';
        document.getElementById('adminUserRole').value = user.role;
        document.getElementById('adminUserPassword').value = '';
    } else {
        if (title) title.textContent = 'Add New User';
        if (form) form.reset();
        document.getElementById('adminUserTeam').value = 'Client Accounts';
        document.getElementById('adminUserDepartment').value = 'ITeS';
        document.getElementById('adminUserLocation').value = 'Thane, Maharashtra';
    }

    modal.style.display = 'flex';
}

export function closeAdminUserModal() {
    const modal = document.getElementById('adminUserModal');
    if (modal) modal.style.display = 'none';

    const form = document.getElementById('adminUserForm');
    if (form) form.reset();

    currentEditId = null;
    currentEditType = null;
}

export async function saveAdminUser(event) {
    if (event) event.preventDefault();

    const passwordInput = document.getElementById('adminUserPassword').value;
    const userData = {
        userId: document.getElementById('adminUserId').value,
        username: document.getElementById('adminUserName').value,
        email: document.getElementById('adminUserEmail').value,
        designation: document.getElementById('adminUserDesignation').value,
        team: document.getElementById('adminUserTeam').value,
        department: document.getElementById('adminUserDepartment').value,
        location: document.getElementById('adminUserLocation').value,
        role: document.getElementById('adminUserRole').value,
        password: passwordInput
    };

    if (!currentEditId && !userData.password) {
        alert('Password is required when creating a new user.');
        return;
    }

    if (currentEditId && !userData.password) {
        delete userData.password;
    }

    const submitBtn = document.querySelector('#adminUserForm button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
        await authManager.ensureCsrfCookie();
        const requestInit = {
            credentials: 'include',
            headers: authManager.buildJsonHeaders(),
        };

        if (currentEditId) {
            const response = await fetch(`/api/users/${encodeURIComponent(currentEditId)}`, {
                ...requestInit,
                method: 'PUT',
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                throw await authManager.parseApiError(response, `Failed to update user (${response.status})`);
            }
        } else {
            const response = await fetch('/api/users', {
                ...requestInit,
                method: 'POST',
                body: JSON.stringify(userData),
            });

            if (!response.ok) {
                throw await authManager.parseApiError(response, `Failed to create user (${response.status})`);
            }
        }

        await loadAdminData();
        closeAdminUserModal();
    } catch (error) {
        alert(error?.message || 'Unable to save user. Please check all fields and try again.');
    } finally {
        if (submitBtn) submitBtn.disabled = false;
    }
}

export async function deleteAdminUser(uuid) {
    if (!uuid) return;

    if (confirm('Are you sure you want to delete this user?')) {
        try {
            await authManager.ensureCsrfCookie();
            const response = await fetch(`/api/users/${encodeURIComponent(uuid)}`, {
                method: 'DELETE',
                credentials: 'include',
                headers: authManager.buildJsonHeaders(),
            });

            if (!response.ok) {
                throw await authManager.parseApiError(response, `Failed to delete user (${response.status})`);
            }

            await loadAdminData();
        } catch (error) {
            alert(error?.message || 'Unable to delete user.');
        }
    }
}

export function filterAdminUsers() {
    currentPage = 1;
    renderAdminUsers();
}
