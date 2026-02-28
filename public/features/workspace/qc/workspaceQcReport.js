// Workspace QC Report Logic
import { workspaceState } from '../state/workspaceState.js';
import { workspaceAccountsState } from '../state/workspaceAccountsState.js';
import { getHeadingsFromRegistry, saveCurrentWorkspaceData } from '../workspace.js';
import { assignedAccountsData } from '../../dashboard/dashboard.js';

const qcReportState = {
    familyStats: {},
    errorStats: {},
    existingSort: { column: 'status', direction: 'asc' }
};

// Initialize QC Report Tab
export function initializeQCReportTab() {

    // Calculate stats
    calculateQCFamilyStats();
    calculateProductionErrorStats();

    // Render all sections
    renderSummarySection();
    renderQCFamilywiseDetails();
    renderQCExistingClassifications();
    renderAccountSummarySection();

    // Default to Summary view
    switchReportView('summary');
}

// Switch between report views
export function switchReportView(view) {
    // Menu buttons
    const menuBtns = {
        summary: document.getElementById('menuSummary'),
        family: document.getElementById('menuFamilyWise'),
        existing: document.getElementById('menuExisting'),
        errors: document.getElementById('menuProductionErrors')
    };

    // Content sections
    const sections = {
        summary: document.getElementById('qcSummarySection'),
        family: document.getElementById('qcFamilyWiseSection'),
        existing: document.getElementById('qcExistingSection'),
        errors: document.getElementById('qcProductionErrorsSection')
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

// Window bridge removed - switchReportView is exported

function renderQCMetaDataSection() {
    const container = document.getElementById('qcMetadataContent');
    if (!container) return;

    // 1. Account Info from Dashboard Data (Priority)
    let accountName = '—';
    let accountId = '—';
    let qcName = '—';
    let editorName = '—';
    let coproWritten = 'No';

    const currentAccountId = workspaceState.selectedAccount || localStorage.getItem('qc_tool_active_account_id');

    // Try finding account in global states
    let accountInfo = null;
    if (currentAccountId) {
        if (typeof workspaceAccountsState !== 'undefined' && workspaceAccountsState.allAccounts) {
            accountInfo = workspaceAccountsState.allAccounts.find(acc => acc.id === currentAccountId);
        }
        if (!accountInfo && typeof assignedAccountsData !== 'undefined') {
            accountInfo = assignedAccountsData.find(acc => acc.id === currentAccountId);
        }
    }

    if (accountInfo) {
        accountName = accountInfo.name || '—';
        accountId = accountInfo.id || '—';
        qcName = accountInfo.qc || '—';
        editorName = accountInfo.editor || '—';
    } else {
        // Fallback to simple state/local storage if not found in dashboard data
        accountName = workspaceState.accountName || accountName;
        accountId = workspaceState.accountId || accountId;
        qcName = workspaceState.qcName || qcName;
        editorName = workspaceState.editorName || editorName;

        // Try localStorage fallback
        try {
            const savedDetails = JSON.parse(localStorage.getItem('accountDetails') || '{}');
            if (savedDetails) {
                if (accountName === '—') accountName = savedDetails.accountName || '—';
                if (accountId === '—') accountId = savedDetails.accountId || '—';
                if (qcName === '—') qcName = savedDetails.qcName || '—';
                if (editorName === '—') editorName = savedDetails.editorName || '—';
            }
        } catch (e) { }
    }

    // 2. CoPro Written: Check PDM Library
    if (workspaceState.savedPDMs && workspaceState.savedPDMs.length > 0) {
        const hasCoPro = workspaceState.savedPDMs.some(pdm => pdm.isCoPro === true || (pdm.id && String(pdm.id).startsWith('COPRO-')));
        if (hasCoPro) {
            coproWritten = 'Yes';
        }
    }
    if (typeof coproWritten === 'string') {
        if (coproWritten.toLowerCase() === 'yes') coproWritten = 'Yes';
        else if (coproWritten.toLowerCase() === 'no') coproWritten = 'No';
    }

    // Calculate Stats
    const uniqueExistingHeadingsFound = new Set();
    const uniqueAddedHeadingsFound = new Set();
    const pdmsWithExisting = new Set();
    const pdmsWithAdded = new Set();

    const existingHeadingsMap = new Set();
    if (workspaceState.existingHeadings) {
        workspaceState.existingHeadings.forEach(h => existingHeadingsMap.add(h.name));
    }

    if (workspaceState.savedPDMs) {
        workspaceState.savedPDMs.forEach(pdm => {
            let hasExisting = false;
            let hasAdded = false;
            if (pdm.headings) {
                pdm.headings.forEach(h => {
                    if (existingHeadingsMap.has(h.name)) {
                        uniqueExistingHeadingsFound.add(h.name);
                        hasExisting = true;
                    } else {
                        uniqueAddedHeadingsFound.add(h.name);
                        hasAdded = true;
                    }
                });
            }
            if (hasExisting) pdmsWithExisting.add(pdm.id);
            if (hasAdded) pdmsWithAdded.add(pdm.id);
        });
    }

    // "Existing Headings": Interpreted as Unique Existing Headings WORKED/FOUND
    const existingHeadingsCount = uniqueExistingHeadingsFound.size;
    const addedHeadingsCount = uniqueAddedHeadingsFound.size;

    // "Unique links": Count of PDMs containing such headings
    const existingLinksCount = pdmsWithExisting.size;
    const addedLinksCount = pdmsWithAdded.size;

    // "Unworked Existing Headings": Total Available - Unique Found
    const totalAvailableExisting = existingHeadingsMap.size;
    const unworkedExistingCount = Math.max(0, totalAvailableExisting - existingHeadingsCount);

    container.innerHTML = `
        <div class="qc-familywise-list-container">
            <div class="qc-table-list-body">
                <div class="qc-table-list-row">
                    <div class="report-column" style="text-align: left; font-weight: 600; color: #475569;">Account Name</div>
                    <div class="report-column" style="text-align: left; color: #1e293b; font-weight: 500;">${accountName}</div>
                </div>
                <div class="qc-table-list-row">
                    <div class="report-column" style="text-align: left; font-weight: 600; color: #475569;">Account ID</div>
                    <div class="report-column" style="text-align: left; color: #1e293b; font-weight: 500;">${accountId}</div>
                </div>
                <div class="qc-table-list-row">
                    <div class="report-column" style="text-align: left; font-weight: 600; color: #475569;">QC Name</div>
                    <div class="report-column" style="text-align: left; color: #1e293b; font-weight: 500;">${qcName}</div>
                </div>
                <div class="qc-table-list-row">
                    <div class="report-column" style="text-align: left; font-weight: 600; color: #475569;">Editor Name</div>
                    <div class="report-column" style="text-align: left; color: #1e293b; font-weight: 500;">${editorName}</div>
                </div>
                <div class="qc-table-list-row">
                    <div class="report-column" style="text-align: left; font-weight: 600; color: #475569;">CoPro Written</div>
                    <div class="report-column" style="text-align: left; color: #1e293b; font-weight: 500;">${coproWritten}</div>
                </div>
                <div class="qc-table-list-row">
                    <div class="report-column" style="text-align: left; font-weight: 600; color: #475569;">Existing Headings</div>
                    <div class="report-column" style="text-align: left; color: #1e293b; font-weight: 500;">${existingHeadingsCount}</div>
                </div>
                <div class="qc-table-list-row">
                    <div class="report-column" style="text-align: left; font-weight: 600; color: #475569;">Unique links for existing Headings</div>
                    <div class="report-column" style="text-align: left; color: #1e293b; font-weight: 500;">${existingLinksCount}</div>
                </div>
                <div class="qc-table-list-row">
                    <div class="report-column" style="text-align: left; font-weight: 600; color: #475569;">Added Headings</div>
                    <div class="report-column" style="text-align: left; color: #1e293b; font-weight: 500;">${addedHeadingsCount}</div>
                </div>
                <div class="qc-table-list-row">
                    <div class="report-column" style="text-align: left; font-weight: 600; color: #475569;">Unique links for added Headings</div>
                    <div class="report-column" style="text-align: left; color: #1e293b; font-weight: 500;">${addedLinksCount}</div>
                </div>
                <div class="qc-table-list-row">
                    <div class="report-column" style="text-align: left; font-weight: 600; color: #475569;">Unworked Existing Headings</div>
                    <div class="report-column" style="text-align: left; color: #1e293b; font-weight: 500;">${unworkedExistingCount}</div>
                </div>
            </div>
        </div>
    `;

}

// --- Family Wise Section ---

export function calculateQCFamilyStats() {
    const stats = {};

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
                // Use groupingFamily for consistency with Production Report
                // Fallback sequence: groupingFamily -> family -> existingData.family -> Unknown
                let family = heading.groupingFamily || heading.family;

                // If not found on instance, try looking up in registry/existing map
                if (!family) {
                    const existingData = existingHeadingsMap.get(heading.name);
                    if (existingData) {
                        family = existingData.groupingFamily || existingData.family;
                    }
                }

                // Final fallback
                family = family || 'Unknown';

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
                    const rank = existingData.rankPoints;
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

        // Count unworked headings from importedHeadings
        let unworkedRankedCount = 0;

        const processUnworked = (list) => {
            if (!list) return;
            list.forEach(heading => {
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
        const importedHeadings = getHeadingsFromRegistry(workspaceState.importedHeadingIds);
        const supportedHeadings = getHeadingsFromRegistry(workspaceState.supportedHeadingIds);
        processUnworked(importedHeadings);
        processUnworked(supportedHeadings);

        familyData.unworkedExistingCount = unworkedCount;
        familyData.unworkedRankedCount = unworkedRankedCount;

        familyData.editorsList = Array.from(familyData.editors);
        familyData.qcUsersList = Array.from(familyData.qcUsers);
    });

    qcReportState.familyStats = stats;
}

export function renderQCFamilywiseDetails() {
    const container = document.getElementById('qcFamilyWiseSection');
    if (!container) return;

    const stats = qcReportState.familyStats;
    const families = Object.keys(stats).sort();

    if (families.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8;">No family data available.</div>';
        return;
    }

    container.innerHTML = `
        <div class="qc-familywise-list-container">
            <div class="qc-table-list-header">
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
            <div class="qc-table-list-body">
                ${families.map(family => {
        const data = stats[family];
        const editorsText = data.editorsList.length > 0 ? data.editorsList.join(', ') : '—';
        const qcText = data.qcUsersList.length > 0 ? data.qcUsersList.join(', ') : '—';

        return `
                        <div class="qc-table-list-row">
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

// --- QC Existing Classifications Section ---

function toggleQCExistingSort(column) {
    const current = qcReportState.existingSort;
    if (current.column === column) {
        current.direction = current.direction === 'asc' ? 'desc' : 'asc';
    } else {
        current.column = column;
        current.direction = 'asc';
    }
    renderQCExistingClassifications();
}

// Window bridge removed - toggleQCExistingSort is exported

export function renderQCExistingClassifications() {
    const container = document.getElementById('qcExistingSection');
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
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">No existing classifications loaded.</div>';
        return;
    }

    // Prepare data for sorting
    let items = existingHeadings.map(heading => {
        const isSupported = usedHeadingIds.has(heading.id);
        const displayStatus = isSupported ? 'Supported' : 'Not Supported';
        return { ...heading, isSupported, displayStatus };
    });

    // Apply Sorting
    const { column, direction } = qcReportState.existingSort || { column: null };
    if (column === 'status') {
        items.sort((a, b) => {
            if (direction === 'asc') return a.displayStatus.localeCompare(b.displayStatus);
            return b.displayStatus.localeCompare(a.displayStatus);
        });
    }

    container.innerHTML = `
        <div class="qc-familywise-list-container">
            <div class="qc-table-list-header">
                <div class="report-column" data-qc-existing-sort="status" style="cursor: pointer;">
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
            <div class="qc-table-list-body">
                ${items.map(heading => {
        const displayValue = (val) => val !== null && val !== undefined && val !== '' ? val : '—';
        const statusStyle = heading.isSupported ? 'color: #16a34a;' : 'color: #dc2626;';

        return `
                        <div class="qc-table-list-row">
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

    const sortTrigger = container.querySelector('[data-qc-existing-sort]');
    if (sortTrigger) {
        sortTrigger.addEventListener('click', () => {
            const column = sortTrigger.dataset.qcExistingSort;
            if (column) toggleQCExistingSort(column);
        });
    }
}

// --- Production Error Section ---

export function calculateProductionErrorStats() {
    let totalHeadings = 0;
    let totalErrors = 0;
    const errorCounts = {};

    // Don't pre-initialize counts for all categories
    // This allows the list to be dynamic based on actual feedback

    if (workspaceState && workspaceState.savedPDMs) {
        workspaceState.savedPDMs.forEach(pdm => {
            if (pdm.headings) {
                totalHeadings += pdm.headings.length;
            }

            // check for errors regardless of current status (historical record)
            if (pdm.qcFeedback && pdm.qcFeedback.errors) {
                pdm.qcFeedback.errors.forEach(err => {
                    // Check if it's a known category or add it dynamically if custom errors allowed
                    if (errorCounts[err] === undefined) {
                        errorCounts[err] = 0;
                    }
                    errorCounts[err]++;
                    totalErrors++;
                });
            }
        });
    }

    // Add Account Level Errors (Missed Headings)
    if (workspaceState && workspaceState.accountLevelErrors) {
        workspaceState.accountLevelErrors.forEach(err => {
            const cat = err.errorCategory;
            if (errorCounts[cat] === undefined) {
                errorCounts[cat] = 0;
            }
            errorCounts[cat]++;
            totalErrors++;
            // A missed heading essentially adds 1 to the total headings universe (it was missing from PDMs but exists)
            totalHeadings++;
        });
    }

    const errorPercentage = totalHeadings > 0 ? ((totalErrors / totalHeadings) * 100).toFixed(2) : '0.00';

    // Calculate Quality Score (100% - Error Percentage)
    const qualityScore = (100 - parseFloat(errorPercentage)).toFixed(2);

    // Only include categories that have errors > 0
    const activeCategories = Object.keys(errorCounts).filter(k => errorCounts[k] > 0);

    qcReportState.errorStats = {
        totalHeadings,
        totalErrors,
        errorPercentage,
        qualityScore,
        errorCounts,
        categories: activeCategories
    };
}

// Global Delete Error Function
function deleteQCError(type, id, errorCat) {
    if (!confirm(`Are you sure you want to delete this error: "${errorCat}"?`)) return;

    if (type === 'pdm') {
        if (typeof workspaceState !== 'undefined' && workspaceState.savedPDMs) {
            const pdmIndex = workspaceState.savedPDMs.findIndex(p => p.id === id);
            if (pdmIndex > -1) {
                const pdm = workspaceState.savedPDMs[pdmIndex];
                if (pdm.qcFeedback && pdm.qcFeedback.errors) {
                    // Remove error
                    pdm.qcFeedback.errors = pdm.qcFeedback.errors.filter(e => e !== errorCat);

                    // If no errors left, update status (optional: revert to pending or just remove error status?)
                    // User requirement: "remove the errors". If NO errors left, it shouldn't be defective anymore logically.
                    if (pdm.qcFeedback.errors.length === 0) {
                        pdm.qcStatus = 'pending'; // Revert to pending so it disappears from defective list
                        // Also clear comment about errors? Maybe simpler to leave comment.
                    }

                    // Save
                    saveCurrentWorkspaceData();

                    // Refresh Reports
                    initializeQCReportTab();
                    alert('Error deleted successfully.');
                }
            }
        }
    } else if (type === 'account') {
        if (typeof workspaceState !== 'undefined' && workspaceState.accountLevelErrors) {
            // Filter out the error by ID
            const originalLength = workspaceState.accountLevelErrors.length;
            workspaceState.accountLevelErrors = workspaceState.accountLevelErrors.filter(err => err.id !== id);

            if (workspaceState.accountLevelErrors.length < originalLength) {
                // Save
                saveCurrentWorkspaceData();

                // Refresh Reports
                initializeQCReportTab();
                alert('Account error deleted successfully.');
            }
        }
    }
}

// Make global
// Window bridge removed - deleteQCError is exported

function renderProductionErrorSection() {
    const container = document.getElementById('qcProductionErrorContent');
    if (!container) return;

    const stats = qcReportState.errorStats;

    container.innerHTML = `
        <div class="error-stats-grid">
            <div class="error-stat-card">
                <div class="error-stat-value">${stats.totalErrors}</div>
                <div class="error-stat-label">Total Errors</div>
            </div>
            <div class="error-stat-card">
                <div class="error-stat-value">${stats.totalHeadings}</div>
                <div class="error-stat-label">Total Headings</div>
            </div>
            <div class="error-stat-card">
                <div class="error-stat-value">${stats.errorPercentage}%</div>
                <div class="error-stat-label">Error Percentage</div>
            </div>
        </div>

        <div class="error-list-container">
            <div class="error-list-header">
                <div class="report-column text-left">Error Category</div>
                <div class="report-column">Count</div>
                <div class="report-column">Distribution</div>
            </div>
            <div class="error-list-body">
                ${stats.categories.length > 0 ? stats.categories.map(cat => {
        const count = stats.errorCounts[cat] || 0;
        const percentage = stats.totalErrors > 0 ? ((count / stats.totalErrors) * 100).toFixed(1) : '0.0';
        return `
                        <div class="error-list-row">
                            <div class="report-column text-left">${cat}</div>
                            <div class="report-column">
                                ${count > 0
                ? `<span class="error-count-badge">${count}</span>`
                : '<span style="color:#cbd5e1;">0</span>'}
                            </div>
                            <div class="report-column">
                                <div class="error-dist-bar-container" style="width: 100%; height: 6px; background-color: #f1f5f9; border-radius: 3px; overflow: hidden; margin-bottom: 4px;">
                                    <div style="width: ${percentage}%; height: 100%; background-color: #ef4444; border-radius: 3px;"></div>
                                </div>
                                <div style="font-size: 10px; color: #94a3b8; text-align: right;">${percentage}%</div>
                            </div>
                        </div>
                    `;
    }).join('') : '<div style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">No errors found.</div>'}
            </div>
        </div>
    `;
}

// --- Account Summary Section ---

export function renderAccountSummarySection() {
    const container = document.getElementById('qcProductionErrorsSection');
    if (!container) return;

    // Filter PDMs with errors (Active Defective OR Resolved with History)
    let errorPDMs = (typeof workspaceState !== 'undefined' && workspaceState.savedPDMs) ?
        workspaceState.savedPDMs.filter(pdm => pdm.qcStatus === 'error' || (pdm.qcFeedback && pdm.qcFeedback.errors && pdm.qcFeedback.errors.length > 0)) : [];

    // Add Account Level Errors (Missed Headings)
    if (typeof workspaceState !== 'undefined' && workspaceState.accountLevelErrors) {
        const accountErrorsAsPDMs = workspaceState.accountLevelErrors.map(err => {
            return {
                id: 'Global',
                uniqueId: err.id, // Store real ID for deletion
                url: '',
                isAccountLevel: true,
                qcStatus: err.qcStatus || 'error',
                qcFeedback: {
                    errors: [err.errorCategory],
                    comment: err.qcFeedback ? err.qcFeedback.comment : '—',
                    user: err.user
                },
                rectificationStatus: err.rectificationStatus || 'Pending',
                validationStatus: err.validationStatus || 'Pending',
                createdBy: '—'
            };
        });
        errorPDMs = [...errorPDMs, ...accountErrorsAsPDMs];
    }

    if (errorPDMs.length === 0) {
        container.innerHTML = '<div style="padding: 20px; text-align: center; color: #94a3b8; font-style: italic;">No production errors found.</div>';
        return;
    }

    container.innerHTML = `
        <div class="qc-familywise-list-container">
            <div class="qc-table-list-header">
                <div class="report-column fit-content">PDM Number</div>
                <div class="report-column text-left">Error Category</div>
                <div class="report-column text-left">QC Comments</div>
                <div class="report-column">Editor Name</div>
                <div class="report-column">QC Name</div>
                <div class="report-column">Rectification Status</div>
                <div class="report-column">Validation Status</div>
                <div class="report-column">Action</div>
            </div>
            <div class="qc-table-list-body">
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

            const isAccountError = pdm.isAccountLevel === true;
            const uniqueId = pdm.uniqueId || pdm.id;
            const type = isAccountError ? 'account' : 'pdm';

            // Only show delete button for actual errors, not placeholders
            const actionBtn = errorCat !== '—' ? `
                <button class="qc-error-delete-btn"
                        data-error-type="${type}"
                        data-error-id="${encodeURIComponent(String(uniqueId))}"
                        data-error-cat="${encodeURIComponent(errorCat)}"
                        style="width: 24px; height: 24px; padding: 0; min-width: unset; background: transparent; border: none; cursor: pointer;"
                        title="Delete Error">
                    <i class="fas fa-trash-alt"></i>
                </button>
            ` : '';

            return `
                        <div class="qc-table-list-row">
                             <div class="report-column fit-content" title="${pdm.url || ''}">${pdm.id || '—'}</div>
                             <div class="report-column text-left" title="${errorCat}">${errorCat}</div>
                             <div class="report-column text-left" title="${qcComments}">${qcComments}</div>
                             <div class="report-column" title="${editorName}">${editorName}</div>
                             <div class="report-column" title="${qcName}">${qcName}</div>
                             <div class="report-column">${rectificationStatus}</div>
                             <div class="report-column">${validationStatus}</div>
                             <div class="report-column">${actionBtn}</div>
                        </div>
                    `;
        }).join('');
    }).join('')}
            </div>
        </div>
    `;

    container.querySelectorAll('.qc-error-delete-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const type = btn.dataset.errorType;
            const id = btn.dataset.errorId ? decodeURIComponent(btn.dataset.errorId) : '';
            const errorCat = btn.dataset.errorCat ? decodeURIComponent(btn.dataset.errorCat) : '';
            if (type && id && errorCat) {
                deleteQCError(type, id, errorCat);
            }
        });
    });
}

// Helper: Get Unworked Headings (duplicated from pdmDetails.js to avoid dependency issues)
function getQCUnworkedHeadings() {
    if (typeof workspaceState === 'undefined') return [];

    const usedHeadingIds = new Set();

    if (workspaceState.supportedHeadingIds) {
        workspaceState.supportedHeadingIds.forEach(id => usedHeadingIds.add(id));
    }

    if (workspaceState.currentPDM && workspaceState.currentPDM.headings) {
        workspaceState.currentPDM.headings.forEach(h => usedHeadingIds.add(h.id));
    }

    if (workspaceState.savedPDMs) {
        workspaceState.savedPDMs.forEach(pdm => {
            if (pdm.headings) {
                pdm.headings.forEach(h => usedHeadingIds.add(h.id));
            }
        });
    }

    if (workspaceState.importedHeadingIds) {
        const importedHeadings = getHeadingsFromRegistry(workspaceState.importedHeadingIds);
        return importedHeadings.filter(heading => {
            const isRankedOrExisting = heading.status === 'ranked' || heading.status === 'existing';
            const isNotUsed = !usedHeadingIds.has(heading.id);
            return isRankedOrExisting && isNotUsed;
        });
    }

    return [];
}

// Export IET Function
export function exportIET() {

    // Filter PDMs with errors (Active Defective OR Resolved with History)
    let errorPDMs = (typeof workspaceState !== 'undefined' && workspaceState.savedPDMs) ?
        workspaceState.savedPDMs.filter(pdm => pdm.qcStatus === 'error' || (pdm.qcFeedback && pdm.qcFeedback.errors && pdm.qcFeedback.errors.length > 0)) : [];

    // Add Account Level Errors
    if (typeof workspaceState !== 'undefined' && workspaceState.accountLevelErrors) {
        const accountErrorsAsPDMs = workspaceState.accountLevelErrors.map(err => {
            return {
                id: 'Global',
                url: '',
                isAccountLevel: true,
                qcStatus: err.qcStatus || 'error',
                qcFeedback: {
                    errors: [err.errorCategory],
                    comment: err.qcFeedback ? err.qcFeedback.comment : '—',
                    user: err.user
                },
                rectificationStatus: err.rectificationStatus || 'Pending',
                validationStatus: err.validationStatus || 'Pending',
                isUpdated: false, // Legacy field for export
                isDescriptionUpdated: err.isDescriptionUpdated || false,
                createdBy: '—'
            };
        });
        errorPDMs = [...errorPDMs, ...accountErrorsAsPDMs];
    }

    if (errorPDMs.length === 0) {
        alert('No production errors to export.');
        return;
    }

    // Prepare data for Excel
    const data = [];

    // Header Row (removed "PDM Updated?" column)
    data.push(['PDM Number', 'Error Category', 'QC Comments', 'Editor Name', 'QC Name', 'Rectification Status', 'Validation Status']);

    // Data Rows
    errorPDMs.forEach(pdm => {
        const errors = pdm.qcFeedback && pdm.qcFeedback.errors && pdm.qcFeedback.errors.length > 0
            ? pdm.qcFeedback.errors
            : ['—'];

        errors.forEach(errorCat => {
            const row = [
                pdm.id || '',
                errorCat,
                (pdm.qcFeedback && pdm.qcFeedback.comment) ? pdm.qcFeedback.comment : '',
                pdm.createdBy || '',
                (pdm.qcFeedback && pdm.qcFeedback.user) ? pdm.qcFeedback.user : '',
                pdm.rectificationStatus || 'Pending',
                pdm.validationStatus || 'Pending'
            ];
            data.push(row);
        });
    });

    // Add two empty rows
    data.push([]);
    data.push([]);

    // Add Summary Stats (label in first column, value in second column)
    const stats = qcReportState.errorStats;
    data.push(['Total Worked Headings', stats.totalHeadings || 0]);
    data.push(['Total Defects', stats.totalErrors || 0]);
    data.push(['Error Percentage', (stats.errorPercentage || '0.00') + '%']);
    data.push(['Quality Score', (stats.qualityScore || '100.00') + '%']);

    // Generate Excel File
    const ws = XLSX.utils.aoa_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "IET Errors");

    // Filename with timestamp
    const date = new Date();
    const dateString = date.toISOString().slice(0, 10);
    const filename = `IET_Error_Report_${dateString}.xlsx`;

    XLSX.writeFile(wb, filename);
}

// --- Unified Summary Section ---

function copySummaryToClipboard() {
    const stats = qcReportState.errorStats;
    const metadataContainer = document.getElementById('qcSummaryMetadataContent');

    let copyText = '=== QC Summary ===\n\n';

    // Add stats
    copyText += `Total Worked Headings: ${stats.totalHeadings}\n`;
    copyText += `Total Defects: ${stats.totalErrors}\n`;
    copyText += `Error Percentage: ${stats.errorPercentage}%\n`;
    copyText += `Quality Score: ${stats.qualityScore}%\n\n`;

    // Add error categories
    if (stats.categories && stats.categories.length > 0) {
        copyText += '=== Error Categories ===\n\n';
        stats.categories.forEach(cat => {
            const count = stats.errorCounts[cat] || 0;
            copyText += `${cat}: ${count}\n`;
        });
        copyText += '\n';
    }

    // Add metadata
    copyText += '=== Account Details ===\n\n';
    if (metadataContainer) {
        const rows = metadataContainer.querySelectorAll('.qc-summary-metadata-row');
        rows.forEach(row => {
            const label = row.querySelector('.qc-summary-metadata-label');
            const value = row.querySelector('.qc-summary-metadata-value');
            if (label && value) {
                copyText += `${label.textContent}: ${value.textContent}\n`;
            }
        });
    }

    navigator.clipboard.writeText(copyText).then(() => {
        alert('Summary data copied to clipboard!');
    }).catch(err => {
        alert('Failed to copy to clipboard');
    });
}

export function renderSummarySection() {
    const container = document.getElementById('qcSummarySection');
    if (!container) return;

    const stats = qcReportState.errorStats;

    // ========== Build Error Categories HTML ==========
    let errorCategoriesHTML = '';
    if (stats.categories && stats.categories.length > 0) {
        errorCategoriesHTML = stats.categories.map(cat => {
            const count = stats.errorCounts[cat] || 0;
            const percentage = stats.totalErrors > 0 ? ((count / stats.totalErrors) * 100).toFixed(1) : '0.0';
            return `
                <div class="qc-summary-error-row">
                    <div class="qc-summary-error-category" title="${cat}">${cat}</div>
                    <div class="qc-summary-error-count">
                        <span class="error-count-badge">${count}</span>
                    </div>
                    <div class="qc-summary-error-dist">
                        <div class="qc-summary-error-dist-bar">
                            <div class="qc-summary-error-dist-fill" style="width: ${percentage}%;"></div>
                        </div>
                        <div class="qc-summary-error-dist-text">${percentage}%</div>
                    </div>
                </div>
            `;
        }).join('');
    } else {
        errorCategoriesHTML = '<div class="qc-summary-empty-state">No errors found</div>';
    }

    // ========== Get Account Info ==========
    let accountName = '—';
    let accountId = '—';
    let qcName = '—';
    let editorName = '—';
    let coproWritten = 'No';

    const currentAccountId = workspaceState.selectedAccount || localStorage.getItem('qc_tool_active_account_id');

    let accountInfo = null;
    if (currentAccountId) {
        if (typeof workspaceAccountsState !== 'undefined' && workspaceAccountsState.allAccounts) {
            accountInfo = workspaceAccountsState.allAccounts.find(acc => acc.id === currentAccountId);
        }
        if (!accountInfo && typeof assignedAccountsData !== 'undefined') {
            accountInfo = assignedAccountsData.find(acc => acc.id === currentAccountId);
        }
    }

    if (accountInfo) {
        accountName = accountInfo.name || '—';
        accountId = accountInfo.id || '—';
        qcName = accountInfo.qc || '—';
        editorName = accountInfo.editor || '—';
    } else {
        accountName = workspaceState.accountName || accountName;
        accountId = workspaceState.accountId || accountId;
        qcName = workspaceState.qcName || qcName;
        editorName = workspaceState.editorName || editorName;

        try {
            const savedDetails = JSON.parse(localStorage.getItem('accountDetails') || '{}');
            if (savedDetails) {
                if (accountName === '—') accountName = savedDetails.accountName || '—';
                if (accountId === '—') accountId = savedDetails.accountId || '—';
                if (qcName === '—') qcName = savedDetails.qcName || '—';
                if (editorName === '—') editorName = savedDetails.editorName || '—';
            }
        } catch (e) { }
    }

    // CoPro Written check
    if (workspaceState.savedPDMs && workspaceState.savedPDMs.length > 0) {
        const hasCoPro = workspaceState.savedPDMs.some(pdm => pdm.isCoPro === true || (pdm.id && String(pdm.id).startsWith('COPRO-')));
        if (hasCoPro) {
            coproWritten = 'Yes';
        }
    }

    // ========== Calculate Heading Stats ==========
    const uniqueExistingHeadingsFound = new Set();
    const uniqueAddedHeadingsFound = new Set();
    const pdmsWithExisting = new Set();
    const pdmsWithAdded = new Set();

    const existingHeadingsMap = new Set();
    if (workspaceState.existingHeadings) {
        workspaceState.existingHeadings.forEach(h => existingHeadingsMap.add(h.name));
    }

    if (workspaceState.savedPDMs) {
        workspaceState.savedPDMs.forEach(pdm => {
            let hasExisting = false;
            let hasAdded = false;
            if (pdm.headings) {
                pdm.headings.forEach(h => {
                    if (existingHeadingsMap.has(h.name)) {
                        uniqueExistingHeadingsFound.add(h.name);
                        hasExisting = true;
                    } else {
                        uniqueAddedHeadingsFound.add(h.name);
                        hasAdded = true;
                    }
                });
            }
            if (hasExisting) pdmsWithExisting.add(pdm.id);
            if (hasAdded) pdmsWithAdded.add(pdm.id);
        });
    }

    const existingHeadingsCount = uniqueExistingHeadingsFound.size;
    const addedHeadingsCount = uniqueAddedHeadingsFound.size;
    const existingLinksCount = pdmsWithExisting.size;
    const addedLinksCount = pdmsWithAdded.size;
    const totalAvailableExisting = existingHeadingsMap.size;
    const unworkedExistingCount = Math.max(0, totalAvailableExisting - existingHeadingsCount);

    // ========== Render All Content ==========
    container.innerHTML = `
        <div class="qc-summary-content">
            <!-- Stats Cards Row -->
            <div class="qc-summary-stats-grid">
                <div class="error-stat-card">
                    <div class="error-stat-value">${stats.totalHeadings}</div>
                    <div class="error-stat-label">Total Worked Headings</div>
                </div>
                <div class="error-stat-card">
                    <div class="error-stat-value">${stats.totalErrors}</div>
                    <div class="error-stat-label">Total Defects</div>
                </div>
                <div class="error-stat-card">
                    <div class="error-stat-value">${stats.errorPercentage}%</div>
                    <div class="error-stat-label">Error Percentage</div>
                </div>
                <div class="error-stat-card">
                    <div class="error-stat-value">${stats.qualityScore}%</div>
                    <div class="error-stat-label">Quality Score</div>
                </div>
            </div>

            <!-- Two Column Row: Error Categories | Metadata -->
            <div class="qc-summary-columns">
                <div class="qc-summary-col">
                    <div class="qc-summary-error-table">
                        <div class="qc-summary-col-header">
                            <span>Error Categories</span>
                            <button class="qc-export-iet-btn" id="qcExportIetBtn">
                                <i class="fas fa-file-export"></i> Export IET
                            </button>
                        </div>
                        <div class="qc-summary-error-body">
                            ${errorCategoriesHTML}
                        </div>
                    </div>
                </div>
                <div class="qc-summary-col" id="qcSummaryMetadataContent">
                    <div class="qc-summary-metadata-table">
                        <div class="qc-summary-col-header">
                            <span>Account Details</span>
                            <button class="qc-export-iet-btn" id="copyMetadataBtn">
                                <i class="fas fa-copy"></i> Copy Metadata
                            </button>
                        </div>
                        <div class="qc-summary-metadata-body">
                            <div class="qc-summary-metadata-row">
                                <div class="qc-summary-metadata-label">Account Name</div>
                                <div class="qc-summary-metadata-value" title="${accountName}">${accountName}</div>
                            </div>
                            <div class="qc-summary-metadata-row">
                                <div class="qc-summary-metadata-label">Account ID</div>
                                <div class="qc-summary-metadata-value" title="${accountId}">${accountId}</div>
                            </div>
                            <div class="qc-summary-metadata-row">
                                <div class="qc-summary-metadata-label">QC Name</div>
                                <div class="qc-summary-metadata-value" title="${qcName}">${qcName}</div>
                            </div>
                            <div class="qc-summary-metadata-row">
                                <div class="qc-summary-metadata-label">Editor Name</div>
                                <div class="qc-summary-metadata-value" title="${editorName}">${editorName}</div>
                            </div>
                            <div class="qc-summary-metadata-row">
                                <div class="qc-summary-metadata-label">CoPro Written</div>
                                <div class="qc-summary-metadata-value">${coproWritten}</div>
                            </div>
                            <div class="qc-summary-metadata-row">
                                <div class="qc-summary-metadata-label">Existing Headings</div>
                                <div class="qc-summary-metadata-value">${existingHeadingsCount}</div>
                            </div>
                            <div class="qc-summary-metadata-row">
                                <div class="qc-summary-metadata-label">Links (Existing)</div>
                                <div class="qc-summary-metadata-value">${existingLinksCount}</div>
                            </div>
                            <div class="qc-summary-metadata-row">
                                <div class="qc-summary-metadata-label">Added Headings</div>
                                <div class="qc-summary-metadata-value">${addedHeadingsCount}</div>
                            </div>
                            <div class="qc-summary-metadata-row">
                                <div class="qc-summary-metadata-label">Links (Added)</div>
                                <div class="qc-summary-metadata-value">${addedLinksCount}</div>
                            </div>
                            <div class="qc-summary-metadata-row">
                                <div class="qc-summary-metadata-label">Unworked Existing</div>
                                <div class="qc-summary-metadata-value">${unworkedExistingCount}</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const exportBtn = container.querySelector('#qcExportIetBtn');
    if (exportBtn) {
        exportBtn.addEventListener('click', exportIET);
    }

    const copyBtn = container.querySelector('#copyMetadataBtn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copySummaryToClipboard);
    }
}

// Window bridges removed - all functions are exported
