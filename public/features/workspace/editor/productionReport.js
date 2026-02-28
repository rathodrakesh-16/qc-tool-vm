// Production Report Logic (Editor View)
import { workspaceState } from '../state/workspaceState.js';

const productionReportState = {
    familyStats: {},
    errorStats: {},
    existingSort: { column: 'status', direction: 'asc' }
};

// Initialize Production Report Tab
export function initializeProductionReportTab() {

    // Calculate stats
    calculateProductionFamilyStats();

    // Render sections
    renderProductionSummarySection();
    renderExistingClassifications();
    renderProductionFamilywiseDetails();

    // Setup interactions (tabs)
    setupProductionReportInteractions();

    // Default View
    toggleProductionReportSection('existing');
}

function setupProductionReportInteractions() {
    // onclick handlers are now set directly in HTML on the menu buttons
}

export function toggleProductionReportSection(view) {
    // Menu buttons
    const menuBtns = {
        existing: document.getElementById('prodRepExistingTab'),
        family: document.getElementById('prodRepFamilyTab'),
        errors: document.getElementById('prodRepErrorsTab')
    };

    // Content sections
    const sections = {
        existing: document.getElementById('productionReportExistingContent'),
        family: document.getElementById('productionReportFamilyContent'),
        errors: document.getElementById('productionReportProducedErrors')
    };

    // Reset all menu buttons and hide all sections
    Object.values(menuBtns).forEach(btn => {
        if (btn) btn.classList.remove('active');
    });
    Object.values(sections).forEach(section => {
        if (section) section.classList.remove('active');
    });

    // Activate selected menu button and show selected section
    if (menuBtns[view]) menuBtns[view].classList.add('active');
    if (sections[view]) sections[view].classList.add('active');
}

// --- Family Wise Section ---

export function calculateProductionFamilyStats() {
    const stats = {};
    const unworkedByFamily = {};

    // 1. Identify Existing vs Added from Workspace State
    const existingHeadingsMap = new Map();
    if (workspaceState.existingHeadings) {
        workspaceState.existingHeadings.forEach(h => existingHeadingsMap.set(h.name, h));
    }

    // 2. Track Headings in PDMs
    if (workspaceState.savedPDMs) {
        workspaceState.savedPDMs.forEach(pdm => {
            if (!pdm.headings) return;

            // PDM Level Stats
            const familiesInPDM = new Set();
            pdm.headings.forEach(heading => {
                // Use groupingFamily for statistics (prevents double-counting)
                // Fallback to family if groupingFamily is missing
                const family = heading.groupingFamily || heading.family || 'Unknown';
                familiesInPDM.add(family);

                if (!stats[family]) {
                    stats[family] = {
                        existingHeadings: new Set(),
                        rankedHeadings: new Set(),
                        addedHeadings: new Set(),
                        totalPDMs: 0,
                        checkedPDMs: 0,
                        defectivePDMs: 0,
                        pdmIds: new Set(),
                        checkedPdmIds: new Set(),
                        defectivePdmIds: new Set(),
                        editors: new Set(),
                        qcUsers: new Set()
                    };
                }

                // Check if this specific heading instance (by name) is existing
                const existingData = existingHeadingsMap.get(heading.name);
                if (existingData) {
                    // Check rank points to distinguish Existing (0) vs Ranked (!=0)
                    // Note: existingHeadingsMap values come from initial import
                    const rank = existingData.rankPoints;
                    // Use loose equality for '0' vs 0 checks if needed, or stick to string conversion if consistent
                    // Based on production.js determineStatus:
                    const rankStr = String(rank).trim();

                    if (rankStr.includes('$')) {
                        stats[family].rankedHeadings.add(heading.name);
                    } else if (rankStr === '0') {
                        stats[family].existingHeadings.add(heading.name);
                    } else {
                        // It's in the import but has rank != 0 -> Ranked
                        stats[family].rankedHeadings.add(heading.name);
                    }
                } else {
                    stats[family].addedHeadings.add(heading.name);
                }
            });

            // Update PDM stats for each family touched by this PDM
            familiesInPDM.forEach(family => {
                if (!stats[family].pdmIds.has(pdm.id)) {
                    stats[family].pdmIds.add(pdm.id);
                    stats[family].totalPDMs++;
                }

                if (pdm.qcStatus) {
                    if (!stats[family].checkedPdmIds.has(pdm.id)) {
                        stats[family].checkedPdmIds.add(pdm.id);
                        stats[family].checkedPDMs++;
                    }
                    if (pdm.qcStatus === 'error') {
                        if (!stats[family].defectivePdmIds.has(pdm.id)) {
                            stats[family].defectivePdmIds.add(pdm.id);
                            stats[family].defectivePDMs++;
                        }
                    }
                }

                if (pdm.createdBy) stats[family].editors.add(pdm.createdBy);
                if (pdm.qcFeedback && pdm.qcFeedback.user) stats[family].qcUsers.add(pdm.qcFeedback.user);
            });
        });
    }

    // Convert Sets to counts and lists
    Object.keys(stats).forEach(family => {
        const familyData = stats[family];
        familyData.existingCount = familyData.existingHeadings.size;
        familyData.rankedCount = familyData.rankedHeadings.size;
        familyData.addedCount = familyData.addedHeadings.size;

        // Calculate unworked headings for this family
        // Unworked = Headings with status 'existing' or 'ranked' from importedHeadings/supportedHeadings
        // that belong to this family but are NOT in any PDM yet
        let unworkedCount = 0;

        // Get all heading IDs that are already in PDMs for this family
        const usedHeadingIds = new Set();
        if (workspaceState.savedPDMs) {
            workspaceState.savedPDMs.forEach(pdm => {
                if (pdm.headings) {
                    pdm.headings.forEach(heading => {
                        const hFamily = heading.groupingFamily || heading.family || 'Unknown';
                        if (hFamily === family) {
                            usedHeadingIds.add(heading.id);
                        }
                    });
                }
            });
        }

        // Count unworked headings from registry (using importedHeadingIds and supportedHeadingIds)
        let unworkedRankedCount = 0;

        const processUnworkedFromRegistry = (headingIds) => {
            if (!headingIds) return;
            headingIds.forEach(id => {
                const heading = workspaceState.headingsRegistry[id];
                if (!heading) return;

                const hFamily = heading.groupingFamily || heading.family || 'Unknown';
                if (hFamily !== family) return;
                if (usedHeadingIds.has(heading.id)) return;

                // Determine Status dynamically to be safe
                const rank = heading.rankPoints;
                const rankStr = String(rank).trim();
                let isRanked = false;
                let isExisting = false;

                if (rankStr.includes('$')) isRanked = true;
                else if (rankStr === '0') isExisting = true;
                else if (rankStr !== '' && rank != null) isRanked = true;

                if (isExisting || isRanked) {
                    unworkedCount++;
                }
                if (isRanked) {
                    unworkedRankedCount++;
                }
            });
        };

        // Process unworked from registry
        processUnworkedFromRegistry(workspaceState.importedHeadingIds);
        processUnworkedFromRegistry(workspaceState.supportedHeadingIds);

        familyData.unworkedExistingCount = unworkedCount;
        familyData.unworkedRankedCount = unworkedRankedCount;

        familyData.editorsList = Array.from(familyData.editors);
        familyData.qcUsersList = Array.from(familyData.qcUsers);
    });

    productionReportState.familyStats = stats;
}

export function renderProductionFamilywiseDetails() {
    const container = document.getElementById('productionReportFamilyContent');
    if (!container) return;

    const stats = productionReportState.familyStats;
    const families = Object.keys(stats).sort();

    if (families.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8;">No family data available.</div>';
        return;
    }

    container.innerHTML = `
        <div class="production-report-familywise-list-container">
            <div class="production-report-table-list-header">
                <div class="report-column text-left">Family Name</div>
                <div class="report-column">Existing</div>
                <div class="report-column">Added</div>
                <div class="report-column">Ranked</div>
                <div class="report-column">Unworked</div>
                <div class="report-column">Total PDMs</div>
                <div class="report-column">Checked</div>
                <div class="report-column">Defective</div>
                <div class="report-column">Editor Name</div>
                <div class="report-column">QC Name</div>
            </div>
            <div class="production-report-table-list-body">
                ${families.map(family => {
        const data = stats[family];
        const editorsText = data.editorsList.length > 0 ? data.editorsList.join(', ') : '—';
        const qcText = data.qcUsersList.length > 0 ? data.qcUsersList.join(', ') : '—';

        return `
                        <div class="production-report-table-list-row">
                            <div class="report-column text-left" title="${family}">${family}</div>
                            <div class="report-column">${data.existingCount}</div>
                            <div class="report-column">${data.addedCount}</div>
                            <div class="report-column">
                                ${data.unworkedRankedCount > 0
                ? `<span style="color:#d97706; font-weight:600;">${data.unworkedRankedCount}</span>`
                : '0'}
                            </div>
                            <div class="report-column">
                                ${data.unworkedExistingCount > 0
                ? `<span style="color:#d97706; font-weight:600;">${data.unworkedExistingCount}</span>`
                : '0'}
                            </div>
                            <div class="report-column">${data.totalPDMs}</div>
                            <div class="report-column">${data.checkedPDMs}</div>
                            <div class="report-column">
                                ${data.defectivePDMs > 0
                ? `<span style="color:#dc2626; font-weight:600;">${data.defectivePDMs}</span>`
                : '0'}
                            </div>
                            <div class="report-column" title="${editorsText}">${editorsText}</div>
                            <div class="report-column" title="${qcText}">${qcText}</div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;
}

// --- Existing Classifications Section ---

function toggleExistingSort(column) {
    const current = productionReportState.existingSort;
    if (current.column === column) {
        current.direction = current.direction === 'asc' ? 'desc' : 'asc';
    } else {
        current.column = column;
        current.direction = 'asc';
    }
    renderExistingClassifications();
}

// Window bridge removed - function is exported

export function renderExistingClassifications() {
    const container = document.getElementById('productionReportExistingContent');
    if (!container) return;

    const existingHeadings = workspaceState.existingHeadings || [];

    // Create a set of all heading IDs that are currently used in any PDM
    const usedHeadingIds = new Set();
    if (workspaceState.savedPDMs) {
        workspaceState.savedPDMs.forEach(pdm => {
            if (pdm.headings) {
                pdm.headings.forEach(heading => {
                    if (heading.id) {
                        usedHeadingIds.add(heading.id);
                    }
                });
            }
        });
    }

    if (existingHeadings.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">No existing classifications loaded from Before Proof file.</div>';
        return;
    }

    // Prepare data for sorting
    let items = existingHeadings.map(heading => {
        const isSupported = usedHeadingIds.has(heading.id);
        const displayStatus = isSupported ? 'Supported' : 'Not Supported';
        return { ...heading, isSupported, displayStatus };
    });

    // Apply Sorting
    const { column, direction } = productionReportState.existingSort || { column: null };
    if (column === 'status') {
        items.sort((a, b) => {
            if (direction === 'asc') return a.displayStatus.localeCompare(b.displayStatus);
            return b.displayStatus.localeCompare(a.displayStatus);
        });
    }

    container.innerHTML = `
        <div class="production-report-familywise-list-container">
            <div class="production-report-table-list-header">
                <div class="report-column" data-production-existing-sort="status" style="cursor: pointer;">
                    Status 
                    <i class="fas fa-sort" style="margin-left: 5px;"></i>
                </div>
                <div class="report-column">Classification ID</div>
                <div class="report-column text-left">Classification</div>
                <div class="report-column">Rank Points</div>
                <div class="report-column text-left">Family</div>
                <div class="report-column">Company Type</div>
                <div class="report-column">Profile Description</div>
                <div class="report-column text-left">Site Link</div>
                <div class="report-column text-left">Quality</div>
                <div class="report-column">Last Updated</div>
            </div>
            <div class="production-report-table-list-body">
                ${items.map(heading => {
        const displayValue = (val) => val !== null && val !== undefined && val !== '' ? val : '—';
        const statusStyle = heading.isSupported ? 'color: #16a34a;' : 'color: #dc2626;';

        return `
                        <div class="production-report-table-list-row">
                            <div class="report-column" style="${statusStyle}">${heading.displayStatus}</div>
                            <div class="report-column" title="${heading.id}">${heading.id}</div>
                            <div class="report-column text-left" title="${heading.name}">${heading.name}</div>
                            <div class="report-column">${displayValue(heading.rankPoints)}</div>
                            <div class="report-column text-left" title="${heading.family || ''}">${displayValue(heading.family)}</div>
                            <div class="report-column" title="${heading.companyType || ''}">${displayValue(heading.companyType)}</div>
                            <div class="report-column" title="${heading.profileDescription || ''}">${displayValue(heading.profileDescription)}</div>
                            <div class="report-column text-left" title="${heading.siteLink || ''}">${displayValue(heading.siteLink)}</div>
                            <div class="report-column text-left" title="${heading.quality || ''}">${displayValue(heading.quality)}</div>
                            <div class="report-column" title="${heading.lastUpdated || ''}">${displayValue(heading.lastUpdated)}</div>
                        </div>
                    `;
    }).join('')}
            </div>
        </div>
    `;

    const sortTrigger = container.querySelector('[data-production-existing-sort]');
    if (sortTrigger) {
        sortTrigger.addEventListener('click', () => {
            const column = sortTrigger.dataset.productionExistingSort;
            if (column) toggleExistingSort(column);
        });
    }
}

// --- Summary Section ---

export function renderProductionSummarySection() {
    const container = document.getElementById('productionReportProducedErrors');
    if (!container) return;

    // Filter PDMs with errors (Active Defective OR Resolved with History)
    let errorPDMs = (typeof workspaceState !== 'undefined' && workspaceState.savedPDMs) ?
        workspaceState.savedPDMs.filter(pdm => pdm.qcStatus === 'error' || (pdm.qcFeedback && pdm.qcFeedback.errors && pdm.qcFeedback.errors.length > 0)) : [];

    // Add Account Level Errors (Missed Headings)
    if (typeof workspaceState !== 'undefined' && workspaceState.accountLevelErrors) {
        // We need to map these error objects to look like PDMs for the renderer
        const accountErrorsAsPDMs = workspaceState.accountLevelErrors.map(err => {
            return {
                id: 'Global', // Display Global in PDM Number column
                url: '',
                isAccountLevel: true, // Marker
                qcStatus: err.qcStatus || 'error',
                qcFeedback: {
                    errors: [err.errorCategory], // "Missed Heading"
                    comment: err.qcFeedback ? err.qcFeedback.comment : '—', // Heading Name
                    user: err.user
                },
                rectificationStatus: err.rectificationStatus || 'Pending',
                validationStatus: err.validationStatus || 'Pending',
                createdBy: '—' // Editor Name
            };
        });
        errorPDMs = [...errorPDMs, ...accountErrorsAsPDMs];
    }

    if (errorPDMs.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">No production errors found.</div>';
        return;
    }

    container.innerHTML = `
        <div class="production-report-familywise-list-container">
            <div class="production-report-table-list-header">
                <div class="report-column fit-content">PDM Number</div>
                <div class="report-column text-left col-max-200">Error Category</div>
                <div class="report-column text-left col-max-200">QC Comments</div>
                <div class="report-column">Editor Name</div>
                <div class="report-column">QC Name</div>
                <div class="report-column">Rectification Status</div>
                <div class="report-column">Validation Status</div>
            </div>
            <div class="production-report-table-list-body">
                ${errorPDMs.map(pdm => {
        const errors = pdm.qcFeedback && pdm.qcFeedback.errors && pdm.qcFeedback.errors.length > 0
            ? pdm.qcFeedback.errors
            : ['—'];

        return errors.map(errorCat => {
            const qcComments = pdm.qcFeedback && pdm.qcFeedback.comment ? pdm.qcFeedback.comment : '—';
            const editorName = pdm.createdBy || '—';
            const qcName = pdm.qcFeedback && pdm.qcFeedback.user ? pdm.qcFeedback.user : '—';
            const rectificationStatus = pdm.rectificationStatus || 'Pending';
            const validationStatus = pdm.validationStatus || 'Pending';


            return `
                        <div class="production-report-table-list-row">
                             <div class="report-column fit-content" title="${pdm.url || ''}">${pdm.id || '—'}</div>
                             <div class="report-column text-left col-max-200" title="${errorCat}">${errorCat}</div>
                             <div class="report-column text-left col-max-200" title="${qcComments}">${qcComments}</div>
                             <div class="report-column" title="${editorName}">${editorName}</div>
                             <div class="report-column" title="${qcName}">${qcName}</div>
                             <div class="report-column">${rectificationStatus}</div>
                             <div class="report-column">${validationStatus}</div>
                        </div>
                    `;
        }).join('');
    }).join('')}
            </div>
        </div>
    `;
}

export function getProductionFamilyStats() {
    calculateProductionFamilyStats();
    return productionReportState.familyStats;
}
