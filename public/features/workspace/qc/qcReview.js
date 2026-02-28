// QC Section State Management
// NOTE: qcSectionState is now defined in state/qcSectionState.js

import { workspaceState } from '../state/workspaceState.js';
import { qcSectionState } from '../state/qcSectionState.js';
import { getHeadingsFromRegistry, saveCurrentWorkspaceData } from '../workspace.js';
import { renderProductionPDMLibrary } from '../editor/production.js';
import { calculateProductionErrorStats, renderAccountSummarySection } from './workspaceQcReport.js';
import { PdmUtils } from '../sharedComponents/pdmUtils.js';
import { authManager } from '../../../core/auth/AuthManager.js';
import { updateFamilyFilterDropdown, setupQCReviewFilterLogic } from '../sharedComponents/filters.js';
import { HistoryManager } from '../modals/changeLogModal.js';
import { QCFeedbackModal } from '../modals/qcFeedbackModal.js';
import { openHeadingDetailsModalById } from '../modals/headingDetailsModal.js';
import { showQCGroupingFamilyModal } from '../modals/familyAssignModal.js';
import { QCValidation } from './qcValidation.js';

// Get current user
function getQCCurrentUser() {
    const currentUser = authManager.getUser();
    return currentUser ? currentUser.username : 'Unknown QC';
}

export function initializeQCSection() {
    // Verify critical elements exist before proceeding
    const qcPdmsList = document.getElementById('qcPdmsList');
    const qcPdmViewContent = document.getElementById('qcPdmViewContent');

    if (!qcPdmsList || !qcPdmViewContent) {
        setTimeout(initializeQCSection, 100);
        return;
    }

    // Verify workspaceState is available
    if (typeof workspaceState === 'undefined') {
        setTimeout(initializeQCSection, 100);
        return;
    }

    // Sync state from workspace
    // Sync state from workspace
    // Removed qcReviews sync

    setupQCSectionEventListeners();
    updateQCFamilyFilterOptions();
    updateQCHeadingsFamilyOptions();
    setupDefectiveSectionInteraction();
    setupDefectiveSectionInteraction();
    setupQCListSectionInteraction();
    setupQCMultiSelect();

    setTimeout(() => {
        renderQCPDMsList();
        renderQCPDMView();
        renderQCHeadings();
    }, 50);

}

// Setup QC Section Event Listeners
// Setup QC Section Event Listeners
function setupQCSectionEventListeners() {
    // Filter Logic is centralized in filters.js
    if (typeof setupQCReviewFilterLogic === 'function') {
        setupQCReviewFilterLogic();
    }

    const addQcHeadingsBtn = document.getElementById('addQcHeadingsToBuilderBtn');
    if (addQcHeadingsBtn) {
        addQcHeadingsBtn.addEventListener('click', addSelectedQCHeadingsToEdit);
    }

    const missedQcHeadingsBtn = document.getElementById('missedQcHeadingsBtn');
    if (missedQcHeadingsBtn) {
        missedQcHeadingsBtn.addEventListener('click', handleQCMissedHeadings);
    }


    // Save and Clear Review Buttons are handled by qcValidationModal.js or inline onclicks

    // QC Edit Mode Buttons
    const saveEditBtn = document.getElementById('qcSaveEditBtn');
    if (saveEditBtn) {
        saveEditBtn.addEventListener('click', saveQCPDMEdit);
    }

    const cancelEditBtn = document.getElementById('qcCancelEditBtn');
    if (cancelEditBtn) {
        cancelEditBtn.addEventListener('click', cancelQCPDMEdit);
    }

    // QC Edit Inputs (for word count / reactive updates if needed)
    const editDescInput = document.getElementById('qcEditPdmDescription');
    if (editDescInput) {
        editDescInput.addEventListener('input', updateQCEditWordCount);
    }
}



// Clear QC Headings Search
export function clearQCHeadingsSearch() {
    const searchInput = document.getElementById('qcHeadingsSearchInput');
    const clearBtn = document.getElementById('clearQcHeadingsSearchBtn');

    if (searchInput) {
        searchInput.value = '';
        qcSectionState.headingsSearchQuery = '';
    }

    if (clearBtn) {
        clearBtn.style.display = 'none';
    }

    renderQCHeadings();
}








// Update QC Family Filter Options
function updateQCFamilyFilterOptions() {
    // Delegate to centralized filter update function
    // This function now handles counting based on unique heading IDs in registry
    if (typeof updateFamilyFilterDropdown === 'function') {
        updateFamilyFilterDropdown();
    }
}

// Update QC Headings Family Filter Options
function updateQCHeadingsFamilyOptions() {
    // Delegate to centralized filter update function
    // This function now handles counting based on unique heading IDs in registry
    if (typeof updateFamilyFilterDropdown === 'function') {
        updateFamilyFilterDropdown();
    }
}



// Get unique families from PDM
function getQCPDMFamilies(pdm) {
    const families = [...new Set(pdm.headings.map(h => h.family || 'Unknown'))];
    return families.join(', ');
}

// Count headings by status
function countQCHeadingsByStatus(pdm) {
    const counts = { added: 0, existing: 0, ranked: 0 };
    pdm.headings.forEach(heading => {
        const status = heading.status || 'added';
        counts[status]++;
    });
    return counts;
}

// Update Count
function updateQCPDMCount(qcCount, defectiveCount) {
    const qcCountSpan = document.getElementById('qcPdmCount');
    const defectiveCountSpan = document.getElementById('qcDefectivePdmCount');

    if (qcCountSpan) {
        qcCountSpan.textContent = qcCount;
    }

    if (defectiveCountSpan) {
        defectiveCountSpan.textContent = defectiveCount;
    }
}

// Render QC PDMs List (BOTH QC and Defective)
export function renderQCPDMsList() {
    const qcContainer = document.getElementById('qcPdmsList');
    const defectiveContainer = document.getElementById('qcDefectivePdmsContent');

    if (!qcContainer || !defectiveContainer) return;

    // Get PDMs from workspaceState
    let pdms = [];
    if (typeof workspaceState !== 'undefined' && workspaceState.savedPDMs) {
        pdms = workspaceState.savedPDMs;
    }

    // Filter PDMs based on search and family
    let filteredPDMs = pdms.filter(pdm => {
        return PdmUtils.filterPDM(pdm, qcSectionState.searchQuery, qcSectionState.familyFilter);
    });

    // Split PDMs into QC and Defective
    const qcPDMs = [];
    const defectivePDMs = [];

    filteredPDMs.forEach(pdm => {
        if (pdm.qcStatus === 'error') {
            defectivePDMs.push(pdm);
        } else {
            qcPDMs.push(pdm);
        }
    });

    // Update Counts
    updateQCPDMCount(qcPDMs.length, defectivePDMs.length);

    // Render QC PDMs
    renderSpecificPDMList(qcContainer, qcPDMs, 'No PDMs available for QC review', 'fas fa-folder-open');

    // Render Defective PDMs
    renderSpecificPDMList(defectiveContainer, defectivePDMs, 'No defective PDMs found', 'fas fa-check-circle');

    // Render Mini View for Defective PDMs
    renderDefectiveMiniView(defectivePDMs);

    // Render Mini View for QC PDMs
    renderQCMiniView(qcPDMs);
}

// Render Mini View for Defective PDMs (Icons only)
function renderDefectiveMiniView(pdms) {
    const container = document.querySelector('.qc-defective-mini-view');
    if (!container) return;

    const count = pdms.length;

    container.innerHTML = `
        <div class="defective-mini-card" style="width: 48px; height: 48px; position: relative;" 
             title="${count} Defective PDMs">
            <i class="fas fa-exclamation-triangle" style="font-size: 20px;"></i>
            ${count > 0 ? `<div class="defective-mini-count" style="top: -6px; right: -6px; width: 20px; height: 20px; font-size: 11px;">${count}</div>` : ''}
        </div>
    `;

    const miniCard = container.querySelector('.defective-mini-card');
    if (miniCard) {
        miniCard.addEventListener('click', (e) => {
            e.stopPropagation();
            expandDefectiveSection();
        });
    }
}

// Render Mini View for QC PDMs (Icons only)
function renderQCMiniView(pdms) {
    const container = document.querySelector('.qc-qc-mini-view');
    if (!container) return;

    const count = pdms.length;

    container.innerHTML = `
        <div class="qc-mini-card" style="width: 48px; height: 48px; position: relative; justify-content: center;"
             title="${count} QC PDMs">
            <i class="fas fa-folder" style="font-size: 20px;"></i>
             ${count > 0 ? `<div class="qc-mini-card-count" style="position: absolute; top: -6px; right: -6px; background: #3b82f6; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 2px solid white;">${count}</div>` : ''}
        </div>
    `;

    const miniCard = container.querySelector('.qc-mini-card');
    if (miniCard) {
        miniCard.addEventListener('click', (e) => {
            e.stopPropagation();
            expandQCSection();
        });
    }
}

// Setup Interaction for Defective Section (Expand/Collapse)
function setupDefectiveSectionInteraction() {
    const section = document.querySelector('.qc-defective-pdms-section');
    if (!section) return;

    // Ensure Mini View container exists
    if (!section.querySelector('.qc-defective-mini-view')) {
        const miniView = document.createElement('div');
        miniView.className = 'qc-defective-mini-view';
        section.appendChild(miniView);
    }

    // Click handler for the section itself
    section.addEventListener('click', (e) => {
        if (!section.classList.contains('expanded')) {
            toggleDefectiveSection(true);
        }
    });


}

// Setup Interaction for QC List Section (Expand/Collapse)
function setupQCListSectionInteraction() {
    const section = document.querySelector('.qc-pdms-list-section');
    if (!section) return;

    // Ensure Mini View container exists
    if (!section.querySelector('.qc-qc-mini-view')) {
        const miniView = document.createElement('div');
        miniView.className = 'qc-qc-mini-view';
        section.appendChild(miniView);
    }

    // Click handler
    section.addEventListener('click', (e) => {
        if (!section.classList.contains('expanded')) {
            toggleQCSection(true);
        }
    });


    // Initial check
    handleQCResize();

    // Listen for resize
    window.addEventListener('resize', handleQCResize);
}

function handleQCResize() {
    const listSection = document.querySelector('.qc-pdms-list-section');
    const defectiveSection = document.querySelector('.qc-defective-pdms-section');

    if (!listSection || !defectiveSection) return;

    if (window.innerWidth > 1900) {
        // Desktop Mode: Reset all responsive classes
        listSection.classList.remove('expanded', 'collapsed');
        defectiveSection.classList.remove('expanded', 'collapsed');
    } else {
        // Laptop/Tablet Mode: Ensure one is valid if none are set
        // If neither has 'expanded' or 'collapsed', set default:
        // QC List -> Expanded, Defective -> Collapsed

        const hasState = listSection.classList.contains('expanded') ||
            listSection.classList.contains('collapsed') ||
            defectiveSection.classList.contains('expanded') ||
            defectiveSection.classList.contains('collapsed');

        if (!hasState) {
            listSection.classList.add('expanded');
            defectiveSection.classList.add('collapsed');
        }
    }
}

function createCollapseBtn(onClick) {
    const btn = document.createElement('button');
    btn.innerHTML = '<i class="fas fa-chevron-right"></i>'; // Or left/inward
    btn.title = "Collapse Section";
    btn.style.cssText = `
        background: transparent;
        border: none;
        color: #64748b;
        cursor: pointer;
        padding: 4px 8px;
        font-size: 14px;
        margin-left: auto;
    `;
    btn.onclick = (e) => {
        e.stopPropagation();
        onClick();
    };
    return btn;
}

function expandDefectiveSection() {
    // Only expand if in responsive mode (<= 1900px)
    if (window.innerWidth <= 1900) {
        toggleDefectiveSection(true);
    }
}

function expandQCSection() {
    // Only expand if in responsive mode (<= 1900px)
    if (window.innerWidth <= 1900) {
        toggleQCSection(true);
    }
}

function toggleDefectiveSection(expand) {
    const section = document.querySelector('.qc-defective-pdms-section');
    const qcSection = document.querySelector('.qc-pdms-list-section');

    if (!section || !qcSection) return;

    if (expand) {
        section.classList.add('expanded');
        section.classList.remove('collapsed');

        // Collapse sibling
        qcSection.classList.remove('expanded');
        qcSection.classList.add('collapsed');
    } else {
        section.classList.remove('expanded');
        section.classList.add('collapsed');

        // Expand sibling based on requirement (toggle back)
        qcSection.classList.add('expanded');
        qcSection.classList.remove('collapsed');
    }
}

function toggleQCSection(expand) {
    const section = document.querySelector('.qc-pdms-list-section');
    const defectiveSection = document.querySelector('.qc-defective-pdms-section');

    if (!section || !defectiveSection) return;

    if (expand) {
        section.classList.add('expanded');
        section.classList.remove('collapsed');

        // Collapse sibling
        defectiveSection.classList.remove('expanded');
        defectiveSection.classList.add('collapsed');
    } else {
        section.classList.remove('expanded');
        section.classList.add('collapsed');

        // Expand sibling based on requirement (toggle back)
        defectiveSection.classList.add('expanded');
        defectiveSection.classList.remove('collapsed');
    }
}

function renderSpecificPDMList(container, pdms, emptyMessage, emptyIconClass) {
    if (pdms.length === 0) {
        container.innerHTML = `
            <div class="qc-empty-state">
                <p>${emptyMessage}</p>
            </div>
        `;
        return;
    }

    container.innerHTML = pdms.map(pdm => {
        // Status Badge Logic override handled by util? 
        // PdmUtils uses qcStatus property automatically if statusType='qc'

        return PdmUtils.generatePDMCardHTML(pdm, {
            isSelected: qcSectionState.selectedPDM && qcSectionState.selectedPDM.id === pdm.id,
            onClick: null,
            statusType: 'qc',
            classPrefix: (pdm.qcStatus === 'error') ? 'qc-pdm' : 'qc-pdm' // Util adds .defective automatically if error
        });
    }).join('');

    container.querySelectorAll('.qc-pdm-card[data-pdm-id]').forEach(card => {
        card.addEventListener('click', () => {
            const pdmId = card.getAttribute('data-pdm-id');
            if (pdmId) {
                selectQCPDM(pdmId);
            }
        });
    });
}

// Select QC PDM
export function selectQCPDM(pdmId) {
    let pdms = [];
    if (typeof workspaceState !== 'undefined' && workspaceState.savedPDMs) {
        pdms = workspaceState.savedPDMs;
    }

    const pdm = pdms.find(p => p.id === pdmId);
    if (!pdm) return;

    qcSectionState.selectedPDM = pdm;



    renderQCPDMsList();
    renderQCPDMView();
}

// Render QC PDM View
function renderQCPDMView() {
    const container = document.getElementById('qcPdmViewContent');
    if (!container) return;

    if (!qcSectionState.selectedPDM) {
        container.innerHTML = `
            <div class="qc-empty-state">
                <p>Select a PDM from the list to view its details</p>
            </div>
        `;
        return;
    }

    // Ensure View Mode is visible and Edit Mode is hidden
    const viewMode = document.getElementById('qcReviewViewMode');
    const editMode = document.getElementById('qcReviewEditMode');
    if (viewMode) viewMode.style.display = 'flex';
    if (editMode) editMode.style.display = 'none';

    const pdm = qcSectionState.selectedPDM;

    const hasFeedback = pdm.qcFeedback && ((pdm.qcFeedback.errors && pdm.qcFeedback.errors.length > 0) || pdm.qcFeedback.comment || pdm.qcFeedback.updatedDescription);
    const feedbackBtnState = hasFeedback ? '' : 'disabled';
    const feedbackBtnClass = hasFeedback ? '' : 'disabled-btn';

    // QC Update Button
    const qcUpdateBtn = `
        <button id="qcFeedbackBtn" type="button" class="qc-header-action-btn qc-btn-feedback">
            QC Update
        </button>
    `;

    // QC Checked Button
    const qcCheckedBtn = `
        <button id="qcConfirmedBtn" type="button" class="qc-header-action-btn qc-btn-confirmed">
            QC Checked
        </button>
    `;

    const actionsHTML = `
        ${qcUpdateBtn}
        ${qcCheckedBtn}
        <button type="button" class="qc-pdm-view-action-btn qc-pdm-view-edit-btn" data-pdm-id="${pdm.id}" title="Edit PDM">
            <i class="fas fa-edit"></i>
        </button>
        <button type="button" class="qc-pdm-view-action-btn qc-pdm-view-delete-btn" data-pdm-id="${pdm.id}" title="Delete">
            <i class="fas fa-trash"></i>
        </button>
        <button type="button" class="qc-pdm-view-action-btn qc-pdm-view-close-btn" title="Close">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.innerHTML = PdmUtils.generatePDMFullViewHTML(pdm, actionsHTML, 'qc-pdm');

    const feedbackBtn = container.querySelector('#qcFeedbackBtn');
    if (feedbackBtn) {
        feedbackBtn.addEventListener('click', () => QCFeedbackModal.openFeedbackModal());
    }

    const confirmedBtn = container.querySelector('#qcConfirmedBtn');
    if (confirmedBtn) {
        confirmedBtn.addEventListener('click', () => QCValidation.handleQCChecked());
    }

    const editBtn = container.querySelector('.qc-pdm-view-edit-btn[data-pdm-id]');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const pdmId = editBtn.getAttribute('data-pdm-id');
            if (pdmId) {
                editQCPDM(pdmId);
            }
        });
    }

    const deleteBtn = container.querySelector('.qc-pdm-view-delete-btn[data-pdm-id]');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const pdmId = deleteBtn.getAttribute('data-pdm-id');
            if (pdmId) {
                deleteQCPDM(pdmId);
            }
        });
    }

    const closeBtn = container.querySelector('.qc-pdm-view-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeQCPDMView);
    }

    container.querySelectorAll('.heading-info-icon[data-heading-id]').forEach(icon => {
        icon.addEventListener('click', (event) => {
            event.stopPropagation();
            const headingId = icon.getAttribute('data-heading-id');
            if (headingId) {
                openHeadingDetailsModalById(headingId);
            }
        });
    });
}


// Close QC PDM View
// Close QC PDM View
export function closeQCPDMView() {
    qcSectionState.selectedPDM = null;
    renderQCPDMsList();
    renderQCPDMView();
}

// Refresh QC Review Data (Sync from Workspace State and Re-render)
export function refreshQCReviewData() {
    // Reset selection on refresh/account switch
    qcSectionState.selectedPDM = null;

    // Update Family Filter options based on new account's PDMs
    updateQCFamilyFilterOptions();

    renderQCPDMsList();
    renderQCPDMView();
    renderQCHeadings();
}

// Edit PDM from QC (Local Edit Mode)
export function editQCPDM(pdmId) {
    const pdm = workspaceState.savedPDMs.find(p => p.id === pdmId);
    if (!pdm) return;

    // Set selection just in case
    qcSectionState.selectedPDM = pdm;

    // Store original for cancel to ensure transactional edits
    qcSectionState.originalPDM = pdm;
    // Clone for editing (Shallow copy of PDM, new array for headings to protect original list)
    qcSectionState.selectedPDM = {
        ...pdm,
        headings: [...pdm.headings]
    };

    // Populate Input Fields
    document.getElementById('qcEditPdmURL').value = pdm.url || '';
    // document.getElementById('qcEditPdmCompanyType').value = pdm.companyType || ''; // Handled by MS
    document.getElementById('qcEditPdmDescription').value = pdm.description || '';
    if (document.getElementById('qcEditPdmTypeOfProof')) {
        document.getElementById('qcEditPdmTypeOfProof').value = pdm.typeOfProof || '';
    }
    document.getElementById('qcEditPdmComment').value = pdm.comment || '';

    // Populate Multi-Select
    const msContainer = document.getElementById('qcEditPdmCompanyTypeMultiSelect');
    if (msContainer) {
        const preparedPdm = PdmUtils.prepareEditData(pdm);
        if (typeof PdmUtils.MultiSelect !== 'undefined') {
            PdmUtils.MultiSelect.updateDisplay(msContainer, preparedPdm.companyType);
        } else if (typeof updateMultiSelectDisplay === 'function') {
            // Fallback if local util still exists (it shouldn't, but for safety in transition)
            updateMultiSelectDisplay(msContainer, preparedPdm.companyType);
        }
    }

    // Render Headings List for Edit
    renderQCEditHeadings(pdm);

    // Update Word Count (helper function defined below)
    updateQCEditWordCount();

    // Toggle Views
    const viewMode = document.getElementById('qcReviewViewMode');
    const editMode = document.getElementById('qcReviewEditMode');

    if (viewMode) viewMode.style.display = 'none';
    if (editMode) editMode.style.display = 'block';
}

function renderQCEditHeadings(pdm) {
    const container = document.getElementById('qcEditPdmHeadingsList');
    const counter = document.getElementById('qcEditPdmCounter');

    if (!container) return;

    if (counter) {
        counter.textContent = `${pdm.headings.length} / 8 headings`;
        counter.classList.toggle('warning', pdm.headings.length > 8);
    }

    container.innerHTML = pdm.headings.map(heading => `
        <div class="qc-grouped-heading">
            <div class="qc-grouped-heading-info">
                ${PdmUtils.getStatusBadge(heading)}
                <span class="qc-grouped-heading-name">${heading.name}</span>
            </div>
            <button type="button" class="qc-remove-heading-btn" data-heading-id="${heading.id}">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `).join('');

    container.querySelectorAll('.qc-remove-heading-btn[data-heading-id]').forEach(button => {
        button.addEventListener('click', () => {
            const headingId = button.getAttribute('data-heading-id');
            if (headingId) {
                removeHeadingFromQCEdit(headingId);
            }
        });
    });
}

export function removeHeadingFromQCEdit(headingId) {
    const pdm = qcSectionState.selectedPDM;

    const headingIndex = pdm.headings.findIndex(h => h.id === headingId);
    if (headingIndex > -1) {
        const [heading] = pdm.headings.splice(headingIndex, 1);

        // REMOVED: Immediate push to Supported Headings to prevent duplication on Cancel.
        // Logic moved to saveQCPDMEdit to handle it transactionally.

        // Re-render
        renderQCEditHeadings(pdm);
    }
}


export function cancelQCPDMEdit() {
    // Restore original if available (revert changes)
    if (qcSectionState.originalPDM) {
        qcSectionState.selectedPDM = qcSectionState.originalPDM;
        qcSectionState.originalPDM = null;
        // Re-render view to show original data
        renderQCPDMView();
    }

    // Just switch view back
    const viewMode = document.getElementById('qcReviewViewMode');
    const editMode = document.getElementById('qcReviewEditMode');

    if (viewMode) viewMode.style.display = 'flex';
    if (editMode) editMode.style.display = 'none';
}

function updateQCEditWordCount() {
    // Optional: implement if visual counter is added
}

function countWords(str) {
    if (!str) return 0;
    return str.trim().split(/\s+/).length;
}

// Delete PDM from QC
export function deleteQCPDM(pdmId) {
    const pdm = workspaceState.savedPDMs.find(p => p.id === pdmId);
    if (!pdm) return;

    const confirmDelete = confirm(
        `Are you sure you want to delete ${pdm.number}?\n\n` +
        `This will return all ${pdm.headings.length} heading${pdm.headings.length !== 1 ? 's' : ''} to the Supported Headings section.`
    );

    if (!confirmDelete) return;

    // Delete Logic handled by Utils
    const deletedPdm = PdmUtils.deletePDM(pdmId, workspaceState);
    if (!deletedPdm) return;

    // Reset selection
    qcSectionState.selectedPDM = null;

    // Re-render
    renderQCPDMsList();
    renderQCPDMView();
    if (typeof renderProductionPDMLibrary === 'function') {
        renderProductionPDMLibrary();
    }

    // Also update family filter options as families might have been removed
    updateQCFamilyFilterOptions();

    if (typeof HistoryManager !== 'undefined') {
        HistoryManager.addEntry('QC PDM Deleted', `Deleted ${deletedPdm.number}`, getQCCurrentUser());
    }

    alert(`${deletedPdm.number} deleted successfully! All headings have been returned to the Supported Headings section.`);
}

// Render QC Headings (Imported Headings)
export function renderQCHeadings() {
    const container = document.getElementById('qcHeadingsContent');
    if (!container) return;

    // Get Imported Headings from registry
    let headings = [];
    if (typeof workspaceState !== 'undefined' && workspaceState.importedHeadingIds) {
        headings = getHeadingsFromRegistry(workspaceState.importedHeadingIds);
    }

    if (headings.length === 0) {
        container.innerHTML = `
            <div class="qc-empty-state">
                <p>No headings imported yet</p>
            </div>
        `;
        return;
    }

    // Apply Filters
    let filteredHeadings = headings.filter(heading => {
        // Search Filter
        if (qcSectionState.headingsSearchQuery) {
            const query = qcSectionState.headingsSearchQuery.toLowerCase();
            const matchesId = heading.id ? heading.id.toString().toLowerCase().includes(query) : false;
            const matchesName = heading.name.toLowerCase().includes(query);
            if (!matchesId && !matchesName) return false;
        }

        // Family Filter (check families array)
        if (qcSectionState.headingsFamilyFilter !== 'all') {
            const families = heading.families || [];
            if (!families.includes(qcSectionState.headingsFamilyFilter)) return false;
        }

        // Status Filter
        if (qcSectionState.headingsStatusFilter !== 'all') {
            const isWorked = workspaceState.savedPDMs.some(pdm =>
                pdm.headings.some(h => h.id === heading.id)
            );

            if (qcSectionState.headingsStatusFilter === 'worked') {
                if (!isWorked) return false;
            } else if (qcSectionState.headingsStatusFilter === 'unworked') {
                if (isWorked) return false;
            } else if (qcSectionState.headingsStatusFilter === 'existing') {
                if (heading.status !== 'existing') return false;
            } else if (qcSectionState.headingsStatusFilter === 'ranked') {
                if (heading.status !== 'ranked') return false;
            } else if (qcSectionState.headingsStatusFilter === 'additional') {
                if (heading.status !== 'additional') return false;
            }
        }

        return true;
    });

    if (filteredHeadings.length === 0) {
        container.innerHTML = `
            <div class="qc-empty-state">
                <i class="fas fa-filter"></i>
                <p>No headings match the selected filters</p>
            </div>
        `;
        return;
    }

    // Initialize selection set if not exists
    if (!qcSectionState.selectedHeadingIds) {
        qcSectionState.selectedHeadingIds = new Set();
    }

    container.innerHTML = filteredHeadings.map(heading => {
        const isSelected = qcSectionState.selectedHeadingIds.has(heading.id);

        return `
        <div class="qc-heading-item ${isSelected ? 'selected' : ''}" data-heading-id="${heading.id}">
            <div class="qc-heading-info">
                ${PdmUtils.getStatusBadge(heading)}
                <span class="qc-heading-name">${heading.name}</span>
                <i class="fas fa-info-circle qc-heading-info-icon"
                   style="margin-left: 8px; color: #9ca3af; cursor: pointer; flex-shrink: 0;"
                   title="View Details"
                   data-heading-id="${heading.id}"></i>
            </div>
        </div>
    `}).join('');

    container.querySelectorAll('.qc-heading-item[data-heading-id]').forEach(item => {
        item.addEventListener('click', () => {
            const headingId = item.getAttribute('data-heading-id');
            if (headingId) {
                toggleQCHeadingsSelection(headingId);
            }
        });
    });

    container.querySelectorAll('.qc-heading-info-icon[data-heading-id]').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const headingId = icon.getAttribute('data-heading-id');
            if (headingId) {
                openHeadingDetailsModalById(headingId);
            }
        });
    });
}

// Toggle Heading Selection
function toggleQCHeadingsSelection(headingId) {
    if (!qcSectionState.selectedHeadingIds) {
        qcSectionState.selectedHeadingIds = new Set();
    }

    if (qcSectionState.selectedHeadingIds.has(headingId)) {
        qcSectionState.selectedHeadingIds.delete(headingId);
    } else {
        qcSectionState.selectedHeadingIds.add(headingId);
    }

    renderQCHeadings();
}

// Show Grouping Family Modal for QC Headings
// Modal function moved to familyAssignModal.js
// Legacy wrapper function showQCGroupingFamilyModal is maintained in familyAssignModal.js

// Add Selected Headings to QC Edit (Add Button Logic)
function addSelectedQCHeadingsToEdit() {

    // 0. Validation: Must have headings selected
    if (!qcSectionState.selectedHeadingIds || qcSectionState.selectedHeadingIds.size === 0) {
        alert('Please select at least one heading to add.');
        return;
    }

    // Get selected heading objects from registry
    const headingsToAdd = Array.from(qcSectionState.selectedHeadingIds)
        .map(id => workspaceState.headingsRegistry[id])
        .filter(h => h); // Filter out any undefined

    if (headingsToAdd.length === 0) return;

    // Show grouping family modal first
    showQCGroupingFamilyModal(headingsToAdd, (headingsWithGrouping) => {
        // 1. Determine Target PDM context
        const editMode = document.getElementById('qcReviewEditMode');
        const isEditModeActive = editMode && editMode.style.display !== 'none';
        let targetPDM = qcSectionState.selectedPDM;

        if (isEditModeActive && targetPDM) {
            // CASE A: Already editing a PDM -> Add directly
            addHeadingsToSpecificPDM(targetPDM, headingsWithGrouping);

            // Re-render
            renderQCHeadings();
            renderQCEditHeadings(targetPDM);
            updateQCEditWordCount();

            // Clear selection
            qcSectionState.selectedHeadingIds.clear();

        } else if (targetPDM) {
            // CASE B: PDM is selected (Viewing) -> Confirm Edit Mode switch
            const confirmEdit = confirm(`Add ${headingsWithGrouping.length} heading(s) to ${targetPDM.number}? This will switch to Edit Mode.`);
            if (confirmEdit) {
                editQCPDM(targetPDM.id);
                // Re-fetch reference just in case 'editQCPDM' reset something? Should be fine.
                targetPDM = qcSectionState.selectedPDM;

                // Add
                addHeadingsToSpecificPDM(targetPDM, headingsWithGrouping);

                // Re-render
                renderQCHeadings(); // Updates selection visual (clears it below)
                renderQCEditHeadings(targetPDM);
                updateQCEditWordCount();

                // Clear selection
                qcSectionState.selectedHeadingIds.clear();
            }
        } else {
            // CASE C: No PDM selected -> Create New PDM
            const confirmCreate = confirm(`Create a new PDM with ${headingsWithGrouping.length} selected heading(s)?`);
            if (confirmCreate) {
                createNewQCPDM(headingsWithGrouping);
                // Clear selection
                qcSectionState.selectedHeadingIds.clear();
                renderQCHeadings();
            }
        }
    });
}

// Handle "Missed" Button Logic (Account Level Error)
function handleQCMissedHeadings() {
    // 0. Validation: Must have headings selected
    if (!qcSectionState.selectedHeadingIds || qcSectionState.selectedHeadingIds.size === 0) {
        alert('Please select at least one heading to mark as Missed.');
        return;
    }

    // Get selected heading objects from registry
    const headingsToProcess = Array.from(qcSectionState.selectedHeadingIds)
        .map(id => workspaceState.headingsRegistry[id])
        .filter(h => h); // Filter out any undefined

    if (headingsToProcess.length === 0) {
        alert('Selected headings are not in the Imported list.');
        return;
    }

    const confirmAction = confirm(`Mark ${headingsToProcess.length} heading(s) as "Missed"?\n\nThis will move them to Supported Headings and log a "Missed Heading" error for the Account.`);
    if (!confirmAction) return;

    // 1. Initialize Account Level Errors Array if needed
    if (!workspaceState.accountLevelErrors) {
        workspaceState.accountLevelErrors = [];
    }

    // 2. Process each heading
    headingsToProcess.forEach(heading => {
        // A. Move to Supported Headings (use ID arrays)
        if (!workspaceState.supportedHeadingIds.includes(heading.id)) {
            workspaceState.supportedHeadingIds.push(heading.id);
        }

        // B. Log Account Level Error
        const errorRecord = {
            id: 'ACC_ERR_' + Date.now() + Math.floor(Math.random() * 1000),
            isAccountLevel: true,
            errorCategory: 'Missed Heading', // Generic Category
            user: getQCCurrentUser(),
            timestamp: new Date().toISOString(),
            accountId: workspaceState.accountId || 'General Account', // Use Account ID for display
            qcFeedback: {
                comment: heading.name, // Heading Name in Comments
                user: getQCCurrentUser()
            },
            qcStatus: 'error',
            isDescriptionUpdated: false,
            rectificationStatus: 'Pending',
            validationStatus: 'Pending'
        };
        workspaceState.accountLevelErrors.push(errorRecord);
    });

    // 3. Remove from Imported Headings (use ID arrays)
    workspaceState.importedHeadingIds = workspaceState.importedHeadingIds.filter(id => !qcSectionState.selectedHeadingIds.has(id));

    // 4. Clear Selection
    qcSectionState.selectedHeadingIds.clear();

    // 5. Save State
    saveCurrentWorkspaceData();

    // 6. Refresh UI
    renderQCHeadings(); // Update headings list

    // Refresh Reports if visible?
    // Often best to verify by checking reports
    if (typeof renderProductionSummarySection === 'function') renderProductionSummarySection();
    if (typeof renderAccountSummarySection === 'function') renderAccountSummarySection();
    if (typeof calculateProductionErrorStats === 'function') {
        calculateProductionErrorStats();
        if (typeof renderProductionErrorSection === 'function') renderProductionErrorSection();
    }

    alert('Headings marked as Missed and logged as Account Errors.');
}

// Helper to add headings to a PDM object (validating limit)
function addHeadingsToSpecificPDM(pdm, headingsToAdd) {
    if (pdm.headings.length + headingsToAdd.length > 8) {
        alert(`Cannot add all headings. PDM limit is 8. Added as many as possible.`);
        // Add as many as possible? Or fail?
        // Let's add up to 8
        const space = 8 - pdm.headings.length;
        if (space <= 0) return;

        const toAdd = headingsToAdd.slice(0, space);
        toAdd.forEach(h => {
            // Check dupe
            if (!pdm.headings.some(existing => existing.id === h.id)) {
                pdm.headings.push(h);
            }
        });
    } else {
        headingsToAdd.forEach(h => {
            // Check dupe
            if (!pdm.headings.some(existing => existing.id === h.id)) {
                pdm.headings.push(h);
            }
        });
    }
}

export function createNewQCPDM(initialHeadings = []) {
    const currentUser = getQCCurrentUser();

    // Create a blank PDM structure
    const newPDM = {
        id: `PDM${String(workspaceState.savedPDMs.length + 1).padStart(3, '0')}`, // Temp ID
        number: workspaceState.savedPDMs.length + 1,
        url: '',
        companyType: '',
        typeOfProof: '',
        description: '',
        comment: '',
        headings: [],
        createdAt: new Date().toISOString(),
        createdBy: currentUser,
        status: 'draft',
        qcStatus: 'pending' // Default for new PDM created here? Or just 'pending'
    };

    // Add initial headings
    if (Array.isArray(initialHeadings)) {
        initialHeadings.forEach(h => newPDM.headings.push(h));
    } else if (initialHeadings) {
        // Fallback if single object passed
        newPDM.headings.push(initialHeadings);
    }

    // Validate limit
    if (newPDM.headings.length > 8) {
        alert('New PDM created, but strictly limited to 8 headings. Excess headings truncated.');
        newPDM.headings = newPDM.headings.slice(0, 8);
    }

    qcSectionState.selectedPDM = newPDM;

    // Switch to Edit Mode manually
    const viewMode = document.getElementById('qcReviewViewMode');
    const editMode = document.getElementById('qcReviewEditMode');
    if (viewMode) viewMode.style.display = 'none';
    if (editMode) editMode.style.display = 'block';

    // Populate Inputs (Empty)
    const urlInput = document.getElementById('qcEditPdmURL');
    if (urlInput) urlInput.value = '';

    const descInput = document.getElementById('qcEditPdmDescription');
    if (descInput) descInput.value = '';

    const commentInput = document.getElementById('qcEditPdmComment');
    if (commentInput) commentInput.value = '';

    const typeOfProofInput = document.getElementById('qcEditPdmTypeOfProof');
    if (typeOfProofInput) typeOfProofInput.value = '';

    const msContainer = document.getElementById('qcEditPdmCompanyTypeMultiSelect');
    if (msContainer && typeof PdmUtils !== 'undefined' && PdmUtils.MultiSelect) {
        PdmUtils.MultiSelect.updateDisplay(msContainer, []);
    } else if (msContainer && typeof updateMultiSelectDisplay === 'function') {
        updateMultiSelectDisplay(msContainer, []);
    }

    renderQCEditHeadings(newPDM);
    updateQCEditWordCount();
}

// Modify saveQCPDMEdit to handle new PDM
// I need to override the existing function or modify it. 
// Since I can't easily modify the middle of a function with replace, I will redefine it here?
// No, I can replace the whole function if I want.
// Let's redefine `saveQCPDMEdit` to support adding new PDMs.

// Redefined saveQCPDMEdit
// Redefined saveQCPDMEdit to use PdmUtils
// Redefined saveQCPDMEdit to use PdmUtils and Auto-Assign Errors
export function saveQCPDMEdit() {
    const pdm = qcSectionState.selectedPDM; // This is the edited copy
    if (!pdm) return;

    // construct new data
    const pdmData = {
        ...pdm, // edited state
        url: document.getElementById('qcEditPdmURL').value.trim(),
        // companyType already updated in state by multiselect
        typeOfProof: document.getElementById('qcEditPdmTypeOfProof') ? document.getElementById('qcEditPdmTypeOfProof').value : (pdm.typeOfProof || ''),
        description: document.getElementById('qcEditPdmDescription').value.trim(),
        comment: document.getElementById('qcEditPdmComment').value.trim()
    };


    // --- 1. Detect Changes for Auto-Error Assignment ---
    const originalPDM = qcSectionState.originalPDM;
    let autoErrors = [];
    const changesLog = [];

    if (originalPDM) {
        // A. Field Changes
        if (originalPDM.url !== pdmData.url) {
            changesLog.push(`URL Changed`);
            autoErrors.push(`QC Changed URL`);
        }

        // Array Compare for Company Type
        const oldCT = (originalPDM.companyType || []).slice().sort().join(',');
        const newCT = (pdmData.companyType || []).slice().sort().join(',');
        if (oldCT !== newCT) {
            changesLog.push(`Company Type Changed`);
            autoErrors.push(`QC Changed Company Type`);
        }

        if ((originalPDM.typeOfProof || '') !== (pdmData.typeOfProof || '')) {
            changesLog.push(`Type of Proof Changed`);
            autoErrors.push(`QC Changed Type of Proof`);
        }

        if (originalPDM.description !== pdmData.description) {
            changesLog.push(`Description Changed`); // Maybe avoid logging if only whitespace? (Already trimmed)
            autoErrors.push(`QC Changed Description`);
        }

        // Comment is QC internal, doesn't count as PDM error usually, but let's ignore it for error flagging.

        // B. Heading Changes (Removed/Added)
        const originalHeadings = originalPDM.headings || [];
        const newHeadings = pdmData.headings || [];

        let removedNames = [];
        let addedNames = [];

        // Headings Removed (Present in Old, Missing in New)
        const removedHeadings = originalHeadings.filter(h => !newHeadings.some(nh => nh.id === h.id));
        removedHeadings.forEach(h => {
            changesLog.push(`Removed Heading: ${h.name}`);
            removedNames.push(h.name);
        });

        // Headings Added (Missing in Old, Present in New)
        const addedHeadings = newHeadings.filter(nh => !originalHeadings.some(oh => oh.id === nh.id));
        addedHeadings.forEach(h => {
            changesLog.push(`Added Heading: ${h.name}`);
            addedNames.push(h.name);
        });

        // Push Generic Errors
        if (removedNames.length > 0) {
            autoErrors.push('QC Removed Heading');
        }
        if (addedNames.length > 0) {
            autoErrors.push('QC Added Heading');
        }
    }

    // --- 2. Prompt User ---
    let shouldLogErrors = false;
    if (changesLog.length > 0) {
        const confirmMsg =
            `You made the following changes:\n- ${changesLog.join('\n- ')}\n\n` +
            `Do you want to log these as QC Errors?`;

        shouldLogErrors = confirm(confirmMsg);
    }

    // --- 3. Update PDM State with Flags ---

    // Always mark as QC Edited if changes occurred
    if (changesLog.length > 0) {
        pdmData.isQCEdited = true;
    }

    // specific tracking for Description


    // If "Yes", assign errors
    if (shouldLogErrors) {
        pdmData.qcStatus = 'error';
        pdmData.rectificationStatus = 'Pending';
        pdmData.validationStatus = 'Pending';

        // Initialize feedback object if needed
        if (!pdmData.qcFeedback) {
            pdmData.qcFeedback = {
                errors: [],
                comment: pdmData.comment || '',
                timestamp: new Date().toISOString(),
                user: getQCCurrentUser()
            };
        } else {
            if (!pdmData.qcFeedback.errors) pdmData.qcFeedback.errors = [];
        }

        // Add auto errors
        autoErrors.forEach(err => {
            if (!pdmData.qcFeedback.errors.includes(err)) {
                pdmData.qcFeedback.errors.push(err);
            }
        });

        // Append Header Names to Comment (if any)
        // Check if we captured names in scope above? No, scope issue. 
        // Need to capture names in outer scope or re-calculate?
        // Let's re-calculate cleanly or use variables if we are in same scope.
        // We are inside 'if (originalPDM)' block above, so variables 'removedNames', 'addedNames' 
        // need to be declared outside if we want to access them here.
        // Wait, replace_chunk replaces the *entire* block including declarations? 
        // Ah, the replacement logic below re-does the block.
        // I need to make sure variables are accessible.

        // RE-PLAN: The 'ReplacementContent' covers lines 1093-1174.
        // 'if (shouldLogErrors)' is at 1148.
        // I can just check changesLog again or move variable declaration up.
        // Or simpler: Just append to comment RIGHT HERE if specific error types exist.

        // Re-deriving logic for comment update:
        const originalHeadings = (originalPDM ? originalPDM.headings : []) || [];
        const newHeadings = pdmData.headings || [];

        const removedH = originalHeadings.filter(h => !newHeadings.some(nh => nh.id === h.id));
        const addedH = newHeadings.filter(nh => !originalHeadings.some(oh => oh.id === nh.id));

        let commentUpdates = [];
        if (removedH.length > 0) commentUpdates.push(`Removed: ${removedH.map(h => h.name).join(', ')}`);
        if (addedH.length > 0) commentUpdates.push(`Added: ${addedH.map(h => h.name).join(', ')}`);

        if (commentUpdates.length > 0) {
            const extraComment = commentUpdates.join('; ');
            // Append to existing comment separator
            if (pdmData.qcFeedback.comment && pdmData.qcFeedback.comment !== '—') {
                pdmData.qcFeedback.comment += ` (${extraComment})`;
            } else {
                pdmData.qcFeedback.comment = extraComment;
            }
        }

        // Update timestamp/user on feedback
        pdmData.qcFeedback.timestamp = new Date().toISOString();
        pdmData.qcFeedback.user = getQCCurrentUser();
    }


    // --- 4. Handle Removed Headings (Return to Supported) ---
    // (Logic from previous implementation, kept intact)
    if (qcSectionState.originalPDM) {
        const originalHeadings = qcSectionState.originalPDM.headings || [];
        const newHeadings = pdmData.headings || [];
        const removedHeadings = originalHeadings.filter(h => !newHeadings.some(nh => nh.id === h.id));

        if (removedHeadings.length > 0 && typeof workspaceState !== 'undefined') {
            removedHeadings.forEach(h => {
                if (!workspaceState.supportedHeadingIds.includes(h.id)) {
                    workspaceState.supportedHeadingIds.push(h.id);
                }
            });
        }
    }

    // --- 5. Save ---
    const savedPdm = PdmUtils.savePDM(pdmData, workspaceState, getQCCurrentUser());

    if (!savedPdm) return;

    if (typeof HistoryManager !== 'undefined') {
        const actionType = pdm.id ? 'QC PDM Updated' : 'QC PDM Created';
        const detailMsg = pdm.id ? `Updated QC ${savedPdm.number}` : `Created New QC ${savedPdm.number}`;
        HistoryManager.addEntry(actionType, detailMsg, getQCCurrentUser());
    }

    if (pdm.id) {
        alert(`${savedPdm.number} updated successfully!`);
    } else {
        alert(`New ${savedPdm.number} created successfully!`);
    }

    // Refresh UI
    updateQCFamilyFilterOptions();
    renderQCPDMsList();
    if (typeof renderProductionPDMLibrary === 'function') {
        renderProductionPDMLibrary();
    }
    if (typeof renderQCHeadings === 'function') {
        renderQCHeadings();
    }

    saveCurrentWorkspaceData();

    qcSectionState.selectedPDM = workspaceState.savedPDMs.find(p => p.id === savedPdm.id);

    renderQCPDMView();

    qcSectionState.originalPDM = null;
    cancelQCPDMEdit();
}


function setupQCMultiSelect() {
    PdmUtils.MultiSelect.setup(
        'qcEditPdmCompanyTypeMultiSelect',
        PdmUtils.COMPANY_TYPE_OPTIONS,
        (selectedValues) => {
            // Update State
            if (qcSectionState.selectedPDM) {
                qcSectionState.selectedPDM.companyType = selectedValues;
            }
        }
    );
}

// Export functions
if (typeof window !== 'undefined') {
    window.initializeQCSection = initializeQCSection;
    window.selectQCPDM = selectQCPDM;
    window.refreshQCReviewData = refreshQCReviewData;
    window.editQCPDM = editQCPDM;
    window.deleteQCPDM = deleteQCPDM;
    window.saveQCPDMEdit = saveQCPDMEdit;
    window.cancelQCPDMEdit = cancelQCPDMEdit;
    window.removeHeadingFromQCEdit = removeHeadingFromQCEdit;
    window.closeQCPDMView = closeQCPDMView;
    window.renderQCHeadings = renderQCHeadings;
    window.createNewQCPDM = createNewQCPDM;
    window.renderQCPDMsList = renderQCPDMsList;
    window.clearQCHeadingsSearch = clearQCHeadingsSearch;
}
