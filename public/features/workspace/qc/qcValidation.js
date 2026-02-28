// QC Validation Logic
// Handles "QC Checked" (Confirmation) interactions. Feedback logic moved to modals/qcFeedbackModal.js

import { renderQCPDMsList } from './qcReview.js';
import { renderProductionPDMLibrary } from '../editor/production.js';
import { workspaceState } from '../state/workspaceState.js';
import { qcSectionState } from '../state/qcSectionState.js';
import { initializeQCReportTab, calculateProductionErrorStats, renderAccountSummarySection } from './workspaceQcReport.js';
import { QCFeedbackModal } from '../modals/qcFeedbackModal.js';

export const QCValidation = {
    // Handle "QC Checked" (Confirm layout)
    handleQCChecked: function () {
        if (!qcSectionState.selectedPDM) return;

        const pdm = qcSectionState.selectedPDM;
        const wasDefective = pdm.qcStatus === 'error'; // Check if it was defective

        // Update QC Status
        pdm.qcStatus = 'checked';
        // Preserve feedback for history
        // pdm.qcFeedback = null; // REMOVED to keep error history

        // If it was defective, mark validation status as Done
        if (wasDefective) {
            pdm.validationStatus = 'Done';
        }

        // Update in shared state if it's a saved PDM
        if (workspaceState.savedPDMs) {
            const index = workspaceState.savedPDMs.findIndex(p => p.id === pdm.id);
            if (index !== -1) {
                workspaceState.savedPDMs[index].qcStatus = 'checked';
                // workspaceState.savedPDMs[index].qcFeedback = null; // REMOVED
                if (wasDefective) {
                    workspaceState.savedPDMs[index].validationStatus = 'Done';
                }
            }
        }

        // Re-render views to show updated status
        renderQCPDMsList();
        renderProductionPDMLibrary();

        // Refresh Report Data if available globally
        initializeQCReportTab();
        calculateProductionErrorStats();
        renderAccountSummarySection();

        alert(`${pdm.number} marked as QC Checked!`);
    }
};

// Functions to bridge old calls to new Modal object if necessary
// (Ideally we update the HTML onclick handlers, but this keeps backward compatibility for now if missed)
export function openQCFeedbackModal() {
    QCFeedbackModal.openFeedbackModal();
}

// Window bridges for ESM migration
if (typeof window !== 'undefined') {
    window.QCValidation = QCValidation;
    window.openQCFeedbackModal = openQCFeedbackModal;
}
