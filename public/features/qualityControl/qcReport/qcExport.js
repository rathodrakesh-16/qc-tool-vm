import { showAlert } from '../../../components/notification.js';
import { authManager } from '../../../core/auth/AuthManager.js';
import { qcReportState } from './qcReportState.js';

let exportButtonListener = null;

function getClassificationDetailsPayload() {
    const table = document.getElementById('classificationDetailsTable');
    if (!table) {
        throw new Error('Classification Details table not found.');
    }

    return Array.from(table.querySelectorAll('tbody tr'))
        .map(row => Array.from(row.querySelectorAll('td')).map(cell => cell.textContent || ''))
        .filter(row => row.some(cell => cell.trim() !== ''));
}

export async function exportQCReport(filenamePrefix = 'QC_Report') {
    try {
        if (!qcReportState.isReportGenerated) {
            showAlert('error', 'Please generate the QC Report first before exporting.');
            return;
        }

        const classificationDetails = getClassificationDetailsPayload();
        if (classificationDetails.length === 0) {
            showAlert('error', 'No classification details available to export.');
            return;
        }

        let accountDetails = {};
        try {
            accountDetails = JSON.parse(localStorage.getItem('accountDetails') || '{}');
        } catch (error) {
        }

        const companyProfile = localStorage.getItem('companyProfile') || '';
        const filename = accountDetails.accountName
            ? `${filenamePrefix}_${accountDetails.accountName}`
            : filenamePrefix;

        const response = await authManager.exportReport({
            classificationDetails,
            accountDetails,
            companyProfile,
            filename
        });

        const url = window.URL.createObjectURL(response.blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = response.filename || 'QC_Report.xlsx';
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);

        showAlert('success', 'QC Report has been exported successfully!');
    } catch (error) {
        showAlert('error', `Export failed due to an error: ${error.message}. Please try again.`);
    }
}

export function initializeExport() {
    const exportBtn = document.querySelector('.export-qc-btn');
    if (!exportBtn) {
        showAlert('error', 'Export button not found. Please refresh the page and try again.');
        return;
    }

    if (exportButtonListener) {
        exportBtn.removeEventListener('click', exportButtonListener);
    }

    exportButtonListener = (event) => {
        event.preventDefault();
        exportQCReport();
    };

    exportBtn.addEventListener('click', exportButtonListener);
}

export function resetExport() {
    initializeExport();
}

document.addEventListener('reportCleared', resetExport);
document.addEventListener('reportGenerated', resetExport);
