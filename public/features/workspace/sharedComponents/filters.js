import { workspaceState } from '../state/workspaceState.js';
import { productionState } from '../state/productionState.js';
import { qcSectionState } from '../state/qcSectionState.js';
import { renderImportedHeadings, renderSupportedHeadings, renderProductionPDMLibrary } from '../editor/production.js';
import { renderQCPDMsList, renderQCHeadings, clearQCHeadingsSearch } from '../qc/qcReview.js';
import { renderAccountFiles, applyFilters } from './accountData.js';

// Reusable function to toggle any filter dialog
export function toggleDialog(dialogId, btnId, event) {
    if (event) event.stopPropagation();
    const dialog = document.getElementById(dialogId);
    const btn = document.getElementById(btnId);

    if (dialog) {
        dialog.classList.toggle('visible');
    }
    if (btn) {
        btn.classList.toggle('active');
    }
}

// Reusable function to close any filter dialog
export function closeDialog(dialogId, btnId, event) {
    if (event) event.stopPropagation();
    const dialog = document.getElementById(dialogId);
    const btn = document.getElementById(btnId);

    if (dialog) {
        dialog.classList.remove('visible');
    }
    if (btn) {
        btn.classList.remove('active');
    }
}

// Initialize filter listeners for all sections
export function setupFilterListeners() {
    // Helper to setup a specific filter pair
    const setupFilter = (btnId, dialogId, closeBtnId) => {
        const btn = document.getElementById(btnId);
        const closeBtn = document.getElementById(closeBtnId);

        if (btn) {
            btn.addEventListener('click', (e) => toggleDialog(dialogId, btnId, e));
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => closeDialog(dialogId, btnId, e));
        }
    };

    // 1. Import Section Filters
    setupFilter('importFilterBtn', 'importFilterDialog', 'closeFilterDialogBtn');

    // 2. Supported Section Filters
    setupFilter('supportedFilterBtn', 'supportedFilterDialog', 'closeSupportedFilterDialogBtn');

    // 3. PDM Library Section Filters
    setupFilter('libraryFilterBtn', 'libraryFilterDialog', 'closeLibraryFilterDialogBtn');


    // Global click listener to close dialogs when clicking outside
    document.addEventListener('click', (e) => {
        const dialogs = [
            { dialogId: 'importFilterDialog', btnId: 'importFilterBtn' },
            { dialogId: 'supportedFilterDialog', btnId: 'supportedFilterBtn' },
            { dialogId: 'libraryFilterDialog', btnId: 'libraryFilterBtn' }
        ];

        dialogs.forEach(({ dialogId, btnId }) => {
            const dialog = document.getElementById(dialogId);
            const btn = document.getElementById(btnId);

            if (dialog && dialog.classList.contains('visible')) {
                if (!dialog.contains(e.target) && !btn.contains(e.target)) {
                    closeDialog(dialogId, btnId);
                }
            }
        });
    });
}

// NEW: Generic function to update a specific section's family filter
export function updateSectionFamilyFilter(filterId, items, extractionArgs) {
    if (!filterId) return;
    const filter = document.getElementById(filterId);
    if (!filter) {
        return;
    }

    // Reset options
    const currentVal = filter.value;
    filter.innerHTML = '<option value="all">All Families</option>';

    if (!items || items.length === 0) {
        return;
    }

    const familyCounts = {};

    items.forEach(item => {
        if (extractionArgs === 'pdm') {
            // PDMs: extract families from headings
            if (item.headings && Array.isArray(item.headings)) {
                item.headings.forEach(h => {
                    const families = h.families || [];
                    // Deduplicate families per heading
                    const uniqueFamilies = [...new Set(families.map(f => f.trim()).filter(f => f))];
                    uniqueFamilies.forEach(f => {
                        familyCounts[f] = (familyCounts[f] || 0) + 1;
                    });
                });
            }
        } else if (extractionArgs === 'families') {
            // Direct families array property
            const families = item.families || [];
            // Deduplicate families per item
            const uniqueFamilies = [...new Set(families.map(f => f.trim()).filter(f => f))];
            uniqueFamilies.forEach(f => {
                familyCounts[f] = (familyCounts[f] || 0) + 1;
            });
        } else if (extractionArgs === 'family') {
            // Legacy: single family property
            if (item.family) {
                familyCounts[item.family] = (familyCounts[item.family] || 0) + 1;
            }
        }
    });

    const sortedFamilies = Object.keys(familyCounts).sort();

    sortedFamilies.forEach(family => {
        const option = document.createElement('option');
        option.value = family;
        option.textContent = `${family} (${familyCounts[family]})`;
        filter.appendChild(option);
    });

    // Restore selection if possible
    if (currentVal && (currentVal === 'all' || familyCounts[currentVal])) {
        filter.value = currentVal;
    } else {
        filter.value = 'all';
    }
}

// Update all family filter dropdowns across the application
export function updateFamilyFilterDropdown() {
    const familyFilter = document.getElementById('familyFilter');
    if (!familyFilter) return;

    // Clear existing options, keeping 'all'
    familyFilter.innerHTML = '<option value="all">All Families</option>';

    if (typeof workspaceState !== 'undefined') {
        const familyCounts = {};

        // Collect families from registry (count each heading only once per unique family)
        Object.values(workspaceState.headingsRegistry || {}).forEach(heading => {
            const families = heading.families || [];
            // Get unique families for this heading (deduplicate)
            const uniqueFamilies = [...new Set(families.map(f => f.trim()).filter(f => f))];
            uniqueFamilies.forEach(f => {
                familyCounts[f] = (familyCounts[f] || 0) + 1;
            });
        });

        // Update availableFamilies in state
        workspaceState.availableFamilies = Object.keys(familyCounts).sort();

        const sortedFamilies = workspaceState.availableFamilies;

        sortedFamilies.forEach(family => {
            const count = familyCounts[family];
            const option = document.createElement('option');
            option.value = family;
            option.textContent = `${family} (${count})`;
            familyFilter.appendChild(option);
        });

        // Set the currently selected family back
        familyFilter.value = workspaceState.selectedFamily || 'all';

        // Update QC PDM Family Filter (only families from PDMs)
        const qcPdmFamilyFilter = document.getElementById('qcPdmFamilyFilter');
        if (qcPdmFamilyFilter) {
            const pdmFamilyCounts = {};

            // Count families from saved PDMs only
            if (workspaceState.savedPDMs && Array.isArray(workspaceState.savedPDMs)) {
                workspaceState.savedPDMs.forEach(pdm => {
                    if (pdm.headings && Array.isArray(pdm.headings)) {
                        pdm.headings.forEach(heading => {
                            const families = heading.families || [];
                            const uniqueFamilies = [...new Set(families.map(f => f.trim()).filter(f => f))];
                            uniqueFamilies.forEach(f => {
                                pdmFamilyCounts[f] = (pdmFamilyCounts[f] || 0) + 1;
                            });
                        });
                    }
                });
            }

            const pdmSortedFamilies = Object.keys(pdmFamilyCounts).sort();

            qcPdmFamilyFilter.innerHTML = '<option value="all">All Families</option>';
            pdmSortedFamilies.forEach(family => {
                const count = pdmFamilyCounts[family];
                const option = document.createElement('option');
                option.value = family;
                option.textContent = `${family} (${count})`;
                qcPdmFamilyFilter.appendChild(option);
            });
            // Preserve selection from qcSectionState
            if (typeof qcSectionState !== 'undefined') {
                qcPdmFamilyFilter.value = qcSectionState.familyFilter || 'all';
            }
        }

        // Update QC Headings Family Filter (families from headings registry)
        const qcHeadingsFamilyFilter = document.getElementById('qcHeadingsFamilyFilter');
        if (qcHeadingsFamilyFilter) {
            // Use the same familyCounts from registry (includes all imported headings)
            qcHeadingsFamilyFilter.innerHTML = '<option value="all">All Families</option>';
            sortedFamilies.forEach(family => {
                const count = familyCounts[family];
                const option = document.createElement('option');
                option.value = family;
                option.textContent = `${family} (${count})`;
                qcHeadingsFamilyFilter.appendChild(option);
            });
            // Preserve selection from qcSectionState
            if (typeof qcSectionState !== 'undefined') {
                qcHeadingsFamilyFilter.value = qcSectionState.headingsFamilyFilter || 'all';
            }
        }
    }
}

// Logic for Production Tab Filters
export function setupProductionFilterLogic() {
    // 1. Import Section - Family Filter
    const familyFilter = document.getElementById('familyFilter');
    if (familyFilter) {
        familyFilter.removeEventListener('change', handleImportFamilyFilter);
        familyFilter.addEventListener('change', handleImportFamilyFilter);
    }

    // 2. Import Section - Status Filter
    const statusFilter = document.getElementById('importStatusFilter');
    if (statusFilter) {
        statusFilter.removeEventListener('change', handleImportStatusFilter);
        statusFilter.addEventListener('change', handleImportStatusFilter);
    }

    // Import Section - Search
    const importSearchInput = document.getElementById('importSearchInput');
    if (importSearchInput) {
        importSearchInput.removeEventListener('input', handleImportSearch);
        importSearchInput.addEventListener('input', handleImportSearch);
    }
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.removeEventListener('click', clearImportSearch);
        clearSearchBtn.addEventListener('click', clearImportSearch);
    }

    // 3. Supported Section - Family Filter
    const supportedFamilyFilter = document.getElementById('supportedFamilyFilter');
    if (supportedFamilyFilter) {
        supportedFamilyFilter.removeEventListener('change', handleSupportedFamilyFilter);
        supportedFamilyFilter.addEventListener('change', handleSupportedFamilyFilter);
    }

    // Supported Section - Link Filter
    const supportedLinkFilter = document.getElementById('supportedLinkFilter');
    if (supportedLinkFilter) {
        supportedLinkFilter.removeEventListener('change', handleSupportedLinkFilter);
        supportedLinkFilter.addEventListener('change', handleSupportedLinkFilter);
    }

    // Supported Section - Search
    const supportedSearchInput = document.getElementById('supportedSearchInput');
    if (supportedSearchInput) {
        supportedSearchInput.removeEventListener('input', handleSupportedSearch);
        supportedSearchInput.addEventListener('input', handleSupportedSearch);
    }
    const clearSupportedSearchBtn = document.getElementById('clearSupportedSearchBtn');
    if (clearSupportedSearchBtn) {
        clearSupportedSearchBtn.removeEventListener('click', clearSupportedSearch);
        clearSupportedSearchBtn.addEventListener('click', clearSupportedSearch);
    }

    // 4. PDM Library - Search
    const productionPDMSearch = document.getElementById('productionPDMSearch');
    if (productionPDMSearch) {
        productionPDMSearch.removeEventListener('input', handlePDMLibrarySearch);
        productionPDMSearch.addEventListener('input', handlePDMLibrarySearch);
    }

    // 5. PDM Library - Family Filter
    const productionPDMFamilyFilter = document.getElementById('productionPDMFamilyFilter');
    if (productionPDMFamilyFilter) {
        productionPDMFamilyFilter.removeEventListener('change', handlePDMLibraryFamilyFilter);
        productionPDMFamilyFilter.addEventListener('change', handlePDMLibraryFamilyFilter);
    }

    // Clear Buttons
    const clearImportBtn = document.getElementById('clearImportFiltersBtn');
    if (clearImportBtn) {
        clearImportBtn.removeEventListener('click', clearImportFilters);
        clearImportBtn.addEventListener('click', clearImportFilters);
    }

    const clearSupportedBtn = document.getElementById('clearSupportedFiltersBtn');
    if (clearSupportedBtn) {
        clearSupportedBtn.removeEventListener('click', clearSupportedFilters);
        clearSupportedBtn.addEventListener('click', clearSupportedFilters);
    }

    const clearLibraryBtn = document.getElementById('clearLibraryFiltersBtn');
    if (clearLibraryBtn) {
        clearLibraryBtn.removeEventListener('click', clearPDMLibraryFilters);
        clearLibraryBtn.addEventListener('click', clearPDMLibraryFilters);
    }
}

// Handlers (to enable clean removal)
function handleImportFamilyFilter(e) {
    if (typeof workspaceState !== 'undefined' && typeof renderImportedHeadings === 'function') {
        workspaceState.selectedFamily = e.target.value;
        renderImportedHeadings();
    }
}

function handleImportStatusFilter(e) {
    if (typeof workspaceState !== 'undefined' && typeof renderImportedHeadings === 'function') {
        workspaceState.selectedImportStatus = e.target.value;
        renderImportedHeadings();
    }
}

function handleImportSearch(e) {
    if (typeof workspaceState !== 'undefined' && typeof renderImportedHeadings === 'function') {
        workspaceState.searchQuery = e.target.value.toLowerCase().trim();
        const clearBtn = document.getElementById('clearSearchBtn');
        if (clearBtn) {
            clearBtn.style.display = workspaceState.searchQuery ? 'flex' : 'none';
        }
        renderImportedHeadings();
    }
}

function clearImportSearch() {
    if (typeof workspaceState !== 'undefined' && typeof renderImportedHeadings === 'function') {
        workspaceState.searchQuery = '';
        const input = document.getElementById('importSearchInput');
        const clearBtn = document.getElementById('clearSearchBtn');
        if (input) input.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        renderImportedHeadings();
    }
}

function handleSupportedFamilyFilter(e) {
    if (typeof workspaceState !== 'undefined' && typeof renderSupportedHeadings === 'function') {
        workspaceState.selectedSupportedFamily = e.target.value;
        renderSupportedHeadings();
    }
}

function handleSupportedLinkFilter(e) {
    if (typeof productionState !== 'undefined' && typeof renderSupportedHeadings === 'function') {
        productionState.selectedSupportedLink = e.target.value;
        renderSupportedHeadings();
    }
}

function handleSupportedSearch(e) {
    if (typeof productionState !== 'undefined' && typeof renderSupportedHeadings === 'function') {
        productionState.supportedSearchQuery = e.target.value.toLowerCase().trim();
        const clearBtn = document.getElementById('clearSupportedSearchBtn');
        if (clearBtn) {
            clearBtn.style.display = productionState.supportedSearchQuery ? 'flex' : 'none';
        }
        renderSupportedHeadings();
    }
}

function clearSupportedSearch() {
    if (typeof productionState !== 'undefined' && typeof renderSupportedHeadings === 'function') {
        productionState.supportedSearchQuery = '';
        const input = document.getElementById('supportedSearchInput');
        const clearBtn = document.getElementById('clearSupportedSearchBtn');
        if (input) input.value = '';
        if (clearBtn) clearBtn.style.display = 'none';
        renderSupportedHeadings();
    }
}

function handlePDMLibrarySearch(e) {
    if (typeof productionState !== 'undefined' && typeof renderProductionPDMLibrary === 'function') {
        productionState.searchQuery = e.target.value.trim();
        renderProductionPDMLibrary();
    }
}

function handlePDMLibraryFamilyFilter(e) {
    if (typeof productionState !== 'undefined' && typeof renderProductionPDMLibrary === 'function') {
        productionState.selectedFamily = e.target.value;
        renderProductionPDMLibrary();
    }
}

// --- New Clear Functions ---

export function clearImportFilters() {
    if (typeof workspaceState === 'undefined') return;
    workspaceState.selectedFamily = 'all';
    workspaceState.selectedImportStatus = 'all';

    const familyFilter = document.getElementById('familyFilter');
    const statusFilter = document.getElementById('importStatusFilter');
    if (familyFilter) familyFilter.value = 'all';
    if (statusFilter) statusFilter.value = 'all';

    if (typeof renderImportedHeadings === 'function') renderImportedHeadings();
}

export function clearSupportedFilters() {
    if (typeof workspaceState === 'undefined' || typeof productionState === 'undefined') return;
    workspaceState.selectedSupportedFamily = 'all';
    productionState.selectedSupportedLink = 'all';

    const familyFilter = document.getElementById('supportedFamilyFilter');
    const linkFilter = document.getElementById('supportedLinkFilter');
    if (familyFilter) familyFilter.value = 'all';
    if (linkFilter) linkFilter.value = 'all';

    if (typeof renderSupportedHeadings === 'function') renderSupportedHeadings();
}

export function clearPDMLibraryFilters() {
    if (typeof productionState === 'undefined') return;
    productionState.selectedFamily = 'all';

    const familyFilter = document.getElementById('productionPDMFamilyFilter');
    if (familyFilter) familyFilter.value = 'all';

    if (typeof renderProductionPDMLibrary === 'function') renderProductionPDMLibrary();
}

export function clearQCLibraryFilters() {
    if (typeof qcSectionState === 'undefined') return;
    qcSectionState.familyFilter = 'all';

    const familyFilter = document.getElementById('qcPdmFamilyFilter');
    if (familyFilter) familyFilter.value = 'all';

    if (typeof renderQCPDMsList === 'function') renderQCPDMsList();
}


/**
 * Initialize all filter listeners and logic.
 * Called from app.js after templates are loaded.
 */
export function initializeFilters() {
    setupFilterListeners();
    setupProductionFilterLogic();
    setupQCReviewFilterLogic();
    setupAccountFilesFilterLogic();
}

// Logic for QC Review Tab Filters
export function setupQCReviewFilterLogic() {
    // 1. QC PDM Search
    const qcPdmSearch = document.getElementById('qcPdmSearch');
    if (qcPdmSearch) {
        qcPdmSearch.removeEventListener('input', handleQCPdmSearch);
        qcPdmSearch.addEventListener('input', handleQCPdmSearch);
    }

    // 2. QC Library Filter Toggle
    const qcLibraryFilterBtn = document.getElementById('qcLibraryFilterBtn');
    if (qcLibraryFilterBtn) {
        qcLibraryFilterBtn.removeEventListener('click', handleQCLibraryFilterToggle);
        qcLibraryFilterBtn.addEventListener('click', handleQCLibraryFilterToggle);
    }
    const closeQcLibraryFilterDialogBtn = document.getElementById('closeQcLibraryFilterDialogBtn');
    if (closeQcLibraryFilterDialogBtn) {
        closeQcLibraryFilterDialogBtn.removeEventListener('click', closeQCLibraryFilterDialog);
        closeQcLibraryFilterDialogBtn.addEventListener('click', closeQCLibraryFilterDialog);
    }


    // 3. QC PDM Family Filter
    const qcPdmFamilyFilter = document.getElementById('qcPdmFamilyFilter');
    if (qcPdmFamilyFilter) {
        qcPdmFamilyFilter.removeEventListener('change', handleQCPdmFamilyFilter);
        qcPdmFamilyFilter.addEventListener('change', handleQCPdmFamilyFilter);
    }

    const clearQcLibraryBtn = document.getElementById('clearQcLibraryFiltersBtn');
    if (clearQcLibraryBtn) {
        clearQcLibraryBtn.removeEventListener('click', clearQCLibraryFilters);
        clearQcLibraryBtn.addEventListener('click', clearQCLibraryFilters);
    }

    // 4. QC Headings Search
    const qcHeadingsSearchInput = document.getElementById('qcHeadingsSearchInput');
    if (qcHeadingsSearchInput) {
        qcHeadingsSearchInput.removeEventListener('input', handleQCHeadingsSearch);
        qcHeadingsSearchInput.addEventListener('input', handleQCHeadingsSearch);
    }
    const clearQcHeadingsSearchBtn = document.getElementById('clearQcHeadingsSearchBtn');
    if (clearQcHeadingsSearchBtn) {
        clearQcHeadingsSearchBtn.removeEventListener('click', clearQCHeadingsSearch); // Global or local func?
        // Assuming clearQCHeadingsSearch is globally available from qcReview.js or we replicate logic
        // For now, if it's GLOBAL, we can use it. If not, we might need a wrapper.
        // Based on qcReview.js, clearQCHeadingsSearch IS global.
        clearQcHeadingsSearchBtn.addEventListener('click', clearQCHeadingsSearch);
    }

    // 5. QC Headings Filter Toggle
    const qcHeadingsFilterBtn = document.getElementById('qcHeadingsFilterBtn');
    if (qcHeadingsFilterBtn) {
        qcHeadingsFilterBtn.removeEventListener('click', handleQCHeadingsFilterToggle);
        qcHeadingsFilterBtn.addEventListener('click', handleQCHeadingsFilterToggle);
    }
    const closeQcHeadingsFilterDialogBtn = document.getElementById('closeQcHeadingsFilterDialogBtn');
    if (closeQcHeadingsFilterDialogBtn) {
        closeQcHeadingsFilterDialogBtn.removeEventListener('click', closeQCHeadingsFilterDialog);
        closeQcHeadingsFilterDialogBtn.addEventListener('click', closeQCHeadingsFilterDialog);
    }


    // 6. QC Headings Filters (Family/Status)
    const qcHeadingsFamilyFilter = document.getElementById('qcHeadingsFamilyFilter');
    if (qcHeadingsFamilyFilter) {
        qcHeadingsFamilyFilter.removeEventListener('change', handleQCHeadingsFamilyFilter);
        qcHeadingsFamilyFilter.addEventListener('change', handleQCHeadingsFamilyFilter);
    }
    const qcHeadingsStatusFilter = document.getElementById('qcHeadingsStatusFilter');
    if (qcHeadingsStatusFilter) {
        qcHeadingsStatusFilter.removeEventListener('change', handleQCHeadingsStatusFilter);
        qcHeadingsStatusFilter.addEventListener('change', handleQCHeadingsStatusFilter);
    }

    // 7. Clear Filters Button
    const clearFiltersBtn = document.getElementById('clearQcHeadingsFiltersBtn');
    if (clearFiltersBtn) {
        clearFiltersBtn.removeEventListener('click', clearQCHeadingsFilters);
        clearFiltersBtn.addEventListener('click', clearQCHeadingsFilters);
    }

    // Initial check
    checkQCHeadingsFilterActiveState();
}

// --- QC Handlers ---

function handleQCPdmSearch(e) {
    if (typeof qcSectionState !== 'undefined' && typeof renderQCPDMsList === 'function') {
        qcSectionState.searchQuery = e.target.value.toLowerCase().trim();
        renderQCPDMsList();
    }
}

function handleQCLibraryFilterToggle(e) {
    toggleDialog('qcLibraryFilterDialog', 'qcLibraryFilterBtn', e);
}

function closeQCLibraryFilterDialog(e) {
    closeDialog('qcLibraryFilterDialog', 'qcLibraryFilterBtn', e);
}

function handleQCPdmFamilyFilter(e) {
    if (typeof qcSectionState !== 'undefined' && typeof renderQCPDMsList === 'function') {
        qcSectionState.familyFilter = e.target.value;
        renderQCPDMsList();
    }
}

function handleQCHeadingsSearch(e) {
    if (typeof qcSectionState !== 'undefined' && typeof renderQCHeadings === 'function') {
        if (!qcSectionState.headingsSearchQuery) qcSectionState.headingsSearchQuery = '';
        qcSectionState.headingsSearchQuery = e.target.value.toLowerCase().trim();

        const clearBtn = document.getElementById('clearQcHeadingsSearchBtn');
        if (clearBtn) {
            clearBtn.style.display = qcSectionState.headingsSearchQuery ? 'flex' : 'none';
        }

        renderQCHeadings();
    }
}

function handleQCHeadingsFilterToggle(e) {
    toggleDialog('qcHeadingsFilterDialog', 'qcHeadingsFilterBtn', e);
}

function closeQCHeadingsFilterDialog(e) {
    closeDialog('qcHeadingsFilterDialog', 'qcHeadingsFilterBtn', e);
}

function handleQCHeadingsFamilyFilter(e) {
    if (typeof qcSectionState !== 'undefined' && typeof renderQCHeadings === 'function') {
        qcSectionState.headingsFamilyFilter = e.target.value;
        renderQCHeadings();
        checkQCHeadingsFilterActiveState();
    }
}

function handleQCHeadingsStatusFilter(e) {
    if (typeof qcSectionState !== 'undefined' && typeof renderQCHeadings === 'function') {
        qcSectionState.headingsStatusFilter = e.target.value;
        renderQCHeadings();
        checkQCHeadingsFilterActiveState();
    }
}

export function clearQCHeadingsFilters() {
    if (typeof qcSectionState === 'undefined') return;

    // Reset State
    qcSectionState.headingsFamilyFilter = 'all';
    qcSectionState.headingsStatusFilter = 'all';

    // Reset UI Inputs
    const familyFilter = document.getElementById('qcHeadingsFamilyFilter');
    const statusFilter = document.getElementById('qcHeadingsStatusFilter');
    if (familyFilter) familyFilter.value = 'all';
    if (statusFilter) statusFilter.value = 'all';

    // Rerender
    if (typeof renderQCHeadings === 'function') {
        renderQCHeadings();
    }

    checkQCHeadingsFilterActiveState();
}

function checkQCHeadingsFilterActiveState() {
    const btn = document.getElementById('qcHeadingsFilterBtn');
    if (!btn || typeof qcSectionState === 'undefined') return;

    const isActive = (qcSectionState.headingsFamilyFilter !== 'all') ||
        (qcSectionState.headingsStatusFilter !== 'all');

    if (isActive) {
        btn.classList.add('has-filters');
    } else {
        btn.classList.remove('has-filters');
    }
}

// Logic for Account Files Filters (Account Files Tab)
export function setupAccountFilesFilterLogic() {
    const pairs = [
        // Editor Mode
        { btnId: 'accountFilesUploadBtn', inputId: 'accountFilesInput', searchId: 'accountFilesSearch', filterId: 'accountFilesTypeFilter', clearId: 'clearAccountFilesSearchBtn', clearFilterId: 'clearAccountFilesFiltersBtn' },
        // QC Mode
        { btnId: 'qc-accountFilesUploadBtn', inputId: 'qc-accountFilesInput', searchId: 'qc-accountFilesSearch', filterId: 'qc-accountFilesTypeFilter', clearId: 'qc-clearAccountFilesSearchBtn', clearFilterId: 'qc-clearAccountFilesFiltersBtn' },
        // Dashboard Page
        { btnId: 'pageAccountFilesUploadBtn', inputId: 'pageAccountFilesInput', searchId: 'pageAccountFilesSearch', filterId: 'pageAccountFilesTypeFilter', clearId: 'pageClearAccountFilesSearchBtn', clearFilterId: 'pageClearAccountFilesFiltersBtn' }
    ];

    pairs.forEach(pair => {
        // Search functionality
        const searchInput = document.getElementById(pair.searchId);
        if (searchInput) {
            searchInput.removeEventListener('input', handleFilesSearch);
            searchInput.addEventListener('input', handleFilesSearch);
        }

        // Clear functionality
        const clearBtn = document.getElementById(pair.clearId);
        if (clearBtn) {
            clearBtn.onclick = () => clearFilesSearch(pair.searchId);
        }

        // Filter functionality
        const typeFilter = document.getElementById(pair.filterId);
        if (typeFilter) {
            typeFilter.removeEventListener('change', handleFilesFilter);
            typeFilter.addEventListener('change', handleFilesFilter);
        }

        // Clear Filter Button
        if (pair.clearFilterId) {
            const clearFilterBtn = document.getElementById(pair.clearFilterId);
            if (clearFilterBtn) {
                clearFilterBtn.onclick = () => clearAccountFilesFilters();
            }
        }
    });

    // Account Files Filter Dialog Logic (Editor)
    const filterBtn = document.getElementById('accountFilesFilterBtn');
    if (filterBtn) {
        filterBtn.removeEventListener('click', toggleAccountFilesFilterDialogWrapper);
        filterBtn.addEventListener('click', () => toggleAccountFilesFilterDialogWrapper('accountFilesFilterDialog'));
    }
    const closeFilterBtn = document.getElementById('closeAccountFilesFilterDialogBtn');
    if (closeFilterBtn) {
        closeFilterBtn.removeEventListener('click', closeAccountFilesFilterDialogWrapper);
        closeFilterBtn.addEventListener('click', () => closeAccountFilesFilterDialogWrapper('accountFilesFilterDialog'));
    }

    // QC Mode
    const qcFilterBtn = document.getElementById('qc-accountFilesFilterBtn');
    if (qcFilterBtn) {
        qcFilterBtn.removeEventListener('click', toggleAccountFilesFilterDialogWrapper);
        qcFilterBtn.addEventListener('click', () => toggleAccountFilesFilterDialogWrapper('qc-accountFilesFilterDialog'));
    }
    const closeQcFilterBtn = document.getElementById('closeQcAccountFilesFilterDialogBtn');
    if (closeQcFilterBtn) {
        closeQcFilterBtn.removeEventListener('click', closeAccountFilesFilterDialogWrapper);
        closeQcFilterBtn.addEventListener('click', () => closeAccountFilesFilterDialogWrapper('qc-accountFilesFilterDialog'));
    }

    // Page Mode (Account Details)
    const pageFilterBtn = document.getElementById('pageAccountFilesFilterBtn');
    if (pageFilterBtn) {
        pageFilterBtn.removeEventListener('click', toggleAccountFilesFilterDialogWrapper);
        pageFilterBtn.addEventListener('click', () => toggleAccountFilesFilterDialogWrapper('pageAccountFilesFilterDialog'));
    }
    const closePageFilterBtn = document.getElementById('closePageAccountFilesFilterDialogBtn');
    if (closePageFilterBtn) {
        closePageFilterBtn.removeEventListener('click', closeAccountFilesFilterDialogWrapper);
        closePageFilterBtn.addEventListener('click', () => closeAccountFilesFilterDialogWrapper('pageAccountFilesFilterDialog'));
    }
}

// Wrappers for toggle/close dialogs to match specific signature or if logic differs
function toggleAccountFilesFilterDialogWrapper(dialogId) {
    toggleDialog(dialogId, null); // We might need to pass button ID if we want active state on button, but original code just toggled dialog visibility
}

function closeAccountFilesFilterDialogWrapper(dialogId) {
    const dialog = document.getElementById(dialogId);
    if (dialog) {
        dialog.classList.remove('visible');
    }
}


// --- Account Files Handlers ---

// Handle Files Search
function handleFilesSearch(e) {
    const val = e.target.value.toLowerCase().trim();

    // Sync other inputs
    const inputs = ['accountFilesSearch', 'qc-accountFilesSearch', 'pageAccountFilesSearch'];
    inputs.forEach(id => {
        const input = document.getElementById(id);
        if (input && input !== e.target) {
            input.value = e.target.value;
        }
    });

    updateClearButtonsVisibility(val);

    if (typeof applyFilters === 'function') {
        // Assuming applyFilters and renderAccountFiles are available globally from accountData.js
        // If they are not global, we might need to expose them or replicate logic here.
        // Based on accountData.js code, renderAccountFiles calls applyFilters.
        renderAccountFiles();
    }
}

function updateClearButtonsVisibility(val) {
    const clearIds = ['clearAccountFilesSearchBtn', 'qc-clearAccountFilesSearchBtn', 'pageClearAccountFilesSearchBtn'];
    clearIds.forEach(id => {
        const btn = document.getElementById(id);
        if (btn) {
            btn.style.display = val ? 'flex' : 'none';
        }
    });
}

function clearFilesSearch(inputId) {
    const input = document.getElementById(inputId);
    if (input) {
        input.value = '';
        input.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// Handle Files Filter
function handleFilesFilter(e) {
    const val = e.target.value;

    // Sync other filters
    const filters = ['accountFilesTypeFilter', 'qc-accountFilesTypeFilter', 'pageAccountFilesTypeFilter'];
    filters.forEach(id => {
        const filter = document.getElementById(id);
        if (filter && filter !== e.target) {
            filter.value = val;
        }
    });

    if (typeof renderAccountFiles === 'function') {
        renderAccountFiles();
    }
}

export function clearAccountFilesFilters() {
    const filters = ['accountFilesTypeFilter', 'qc-accountFilesTypeFilter', 'pageAccountFilesTypeFilter'];
    filters.forEach(id => {
        const filter = document.getElementById(id);
        if (filter) {
            filter.value = 'all';
            // Trigger change manually to update state/render
            filter.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });
}

// Window bridges removed - all functions are exported
