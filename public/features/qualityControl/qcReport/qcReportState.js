// Centralized QC Report State
// Shared across qcReport.js, qcExport.js, and importSection.js

export const qcReportState = {
    isReportGenerated: false,
    isClassificationGenerated: false,
    isGeneratingClassification: false,
    isGeneratingReport: false,
    pdmGroups: {}
};

export function setClassificationGenerated(isGenerated) {
    qcReportState.isClassificationGenerated = Boolean(isGenerated);
}

export function setClassificationGenerationInProgress(isInProgress) {
    qcReportState.isGeneratingClassification = Boolean(isInProgress);
}

export function setReportGenerationInProgress(isInProgress) {
    qcReportState.isGeneratingReport = Boolean(isInProgress);
}

// DOM section references — initialized once when the DOM is ready
export const reportSections = {
    unsupportedSection: null,
    pdmDetailsSection: null,
    primaryValidationSection: null,
    deletedSection: null
};

// Initialize DOM references (call after DOMContentLoaded)
export function initReportSections() {
    reportSections.unsupportedSection = document.getElementById('unsupportedSection');
    reportSections.pdmDetailsSection = document.getElementById('pdmDetailsSection');
    reportSections.primaryValidationSection = document.getElementById('primaryValidationSection');
    reportSections.deletedSection = document.getElementById('deletedSection');
}
