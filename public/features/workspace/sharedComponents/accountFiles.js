import { accountFilesState, ACCOUNT_DATA_KEY } from '../state/accountFilesState.js';
import { workspaceAccountsState } from '../state/workspaceAccountsState.js';
import { workspaceState } from '../state/workspaceState.js';
import { authManager } from '../../../core/auth/AuthManager.js';
import { fetchDashboardMetadata, getCachedDashboardMetadata } from '../../dashboard/api/dashboardApi.js';
import { renderImportedHeadings, renderSupportedHeadings } from '../editor/production.js';
import { HistoryManager } from '../modals/changeLogModal.js';
import {
    listFiles,
    uploadFiles as uploadAccountFilesApi,
    deleteFile as deleteAccountFileApi,
    listNotes,
    createNote as createAccountNoteApi,
    deleteNote as deleteAccountNoteApi,
    listComments,
    createComment as createAccountCommentApi,
    updateComment as updateAccountCommentApi,
    deleteComment as deleteAccountCommentApi
} from '../api/accountDataApi.js';

const DEFAULT_NOTE_SUBJECTS = [
    '3rd Party catalog sites',
    'Additional Instructions / Notes',
    'Address Mismatch',
    'Brands',
    'Business Activities',
    'Capabilities',
    'Primary/Secondary Services',
    'Classification',
    'General Account Queries / Issues',
    'Links / URLs',
    'PDM',
    'Domain Change',
    'Primary Company Type',
    'Paid Heading',
    'SDMS Notes',
    'Clients Instructions',
    'Other Info',
];

const DEFAULT_ACCOUNT_FILE_TYPES = [
    { value: 'excel', label: 'Excel', extensions: ['xlsx', 'xls', 'csv'] },
    { value: 'pdf', label: 'PDF', extensions: ['pdf'] },
    { value: 'image', label: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'] },
    { value: 'video', label: 'Videos', extensions: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm'] },
];

function getAccountDataDefaults() {
    return {
        files: [],
        notes: [],
        comments: []
    };
}

function getCurrentAccountCode() {
    return accountFilesState.currentAccountId || workspaceAccountsState.selectedAccountId || '';
}

function getAccountFilesMetadata() {
    const cached = getCachedDashboardMetadata();
    const noteSubjects = Array.isArray(cached.noteSubjects) && cached.noteSubjects.length > 0
        ? cached.noteSubjects
        : DEFAULT_NOTE_SUBJECTS;
    const accountFileTypes = Array.isArray(cached.accountFileTypes) && cached.accountFileTypes.length > 0
        ? cached.accountFileTypes
        : DEFAULT_ACCOUNT_FILE_TYPES;

    return { noteSubjects, accountFileTypes };
}

function renderFileTypeFilters() {
    const { accountFileTypes } = getAccountFilesMetadata();
    const selectIds = ['accountFilesTypeFilter', 'qc-accountFilesTypeFilter', 'pageAccountFilesTypeFilter'];

    selectIds.forEach((id) => {
        const select = document.getElementById(id);
        if (!select) return;

        const previous = select.value || 'all';
        const options = ['<option value="all">All Types</option>'];
        accountFileTypes.forEach((type) => {
            options.push(`<option value="${type.value}">${type.label}</option>`);
        });
        select.innerHTML = options.join('');

        const allowedValues = ['all', ...accountFileTypes.map((type) => type.value)];
        select.value = allowedValues.includes(previous) ? previous : 'all';
    });
}

async function ensureAccountFilesMetadata() {
    try {
        await fetchDashboardMetadata();
    } catch (error) {
    }

    const { noteSubjects, accountFileTypes } = getAccountFilesMetadata();
    accountFilesState.noteSubjects = [...noteSubjects];
    accountFilesState.accountFileTypes = [...accountFileTypes];
    renderFileTypeFilters();
}

// Get Account Data from Storage
export function getAllAccountsData() {
    return JSON.parse(localStorage.getItem(ACCOUNT_DATA_KEY)) || {};
}

// Save Account Data to Storage
export function saveAllAccountsData(data) {
    localStorage.setItem(ACCOUNT_DATA_KEY, JSON.stringify(data));
}

// Load Data for Specific Account
export async function loadAccountData(accountId) {
    if (!accountId) {
        accountFilesState.currentAccountId = null;
        accountFilesState.currentAccountData = getAccountDataDefaults();
        accountFilesState.loading = false;
        accountFilesState.error = null;
        renderAccountFiles();
        renderNamedNotes();
        renderComments();
        return;
    }

    accountFilesState.currentAccountId = accountId;
    accountFilesState.loading = true;
    accountFilesState.error = null;
    accountFilesState.currentAccountData = getAccountDataDefaults();
    const requestId = ++accountFilesState.activeRequestId;

    renderAccountFiles();
    renderNamedNotes();
    renderComments();

    try {
        const [files, notes, comments] = await Promise.all([
            listFiles(accountId),
            listNotes(accountId),
            listComments(accountId),
        ]);

        if (requestId !== accountFilesState.activeRequestId || accountFilesState.currentAccountId !== accountId) {
            return;
        }

        accountFilesState.currentAccountData = {
            files: Array.isArray(files) ? files : [],
            notes: Array.isArray(notes) ? notes : [],
            comments: Array.isArray(comments) ? comments : [],
        };
    } catch (error) {
        if (requestId !== accountFilesState.activeRequestId || accountFilesState.currentAccountId !== accountId) {
            return;
        }

        accountFilesState.error = error;
        accountFilesState.currentAccountData = getAccountDataDefaults();
        alert(error?.message || 'Failed to load account files data.');
    } finally {
        if (requestId !== accountFilesState.activeRequestId || accountFilesState.currentAccountId !== accountId) {
            return;
        }

        accountFilesState.loading = false;
        renderAccountFiles();
        renderNamedNotes();
        renderComments();
    }
}

// Get Current User
export function getCurrentUserForFiles() {
    const currentUser = authManager.getUser();
    return currentUser ? currentUser.username : 'Unknown User';
}

// Initialize Account Files Section
export function initializeAccountFiles() {
    ensureAccountFilesMetadata();

    // Only setup listeners if not already set up
    // Check if we need to load data from workspace state
    if (!accountFilesState.currentAccountId && workspaceAccountsState.selectedAccountId) {
        loadAccountData(workspaceAccountsState.selectedAccountId);
    }

    // Initialize listeners only once
    if (!accountFilesState.initialized) {
        setupAccountFilesEventListeners();
        setupNamedNotesEventListeners();
        setupCommentsEventListeners();
        accountFilesState.initialized = true;
    }

    renderAccountFiles();
    renderNamedNotes();
    renderComments();
}

// Setup Event Listeners for Files
export function setupAccountFilesEventListeners() {
    const pairs = [
        // Editor Mode
        { btnId: 'accountFilesUploadBtn', inputId: 'accountFilesInput', searchId: 'accountFilesSearch', filterId: 'accountFilesTypeFilter', clearId: 'clearAccountFilesSearchBtn' },
        // QC Mode
        { btnId: 'qc-accountFilesUploadBtn', inputId: 'qc-accountFilesInput', searchId: 'qc-accountFilesSearch', filterId: 'qc-accountFilesTypeFilter', clearId: 'qc-clearAccountFilesSearchBtn' },
        // Dashboard Page
        { btnId: 'pageAccountFilesUploadBtn', inputId: 'pageAccountFilesInput', searchId: 'pageAccountFilesSearch', filterId: 'pageAccountFilesTypeFilter', clearId: 'pageClearAccountFilesSearchBtn' }
    ];

    pairs.forEach(pair => {
        // Single upload button
        const uploadBtn = document.getElementById(pair.btnId);
        const fileInput = document.getElementById(pair.inputId);

        if (uploadBtn && fileInput) {
            // Remove existing listeners to prevent duplicates (cloning)
            uploadBtn.replaceWith(uploadBtn.cloneNode(true));
            const newUploadBtn = document.getElementById(pair.btnId);

            fileInput.replaceWith(fileInput.cloneNode(true));
            const newFileInput = document.getElementById(pair.inputId);

            newUploadBtn.addEventListener('click', () => newFileInput.click());
            newFileInput.addEventListener('change', handleAccountFilesUpload);
        }
    });

    // Account Files Filter Dialog Logic, Search, and Filter listeners are now handled in filters.js via setupAccountFilesFilterLogic()
    if (typeof setupAccountFilesFilterLogic === 'function') {
        setupAccountFilesFilterLogic();
    }
}

// Toggle Account Files Filter Dialog


// Setup Named Notes Event Listeners
export function setupNamedNotesEventListeners() {
    const btnIds = ['addNamedNoteBtn', 'qc-addNamedNoteBtn', 'pageAddNamedNoteBtn'];

    btnIds.forEach(id => {
        const addNoteBtn = document.getElementById(id);
        if (addNoteBtn) {
            addNoteBtn.removeEventListener('click', openAddNoteModal);
            addNoteBtn.addEventListener('click', openAddNoteModal);
        }
    });
}

// Setup Comments Event Listeners
export function setupCommentsEventListeners() {
    const pairs = [
        { inputId: 'accountCommentsInput', btnId: 'accountCommentsSendBtn' },
        { inputId: 'qc-accountCommentsInput', btnId: 'qc-accountCommentsSendBtn' },
        { inputId: 'pageAccountCommentsInput', btnId: 'pageAccountCommentsSendBtn' }
    ];

    pairs.forEach(pair => {
        const input = document.getElementById(pair.inputId);
        const btn = document.getElementById(pair.btnId);

        if (input) {
            // Sync typing
            input.removeEventListener('input', handleCommentInputSync);
            input.addEventListener('input', (e) => handleCommentInputSync(e, pair.inputId));

            // Auto-resize
            input.style.overflow = 'hidden';
            input.addEventListener('input', function () {
                this.style.height = 'auto';
                const newHeight = Math.min(Math.max(this.scrollHeight, 36), 120);
                this.style.height = newHeight + 'px';
                this.style.overflowY = this.scrollHeight > 120 ? 'auto' : 'hidden';
            });

            // Enter key
            input.removeEventListener('keydown', handleCommentKeyPress);
            input.addEventListener('keydown', handleCommentKeyPress);
        }

        if (btn) {
            btn.removeEventListener('click', handleSendCommentFromInput);
            btn.addEventListener('click', () => handleSendCommentFromInput(pair.inputId));
        }
    });
}

// Handle Comment Input Sync
export function handleCommentInputSync(e, sourceId) {
    const val = e.target.value;
    // Sync all comment inputs
    ['accountCommentsInput', 'qc-accountCommentsInput', 'pageAccountCommentsInput'].forEach(id => {
        if (id !== sourceId) {
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
                el.style.height = e.target.style.height;
            }
        }
    });
}

// Handle Comment Key Press (Enter to send, Shift+Enter for new line)
export function handleCommentKeyPress(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendCommentFromInput(e.target.id);
    }
}

// Handle Send Comment
export async function handleSendCommentFromInput(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    const created = await addComment(text);
    if (!created) return;

    // Clear and reset inputs
    ['accountCommentsInput', 'qc-accountCommentsInput', 'pageAccountCommentsInput'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            el.style.height = '36px'; // Reset height
            el.focus();
        }
    });
}

// Add Comment Logic
export async function addComment(text) {
    if (!accountFilesState.currentAccountId) {
        alert("No account selected!");
        return false;
    }

    const accountCode = getCurrentAccountCode();

    try {
        const payload = await createAccountCommentApi(accountCode, { text });
        if (payload?.comment) {
            accountFilesState.currentAccountData.comments.push(payload.comment);
            renderComments();
            return true;
        }
    } catch (error) {
        alert(error?.message || 'Failed to post update.');
    }

    return false;
}

// Delete Comment
export async function deleteComment(commentId) {
    if (!accountFilesState.currentAccountId) return;

    const comment = accountFilesState.currentAccountData.comments.find(c => c.id === commentId);
    if (!comment) return;

    if (!comment.canDelete) {
        alert("You do not have permission to delete this update.");
        return;
    }

    if (!confirm('Are you sure you want to delete this message?')) return;

    const accountCode = getCurrentAccountCode();

    try {
        await deleteAccountCommentApi(accountCode, commentId);
        accountFilesState.currentAccountData.comments = accountFilesState.currentAccountData.comments.filter(c => c.id !== commentId);
        renderComments();
    } catch (error) {
        alert(error?.message || 'Failed to delete update.');
    }
}

// Get Initials
// Render Comments
export function renderComments() {
    const containers = document.querySelectorAll('.comments-list');
    if (containers.length === 0) return;

    const currentUser = getCurrentUserForFiles();

    if (!accountFilesState.currentAccountData.comments || accountFilesState.currentAccountData.comments.length === 0) {
        containers.forEach(container => {
            container.innerHTML = `
                <div class="empty-placeholder">
                    <i class="fas fa-pen-to-square"></i>
                    <p>No updates yet. Log an update to start.</p>
                </div>
            `;
        });
        return;
    }

    // Sort by Date Descending (Newest First)
    const sortedComments = [...accountFilesState.currentAccountData.comments].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    let html = '';
    let lastDate = null;

    const getHumanDate = (d) => {
        const date = new Date(d);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === now.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    };

    sortedComments.forEach(comment => {
        const currentDate = getHumanDate(comment.timestamp);

        // Insert Date Header if date changes
        if (currentDate !== lastDate) {
            html += `
                <div class="comment-date-separator">
                    <span>${currentDate}</span>
                </div>
            `;
            lastDate = currentDate;
        }

        const isSelf = comment.user === currentUser;
        const canEdit = !!comment.canEdit;
        const canDelete = !!comment.canDelete;
        const canOpenMenu = canEdit || canDelete;
        const timeStr = formatTimeShort(comment.timestamp);
        const safeId = comment.id;

        html += `
            <div class="update-card" data-id="${safeId}">
                <div class="update-header">
                    <div class="update-user-info">
                        <span class="update-user-name">${escapeHtml(comment.user)} ${isSelf ? '(You)' : ''}</span>
                    </div>
                    
                    <div class="update-header-right">
                        <span class="update-time">${timeStr}</span>
                        ${canOpenMenu ? `
                        <div class="update-menu-container">
                            <button type="button" class="update-menu-btn" title="Options">
                                <i class="fas fa-ellipsis-v"></i>
                            </button>
                            <div class="update-dropdown">
                                ${canEdit ? `
                                <button type="button" class="update-dropdown-item" data-action="edit" data-comment-id="${safeId}">
                                    Edit Update
                                </button>
                                ` : ''}
                                ${canDelete ? `
                                <button type="button" class="update-dropdown-item delete" data-action="delete" data-comment-id="${safeId}">
                                    Delete Update
                                </button>
                                ` : ''}
                            </div>
                        </div>
                        ` : ''}
                    </div>
                </div>
                
                <div class="update-body">${escapeHtml(comment.text)}</div>
            </div>
        `;
    });

    containers.forEach(container => {
        container.innerHTML = html;
        container.scrollTop = 0; // Scroll to top

        container.querySelectorAll('.update-menu-btn').forEach(button => {
            button.addEventListener('click', toggleUpdateMenu);
        });

        container.querySelectorAll('.update-dropdown-item[data-action][data-comment-id]').forEach(button => {
            button.addEventListener('click', (event) => {
                event.stopPropagation();
                const action = button.getAttribute('data-action');
                const commentId = button.getAttribute('data-comment-id');
                if (!commentId) return;
                if (action === 'edit') {
                    enableEditMode(event, commentId);
                } else if (action === 'delete') {
                    deleteComment(commentId);
                }
            });
        });
    });

    // Add click listener to close menus if not already added
    if (!window.hasUpdateMenuListener) {
        window.addEventListener('click', closeAllUpdateMenus);
        window.hasUpdateMenuListener = true;
    }
}

// Toggle Update Menu
export function toggleUpdateMenu(event) {
    event.stopPropagation(); // Prevent immediate closing
    const btn = event.currentTarget;
    const container = btn.parentElement;
    const menu = container.querySelector('.update-dropdown');

    // Close other open menus
    document.querySelectorAll('.update-dropdown.visible').forEach(el => {
        if (el !== menu) {
            el.classList.remove('visible');
            const otherBtn = el.parentElement.querySelector('.update-menu-btn');
            if (otherBtn) otherBtn.classList.remove('active');
        }
    });

    if (menu) {
        const isVisible = menu.classList.contains('visible');
        if (isVisible) {
            menu.classList.remove('visible');
            btn.classList.remove('active');
        } else {
            menu.classList.add('visible');
            btn.classList.add('active');
        }
    }
}

// Close All Menus
export function closeAllUpdateMenus(event) {
    if (event.target.closest('.update-menu-btn')) return; // handled by toggle

    document.querySelectorAll('.update-dropdown.visible').forEach(el => {
        el.classList.remove('visible');
        const btn = el.parentElement.querySelector('.update-menu-btn');
        if (btn) btn.classList.remove('active');
    });
}

// Enable Edit Mode
export function enableEditMode(event, id) {
    // Find card relative to clicked button
    const btn = event.currentTarget;
    const card = btn.closest('.update-card');
    if (!card) return;

    const bodyContainer = card.querySelector('.update-body');
    if (!bodyContainer) return;

    // Find comment text from data model
    const comment = accountFilesState.currentAccountData.comments.find(c => c.id === id);
    if (!comment) return;

    // Close menu first
    closeAllUpdateMenus({ target: document.body });

    bodyContainer.innerHTML = `
        <div class="update-body-edit">
            <textarea class="update-edit-textarea">${escapeHtml(comment.text)}</textarea>
            <div class="update-edit-actions">
                <button type="button" class="update-edit-btn update-btn-cancel" data-comment-id="${id}">Cancel</button>
                <button type="button" class="update-edit-btn update-btn-save" data-comment-id="${id}">Save</button>
            </div>
        </div>
    `;

    const cancelBtn = bodyContainer.querySelector('.update-btn-cancel[data-comment-id]');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', (e) => {
            const commentId = cancelBtn.getAttribute('data-comment-id');
            if (commentId) cancelEditMode(e, commentId);
        });
    }

    const saveBtn = bodyContainer.querySelector('.update-btn-save[data-comment-id]');
    if (saveBtn) {
        saveBtn.addEventListener('click', (e) => {
            const commentId = saveBtn.getAttribute('data-comment-id');
            if (commentId) saveUpdateEdit(e, commentId);
        });
    }

    // Focus textarea
    setTimeout(() => {
        const textarea = bodyContainer.querySelector('.update-edit-textarea');
        if (textarea) {
            textarea.focus();
            textarea.setSelectionRange(textarea.value.length, textarea.value.length);
        }
    }, 50);
}

// Cancel Edit Mode
export function cancelEditMode(event, id) {
    const comment = accountFilesState.currentAccountData.comments.find(c => c.id === id);
    if (!comment) return;

    const btn = event.currentTarget;
    const card = btn.closest('.update-card');
    const bodyContainer = card ? card.querySelector('.update-body') : null;

    if (bodyContainer) {
        bodyContainer.innerHTML = escapeHtml(comment.text);
    }
}

// Save Update Edit
export async function saveUpdateEdit(event, id) {
    const btn = event.currentTarget;
    const container = btn.closest('.update-body-edit');
    const input = container ? container.querySelector('.update-edit-textarea') : null;

    if (!input) return;

    const newText = input.value.trim();
    if (!newText) {
        alert("Update cannot be empty.");
        return;
    }

    const commentIndex = accountFilesState.currentAccountData.comments.findIndex(c => c.id === id);
    if (commentIndex === -1) return;
    const comment = accountFilesState.currentAccountData.comments[commentIndex];
    if (!comment?.canEdit) {
        alert('You do not have permission to edit this update.');
        return;
    }

    const accountCode = getCurrentAccountCode();
    try {
        const payload = await updateAccountCommentApi(accountCode, id, { text: newText });
        if (payload?.comment) {
            accountFilesState.currentAccountData.comments[commentIndex] = payload.comment;
            renderComments();
        }
    } catch (error) {
        alert(error?.message || 'Failed to update comment.');
    }
}

// Format Time Short (HH:MM)
export function formatTimeShort(isoString) {
    const date = new Date(isoString);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}


// UI: Upload Button Loading State
export function setUploadButtonLoading(isLoading) {
    const btnIds = ['accountFilesUploadBtn', 'qc-accountFilesUploadBtn', 'pageAccountFilesUploadBtn'];

    btnIds.forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;

        if (isLoading) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
            btn.classList.add('uploading');
        } else {
            btn.disabled = false;
            // Removed 'Upload Files' text to keep only icon on small button, or check CSS
            // But aligned with new CSS:
            btn.innerHTML = '<i class="fas fa-upload"></i> Upload';
            btn.classList.remove('uploading');
        }
    });
}

// Handle Account Files Upload
export async function handleAccountFilesUpload(e) {
    if (!accountFilesState.currentAccountId) {
        alert("No account selected! Please select an account first.");
        e.target.value = '';
        return;
    }

    const files = e.target.files;
    if (!files || files.length === 0) {
        return;
    }

    setUploadButtonLoading(true);

    await processAccountFiles(Array.from(files));
    e.target.value = '';
}

// Process Account Files
export async function processAccountFiles(files) {
    const accountCode = getCurrentAccountCode();
    const beforeproofFile = files.find((file) => {
        const extension = file.name.split('.').pop().toLowerCase();
        return file.name.toLowerCase().includes('beforeproof') && ['xlsx', 'xls', 'csv'].includes(extension);
    });

    try {
        const payload = await uploadAccountFilesApi(accountCode, files);
        const uploadedFiles = Array.isArray(payload?.files) ? payload.files : [];

        if (uploadedFiles.length > 0) {
            accountFilesState.currentAccountData.files = [
                ...uploadedFiles,
                ...accountFilesState.currentAccountData.files,
            ];
            renderAccountFiles();
        }

        if (beforeproofFile) {
            processBeforeproofFile(beforeproofFile);
        }

        if (uploadedFiles.length > 0 && typeof HistoryManager !== 'undefined') {
            const user = getCurrentUserForFiles();
            const details = uploadedFiles.length === 1 ? `Uploaded 1 file: ${uploadedFiles[0].name}` : `Uploaded ${uploadedFiles.length} files`;
            HistoryManager.addEntry('File Upload', details, user, accountFilesState.currentAccountId);
        }

        if (payload?.message) {
            alert(payload.message);
        }
    } catch (error) {
        alert(error?.message || 'Failed to upload files.');
    } finally {
        setUploadButtonLoading(false);
    }
}

// Process Beforeproof File (Existing Headings)
export function processBeforeproofFile(file) {
    const reader = new FileReader();

    reader.onload = function (event) {
        try {
            const data = new Uint8Array(event.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) {
                return;
            }

            processExistingHeadingsData(jsonData);

        } catch (error) {
            alert('Error reading beforeproof file. Please ensure it is a valid Excel file with proper format.');
        }
    };

    reader.onerror = function () {
        alert('Error reading beforeproof file. Please try again.');
    };

    reader.readAsArrayBuffer(file);
}

// Process Existing Headings Data
export function processExistingHeadingsData(data) {
    if (data.length < 2) return; // Need header + at least one row

    const headers = data[0].map(h => String(h).trim().toLowerCase());

    // Find column indices for all columns
    const idIndex = headers.indexOf('classification id');
    const nameIndex = headers.indexOf('classification');
    const rankIndex = headers.indexOf('rank points');
    const definitionIndex = headers.indexOf('definition');
    const categoryIndex = headers.indexOf('category');
    const familyIndex = headers.indexOf('family');
    const companyTypeIndex = headers.indexOf('company type');
    const profileDescIndex = headers.indexOf('profile description');
    const siteLinkIndex = headers.indexOf('site link');
    const qualityIndex = headers.indexOf('quality');
    const lastUpdatedIndex = headers.indexOf('last updated');

    if (idIndex === -1 || nameIndex === -1) {
        alert('Error: Before Proof file must contain "Classification" and "Classification ID" columns.');
        return;
    }

    const rows = data.slice(1);
    if (rows.length === 0) {
        return;
    }

    const existingHeadings = [];
    rows.forEach(row => {
        // Ensure row has enough columns based on max index we need
        // Actually safe to access undefined, just need to check values

        const id = row[idIndex] ? String(row[idIndex]).trim() : '';
        const name = row[nameIndex] ? String(row[nameIndex]).trim() : '';

        if (!id || !name) return;

        const heading = {
            id,
            name,
            rankPoints: (rankIndex !== -1 && row[rankIndex] !== undefined) ? row[rankIndex] : null,
            definition: (definitionIndex !== -1 && row[definitionIndex]) ? String(row[definitionIndex]).trim() : '',
            category: (categoryIndex !== -1 && row[categoryIndex]) ? String(row[categoryIndex]).trim() : '',
            family: (familyIndex !== -1 && row[familyIndex]) ? String(row[familyIndex]).trim() : '',
            companyType: (companyTypeIndex !== -1 && row[companyTypeIndex]) ? String(row[companyTypeIndex]).trim() : '',
            profileDescription: (profileDescIndex !== -1 && row[profileDescIndex]) ? String(row[profileDescIndex]).trim() : '',
            siteLink: (siteLinkIndex !== -1 && row[siteLinkIndex]) ? String(row[siteLinkIndex]).trim() : '',
            quality: (qualityIndex !== -1 && row[qualityIndex]) ? String(row[qualityIndex]).trim() : '',
            lastUpdated: (lastUpdatedIndex !== -1 && row[lastUpdatedIndex]) ? String(row[lastUpdatedIndex]).trim() : ''
        };

        existingHeadings.push(heading);
    });

    if (existingHeadings.length === 0) {
        return;
    }

    if (typeof workspaceState !== 'undefined') {
        workspaceState.existingHeadings = existingHeadings;
        if (typeof updateHeadingsStatus === 'function') updateHeadingsStatus();
        if (typeof renderImportedHeadings === 'function') renderImportedHeadings();
        if (typeof renderSupportedHeadings === 'function') renderSupportedHeadings();
        if (typeof updatePDMBuilder === 'function') updatePDMBuilder();
    }

    alert(`Successfully processed beforeproof file with ${existingHeadings.length} existing headings!`);
}

// Get File Type
export function getFileType(filename) {
    const extension = filename.split('.').pop().toLowerCase();
    const types = {
        excel: ['xlsx', 'xls', 'csv'],
        pdf: ['pdf'],
        image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
        video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm']
    };
    for (const [type, extensions] of Object.entries(types)) {
        if (extensions.includes(extension)) return type;
    }
    return 'other';
}

// Get File Icon
export function getFileIcon(type) {
    const icons = {
        excel: 'fa-file-excel',
        pdf: 'fa-file-pdf',
        image: 'fa-file-image',
        video: 'fa-file-video',
        other: 'fa-file'
    };
    return icons[type] || icons.other;
}

// Format File Size
export function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Format Timestamp - Using consistent format with other sections
export function formatTimestampForFiles(isoString, username, action = 'Created') {
    const date = new Date(isoString);

    const day = String(date.getDate()).padStart(2, '0');
    const month = date.toLocaleString('en-US', { month: 'short' });
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');

    // Format: "Created by [username] at [time], [date]"
    return `${action} by ${username || 'Unknown'} at ${hours}:${mins}, ${day} ${month} ${year}`;
}

// Handle Files Search


// Apply Filters
export function applyFilters() {
    let filtered = [...accountFilesState.currentAccountData.files];

    const searchInput = document.getElementById('accountFilesSearch') || document.getElementById('pageAccountFilesSearch');
    const typeInput = document.getElementById('accountFilesTypeFilter') || document.getElementById('pageAccountFilesTypeFilter');

    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : '';
    const selectedType = typeInput ? typeInput.value : 'all';

    if (selectedType !== 'all') {
        filtered = filtered.filter(file => file.type === selectedType);
    }

    if (searchQuery) {
        filtered = filtered.filter(file =>
            file.name.toLowerCase().includes(searchQuery)
        );
    }


    return filtered;
}

// Render Account Files
export function renderAccountFiles() {
    const filteredFiles = applyFilters();
    updateFilesCount(accountFilesState.currentAccountData.files.length); // Total count
    renderFilesList(filteredFiles);
}

// Update Files Count
export function updateFilesCount(count) {
    // Select all file counts
    const countElements = document.querySelectorAll('.files-count, #pageFilesCount'); // Added #pageFilesCount Selector just in case class is missing
    const text = `${count} file${count !== 1 ? 's' : ''}`;

    countElements.forEach(el => {
        el.textContent = text;
    });
}

// Render Files List (Updated for new column layout)
export function renderFilesList(filteredFiles) {
    // Select all file grids
    const filesGrids = document.querySelectorAll('.files-grid, #pageFilesGrid'); // Include Dashboard Grid
    if (filesGrids.length === 0) return;

    // Remove duplicates if selector matches same element twice
    const uniqueGrids = [...new Set(filesGrids)];

    const html = filteredFiles.length === 0 ? `
            <div class="empty-placeholder">
                <i class="fas fa-folder"></i>
                <p>
                    ${accountFilesState.currentAccountData.files.length === 0
            ? 'No files uploaded yet'
            : 'No files match search'}
                </p>
            </div>
        ` : filteredFiles.map(file => `
        <div class="file-item-card" data-file-id="${file.id}">
            <div class="file-item-icon ${file.type}">
                <i class="fas ${getFileIcon(file.type)}"></i>
            </div>
            <div class="file-item-details">
                <div class="file-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                <div class="file-item-meta">
                    ${formatFileSize(file.size)} • ${formatTimestampForFiles(file.uploadedAt, file.uploadedBy, 'Uploaded')}
                </div>
            </div>
            <div class="file-item-actions">
                ${!['image', 'video', 'pdf'].includes(file.type) ? `
                    <button class="icon-action-btn file-download-btn" type="button" data-file-id="${file.id}" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                ` : ''}
                <button class="icon-action-btn delete file-delete-btn" type="button" data-file-id="${file.id}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    uniqueGrids.forEach(grid => {
        grid.innerHTML = html;

        grid.querySelectorAll('.file-item-card[data-file-id]').forEach(card => {
            card.addEventListener('click', () => {
                const fileId = card.getAttribute('data-file-id');
                if (fileId) {
                    previewFile(fileId);
                }
            });
        });

        grid.querySelectorAll('.file-download-btn[data-file-id]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const fileId = button.getAttribute('data-file-id');
                if (fileId) {
                    downloadFile(fileId);
                }
            });
        });

        grid.querySelectorAll('.file-delete-btn[data-file-id]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const fileId = button.getAttribute('data-file-id');
                if (fileId) {
                    deleteFile(fileId);
                }
            });
        });
    });
}

// Escape HTML to prevent XSS
export function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Preview File
export function previewFile(fileId) {
    const fileData = accountFilesState.currentAccountData.files.find(f => f.id === fileId);
    if (!fileData) return;

    if (!['image', 'video', 'pdf'].includes(fileData.type)) {
        downloadFile(fileId);
        return;
    }

    const overlay = document.createElement('div');
    overlay.className = 'file-preview-overlay';
    overlay.id = 'filePreviewOverlay';

    const modal = document.createElement('div');
    modal.className = 'file-preview-modal';

    let previewContent = '';
    if (fileData.type === 'image') {
        previewContent = `<img src="${fileData.previewUrl}" alt="${escapeHtml(fileData.name)}" class="file-preview-image">`;
    } else if (fileData.type === 'video') {
        previewContent = `<video controls class="file-preview-video"><source src="${fileData.previewUrl}" type="${escapeHtml(fileData.mimeType || 'video/mp4')}"></video>`;
    } else if (fileData.type === 'pdf') {
        previewContent = `<iframe src="${fileData.previewUrl}" style="width: 100%; height: 600px; border: none;"></iframe>`;
    }

    modal.innerHTML = `
        <div class="file-preview-header">
            <h3 class="file-preview-title">${escapeHtml(fileData.name)}</h3>
            <button type="button" class="file-preview-close" id="filePreviewCloseBtn">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
        <div class="file-preview-content">
            ${previewContent}
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = modal.querySelector('#filePreviewCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeFilePreview);
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFilePreview();
    });
}

// Close File Preview
export function closeFilePreview() {
    const overlay = document.getElementById('filePreviewOverlay');
    if (overlay) overlay.remove();
}

// Download File
export function downloadFile(fileId) {
    const fileData = accountFilesState.currentAccountData.files.find(f => f.id === fileId);
    if (!fileData) return;
    const a = document.createElement('a');
    a.href = fileData.downloadUrl;
    a.download = fileData.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

// Delete File
export async function deleteFile(fileId) {
    const fileData = accountFilesState.currentAccountData.files.find(f => f.id === fileId);
    if (!fileData) return;

    if (!fileData.canDelete) {
        alert('You do not have permission to delete this file.');
        return;
    }

    const confirmDelete = confirm(`Are you sure you want to delete "${fileData.name}"?`);
    if (!confirmDelete) return;

    try {
        await deleteAccountFileApi(getCurrentAccountCode(), fileId);
        accountFilesState.currentAccountData.files = accountFilesState.currentAccountData.files.filter(f => f.id !== fileId);
        renderAccountFiles();
    } catch (error) {
        alert(error?.message || 'Failed to delete file.');
    }
}

// ===== NAMED NOTES FUNCTIONS =====

// Open Add Note Modal
export function openAddNoteModal() {
    const overlay = document.createElement('div');
    overlay.className = 'note-modal-overlay';
    overlay.id = 'noteModalOverlay';

    const modal = document.createElement('div');
    modal.className = 'note-modal';

    modal.innerHTML = `
        <div class="note-modal-header">
            <h3 class="note-modal-title">Add New Note</h3>
            <button type="button" class="note-modal-close" id="noteModalCloseBtn">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <form id="addNoteForm">
            <div class="note-form-group">
                <label>Note Subject *</label>
                <select id="noteSubject" required>
                    <option value="">Select a subject...</option>
                    <option value="3rd Party catalog sites">3rd Party catalog sites</option>
                    <option value="Additional Instructions / Notes">Additional Instructions / Notes</option>
                    <option value="Address Mismatch">Address Mismatch</option>
                    <option value="Brands">Brands</option>
                    <option value="Business Activities">Business Activities</option>
                    <option value="Capabilities">Capabilities</option>
                    <option value="Primary/Secondary Services">Primary/Secondary Services</option>
                    <option value="Classification">Classification</option>
                    <option value="General Account Queries / Issues">General Account Queries / Issues</option>
                    <option value="Links / URLs">Links / URLs</option>
                    <option value="PDM">PDM</option>
                    <option value="Domain Change">Domain Change</option>
                    <option value="Primary Company Type">Primary Company Type</option>
                    <option value="Paid Heading">Paid Heading</option>
                    <option value="SDMS Notes">SDMS Notes</option>
                    <option value="Clients Instructions">Clients Instructions</option>
                    <option value="Other Info">Other Info</option>
                </select>
            </div>
            <div class="note-form-group">
                <label>Note Content *</label>
                <textarea id="noteContent" required placeholder="Enter note content..."></textarea>
            </div>
            <div class="note-modal-footer" style="justify-content: space-between;">
                <button type="button" class="note-btn note-btn-secondary" id="noteAttachmentBtn">
                    <i class="fas fa-paperclip"></i> Attachment
                </button>
                <button type="submit" class="note-btn note-btn-primary">
                    <i class="fas fa-save"></i> Save Note
                </button>
            </div>
        </form>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = modal.querySelector('#noteModalCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeNoteModal);
    }

    const addNoteForm = modal.querySelector('#addNoteForm');
    if (addNoteForm) {
        addNoteForm.addEventListener('submit', saveNamedNote);
    }

    const attachmentBtn = modal.querySelector('#noteAttachmentBtn');
    if (attachmentBtn) {
        attachmentBtn.addEventListener('click', () => {
            alert('Attachment feature coming soon!');
        });
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeNoteModal();
    });
}

// Close Note Modal
export function closeNoteModal() {
    const overlay = document.getElementById('noteModalOverlay');
    if (overlay) overlay.remove();
}

// Save Named Note
export function saveNamedNote(e) {
    e.preventDefault();

    const title = document.getElementById('noteSubject').value.trim();
    const content = document.getElementById('noteContent').value.trim();

    if (!title || !content) {
        alert('Please fill in all fields');
        return;
    }

    if (!accountFilesState.currentAccountId) {
        alert("No account selected!");
        return;
    }

    const currentUser = getCurrentUserForFiles();

    const note = {
        id: `NOTE-${Date.now()}`,
        title: title,
        content: content,
        createdBy: currentUser,
        createdAt: new Date().toISOString()
    };

    accountFilesState.currentAccountData.notes.push(note);

    // Persist
    const allData = getAllAccountsData();
    allData[accountFilesState.currentAccountId] = accountFilesState.currentAccountData;
    saveAllAccountsData(allData);

    renderNamedNotes();
    closeNoteModal();
}

// Render Named Notes (Updated for new column layout)
export function renderNamedNotes() {
    const containers = document.querySelectorAll('.notes-list, #pageNamedNotesList'); // Include Dashboard list
    if (containers.length === 0) return;

    // Unique
    const uniqueContainers = [...new Set(containers)];

    const html = accountFilesState.currentAccountData.notes.length === 0 ? `
            <div class="empty-placeholder">
                <i class="fas fa-sticky-note"></i>
                <p>No notes created yet</p>
            </div>
        ` : accountFilesState.currentAccountData.notes.map(note => `
        <div class="compact-note-card" data-note-id="${note.id}">
            <button type="button" class="note-delete-absolute note-delete-btn" data-note-id="${note.id}" title="Delete Note">
                <i class="fas fa-times"></i>
            </button>
            <h4 class="compact-note-title">${escapeHtml(note.title)}</h4>
            <p class="compact-note-text">${escapeHtml(note.content)}</p>
            <span class="current-note-date">${formatTimestampForFiles(note.createdAt, note.createdBy)}</span>
        </div>
    `).join('');

    containers.forEach(container => {
        container.innerHTML = html;

        container.querySelectorAll('.compact-note-card[data-note-id]').forEach(card => {
            card.addEventListener('click', () => {
                const noteId = card.getAttribute('data-note-id');
                if (noteId) {
                    viewNote(noteId);
                }
            });
        });

        container.querySelectorAll('.note-delete-btn[data-note-id]').forEach(button => {
            button.addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = button.getAttribute('data-note-id');
                if (noteId) {
                    deleteNote(noteId);
                }
            });
        });
    });
}

// Delete Note
export function deleteNote(noteId) {
    const note = accountFilesState.currentAccountData.notes.find(n => n.id === noteId);
    if (!note) return;

    const confirmDelete = confirm(`Are you sure you want to delete the note "${note.title}"?`);
    if (!confirmDelete) return;

    accountFilesState.currentAccountData.notes = accountFilesState.currentAccountData.notes.filter(n => n.id !== noteId);

    // Persist
    const allData = getAllAccountsData();
    allData[accountFilesState.currentAccountId] = accountFilesState.currentAccountData;
    saveAllAccountsData(allData);

    renderNamedNotes();
}

// View Note Full Content
export function viewNote(noteId) {
    const note = accountFilesState.currentAccountData.notes.find(n => n.id === noteId);
    if (!note) return;

    const overlay = document.createElement('div');
    overlay.className = 'note-modal-overlay';
    overlay.id = 'notePreviewOverlay';

    const modal = document.createElement('div');
    modal.className = 'note-modal';

    modal.innerHTML = `
        <div class="note-modal-header">
            <h3 class="note-modal-title">${escapeHtml(note.title)}</h3>
            <button type="button" class="note-modal-close" id="notePreviewCloseBtn">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="note-preview-content" style="padding-bottom: 20px;">
            <div style="margin-bottom: 12px; color: #64748b; font-size: 12px;">
                ${formatTimestampForFiles(note.createdAt, note.createdBy)}
            </div>
            <div style="font-family: 'Calibri', 'Roboto', sans-serif; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${escapeHtml(note.content)}</div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = modal.querySelector('#notePreviewCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeNotePreview);
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeNotePreview();
    });
}

// Close Note Preview
export function closeNotePreview() {
    const overlay = document.getElementById('notePreviewOverlay');
    if (overlay) overlay.remove();
}

// Initialize when Account Files tab is shown
document.addEventListener('showSheet', (e) => {
    if (e.detail === 'workspace') {
        setTimeout(() => {
            const accountFilesTab = document.getElementById('accountFilesTab');
            const qcFilesTab = document.getElementById('qcAccountFilesTab');

            // Check if either is visible/active to init
            // (Assuming simple init is safe to run multiple times due to state checks)
            initializeAccountFiles();
        }, 100);
    }
});

// ===== ACCOUNT-SPECIFIC DATA MANAGEMENT =====

// Storage for account-specific data
let accountSpecificData = JSON.parse(localStorage.getItem('qc_tool_account_data')) || {};

// Current account being viewed in modal
let currentModalAccountId = null;

// Save account data to localStorage
export function saveAccountData() {
    localStorage.setItem('qc_tool_account_data', JSON.stringify(accountSpecificData));
}

// Permanently remove all stored file/note/comment data for one account.
export function purgeAccountFilesData(accountId) {
    if (!accountId) return;

    // Remove from modal-specific in-memory cache.
    if (Object.prototype.hasOwnProperty.call(accountSpecificData, accountId)) {
        delete accountSpecificData[accountId];
    }

    // Remove from the shared account-data object and keep both caches aligned.
    const allData = getAllAccountsData();
    if (Object.prototype.hasOwnProperty.call(allData, accountId)) {
        delete allData[accountId];
    }

    accountSpecificData = allData;
    saveAllAccountsData(allData);

    // If deleted account is currently active in account-files state, reset it.
    if (accountFilesState.currentAccountId === accountId) {
        accountFilesState.currentAccountId = null;
        accountFilesState.currentAccountData = {
            files: [],
            notes: [],
            comments: []
        };
    }

    // If deleted account is open in modal context, clear that pointer.
    if (currentModalAccountId === accountId) {
        currentModalAccountId = null;
    }
}

// Get account data
export function getAccountData(accountId) {
    if (!accountSpecificData[accountId]) {
        accountSpecificData[accountId] = {
            files: [],
            notes: [],
            comments: []
        };
    }
    return accountSpecificData[accountId];
}

// Initialize Account Details Modal
export function initializeAccountDetailsModal(accountId) {
    currentModalAccountId = accountId;
    const accountData = getAccountData(accountId);

    // Set up event listeners for modal controls
    setupModalEventListeners();

    // Render all sections
    renderModalFiles(accountData.files);
    renderModalNotes(accountData.notes);
    renderModalComments(accountData.comments);
}

// Setup Modal Event Listeners
export function setupModalEventListeners() {
    // Upload button
    const uploadBtn = document.getElementById('modalAccountFilesUploadBtn');
    const fileInput = document.getElementById('modalAccountFilesInput');

    if (uploadBtn && fileInput) {
        uploadBtn.replaceWith(uploadBtn.cloneNode(true));
        const newUploadBtn = document.getElementById('modalAccountFilesUploadBtn');

        fileInput.replaceWith(fileInput.cloneNode(true));
        const newFileInput = document.getElementById('modalAccountFilesInput');

        newUploadBtn.addEventListener('click', () => newFileInput.click());
        newFileInput.addEventListener('change', handleModalFilesUpload);
    }

    // Search
    const searchInput = document.getElementById('modalAccountFilesSearch');
    if (searchInput) {
        searchInput.replaceWith(searchInput.cloneNode(true));
        const newSearchInput = document.getElementById('modalAccountFilesSearch');
        newSearchInput.addEventListener('input', handleModalFilesSearch);
    }

    // Filter
    const typeFilter = document.getElementById('modalAccountFilesTypeFilter');
    if (typeFilter) {
        typeFilter.replaceWith(typeFilter.cloneNode(true));
        const newTypeFilter = document.getElementById('modalAccountFilesTypeFilter');
        newTypeFilter.addEventListener('change', handleModalFilesFilter);
    }

    // Add note button
    const addNoteBtn = document.getElementById('modalAddNamedNoteBtn');
    if (addNoteBtn) {
        addNoteBtn.replaceWith(addNoteBtn.cloneNode(true));
        const newAddNoteBtn = document.getElementById('modalAddNamedNoteBtn');
        newAddNoteBtn.addEventListener('click', openModalAddNoteModal);
    }

    // Comments
    const commentInput = document.getElementById('modalAccountCommentsInput');
    const commentBtn = document.getElementById('modalAccountCommentsSendBtn');

    if (commentInput) {
        commentInput.replaceWith(commentInput.cloneNode(true));
        const newCommentInput = document.getElementById('modalAccountCommentsInput');

        // Auto-resize
        newCommentInput.style.overflow = 'hidden';
        newCommentInput.addEventListener('input', function () {
            this.style.height = 'auto';
            const newHeight = Math.min(Math.max(this.scrollHeight, 36), 120);
            this.style.height = newHeight + 'px';
            this.style.overflowY = this.scrollHeight > 120 ? 'auto' : 'hidden';
        });

        // Enter key
        newCommentInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleModalSendComment();
            }
        });
    }

    if (commentBtn) {
        commentBtn.replaceWith(commentBtn.cloneNode(true));
        const newCommentBtn = document.getElementById('modalAccountCommentsSendBtn');
        newCommentBtn.addEventListener('click', handleModalSendComment);
    }
}

// Handle Modal Files Upload
export function handleModalFilesUpload(e) {
    const files = e.target.files;
    if (!files || files.length === 0 || !currentModalAccountId) return;

    const accountData = getAccountData(currentModalAccountId);
    const allowedTypes = {
        excel: ['xlsx', 'xls', 'csv'],
        pdf: ['pdf'],
        image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
        video: ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm']
    };

    const allAllowedExtensions = [
        ...allowedTypes.excel,
        ...allowedTypes.pdf,
        ...allowedTypes.image,
        ...allowedTypes.video
    ];

    let processedCount = 0;
    let rejectedFiles = [];

    Array.from(files).forEach(file => {
        const extension = file.name.split('.').pop().toLowerCase();

        if (!allAllowedExtensions.includes(extension)) {
            rejectedFiles.push(file.name);
            return;
        }

        const fileData = {
            id: `FILE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            size: file.size,
            type: getFileType(file.name),
            uploadedAt: new Date().toISOString(),
            uploadedBy: getCurrentUserForFiles(),
            file: file
        };

        accountData.files.push(fileData);
        processedCount++;
    });

    if (rejectedFiles.length > 0) {
        alert(`The following file(s) have unsupported formats and were not uploaded:\n${rejectedFiles.join('\n')}\n\nSupported formats: Excel, PDF, Images, Videos.`);
    }

    saveAccountData();
    renderModalFiles(accountData.files);
    e.target.value = '';

    if (processedCount > 0) {
        const message = processedCount === 1
            ? 'Successfully uploaded 1 file!'
            : `Successfully uploaded ${processedCount} files!`;
        alert(message);
    }
}

// Handle Modal Files Search
export function handleModalFilesSearch(e) {
    if (!currentModalAccountId) return;
    const accountData = getAccountData(currentModalAccountId);
    const query = e.target.value.toLowerCase().trim();

    let filtered = accountData.files;
    if (query) {
        filtered = filtered.filter(file => file.name.toLowerCase().includes(query));
    }

    const typeFilter = document.getElementById('modalAccountFilesTypeFilter');
    if (typeFilter && typeFilter.value !== 'all') {
        filtered = filtered.filter(file => file.type === typeFilter.value);
    }

    renderModalFiles(filtered, accountData.files.length);
}

// Handle Modal Files Filter
export function handleModalFilesFilter(e) {
    if (!currentModalAccountId) return;
    const accountData = getAccountData(currentModalAccountId);
    const type = e.target.value;

    let filtered = accountData.files;
    if (type !== 'all') {
        filtered = filtered.filter(file => file.type === type);
    }

    const searchInput = document.getElementById('modalAccountFilesSearch');
    if (searchInput && searchInput.value.trim()) {
        const query = searchInput.value.toLowerCase().trim();
        filtered = filtered.filter(file => file.name.toLowerCase().includes(query));
    }

    renderModalFiles(filtered, accountData.files.length);
}

// Render Modal Files
export function renderModalFiles(files, totalCount) {
    const grid = document.getElementById('modalFilesGrid');
    const countEl = document.getElementById('modalFilesCount');

    if (!grid) return;

    const count = totalCount !== undefined ? totalCount : files.length;
    if (countEl) {
        countEl.textContent = `${count} file${count !== 1 ? 's' : ''}`;
    }

    if (files.length === 0) {
        grid.innerHTML = `
            <div class="empty-placeholder">
                <i class="fas fa-folder"></i>
                <p>${count === 0 ? 'No files uploaded yet' : 'No files match search'}</p>
            </div>
        `;
        return;
    }

    grid.innerHTML = files.map(file => `
        <div class="file-item-card" data-file-id="${file.id}">
            <div class="file-item-icon ${file.type}">
                <i class="fas ${getFileIcon(file.type)}"></i>
            </div>
            <div class="file-item-details">
                <div class="file-item-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</div>
                <div class="file-item-meta">
                    ${formatFileSize(file.size)} • ${formatTimestampForFiles(file.uploadedAt, file.uploadedBy, 'Uploaded')}
                </div>
            </div>
            <div class="file-item-actions">
                ${!['image', 'video', 'pdf'].includes(file.type) ? `
                    <button type="button" class="icon-action-btn modal-file-download-btn" data-file-id="${file.id}" title="Download">
                        <i class="fas fa-download"></i>
                    </button>
                ` : ''}
                <button type="button" class="icon-action-btn delete modal-file-delete-btn" data-file-id="${file.id}" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');

    grid.querySelectorAll('.file-item-card[data-file-id]').forEach(card => {
        card.addEventListener('click', () => {
            const fileId = card.getAttribute('data-file-id');
            if (fileId) previewModalFile(fileId);
        });
    });

    grid.querySelectorAll('.modal-file-download-btn[data-file-id]').forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const fileId = button.getAttribute('data-file-id');
            if (fileId) downloadModalFile(fileId);
        });
    });

    grid.querySelectorAll('.modal-file-delete-btn[data-file-id]').forEach(button => {
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            const fileId = button.getAttribute('data-file-id');
            if (fileId) deleteModalFile(fileId);
        });
    });
}

// Preview Modal File
export function previewModalFile(fileId) {
    if (!currentModalAccountId) return;
    const accountData = getAccountData(currentModalAccountId);
    const fileData = accountData.files.find(f => f.id === fileId);
    if (!fileData) return;

    const overlay = document.createElement('div');
    overlay.className = 'file-preview-overlay';
    overlay.id = 'filePreviewOverlay';

    const modal = document.createElement('div');
    modal.className = 'file-preview-modal';

    let previewContent = '';
    if (fileData.type === 'image') {
        const imageUrl = URL.createObjectURL(fileData.file);
        previewContent = `<img src="${imageUrl}" alt="${fileData.name}" class="file-preview-image">`;
    } else if (fileData.type === 'video') {
        const videoUrl = URL.createObjectURL(fileData.file);
        previewContent = `<video controls class="file-preview-video"><source src="${videoUrl}" type="${fileData.file.type}"></video>`;
    } else if (fileData.type === 'pdf') {
        const pdfUrl = URL.createObjectURL(fileData.file);
        previewContent = `<iframe src="${pdfUrl}" style="width: 100%; height: 600px; border: none;"></iframe>`;
    } else {
        // Fallback for non-previewable files
        downloadModalFile(fileId);
        return;
    }

    modal.innerHTML = `
        <div class="file-preview-header">
            <h3 class="file-preview-title">${escapeHtml(fileData.name)}</h3>
            <button type="button" class="file-preview-close" id="modalFilePreviewCloseBtn">
                <i class="fas fa-times"></i> Close
            </button>
        </div>
        <div class="file-preview-content">
            ${previewContent}
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = modal.querySelector('#modalFilePreviewCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeFilePreview);
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeFilePreview();
    });
}

// Download Modal File
export function downloadModalFile(fileId) {
    if (!currentModalAccountId) return;
    const accountData = getAccountData(currentModalAccountId);
    const fileData = accountData.files.find(f => f.id === fileId);
    if (!fileData) return;

    const url = URL.createObjectURL(fileData.file);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileData.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Delete Modal File
export function deleteModalFile(fileId) {
    if (!currentModalAccountId) return;
    const accountData = getAccountData(currentModalAccountId);
    const fileData = accountData.files.find(f => f.id === fileId);
    if (!fileData) return;

    if (!confirm(`Are you sure you want to delete "${fileData.name}"?`)) return;

    accountData.files = accountData.files.filter(f => f.id !== fileId);
    saveAccountData();
    renderModalFiles(accountData.files);
}

// Open Modal Add Note Modal
export function openModalAddNoteModal() {
    openAddNoteModal(); // Reuse existing modal

    // Override the save function temporarily
    const form = document.getElementById('addNoteForm');
    if (form) {
        form.onsubmit = saveModalNote;
    }
}

// Save Modal Note
export function saveModalNote(e) {
    e.preventDefault();
    if (!currentModalAccountId) return;

    const title = document.getElementById('noteSubject').value.trim();
    const content = document.getElementById('noteContent').value.trim();

    if (!title || !content) {
        alert('Please fill in all fields');
        return;
    }

    const accountData = getAccountData(currentModalAccountId);
    const note = {
        id: `NOTE-${Date.now()}`,
        title: title,
        content: content,
        createdBy: getCurrentUserForFiles(),
        createdAt: new Date().toISOString()
    };

    accountData.notes.push(note);
    saveAccountData();
    renderModalNotes(accountData.notes);
    closeNoteModal();
}

// Render Modal Notes
export function renderModalNotes(notes) {
    const container = document.getElementById('modalNamedNotesList');
    if (!container) return;

    if (notes.length === 0) {
        container.innerHTML = `
            <div class="empty-placeholder">
                <i class="fas fa-sticky-note"></i>
                <p>No notes created yet</p>
            </div>
        `;
        return;
    }

    container.innerHTML = notes.map(note => `
        <div class="compact-note-card" data-note-id="${note.id}">
            <button type="button" class="note-delete-absolute modal-note-delete-btn" data-note-id="${note.id}" title="Delete Note">
                <i class="fas fa-times"></i>
            </button>
            <h4 class="compact-note-title">${escapeHtml(note.title)}</h4>
            <p class="compact-note-text">${escapeHtml(note.content)}</p>
            <span class="current-note-date">${formatTimestampForFiles(note.createdAt, note.createdBy)}</span>
        </div>
    `).join('');

    container.querySelectorAll('.compact-note-card[data-note-id]').forEach(card => {
        card.addEventListener('click', () => {
            const noteId = card.getAttribute('data-note-id');
            if (noteId) {
                viewModalNote(noteId);
            }
        });
    });

    container.querySelectorAll('.modal-note-delete-btn[data-note-id]').forEach(button => {
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            const noteId = button.getAttribute('data-note-id');
            if (noteId) {
                deleteModalNote(noteId);
            }
        });
    });
}

// View Modal Note
export function viewModalNote(noteId) {
    if (!currentModalAccountId) return;
    const accountData = getAccountData(currentModalAccountId);
    const note = accountData.notes.find(n => n.id === noteId);
    if (!note) return;

    const overlay = document.createElement('div');
    overlay.className = 'note-modal-overlay';
    overlay.id = 'notePreviewOverlay';

    const modal = document.createElement('div');
    modal.className = 'note-modal';

    modal.innerHTML = `
        <div class="note-modal-header">
            <h3 class="note-modal-title">${escapeHtml(note.title)}</h3>
            <button type="button" class="note-modal-close" id="modalNotePreviewCloseBtn">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="note-preview-content" style="padding-bottom: 20px;">
            <div style="margin-bottom: 12px; color: #64748b; font-size: 12px;">
                ${formatTimestampForFiles(note.createdAt, note.createdBy)}
            </div>
            <div style="font-family: 'Calibri', 'Roboto', sans-serif; font-size: 14px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${escapeHtml(note.content)}</div>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = modal.querySelector('#modalNotePreviewCloseBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeNotePreview);
    }

    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeNotePreview();
    });
}

// Delete Modal Note
export function deleteModalNote(noteId) {
    if (!currentModalAccountId) return;
    const accountData = getAccountData(currentModalAccountId);
    const note = accountData.notes.find(n => n.id === noteId);
    if (!note) return;

    if (!confirm(`Are you sure you want to delete the note "${note.title}"?`)) return;

    accountData.notes = accountData.notes.filter(n => n.id !== noteId);
    saveAccountData();
    renderModalNotes(accountData.notes);
}

// Handle Modal Send Comment
export function handleModalSendComment() {
    if (!currentModalAccountId) return;

    const input = document.getElementById('modalAccountCommentsInput');
    if (!input) return;

    const text = input.value.trim();
    if (!text) return;

    const accountData = getAccountData(currentModalAccountId);
    const comment = {
        id: `COMMENT-${Date.now()}`,
        text: text,
        user: getCurrentUserForFiles(),
        timestamp: new Date().toISOString()
    };

    accountData.comments.push(comment);
    saveAccountData();
    renderModalComments(accountData.comments);

    input.value = '';
    input.style.height = '36px';
    input.focus();
}

// Render Modal Comments
export function renderModalComments(comments) {
    const container = document.getElementById('modalAccountCommentsList');
    if (!container) return;

    const currentUser = getCurrentUserForFiles();

    if (comments.length === 0) {
        container.innerHTML = `
            <div class="empty-placeholder">
                <i class="fas fa-comments"></i>
                <p>No comments yet. Start a discussion!</p>
            </div>
        `;
        return;
    }

    // Group by Date
    const grouped = {};
    comments.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    comments.forEach(comment => {
        const date = new Date(comment.timestamp).toLocaleDateString();
        if (!grouped[date]) grouped[date] = [];
        grouped[date].push(comment);
    });

    let html = '';

    const getHumanDate = (d) => {
        const date = new Date(d);
        const now = new Date();
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);

        if (date.toDateString() === now.toDateString()) return 'Today';
        if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
        return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    };

    for (const [dateStr, dateComments] of Object.entries(grouped)) {
        const humanDate = getHumanDate(dateComments[0].timestamp);

        html += `
            <div class="comment-date-separator">
                <span>${humanDate}</span>
            </div>
        `;

        dateComments.forEach(comment => {
            const isSelf = comment.user === currentUser;
            const timeStr = formatTimeShort(comment.timestamp);

            html += `
                <div class="comment-wrapper ${isSelf ? 'self' : 'other'}">
                    <div class="comment-header">
                        <span class="comment-user-name">${isSelf ? 'You' : escapeHtml(comment.user)}</span>
                        <span class="comment-time">${timeStr}</span>
                    </div>
                    <div class="comment-bubble">${escapeHtml(comment.text)}</div>
                    ${isSelf ? `
                        <button type="button" class="comment-delete-btn" data-comment-id="${comment.id}" title="Delete message">
                            <i class="fas fa-trash"></i>
                        </button>
                    ` : ''}
                </div>
            `;
        });
    }

    container.innerHTML = html;
    container.querySelectorAll('.comment-delete-btn[data-comment-id]').forEach(button => {
        button.addEventListener('click', () => {
            const commentId = button.getAttribute('data-comment-id');
            if (commentId) {
                deleteModalComment(commentId);
            }
        });
    });
    container.scrollTop = container.scrollHeight;
}

// Delete Modal Comment
export function deleteModalComment(commentId) {
    if (!currentModalAccountId) return;
    const accountData = getAccountData(currentModalAccountId);
    const comment = accountData.comments.find(c => c.id === commentId);
    if (!comment) return;

    const currentUser = getCurrentUserForFiles();
    if (comment.user !== currentUser) {
        alert("You can only delete your own comments.");
        return;
    }

    if (!confirm('Are you sure you want to delete this message?')) return;

    accountData.comments = accountData.comments.filter(c => c.id !== commentId);
    saveAccountData();
    renderModalComments(accountData.comments);
}


