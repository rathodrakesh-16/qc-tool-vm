/* Family Assignment Modal - Unified modal for Production and QC modes */
import { workspaceState } from '../state/workspaceState.js';
import { productionState } from '../state/productionState.js';
import { getHeadingFromRegistry, saveCurrentWorkspaceData } from '../workspace.js';
import { renderImportedHeadings, renderSupportedHeadings } from '../editor/production.js';

export const FamilyAssignModal = {
    /**
     * Show modal for Production mode (with supported link input)
     * @param {Array} selectedHeadings - Array of heading objects to assign families to
     * @param {Function} onConfirm - Callback function to execute on confirmation
     */
    showProductionModal(selectedHeadings, onConfirm) {
        this._showModal({
            selectedHeadings,
            onConfirm,
            mode: 'production',
            title: 'Add to Supported Headings',
            showSupportedLink: true,
            overlayId: 'supportedLinkModalOverlay'
        });
    },

    /**
     * Show modal for QC mode (without supported link input)
     * @param {Array} selectedHeadings - Array of heading objects to assign families to
     * @param {Function} onConfirm - Callback function to execute on confirmation
     */
    showQCModal(selectedHeadings, onConfirm) {
        this._showModal({
            selectedHeadings,
            onConfirm,
            mode: 'qc',
            title: 'Select Grouping Family',
            showSupportedLink: false,
            overlayId: 'qcGroupingFamilyModalOverlay'
        });
    },

    /**
     * Internal method to show the modal
     * @private
     */
    _showModal(config) {
        const { selectedHeadings, onConfirm, mode, title, showSupportedLink, overlayId } = config;

        const overlay = document.createElement('div');
        overlay.className = 'family-modal-overlay';
        overlay.id = overlayId;

        const modal = document.createElement('div');
        modal.className = 'family-modal combined-modal';

        // Build grouping family section HTML
        let groupingFamilyHTML = '';
        selectedHeadings.forEach((heading) => {
            const headingFromRegistry = getHeadingFromRegistry(heading.id);
            const families = headingFromRegistry ? headingFromRegistry.families : heading.families || [];

            // Get unique families only (deduplicate, trim, and filter empty)
            const uniqueFamilies = [...new Set(families.map(f => f.trim()).filter(f => f))];

            if (uniqueFamilies.length === 0) {
                // Skip headings with no families
                return;
            }

            // Auto-select if only one family
            const selectedFamily = uniqueFamilies.length === 1 ? uniqueFamilies[0] : '';

            groupingFamilyHTML += `
                <div class="grouping-family-item">
                    <span class="grouping-heading-name">${heading.name}</span>
                    <select class="grouping-family-dropdown" data-heading-id="${heading.id}">
                        ${uniqueFamilies.map(f => `<option value="${f}" ${f === selectedFamily ? 'selected' : ''}>${f}</option>`).join('')}
                    </select>
                </div>
            `;
        });

        // Build supported link section (only for production mode)
        const supportedLinkSection = showSupportedLink ? `
            <div class="supported-link-section">
                <label class="supported-link-label" for="supportedLinkInput">Reference URL (for all selected):</label>
                <input
                    type="text"
                    id="supportedLinkInput"
                    class="supported-link-input"
                    placeholder="https://example.com/reference"
                    autocomplete="off"
                />
            </div>
        ` : '';

        modal.innerHTML = `
            <div class="family-modal-header">
                <h2 class="family-modal-title">${title}</h2>
                <div class="family-modal-actions">
                    <button class="family-modal-btn family-modal-btn-secondary" id="familyModalCancelBtn">Cancel</button>
                    <button class="family-modal-btn family-modal-btn-primary" id="familyModalConfirmBtn">Confirm</button>
                </div>
            </div>

            ${supportedLinkSection}

            <div class="grouping-family-section">
                <div class="grouping-family-header">
                    <label class="grouping-family-title">Select Grouping Family (${selectedHeadings.length} heading${selectedHeadings.length !== 1 ? 's' : ''} selected):</label>
                    <div class="bulk-grouping-controls">
                        <input type="checkbox" id="bulkGroupingCheckbox" />
                        <label for="bulkGroupingCheckbox">Apply same grouping to all selected</label>
                    </div>
                </div>
                <div class="grouping-family-list">
                    ${groupingFamilyHTML}
                </div>
                <div class="family-modal-note">
                    <i class="fas fa-info-circle"></i>
                    <span>Note: Grouping family is used for PDM creation and family-wise reporting.</span>
                </div>
            </div>
        `;

        overlay.appendChild(modal);
        document.body.appendChild(overlay);

        // Focus input after render (production mode only)
        if (showSupportedLink) {
            const input = modal.querySelector('#supportedLinkInput');
            setTimeout(() => input.focus(), 50);
        }

        // Bulk grouping checkbox logic
        const bulkCheckbox = modal.querySelector('#bulkGroupingCheckbox');
        const dropdowns = modal.querySelectorAll('.grouping-family-dropdown');

        bulkCheckbox.addEventListener('change', (e) => {
            if (e.target.checked && dropdowns.length > 0) {
                const firstValue = dropdowns[0].value;
                dropdowns.forEach(dropdown => {
                    // Only set if the family exists in options
                    const hasOption = Array.from(dropdown.options).some(opt => opt.value === firstValue);
                    if (hasOption) {
                        dropdown.value = firstValue;
                    }
                });
            }
        });

        // Sync dropdowns when bulk is checked
        if (dropdowns.length > 0) {
            dropdowns[0].addEventListener('change', () => {
                if (bulkCheckbox.checked) {
                    const firstValue = dropdowns[0].value;
                    dropdowns.forEach(dropdown => {
                        const hasOption = Array.from(dropdown.options).some(opt => opt.value === firstValue);
                        if (hasOption) {
                            dropdown.value = firstValue;
                        }
                    });
                }
            });
        }

        // Cancel button
        modal.querySelector('#familyModalCancelBtn').addEventListener('click', () => {
            this._closeModal(overlayId);
        });

        // Confirm button
        modal.querySelector('#familyModalConfirmBtn').addEventListener('click', () => {
            this._handleConfirm(selectedHeadings, showSupportedLink, overlayId, onConfirm);
        });

        // Close on overlay click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                this._closeModal(overlayId);
            }
        });
    },

    /**
     * Handle confirmation logic
     * @private
     */
    _handleConfirm(selectedHeadings, showSupportedLink, overlayId, onConfirm) {
        // Get supported link value (if applicable)
        const supportedLink = showSupportedLink
            ? (document.getElementById('supportedLinkInput')?.value?.trim() || '')
            : '';

        // Get grouping family selections from dropdowns
        const dropdowns = document.querySelectorAll('.grouping-family-dropdown');
        const groupingSelections = {};

        dropdowns.forEach(dropdown => {
            const headingId = dropdown.getAttribute('data-heading-id');
            const selectedFamily = dropdown.value;
            groupingSelections[headingId] = selectedFamily;
        });

        // Validate all grouping families are selected
        let missingSelection = false;
        selectedHeadings.forEach(heading => {
            if (!groupingSelections[heading.id]) {
                missingSelection = true;
            }
        });

        if (missingSelection) {
            alert('Please select a grouping family for all headings');
            return;
        }

        // Set grouping family for each heading in registry
        selectedHeadings.forEach(heading => {
            const headingInRegistry = workspaceState.headingsRegistry[heading.id];
            if (headingInRegistry) {
                headingInRegistry.groupingFamily = groupingSelections[heading.id];
                if (showSupportedLink) {
                    headingInRegistry.supportedLink = supportedLink;
                }
            }
        });

        // Close modal
        this._closeModal(overlayId);

        // Execute callback with results
        if (onConfirm) {
            onConfirm({
                headings: selectedHeadings,
                groupingSelections,
                supportedLink
            });
        }
    },

    /**
     * Close the modal
     * @private
     */
    _closeModal(overlayId) {
        const overlay = document.getElementById(overlayId);
        if (overlay) {
            overlay.remove();
        }
    }
};

// Legacy function wrappers for backward compatibility
export function showSupportedLinkModal(selectedHeadings) {
    FamilyAssignModal.showProductionModal(selectedHeadings, (result) => {
        // Legacy callback behavior for production mode
        const { headings, groupingSelections, supportedLink } = result;

        // Process each heading
        headings.forEach(heading => {
            const headingInRegistry = workspaceState.headingsRegistry[heading.id];

            if (headingInRegistry) {
                // Move to supported list
                if (!workspaceState.supportedHeadingIds.includes(heading.id)) {
                    workspaceState.supportedHeadingIds.push(heading.id);
                }

                // Remove from imported list
                const importIndex = workspaceState.importedHeadingIds.indexOf(heading.id);
                if (importIndex > -1) {
                    workspaceState.importedHeadingIds.splice(importIndex, 1);
                }
            }
        });

        // Save data
        saveCurrentWorkspaceData();

        // Clear selection and re-render
        productionState.selectedImportIds.clear();
        renderImportedHeadings();
        renderSupportedHeadings();

    });
}

export function closeSupportedLinkModal() {
    FamilyAssignModal._closeModal('supportedLinkModalOverlay');
}

export function showQCGroupingFamilyModal(selectedHeadings, callback) {
    FamilyAssignModal.showQCModal(selectedHeadings, (result) => {
        // Set grouping family for each heading (already done in _handleConfirm)
        // Just call the original callback
        if (callback) {
            callback(result.headings);
        }
    });
}

// Window bridges removed - exports are imported where needed
