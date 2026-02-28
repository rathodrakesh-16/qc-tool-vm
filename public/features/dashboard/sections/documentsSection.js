import { authManager } from '../../../core/auth/AuthManager.js';
import { showAlert } from '../../../components/notification.js';
import {
    renderDocumentsSkeleton,
    setSkeletonBusyState
} from '../../../components/skeleton.js';
import {
    fetchDocuments as fetchDocumentsApi,
    deleteDocument as deleteDocumentApi
} from '../api/dashboardApi.js';

// Dashboard data is backend-sourced; array stays exported for compatibility.
export const documentsData = [];

let isDocumentsLoading = false;
let documentsPanelEventsBound = false;

function replaceDocuments(documents) {
    documentsData.splice(0, documentsData.length, ...documents);
}

export function setDocumentsLoading(isLoading) {
    isDocumentsLoading = Boolean(isLoading);
}

export async function refreshDashboardDocuments() {
    const documents = await fetchDocumentsApi();
    replaceDocuments(documents);
    return documentsData;
}

export function prependDashboardDocument(document) {
    if (!document || !document.id) return;

    const withoutExisting = documentsData.filter(doc => String(doc.id) !== String(document.id));
    replaceDocuments([document, ...withoutExisting]);
}

export function removeDashboardDocument(documentId) {
    const normalized = String(documentId || '').trim();
    if (!normalized) return;

    const next = documentsData.filter(doc => String(doc.id) !== normalized);
    replaceDocuments(next);
}

export async function deleteDocument(documentId) {
    if (!authManager.isAdmin()) {
        showAlert('warning', 'Only admins can delete documents.');
        return;
    }

    if (!documentId) {
        showAlert('warning', 'Document identifier is missing.');
        return;
    }

    if (!confirm('Are you sure you want to delete this document?')) {
        return;
    }

    try {
        await deleteDocumentApi(documentId);
        removeDashboardDocument(documentId);
        renderDocuments();
        showAlert('success', 'Document deleted successfully.');
    } catch (error) {
        showAlert('error', error?.message || 'Failed to delete document.');
    }
}

export function bindDocumentsPanelEvents() {
    if (documentsPanelEventsBound) {
        return;
    }

    const docsPanel = document.querySelector('.dashboard-documents-panel');
    if (!docsPanel) {
        return;
    }

    docsPanel.addEventListener('click', (e) => {
        const deleteBtn = e.target.closest('.dashboard-document-delete-btn[data-doc-id]');
        if (!deleteBtn) {
            return;
        }

        const documentId = deleteBtn.getAttribute('data-doc-id');
        if (documentId) {
            deleteDocument(documentId);
        }
    });

    documentsPanelEventsBound = true;
}

export function renderDocuments() {
    const panel = document.querySelector('.dashboard-documents-panel');
    if (!panel) return;

    if (isDocumentsLoading) {
        renderDocumentsSkeleton(panel, {
            title: 'General SOPs & Documents',
            count: 6
        });
        return;
    }

    setSkeletonBusyState(panel, false);

    const isAdmin = authManager.isAdmin();

    let html = '<h2 class="dashboard-section-title">General SOPs & Documents</h2>';
    html += '<div class="dashboard-documents-list">';

    documentsData.forEach((doc) => {
        html += `
            <div class='dashboard-document-card'>
                <div class='dashboard-document-info'>
                    <div class='dashboard-document-icon-wrapper'>
                        <i class='fas ${doc.icon || 'fa-file-alt'} dashboard-document-icon'></i>
                    </div>
                    <span class='dashboard-document-name'>${doc.name}</span>
                </div>
                <div class="dashboard-document-actions">
                    <a href='${doc.link}' class='dashboard-document-link' target='_blank' rel='noopener noreferrer' title="Open Link">
                        <i class='fas fa-external-link-alt'></i>
                    </a>
                    ${isAdmin ? `
                    <button class='dashboard-document-delete-btn' data-doc-id='${doc.id}' title="Delete Document">
                        <i class='fas fa-trash'></i>
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    });

    html += '</div>';
    panel.innerHTML = html;
}

// Legacy compatibility no-op (dashboard data persistence moved to backend APIs)
export function saveDashboardDocuments() {
    return;
}
