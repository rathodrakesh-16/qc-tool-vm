// Shared Utility Functions for PDM Logic
// Used by both production.js (Production Tab) and qcReview.js (QC Tab)
import { workspaceState } from '../state/workspaceState.js';
import { workspaceAccountsState } from '../state/workspaceAccountsState.js';
import { getProductionFamilyStats } from '../editor/productionReport.js';

export const PdmUtils = {
    /**
     * Helper: Format PDM Number for Display
     * With date-based format (YYDDSSS), numbers are already formatted correctly
     * @param {string|number} number 
     * @returns {string}
     */
    formatPDMNumber: function (number) {
        return String(number);
    },

    /**
     * UI Helper: Returns the status badge HTML for a heading
     * @param {Object} heading 
     * @returns {string} HTML string
     */
    getStatusBadge: function (heading) {
        const status = heading.status || 'additional';
        const badges = {
            'existing': '<span class="status-badge status-existing">E</span>',
            'ranked': '<span class="status-badge status-ranked">R</span>',
            'additional': '<span class="status-badge status-added">A</span>'
        };
        return badges[status] || badges['additional'];
    },

    /**
     * Formatting Helper: Formats timestamp for display
     * @param {Object} pdm 
     * @returns {Object} { label: string, text: string }
     */
    formatPDMTimestamp: function (pdm) {
        // Determine if we should show created or updated info
        const useUpdated = pdm.updatedAt && pdm.updatedBy;
        const isoString = useUpdated ? pdm.updatedAt : pdm.createdAt;
        const username = useUpdated ? pdm.updatedBy : pdm.createdBy;
        const label = useUpdated ? 'Updated' : 'Created';

        if (!isoString) return { label: 'Created', text: 'unknown' };

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
    },

    /**
     * View Generator: Generates the HTML for the PDM Full View
     * @param {Object} pdm - The PDM object
     * @param {string} actionsHTML - The HTML for the action buttons
     * @param {string} classPrefix - 'pdm' or 'qc-pdm'
     * @returns {string} HTML string of the full view
     */
    generatePDMFullViewHTML: function (pdm, actionsHTML, classPrefix = 'pdm') {
        const commentSection = pdm.comment && pdm.comment.trim() !== ''
            ? `<div class="${classPrefix}-view-detail-group">
                    <label class="${classPrefix}-view-detail-label">
                        Comment
                    </label>
                    <div class="${classPrefix}-view-detail-value">${pdm.comment}</div>
               </div>`
            : '';

        const copyAllIconHTML = classPrefix === 'pdm'
            ? `<i class="far fa-copy pdm-copy-all-icon"
                   data-pdm-id="${pdm.id}"
                   title="Copy all headings"></i>`
            : '';

        // Handle Company Type Display (Array or String)
        let companyTypeDisplay = 'Not specified';
        if (pdm.companyType) {
            if (Array.isArray(pdm.companyType)) {
                companyTypeDisplay = pdm.companyType.join(', ');
            } else {
                companyTypeDisplay = pdm.companyType;
            }
        }

        const isCoPro = pdm.isCoPro || pdm.id?.startsWith('COPRO-');
        const pdmLabel = isCoPro ? 'CoPro' : this.formatPDMNumber(pdm.number);

        const urlSection = isCoPro ? '' : `
                    <div class="${classPrefix}-view-detail-group">
                        <label class="${classPrefix}-view-detail-label">
                            URL
                            ${classPrefix === 'pdm' ? `<i class="far fa-copy pdm-copy-icon" 
                               data-copy-text="${encodeURIComponent(pdm.url || '')}"
                               data-copy-label="URL"
                               title="Copy URL"></i>` : ''}
                        </label>
                        <div class="${classPrefix}-view-detail-value">
                            <a href="${pdm.url}" target="_blank" class="${classPrefix}-view-url">${pdm.url}</a>
                        </div>
                    </div>`;

        const typeOfProofSection = isCoPro ? '' : `
                    <div class="${classPrefix}-view-detail-group">
                        <label class="${classPrefix}-view-detail-label">
                            Type of proof
                        </label>
                        <div class="${classPrefix}-view-detail-value">${pdm.typeOfProof || 'Not specified'}</div>
                    </div>`;

        const headingsArea = (isCoPro || pdm.headings.length === 0) ? '' : `
                <div class="${classPrefix}-view-headings-area">
                    <div class="${classPrefix}-view-headings-area-header">
                        <div class="${classPrefix}-view-headings-left">
                            <span class="${classPrefix}-view-headings-title">Headings</span>
                            <span class="${classPrefix}-view-headings-count">${pdm.headings.length} / 8</span>
                        </div>
                        ${copyAllIconHTML}
                    </div>
                    ${pdm.headings.map(heading => `
                        <div class="${classPrefix}-view-heading-item">
                            ${this.getStatusBadge(heading)}
                            <span class="${classPrefix}-view-heading-name">${heading.name}</span>
                            <i class="fas fa-info-circle heading-info-icon" 
                               style="margin-left: 8px; color: #9ca3af; cursor: pointer; flex-shrink: 0;" 
                               title="View Details"
                               data-heading-id="${heading.id}"></i>

                            ${classPrefix === 'pdm' ? `<i class="far fa-copy pdm-heading-copy-icon" 
                               data-copy-text="${encodeURIComponent(heading.name || '')}"
                               data-copy-label="Heading"
                               title="Copy heading"></i>` : ''}
                        </div>
                    `).join('')}
                </div>`;

        return `
            <div class="${classPrefix}-builder-view ${isCoPro ? 'copro-view' : ''}">
                <div class="${classPrefix}-builder-view-header">
                    <div class="${classPrefix}-builder-view-title">
                        <span class="${classPrefix}-builder-view-number">${pdmLabel}</span>
                    </div>
                    <div class="${classPrefix}-builder-view-actions">
                        ${actionsHTML}
                    </div>
                </div>
                
                ${headingsArea}
                
                <div class="${classPrefix}-view-details">
                    ${urlSection}
                    
                    <div class="${classPrefix}-view-detail-group">
                        <label class="${classPrefix}-view-detail-label">
                            Company Type
                        </label>
                        <div class="${classPrefix}-view-detail-value">${companyTypeDisplay}</div>
                    </div>

                    ${typeOfProofSection}
                    
                    ${commentSection}
                    
                    <div class="${classPrefix}-view-detail-group">
                        <label class="${classPrefix}-view-detail-label">
                            Description ${pdm.qcFeedback && pdm.qcFeedback.updatedDescription ? '<span style="font-size:11px; margin-left:4px; font-style: italic;">(QC Updated)</span>' : ''}
                             ${classPrefix === 'pdm' && pdm.description ? `<i class="far fa-copy pdm-copy-icon" 
                                data-copy-text="${encodeURIComponent((pdm.qcFeedback && pdm.qcFeedback.updatedDescription ? pdm.qcFeedback.updatedDescription : pdm.description) || '')}"
                                data-copy-label="Description"
                                title="Copy Description"></i>` : ''}
                        </label>
                        <div class="${classPrefix}-view-detail-value ${classPrefix}-view-description">${pdm.qcFeedback && pdm.qcFeedback.updatedDescription ? pdm.qcFeedback.updatedDescription : pdm.description}</div>
                    </div>

                    ${(pdm.qcFeedback && pdm.qcFeedback.errors && pdm.qcFeedback.errors.length > 0) ? `
                    <div class="${classPrefix}-view-detail-group" style="margin-top: 12px;">
                        <label class="${classPrefix}-view-detail-label">
                            QC Defects / Errors
                        </label>
                        <div class="${classPrefix}-view-detail-value">
                            <ul style="margin: 0; padding-left: 20px;">
                                ${pdm.qcFeedback.errors.map(e => `<li>${e}</li>`).join('')}
                            </ul>
                        </div>
                    </div>` : ''}

                    ${(pdm.qcFeedback && pdm.qcFeedback.comment) ? `
                    <div class="${classPrefix}-view-detail-group" style="margin-top: 12px;">
                        <label class="${classPrefix}-view-detail-label">
                            QC Comment
                        </label>
                        <div class="${classPrefix}-view-detail-value">
                            ${pdm.qcFeedback.comment}
                        </div>
                    </div>` : ''}

                    ${classPrefix === 'pdm' ? `
                    <div class="${classPrefix}-view-detail-group" style="margin-top: 12px; flex-direction: row; align-items: center; justify-content: flex-start; gap: 20px;">
                        <label class="${classPrefix}-view-detail-label" style="margin: 0;">Published in SDMS?</label>
                        <div class="radio-group-inline" style="display: flex; gap: 15px;">
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 14px; color: #374151; cursor: pointer;">
                                <input type="radio" name="pdmPublishedView_${pdm.id}" value="yes" 
                                       ${pdm.uploaded ? 'checked' : ''} 
                                       data-pdm-id="${pdm.id}"> Yes
                            </label>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 14px; color: #374151; cursor: pointer;">
                                <input type="radio" name="pdmPublishedView_${pdm.id}" value="no" 
                                       ${!pdm.uploaded ? 'checked' : ''} 
                                       data-pdm-id="${pdm.id}"> No
                            </label>
                        </div>
                    </div>
                    ${pdm.qcStatus === 'error' ? `
                    <div class="${classPrefix}-view-detail-group" style="margin-top: 12px; flex-direction: row; align-items: center; justify-content: flex-start; gap: 20px;">
                        <label class="${classPrefix}-view-detail-label" style="margin: 0;">Rectification Status</label>
                        <div class="radio-group-inline" style="display: flex; gap: 15px;">
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 14px; color: #374151; cursor: pointer;">
                                <input type="radio" name="pdmRectification_${pdm.id}" value="Done" 
                                       ${pdm.rectificationStatus === 'Done' ? 'checked' : ''} 
                                       data-pdm-id="${pdm.id}"
                                       data-rectification-status="Done"> Done
                            </label>
                            <label style="display: flex; align-items: center; gap: 6px; font-size: 14px; color: #374151; cursor: pointer;">
                                <input type="radio" name="pdmRectification_${pdm.id}" value="Not Needed" 
                                       ${pdm.rectificationStatus === 'Not Needed' ? 'checked' : ''} 
                                       data-pdm-id="${pdm.id}"
                                       data-rectification-status="Not Needed"> Not Needed
                            </label>
                        </div>
                    </div>
                    ` : ''}
                    ` : ''}
                </div>
            </div >
    `;
    },

    COMPANY_TYPE_OPTIONS: [
        "Advertising Novelty Distributor",
        "Advertising Novelty Manufacturer",
        "Product Distributor",
        "Product Manufacturer",
        "Manufacturer's Representative",
        "Raw Material Distributor",
        "Raw Material Manufacturer",
        "Rental Service",
        "Other Service",
        "Trade Association",
        "Turnkey Systems Integrator",
        "Remanufacturer",
        "Stated Product Custom Manufacturer",
        "Job Shop + Stated Product Custom Manufacturer",
        "Job Shop Manufacturer"
    ],

    /**
     * Logic: Count Words
     * @param {string} str 
     * @returns {number}
     */
    countWords: function (str) {
        if (!str) return 0;
        return str.trim().split(/\s+/).length;
    },

    /**
     * Logic: Save PDM (Create or Update)
     * Validates and saves the PDM to the workspace state.
     * @param {Object} pdmData - input data { headings, url, companyType, description, comment, id? }
     * @param {Object} workspaceState - global state reference
     * @param {string} currentUser - username
     * @returns {Object|null} The saved PDM object or null if validation failed (caller should alert)
     */
    savePDM: function (pdmData, workspaceState, currentUser) {
        const isCoPro = pdmData.isCoPro || pdmData.id?.startsWith('COPRO-');

        // Validation
        if (!isCoPro) {
            if (!pdmData.headings || pdmData.headings.length === 0) {
                alert('Please add at least one heading to the PDM');
                return null;
            }
            if (pdmData.headings.length > 8) {
                alert('Maximum 8 headings per PDM');
                return null;
            }
            if (!pdmData.url || !pdmData.url.trim()) {
                alert('Please enter a URL');
                return null;
            }
        }

        if (!pdmData.companyType || (Array.isArray(pdmData.companyType) && pdmData.companyType.length === 0)) {
            alert('Please select a Company Type');
            return null;
        }
        if (!pdmData.description || !pdmData.description.trim()) {
            alert('Please enter a description');
            return null;
        }

        const wordCount = this.countWords(pdmData.description);

        let pdmId, pdmNumber, createdAt, createdBy, uploaded, updatedAt, updatedBy;

        // Existing PDM?
        const existingPdm = pdmData.id ? workspaceState.savedPDMs.find(p => p.id === pdmData.id) : null;

        if (existingPdm) {
            // Updating
            pdmId = existingPdm.id;
            pdmNumber = existingPdm.number;
            createdAt = existingPdm.createdAt || new Date().toISOString();
            createdBy = existingPdm.createdBy || currentUser;
            uploaded = existingPdm.uploaded || false;

            updatedAt = new Date().toISOString();
            updatedBy = currentUser;
        } else {
            // Creating new PDM
            const now = new Date();
            const year = String(now.getFullYear()).slice(-2); // Last 2 digits of year
            const day = String(now.getDate()).padStart(2, '0');

            if (isCoPro) {
                // COPRO format: YYDD000 (always ends with 000)
                pdmNumber = `${year}${day}000`;
                pdmId = pdmNumber;
            } else {
                // Regular PDM format: YYDDSSS
                // Calculate serial number for today
                const todayPrefix = `${year}${day}`;

                // Count PDMs created today (same YYDD prefix)
                const todayPdms = workspaceState.savedPDMs.filter(p => {
                    // Skip COPRO PDMs
                    if (p.isCoPro) return false;
                    // Check if PDM number starts with today's date
                    const pNum = String(p.number);
                    return pNum.startsWith(todayPrefix) && pNum !== `${todayPrefix}000`;
                });

                const serial = todayPdms.length + 1;
                pdmNumber = `${todayPrefix}${String(serial).padStart(3, '0')}`;
                pdmId = pdmNumber;
            }
            createdAt = new Date().toISOString();
            createdBy = currentUser;
            uploaded = false;
            updatedAt = null;
            updatedBy = null;
        }

        const newPdm = {
            id: pdmId,
            number: pdmNumber,
            headings: isCoPro ? [] : [...pdmData.headings],
            url: isCoPro ? '' : pdmData.url,
            isCoPro: isCoPro,
            companyType: pdmData.companyType,
            typeOfProof: pdmData.typeOfProof || '',
            description: pdmData.description,
            comment: pdmData.comment || '',
            wordCount: wordCount,
            uploaded: uploaded,
            createdAt: createdAt,
            createdBy: createdBy,
            updatedAt: updatedAt,
            updatedBy: updatedBy
        };

        // Persist QC Flags and Status
        // Priority: pdmData (New updates) > existingPdm (Preserve old state) > Default

        newPdm.qcStatus = pdmData.qcStatus !== undefined ? pdmData.qcStatus : (existingPdm ? existingPdm.qcStatus : 'pending');
        newPdm.qcFeedback = pdmData.qcFeedback !== undefined ? pdmData.qcFeedback : (existingPdm ? existingPdm.qcFeedback : null);
        newPdm.validationStatus = pdmData.validationStatus !== undefined ? pdmData.validationStatus : (existingPdm ? existingPdm.validationStatus : 'Pending');
        newPdm.rectificationStatus = pdmData.rectificationStatus !== undefined ? pdmData.rectificationStatus : (existingPdm ? existingPdm.rectificationStatus : 'Not Needed');
        newPdm.isQCEdited = pdmData.isQCEdited !== undefined ? pdmData.isQCEdited : (existingPdm ? existingPdm.isQCEdited : false);
        newPdm.isDescriptionUpdated = pdmData.isDescriptionUpdated !== undefined ? pdmData.isDescriptionUpdated : (existingPdm ? existingPdm.isDescriptionUpdated : false);

        if (existingPdm) {
            // Replace in array
            const index = workspaceState.savedPDMs.findIndex(p => p.id === pdmId);
            if (index !== -1) workspaceState.savedPDMs[index] = newPdm;
        } else {
            // Add new
            workspaceState.savedPDMs.push(newPdm);
        }

        // Ensure sorted
        this.renumberPDMs(workspaceState.savedPDMs);

        return newPdm;
    },

    /**
     * Logic: Edit PDM Preparation
     * Prepares data for editing (e.g. legacy company type fix)
     * @param {Object} pdm 
     * @returns {Object} prepared pdm data copy
     */
    prepareEditData: function (pdm) {
        if (!pdm) return null;

        let cType = pdm.companyType;
        if (typeof cType === 'string' && cType.trim() !== '') {
            cType = [cType];
        } else if (!cType) {
            cType = [];
        }

        return {
            ...pdm,
            companyType: cType
        };
    },

    /**
     * Helper: Renumber PDMs sequentially
     * Note: With date-based numbering (YYDDSSS), regular PDMs are NOT renumbered.
     * This function is kept for backward compatibility but only handles COPRO PDMs if needed.
     * @param {Array} savedPDMs 
     */
    renumberPDMs: function (savedPDMs) {
        if (!savedPDMs) return;

        // Date-based PDMs (YYDDSSS) should NOT be renumbered
        // They are assigned based on creation date and daily serial

        // Note: COPRO PDMs also use date-based format (YYDD000) and don't need renumbering
        // This function is now essentially a no-op but kept for compatibility
    },

    /**
     * Logic: Delete PDM
     * Logic for deleting a PDM and returning its headings to the supported list.
     * @param {string} pdmId 
     * @param {Object} workspaceState - Reference to the global state
     * @returns {boolean} true if deleted, false if not found or cancelled (caller handles confirm)
     */
    deletePDM: function (pdmId, workspaceState) {
        const pdms = workspaceState.savedPDMs;
        const pdm = pdms.find(p => p.id === pdmId);
        if (!pdm) return null;

        // Caller should handle confirmation dialog (UI concern)

        // Move headings back
        pdm.headings.forEach(heading => {
            const existsInSupported = workspaceState.supportedHeadingIds.includes(heading.id);
            const existsInCurrent = workspaceState.currentPDM && workspaceState.currentPDM.headings
                ? workspaceState.currentPDM.headings.some(h => h.id === heading.id)
                : false;
            const existsInImported = workspaceState.importedHeadingIds.includes(heading.id);

            // Return to supported if not found elsewhere
            if (!existsInSupported && !existsInCurrent && !existsInImported) {
                workspaceState.supportedHeadingIds.push(heading.id);
            }
        });

        // Remove from saved list
        workspaceState.savedPDMs = workspaceState.savedPDMs.filter(p => p.id !== pdmId);

        // Renumber
        this.renumberPDMs(workspaceState.savedPDMs);

        return pdm; // Return deleted pdm so caller can show alerts/updates
    },

    /**
     * MultiSelect UI Component Logic
     */
    MultiSelect: {
        setup: function (containerId, options, onUpdate) {
            const container = document.getElementById(containerId);
            if (!container) return;

            // Prevent double initialization
            if (container.dataset.initialized === 'true') return;
            container.dataset.initialized = 'true';

            const trigger = container.querySelector('.multi-select-trigger');
            const dropdown = container.querySelector('.multi-select-dropdown');

            // Populate Options
            if (options) {
                dropdown.innerHTML = options.map(opt => `
                    <label class="multi-select-option">
                        <input type="checkbox" class="multi-select-checkbox" value="${opt}">
                        <span class="multi-select-label">${opt}</span>
                    </label>
                `).join('');
            }

            // Toggle Dropdown
            trigger.addEventListener('click', (e) => {
                if (dropdown.classList.contains('show')) {
                    this.close(container);
                } else {
                    this.open(container);
                }
                e.stopPropagation();
            });

            // Close on click outside (Attached once globally is better, but per component is safer for now)
            document.addEventListener('click', (e) => {
                if (!container.contains(e.target)) {
                    this.close(container);
                }
            });

            // Checkbox Change
            dropdown.addEventListener('change', (e) => {
                if (e.target.classList.contains('multi-select-checkbox')) {
                    const checkboxes = dropdown.querySelectorAll('.multi-select-checkbox:checked');
                    const selectedValues = Array.from(checkboxes).map(cb => cb.value);

                    // Update UI text
                    this.updateDisplayText(container, selectedValues);

                    // Callback
                    if (onUpdate) onUpdate(selectedValues);
                }
            });
        },

        open: function (container) {
            const dropdown = container.querySelector('.multi-select-dropdown');
            const trigger = container.querySelector('.multi-select-trigger');
            dropdown.classList.add('show');
            trigger.classList.add('active');
        },

        close: function (container) {
            const dropdown = container.querySelector('.multi-select-dropdown');
            const trigger = container.querySelector('.multi-select-trigger');
            dropdown.classList.remove('show');
            trigger.classList.remove('active');
        },

        updateDisplay: function (container, selectedValues) {
            if (!container) return;
            if (!selectedValues) selectedValues = [];

            // Sync checkboxes
            const checkboxes = container.querySelectorAll('.multi-select-checkbox');
            checkboxes.forEach(cb => {
                const isChecked = selectedValues.includes(cb.value);
                cb.checked = isChecked;
                if (isChecked) {
                    cb.closest('.multi-select-option').classList.add('selected');
                } else {
                    cb.closest('.multi-select-option').classList.remove('selected');
                }
            });

            this.updateDisplayText(container, selectedValues);
        },

        updateDisplayText: function (container, selectedValues) {
            const textSpan = container.querySelector('.multi-select-text');
            if (!textSpan) return;

            if (!selectedValues || selectedValues.length === 0) {
                textSpan.textContent = 'Select Company Type...';
                textSpan.classList.add('placeholder');
            } else if (selectedValues.length === 1) {
                textSpan.textContent = selectedValues[0];
                textSpan.classList.remove('placeholder');
            } else {
                textSpan.textContent = `${selectedValues.length} Selected`;
                textSpan.classList.remove('placeholder');
            }
        }
    },
    countWords: function (str) {
        if (!str) return 0;
        return str.trim().split(/\s+/).length;
    },

    /**
     * Logic: Get Unique Families
     * @param {Array} items - Array of PDMs or Headings
     * @param {boolean} isPdmList - true if items are PDMs (have headings array), false if items are headings
     * @returns {Array} sorted list of unique family strings
     */
    getUniqueFamilies: function (items, isPdmList = true) {
        if (!items) return [];
        const familiesSet = new Set();

        items.forEach(item => {
            if (isPdmList) {
                if (item.headings) {
                    item.headings.forEach(h => {
                        if (h.family) familiesSet.add(h.family);
                    });
                }
            } else {
                // item is a heading
                if (item.family) familiesSet.add(item.family);
            }
        });

        return Array.from(familiesSet).sort();
    },

    /**
     * View Generator: Family Options HTML
     * @param {Array} families - list of family strings
     * @returns {string} HTML options
     */
    generateFamilyOptionsHTML: function (families) {
        return families.map(f => `<option value="${f}">${f}</option>`).join('');
    },

    /**
     * Logic: Filter PDM
     * @param {Object} pdm 
     * @param {string} searchQuery 
     * @param {string} familyFilter 
     * @returns {boolean}
     */
    filterPDM: function (pdm, searchQuery, familyFilter) {
        // Family Check
        if (familyFilter && familyFilter !== 'all') {
            const hasFamily = pdm.headings.some(h => h.family === familyFilter);
            if (!hasFamily) return false;
        }

        // Search Check
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            const isCoPro = pdm.isCoPro || pdm.id?.startsWith('COPRO-');
            const labelMatch = isCoPro ? 'copro'.includes(q) : `pdm ${pdm.number}`.toLowerCase().includes(q);
            const familyMatch = pdm.headings.some(h => (h.family || '').toLowerCase().includes(q));
            const creatorMatch = (pdm.createdBy || '').toLowerCase().includes(q);

            if (!labelMatch && !familyMatch && !creatorMatch) return false;
        }

        return true;
    },

    /**
     * View Generator: PDM List Card
     * @param {Object} pdm 
     * @param {Object} options - { isSelected, onClick, statusType ('upload'|'qc'), classPrefix }
     */
    generatePDMCardHTML: function (pdm, options = {}) {
        const { isSelected, onClick, statusType = 'upload', classPrefix = 'pdm' } = options;
        const timestamp = this.formatPDMTimestamp(pdm);

        // Status Badge Logic
        let badgeClass = 'pending';
        let badgeText = 'Pending';
        let badgeTitle = 'Pending';

        const qcStatus = pdm.qcStatus || 'pending';

        if (statusType === 'qc' || (statusType === 'upload' && (qcStatus === 'checked' || qcStatus === 'error'))) {
            // Priority: QC Status
            if (qcStatus === 'checked') {
                badgeClass = 'published'; // Green
                badgeText = 'QC Checked';
                badgeTitle = 'Quality Control: Checked';
            } else if (qcStatus === 'error') {
                badgeClass = 'failed';
                // If QC Edited it, change text, but keep it red (failed)
                if (pdm.isQCEdited) {
                    badgeText = 'QC Edited';
                    badgeTitle = 'Quality Control: Defective (Edited by QC)';
                } else {
                    badgeText = 'Defective';
                    badgeTitle = 'Quality Control: Defective (Needs Fix)';
                }
            } else {
                // Pending but maybe QC Edited?
                if (pdm.isQCEdited) {
                    badgeClass = 'status-ranked'; // Use Ranking Blue/Purple color for edited but not error
                    badgeText = 'QC Edited';
                    badgeTitle = 'Quality Control: Edited by QC';
                } else {
                    badgeClass = 'pending';
                    badgeText = 'QC Pending';
                    badgeTitle = 'Quality Control: Pending Review';
                }
            }
        } else {
            // Upload Status
            badgeClass = pdm.uploaded ? 'published' : 'pending';
            badgeText = pdm.uploaded ? 'Published' : 'Pending';
            badgeTitle = pdm.uploaded ? 'Published to SDMS' : 'Pending publication';
        }

        // Additional classes
        let cardClass = `${classPrefix}-card`;
        if (statusType === 'qc' && pdm.qcStatus === 'error') cardClass += ' defective';
        if (isSelected) cardClass += ' selected';

        const isCoPro = pdm.isCoPro || pdm.id?.startsWith('COPRO-');
        const pdmLabel = isCoPro ? 'CoPro' : this.formatPDMNumber(pdm.number);

        return `
        <div class="${cardClass}" 
             data-pdm-id="${pdm.id}"
             style="cursor: pointer;">
            <div class="${classPrefix}-card-header">
                <div class="${classPrefix}-card-header-left">
                    <span class="${classPrefix}-number">${pdmLabel}</span>
                </div>
                <div class="${classPrefix}-card-header-right">
                    <span class="pdm-sdms-badge ${badgeClass}" 
                          title="${badgeTitle}"
                          style="cursor: default;">
                        <i class="fas fa-circle"></i>
                        ${badgeText}
                    </span>
                </div>
            </div>
            <div class="${classPrefix}-card-timestamp">
                ${timestamp.label} ${timestamp.text}
            </div>
        </div>
        `;
    },

    /**
     * Utility: Copy to Clipboard
     * @param {string} text 
     * @param {string} label 
     */
    copyToClipboard: function (text, label = 'Content') {
        if (!text) {
            alert(`No ${label} to copy`);
            return;
        }

        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text)
                .then(() => {
                    // Small toast or console log could go here, for now using console to avoid UI dependency
                    // Optional: alert or custom toast if requested
                })
                .catch(err => {
                    alert('Failed to copy to clipboard');
                });
        } else {
            // Fallback
            const textArea = document.createElement("textarea");
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
            } catch (err) {
                alert('Failed to copy to clipboard');
            }
            document.body.removeChild(textArea);
        }
    },

    /**
     * Utility: Copy All Headings from PDM
     */
    copyAllHeadings: function (pdm) {
        if (!pdm || !pdm.headings || pdm.headings.length === 0) {
            alert('No headings to copy');
            return;
        }
        const headingNames = pdm.headings.map(h => h.name);
        const allHeadings = headingNames.join('\n');
        this.copyToClipboard(allHeadings, `All Headings (${headingNames.length})`);
    },

    /**
     * Utility: Export PDM Data to Excel
     * Exports all PDMs for the currently selected account.
     */
    exportPdmData: function () {
        // 1. Get Workspace Data
        const savedPDMs = workspaceState.savedPDMs || [];
        const accountId = workspaceState.selectedAccount;

        if (!accountId) {
            alert("No account selected via workspace settings.");
            return;
        }

        if (savedPDMs.length === 0) {
            alert("No PDMs found to export.");
            return;
        }

        // 2. Prepare Data for Export
        // We want one row per HEADING (or one row per PDM if no headings)
        const exportData = [];

        savedPDMs.forEach(pdm => {
            // Flatten Company Type
            let companyTypeStr = '';
            if (Array.isArray(pdm.companyType)) {
                companyTypeStr = pdm.companyType.join(', ');
            } else {
                companyTypeStr = pdm.companyType || '';
            }

            // Common PDM Data
            const baseData = {
                "PDM Number": pdm.isCoPro ? pdm.number : pdm.number, // Both use date-based format now
                "Heading ID": "",    // Placeholder, filled below
                "Heading Name": "",  // Placeholder, filled below
                "URL": pdm.url,
                "Company Type": companyTypeStr,
                "Type of Proof": pdm.typeOfProof || '',
                "Description": pdm.description || '',
                "Comment": pdm.comment || '',
                "Created By": pdm.createdBy || '',
                "Created At": pdm.createdAt ? new Date(pdm.createdAt).toLocaleString() : '',
                "Updated By": pdm.updatedBy || '',
                "Updated At": pdm.updatedAt ? new Date(pdm.updatedAt).toLocaleString() : ''
            };

            if (pdm.headings && pdm.headings.length > 0) {
                // One row per heading
                pdm.headings.forEach(heading => {
                    const row = { ...baseData };
                    row["Heading ID"] = heading.id || '';
                    row["Heading Name"] = heading.name || '';
                    exportData.push(row);
                });
            } else {
                // One row for the PDM itself if no headings
                exportData.push(baseData);
            }
        });

        // 3. Create Worksheet for PDMs
        const wsPDMs = XLSX.utils.json_to_sheet(exportData);

        // 4. Create Worksheet for Family Wise Report
        let familyDataArray = [];
        const familyStats = getProductionFamilyStats();
        // Convert object to array suitable for sheet
        // Columns: Family Name, Existing, Added, Ranked, Unworked, Total PDMs, Checked, Defective, Editor Name, QC Name
        Object.keys(familyStats).sort().forEach(family => {
            const data = familyStats[family];
            familyDataArray.push({
                "Family Name": family,
                "Existing": data.existingCount,
                "Added": data.addedCount,
                "Ranked": data.unworkedRankedCount, // Based on HTML logic: Unworked Ranked
                "Unworked": data.unworkedExistingCount, // Based on HTML logic: Unworked Existing
                "Total PDMs": data.totalPDMs,
                "Checked": data.checkedPDMs,
                "Defective": data.defectivePDMs,
                "Editor Name": data.editorsList.join(', '),
                "QC Name": data.qcUsersList.join(', ')
            });
        });

        const wsFamilies = XLSX.utils.json_to_sheet(familyDataArray);

        // 5. Create Workbook and Append Sheets
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, wsPDMs, "PDMs");
        if (familyDataArray.length > 0) {
            XLSX.utils.book_append_sheet(wb, wsFamilies, "Family Wise Report");
        }

        // 6. Generate File Name
        // Get Account Name if available
        let accountName = accountId;
        if (workspaceAccountsState && workspaceAccountsState.allAccounts) {
            const acc = workspaceAccountsState.allAccounts.find(a => a.id === accountId);
            if (acc) accountName = acc.name;
        }

        // Sanitize filename
        const safeAccountName = accountName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const fileName = `${safeAccountName}_PDMs_${dateStr}.xlsx`;

        // 6. Download
        XLSX.writeFile(wb, fileName);
    }
};

// Window bridges removed - PdmUtils and its methods are exported

// Export wrapper functions for use by event handlers
export function exportPdmData() {
    PdmUtils.exportPdmData();
}

export function copyToClipboard(text) {
    PdmUtils.copyToClipboard(text);
}

export function copyAllHeadingsFromPDM(pdmId) {
    if (workspaceState.savedPDMs) {
        const pdm = workspaceState.savedPDMs.find(p => p.id === pdmId);
        if (pdm) PdmUtils.copyAllHeadings(pdm);
    }
}
