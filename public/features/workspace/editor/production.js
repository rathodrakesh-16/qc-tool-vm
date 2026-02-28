// Function declarations for components in the Production (workspace) tab
// NOTE: productionState is now defined in state/productionState.js

import { workspaceState } from '../state/workspaceState.js';
import { productionState } from '../state/productionState.js';
import { addHeadingToRegistry, formatTimestampWithUser, getCurrentUser, getHeadingsFromRegistry, saveCurrentWorkspaceData } from '../workspace.js';
import { setupProductionFilterLogic, updateFamilyFilterDropdown, updateSectionFamilyFilter } from '../sharedComponents/filters.js';
import { PdmUtils } from '../sharedComponents/pdmUtils.js';
import { showSupportedLinkModal } from '../modals/familyAssignModal.js';
import { openHeadingDetailsModalById } from '../modals/headingDetailsModal.js';
import { HistoryManager } from '../modals/changeLogModal.js';
import { renderQCPDMsList, renderQCHeadings } from '../qc/qcReview.js';

// Function to initialize the Production tab

export function initializeEditorWorkspace() {
    setupEditorWorkspaceEventListeners();
    renderImportedHeadings();
    renderSupportedHeadings();
    updateFamilyFilterDropdown();
    renderProductionPDMLibrary();
    setupProductionResponsiveViews(); // Initialize responsive layout
    setupProductionMultiSelect(); // Initialize Multi-Select
    setupProductionReportInteractions(); // Initialize Production Report Tabs
}

export function setupProductionReportInteractions() {
    const errorTab = document.getElementById('prodRepErrorsTab');
    const familyTab = document.getElementById('prodRepFamilyTab');
    const existingTab = document.getElementById('prodRepExistingTab');

    if (errorTab) {
        errorTab.onclick = () => toggleProductionReportSection('errors');
    }
    if (familyTab) {
        familyTab.onclick = () => toggleProductionReportSection('family');
    }
    if (existingTab) {
        existingTab.onclick = () => toggleProductionReportSection('existing');
    }
}

export function toggleProductionReportSection(view) {
    const errorTab = document.getElementById('prodRepErrorsTab');
    const familyTab = document.getElementById('prodRepFamilyTab');
    const existingTab = document.getElementById('prodRepExistingTab');
    const errorContent = document.getElementById('productionReportProducedErrors');
    const familyContent = document.getElementById('productionReportFamilyContent');
    const existingContent = document.getElementById('productionReportExistingContent');

    // Remove all active states
    if (errorTab) errorTab.classList.remove('active');
    if (familyTab) familyTab.classList.remove('active');
    if (existingTab) existingTab.classList.remove('active');

    // Hide all content
    if (errorContent) errorContent.style.display = 'none';
    if (familyContent) familyContent.style.display = 'none';
    if (existingContent) existingContent.style.display = 'none';

    // Show selected view
    if (view === 'errors') {
        if (errorTab) errorTab.classList.add('active');
        if (errorContent) errorContent.style.display = 'block';
    } else if (view === 'existing') {
        if (existingTab) existingTab.classList.add('active');
        if (existingContent) existingContent.style.display = 'block';
    } else {
        if (familyTab) familyTab.classList.add('active');
        if (familyContent) familyContent.style.display = 'flex';
    }
}

function setupEditorWorkspaceEventListeners() {

    // Filter Logic is centralized in filters.js - Initialize it here if needed, 
    // but typically filters.js runs on DOMContentLoaded. 
    // However, since some elements might be dynamic or re-rendered, we can ensure hooks are set.
    if (typeof setupProductionFilterLogic === 'function') {
        setupProductionFilterLogic();
    }

    const importBtn = document.getElementById('importHeadingsBtn');
    if (importBtn) {
        importBtn.addEventListener('click', triggerFileInput);
    }

    const fileInput = document.getElementById('headingsFileInput');
    if (fileInput) {
        fileInput.addEventListener('change', handleFileSelection);
    }

    const historyBtn = document.getElementById('importHistoryBtn');
    if (historyBtn) {
        historyBtn.addEventListener('click', showImportHistory);
    }

    const savePDMBtn = document.getElementById('savePDMBtn');
    if (savePDMBtn) {
        savePDMBtn.addEventListener('click', savePDM);
    }

    const clearPDMBtn = document.getElementById('clearPDMBtn');
    if (clearPDMBtn) {
        clearPDMBtn.addEventListener('click', clearCurrentPDM);
    }

    const coProBtn = document.getElementById('coProBtn');
    if (coProBtn) {
        coProBtn.addEventListener('click', toggleCoProMode);
    }

    const urlInput = document.getElementById('pdmURL');
    const descInput = document.getElementById('pdmDescription');
    const companyTypeSelect = document.getElementById('pdmCompanyType');
    const commentInput = document.getElementById('pdmComment');

    if (urlInput) {
        urlInput.addEventListener('input', (e) => {
            workspaceState.currentPDM.url = e.target.value;
            updatePDMBuilder();
        });
    }

    if (descInput) {
        descInput.addEventListener('input', (e) => {
            workspaceState.currentPDM.description = e.target.value;
            updatePDMBuilder();
        });
    }

    // Removed old companyTypeSelect listener as it is now handled by custom multi-select logic

    if (commentInput) {
        commentInput.addEventListener('input', (e) => {
            workspaceState.currentPDM.comment = e.target.value;
        });
    }

    const typeOfProofSelect = document.getElementById('pdmTypeOfProof');
    if (typeOfProofSelect) {
        typeOfProofSelect.addEventListener('change', (e) => {
            workspaceState.currentPDM.typeOfProof = e.target.value;
        });
    }

    const addSelectedBtn = document.getElementById('addSelectedToSupportedBtn');
    if (addSelectedBtn) {
        addSelectedBtn.addEventListener('click', addSelectedToSupported);
    }

    const groupSelectedBtn = document.getElementById('groupSelectedHeadingsBtn');
    if (groupSelectedBtn) {
        groupSelectedBtn.addEventListener('click', groupSelectedHeadings);
    }

    const removeSelectedBtn = document.getElementById('removeSelectedSupportedBtn');
    if (removeSelectedBtn) {
        removeSelectedBtn.addEventListener('click', removeSelectedFromSupported);
    }

    initializePDMDescriptionCounter();
}


function triggerFileInput() {
    const fileInput = document.getElementById('headingsFileInput');
    if (fileInput) {
        fileInput.click();
    }
}


// Shared helper functions (kept here as they are directly used by multiple elements)

// NEW: Update Headings Status Based on Existing Headings
export function updateHeadingsStatus() {
    // Update all headings in registry
    Object.values(workspaceState.headingsRegistry).forEach(heading => {
        const existingHeading = workspaceState.existingHeadings.find(eh => eh.id === heading.id);
        if (existingHeading) {
            heading.status = determineStatus(existingHeading.rankPoints);
            heading.rankPoints = existingHeading.rankPoints;
        } else {
            heading.status = 'additional';
            heading.rankPoints = null;
        }
    });

    // Update current PDM headings
    workspaceState.currentPDM.headings.forEach(heading => {
        const existingHeading = workspaceState.existingHeadings.find(eh => eh.id === heading.id);
        if (existingHeading) {
            heading.status = determineStatus(existingHeading.rankPoints);
            heading.rankPoints = existingHeading.rankPoints;
        } else {
            heading.status = 'additional';
            heading.rankPoints = null;
        }
    });

    // Update saved PDMs headings
    workspaceState.savedPDMs.forEach(pdm => {
        pdm.headings.forEach(heading => {
            const existingHeading = workspaceState.existingHeadings.find(eh => eh.id === heading.id);
            if (existingHeading) {
                heading.status = determineStatus(existingHeading.rankPoints);
                heading.rankPoints = existingHeading.rankPoints;
            } else {
                heading.status = 'additional';
                heading.rankPoints = null;
            }
        });
    });
}


function determineStatus(rankPoints) {
    if (rankPoints === null || rankPoints === undefined) {
        return 'additional';
    }

    // Convert to string and check
    const rankStr = String(rankPoints).trim();

    // Treat empty string as 'additional' (no rank data)
    if (rankStr === '') {
        return 'additional';
    }

    // If it contains '$', it is automatically ranked
    if (rankStr.includes('$')) {
        return 'ranked';
    }

    // If rank is 0, it's "existing"
    if (rankStr === '0') {
        return 'existing';
    }

    // If rank is anything else (implicitly not 0 and not empty), it's "ranked"
    return 'ranked';
}


function handleFileSelection(e) {
    const file = e.target.files[0];
    if (!file) return;

    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!['xlsx', 'xls', 'csv'].includes(fileExtension)) {
        alert('Please upload a valid Excel file (.xlsx, .xls) or CSV file (.csv)');
        e.target.value = '';
        return;
    }

    // Show uploading state
    const importBtn = document.getElementById('importHeadingsBtn');
    if (importBtn) {
        importBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        importBtn.disabled = true;
    }

    window.tempFileName = file.name;

    const reader = new FileReader();
    reader.onload = function (event) {
        try {
            const data = new Uint8Array(event.target.result);
            // Assuming XLSX.read is globally available via the script tag in index.html
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

            if (jsonData.length < 2) {
                alert('The file appears to be empty or has no data rows.');
                return;
            }

            processImportedData(jsonData);

        } catch (error) {
            alert('Failed to read the file. Please try again.');
        } finally {
            // Always reset button + allow re-upload
            if (importBtn) {
                importBtn.innerHTML = '<i class="fas fa-plus"></i>';
                importBtn.disabled = false;
            }
            e.target.value = ''; // Critical: allows same file again
        }
    };

    reader.readAsArrayBuffer(file);
}

function processImportedData(data) {
    const rows = data.slice(1);

    if (rows.length === 0) {
        alert('No data found in the file.');
        return;
    }

    const headings = [];
    const familiesSet = new Set();

    rows.forEach((row, index) => {
        // Updated logic to match new column structure:
        // 0: ID, 1: Heading, 2: Heading Type, 3: Status, 4: Updated At, 
        // 5: Definition, 6: Aliases, 7: Family, 8: Category, 9: Companies

        if (row.length < 3) return; // Basic validation

        const id = row[0] ? String(row[0]).trim() : '';
        const name = row[1] ? String(row[1]).trim() : '';

        const headingType = row[2] ? String(row[2]).trim() : '';
        const status = row[3] ? String(row[3]).trim() : '';
        const updatedAt = row[4] ? String(row[4]).trim() : '';
        const definition = row[5] ? String(row[5]).trim() : '';
        const aliases = row[6] ? String(row[6]).trim() : '';

        const familyString = row[7] ? String(row[7]).trim() : '';

        const category = row[8] ? String(row[8]).trim() : '';
        const companies = row[9] ? String(row[9]).trim() : '';

        if (!id || !name) return;

        const families = familyString.split(',').map(f => f.trim()).filter(f => f);
        families.forEach(family => familiesSet.add(family));

        headings.push({
            id: id,
            name: name,
            families: families,
            originalRow: index + 2,
            // Store extra data
            headingType: headingType,
            originalStatus: status,
            updatedAt: updatedAt,
            definition: definition,
            aliases: aliases,
            category: category,
            companies: companies
        });
    });

    if (headings.length === 0) {
        alert('No valid headings found in the file. Please ensure the file has ID, Heading Name, and Family columns.');
        return;
    }

    const uniqueFamilies = Array.from(familiesSet).sort();

    if (uniqueFamilies.length === 0) {
        alert('No families found in the file. Please ensure the Family column has data.');
        return;
    }

    showFamilySelectionModal(headings, uniqueFamilies);
}

function showFamilySelectionModal(headings, families) {
    const overlay = document.createElement('div');
    overlay.className = 'family-modal-overlay';
    overlay.id = 'familyModalOverlay';

    const modal = document.createElement('div');
    modal.className = 'family-modal';

    modal.innerHTML = `
        <div class="family-modal-header">
            <h2 class="family-modal-title">Import Context</h2>
            <p class="family-modal-subtitle">Track this import under:</p>
        </div>

        <div class="family-list" id="familyListContainer">
            ${families.map((family, index) => `
                <label class="family-option" for="family-${index}">
                    <input type="radio" name="family" id="family-${index}" value="${family}">
                    <span class="family-option-label">${family}</span>
                </label>
            `).join('')}
        </div>

        <div class="family-modal-note">
            <i class="fas fa-info-circle"></i>
            <span>Note: For tracking purposes only. Headings will belong to all families found in the Excel file.</span>
        </div>

        <div class="family-modal-actions">
            <button class="family-modal-btn family-modal-btn-secondary" id="cancelFamilyBtn" type="button">Cancel</button>
            <button class="family-modal-btn family-modal-btn-primary" id="confirmFamilyBtn" type="button" disabled>Continue</button>
        </div>
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    window.tempImportedHeadings = headings;

    const radioButtons = modal.querySelectorAll('input[type="radio"]');
    const confirmBtn = modal.querySelector('#confirmFamilyBtn');
    const cancelBtn = modal.querySelector('#cancelFamilyBtn');

    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeFamilyModal);
    }

    if (confirmBtn) {
        confirmBtn.addEventListener('click', confirmFamilySelection);
    }

    radioButtons.forEach(radio => {
        radio.addEventListener('change', () => {
            const options = modal.querySelectorAll('.family-option');
            options.forEach(opt => opt.classList.remove('selected'));

            if (radio.checked) {
                radio.closest('.family-option').classList.add('selected');
                confirmBtn.disabled = false;
            }
        });
    });
}

function closeFamilyModal() {
    const overlay = document.getElementById('familyModalOverlay');
    if (overlay) {
        overlay.remove();
    }
    delete window.tempImportedHeadings;
}

function confirmFamilySelection() {
    const selectedRadio = document.querySelector('input[name="family"]:checked');

    if (!selectedRadio) {
        alert('Please select a family');
        return;
    }

    const contextFamily = selectedRadio.value; // This is now just for audit trail
    const headings = window.tempImportedHeadings;
    const currentUser = getCurrentUser();

    if (!headings) {
        alert('Error: No headings data found');
        closeFamilyModal();
        return;
    }

    const newHeadingIds = [];
    const allFamilies = new Set(workspaceState.availableFamilies || []);

    // Process each heading
    headings.forEach(heading => {
        const existingHeading = workspaceState.headingsRegistry[heading.id];

        if (existingHeading) {
            // DUPLICATE DETECTED: Merge families
            const mergedFamilies = [...new Set([...existingHeading.families, ...heading.families])];
            existingHeading.families = mergedFamilies;

            // Track all families
            mergedFamilies.forEach(f => allFamilies.add(f));

        } else {
            // NEW HEADING: Add to registry
            const newHeading = {
                id: heading.id,
                name: heading.name,
                families: heading.families, // Array of all families from Excel
                groupingFamily: null, // Will be set when moving to Supported
                // Carry over extra fields
                headingType: heading.headingType,
                originalStatus: heading.originalStatus,
                updatedAt: heading.updatedAt,
                definition: heading.definition,
                aliases: heading.aliases,
                category: heading.category,
                companies: heading.companies
            };

            // Check if exists in existing headings data
            const existingData = workspaceState.existingHeadings.find(eh => eh.id === heading.id);
            if (existingData) {
                newHeading.status = determineStatus(existingData.rankPoints);
                newHeading.rankPoints = existingData.rankPoints;
            } else {
                newHeading.status = 'additional';
                newHeading.rankPoints = null;
            }

            // Add to registry
            addHeadingToRegistry(newHeading);

            // Track all families
            heading.families.forEach(f => allFamilies.add(f));
        }

        // Check if heading is already in any workflow stage
        const isInSupported = workspaceState.supportedHeadingIds.includes(heading.id);
        const isInCurrentPDM = workspaceState.currentPDM.headings.some(h => h.id === heading.id);
        const isInSavedPDM = workspaceState.savedPDMs.some(pdm =>
            pdm.headings && pdm.headings.some(h => h.id === heading.id)
        );
        const isInImported = workspaceState.importedHeadingIds.includes(heading.id);

        // Only add to imported if not already in any workflow stage
        if (!isInSupported && !isInCurrentPDM && !isInSavedPDM && !isInImported) {
            workspaceState.importedHeadingIds.push(heading.id);
            newHeadingIds.push(heading.id);
        }
    });

    // Update available families
    workspaceState.availableFamilies = Array.from(allFamilies).sort();

    // Create import history record (audit trail)
    const importRecord = {
        id: `IMPORT-${Date.now()}`,
        contextFamily: contextFamily, // NEW: renamed from 'family'
        headingIds: newHeadingIds, // NEW: store IDs only
        headingsCount: headings.length,
        importedAt: new Date().toISOString(),
        importedBy: currentUser,
        fileName: window.tempFileName || 'Unknown File'
    };

    workspaceState.importHistory.push(importRecord);

    // Save data
    saveCurrentWorkspaceData();

    // Update UI
    updateFamilyFilterDropdown();
    setTimeout(() => {
        updateFamilyFilterDropdown();
    }, 50);
    renderImportedHeadings();
    closeFamilyModal();

    delete window.tempImportedHeadings;
    delete window.tempFileName;

    alert(`Successfully imported ${headings.length} headings with ${workspaceState.availableFamilies.length} families. Grouping family will be set when adding to Supported.`);
}

// ============================================
// SUPPORTED LINK MODAL FUNCTIONS
// ============================================
// Modal functions moved to familyAssignModal.js
// Legacy wrapper functions are maintained in familyAssignModal.js for backward compatibility

// --- New Selection Logic functions ---


function toggleImportSelection(headingId) {
    if (productionState.selectedImportIds.has(headingId)) {
        productionState.selectedImportIds.delete(headingId);
    } else {
        productionState.selectedImportIds.add(headingId);
    }
    renderImportedHeadings();
}

function toggleSupportedSelection(headingId) {
    if (productionState.selectedSupportedIds.has(headingId)) {
        productionState.selectedSupportedIds.delete(headingId);
    } else {
        productionState.selectedSupportedIds.add(headingId);
    }
    renderSupportedHeadings();
}

function addSelectedToSupported() {
    if (productionState.selectedImportIds.size === 0) {
        alert('Please select at least one heading to add.');
        return;
    }

    const selectedIds = Array.from(productionState.selectedImportIds);
    const headingsToMove = getHeadingsFromRegistry(selectedIds);

    if (headingsToMove.length === 0) {
        alert('No valid headings found to add.');
        return;
    }

    // Show combined modal (supported link + grouping family)
    showSupportedLinkModal(headingsToMove);
}

function groupSelectedHeadings() {
    if (productionState.selectedSupportedIds.size === 0) {
        alert('Please select at least one heading to group.');
        return;
    }

    const currentCount = workspaceState.currentPDM.headings.length;
    const maxHeadings = 8;
    const selectedCount = productionState.selectedSupportedIds.size;

    if (currentCount + selectedCount > maxHeadings) {
        alert(`Cannot add ${selectedCount} headings. Maximum ${maxHeadings} headings allowed per PDM (Current: ${currentCount}).`);
        return;
    }

    const selectedIds = Array.from(productionState.selectedSupportedIds);
    const headingsToGroup = getHeadingsFromRegistry(selectedIds);

    // Remove from supported list
    workspaceState.supportedHeadingIds = workspaceState.supportedHeadingIds.filter(id => !selectedIds.includes(id));

    // Add to PDM
    headingsToGroup.forEach(heading => {
        workspaceState.currentPDM.headings.push(heading);
    });

    // Clear selection
    productionState.selectedSupportedIds.clear();

    renderSupportedHeadings();
    updatePDMBuilder();

    const groupingSection = document.querySelector('.grouping-section');
    if (groupingSection) {
        groupingSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

function removeSelectedFromSupported() {
    if (productionState.selectedSupportedIds.size === 0) {
        alert('Please select at least one heading to remove.');
        return;
    }

    const selectedIds = Array.from(productionState.selectedSupportedIds);

    // Remove from supportedHeadingIds
    workspaceState.supportedHeadingIds = workspaceState.supportedHeadingIds.filter(id => !selectedIds.includes(id));

    // Add back to importedHeadingIds if not present
    selectedIds.forEach(id => {
        if (!workspaceState.importedHeadingIds.includes(id)) {
            workspaceState.importedHeadingIds.push(id);
        }
    });

    // Clear selection
    productionState.selectedSupportedIds.clear();

    renderSupportedHeadings();
    renderImportedHeadings();
}



// UPDATED: Render Imported Headings with Checkbox and Status Badge
export function renderImportedHeadings() {
    const container = document.getElementById('importedHeadingsList');
    if (!container) return;

    // Get headings from registry using importedHeadingIds
    let allHeadings = getHeadingsFromRegistry(workspaceState.importedHeadingIds);

    // Family filter
    let filteredHeadings = allHeadings;
    if (workspaceState.selectedFamily && workspaceState.selectedFamily !== 'all') {
        filteredHeadings = allHeadings.filter(h =>
            h.families && h.families.includes(workspaceState.selectedFamily)
        );
    }

    // Status filter
    const statusFilter = workspaceState.selectedImportStatus || 'all';
    if (statusFilter !== 'all') {
        if (statusFilter === 'additional') {
            filteredHeadings = filteredHeadings.filter(h => h.status === 'additional');
        } else if (statusFilter === 'ranked') {
            filteredHeadings = filteredHeadings.filter(h => h.status === 'ranked');
        } else if (statusFilter === 'existing') {
            filteredHeadings = filteredHeadings.filter(h => h.status === 'existing');
        } else {
            filteredHeadings = filteredHeadings.filter(h => h.status === statusFilter);
        }
    }

    // Search filter
    if (workspaceState.searchQuery) {
        const query = workspaceState.searchQuery.toLowerCase();
        filteredHeadings = filteredHeadings.filter(h =>
            h.id.toLowerCase().includes(query) ||
            h.name.toLowerCase().includes(query)
        );
    }

    // Update counter
    const count = document.getElementById('importCount');
    if (count) {
        count.textContent = `${filteredHeadings.length} heading${filteredHeadings.length !== 1 ? 's' : ''}`;
    }

    // Empty state
    if (filteredHeadings.length === 0) {
        const emptyMessage = workspaceState.searchQuery
            ? `No headings match "${workspaceState.searchQuery}"`
            : (allHeadings.length === 0
                ? 'Import a file to see headings here'
                : 'No headings match filter criteria');

        container.innerHTML = `<p class="empty-placeholder">${emptyMessage}</p>`;
        container.classList.add('empty');
        return;
    }

    // Render headings (no badges - users can see families via filter or details modal)
    container.classList.remove('empty');
    container.innerHTML = filteredHeadings.map(heading => {
        const isSelected = productionState.selectedImportIds.has(heading.id);

        return `
        <div class="imported-heading-item ${isSelected ? 'selected' : ''}" data-heading-id="${heading.id}">
            <div class="imported-heading-info">
                ${PdmUtils.getStatusBadge(heading)}
                <span class="imported-heading-name">${heading.name}</span>
                <i class="fas fa-info-circle heading-info-icon import-heading-details-trigger"
                   style="margin-left: 8px; color: #9ca3af; cursor: pointer;"
                   title="View Details"
                   data-heading-id="${heading.id}"></i>
            </div>
        </div>
    `}).join('');

    container.querySelectorAll('.imported-heading-item[data-heading-id]').forEach(item => {
        item.addEventListener('click', () => {
            const headingId = item.getAttribute('data-heading-id');
            if (headingId) {
                toggleImportSelection(headingId);
            }
        });
    });

    container.querySelectorAll('.import-heading-details-trigger[data-heading-id]').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const headingId = icon.getAttribute('data-heading-id');
            if (headingId) {
                openHeadingDetailsModalById(headingId);
            }
        });
    });

    renderImportMiniView();
}


// ============================================
// UPDATE SUPPORTED LINK FILTER
// ============================================

function updateSupportedLinkFilter() {
    const linkFilter = document.getElementById('supportedLinkFilter');
    if (!linkFilter) return;

    const currentVal = linkFilter.value;
    linkFilter.innerHTML = '<option value="all">All Links</option>';

    const supportedHeadings = getHeadingsFromRegistry(workspaceState.supportedHeadingIds);
    if (supportedHeadings.length === 0) {
        return;
    }

    // Get unique links
    const uniqueLinks = new Set();
    supportedHeadings.forEach(heading => {
        const link = heading.supportedLink || 'No Link';
        uniqueLinks.add(link);
    });

    // Sort links (put "No Link" and "Legacy - No Link" at the end)
    const sortedLinks = Array.from(uniqueLinks).sort((a, b) => {
        if (a.includes('No Link') || a.includes('Legacy')) return 1;
        if (b.includes('No Link') || b.includes('Legacy')) return -1;
        return a.localeCompare(b);
    });

    // Add options
    sortedLinks.forEach(link => {
        const option = document.createElement('option');
        option.value = link;
        option.textContent = link;
        linkFilter.appendChild(option);
    });

    // Restore selection if possible
    if (currentVal && (currentVal === 'all' || uniqueLinks.has(currentVal))) {
        linkFilter.value = currentVal;
    } else {
        linkFilter.value = 'all';
    }
}

// ============================================
// GROUP HEADINGS BY SUPPORTED LINK
// ============================================

function groupHeadingsByLink(headings) {
    const groups = {};

    headings.forEach(heading => {
        const link = heading.supportedLink || 'No Link';
        if (!groups[link]) {
            groups[link] = {
                link: link,
                headings: []
            };
        }
        groups[link].headings.push(heading);
    });

    return Object.values(groups);
}

// UPDATED: Render Supported Headings with Checkbox and Status Badge
export function renderSupportedHeadings() {
    // Get headings from registry using supportedHeadingIds
    const allHeadings = getHeadingsFromRegistry(workspaceState.supportedHeadingIds);

    // Update Filter Options Dynamically
    if (typeof updateSectionFamilyFilter === 'function') {
        updateSectionFamilyFilter('supportedFamilyFilter', allHeadings, 'families');
    }

    // Update Link Filter Options
    updateSupportedLinkFilter();

    // Toggle Filter Button Visibility
    const filterBtn = document.getElementById('supportedFilterBtn');
    if (filterBtn) {
        filterBtn.style.display = allHeadings.length > 0 ? 'block' : 'none';
        if (filterBtn.style.display === 'none') {
            const dialog = document.getElementById('supportedFilterDialog');
            if (dialog) dialog.classList.remove('visible');
        }
    }

    const container = document.getElementById('supportedHeadingsList');
    if (!container) return;

    // Family filter (check families array)
    let filteredHeadings = allHeadings;
    if (workspaceState.selectedSupportedFamily && workspaceState.selectedSupportedFamily !== 'all') {
        filteredHeadings = allHeadings.filter(h =>
            h.families && h.families.includes(workspaceState.selectedSupportedFamily)
        );
    }

    // Filter by Supported Link
    if (productionState.selectedSupportedLink && productionState.selectedSupportedLink !== 'all') {
        filteredHeadings = filteredHeadings.filter(h => {
            const headingLink = h.supportedLink || 'No Link';
            return headingLink === productionState.selectedSupportedLink;
        });
    }

    // Filter by Search Query
    if (productionState.supportedSearchQuery) {
        const query = productionState.supportedSearchQuery.toLowerCase();
        filteredHeadings = filteredHeadings.filter(h =>
            h.id.toLowerCase().includes(query) ||
            h.name.toLowerCase().includes(query)
        );
    }

    const count = document.getElementById('supportedCount');
    if (count) {
        count.textContent = `${filteredHeadings.length} heading${filteredHeadings.length !== 1 ? 's' : ''}`;
    }

    if (filteredHeadings.length === 0) {
        let emptyMessage;
        if (productionState.supportedSearchQuery) {
            emptyMessage = `No headings match "${productionState.supportedSearchQuery}"`;
        } else if (workspaceState.selectedSupportedFamily !== 'all') {
            emptyMessage = 'No supported headings found for selected family';
        } else {
            emptyMessage = 'Select headings from Import section and click Add to move them here';
        }

        container.innerHTML = `<p class="empty-placeholder">${emptyMessage}</p>`;
        container.classList.add('empty');
        return;
    }

    container.classList.remove('empty');

    // GROUP BY SUPPORTED LINK
    const groupedByLink = groupHeadingsByLink(filteredHeadings);

    container.innerHTML = groupedByLink.map(group => {
        const headingsHTML = group.headings.map(heading => {
            const isSelected = productionState.selectedSupportedIds.has(heading.id);

            return `
                <div class="supported-heading-item ${isSelected ? 'selected' : ''}" data-heading-id="${heading.id}">
                    <div class="supported-heading-info">
                        ${PdmUtils.getStatusBadge(heading)}
                        <span class="supported-heading-name">${heading.name}</span>
                        <i class="fas fa-info-circle heading-info-icon supported-heading-details-trigger"
                           style="margin-left: 8px; color: #9ca3af; cursor: pointer;"
                           title="View Details"
                           data-heading-id="${heading.id}"></i>
                    </div>
                </div>
            `;
        }).join('');

        return `
            <div class="supported-link-group">
                <div class="supported-link-header">
                    <a href="${group.link}" target="_blank" class="supported-link-url" title="${group.link}">${group.link}</a>
                    <span class="supported-link-count">${group.headings.length}</span>
                </div>
                <div class="supported-link-headings">
                    ${headingsHTML}
                </div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.supported-heading-item[data-heading-id]').forEach(item => {
        item.addEventListener('click', () => {
            const headingId = item.getAttribute('data-heading-id');
            if (headingId) {
                toggleSupportedSelection(headingId);
            }
        });
    });

    container.querySelectorAll('.supported-heading-details-trigger[data-heading-id]').forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            const headingId = icon.getAttribute('data-heading-id');
            if (headingId) {
                openHeadingDetailsModalById(headingId);
            }
        });
    });
}

// function removeSupportedHeading simplified into bulk action removeSelectedFromSupported
// Leaving this empty or reusing helper functions if needed.
// But we should remove the old function if it's no longer used.
// The code below is deleting the old 'removeSupportedHeading' which is no longer called by UI.

function countWords(text) {
    if (!text || text.trim() === '') return 0;
    // Simple word count: split by any whitespace group
    return text.trim().split(/\s+/).length;
}

// UPDATED: Update PDM Builder with Status Badge
export function updatePDMBuilder() {
    const dropZone = document.getElementById('pdmDropZone');
    const counter = document.getElementById('pdmCounter');
    const savePDMBtn = document.getElementById('savePDMBtn');
    const pdmBuilder = document.querySelector('.pdm-builder');

    if (!dropZone || !counter) return;

    const headingsCount = workspaceState.currentPDM.headings.length;
    const description = workspaceState.currentPDM.description || '';
    const wordCount = countWords(description);

    counter.textContent = `${headingsCount} / 8 headings`;
    counter.classList.toggle('warning', headingsCount > 8);

    // Find or create word counter element
    let wordCounter = document.getElementById('pdmWordCounter');
    if (wordCounter) {
        wordCounter.textContent = `${wordCount} word${wordCount !== 1 ? 's' : ''}`;
    }

    if (headingsCount > 0) {
        pdmBuilder.classList.add('has-items');
    } else {
        pdmBuilder.classList.remove('has-items');
    }

    if (headingsCount === 0) {
        dropZone.innerHTML = '<p class="empty-placeholder">Click + button on headings from Supported section to add them here</p>';
        dropZone.classList.add('empty');
    } else {
        dropZone.classList.remove('empty');
        dropZone.innerHTML = workspaceState.currentPDM.headings.map(heading => `
            <div class="grouped-heading">
                <div class="grouped-heading-info">
                    ${PdmUtils.getStatusBadge(heading)}
                    <span class="grouped-heading-name">${heading.name}</span>
                </div>
                <button type="button" class="remove-heading-btn" data-heading-id="${heading.id}">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `).join('');

        dropZone.querySelectorAll('.remove-heading-btn[data-heading-id]').forEach(button => {
            button.addEventListener('click', () => {
                const headingId = button.getAttribute('data-heading-id');
                if (headingId) {
                    removeHeadingFromPDM(headingId);
                }
            });
        });
    }

    // Validation: 1-8 headings, URL, Company Type, Description required. Comment is optional.
    // In CoPro mode, headings and URL are skiped
    const isCoPro = productionState.isCoProMode;
    const canSave = (isCoPro || (headingsCount >= 1 && headingsCount <= 8)) &&
        (isCoPro || workspaceState.currentPDM.url.trim() !== '') &&
        (Array.isArray(workspaceState.currentPDM.companyType) ? workspaceState.currentPDM.companyType.length > 0 : !!workspaceState.currentPDM.companyType) &&
        workspaceState.currentPDM.description.trim() !== '';

    if (savePDMBtn) {
        savePDMBtn.disabled = !canSave;
    }
}

export function toggleCoProMode() {
    productionState.isCoProMode = !productionState.isCoProMode;
    const coProBtn = document.getElementById('coProBtn');
    const pdmBuilder = document.querySelector('.pdm-builder');

    if (productionState.isCoProMode) {
        coProBtn.classList.add('active');
        pdmBuilder.classList.add('copro-mode');

        // Clear any existing headings if any
        if (workspaceState.currentPDM.headings.length > 0) {
            workspaceState.currentPDM.headings.forEach(heading => {
                if (!workspaceState.supportedHeadingIds.includes(heading.id)) {
                    workspaceState.supportedHeadingIds.push(heading.id);
                }
            });
            workspaceState.currentPDM.headings = [];
        }
        workspaceState.currentPDM.url = '';
        const urlInput = document.getElementById('pdmURL');
        if (urlInput) urlInput.value = '';

        renderSupportedHeadings();
    } else {
        coProBtn.classList.remove('active');
        pdmBuilder.classList.remove('copro-mode');
    }

    updatePDMBuilder();
}


function initializePDMDescriptionCounter() {
    const descInput = document.getElementById('pdmDescription');
    if (!descInput) return;

    const inputGroup = descInput.closest('.pdm-input-group');
    if (!inputGroup) return;

    // Prevent re-initialization if header already exists
    if (inputGroup.querySelector('.pdm-input-group-header')) return;

    const label = inputGroup.querySelector('.pdm-input-label');
    if (!label) return;

    const header = document.createElement('div');
    header.className = 'pdm-input-group-header';

    // Move label into the new header
    label.remove();
    header.appendChild(label);

    const wordCounter = document.createElement('span');
    wordCounter.id = 'pdmWordCounter';
    wordCounter.className = 'pdm-word-counter';
    wordCounter.textContent = '0 words';
    header.appendChild(wordCounter);

    // Insert header before the textarea
    inputGroup.insertBefore(header, inputGroup.firstChild);
}

export function removeHeadingFromPDM(headingId) {
    const headingIndex = workspaceState.currentPDM.headings.findIndex(h => h.id === headingId);

    if (headingIndex > -1) {
        const [heading] = workspaceState.currentPDM.headings.splice(headingIndex, 1);

        // Move it back to Supported Headings, checking for duplicates just in case
        if (!workspaceState.supportedHeadingIds.includes(heading.id)) {
            workspaceState.supportedHeadingIds.push(heading.id);
        }
    }

    updatePDMBuilder();
    renderSupportedHeadings();
}

export function savePDM() {
    // Use PdmUtils.savePDM
    const pdmData = {
        ...workspaceState.currentPDM,
        isCoPro: productionState.isCoProMode
    };

    const savedPdm = PdmUtils.savePDM(pdmData, workspaceState, getCurrentUser());
    if (!savedPdm) return; // Validation failed (alert handled in utils)

    // Clear builder (pass true to indicate saved)
    clearCurrentPDM(true);

    // Force extensive UI refresh
    if (typeof updateHeadingsStatus === 'function') updateHeadingsStatus();
    if (typeof renderImportedHeadings === 'function') renderImportedHeadings();
    if (typeof renderSupportedHeadings === 'function') renderSupportedHeadings();
    if (typeof updateProductionPDMFamilyFilter === 'function') updateProductionPDMFamilyFilter();
    if (typeof renderProductionPDMLibrary === 'function') renderProductionPDMLibrary();

    // Sync with QC if it exists
    if (typeof renderQCPDMsList === 'function') {
        renderQCPDMsList();
    }
    if (typeof renderQCHeadings === 'function') {
        renderQCHeadings();
    }

    // Save to storage immediately
    saveCurrentWorkspaceData();

    // History Log
    if (typeof HistoryManager !== 'undefined') {
        const actionType = pdmData.id ? 'PDM Updated' : 'PDM Created';
        const detailMsg = pdmData.id ? `Updated ${savedPdm.number}` : `Created new ${savedPdm.number}`;
        HistoryManager.addEntry(actionType, detailMsg, getCurrentUser());
    }

    alert(`${savedPdm.number} saved successfully!`);
}

// isSaved parameter indicates if we are clearing because of a successful save (true) or an abort/clear (false)
function clearCurrentPDM(isSaved = false) {
    if (productionState.isCoProMode) {
        toggleCoProMode(); // Turn off CoPro mode
    }
    const wasEditing = !!workspaceState.currentPDM.id;

    // Only move headings back to Supported List if we are clearing WITHOUT saving (abort/cancel)
    // If isSaved is true, the headings are now part of a PDM and should NOT go back to supported
    if (!isSaved) {
        workspaceState.currentPDM.headings.forEach(heading => {
            if (!workspaceState.supportedHeadingIds.includes(heading.id)) {
                workspaceState.supportedHeadingIds.push(heading.id);
            }
        });
    }

    workspaceState.currentPDM = {
        headings: [],
        url: '',
        description: '',
        companyType: [], // Initialize as empty array
        typeOfProof: '', // Initialize Type of Proof field
        comment: '',
        id: null,
        number: null,
        createdAt: null,
        createdBy: null,
        uploaded: null
    };

    const urlInput = document.getElementById('pdmURL');
    const descInput = document.getElementById('pdmDescription');
    const companyTypeSelect = document.getElementById('pdmCompanyType');
    const commentInput = document.getElementById('pdmComment');

    if (urlInput) urlInput.value = '';
    if (descInput) descInput.value = '';
    // if (companyTypeSelect) companyTypeSelect.value = ''; // Handled by updateMultiSelectDisplay below
    if (commentInput) commentInput.value = '';

    const typeOfProofInput = document.getElementById('pdmTypeOfProof');
    if (typeOfProofInput) typeOfProofInput.value = '';

    // Reset Multi-Select
    const msContainer = document.getElementById('pdmCompanyTypeMultiSelect');
    if (msContainer) {
        updateMultiSelectDisplay(msContainer, []);
    }

    updatePDMBuilder();
    renderSupportedHeadings();

    // If we were editing an existing PDM and we cleared WITHOUT saving (aborted), 
    // it effectively deletes that PDM. We must renumber the remaining ones.
    if (wasEditing && !isSaved) {
        renumberPDMs();
        renderProductionPDMLibrary();
    }
}

// NEW: Helper to renumber all saved PDMs sequentially
// NEW: Helper to renumber all saved PDMs sequentially
function renumberPDMs() {
    PdmUtils.renumberPDMs(workspaceState.savedPDMs);
}

export function editPDM(pdmId) {
    const pdm = workspaceState.savedPDMs.find(p => p.id === pdmId);
    if (!pdm) return;

    // Clear the current PDM (triggers renumber if we were editing another one)
    clearCurrentPDM();

    // Prepare data (legacy fixes)
    const preparedPdm = PdmUtils.prepareEditData(pdm);
    const isCoPro = pdm.isCoPro || pdm.id?.startsWith('COPRO-');

    if (isCoPro && !productionState.isCoProMode) {
        toggleCoProMode();
    } else if (!isCoPro && productionState.isCoProMode) {
        toggleCoProMode();
    }

    // Load the selected PDM into the currentPDM state including ID and metadata
    workspaceState.currentPDM = {
        headings: [...preparedPdm.headings],
        url: preparedPdm.url,
        description: preparedPdm.description,
        companyType: preparedPdm.companyType,
        typeOfProof: pdm.typeOfProof || '', // Load Type of Proof field
        comment: pdm.comment || '',
        isCoPro: isCoPro,
        // Metadata for preserving identity
        id: pdm.id,
        number: pdm.number,
        createdAt: pdm.createdAt,
        createdBy: pdm.createdBy,
        uploaded: pdm.uploaded
    };

    // Update the UI input fields
    const urlInput = document.getElementById('pdmURL');
    if (urlInput) urlInput.value = preparedPdm.url || '';

    document.getElementById('pdmDescription').value = preparedPdm.description;

    if (document.getElementById('pdmTypeOfProof')) {
        document.getElementById('pdmTypeOfProof').value = pdm.typeOfProof || '';
    }

    document.getElementById('pdmComment').value = pdm.comment || '';

    const msContainer = document.getElementById('pdmCompanyTypeMultiSelect');
    if (msContainer) {
        updateMultiSelectDisplay(msContainer, preparedPdm.companyType);
    }

    const commentInput = document.getElementById('pdmComment');
    if (commentInput) {
        commentInput.value = pdm.comment || '';
    }

    updatePDMBuilder();

    // Remove the PDM from the saved list as it's now being edited
    // Remove the PDM from the saved list as it's now being edited - REMOVED to preserve ID/Position logic
    // workspaceState.savedPDMs = workspaceState.savedPDMs.filter(p => p.id !== pdmId);



    // Refresh production PDM library
    renderProductionPDMLibrary();

    // Scroll the grouping section into view if present
    const groupingSection = document.querySelector('.grouping-section');
    if (groupingSection) {
        groupingSection.scrollIntoView({ behavior: 'smooth' });
    }
}

export function showImportHistory() {
    const overlay = document.createElement('div');
    overlay.className = 'family-modal-overlay';
    overlay.id = 'importHistoryOverlay';

    const modal = document.createElement('div');
    modal.className = 'import-history-modal';

    const historyContent = workspaceState.importHistory.length === 0
        ? `<div class="import-history-empty">
                <i class="fas fa-history"></i>
                <p class="import-history-empty-text">No import history yet.<br>Import your first file to see records here.</p>
           </div>`
        : `<div class="import-history-list">
            ${workspaceState.importHistory.map(record => {
            // Assuming formatTimestampWithUser is available in a shared/parent script
            const ts = formatTimestampWithUser(record.importedAt, record.importedBy || 'Unknown User');

            return `
                    <div class="import-history-item" data-history-id="${record.id}">
                        <div class="import-history-item-header">
                            <span class="import-history-family">${record.contextFamily || 'Unknown'}</span>
                            <span class="import-history-badge">${record.headingsCount} heading${record.headingsCount !== 1 ? 's' : ''}</span>
                            <span class="import-history-timestamp-inline">${ts}</span>
                        </div>
                        <div class="import-history-item-actions">
                            <button class="delete-history-btn" type="button" data-history-id="${record.id}" title="Remove from history">
                                Remove
                            </button>
                        </div>
                    </div>
                `;
        }).reverse().join('')}
           </div>`;

    modal.innerHTML = `
        <div class="import-history-header">
            <h2 class="import-history-title"><i class="fas fa-history"></i> Import History</h2>
            <button class="close-history-btn" id="closeImportHistoryBtn" type="button">Close</button>
        </div>
        ${historyContent}
    `;

    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const closeBtn = modal.querySelector('#closeImportHistoryBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeImportHistory);
    }

    modal.querySelectorAll('.delete-history-btn[data-history-id]').forEach(button => {
        button.addEventListener('click', () => {
            const historyId = button.getAttribute('data-history-id');
            if (historyId) {
                deleteImportHistory(historyId);
            }
        });
    });

    overlay.addEventListener('click', e => { if (e.target === overlay) closeImportHistory(); });
}

function deleteImportHistory(historyId) {
    const record = workspaceState.importHistory.find(r => r.id === historyId);

    if (!record) {
        alert('Import record not found');
        return;
    }

    // Fix: Handle both new format (headingIds) and old format (headings)
    const headingIdsFromRecord = record.headingIds || (record.headings ? record.headings.map(h => h.id) : []);

    // Get other import records (excluding the one being deleted) - needed for categorization
    const otherImports = workspaceState.importHistory.filter(r => r.id !== historyId);

    // Helper to check if heading exists in other imports
    const existsInOtherImport = (headingId) => {
        return otherImports.some(r => {
            const ids = r.headingIds || (r.headings ? r.headings.map(h => h.id) : []);
            return ids.includes(headingId);
        });
    };

    // Categorize headings: which will be removed vs preserved
    const headingsToRemove = [];      // Will be deleted (only in this import, still in Import section)
    const headingsInOtherImports = []; // In other imports, will remain
    const headingsAlreadyUsed = [];    // In Supported/PDMs, will remain

    headingIdsFromRecord.forEach(headingId => {
        const isInImported = workspaceState.importedHeadingIds.includes(headingId);
        const isInSupported = workspaceState.supportedHeadingIds.includes(headingId);
        const isInCurrentPDM = workspaceState.currentPDM.headings.some(h => h.id === headingId);
        const isInSavedPDM = workspaceState.savedPDMs.some(pdm =>
            pdm.headings && pdm.headings.some(h => h.id === headingId)
        );

        if (isInSupported || isInCurrentPDM || isInSavedPDM) {
            headingsAlreadyUsed.push(headingId);
        } else if (isInImported) {
            // Heading is in Import section - check if it exists in other imports
            if (existsInOtherImport(headingId)) {
                headingsInOtherImports.push(headingId);
            } else {
                headingsToRemove.push(headingId);
            }
        }
    });

    // Build confirmation message based on what will happen
    let confirmMessage = `Are you sure you want to remove this import?\n\n` +
        `Family: ${record.contextFamily || 'Unknown'}\n` +
        `Total Headings in Import: ${record.headingsCount}\n\n`;

    if (headingsToRemove.length > 0) {
        confirmMessage += `Will be removed:\n` +
            `- ${headingsToRemove.length} heading(s) from Import section\n` +
            `- The import history record\n`;
    } else {
        confirmMessage += `Will be removed:\n` +
            `- The import history record only\n`;
    }

    const preservedCount = headingsAlreadyUsed.length + headingsInOtherImports.length;
    if (preservedCount > 0) {
        confirmMessage += `\nWill be preserved:\n`;
        if (headingsAlreadyUsed.length > 0) {
            confirmMessage += `- ${headingsAlreadyUsed.length} heading(s) already in Supported/PDMs\n`;
        }
        if (headingsInOtherImports.length > 0) {
            confirmMessage += `- ${headingsInOtherImports.length} heading(s) also in other imports`;
        }
    }

    const confirmDelete = confirm(confirmMessage);

    if (!confirmDelete) {
        return;
    }

    // Remove headings that are only in this import (not in other imports or Supported/PDMs)
    headingsToRemove.forEach(headingId => {
        // Remove from importedHeadingIds
        workspaceState.importedHeadingIds = workspaceState.importedHeadingIds.filter(id => id !== headingId);

        // Remove from headingsRegistry
        delete workspaceState.headingsRegistry[headingId];
    });

    // Remove the history record
    workspaceState.importHistory = workspaceState.importHistory.filter(r => r.id !== historyId);

    // Update available families list - check if family is still used by any remaining headings
    const contextFamily = record.contextFamily;
    const familyStillUsed = Object.values(workspaceState.headingsRegistry).some(heading =>
        heading.families && heading.families.includes(contextFamily)
    );

    if (!familyStillUsed) {
        workspaceState.availableFamilies = workspaceState.availableFamilies.filter(f => f !== contextFamily);

        if (workspaceState.selectedFamily === contextFamily) {
            workspaceState.selectedFamily = 'all';
            const familyFilter = document.getElementById('familyFilter');
            if (familyFilter) {
                familyFilter.value = 'all';
            }
        }

        updateFamilyFilterDropdown();
    }

    // Re-render UI components
    renderImportedHeadings();
    renderSupportedHeadings();
    updatePDMBuilder();

    // Refresh production PDM library
    renderProductionPDMLibrary();

    // CRITICAL: Save changes to localStorage to persist deletion
    saveCurrentWorkspaceData();

    const overlay = document.getElementById('importHistoryOverlay');
    if (overlay) {
        closeImportHistory();

        // Re-open history modal if there are still records
        if (workspaceState.importHistory.length > 0) {
            showImportHistory();
        } else {
            alert('Import removed successfully. Import history is now empty.');
        }
    }
}

function closeImportHistory() {
    const overlay = document.getElementById('importHistoryOverlay');
    if (overlay) {
        overlay.remove();
    }
}

/* ==========================================================================
   PDM LIBRARY & FULL VIEW LOGIC (PRODUCTION TAB)
   ========================================================================== */

function formatProductionTimestamp(pdm) {
    // Determine if we should show created or updated info
    const useUpdated = pdm.updatedAt && pdm.updatedBy;
    const isoString = useUpdated ? pdm.updatedAt : pdm.createdAt;
    const username = useUpdated ? pdm.updatedBy : pdm.createdBy;
    const label = useUpdated ? 'Updated' : 'Created';

    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    const user = username || 'Unknown User';
    let timeText;

    // Relative time for recent updates (within 7 days)
    if (diffSecs < 60) {
        timeText = 'just now';
    } else if (diffMins < 60) {
        timeText = `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffHours < 24) {
        timeText = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffDays === 1) {
        timeText = 'yesterday';
    } else if (diffDays < 7) {
        timeText = `${diffDays} days ago`;
    } else {
        // Full date format for older items
        const day = date.getDate();
        const month = date.toLocaleString('en-US', { month: 'short' });
        const year = date.getFullYear();
        let hours = date.getHours();
        const mins = String(date.getMinutes()).padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        hours = hours % 12 || 12;

        timeText = `on ${month} ${day}, ${year} at ${hours}:${mins} ${ampm}`;
    }

    return {
        label: label,
        text: `by ${user} ${timeText}`
    };
}

function getProductionPDMFamilies(pdm) {
    const families = [...new Set(pdm.headings.map(h => h.family || 'Unknown'))];
    return families.join(', ');
}



// Render Production PDM Library
export function renderProductionPDMLibrary() {
    // Update Filter Options Dynamically
    if (typeof updateSectionFamilyFilter === 'function') {
        updateSectionFamilyFilter('productionPDMFamilyFilter', workspaceState.savedPDMs, 'pdm');
    }

    // Toggle Filter Button Visibility
    const filterBtn = document.getElementById('libraryFilterBtn');
    if (filterBtn) {
        filterBtn.style.display = (workspaceState.savedPDMs && workspaceState.savedPDMs.length > 0) ? 'block' : 'none';
        if (filterBtn.style.display === 'none') {
            // Close dialog if open
            const dialog = document.getElementById('libraryFilterDialog');
            if (dialog) dialog.classList.remove('visible');
        }
    }

    const container = document.getElementById('productionPDMLibraryList');
    if (!container) return;

    if (workspaceState.savedPDMs.length === 0) {
        container.innerHTML = '<p class="empty-placeholder">No PDMs Created Yet</p>';
        return;
    }

    let filteredPDMs = workspaceState.savedPDMs.filter(pdm => {
        return PdmUtils.filterPDM(pdm, productionState.searchQuery, productionState.selectedFamily);
    });

    // Update Count Badge
    const countBadge = document.getElementById('productionPdmCount');
    if (countBadge) {
        countBadge.textContent = filteredPDMs.length;
    }

    if (filteredPDMs.length === 0) {
        const emptyMessage = productionState.searchQuery || (productionState.selectedFamily && productionState.selectedFamily !== 'all')
            ? 'No PDMs match your filters'
            : 'No PDMs available';

        container.innerHTML = `<p class="empty-placeholder">${emptyMessage}</p>`;
        return;
    }

    container.innerHTML = filteredPDMs.map(pdm => {
        return PdmUtils.generatePDMCardHTML(pdm, {
            isSelected: productionState.selectedPDM && productionState.selectedPDM.id === pdm.id,
            onClick: null,
            statusType: 'upload',
            classPrefix: 'pdm'
        });
    }).join('');

    container.querySelectorAll('.pdm-card[data-pdm-id]').forEach(card => {
        card.addEventListener('click', () => {
            const pdmId = card.getAttribute('data-pdm-id');
            if (pdmId) {
                viewProductionPDM(pdmId);
            }
        });
    });

    renderProductionPDMMiniView();
}

// Toggle PDM Upload Status
export function togglePDMUploadStatus(pdmId, explicitStatus = null) {
    const pdm = workspaceState.savedPDMs.find(p => p.id === pdmId);
    if (!pdm) return;

    if (explicitStatus !== null) {
        // If explicitly setting status (e.g. from radio button "Yes" or "No")
        // Check if value actually changed to avoid unnecessary re-renders or loops
        if (pdm.uploaded === explicitStatus) return;
        pdm.uploaded = explicitStatus;
    } else {
        // Toggle if no explicit status (e.g. from badge click)
        pdm.uploaded = !pdm.uploaded;
    }

    renderProductionPDMLibrary();

    // If the full view is open for this PDM, re-render it to update the radio buttons
    if (productionState.selectedPDM && productionState.selectedPDM.id === pdmId) {
        renderProductionPDMFullView();
    }

    const status = pdm.uploaded ? 'uploaded' : 'not uploaded';
}


export function viewProductionPDM(pdmId) {
    const pdm = workspaceState.savedPDMs.find(p => p.id === pdmId);
    if (!pdm) return;

    productionState.selectedPDM = pdm;

    const builderContainer = document.getElementById('pdmBuilderContainer');
    const viewContainer = document.getElementById('productionPDMFullViewContainer');

    if (builderContainer) builderContainer.style.display = 'none';
    if (viewContainer) viewContainer.style.display = 'block';

    renderProductionPDMFullView();
    renderProductionPDMLibrary();
}

export function closeProductionPDMFullView() {
    productionState.selectedPDM = null;

    const builderContainer = document.getElementById('pdmBuilderContainer');
    const viewContainer = document.getElementById('productionPDMFullViewContainer');

    if (builderContainer) builderContainer.style.display = 'block';
    if (viewContainer) viewContainer.style.display = 'none';

    renderProductionPDMLibrary();
}

// Update Rectification Status (called from PDM Full View)
export function updateRectificationStatus(pdmId, status) {
    const pdm = workspaceState.savedPDMs.find(p => p.id === pdmId);
    if (!pdm) return;

    pdm.rectificationStatus = status;
    pdm.isUpdated = true; // Mark as updated so it reflects in reports

    // If there's a global save function, call it.
    // Usually defined in dashboard.js or similar for local storage persistence.
    if (typeof saveAssignedAccounts === 'function') {
        saveAssignedAccounts();
    }


    // Optional: Refresh the view if needed, but since it's a radio button it updates itself visually.
    // However, if we wanted to show a success message:
    // alert(`Rectification status updated to "${status}"`);
}

// Edit PDM from Production Full View
export function editProductionPDM(pdmId) {
    const pdm = workspaceState.savedPDMs.find(p => p.id === pdmId);
    if (!pdm) return;

    // Close the full view first
    closeProductionPDMFullView();

    // Use the existing editPDM function which handles everything
    editPDM(pdmId);

    // Update production PDM library and family filter
    // Update production PDM library and family filter
    if (typeof updateFamilyFilterDropdown === 'function') {
        updateFamilyFilterDropdown();
    }
    renderProductionPDMLibrary();
}

// Delete PDM from Production Full View
export function deleteProductionPDM(pdmId) {
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

    // Close the full view
    closeProductionPDMFullView();

    // Update all relevant sections
    renderSupportedHeadings();
    if (typeof updateFamilyFilterDropdown === 'function') {
        updateFamilyFilterDropdown();
    }
    renderProductionPDMLibrary();

    alert(`${deletedPdm.number} deleted successfully! All headings have been returned to the Supported Headings section.`);
}

function renderProductionPDMFullView() {
    const container = document.getElementById('productionPDMFullViewContainer');
    if (!container || !productionState.selectedPDM) return;

    const pdm = productionState.selectedPDM;



    const actionsHTML = `
        <button type="button" class="pdm-view-action-btn pdm-view-edit-btn" data-pdm-id="${pdm.id}" title="Edit PDM">
            <i class="fas fa-edit"></i>
        </button>
        <button type="button" class="pdm-view-action-btn pdm-view-delete-btn" data-pdm-id="${pdm.id}" title="Delete">
            <i class="fas fa-trash"></i>
        </button>
        <button type="button" class="pdm-view-action-btn pdm-view-close-btn" title="Close">
            <i class="fas fa-times"></i>
        </button>
    `;

    container.innerHTML = PdmUtils.generatePDMFullViewHTML(pdm, actionsHTML, 'pdm');

    const editBtn = container.querySelector('.pdm-view-edit-btn[data-pdm-id]');
    if (editBtn) {
        editBtn.addEventListener('click', () => {
            const pdmId = editBtn.getAttribute('data-pdm-id');
            if (pdmId) {
                editProductionPDM(pdmId);
            }
        });
    }

    const deleteBtn = container.querySelector('.pdm-view-delete-btn[data-pdm-id]');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', () => {
            const pdmId = deleteBtn.getAttribute('data-pdm-id');
            if (pdmId) {
                deleteProductionPDM(pdmId);
            }
        });
    }

    const closeBtn = container.querySelector('.pdm-view-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeProductionPDMFullView);
    }

    const copyAllBtn = container.querySelector('.pdm-copy-all-icon[data-pdm-id]');
    if (copyAllBtn) {
        copyAllBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            const pdmId = copyAllBtn.getAttribute('data-pdm-id');
            if (pdmId) {
                copyAllHeadingsFromPDM(pdmId);
            }
        });
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

    container.querySelectorAll('[data-copy-text][data-copy-label]').forEach(copyIcon => {
        copyIcon.addEventListener('click', (event) => {
            event.stopPropagation();
            const encodedText = copyIcon.getAttribute('data-copy-text') || '';
            const label = copyIcon.getAttribute('data-copy-label') || 'Text';
            const text = decodeURIComponent(encodedText);
            copyToClipboard(text, label);
        });
    });

    container.querySelectorAll('input[type="radio"][name^="pdmPublishedView_"][data-pdm-id]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            const pdmId = radio.getAttribute('data-pdm-id');
            if (!pdmId) return;
            togglePDMUploadStatus(pdmId, radio.value === 'yes');
        });
    });

    container.querySelectorAll('input[type="radio"][name^="pdmRectification_"][data-pdm-id][data-rectification-status]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (!radio.checked) return;
            const pdmId = radio.getAttribute('data-pdm-id');
            const status = radio.getAttribute('data-rectification-status');
            if (pdmId && status) {
                updateRectificationStatus(pdmId, status);
            }
        });
    });
}
// Copy All Headings Function
function copyAllHeadingsFromPDM(pdmId) {
    const pdm = workspaceState.savedPDMs.find(p => p.id === pdmId);
    if (pdm) PdmUtils.copyAllHeadings(pdm);
}

// Copy to Clipboard Utility Function
function copyToClipboard(text, fieldName) {
    if (!text) {
        alert(`No ${fieldName} to copy`);
        return;
    }

    // Use the Clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text)
            .then(() => {
                // Visual feedback - could be replaced with a toast notification
                const message = `${fieldName} copied to clipboard!`;

                // Optional: Show a brief alert or toast
                // For now, using a simple temporary message
                showCopyFeedback(fieldName);
            })
            .catch(err => {
                fallbackCopyToClipboard(text, fieldName);
            });
    } else {
        // Fallback for older browsers
        fallbackCopyToClipboard(text, fieldName);
    }
}

// Fallback copy method for older browsers
function fallbackCopyToClipboard(text, fieldName) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();

    try {
        document.execCommand('copy');
        showCopyFeedback(fieldName);
    } catch (err) {
        alert(`Failed to copy ${fieldName}`);
    }

    document.body.removeChild(textArea);
}

// Show brief visual feedback for copy action
function showCopyFeedback(fieldName) {
    // Create a temporary tooltip-like element
    const feedback = document.createElement('div');
    feedback.textContent = `${fieldName} copied!`;
    feedback.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #10b981;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-size: 13px;
        font-family: 'Calibri', 'Roboto', sans-serif;
        font-weight: 500;
        z-index: 10000;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        animation: slideInRight 0.3s ease-out;
    `;

    document.body.appendChild(feedback);

    // Remove after 2 seconds
    setTimeout(() => {
        feedback.style.animation = 'slideOutRight 0.3s ease-out';
        setTimeout(() => {
            document.body.removeChild(feedback);
        }, 300);
    }, 2000);
}


// =========================================================================
// Responsive Logic for Production Tab (< 1900px)
// =========================================================================

function setupProductionResponsiveViews() {
    // 1. Setup Production PDM Library Interaction
    const librarySection = document.querySelector('.production-pdm-library');
    if (librarySection) {
        // Ensure Mini View container exists
        if (!librarySection.querySelector('.production-pdm-mini-view')) {
            const miniView = document.createElement('div');
            miniView.className = 'production-pdm-mini-view';
            librarySection.appendChild(miniView);
        }

        // Click handler to expand
        librarySection.addEventListener('click', (e) => {
            if (window.innerWidth <= 1900 && !librarySection.classList.contains('expanded')) {
                toggleProductionLibrary(true);
            }
        });


    }

    // 2. Setup Import Headings Interaction
    const importSection = document.querySelector('.production-import-headings');
    if (importSection) {
        // Ensure Mini View container exists
        if (!importSection.querySelector('.production-import-mini-view')) {
            const miniView = document.createElement('div');
            miniView.className = 'production-import-mini-view';
            importSection.appendChild(miniView);
        }

        // Click handler to expand
        importSection.addEventListener('click', (e) => {
            if (window.innerWidth <= 1900 && !importSection.classList.contains('expanded')) {
                toggleImportSection(true);
            }
        });


    }

    // Initial Resize Check
    handleProductionResize();

    // Listen for resize
    window.addEventListener('resize', handleProductionResize);
}

function handleProductionResize() {
    const librarySection = document.querySelector('.production-pdm-library');
    const importSection = document.querySelector('.production-import-headings');

    if (!librarySection || !importSection) return;

    if (window.innerWidth > 1900) {
        // Desktop Mode: Reset responsive classes
        librarySection.classList.remove('expanded', 'collapsed');
        importSection.classList.remove('expanded', 'collapsed');
    } else {
        // Laptop Mode: Set Default State if none set
        // Default: Import Expanded, Library Collapsed (as requested)
        const hasState = librarySection.classList.contains('expanded') ||
            librarySection.classList.contains('collapsed');

        if (!hasState) {
            importSection.classList.add('expanded');
            librarySection.classList.add('collapsed');
        }
    }
}

export function toggleProductionLibrary(expand) {
    const librarySection = document.querySelector('.production-pdm-library');
    const importSection = document.querySelector('.production-import-headings');

    if (expand) {
        librarySection.classList.add('expanded');
        librarySection.classList.remove('collapsed');

        importSection.classList.remove('expanded');
        importSection.classList.add('collapsed');
    } else {
        librarySection.classList.remove('expanded');
        librarySection.classList.add('collapsed');

        importSection.classList.add('expanded');
        importSection.classList.remove('collapsed');
    }
}

export function toggleImportSection(expand) {
    const librarySection = document.querySelector('.production-pdm-library');
    const importSection = document.querySelector('.production-import-headings');

    if (expand) {
        importSection.classList.add('expanded');
        importSection.classList.remove('collapsed');

        librarySection.classList.remove('expanded');
        librarySection.classList.add('collapsed');
    } else {
        importSection.classList.remove('expanded');
        importSection.classList.add('collapsed');

        librarySection.classList.add('expanded');
        librarySection.classList.remove('collapsed');
    }
}

function createProductionCollapseBtn(onClick) {
    const btn = document.createElement('button');
    btn.innerHTML = '<i class="fas fa-chevron-right"></i>';
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

// Mini View Renderers
function renderProductionPDMMiniView() {
    const container = document.querySelector('.production-pdm-mini-view');
    if (!container) return;

    let pdms = workspaceState && workspaceState.savedPDMs ? workspaceState.savedPDMs : [];

    // Simple filter application
    if (productionState.searchQuery) {
        const query = productionState.searchQuery.toLowerCase();
        pdms = pdms.filter(pdm => {
            return `pdm ${pdm.number}`.toLowerCase().includes(query) ||
                (pdm.url || '').toLowerCase().includes(query) ||
                (pdm.description || '').toLowerCase().includes(query);
        });
    }

    if (productionState.selectedFamily && productionState.selectedFamily !== 'all') {
        pdms = pdms.filter(pdm => pdm.headings.some(h => h.family === productionState.selectedFamily));
    }

    const count = pdms.length;

    // Single Icon with Count Badge (Matched to QC Collapsed Style)
    // Using fa-folder and matching badge styles to renderQCMiniView
    container.innerHTML = `
        <div class="production-mini-card" style="width: 48px; height: 48px; position: relative; justify-content: center;" 
             title="${count} PDMs">
            <i class="fas fa-folder" style="font-size: 20px;"></i>
            ${count > 0 ? `<div class="production-mini-card-count" style="position: absolute; top: -6px; right: -6px; background: #3b82f6; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: bold; border: 2px solid white;">${count}</div>` : ''}
        </div>
    `;

    const miniCard = container.querySelector('.production-mini-card');
    if (miniCard) {
        miniCard.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleProductionLibrary(true);
        });
    }
}

function renderImportMiniView() {
    const container = document.querySelector('.production-import-mini-view');
    if (!container) return;

    const count = workspaceState.importedHeadingIds?.length || 0;

    // Single Icon with Count Badge, centered
    container.innerHTML = `
        <div class="production-mini-card" style="width: 48px; height: 48px; position: relative;" 
             title="${count} Imported Headings">
            <i class="fas fa-file-import" style="font-size: 20px;"></i>
            ${count > 0 ? `<div class="production-mini-card-count" style="top: -6px; right: -6px; width: 20px; height: 20px; font-size: 11px;">${count}</div>` : ''}
        </div>
    `;

    const miniCard = container.querySelector('.production-mini-card');
    if (miniCard) {
        miniCard.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleImportSection(true);
        });
    }
}


function setupProductionMultiSelect() {
    PdmUtils.MultiSelect.setup(
        'pdmCompanyTypeMultiSelect',
        PdmUtils.COMPANY_TYPE_OPTIONS,
        (selectedValues) => {
            workspaceState.currentPDM.companyType = selectedValues;
            updatePDMBuilder();
        }
    );
}

function updateMultiSelectDisplay(container, selectedValues) {
    PdmUtils.MultiSelect.updateDisplay(container, selectedValues);
}

// Window bridges removed - functions are exported and imported where needed
