/**
 * Auth Manager - Handles authentication, session version control and inactivity timeout
 * Features:
 * - Session cookie authentication via Laravel Sanctum
 * - Login/Logout Logic
 * - Auto-logout on code version change (WITH WARNING)
 * - 5-hour inactivity timeout (NO WARNING - DIRECT LOGOUT)
 */
import { APP_VERSION } from '../version.js';
import { showAlert } from '../../components/notification.js';

// Configuration
export const SESSION_CONFIG = {
    APP_VERSION,
    INACTIVITY_TIMEOUT: 5 * 60 * 60 * 1000,
    ACTIVITY_CHECK_INTERVAL: 60 * 1000,
    VERSION_UPDATE_WARNING_DURATION: 3000,
    QC_STORAGE_SCHEMA_VERSION: 'qc_backend_contract_v1',
    QC_LEGACY_STORAGE_KEYS: [
        'dataTableData',
        'dataTablePDMData',
        'pulldataBackupTableData',
        'classificationDetailsTableData'
    ],
    STORAGE_KEYS: {
        VERSION: 'app_version',
        LAST_ACTIVITY: 'last_activity_time',
        SESSION_USER: 'sessionUser',
        QC_STORAGE_SCHEMA: 'qc_storage_schema_version'
    }
};

export class AuthManager {
    constructor() {
        this.activityTimer = null;
        this.boundActivityHandler = this.recordActivity.bind(this);
    }

    /**
     * Initialize session management
     */
    async initialize() {

        // Update version display in UI
        this.updateVersionDisplay();

        // 1. Check version on initialization
        if (this.checkVersionMismatch()) {
            this.handleVersionMismatch();
            return;
        }

        // FIX ADDED: If no mismatch, save current version as the new baseline for a valid session.
        localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.VERSION, SESSION_CONFIG.APP_VERSION);

        this.enforceQCStorageSchema();
        await this.syncSessionUser();

        // Set up activity tracking
        this.setupActivityTracking();

        // Start monitoring inactivity
        this.startInactivityMonitoring();

    }

    enforceQCStorageSchema() {
        const schemaKey = SESSION_CONFIG.STORAGE_KEYS.QC_STORAGE_SCHEMA;
        const targetSchema = SESSION_CONFIG.QC_STORAGE_SCHEMA_VERSION;
        const currentSchema = localStorage.getItem(schemaKey);

        if (currentSchema === targetSchema) {
            return;
        }

        SESSION_CONFIG.QC_LEGACY_STORAGE_KEYS.forEach(key => {
            localStorage.removeItem(key);
        });

        localStorage.setItem(schemaKey, targetSchema);
    }

    /**
     * Login User
     * @param {string} userId 
     * @param {string} password 
     * @returns {object|null} user object or null if failed
     */
    async login(userId, password) {
        userId = userId.trim();
        password = password.trim();

        await this.ensureCsrfCookie();

        const response = await fetch('/login', {
            method: 'POST',
            credentials: 'include',
            headers: this.buildJsonHeaders(),
            body: JSON.stringify({ userId, password }),
        });

        if (!response.ok) {
            let errorMessage = 'Login failed';
            try {
                const errorPayload = await response.json();
                errorMessage = errorPayload?.message || errorMessage;
            } catch { /* response may not be JSON */ }
            return { error: true, message: errorMessage, status: response.status };
        }

        const payload = await response.json();
        const user = payload?.user || null;

        if (!user) {
            return null;
        }

        localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.SESSION_USER, JSON.stringify(user));

        this.updateVersion();
        this.recordActivity();
        return user;
    }

    /**
     * Logout User
     * @param {string} reason Optional reason for logout
     */
    async logout(reason = 'manual') {

        // Stop monitoring
        this.stopMonitoring();

        try {
            await this.ensureCsrfCookie();
            await fetch('/logout', {
                method: 'POST',
                credentials: 'include',
                headers: this.buildJsonHeaders(),
            });
        } catch (e) {
        }

        // Clear local storage
        localStorage.removeItem(SESSION_CONFIG.STORAGE_KEYS.SESSION_USER);
        localStorage.removeItem('lastSheet'); // Legacy support
        localStorage.removeItem(SESSION_CONFIG.STORAGE_KEYS.LAST_ACTIVITY);

        // Notify if needed (for inactivity/version reasons)
        if (reason === 'inactivity') {
            setTimeout(() => {
                showAlert('warning', '⏰ You have been logged out due to inactivity for security reasons.', 5000);
            }, 100);
        } else if (reason === 'version_update') {
            // Already warned before this call usually
        }

        // Redirect/Update UI handled by event dispatch or direct DOM manipulation in call site?
        // Ideally AuthManager dispatches an event, but for now we follow the existing pattern
        // where the caller (loginPage) handles UI, OR we add a callback.
        // However, to centralize, we can dispatch a custom event.
        const event = new CustomEvent('auth:logout', { detail: { reason } });
        document.dispatchEvent(event);
    }

    /**
     * Get currently logged in user
     * @returns {object|null}
     */
    getUser() {
        try {
            return JSON.parse(localStorage.getItem(SESSION_CONFIG.STORAGE_KEYS.SESSION_USER));
        } catch (e) {
            return null;
        }
    }

    async syncSessionUser() {
        try {
            const response = await fetch('/api/me', {
                method: 'GET',
                credentials: 'include',
                headers: {
                    'Accept': 'application/json'
                }
            });

            if (!response.ok) {
                localStorage.removeItem(SESSION_CONFIG.STORAGE_KEYS.SESSION_USER);
                return null;
            }

            const payload = await response.json();
            const user = payload?.user || null;

            if (user) {
                localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.SESSION_USER, JSON.stringify(user));
                return user;
            }

            localStorage.removeItem(SESSION_CONFIG.STORAGE_KEYS.SESSION_USER);
            return null;
        } catch (e) {
            return this.getUser();
        }
    }

    async fetchUsers() {
        const response = await fetch('/api/users', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to fetch users (${response.status})`);
        }

        const payload = await response.json();
        return payload?.users || [];
    }

    async fetchUserNames() {
        const response = await fetch('/api/users/names', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to fetch user names (${response.status})`);
        }

        const payload = await response.json();
        return payload?.users || [];
    }

    async fetchUserByUserId(userId) {
        if (!userId) return null;

        const normalizedUserId = userId.toLowerCase();
        const response = await fetch(`/api/users/by-userid/${encodeURIComponent(normalizedUserId)}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            if (response.status === 404) {
                return null;
            }

            throw await this.parseApiError(response, `Failed to fetch user (${response.status})`);
        }

        const payload = await response.json();
        return payload?.user || null;
    }

    async parseApiError(response, fallbackMessage) {
        let message = fallbackMessage;

        try {
            const payload = await response.json();
            if (payload?.errors && typeof payload.errors === 'object') {
                const firstErrorField = Object.keys(payload.errors)[0];
                const firstErrorValue = payload.errors[firstErrorField];
                if (Array.isArray(firstErrorValue) && firstErrorValue[0]) {
                    message = firstErrorValue[0];
                } else if (typeof firstErrorValue === 'string' && firstErrorValue.trim()) {
                    message = firstErrorValue;
                }
            } else if (payload?.message) {
                message = payload.message;
            }
        } catch (e) {
            // Ignore parse errors and keep fallback message.
        }

        const error = new Error(message);
        error.status = response.status;
        return error;
    }

    async fetchAccounts() {
        const response = await fetch('/api/dashboard/accounts', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to fetch accounts (${response.status})`);
        }

        const payload = await response.json();
        return payload?.accounts || [];
    }

    async createAccount(accountData) {
        await this.ensureCsrfCookie();

        const response = await fetch('/api/dashboard/accounts', {
            method: 'POST',
            credentials: 'include',
            headers: this.buildJsonHeaders(),
            body: JSON.stringify(accountData),
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to create account (${response.status})`);
        }

        const payload = await response.json();
        return payload?.account || null;
    }

    async updateAccount(accountId, accountData) {
        await this.ensureCsrfCookie();

        const response = await fetch(`/api/dashboard/accounts/${encodeURIComponent(accountId)}`, {
            method: 'PUT',
            credentials: 'include',
            headers: this.buildJsonHeaders(),
            body: JSON.stringify(accountData),
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to update account (${response.status})`);
        }

        const payload = await response.json();
        return payload?.account || null;
    }

    async deleteAccount(accountId) {
        await this.ensureCsrfCookie();

        const response = await fetch(`/api/dashboard/accounts/${encodeURIComponent(accountId)}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: this.buildJsonHeaders(),
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to delete account (${response.status})`);
        }

        return true;
    }

    async fetchDocuments() {
        const response = await fetch('/api/dashboard/documents', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to fetch documents (${response.status})`);
        }

        const payload = await response.json();
        return payload?.documents || [];
    }

    async createDocument(documentData) {
        await this.ensureCsrfCookie();

        const response = await fetch('/api/dashboard/documents', {
            method: 'POST',
            credentials: 'include',
            headers: this.buildJsonHeaders(),
            body: JSON.stringify(documentData),
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to create document (${response.status})`);
        }

        const payload = await response.json();
        return payload?.document || null;
    }

    async deleteDocument(documentId) {
        await this.ensureCsrfCookie();

        const response = await fetch(`/api/dashboard/documents/${encodeURIComponent(documentId)}`, {
            method: 'DELETE',
            credentials: 'include',
            headers: this.buildJsonHeaders(),
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to delete document (${response.status})`);
        }

        return true;
    }

    async generateClassifications(data) {
        await this.ensureCsrfCookie();

        const response = await fetch('/api/qc/classifications', {
            method: 'POST',
            credentials: 'include',
            headers: this.buildJsonHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to generate classifications (${response.status})`);
        }

        return await response.json();
    }

    async generateReport(data) {
        await this.ensureCsrfCookie();

        const response = await fetch('/api/qc/report', {
            method: 'POST',
            credentials: 'include',
            headers: this.buildJsonHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to generate QC report (${response.status})`);
        }

        return await response.json();
    }

    async exportReport(data) {
        await this.ensureCsrfCookie();

        const response = await fetch('/api/qc/export', {
            method: 'POST',
            credentials: 'include',
            headers: this.buildJsonHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to export QC report (${response.status})`);
        }

        const disposition = response.headers.get('content-disposition') || '';
        const filename = this.extractFilenameFromDisposition(disposition) || 'QC_Report.xlsx';
        const blob = await response.blob();

        return { blob, filename };
    }

    async fetchQCConfig() {
        const response = await fetch('/api/qc/config', {
            method: 'GET',
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            }
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `Failed to fetch QC config (${response.status})`);
        }

        return await response.json();
    }

    async aiValidatePdmDescriptions(data) {
        await this.ensureCsrfCookie();

        const response = await fetch('/api/qc/ai-validate', {
            method: 'POST',
            credentials: 'include',
            headers: this.buildJsonHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw await this.parseApiError(response, `AI validation failed (${response.status})`);
        }

        return await response.json();
    }

    async ensureCsrfCookie() {
        await fetch('/sanctum/csrf-cookie', {
            method: 'GET',
            credentials: 'include',
        });
    }

    buildJsonHeaders() {
        const token = this.getCookieValue('XSRF-TOKEN');
        const headers = {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
        };

        if (token) {
            headers['X-XSRF-TOKEN'] = decodeURIComponent(token);
        }

        return headers;
    }

    getCookieValue(name) {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) {
            return parts.pop().split(';').shift();
        }

        return null;
    }

    extractFilenameFromDisposition(disposition) {
        if (!disposition) return null;

        const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
        if (utf8Match?.[1]) {
            return decodeURIComponent(utf8Match[1].trim().replace(/["']/g, ''));
        }

        const basicMatch = disposition.match(/filename=([^;]+)/i);
        if (basicMatch?.[1]) {
            return basicMatch[1].trim().replace(/["']/g, '');
        }

        return null;
    }

    /**
     * Check if user is authenticated
     * @returns {boolean}
     */
    isAuthenticated() {
        return !!this.getUser();
    }

    /**
     * Check if user is admin
     * @returns {boolean}
     */
    isAdmin() {
        const user = this.getUser();
        return user && user.role === 'admin';
    }

    /**
     * Check if app version has changed
     */
    checkVersionMismatch() {
        const storedVersion = localStorage.getItem(SESSION_CONFIG.STORAGE_KEYS.VERSION);
        const currentVersion = SESSION_CONFIG.APP_VERSION;

        // Only check if a stored version exists.
        if (storedVersion && storedVersion !== currentVersion) {
            return true;
        }

        return false;
    }

    /**
     * Handle version mismatch - show data clear prompt
     */
    handleVersionMismatch() {
        this.showDataClearModal();
    }

    /**
     * Show modal prompting user to clear data for new version
     */
    showDataClearModal() {
        // Remove existing modal if any
        const existingModal = document.getElementById('versionDataClearModal');
        if (existingModal) existingModal.remove();

        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.id = 'versionDataClearModal';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 99999;
            font-family: 'Calibri', 'Roboto', sans-serif;
        `;

        // Create modal content
        const modal = document.createElement('div');
        modal.style.cssText = `
            background: white;
            border-radius: 12px;
            padding: 32px;
            max-width: 480px;
            width: 90%;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            text-align: center;
        `;

        modal.innerHTML = `
            <h2 style="margin: 0 0 12px 0; font-size: 20px; color: #1e293b; font-weight: 600;">
                New Version Available
            </h2>
            <p style="margin: 0 0 28px 0; font-size: 14px; color: #64748b; line-height: 1.6;">
                A new version of the application requires clearing your local data to ensure compatibility.
            </p>
            <button id="clearDataBtn" style="
                background: #b91c1c;
                color: white;
                border: none;
                padding: 10px 24px;
                font-size: 14px;
                font-weight: 500;
                border-radius: 6px;
                cursor: pointer;
                transition: background 0.2s;
            ">
                Clear Local Storage
            </button>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Button click handler
        const clearBtn = document.getElementById('clearDataBtn');
        clearBtn.addEventListener('click', () => {
            this.clearAllAppData();
            overlay.remove();

            // Show success message and reload
            showAlert('success', 'Data cleared successfully! Reloading...', 2000);

            setTimeout(() => {
                window.location.reload();
            }, 1000);
        });

        // Hover effect
        clearBtn.addEventListener('mouseenter', () => {
            clearBtn.style.background = '#991b1b';
        });
        clearBtn.addEventListener('mouseleave', () => {
            clearBtn.style.background = '#b91c1c';
        });
    }

    /**
     * Update version display in UI elements
     */
    updateVersionDisplay() {
        const version = SESSION_CONFIG.APP_VERSION;

        // Update page title
        const titleEl = document.getElementById('appTitle');
        if (titleEl) {
            titleEl.textContent = `QC Tool ${version}`;
        }

        // Update sidebar version text
        const versionTextEl = document.getElementById('appVersionText');
        if (versionTextEl) {
            versionTextEl.textContent = `QC Tool ${version}`;
        }
    }

    /**
     * Clear all application data from localStorage
     */
    clearAllAppData() {

        // Set flag to prevent beforeunload handler from re-saving data
        window.isDataClearing = true;

        // Complete list of ALL app-specific keys to clear
        const keysToRemove = [
            // Session & Auth
            'sessionUser',
            'lastSheet',
            'app_version',
            'last_activity_time',
            'qc_storage_schema_version',

            // Workspace Data
            'qc_tool_workspace_data',
            'qc_tool_active_account_id',
            'qc_tool_active_mode',

            // Account Data
            'qc_tool_account_data',
            'qc_tool_account_files',  // Legacy key
            'qc_tool_assigned_accounts',
            'assignedAccountsData',   // Legacy key

            // Dashboard
            'qc_tool_dashboard_documents',

            // History & Reports
            'qc_tool_history',
            'accountDetails',
            'companyProfile',
            'dataTableData',
            'dataTablePDMData',
            'pulldataBackupTableData',
            'classificationDetailsTableData'
        ];

        keysToRemove.forEach(key => {
            localStorage.removeItem(key);
        });

        // Reset in-memory states to prevent beforeunload handler from re-saving.
        // These use typeof guards because importing workspace modules here would
        // create a circular dependency (workspace imports AuthManager).
        if (typeof workspaceState !== 'undefined') {
            workspaceState.selectedAccount = null;
        }
        if (typeof workspaceAccountsState !== 'undefined') {
            workspaceAccountsState.selectedAccountId = '';
        }

        // Set new version
        localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.VERSION, SESSION_CONFIG.APP_VERSION);

    }

    /**
     * Set up activity tracking
     */
    setupActivityTracking() {
        // Track various user activities
        const activityEvents = [
            'mousedown',
            'mousemove',
            'keypress',
            'scroll',
            'touchstart',
            'click'
        ];

        activityEvents.forEach(event => {
            document.addEventListener(event, this.boundActivityHandler, { passive: true });
        });

        // Record initial activity
        this.recordActivity();
    }

    /**
     * Record user activity
     */
    recordActivity() {
        const now = Date.now();
        localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.LAST_ACTIVITY, now.toString());
    }

    /**
     * Start monitoring for inactivity
     */
    startInactivityMonitoring() {
        // Clear any existing timer
        if (this.activityTimer) {
            clearInterval(this.activityTimer);
        }

        // Check inactivity every minute
        this.activityTimer = setInterval(() => {
            this.checkInactivity();
        }, SESSION_CONFIG.ACTIVITY_CHECK_INTERVAL);

    }

    /**
     * Check if user has been inactive
     * NO WARNING - Direct logout after timeout
     */
    checkInactivity() {
        // Don't check if user is not logged in
        if (!this.isAuthenticated()) {
            return;
        }

        const lastActivity = parseInt(localStorage.getItem(SESSION_CONFIG.STORAGE_KEYS.LAST_ACTIVITY) || '0');
        const now = Date.now();
        const inactiveTime = now - lastActivity;

        // Auto-logout if inactive for too long (NO WARNING)
        if (inactiveTime >= SESSION_CONFIG.INACTIVITY_TIMEOUT) {
            this.performLogout('inactivity');
        }
    }

    /**
     * Perform logout (Internal method)
     * @param {string} reason - 'inactivity' or 'version_update'
     */
    performLogout(reason) {
        // internal abstraction calling the public one but handling specific internal details if any
        this.logout(reason);

        // Update version after logout
        localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.VERSION, SESSION_CONFIG.APP_VERSION);
    }

    /**
     * Stop monitoring (called during logout)
     */
    stopMonitoring() {
        // Clear timers
        if (this.activityTimer) {
            clearInterval(this.activityTimer);
            this.activityTimer = null;
        }

        // Remove activity listeners
        const activityEvents = [
            'mousedown',
            'mousemove',
            'keypress',
            'scroll',
            'touchstart',
            'click'
        ];

        activityEvents.forEach(event => {
            document.removeEventListener(event, this.boundActivityHandler);
        });

    }

    /**
     * Update app version (call this after successful login)
     */
    updateVersion() {
        localStorage.setItem(SESSION_CONFIG.STORAGE_KEYS.VERSION, SESSION_CONFIG.APP_VERSION);
    }

    /**
     * Get remaining time before auto-logout
     */
    getRemainingTime() {
        const lastActivity = parseInt(localStorage.getItem(SESSION_CONFIG.STORAGE_KEYS.LAST_ACTIVITY) || '0');
        const now = Date.now();
        const elapsed = now - lastActivity;
        const remaining = SESSION_CONFIG.INACTIVITY_TIMEOUT - elapsed;

        return Math.max(0, remaining);
    }

    /**
     * Format remaining time as human-readable string
     */
    formatRemainingTime() {
        const remaining = this.getRemainingTime();
        const hours = Math.floor(remaining / (60 * 60 * 1000));
        const minutes = Math.floor((remaining % (60 * 60 * 1000)) / (60 * 1000));

        return `${hours}h ${minutes}m`;
    }
}

// Create global instance
export const authManager = new AuthManager();

/**
 * Global utility function to manually clear all app data
 * Can be called from browser console or settings
 */
export function clearAppDataAndReload() {
    if (confirm('Are you sure you want to clear all application data?\n\nThis will remove all workspace data, account selections, and cached files.\n\nYou will need to log in again.')) {
        authManager.clearAllAppData();
        alert('Data cleared successfully! The page will now reload.');
        window.location.reload();
    }
}

// Window bridges removed - import directly from this module
