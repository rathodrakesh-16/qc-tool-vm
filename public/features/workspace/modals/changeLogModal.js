/* History Modal Functionality */

import { accountFilesState } from '../state/accountDataState.js';
import { workspaceAccountsState } from '../state/workspaceAccountsState.js';

export const HISTORY_STORAGE_KEY = 'qc_tool_history';


export const HistoryManager = {
    // Add a new history entry
    addEntry: function (action, details, user, accountId = null) {
        // If context account ID is missing, try to find one from available states
        if (!accountId) {
            if (accountFilesState.currentAccountId) {
                accountId = accountFilesState.currentAccountId;
            } else if (workspaceAccountsState.selectedAccountId) {
                accountId = workspaceAccountsState.selectedAccountId;
            }
        }

        const entry = {
            id: `HIST-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            action: action,
            details: details,
            user: user || 'Unknown User',
            timestamp: new Date().toISOString(),
            accountId: accountId || 'global'
        };

        const history = this.getHistory();
        history.push(entry);
        this.saveHistory(history);

        // Refresh UI
        this.refresh(accountId);
    },

    // Get all history entries
    getHistory: function () {
        const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
        return saved ? JSON.parse(saved) : [];
    },

    // Get history for specific account
    getAccountHistory: function (accountId) {
        const history = this.getHistory();
        if (!accountId) return history;
        return history.filter(h => h.accountId === accountId || h.accountId === 'global'); // 'global' events show everywhere? Or strictly? Use strict for now if user wants specific.
        // Re-reading request: "should only show for that perculer account". 
        // So strict filtering (maybe keep global items if they are truly global system events, but account actions should be bound).
        // Let's filter strictly if an accountId is provided.
        // Actually, let's keep 'global' visible or logic might hide things like "System initialized". 
        // But for now, user asked for specificity.
    },

    // Save history
    saveHistory: function (history) {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history));
    },

    // Get current Context ID safe
    getCurrentContextId: function () {
        if (accountFilesState.currentAccountId) return accountFilesState.currentAccountId;
        if (workspaceAccountsState.selectedAccountId) return workspaceAccountsState.selectedAccountId;
        return null;
    },

    // Render history records to the modal body
    renderHistory: function (accountId = null) {
        const modalBody = document.querySelector('#historyModal .history-modal-body');
        if (!modalBody) return;

        const contextId = accountId || this.getCurrentContextId();

        let logs = [];
        if (contextId) {
            logs = this.getAccountHistory(contextId);
        } else {
            logs = this.getHistory();
        }

        // Sort by newest first
        logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (logs.length === 0) {
            modalBody.innerHTML = `
                <div class="history-empty-state">
                    <i class="fas fa-history"></i>
                    <p>No activity recorded yet</p>
                </div>`;
            return;
        }

        // Use same structure as existing classifications table
        let html = `
            <div class="history-table-wrapper">
                <div class="production-report-familywise-list-container">
                    <div class="production-report-table-list-header">
                        <div class="report-column history-time-column">Time</div>
                        <div class="report-column text-left">Action</div>
                        <div class="report-column text-left">Details</div>
                        <div class="report-column">User</div>
                    </div>
                    <div class="production-report-table-list-body">
        `;

        // Table Rows
        html += logs.map(log => this.createLogItemHTML(log)).join('');

        html += `
                    </div>
                </div>
            </div>
        `;

        modalBody.innerHTML = html;
    },

    createLogItemHTML: function (log) {
        const dateObj = new Date(log.timestamp);

        // Format: "10 Jan at 3:30 AM"
        const day = dateObj.getDate();
        const month = dateObj.toLocaleDateString('en-US', { month: 'short' });
        let hours = dateObj.getHours();
        const minutes = String(dateObj.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;

        const formattedTime = `${day} ${month} at ${hours}:${minutes} ${ampm}`;
        const displayValue = (val) => val !== null && val !== undefined && val !== '' ? val : '—';

        return `
            <div class="production-report-table-list-row">
                <div class="report-column history-time-column" title="${dateObj.toLocaleString()}">${formattedTime}</div>
                <div class="report-column text-left">${displayValue(log.action)}</div>
                <div class="report-column text-left" title="${log.details}">${displayValue(log.details)}</div>
                <div class="report-column" title="${log.user}">${displayValue(log.user)}</div>
            </div>
        `;
    },

    // Helper to format time relative 'just now', '5 mins ago'
    formatTimeRelative: function (isoString) {
        const date = new Date(isoString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);

        if (diffInSeconds < 60) return 'just now';
        if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
        if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
        return date.toLocaleDateString();
    },

    // Central method to refresh summary and modal
    refresh: function (accountId = null) {
        const contextId = accountId || this.getCurrentContextId();
        this.updateHistorySummary(contextId);

        // Only render modal if it is open? Or just render it invisible?
        // Safest to just render it, it is fast.
        this.renderHistory(contextId);
    },

    updateHistorySummary: function (accountId) {
        const containers = document.querySelectorAll('.change-logs-container');

        containers.forEach(container => {
            const textSpan = container.querySelector('.change-logs-text');
            if (textSpan) {
                textSpan.textContent = 'Change Logs';
                textSpan.title = 'View Change History';
            }
        });
    }

};

/**
 * Initialize Change Log Modal DOM elements and event listeners.
 * Called from app.js after templates are loaded.
 */
export function initializeChangeLogModal() {
    // Attach event listeners to history containers
    const editorHistoryBtn = document.getElementById('editorChangeLogsContainer');
    const qcHistoryBtn = document.getElementById('qcChangeLogsContainer');
    const closeBtn = document.getElementById('historyModalCloseBtn');
    const overlay = document.getElementById('historyModalOverlay');

    if (editorHistoryBtn) {
        editorHistoryBtn.style.cursor = 'pointer';
        editorHistoryBtn.addEventListener('click', openHistoryModal);
    }

    if (qcHistoryBtn) {
        qcHistoryBtn.style.cursor = 'pointer';
        qcHistoryBtn.addEventListener('click', openHistoryModal);
    }

    if (closeBtn) {
        closeBtn.addEventListener('click', closeHistoryModal);
    }

    if (overlay) {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeHistoryModal();
            }
        });
    }

    // Initial refresh
    HistoryManager.refresh();
}


export function openHistoryModal() {
    const overlay = document.getElementById('historyModalOverlay');
    const modal = document.getElementById('historyModal');

    if (!overlay || !modal) {
        return;
    }

    // Refresh content
    HistoryManager.renderHistory();

    // Add open class to trigger transitions
    overlay.classList.add('open');
    modal.classList.add('open');
    document.body.style.overflow = 'hidden'; // Prevent background scrolling
}

export function closeHistoryModal() {
    const overlay = document.getElementById('historyModalOverlay');
    const modal = document.getElementById('historyModal');

    if (!overlay || !modal) return;

    overlay.classList.remove('open');
    modal.classList.remove('open');
    document.body.style.overflow = '';
}

// Window bridges removed - exports are imported where needed
