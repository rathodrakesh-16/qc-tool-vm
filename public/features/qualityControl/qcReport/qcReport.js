// qcReport.js - Core Report Generation Functions

import { showAlert, hideAlert } from '../../../components/notification.js';
import { authManager } from '../../../core/auth/AuthManager.js';
import { renderQCReportSkeleton, removeQCReportSkeleton } from '../../../components/skeleton.js';
import { initializeAiValidation } from './qcAiValidation.js';
import {
    qcReportState,
    reportSections,
    initReportSections,
    setReportGenerationInProgress
} from './qcReportState.js';

// Cached DOM elements
export const DOM_CACHE = {
    classificationTable: null
};

// Event listener cleanup
export const eventListeners = [];
const summaryEventListeners = [];
let qualityControlConfigCache = null;

function addTrackedEventListener(listenerStore, element, type, listener) {
    if (!element || typeof listener !== 'function') return;
    element.addEventListener(type, listener);
    listenerStore.push({ element, type, listener });
}

function removeTrackedEventListeners(listenerStore) {
    listenerStore.forEach(({ element, type, listener }) => {
        element.removeEventListener(type, listener);
    });
    listenerStore.length = 0;
}

function removeSummaryEventListeners() {
    removeTrackedEventListeners(summaryEventListeners);
}

async function getQualityControlConfig() {
    if (qualityControlConfigCache) {
        return qualityControlConfigCache;
    }

    try {
        const payload = await authManager.fetchQCConfig();
        qualityControlConfigCache = payload?.qualityControl || {};
    } catch (error) {
        qualityControlConfigCache = {};
    }

    return qualityControlConfigCache;
}

// Small pure/stateless helpers used for data processing and scrolling.

/**
 * Smooth-scrolls to a specific PDM validation section and highlights it.
 */
export function scrollToPDMSection(pdmNum) {
    const section = document.getElementById(`pdm-section-${pdmNum}`);
    if (section) {
        section.scrollIntoView({ behavior: 'smooth', block: 'start' });
        // Highlight the section temporarily
        section.style.transition = 'background-color 0.2s ease';
        section.style.backgroundColor = '#e0f7fa';
        setTimeout(() => {
            section.style.backgroundColor = '#f8f8f8';
        }, 2000);
    } else {
    }
}

// Display values (displayCommonFamily, displayCompanyType, displayQuality) are
// now computed by the backend in ReportService and included in each pdmGroup.

// Functions to create buttons, lists, clipboard copy, and empty states.

/**
 * Renders the initial empty state placeholder in the QC Report section.
 */
export function showQCReportEmptyState() {
    // Check if report already generated
    if (qcReportState.isReportGenerated) {
        return;
    }

    // Check if empty state already exists
    const existingEmptyState = document.querySelector('.qc-report-empty-state');
    if (existingEmptyState) {
        return;
    }

    // Create empty state
    const emptyState = document.createElement('div');
    emptyState.className = 'qc-report-empty-state';
    emptyState.innerHTML = `
        <i class="fas fa-file-alt"></i>
        <p>To generate QC Report, Please add the necessary data in the Import Section.</p>
    `;

    // Insert at the beginning of report sections
    const reportSections = document.getElementById('reportSections');
    if (reportSections) {
        reportSections.insertBefore(emptyState, reportSections.firstChild);
    }
}

/**
 * Appends a copy-to-clipboard button to the summary header.
 */
export function addCopyButtonToSummary(summaryContainer) {
    const copyButton = document.createElement('button');
    copyButton.innerHTML = '<i class="fa-regular fa-copy"></i>';
    copyButton.className = 'copy-summary-btn';
    copyButton.title = 'Copy summary data to clipboard';

    const copyListener = () => {
        const accountData = summaryContainer.querySelector('.account-details-part');
        const otherData = summaryContainer.querySelector('.other-details-part');
        const companyData = summaryContainer.querySelector('.company-profile-part');

        let summaryText = "=== QC Report Summary ===\n\n";

        if (accountData) {
            accountData.querySelectorAll('li').forEach(item => {
                const label = item.querySelector('span:first-child').textContent;
                const value = item.querySelector('span:last-child').textContent;
                summaryText += `${label} ${value}\n`;
            });
        }

        summaryText += "\n";

        if (otherData) {
            otherData.querySelectorAll('li').forEach(item => {
                const label = item.querySelector('span:first-child').textContent;
                const value = item.querySelector('span:last-child').textContent;
                summaryText += `${label} ${value}\n`;
            });
        }

        summaryText += "\n";

        if (companyData) {
            const label = companyData.querySelector('span:first-child').textContent;
            const value = companyData.querySelector('.company-profile-value-container').textContent;
            summaryText += `${label}\n${value}\n`;
        }

        navigator.clipboard.writeText(summaryText).then(() => {
            showAlert('success', 'Summary copied to clipboard!');
            copyButton.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => {
                copyButton.innerHTML = '<i class="fa-regular fa-copy"></i>';
            }, 1000);
        }).catch(err => {
            showAlert('error', 'Failed to copy summary to clipboard.');
            fallbackCopyTextToClipboard(summaryText);
        });
    };
    addTrackedEventListener(summaryEventListeners, copyButton, 'click', copyListener);

    const summaryHeader = summaryContainer.querySelector('.pdm-header');
    if (summaryHeader) {
        summaryHeader.appendChild(copyButton);
    }

}

/**
 * Fallback copy mechanism using a hidden textarea for older browser support.
 */
export function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement('textarea');
    textArea.value = text;

    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();

    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showAlert('success', 'Summary copied to clipboard!');
        } else {
            showAlert('error', 'Unable to copy summary to clipboard.');
        }
    } catch (err) {
        showAlert('error', 'Failed to copy summary to clipboard.');
    }

    document.body.removeChild(textArea);
}

function renderAccountItemInEditMode(item, label, value) {
    item.replaceChildren();

    const labelSpan = document.createElement('span');
    labelSpan.style.fontWeight = '600';
    labelSpan.style.color = 'var(--text-secondary)';
    labelSpan.style.marginBottom = '4px';
    labelSpan.style.display = 'block';
    labelSpan.textContent = `${label}:`;

    const input = document.createElement('input');
    input.type = 'text';
    input.value = value;
    input.dataset.label = label;
    input.style.width = '100%';
    input.style.padding = '8px 12px';
    input.style.border = '1px solid var(--border-color)';
    input.style.borderRadius = 'var(--radius-sm)';
    input.style.fontSize = '14px';

    item.appendChild(labelSpan);
    item.appendChild(input);
}

function renderAccountItemReadMode(item, label, value) {
    item.replaceChildren();

    const labelSpan = document.createElement('span');
    labelSpan.style.fontWeight = '600';
    labelSpan.style.color = 'var(--text-secondary)';
    labelSpan.textContent = `${label}:`;

    const valueSpan = document.createElement('span');
    valueSpan.style.color = 'var(--text-primary)';
    valueSpan.style.wordWrap = 'break-word';
    valueSpan.textContent = value;

    item.appendChild(labelSpan);
    item.appendChild(valueSpan);
}

/**
 * Appends an edit/save toggle button to the account details section.
 */
export function addEditButtonToAccountDetails(accountSection, summaryContainer) {
    const editButton = document.createElement('button');
    editButton.innerHTML = '<i class="fas fa-edit"></i> Edit';
    editButton.className = 'edit-account-btn';

    const editListener = () => {
        const items = accountSection.querySelectorAll('li');
        const isEditing = editButton.textContent.includes('Save');

        if (!isEditing) {
            items.forEach(item => {
                const label = item.querySelector('span:first-child').textContent.replace(':', '');
                const value = item.querySelector('span:last-child').textContent;
                renderAccountItemInEditMode(item, label, value);
            });
            editButton.innerHTML = '<i class="fas fa-save"></i> Save';
        } else {
            const newDetails = {};
            items.forEach(item => {
                const label = item.querySelector('input').dataset.label;
                const value = item.querySelector('input').value;
                newDetails[label.toLowerCase().replace(/\s+/g, '')] = value;
                renderAccountItemReadMode(item, label, value);
            });
            localStorage.setItem('accountDetails', JSON.stringify({
                accountName: newDetails.accountname || '',
                accountId: newDetails.accountid || '',
                editorName: newDetails.editorname || '',
                qcName: newDetails.qcname || ''
            }));
            showAlert('success', 'Account details saved successfully!');
            editButton.innerHTML = '<i class="fas fa-edit"></i> Edit';
        }
    };
    addTrackedEventListener(summaryEventListeners, editButton, 'click', editListener);

    const summaryHeader = summaryContainer.querySelector('.pdm-header');
    if (summaryHeader) {
        summaryHeader.appendChild(editButton);
    }

}

/**
 * Generates a styled unordered list from an array of key/value pairs.
 */
export function createSummaryList(items, isCompanyProfile = false) {
    const ul = document.createElement('ul');
    ul.style.listStyleType = 'none';
    ul.style.padding = '0';
    ul.style.margin = '0';

    items.forEach((item, index) => {
        const li = document.createElement('li');
        li.style.marginBottom = '0';
        li.style.padding = '6px 0';
        li.style.color = '#2d2d2d';
        li.style.fontSize = '14px';

        if (isCompanyProfile) {
            li.style.display = 'block';

            const labelSpan = document.createElement('span');
            labelSpan.style.display = 'block';
            labelSpan.style.fontWeight = 'bold';
            labelSpan.style.color = '#404040';
            labelSpan.style.marginBottom = '10px';
            labelSpan.textContent = `${item.label}:`;

            const valueContainer = document.createElement('div');
            valueContainer.className = 'company-profile-value-container';
            valueContainer.style.wordWrap = 'break-word';
            valueContainer.textContent = String(item.value ?? '');

            li.appendChild(labelSpan);
            li.appendChild(valueContainer);
        } else {
            li.style.display = 'flex';
            li.style.alignItems = 'flex-start';
            if (index < items.length - 1) li.style.borderBottom = '1px solid #d3d3d3';

            const labelSpan = document.createElement('span');
            labelSpan.style.width = '550px';
            labelSpan.style.fontWeight = 'bold';
            labelSpan.style.color = '#404040';
            labelSpan.style.paddingRight = '10px';
            labelSpan.style.textAlign = 'left';
            labelSpan.style.borderRight = '1px solid #d3d3d3';
            labelSpan.textContent = `${item.label}:`;

            const valueSpan = document.createElement('span');
            valueSpan.style.flex = '1';
            valueSpan.style.paddingLeft = '10px';
            valueSpan.style.wordWrap = 'break-word';
            valueSpan.textContent = String(item.value ?? '');

            li.appendChild(labelSpan);
            li.appendChild(valueSpan);
        }
        ul.appendChild(li);
    });

    return ul;
}

function normalizeTableCell(cellValue) {
    if (cellValue && typeof cellValue === 'object' && !Array.isArray(cellValue)) {
        return {
            text: String(cellValue.text ?? ''),
            isError: Boolean(cellValue.isError)
        };
    }

    return {
        text: String(cellValue ?? ''),
        isError: false
    };
}

function createHeadingSectionContainer(title, headingCount) {
    const container = document.createElement('div');
    container.classList.add('unsupported-section');

    const header = document.createElement('div');
    header.classList.add('header');
    header.append(document.createTextNode(`${title} `));

    const badge = document.createElement('span');
    badge.classList.add('word-count-badge');
    badge.textContent = `${headingCount} Headings`;
    header.appendChild(badge);

    const innerContent = document.createElement('div');
    innerContent.classList.add('inner-content');

    container.appendChild(header);
    container.appendChild(innerContent);

    return { container, innerContent };
}

function createHeadingTable(columnClass, headers, rows) {
    const tableContainer = document.createElement('div');
    tableContainer.classList.add('qc-table-container');

    const headerRow = document.createElement('div');
    headerRow.classList.add('qc-table-row', 'qc-table-header-row', columnClass);
    headers.forEach(text => {
        const cell = document.createElement('div');
        cell.classList.add('qc-table-cell');
        cell.textContent = text;
        headerRow.appendChild(cell);
    });
    tableContainer.appendChild(headerRow);

    rows.forEach(rowValues => {
        const row = document.createElement('div');
        row.classList.add('qc-table-row', columnClass);

        rowValues.forEach(rawCell => {
            const cellDef = normalizeTableCell(rawCell);
            const cell = document.createElement('div');
            cell.classList.add('qc-table-cell');
            if (cellDef.isError) {
                cell.style.color = 'red';
                cell.style.fontWeight = 'normal';
            }
            cell.textContent = cellDef.text;
            row.appendChild(cell);
        });

        tableContainer.appendChild(row);
    });

    return tableContainer;
}

function appendHeadingTableSection(fragment, { title, headingCount, columnClass, headers, rows }) {
    if (!Array.isArray(rows) || rows.length === 0) return;

    const { container, innerContent } = createHeadingSectionContainer(title, headingCount);
    innerContent.appendChild(createHeadingTable(columnClass, headers, rows));
    fragment.appendChild(container);
}

// Renders the overall pass/fail status and detailed validation errors.

/**
 * Renders the "Primary Validation Results" panel showing counts and errors.
 */
export function displayValidationResults(validationResults) {
    if (!reportSections.primaryValidationSection) {
        return;
    }
    reportSections.primaryValidationSection.innerHTML = '';

    // Calculate passed and failed counts
    const totalPDMs = Object.keys(qcReportState.pdmGroups).length;
    const failedCount = validationResults.length;
    const passedCount = totalPDMs - failedCount;

    const header = document.createElement('div');
    header.classList.add('header');
    header.innerHTML = `Primary Validation Results
     <span class="validation-count-container">
            <span class="validation-count-badge passed">
                <i class="fas fa-check-circle"></i>Passed: ${passedCount}
            </span>
            <span class="validation-count-badge failed">
                <i class="fas fa-times-circle"></i>Failed: ${failedCount}
            </span>
    </span>`;
    reportSections.primaryValidationSection.appendChild(header);

    if (validationResults.length === 0) {
        const noIssues = document.createElement('div');
        noIssues.classList.add('validation-result');
        noIssues.textContent = 'Good Job!!....No Errors Found.';
        reportSections.primaryValidationSection.appendChild(noIssues);
    } else {
        validationResults.forEach(result => {
            const resultDiv = document.createElement('div');
            resultDiv.classList.add('validation-result');
            const pdmHeader = document.createElement('div');
            pdmHeader.classList.add('pdm-number');
            pdmHeader.textContent = `${result.pdmNum}`;
            resultDiv.appendChild(pdmHeader);
            if (result.errors.length > 0) {
                const errorContainer = document.createElement('div');
                errorContainer.classList.add('error');
                errorContainer.addEventListener('click', () => scrollToPDMSection(result.pdmNum));
                errorContainer.style.cursor = 'pointer';

                const errorList = document.createElement('ul');
                errorList.style.margin = '0';
                errorList.style.paddingLeft = '20px';
                result.errors.forEach(error => {
                    const errorItem = document.createElement('li');
                    errorItem.style.whiteSpace = 'pre-wrap'; // Enable multi-line text
                    errorItem.textContent = error;
                    errorList.appendChild(errorItem);
                });
                errorContainer.appendChild(errorList);
                resultDiv.appendChild(errorContainer);
            }
            reportSections.primaryValidationSection.appendChild(resultDiv);
        });
    }
}


// Re-rendering panels, organizing headings by PDM, grouping, and logic execution.

/**
 * Restores a previously generated QC report from saved data (e.g. localStorage).
 * Re-renders all sections without calling the backend.
 * @param {Object} reportResponse - The full backend response object.
 */
async function restoreQCReport(reportResponse) {

    // Remove empty state if present
    const existingEmptyState = document.querySelector('.qc-report-empty-state');
    if (existingEmptyState) existingEmptyState.remove();

    removeSummaryEventListeners();
    const staleSummary = document.getElementById('qcReportSummarySection');
    if (staleSummary) staleSummary.remove();

    [reportSections.unsupportedSection, reportSections.pdmDetailsSection, reportSections.primaryValidationSection, reportSections.deletedSection].forEach(section => {
        if (section) section.innerHTML = '';
    });

    const pdmGroups = reportResponse?.pdmGroups || {};
    qcReportState.pdmGroups = pdmGroups;
    const validationResults = Array.isArray(reportResponse?.validationResults) ? reportResponse.validationResults : [];
    const summary = reportResponse?.summary || {};
    const unsupportedQualityHeadings = Array.isArray(reportResponse?.unsupportedHeadings) ? reportResponse.unsupportedHeadings : [];
    const unprocessedQualityHeadings = Array.isArray(reportResponse?.unprocessedHeadings) ? reportResponse.unprocessedHeadings : [];
    const noPdmHeadings = Array.isArray(reportResponse?.noPdmHeadings) ? reportResponse.noPdmHeadings : [];
    const deletedHeadings = Array.isArray(reportResponse?.deletedHeadings) ? reportResponse.deletedHeadings : [];

    const qualityControlConfig = await getQualityControlConfig();
    const configuredMinWordCount = Number(qualityControlConfig?.validation?.min_word_count);
    const configuredMaxWordCount = Number(qualityControlConfig?.validation?.max_word_count);
    const minWordCount = Number.isFinite(configuredMinWordCount) ? configuredMinWordCount : 20;
    const maxWordCount = Number.isFinite(configuredMaxWordCount) ? configuredMaxWordCount : 115;

    let accountDetails;
    try {
        accountDetails = JSON.parse(localStorage.getItem('accountDetails') || '{}');
    } catch (e) {
        accountDetails = {};
    }
    const companyProfile = localStorage.getItem('companyProfile') || '';

    const summaryFragment = document.createDocumentFragment();
    const unsupportedFragment = document.createDocumentFragment();
    const deletedFragment = document.createDocumentFragment();
    const pdmFragment = document.createDocumentFragment();

    const summaryContainer = document.createElement('div');
    summaryContainer.classList.add('pdm-section', 'qc-report-summary');
    summaryContainer.id = 'qcReportSummarySection';
    summaryContainer.innerHTML = '<div class="pdm-header">Summary</div>';
    const summaryInner = document.createElement('div');
    summaryInner.classList.add('inner-content');

    const accountSection = document.createElement('div');
    accountSection.classList.add('summary-part', 'account-details-part');
    accountSection.appendChild(createSummaryList([
        { label: 'Account Name', value: accountDetails.accountName || 'Not provided' },
        { label: 'Account ID', value: accountDetails.accountId || 'Not provided' },
        { label: 'Editor Name', value: accountDetails.editorName || 'Not provided' },
        { label: 'QC Name', value: accountDetails.qcName || 'Not provided' }
    ]));
    summaryInner.appendChild(accountSection);

    const otherSection = document.createElement('div');
    otherSection.classList.add('summary-part', 'other-details-part');
    otherSection.appendChild(createSummaryList([
        { label: 'Total Grouped PDMs', value: summary.totalGroupedPDMs ?? 0 },
        { label: 'Total Existing Headings', value: summary.totalExistingHeadings ?? 0 },
        { label: 'Unique Links for Existing Headings', value: summary.uniqueExistingLinks ?? 0 },
        { label: 'Total Added Headings', value: summary.totalAddedHeadings ?? 0 },
        { label: 'Unique Links for Added Headings', value: summary.uniqueAddedLinks ?? 0 },
        { label: 'Total unsupported heading', value: summary.totalUnsupportedHeadings ?? 0 },
        { label: 'Total Deleted Headings', value: summary.totalDeletedHeadings ?? 0 }
    ]));
    summaryInner.appendChild(otherSection);

    const companySection = document.createElement('div');
    companySection.classList.add('summary-part', 'company-profile-part');
    companySection.appendChild(createSummaryList([{ label: 'Company Profile Description', value: companyProfile || 'Not provided' }], true));
    summaryInner.appendChild(companySection);

    summaryContainer.appendChild(summaryInner);
    summaryFragment.appendChild(summaryContainer);

    addCopyButtonToSummary(summaryContainer);
    addEditButtonToAccountDetails(accountSection, summaryContainer);

    appendHeadingTableSection(unsupportedFragment, {
        title: 'Unsupported Headings',
        headingCount: unsupportedQualityHeadings.length,
        columnClass: 'qc-cols-unsupported',
        headers: ['Heading ID', 'Heading Name', 'Family', 'Error'],
        rows: unsupportedQualityHeadings.map(h => ([
            h.headingId ?? '', h.headingName ?? '', h.family || '',
            { text: h.error || 'OK', isError: Boolean(h.error) }
        ]))
    });

    appendHeadingTableSection(unsupportedFragment, {
        title: 'Unprocessed Headings',
        headingCount: unprocessedQualityHeadings.length,
        columnClass: 'qc-cols-unsupported',
        headers: ['Heading ID', 'Heading Name', 'Family', 'Error'],
        rows: unprocessedQualityHeadings.map(h => ([
            h.headingId ?? '', h.headingName ?? '', h.family || '',
            { text: h.error || 'OK', isError: Boolean(h.error) }
        ]))
    });

    appendHeadingTableSection(unsupportedFragment, {
        title: 'Headings with No PDM Number',
        headingCount: noPdmHeadings.length,
        columnClass: 'qc-cols-nopdm',
        headers: ['Heading ID', 'Heading Name', 'Family'],
        rows: noPdmHeadings.map(h => ([
            h.headingId ?? '', h.headingName ?? '', h.family || ''
        ]))
    });

    appendHeadingTableSection(deletedFragment, {
        title: 'Deleted Headings',
        headingCount: deletedHeadings.length,
        columnClass: 'qc-cols-deleted',
        headers: ['Heading ID', 'Heading Name', 'Assigned URL', 'Family', 'Type of Proof'],
        rows: deletedHeadings.map(h => ([
            h.headingId ?? '', h.headingName ?? '', h.assignedUrl || 'No URL assigned',
            h.family || '', h.hqs || 'Not specified'
        ]))
    });

    const errorMap = validationResults.reduce((map, result) => {
        map[result.pdmNum] = result.errors;
        return map;
    }, {});

    for (const pdmNum in pdmGroups) {
        const pdmData = pdmGroups[pdmNum];
        const pdmContainer = document.createElement('div');
        pdmContainer.classList.add('pdm-section');
        pdmContainer.id = `pdm-section-${pdmNum}`;
        const hasErrors = errorMap[pdmNum] && errorMap[pdmNum].length > 0;

        const pdmText = pdmData?.pdmText || '';
        const wordCount = Number.isFinite(pdmData?.wordCount)
            ? pdmData.wordCount
            : (pdmText.trim() ? pdmText.trim().split(/\s+/).length : 0);
        const isWordCountWarning = wordCount < minWordCount || wordCount > maxWordCount;
        const wordCountBadge = `<span class="word-count-badge${isWordCountWarning ? ' warning' : ''}">${wordCount} words</span>`;

        const statusIcon = hasErrors ? '<i class="fas fa-times-circle"></i>' : '<i class="fas fa-check-circle"></i>';
        const statusBadge = `<span class="status-badge ${hasErrors ? 'failed' : 'passed'}">${statusIcon} ${hasErrors ? 'Failed' : 'Passed'}</span>`;

        pdmContainer.innerHTML = `<div class="pdm-header"><span>${pdmNum}</span><div class="header-badges">${wordCountBadge}${statusBadge}</div></div><div class="inner-content"></div>`;
        const inner = pdmContainer.querySelector('.inner-content');
        const errors = errorMap[pdmNum] || [];

        pdmData.headings.forEach(h => {
            const item = document.createElement('div');
            item.classList.add('report-item');
            const label = document.createElement('span');
            label.classList.add('label');
            label.textContent = h.type ? `${h.type} Heading` : 'Heading';
            const value = document.createElement('span');
            value.classList.add('value');
            value.textContent = h.name || '';
            item.appendChild(label);
            item.appendChild(value);
            inner.appendChild(item);
        });

        const uniqueUrls = [...new Set(pdmData.assignedUrls)];
        const urlItem = document.createElement('div');
        urlItem.classList.add('report-item');
        const urlLabel = document.createElement('span');
        urlLabel.classList.add('label');
        urlLabel.textContent = 'Assigned URL';
        const urlValue = document.createElement('span');
        urlValue.classList.add('value');
        urlValue.textContent = uniqueUrls[0] || 'No URL assigned';
        urlItem.appendChild(urlLabel);
        urlItem.appendChild(urlValue);
        inner.appendChild(urlItem);

        const familyItem = document.createElement('div');
        familyItem.classList.add('report-item');
        const familyLabel = document.createElement('span');
        familyLabel.classList.add('label');
        familyLabel.textContent = 'Common Family';
        const familyValue = document.createElement('span');
        familyValue.classList.add('value');
        familyValue.textContent = pdmData.displayCommonFamily || 'No common family';
        familyItem.appendChild(familyLabel);
        familyItem.appendChild(familyValue);
        inner.appendChild(familyItem);

        const companyTypeItem = document.createElement('div');
        companyTypeItem.classList.add('report-item');
        const companyTypeLabel = document.createElement('span');
        companyTypeLabel.classList.add('label');
        companyTypeLabel.textContent = 'Company Type';
        const companyTypeValueSpan = document.createElement('span');
        companyTypeValueSpan.classList.add('value');
        companyTypeValueSpan.textContent = pdmData.displayCompanyType || 'Not specified';
        companyTypeItem.appendChild(companyTypeLabel);
        companyTypeItem.appendChild(companyTypeValueSpan);
        inner.appendChild(companyTypeItem);

        const qualityItem = document.createElement('div');
        qualityItem.classList.add('report-item');
        const qualityLabel = document.createElement('span');
        qualityLabel.classList.add('label');
        qualityLabel.textContent = 'Type of Proof';
        const qualityValueSpan = document.createElement('span');
        qualityValueSpan.classList.add('value');
        qualityValueSpan.textContent = pdmData.displayQuality || 'Not specified';
        qualityItem.appendChild(qualityLabel);
        qualityItem.appendChild(qualityValueSpan);
        inner.appendChild(qualityItem);

        const textItem = document.createElement('div');
        textItem.classList.add('report-item');
        const textLabel = document.createElement('span');
        textLabel.classList.add('label');
        textLabel.textContent = 'PDM Description';
        const textValue = document.createElement('span');
        textValue.classList.add('value');
        textValue.textContent = pdmText;
        textItem.appendChild(textLabel);
        textItem.appendChild(textValue);
        inner.appendChild(textItem);

        if (errors.length > 0) {
            const errorItem = document.createElement('div');
            errorItem.classList.add('validation-error-section');
            const errorHeader = document.createElement('div');
            errorHeader.classList.add('error-header');
            errorHeader.innerHTML = '<i class="fas fa-exclamation-circle"></i> Validation Errors';
            errorItem.appendChild(errorHeader);
            const errorList = document.createElement('ul');
            errorList.classList.add('error-list');
            errors.forEach(error => {
                const errorListItem = document.createElement('li');
                errorListItem.style.whiteSpace = 'pre-wrap';
                errorListItem.textContent = error;
                errorList.appendChild(errorListItem);
            });
            errorItem.appendChild(errorList);
            inner.appendChild(errorItem);
        }

        pdmFragment.appendChild(pdmContainer);
    }

    displayValidationResults(validationResults);
    if (reportSections.unsupportedSection) {
        reportSections.unsupportedSection.parentNode.insertBefore(summaryFragment, reportSections.unsupportedSection);
        reportSections.unsupportedSection.appendChild(unsupportedFragment);
    }
    if (reportSections.deletedSection) {
        reportSections.deletedSection.appendChild(deletedFragment);
    }
    if (reportSections.pdmDetailsSection) {
        reportSections.pdmDetailsSection.appendChild(pdmFragment);
    }

    qcReportState.isReportGenerated = true;

    // Trigger AI validation for restored report
    document.dispatchEvent(new CustomEvent('reportGenerated'));

}

/**
 * Core rendering logic for the QC Report. Parses the Classification Details table,
 * maps entries to PDMs, triggers validation, and generates UI sections.
 * @returns {boolean} True if report rendered successfully, false otherwise.
 */
export async function processQCReport() {
    if (qcReportState.isGeneratingReport) {
        showAlert('warning', 'QC report generation is already in progress.');
        return false;
    }

    setReportGenerationInProgress(true);
    try {
        if (!qcReportState.isClassificationGenerated) {
            showAlert('error', 'Please generate the Classification Table first before generating the QC Report.');
            return false;
        }
        qcReportState.isReportGenerated = false;
        DOM_CACHE.classificationTable = DOM_CACHE.classificationTable || document.getElementById('classificationDetailsTable');

        removeSummaryEventListeners();

        // Remove stale summary section if it exists (prevents duplicates on regeneration)
        const staleSummary = document.getElementById('qcReportSummarySection');
        if (staleSummary) staleSummary.remove();

        // Remove empty state if it exists
        const existingEmptyState = document.querySelector('.qc-report-empty-state');
        if (existingEmptyState) {
            existingEmptyState.remove();
        }

        if (!DOM_CACHE.classificationTable) {
            showAlert('error', 'Classification Details table not found. Please ensure data is imported in Import Section.');
            return false;
        }

        const rows = DOM_CACHE.classificationTable.querySelectorAll('tbody tr');
        if (!rows.length) {
            showAlert('error', 'No data in Classification Details table. Please add data to generate report.');
            return false;
        }

        let hasValues = false;
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            cells.forEach(cell => {
                if (cell.textContent.trim() !== '') {
                    hasValues = true;
                }
            });
        });

        if (!hasValues) {
            showAlert('error', 'No values found in Classification Details table. Please add data to generate report.');
            return false;
        }

        [reportSections.unsupportedSection, reportSections.pdmDetailsSection, reportSections.primaryValidationSection, reportSections.deletedSection].forEach(section => {
            if (section) section.innerHTML = '';
        });

        const classificationDetails = Array.from(rows).map(row => {
            const rowData = [];
            for (let i = 0; i < 11; i++) {
                rowData.push(row.cells[i]?.textContent || '');
            }
            return rowData;
        });

        let accountDetails;
        try {
            accountDetails = JSON.parse(localStorage.getItem('accountDetails') || '{}');
            if (!accountDetails.accountName && !accountDetails.accountId && !accountDetails.editorName && !accountDetails.qcName) {
            }
        } catch (e) {
            showAlert('error', 'Error loading account details from storage.');
            accountDetails = {};
        }
        const companyProfile = localStorage.getItem('companyProfile') || '';

        // Hide real report content and show skeleton while backend generates report
        const reportWrapper = document.querySelector('.qc-report-wrapper');
        const skeletonContainer = document.querySelector('.qc-report-container');
        if (reportWrapper) reportWrapper.style.display = 'none';
        renderQCReportSkeleton(skeletonContainer);

        let reportResponse;
        try {
            reportResponse = await authManager.generateReport({
                classificationDetails,
                accountDetails,
                companyProfile
            });
        } catch (error) {
            showAlert('error', error?.message || 'Failed to generate QC report.');
            removeQCReportSkeleton(skeletonContainer);
            if (reportWrapper) reportWrapper.style.display = '';
            return false;
        }

        removeQCReportSkeleton(skeletonContainer);
        if (reportWrapper) reportWrapper.style.display = '';

        // Persist report response to localStorage
        try {
            localStorage.setItem('qcReportData', JSON.stringify(reportResponse));
        } catch (e) {
        }

        const pdmGroups = reportResponse?.pdmGroups || {};
        qcReportState.pdmGroups = pdmGroups;
        const validationResults = Array.isArray(reportResponse?.validationResults) ? reportResponse.validationResults : [];
        const summary = reportResponse?.summary || {};
        const unsupportedQualityHeadings = Array.isArray(reportResponse?.unsupportedHeadings) ? reportResponse.unsupportedHeadings : [];
        const unprocessedQualityHeadings = Array.isArray(reportResponse?.unprocessedHeadings) ? reportResponse.unprocessedHeadings : [];
        const noPdmHeadings = Array.isArray(reportResponse?.noPdmHeadings) ? reportResponse.noPdmHeadings : [];
        const deletedHeadings = Array.isArray(reportResponse?.deletedHeadings) ? reportResponse.deletedHeadings : [];

        const qualityControlConfig = await getQualityControlConfig();
        const configuredMinWordCount = Number(qualityControlConfig?.validation?.min_word_count);
        const configuredMaxWordCount = Number(qualityControlConfig?.validation?.max_word_count);
        const minWordCount = Number.isFinite(configuredMinWordCount) ? configuredMinWordCount : 20;
        const maxWordCount = Number.isFinite(configuredMaxWordCount) ? configuredMaxWordCount : 115;

        const summaryFragment = document.createDocumentFragment();
        const unsupportedFragment = document.createDocumentFragment();
        const deletedFragment = document.createDocumentFragment();
        const pdmFragment = document.createDocumentFragment();

        const summaryContainer = document.createElement('div');
        summaryContainer.classList.add('pdm-section', 'qc-report-summary');
        summaryContainer.id = 'qcReportSummarySection';
        summaryContainer.innerHTML = '<div class="pdm-header">Summary</div>';
        const summaryInner = document.createElement('div');
        summaryInner.classList.add('inner-content');

        const accountSection = document.createElement('div');
        accountSection.classList.add('summary-part', 'account-details-part');
        accountSection.appendChild(createSummaryList([
            { label: 'Account Name', value: accountDetails.accountName || 'Not provided' },
            { label: 'Account ID', value: accountDetails.accountId || 'Not provided' },
            { label: 'Editor Name', value: accountDetails.editorName || 'Not provided' },
            { label: 'QC Name', value: accountDetails.qcName || 'Not provided' }
        ]));
        summaryInner.appendChild(accountSection);

        const otherSection = document.createElement('div');
        otherSection.classList.add('summary-part', 'other-details-part');
        otherSection.appendChild(createSummaryList([
            { label: 'Total Grouped PDMs', value: summary.totalGroupedPDMs ?? 0 },
            { label: 'Total Existing Headings', value: summary.totalExistingHeadings ?? 0 },
            { label: 'Unique Links for Existing Headings', value: summary.uniqueExistingLinks ?? 0 },
            { label: 'Total Added Headings', value: summary.totalAddedHeadings ?? 0 },
            { label: 'Unique Links for Added Headings', value: summary.uniqueAddedLinks ?? 0 },
            { label: 'Total unsupported heading', value: summary.totalUnsupportedHeadings ?? 0 },
            { label: 'Total Deleted Headings', value: summary.totalDeletedHeadings ?? 0 }
        ]));
        summaryInner.appendChild(otherSection);

        const companySection = document.createElement('div');
        companySection.classList.add('summary-part', 'company-profile-part');
        companySection.appendChild(createSummaryList([{ label: 'Company Profile Description', value: companyProfile || 'Not provided' }], true));
        summaryInner.appendChild(companySection);

        summaryContainer.appendChild(summaryInner);
        summaryFragment.appendChild(summaryContainer);

        addCopyButtonToSummary(summaryContainer);
        addEditButtonToAccountDetails(accountSection, summaryContainer);

        appendHeadingTableSection(unsupportedFragment, {
            title: 'Unsupported Headings',
            headingCount: unsupportedQualityHeadings.length,
            columnClass: 'qc-cols-unsupported',
            headers: ['Heading ID', 'Heading Name', 'Family', 'Error'],
            rows: unsupportedQualityHeadings.map(h => ([
                h.headingId ?? '',
                h.headingName ?? '',
                h.family || '',
                { text: h.error || 'OK', isError: Boolean(h.error) }
            ]))
        });

        appendHeadingTableSection(unsupportedFragment, {
            title: 'Unprocessed Headings',
            headingCount: unprocessedQualityHeadings.length,
            columnClass: 'qc-cols-unsupported',
            headers: ['Heading ID', 'Heading Name', 'Family', 'Error'],
            rows: unprocessedQualityHeadings.map(h => ([
                h.headingId ?? '',
                h.headingName ?? '',
                h.family || '',
                { text: h.error || 'OK', isError: Boolean(h.error) }
            ]))
        });

        appendHeadingTableSection(unsupportedFragment, {
            title: 'Headings with No PDM Number',
            headingCount: noPdmHeadings.length,
            columnClass: 'qc-cols-nopdm',
            headers: ['Heading ID', 'Heading Name', 'Family'],
            rows: noPdmHeadings.map(h => ([
                h.headingId ?? '',
                h.headingName ?? '',
                h.family || ''
            ]))
        });

        appendHeadingTableSection(deletedFragment, {
            title: 'Deleted Headings',
            headingCount: deletedHeadings.length,
            columnClass: 'qc-cols-deleted',
            headers: ['Heading ID', 'Heading Name', 'Assigned URL', 'Family', 'Type of Proof'],
            rows: deletedHeadings.map(h => ([
                h.headingId ?? '',
                h.headingName ?? '',
                h.assignedUrl || 'No URL assigned',
                h.family || '',
                h.hqs || 'Not specified'
            ]))
        });

        const errorMap = validationResults.reduce((map, result) => {
            map[result.pdmNum] = result.errors;
            return map;
        }, {});

        for (const pdmNum in pdmGroups) {
            const pdmData = pdmGroups[pdmNum];
            const pdmContainer = document.createElement('div');
            pdmContainer.classList.add('pdm-section');
            pdmContainer.id = `pdm-section-${pdmNum}`;
            const hasErrors = errorMap[pdmNum] && errorMap[pdmNum].length > 0;

            // Get PDM description and calculate word count
            const pdmText = pdmData?.pdmText || '';
            const wordCount = Number.isFinite(pdmData?.wordCount)
                ? pdmData.wordCount
                : (pdmText.trim() ? pdmText.trim().split(/\s+/).length : 0);
            const isWordCountWarning = wordCount < minWordCount || wordCount > maxWordCount;
            const wordCountBadge = `<span class="word-count-badge${isWordCountWarning ? ' warning' : ''}">${wordCount} words</span>`;

            const statusIcon = hasErrors ? '<i class="fas fa-times-circle"></i>' : '<i class="fas fa-check-circle"></i>';
            const statusBadge = `<span class="status-badge ${hasErrors ? 'failed' : 'passed'}">${statusIcon} ${hasErrors ? 'Failed' : 'Passed'}</span>`;

            pdmContainer.innerHTML = `<div class="pdm-header"><span>${pdmNum}</span><div class="header-badges">${wordCountBadge}${statusBadge}</div></div><div class="inner-content"></div>`;
            const inner = pdmContainer.querySelector('.inner-content');
            const errors = errorMap[pdmNum] || [];

            pdmData.headings.forEach((h, index) => {
                const item = document.createElement('div');
                item.classList.add('report-item');
                const label = document.createElement('span');
                label.classList.add('label');
                label.textContent = h.type ? `${h.type} Heading` : 'Heading';
                const value = document.createElement('span');
                value.classList.add('value');
                value.textContent = h.name || '';
                item.appendChild(label);
                item.appendChild(value);
                inner.appendChild(item);
            });

            const uniqueUrls = [...new Set(pdmData.assignedUrls)];
            const urlItem = document.createElement('div');
            urlItem.classList.add('report-item');
            const urlLabel = document.createElement('span');
            urlLabel.classList.add('label');
            urlLabel.textContent = 'Assigned URL';
            const urlValue = document.createElement('span');
            urlValue.classList.add('value');
            urlValue.textContent = uniqueUrls[0] || 'No URL assigned';
            urlItem.appendChild(urlLabel);
            urlItem.appendChild(urlValue);
            inner.appendChild(urlItem);

            const familyItem = document.createElement('div');
            familyItem.classList.add('report-item');
            const familyLabel = document.createElement('span');
            familyLabel.classList.add('label');
            familyLabel.textContent = 'Common Family';
            const familyValue = document.createElement('span');
            familyValue.classList.add('value');
            familyValue.textContent = pdmData.displayCommonFamily || 'No common family';
            familyItem.appendChild(familyLabel);
            familyItem.appendChild(familyValue);
            inner.appendChild(familyItem);

            const companyTypeItem = document.createElement('div');
            companyTypeItem.classList.add('report-item');
            const companyTypeLabel = document.createElement('span');
            companyTypeLabel.classList.add('label');
            companyTypeLabel.textContent = 'Company Type';
            const companyTypeValueSpan = document.createElement('span');
            companyTypeValueSpan.classList.add('value');
            companyTypeValueSpan.textContent = pdmData.displayCompanyType || 'Not specified';
            companyTypeItem.appendChild(companyTypeLabel);
            companyTypeItem.appendChild(companyTypeValueSpan);
            inner.appendChild(companyTypeItem);

            const qualityItem = document.createElement('div');
            qualityItem.classList.add('report-item');
            const qualityLabel = document.createElement('span');
            qualityLabel.classList.add('label');
            qualityLabel.textContent = 'Type of Proof';
            const qualityValueSpan = document.createElement('span');
            qualityValueSpan.classList.add('value');
            qualityValueSpan.textContent = pdmData.displayQuality || 'Not specified';
            qualityItem.appendChild(qualityLabel);
            qualityItem.appendChild(qualityValueSpan);
            inner.appendChild(qualityItem);

            // pdmText already extracted above for word count
            const textItem = document.createElement('div');
            textItem.classList.add('report-item');
            const textLabel = document.createElement('span');
            textLabel.classList.add('label');
            textLabel.textContent = 'PDM Description';
            const textValue = document.createElement('span');
            textValue.classList.add('value');
            textValue.textContent = pdmText;
            textItem.appendChild(textLabel);
            textItem.appendChild(textValue);
            inner.appendChild(textItem);

            if (errors.length > 0) {
                const errorItem = document.createElement('div');
                errorItem.classList.add('validation-error-section');

                const errorHeader = document.createElement('div');
                errorHeader.classList.add('error-header');
                errorHeader.innerHTML = '<i class="fas fa-exclamation-circle"></i> Validation Errors';
                errorItem.appendChild(errorHeader);

                const errorList = document.createElement('ul');
                errorList.classList.add('error-list');
                errors.forEach(error => {
                    const errorListItem = document.createElement('li');
                    errorListItem.style.whiteSpace = 'pre-wrap'; // Enable multi-line text
                    errorListItem.textContent = error;
                    errorList.appendChild(errorListItem);
                });
                errorItem.appendChild(errorList);
                inner.appendChild(errorItem);
            }

            pdmFragment.appendChild(pdmContainer);
        }

        displayValidationResults(validationResults);
        if (reportSections.unsupportedSection) {
            reportSections.unsupportedSection.parentNode.insertBefore(summaryFragment, reportSections.unsupportedSection);
            reportSections.unsupportedSection.appendChild(unsupportedFragment);
        } else {
        }
        if (reportSections.deletedSection) {
            reportSections.deletedSection.appendChild(deletedFragment);
        } else {
        }
        if (reportSections.pdmDetailsSection) {
            reportSections.pdmDetailsSection.appendChild(pdmFragment);
        } else {
        }

        qcReportState.isReportGenerated = true;
        return true;
    } finally {
        setReportGenerationInProgress(false);
    }
}

/**
 * Button click handler that triggers processQCReport and shows a success alert.
 */
export async function generateQCReport() {
    if (qcReportState.isGeneratingReport) {
        return false;
    }

    const generateBtn = document.querySelector('.generate-qc-btn');
    const clearBtn = document.querySelector('.clear-qc-btn');
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.classList.add('loading');
        generateBtn.setAttribute('aria-busy', 'true');
    }
    if (clearBtn) {
        clearBtn.disabled = true;
        clearBtn.setAttribute('aria-busy', 'true');
    }

    try {
        if (await processQCReport()) {
            showAlert('success', 'QC Report has been generated successfully.');
            document.dispatchEvent(new CustomEvent('reportGenerated'));
            return true;
        }
        return false;
    } finally {
        if (generateBtn) {
            generateBtn.disabled = false;
            generateBtn.classList.remove('loading');
            generateBtn.removeAttribute('aria-busy');
        }
        if (clearBtn) {
            clearBtn.disabled = false;
            clearBtn.removeAttribute('aria-busy');
        }
    }
}

/**
 * Clears all populated report tables and resets the generation state.
 */
export function clearQCReport() {
    if (!reportSections.unsupportedSection || !reportSections.pdmDetailsSection || !reportSections.primaryValidationSection || !reportSections.deletedSection) {
        showAlert('error', 'One or more report sections not found. Please refresh the page.');
        return false;
    }

    if (qcReportState.isGeneratingReport) {
        showAlert('warning', 'Please wait for QC report generation to finish before deleting.');
        return false;
    }

    const hasExistingReport = qcReportState.isReportGenerated
        || reportSections.unsupportedSection.childElementCount > 0
        || reportSections.pdmDetailsSection.childElementCount > 0
        || reportSections.primaryValidationSection.childElementCount > 0
        || reportSections.deletedSection.childElementCount > 0
        || Boolean(document.getElementById('qcReportSummarySection'));

    if (hasExistingReport && !window.confirm('Delete the current QC report? This action cannot be undone.')) {
        return false;
    }

    removeSummaryEventListeners();
    reportSections.unsupportedSection.innerHTML = '';
    reportSections.pdmDetailsSection.innerHTML = '';
    reportSections.primaryValidationSection.innerHTML = '';
    reportSections.deletedSection.innerHTML = '';
    const summarySection = document.getElementById('qcReportSummarySection');
    if (summarySection) summarySection.remove();
    qcReportState.isReportGenerated = false;
    setReportGenerationInProgress(false);

    // Clear persisted report from localStorage
    localStorage.removeItem('qcReportData');

    showAlert('success', 'QC Report cleared successfully!');
    document.dispatchEvent(new CustomEvent('reportCleared'));
    return true;
}


// Event listener bindings and teardown.

/**
 * Removes all bound click listeners from dynamic summary buttons.
 */
export function removeEventListeners() {
    removeTrackedEventListeners(eventListeners);
    removeSummaryEventListeners();
}

/**
 * Entry point — wires up generate/clear buttons and shows initial empty state.
 */
export async function initializeQCReport() {
    removeEventListeners();

    // Initialize DOM section references
    initReportSections();

    const generateBtn = document.querySelector('.generate-qc-btn');
    const clearBtn = document.querySelector('.clear-qc-btn');


    if (!generateBtn || !clearBtn) {
        showAlert('error', 'Report buttons not found. Please refresh the page.');
        return;
    }

    const generateListener = async () => {
        await generateQCReport();
    };
    const clearListener = () => {
        const cleared = clearQCReport();
        // Show empty state after clearing
        if (cleared) {
            showQCReportEmptyState();
        }
    };

    addTrackedEventListener(eventListeners, generateBtn, 'click', generateListener);
    addTrackedEventListener(eventListeners, clearBtn, 'click', clearListener);

    // Initialize experimental AI validation (event-driven)
    initializeAiValidation();

    // Restore report from localStorage if available, otherwise show empty state
    const savedReport = localStorage.getItem('qcReportData');
    if (savedReport) {
        try {
            const reportResponse = JSON.parse(savedReport);
            await restoreQCReport(reportResponse);
        } catch (e) {
            localStorage.removeItem('qcReportData');
            showQCReportEmptyState();
        }
    } else {
        showQCReportEmptyState();
    }

}

