// scripts/modals/documentManagementModal.js
import { authManager } from '../../../core/auth/AuthManager.js';
import { prependDashboardDocument, renderDocuments, getDashboardMetadata } from '../dashboard.js';
import { showAlert } from '../../../components/notification.js';
import { createDocument as createDocumentApi } from '../api/dashboardApi.js';

function getDocumentTypeOptions() {
  // Single source: metadata from dashboard (backend-provided, cached on the client).
  const options = getDashboardMetadata()?.documentTypes;
  if (Array.isArray(options) && options.length > 0) {
    return options;
  }
  return [{ value: 'other', label: 'Other' }];
}

function populateDocumentTypeOptions() {
  const typeSelect = document.getElementById('newDocumentType');
  if (!typeSelect) return;

  const selectedValue = typeSelect.value || 'other';
  const options = getDocumentTypeOptions();

  typeSelect.innerHTML = options.map(option => (
    `<option value="${option.value}">${option.label}</option>`
  )).join('');

  if (options.some(option => option.value === selectedValue)) {
    typeSelect.value = selectedValue;
  } else {
    typeSelect.value = 'other';
  }
}

export function createDocumentManagementModal() {
  if (document.getElementById('documentManagementModal')) return;

  const modalHtml = `
      <div id="documentManagementModal" class="document-management-modal-overlay" style="display: none;">
        <div class="document-management-modal">
          <div class="document-management-modal-header">
            <h2 class="document-management-modal-title">Add New Document</h2>
            <button class="document-management-modal-close-btn">
              <i class="fas fa-times"></i>
            </button>
          </div>
          <form id="documentManagementForm">
            <div class="document-management-form-group">
              <label for="newDocumentName">Document Name *</label>
              <input type="text" id="newDocumentName" required />
            </div>
            <div class="document-management-form-group">
              <label for="newDocumentLink">Document Link/URL *</label>
              <input type="url" id="newDocumentLink" required placeholder="https://..." />
            </div>
            <div class="document-management-form-group">
              <label for="newDocumentType">Document Type</label>
              <select id="newDocumentType"></select>
            </div>
            <div class="document-management-modal-actions">
              <button type="submit" class="document-management-btn-submit" id="saveDocumentBtn">
                <i class="fas fa-save"></i> Save Document
              </button>
            </div>
          </form>
        </div>
      </div>
    `;
  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modal = document.getElementById('documentManagementModal');
  populateDocumentTypeOptions();

  const closeBtn = modal.querySelector('.document-management-modal-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', closeDocumentManagementModal);

  const form = document.getElementById('documentManagementForm');
  if (form) form.addEventListener('submit', (e) => {
    e.preventDefault();
    saveNewDocument();
  });

  modal.addEventListener('click', function (event) {
    if (event.target === modal) {
      closeDocumentManagementModal();
    }
  });

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && modal.style.display === 'flex') {
      closeDocumentManagementModal();
    }
  });
}

export function openDocumentManagementModal() {
  if (!authManager.isAdmin()) {
    showAlert('warning', 'Only admins can add documents.');
    return;
  }

  createDocumentManagementModal();

  const modal = document.getElementById('documentManagementModal');
  if (modal) {
    modal.style.display = 'flex';
    const form = document.getElementById('documentManagementForm');
    if (form) form.reset();
    populateDocumentTypeOptions();
  }
}

export function closeDocumentManagementModal() {
  const modal = document.getElementById('documentManagementModal');
  if (modal) {
    modal.style.display = 'none';
  }
}

function setSaveButtonLoading(isLoading) {
  const btn = document.getElementById('saveDocumentBtn');
  if (!btn) return;

  btn.disabled = isLoading;
  if (isLoading) {
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';
  } else {
    btn.innerHTML = '<i class="fas fa-save"></i> Save Document';
  }
}

function mapDocTypeToIcon(type) {
  switch (type) {
    case 'pdf': return 'fa-file-pdf';
    case 'word': return 'fa-file-word';
    case 'excel': return 'fa-file-excel';
    case 'ppt': return 'fa-file-powerpoint';
    case 'image': return 'fa-file-image';
    default: return 'fa-file-alt';
  }
}

export async function saveNewDocument() {
  if (!authManager.isAdmin()) {
    showAlert('warning', 'Only admins can add documents.');
    return;
  }

  const name = document.getElementById('newDocumentName')?.value?.trim();
  const link = document.getElementById('newDocumentLink')?.value?.trim();
  const type = document.getElementById('newDocumentType')?.value || 'other';

  if (!name || !link) {
    showAlert('warning', 'Please fill in all required fields.');
    return;
  }

  setSaveButtonLoading(true);

  try {
    const documentRecord = await createDocumentApi({
      doccument_name: name,
      doccument_link: link,
      doc_type: type,
      icon_class: mapDocTypeToIcon(type),
      is_system: false
    });

    prependDashboardDocument(documentRecord);
    renderDocuments();
    showAlert('success', 'Document added successfully!');
    closeDocumentManagementModal();
  } catch (error) {
    showAlert('error', error?.message || 'Failed to add document.');
  } finally {
    setSaveButtonLoading(false);
  }
}

// Window bridges removed - functions are exported and imported where needed
