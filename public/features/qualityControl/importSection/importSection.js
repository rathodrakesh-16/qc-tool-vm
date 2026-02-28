
import { showAlert, hideAlert } from '../../../components/notification.js';
import {
    qcReportState,
    setClassificationGenerated,
    setClassificationGenerationInProgress
} from '../qcReport/qcReportState.js';
import { authManager } from '../../../core/auth/AuthManager.js';

export const tableCache = {
    dataTable: null,
    dataTablePDM: null,
    classificationDetailsTable: null,
    pulldataBackupTable: null,
    pulldataBackupTablePDM: null
};

const CLASSIFICATION_DETAILS_STORAGE_KEY = 'classificationDetailsTableData';
const IMPORT_TABLE_HEADERS = Object.freeze({
    dataTable: ['Classification', 'Classification ID', 'Definition', 'Category', 'Family', 'Rank Points', 'Company Type', 'Profile Description', 'Site Link', 'Quality', 'Last Updated'],
    dataTablePDM: ['pdmId', 'Summary', 'Description', 'Classifications', 'Last Updated'],
    pulldataBackupTable: ['Classification', 'Classification ID', 'Definition', 'Category', 'Family', 'Rank Points', 'Company Type', 'Profile Description', 'Site Link', 'Quality', 'Last Updated']
});
const CLASSIFICATION_TABLE_HEADERS = Object.freeze([
    'Classification ID',
    'Classification',
    'Category',
    'Family',
    'Rank Points',
    'Company Type',
    'Site Link',
    'Quality',
    'Profile Description',
    'PDM TEXT',
    'Heading Type'
]);
const importOperationVersions = Object.create(null);
let savedDataTabsClickHandler = null;

export const pasteListeners = {};

export const tableConfigs = {
    dataTable: ['classification', 'classificationId', 'definition', 'category', 'family', 'rankPoints', 'companyType', 'profileDescription', 'siteLink', 'quality', 'lastUpdated'],
    dataTablePDM: ['id', 'summary', 'description', 'classifications', 'lastUpdated'],
    classificationDetailsTable: ['classificationId', 'classification', 'category', 'family', 'rankPoints', 'companyType', 'siteLink', 'quality', 'profileDescription', 'pdmText', 'headingType'],
    toolTable: ['input', 'output'],
    pulldataBackupTable: ['classification', 'classificationId', 'definition', 'category', 'family', 'rankPoints', 'companyType', 'profileDescription', 'siteLink', 'quality', 'lastUpdated'],
    pulldataBackupTablePDM: ['id', 'summary', 'description', 'classifications', 'lastUpdated']
};

export const tableConfig = [
    {
        tableId: 'dataTable',
        label: 'Afterproof Classification Data',
        containerId: 'classificationTableContainer',
        inputId: 'afterproofClassificationImport'
    },
    {
        tableId: 'dataTablePDM',
        label: 'Afterproof PDM Data',
        containerId: 'pdmTableContainer',
        inputId: 'afterproofPDMImport'
    },
    {
        tableId: 'pulldataBackupTable',
        label: 'Beforeproof Classification Data',
        containerId: 'classificationTableContainerBackup',
        inputId: 'backupScraperImport'
    }
];

// Small pure/stateless helpers used across the module.

/**
 * Returns the default label text shown on an upload slot
 * before any file has been selected (keyed by input element ID).
 */
export function getDefaultLabel(inputId) {
    const defaultLabels = {
        'afterproofClassificationImport': 'Import Afterproof Classifications',
        'afterproofPDMImport': 'Import Afterproof PDMs',
        'backupScraperImport': 'Import Beforeproof Data',
        'qcToolDataImport': 'Import QC Tool Data'
    };
    return defaultLabels[inputId] || 'Choose file';
}

/**
 * Returns the Font Awesome icon class for an upload slot.
 * Currently returns the same icon for all inputs.
 */

export function getDefaultIcon(inputId) {
    // Return the same icon for all inputs as requested
    return 'fas fa-file-invoice';
}

/**
 * Shows the full-page loader overlay.
 */

export function showLoader() {
    const loaderContainer = document.getElementById('loaderContainer');
    if (loaderContainer) {
        loaderContainer.style.display = 'flex';
    }
}

/**
 * Hides the full-page loader overlay.
 */
export function hideLoader() {
    const loaderContainer = document.getElementById('loaderContainer');
    if (loaderContainer) {
        loaderContainer.style.display = 'none';
    }
}


// Creating, populating, caching, restoring and clearing tables.

/**
 * Bootstraps all table references in tableCache, clears stale DOM rows,
 * and restores any previously saved data from localStorage.
 * Called once on app startup after templates are loaded.
 */
export function initializeTable() {
    tableCache.dataTable = document.getElementById('dataTable');
    tableCache.dataTablePDM = document.getElementById('dataTablePDM');
    tableCache.classificationDetailsTable = document.getElementById('classificationDetailsTable');
    tableCache.toolTable = document.getElementById('toolTable');
    tableCache.pulldataBackupTable = document.getElementById('pulldataBackupTable');
    tableCache.pulldataBackupTablePDM = document.getElementById('pulldataBackupTablePDM');

    const tableIds = ['dataTable', 'dataTablePDM', 'classificationDetailsTable', 'pulldataBackupTable', 'pulldataBackupTablePDM', 'toolTable'];
    tableIds.forEach(tableId => {
        if (tableCache[tableId]) {
            const tbody = tableCache[tableId].getElementsByTagName('tbody')[0];
            if (tbody) {
                tbody.innerHTML = '';
            }
        }
    });

    // Load cached data from localStorage
    try {

        const dataTableData = localStorage.getItem('dataTableData');
        if (dataTableData) {
            tableCache.dataTableData = JSON.parse(dataTableData);
        }

        const dataTablePDMData = localStorage.getItem('dataTablePDMData');
        if (dataTablePDMData) {
            tableCache.dataTablePDMData = JSON.parse(dataTablePDMData);
        }

        const pulldataBackupTableData = localStorage.getItem('pulldataBackupTableData');
        if (pulldataBackupTableData) {
            tableCache.pulldataBackupTableData = JSON.parse(pulldataBackupTableData);
        }

        const classificationDetailsTableData = localStorage.getItem(CLASSIFICATION_DETAILS_STORAGE_KEY);
        if (classificationDetailsTableData) {
            tableCache.classificationDetailsTableData = JSON.parse(classificationDetailsTableData);
        }

        // Regenerate the saved data section if any data exists
        if (tableCache.dataTableData || tableCache.dataTablePDMData || tableCache.pulldataBackupTableData) {
            generateImportedDataSection();
        }

        restoreClassificationDetailsTableData();
    } catch (error) {
    }
}

/**
 * Appends empty rows to a table's <tbody>.
 * Used when initializing blank sheets and when expanding for deleted headings.
 */
function addRow(tableId, numRows) {
    const table = tableCache[tableId];
    if (!table) {
        return;
    }

    const tbody = table.getElementsByTagName('tbody')[0];
    const numColumns = table.querySelector('thead tr')?.cells.length || 0;

    for (let i = 0; i < numRows; i++) {
        const row = tbody.insertRow();
        for (let j = 0; j < numColumns; j++) {
            const cell = row.insertCell();
            cell.textContent = '';
        }
    }
}

/**
 * Clears and reinitializes a table with a fresh set of empty rows.
 * Also removes any paste event listeners attached to the table.
 */
export function clearTableSheet(tableId, rowCount = 20) {
    const table = tableCache[tableId];
    if (!table) {
        showAlert('error', `Table ${tableId} not found. Cannot clear sheet.`);
        return;
    }
    const tbody = table.getElementsByTagName('tbody')[0];
    const originalClasses = tbody.className;

    if (pasteListeners[tableId]) {
        table.removeEventListener('paste', pasteListeners[tableId]);
        delete pasteListeners[tableId];
    }

    tbody.innerHTML = '';
    tbody.className = originalClasses;

    if (tableId !== 'toolTable') {
        addRow(tableId, rowCount);
    }

    showAlert('success', `Table has been cleared and reinitialized with ${rowCount} rows.`);
}

/**
 * Resets a scraper sheet (dataTable, dataTablePDM, or pulldataBackupTable):
 * clears DOM, removes cached data, deletes localStorage entry, and
 * regenerates the Imported Data section.
 */
export function clearScraperSheet(tableId) {
    const config = tableConfig.find(c => c.tableId === tableId);
    if (!config) return;

    const table = document.getElementById(tableId);
    if (table) {
        table.innerHTML = '<thead></thead><tbody></tbody>';

        const inputId = config.inputId;
        const input = document.getElementById(inputId);
        if (input) {
            input.value = '';
            updateFileName(input);
        }

        delete tableCache[`${tableId}Data`];
        delete tableCache[tableId];

        // Also remove from localStorage
        localStorage.removeItem(`${tableId}Data`);
        setClassificationGenerated(false);

        // Regenerate the Imported Data section
        generateImportedDataSection();
    }
}

/**
 * Sets up the Classification Details table header row with
 * the 11 expected column names and caches the table reference.
 */
export function initClassificationTable() {
    const table = document.getElementById('classificationDetailsTable');
    if (!table) {
        return;
    }

    const thead = table.getElementsByTagName('thead')[0];
    thead.innerHTML = `
        <tr>
            ${CLASSIFICATION_TABLE_HEADERS.map(header => `<th>${header}</th>`).join('')}
        </tr>
    `;

    tableCache.classificationDetailsTable = table;
}

/**
 * Reads the current Classification Details table rows from the DOM,
 * stores them in tableCache and persists to localStorage.
 * Returns the number of (non-empty) rows cached.
 */
export function cacheClassificationDetailsTableData() {
    const table = tableCache.classificationDetailsTable || document.getElementById('classificationDetailsTable');
    if (!table) return 0;

    const tbody = table.getElementsByTagName('tbody')[0];
    if (!tbody) return 0;

    const rowsData = Array.from(tbody.rows)
        .map(row => Array.from(row.cells).map(cell => cell.textContent || ''))
        .filter(rowData => rowData.some(value => value && value.trim() !== ''));

    tableCache.classificationDetailsTableData = rowsData;

    if (rowsData.length > 0) {
        localStorage.setItem(CLASSIFICATION_DETAILS_STORAGE_KEY, JSON.stringify(rowsData));
    } else {
        localStorage.removeItem(CLASSIFICATION_DETAILS_STORAGE_KEY);
    }

    return rowsData.length;
}

/**
 * Restores Classification Details table rows from tableCache or localStorage
 * back into the DOM, re-adds tooltips, and marks the table as generated.
 */
export function restoreClassificationDetailsTableData() {
    const table = tableCache.classificationDetailsTable || document.getElementById('classificationDetailsTable');
    if (!table) return;

    const tbody = table.getElementsByTagName('tbody')[0];
    if (!tbody) return;

    let data = tableCache.classificationDetailsTableData;
    if (!Array.isArray(data) || data.length === 0) {
        const stored = localStorage.getItem(CLASSIFICATION_DETAILS_STORAGE_KEY);
        if (!stored) return;

        try {
            data = JSON.parse(stored);
            tableCache.classificationDetailsTableData = data;
        } catch (error) {
            return;
        }
    }

    if (!Array.isArray(data) || data.length === 0) return;

    tbody.innerHTML = '';
    data.forEach(rowData => {
        const row = tbody.insertRow();
        const columnCount = Math.max(11, rowData.length);
        for (let i = 0; i < columnCount; i++) {
            const cell = row.insertCell();
            cell.textContent = rowData[i] || '';
        }
    });

    addTooltipsToClassificationTable();
    setClassificationGenerated(true);
}

/**
 * Full reset: clears all tables, file inputs, localStorage entries,
 * and switches back to the Import tab. Triggered by the "Clear All" button.
 */
export function clearClassificationDetails() {
    const hasStoredRows = (storageKey) => {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return false;

        try {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
                return parsed.length > 0;
            }
            return Boolean(parsed);
        } catch (_error) {
            const normalized = raw.trim();
            return normalized !== '' && normalized !== '[]';
        }
    };

    const hasGeneratedData = Boolean(
        tableCache.classificationDetailsTableData?.length
        || tableCache.dataTableData?.length
        || tableCache.dataTablePDMData?.length
        || tableCache.pulldataBackupTableData?.length
        || hasStoredRows(CLASSIFICATION_DETAILS_STORAGE_KEY)
        || hasStoredRows('dataTableData')
        || hasStoredRows('dataTablePDMData')
        || hasStoredRows('pulldataBackupTableData')
    );

    if (hasGeneratedData && !window.confirm('Reset all imported and generated QC data? This action cannot be undone.')) {
        return false;
    }

    setClassificationGenerated(false);
    setClassificationGenerationInProgress(false);

    // 1. Clear Classification Details Table
    const table = document.getElementById('classificationDetailsTable');
    if (table) {
        table.querySelector('thead').innerHTML = '';
        table.querySelector('tbody').innerHTML = '';
        delete tableCache.classificationDetailsTableData;
        tableCache.classificationDetailsTable = table;
    }

    // 2. Clear All Scraper Sheets (formerly clearScraperData)
    const tablesToClear = ['dataTable', 'dataTablePDM', 'pulldataBackupTable'];
    tablesToClear.forEach(tableId => clearScraperSheet(tableId));

    // 3. Clear File Inputs and Reset UI
    const inputsToClear = [
        'afterproofClassificationImport',
        'afterproofPDMImport',
        'backupScraperImport',
        'qcToolDataImport'
    ];
    inputsToClear.forEach(inputId => clearFileInput(inputId));

    // 4. Clear Local Storage
    localStorage.removeItem('accountDetails');
    localStorage.removeItem('companyProfile');
    // Also clear imported data from localStorage
    localStorage.removeItem('dataTableData');
    localStorage.removeItem('dataTablePDMData');
    localStorage.removeItem('pulldataBackupTableData');
    localStorage.removeItem(CLASSIFICATION_DETAILS_STORAGE_KEY);

    // 5. Hide Saved Data Section
    const savedSection = document.getElementById('savedDataSection');
    if (savedSection) {
        savedSection.style.display = 'none';
    }

    showAlert('success', 'All data has been successfully cleared.');

    // Auto-switch back to Import Section
    switchImportSectionTab('importContent');
    return true;
}

// Reads uploaded Excel files, validates headers against expected schemas,maps columns, filters empty rows, and caches parsed data.

/**
 * Validates that all required account/profile fields are filled in.
 * Returns false and shows a warning alert listing missing fields if any are empty.
 */
export function validateAccountDetails() {
    const accountName = document.querySelector('input[name="accountName"]')?.value.trim() || '';
    const accountId = document.querySelector('input[name="accountId"]')?.value.trim() || '';
    const editorName = document.querySelector('input[name="editorName"]')?.value.trim() || '';
    const qcName = document.querySelector('input[name="qcName"]')?.value.trim() || '';
    const primaryCompanyType = document.querySelector('select[name="primaryCompanyType"]')?.value || '';
    const coproWritten = document.querySelector('input[name="coproWritten"]:checked')?.value || '';
    const description = document.querySelector('textarea[name="description"]')?.value.trim() || '';

    const missingFields = [];
    if (!accountName) missingFields.push('Account Name');
    if (!accountId) missingFields.push('Account ID');
    if (!editorName) missingFields.push('Editor Name');
    if (!qcName) missingFields.push('QC Name');
    if (!primaryCompanyType) missingFields.push('Primary Company Type');
    if (!coproWritten) missingFields.push('CoPro Written');
    if (coproWritten === 'yes' && !description) missingFields.push('Company Profile Description');

    if (missingFields.length > 0) {
        showAlert('warning',
            `Please fill in the following fields before uploading:\n${missingFields.join(', ')}`, 0);
        return false;
    }

    return true;
}

/**
 * Main import handler. Reads an Excel file from the given <input>,
 * finds the sheet whose headers match the target table schema,
 * filters and normalizes the data, caches it in tableCache + localStorage,
 * then regenerates the Imported Data section.
 *
 * Supported types: 'AfterproofClassification', 'AfterproofPDM', 'BeforeproofData'.
 */
export function importData(type, input) {
    if (type === 'QCToolData') {
        return;
    }

    // CRITICAL FIX: Reload all data from localStorage at the start
    // This ensures we always have the latest data even if tableCache was cleared
    try {
        const dataTableData = localStorage.getItem('dataTableData');
        if (dataTableData && !tableCache.dataTableData) {
            tableCache.dataTableData = JSON.parse(dataTableData);
        }

        const dataTablePDMData = localStorage.getItem('dataTablePDMData');
        if (dataTablePDMData && !tableCache.dataTablePDMData) {
            tableCache.dataTablePDMData = JSON.parse(dataTablePDMData);
        }

        const pulldataBackupTableData = localStorage.getItem('pulldataBackupTableData');
        if (pulldataBackupTableData && !tableCache.pulldataBackupTableData) {
            tableCache.pulldataBackupTableData = JSON.parse(pulldataBackupTableData);
        }
    } catch (error) {
    }

    const currentOperationVersion = (importOperationVersions[type] || 0) + 1;
    importOperationVersions[type] = currentOperationVersion;

    const file = input.files[0];
    if (!file) {
        if (type === 'AfterproofClassification') {
            clearScraperSheet('dataTable');
        } else if (type === 'AfterproofPDM') {
            clearScraperSheet('dataTablePDM');
        } else if (type === 'BeforeproofData') {
            clearScraperSheet('pulldataBackupTable');
        }
        return;
    }

    // Account details validation removed

    const reader = new FileReader();
    reader.onload = function (e) {
        if (importOperationVersions[type] !== currentOperationVersion) {
            return;
        }

        const data = e.target.result;
        const workbook = XLSX.read(data, { type: 'binary' });

        const processSheet = (tableId) => {
            const expectedHeaders = IMPORT_TABLE_HEADERS[tableId];

            if (!expectedHeaders) {
                return false;
            }

            const normalizeHeader = (header) => String(header).toLowerCase().replace(/\s+/g, '');
            const normalizedRequiredHeaders = expectedHeaders.map(normalizeHeader);

            let matchingSheetName = null;
            let matchingJsonData = null;

            // Iterate through all sheets to find a match
            for (const sheetName of workbook.SheetNames) {
                const sheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });

                if (jsonData.length === 0) continue;

                const fileHeaders = jsonData[0].map(header => String(header).trim());
                const normalizedFileHeaders = fileHeaders.map(normalizeHeader);

                // Check if all required headers are present in this sheet
                const missingHeaders = normalizedRequiredHeaders.filter(header => !normalizedFileHeaders.includes(header));

                if (missingHeaders.length === 0) {
                    matchingSheetName = sheetName;
                    matchingJsonData = jsonData;
                    break; // Found a match, stop searching
                }
            }

            if (!matchingSheetName || !matchingJsonData) {
                showAlert('error', `No sheet found with compatible headers. Expected: ${expectedHeaders.join(', ')}.`);
                // Reset file input and update UI to default state
                input.value = '';
                updateFileName(input);
                return false;
            }


            const fileHeaders = matchingJsonData[0].map(header => String(header).trim());
            const normalizedFileHeaders = fileHeaders.map(normalizeHeader);

            const headerIndices = expectedHeaders.map(header => {
                const normalized = normalizeHeader(header);
                return normalizedFileHeaders.indexOf(normalized);
            });

            const filteredData = [];
            for (let i = 1; i < matchingJsonData.length; i++) {
                const fileRow = matchingJsonData[i];
                if (!fileRow || fileRow.every(cell => cell == null || String(cell).trim() === '')) {
                    continue;
                }

                const filteredRow = [];
                let hasData = false;

                expectedHeaders.forEach((header, index) => {
                    const cellValue = fileRow[headerIndices[index]];
                    let normalizedValue = cellValue == null ? '' : String(cellValue).trim();
                    if (normalizedValue === '-' || normalizedValue === '') {
                        normalizedValue = '';
                    }
                    filteredRow.push(normalizedValue);
                    if (normalizedValue !== '') {
                        hasData = true;
                    }
                });

                if (hasData) {
                    filteredData.push(filteredRow);
                }
            }
            tableCache[`${tableId}Data`] = filteredData;

            // Persist data to localStorage
            try {
                localStorage.setItem(`${tableId}Data`, JSON.stringify(filteredData));
            } catch (error) {
            }
            return true;
        };

        let processed = false;
        if (type === 'AfterproofClassification') {
            processed = processSheet('dataTable');
        } else if (type === 'AfterproofPDM') {
            processed = processSheet('dataTablePDM');
        } else if (type === 'BeforeproofData') {
            processed = processSheet('pulldataBackupTable');
            if (processed) {
                delete tableCache.pulldataBackupTablePDM;
            }
        }

        if (!processed) {
            return;
        }

        setClassificationGenerated(false);
        updateFileName(input);
        generateImportedDataSection();

        tableConfig.forEach(config => {
            const tableElement = document.getElementById(config.tableId);
            if (tableElement) {
                tableCache[config.tableId] = tableElement;
            } else {
            }
        });
    };

    reader.onerror = function () {
        if (importOperationVersions[type] !== currentOperationVersion) {
            return;
        }
        showAlert('error', 'Failed to read file. Please try again.');
        // Reset file input and update UI to default state
        input.value = '';
        updateFileName(input);
    };

    reader.readAsBinaryString(file);
}


/**
 * Entry point for the "Generate Details" button.
 * Validates that Afterproof data exists, calls backend classification API,
 * adds tooltips, shows a success alert, and switches to the Classification tab.
 */
export async function generateDetails() {
    if (qcReportState.isGeneratingClassification) {
        showAlert('warning', 'Classification generation is already in progress.');
        return false;
    }

    setClassificationGenerationInProgress(true);
    setClassificationGenerated(false);

    if (!tableCache.dataTableData || tableCache.dataTableData.length === 0) {
        showAlert('error', 'Afterproof Classification data is empty. Please import the data before proceeding.');
        setClassificationGenerationInProgress(false);
        return false;
    }

    const syncBtn = document.querySelector('.sync-btn');
    setSyncButtonLoadingState(syncBtn, true);

    try {
        initClassificationTable();
        const table = tableCache.classificationDetailsTable || document.getElementById('classificationDetailsTable');
        const tbody = table?.getElementsByTagName('tbody')[0];
        if (!table || !tbody) {
            showAlert('error', 'Classification Details table not found.');
            return false;
        }

        const payload = {
            dataTableData: tableCache.dataTableData || [],
            dataTablePDMData: tableCache.dataTablePDMData || [],
            pulldataBackupTableData: tableCache.pulldataBackupTableData || []
        };

        const response = await authManager.generateClassifications(payload);
        const rows = Array.isArray(response?.classificationDetails) ? response.classificationDetails : [];

        tbody.innerHTML = '';
        rows.forEach(rowData => {
            const row = tbody.insertRow();
            for (let i = 0; i < 11; i++) {
                const cell = row.insertCell();
                cell.textContent = rowData?.[i] || '';
            }
        });

        tableCache.classificationDetailsTableData = rows;
        if (rows.length > 0) {
            localStorage.setItem(CLASSIFICATION_DETAILS_STORAGE_KEY, JSON.stringify(rows));
        } else {
            localStorage.removeItem(CLASSIFICATION_DETAILS_STORAGE_KEY);
        }

        addTooltipsToClassificationTable();
        setClassificationGenerated(rows.length > 0);

        if (rows.length === 0) {
            showAlert('error', 'No classification details were returned.');
            return false;
        }

        showAlert('success', 'Classification details have been generated successfully.');
        switchImportSectionTab('classificationDetailsContent');
        return true;
    } catch (error) {
        showAlert('error', error?.message || 'Failed to generate classification details.');
        return false;
    } finally {
        setClassificationGenerationInProgress(false);
        setSyncButtonLoadingState(syncBtn, false);
    }
}

function setSyncButtonLoadingState(syncBtn, isLoading) {
    if (!syncBtn) return;

    if (!syncBtn.dataset.defaultHtml) {
        syncBtn.dataset.defaultHtml = syncBtn.innerHTML;
    }

    if (isLoading) {
        syncBtn.classList.add('loading');
        syncBtn.disabled = true;
        syncBtn.setAttribute('aria-busy', 'true');
        syncBtn.innerHTML = '<i class="fas fa-circle-notch"></i> Generating...';
        return;
    }

    syncBtn.classList.remove('loading');
    syncBtn.disabled = false;
    syncBtn.removeAttribute('aria-busy');
    syncBtn.innerHTML = syncBtn.dataset.defaultHtml;
}


// Managing file upload labels, tab switching, data section rendering,tooltips, and toggle visibility.


/**
 * Updates the visual state of a file upload label to reflect:
 *  - No file: shows default icon, label text, and "Click or drag file here"
 *  - File selected: plays checkmark animation, then shows file name + size
 * Rebuilds the label DOM if required child elements are missing.
 */
export function updateFileName(input) {
    const label = input.nextElementSibling;
    if (!label) return;

    // Retrieve components after the label DOM structure is ensured
    const textSpan = label.querySelector('.upload-text');
    const subtextSpan = label.querySelector('.upload-subtext');
    const iconElement = label.querySelector('.upload-icon');
    const deleteContainer = label.querySelector('.delete-file-container');

    // This block handles the necessary DOM cleanup/restoration after the old faulty listener
    if (!textSpan || !subtextSpan || !iconElement || !deleteContainer) {
        const defaultText = getDefaultLabel(input.id);
        const defaultIcon = getDefaultIcon(input.id);

        // The HTML structure MUST be correct here, including the new delete-file-container
        label.innerHTML = `
            <i class="${defaultIcon} upload-icon"></i>
            <div class="upload-animation-container"></div>
            <div class="upload-text-container">
                <span class="upload-text">${defaultText}</span>
                <span class="upload-subtext">Click or drag file here</span>
            </div>
            <div class="delete-file-container" data-input-id="${input.id}">
                <i class="fas fa-times delete-file-icon" title="Clear File"></i>
            </div>
        `;
        // Re-run updateFileName to use the newly created elements
        return updateFileName(input);
    }


    const animationContainer = label.querySelector('.upload-animation-container');

    if (input.files && input.files[0]) {
        // Check if we are already in the "has-file" state to avoid re-triggering animation on redundant calls
        if (label.classList.contains('has-file')) {
            const fileName = input.files[0].name;
            const fileSize = (input.files[0].size / 1024).toFixed(2); // Size in KB
            textSpan.textContent = fileName;
            subtextSpan.textContent = `${fileSize} KB`;
            return;
        }

        // --- ANIMATION START ---
        // 1. Prepare Animation HTML
        if (animationContainer) {
            animationContainer.innerHTML = `
                <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
                    <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
                    <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
                </svg>
            `;
        }

        // 2. Start Animation State
        label.classList.add('animating');

        // 3. Wait for animation to finish (2s)
        setTimeout(() => {
            label.classList.remove('animating');
            label.classList.add('has-file');

            const fileName = input.files[0].name;
            const fileSize = (input.files[0].size / 1024).toFixed(2); // Size in KB

            // Update icon to file excel
            iconElement.className = 'fas fa-file-excel upload-icon';

            // Update text
            textSpan.textContent = fileName;
            subtextSpan.textContent = `${fileSize} KB`;
        }, 2000); // 2 seconds delay


    } else {
        // Reset to default state (NO FILE state)
        const defaultText = getDefaultLabel(input.id);
        const defaultIcon = getDefaultIcon(input.id);

        label.classList.remove('has-file');
        label.classList.remove('animating'); // Ensure animation state is cleared

        // Reset icon
        iconElement.className = `${defaultIcon} upload-icon`;

        // Reset text
        textSpan.textContent = defaultText;
        subtextSpan.textContent = 'Click or drag file here';
    }
}

/**
 * Clears a specific file input by ID, removes its cached data,
 * resets the upload label, and regenerates the Imported Data section.
 */
export function clearFileInput(inputId) {
    if (['afterproofClassificationImport', 'afterproofPDMImport', 'backupScraperImport'].includes(inputId)) {
        setClassificationGenerated(false);
    }
    const input = document.getElementById(inputId);
    if (!input) return;

    // Reset file input value
    input.value = '';

    // Determine the associated table IDs to clear cached data
    let tableIdsToClear = [];
    if (inputId === 'afterproofClassificationImport') {
        tableIdsToClear = ['dataTable'];
    } else if (inputId === 'afterproofPDMImport') {
        tableIdsToClear = ['dataTablePDM'];
    } else if (inputId === 'backupScraperImport') {
        tableIdsToClear = ['pulldataBackupTable'];
    }

    // Clear associated data from cache and regenerate UI
    tableIdsToClear.forEach(tableId => {
        delete tableCache[`${tableId}Data`];
        delete tableCache[tableId];
    });

    // Reset the visual label
    updateFileName(input);

    // Regenerate the Imported Data section to reflect cleared data
    generateImportedDataSection();

    showAlert('success', 'File deleted. Import new file.');
}

/**
 * Dynamically builds the "Imported Data" tabs + tables section
 * from the data stored in tableCache. Shows/hides the section
 * based on whether any data exists.
 */
export function generateImportedDataSection() {
    const tabsContainer = document.getElementById('savedDataTabs');
    const contentContainer = document.getElementById('savedDataContent');
    const savedSection = document.getElementById('savedDataSection');

    if (!tabsContainer || !contentContainer || !savedSection) {
        return;
    }

    ensureSavedDataTabsClickHandler(tabsContainer);

    // Clear existing content
    tabsContainer.innerHTML = '';
    contentContainer.innerHTML = '';

    let hasData = false;
    let firstTabWithData = true; // Track if this is the first tab with actual data

    // Generate tabs and containers for tables with data
    tableConfig.forEach((config, index) => {
        const hasTableData = tableCache[`${config.tableId}Data`] && tableCache[`${config.tableId}Data`].length > 0;

        if (hasTableData) {
            hasData = true;

            // Create tab button
            const tabBtn = document.createElement('button');
            tabBtn.className = `tab-btn${firstTabWithData ? ' active' : ''}`;
            const rowCount = tableCache[`${config.tableId}Data`].length;
            tabBtn.textContent = `${config.label} (${rowCount} Rows)`;
            tabBtn.dataset.targetContainerId = config.containerId;
            tabsContainer.appendChild(tabBtn);

            // Create table container
            const tableContainer = document.createElement('div');
            tableContainer.className = 'saved-data-table has-data';
            tableContainer.id = config.containerId;
            tableContainer.style.display = firstTabWithData ? 'block' : 'none';

            firstTabWithData = false; // After the first tab, set this to false

            const tableWrapper = document.createElement('div');
            tableWrapper.className = 'table-wrapper';

            const table = document.createElement('table');
            table.id = config.tableId;

            tableWrapper.appendChild(table);
            tableContainer.appendChild(tableWrapper);
            contentContainer.appendChild(tableContainer);

            // Populate table with cached data
            const thead = document.createElement('thead');
            const tbody = document.createElement('tbody');
            table.appendChild(thead);
            table.appendChild(tbody);

            const expectedHeaders = IMPORT_TABLE_HEADERS[config.tableId] || [];

            const headerRow = document.createElement('tr');
            expectedHeaders.forEach(header => {
                const th = document.createElement('th');
                th.textContent = header;
                th.setAttribute('title', header); // Add tooltip to headers too
                headerRow.appendChild(th);
            });
            thead.appendChild(headerRow);

            const data = tableCache[`${config.tableId}Data`];
            data.forEach(rowData => {
                const row = document.createElement('tr');
                rowData.forEach(cellData => {
                    const td = document.createElement('td');
                    const cellText = cellData || '';
                    td.textContent = cellText;
                    // Add title attribute for tooltip
                    if (cellText) {
                        td.setAttribute('title', cellText);
                    }
                    row.appendChild(td);
                });
                tbody.appendChild(row);
            });
        }
    });

    // Show or hide the entire section based on whether there is data
    savedSection.style.display = hasData ? 'block' : 'none';

    // ADD THIS LINE: Add tooltips after tables are created
    if (hasData) {
        addTooltipsToSavedDataTables();
    }
}

function ensureSavedDataTabsClickHandler(tabsContainer) {
    if (!tabsContainer) return;

    if (savedDataTabsClickHandler) {
        tabsContainer.removeEventListener('click', savedDataTabsClickHandler);
    }

    savedDataTabsClickHandler = (event) => {
        const tabBtn = event.target.closest('.tab-btn[data-target-container-id]');
        if (!tabBtn || !tabsContainer.contains(tabBtn)) {
            return;
        }
        showDataTab(tabBtn.dataset.targetContainerId);
    };

    tabsContainer.addEventListener('click', savedDataTabsClickHandler);
}

/**
 * Activates a specific saved-data tab and hides the others.
 */
export function showDataTab(containerId) {
    tableConfig.forEach(config => {
        const container = document.getElementById(config.containerId);
        const tabBtn = document.querySelector(`.tab-btn[data-target-container-id="${config.containerId}"]`);
        if (container && tabBtn) {
            if (config.containerId === containerId && container.classList.contains('has-data')) {
                container.style.display = 'block';
                tabBtn.classList.add('active');
            } else {
                container.style.display = 'none';
                tabBtn.classList.remove('active');
            }
        }
    });
}

/**
 * Switches between the Import tab and Classification Details tab
 * within the Import Section header navigation.
 */
export function switchImportSectionTab(containerId) {
    const importContent = document.getElementById('importContent');
    const classificationContent = document.getElementById('classificationDetailsContent');
    const importTab = document.getElementById('importSectionTab');
    const classificationTab = document.getElementById('classificationDetailsTab');

    if (containerId === 'importContent') {
        importContent.style.display = 'block';
        classificationContent.style.display = 'none';

        importTab.classList.add('active-header');
        importTab.classList.remove('inactive-header');
        classificationTab.classList.add('inactive-header');
        classificationTab.classList.remove('active-header');
    } else {
        importContent.style.display = 'none';
        classificationContent.style.display = 'block';

        classificationTab.classList.add('active-header');
        classificationTab.classList.remove('inactive-header');
        importTab.classList.add('inactive-header');
        importTab.classList.remove('active-header');
    }
}

/**
 * Toggles the visibility of a nested button container
 * (expand/collapse with icon rotation).
 */
export function toggleNestedButtons(containerId) {
    const container = document.getElementById(containerId);
    if (!container) {
        return;
    }

    const toggleButton = container.previousElementSibling;
    const toggleIcon = toggleButton ? toggleButton.querySelector('.toggle-icon') : null;

    if (container.classList.contains('visible')) {
        // Collapse
        container.classList.remove('visible');
        container.classList.add('hidden');
        container.style.display = 'none';
        if (toggleIcon) {
            toggleIcon.classList.add('collapsed');
        }
    } else {
        // Expand
        container.classList.remove('hidden');
        container.classList.add('visible');
        container.style.display = 'flex';
        if (toggleIcon) {
            toggleIcon.classList.remove('collapsed');
        }
    }
}

/**
 * Toggles table container visibility with max-height animation.
 */
export function toggleTable(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    const tableContainer = container.querySelector('.table-container');
    const toggleIcon = container.querySelector('.toggle-icon');

    if (tableContainer.style.maxHeight) {
        tableContainer.style.maxHeight = null;
        tableContainer.style.opacity = '1';
        toggleIcon.classList.remove('collapsed');
    } else {
        tableContainer.style.maxHeight = '0';
        tableContainer.style.opacity = '0';
        toggleIcon.classList.add('collapsed');
    }
}

/**
 * Smooth-scrolls to a target table section and swaps
 * the navigation arrow icons between the two containers.
 */
export function navigateToOtherTable(currentContainerId, targetContainerId) {
    const currentContainer = document.getElementById(currentContainerId);
    const targetContainer = document.getElementById(targetContainerId);

    if (currentContainer && targetContainer) {
        targetContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

        const currentNavIcon = currentContainer.querySelector('.nav-icon i');
        const targetNavIcon = targetContainer.querySelector('.nav-icon i');

        if (currentNavIcon && targetNavIcon) {
            if (currentContainerId.includes('Backup')) {
                currentNavIcon.classList.remove('fa-arrow-left');
                currentNavIcon.classList.add('fa-arrow-right');
            } else {
                currentNavIcon.classList.remove('fa-arrow-right');
                currentNavIcon.classList.add('fa-arrow-left');
            }

            if (targetContainerId.includes('Backup')) {
                targetNavIcon.classList.remove('fa-arrow-right');
                targetNavIcon.classList.add('fa-arrow-left');
            } else {
                targetNavIcon.classList.remove('fa-arrow-left');
                targetNavIcon.classList.add('fa-arrow-right');
            }
        }
    }
}

/**
 * Adds title attributes (native tooltips) to all cells
 * in the saved data tables for overflow text visibility.
 */
export function addTooltipsToSavedDataTables() {
    // Select all saved data tables
    const savedDataTables = document.querySelectorAll('.saved-data-table table tbody td');

    savedDataTables.forEach(cell => {
        const cellText = cell.textContent.trim();

        // Only add title if text is not empty
        if (cellText && cellText.length > 0) {
            cell.setAttribute('title', cellText);
        }
    });
}

/**
 * Adds title attributes (native tooltips) to all cells
 * in the Classification Details table.
 */
export function addTooltipsToClassificationTable() {
    const classificationCells = document.querySelectorAll('#classificationDetailsTable tbody td');

    classificationCells.forEach(cell => {
        const cellText = cell.textContent.trim();

        if (cellText && cellText.length > 0) {
            cell.setAttribute('title', cellText);
        }
    });
}


// Arrow-key, Tab, Enter navigation and Ctrl+C copy for editable tables.

/**
 * Attaches keyboard event handlers to an editable table:
 *  - Arrow keys: move focus between cells
 *  - Tab / Shift+Tab: horizontal navigation with row wrapping
 *  - Enter: move to next row
 *  - Ctrl+C: copy selected cell range to clipboard
 */
export function addKeyboardNavigation(tableId) {
    const table = tableCache[tableId];
    if (!table) return;

    let startCell = null;

    table.addEventListener('keydown', (event) => {
        const activeInput = document.activeElement;
        if (!activeInput || activeInput.tagName !== 'INPUT') return;

        const cell = activeInput.parentElement;
        const row = cell.parentElement;
        const tbody = table.getElementsByTagName('tbody')[0];
        const rows = tbody.rows;
        const rowIndex = Array.from(rows).indexOf(row);
        const cellIndex = Array.from(row.cells).indexOf(cell);

        const focusNextInput = (nextRowIndex, nextCellIndex) => {
            if (nextRowIndex >= 0 && nextRowIndex < rows.length && nextCellIndex >= 0 && nextCellIndex < row.cells.length) {
                const nextInput = rows[nextRowIndex].cells[nextCellIndex].querySelector('input');
                if (nextInput && !nextInput.readOnly) {
                    nextInput.focus();
                } else {
                    if (event.key === 'ArrowRight' || event.key === 'Tab') {
                        focusNextInput(nextRowIndex, nextCellIndex + 1);
                    } else if (event.key === 'ArrowLeft' || (event.key === 'Tab' && event.shiftKey)) {
                        focusNextInput(nextRowIndex, nextCellIndex - 1);
                    } else if (event.key === 'ArrowDown' || event.key === 'Enter') {
                        focusNextInput(nextRowIndex + 1, nextCellIndex);
                    } else if (event.key === 'ArrowUp') {
                        focusNextInput(nextRowIndex - 1, nextCellIndex);
                    }
                }
            }
        };

        switch (event.key) {
            case 'ArrowRight':
                focusNextInput(rowIndex, cellIndex + 1);
                event.preventDefault();
                break;
            case 'ArrowLeft':
                focusNextInput(rowIndex, cellIndex - 1);
                event.preventDefault();
                break;
            case 'ArrowDown':
                focusNextInput(rowIndex + 1, cellIndex);
                event.preventDefault();
                break;
            case 'ArrowUp':
                focusNextInput(rowIndex - 1, cellIndex);
                event.preventDefault();
                break;
            case 'Tab':
                if (event.shiftKey) {
                    if (cellIndex > 0) {
                        focusNextInput(rowIndex, cellIndex - 1);
                    } else if (rowIndex > 0) {
                        focusNextInput(rowIndex - 1, row.cells.length - 1);
                    }
                } else {
                    if (cellIndex < row.cells.length - 1) {
                        focusNextInput(rowIndex, cellIndex + 1);
                    } else if (rowIndex < rows.length - 1) {
                        focusNextInput(rowIndex + 1, 0);
                    }
                }
                event.preventDefault();
                break;
            case 'Enter':
                focusNextInput(rowIndex + 1, cellIndex);
                event.preventDefault();
                break;
            case 'c':
                if (event.ctrlKey || event.metaKey) {
                    if (startCell && activeInput) {
                        const range = getSelectionRange(startCell, activeInput);
                        copyToClipboard(range);
                        event.preventDefault();
                    }
                }
                break;
        }
    });

    table.addEventListener('mousedown', (event) => {
        startCell = event.target.closest('td')?.querySelector('input');
    });

    function getSelectionRange(startInput, endInput) {
        const startRow = startInput.parentElement.parentElement.rowIndex;
        const startCol = Array.from(startInput.parentElement.parentElement.cells).indexOf(startInput.parentElement);
        const endRow = endInput.parentElement.parentElement.rowIndex;
        const endCol = Array.from(endInput.parentElement.parentElement.cells).indexOf(endInput.parentElement);
        const rows = table.querySelectorAll('tbody tr');
        let text = '';
        for (let i = Math.min(startRow, endRow); i <= Math.max(startRow, endRow); i++) {
            const cells = rows[i].querySelectorAll('input');
            for (let j = Math.min(startCol, endCol); j <= Math.max(startCol, endCol); j++) {
                text += cells[j].value + '\t';
            }
            text = text.slice(0, -1) + '\n';
        }
        return text.trim();
    }

    function copyToClipboard(text) {
        navigator.clipboard.writeText(text);
    }
}

// Exporting table data to downloadable files.

/**
 * Exports the specified table's data as a CSV file download.
 */
export function exportToCSV(tableId) {
    try {
        const table = tableCache[tableId];
        if (!table) {
            throw new Error(`Table ${tableId} not found. Cannot export to CSV.`);
        }
        const rows = table.querySelectorAll('tbody tr');
        const csv = [];
        const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent);
        csv.push(headers.join(','));
        rows.forEach(row => {
            const rowData = [];
            if (tableId === 'accountDetailsTable') {
                row.querySelectorAll('input').forEach(input => rowData.push(input.value || ''));
            } else {
                row.querySelectorAll('td').forEach(td => rowData.push(td.textContent || ''));
            }
            csv.push(rowData.join(','));
        });
        const csvContent = 'data:text/csv;charset=utf-8,' + csv.join('\n');
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `${tableId}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        showAlert('error', error.message);
    }
}

// Entry point — wires up event listeners after DOM templates are loaded.

/**
 * Initializes the Import Section:
 *  - Attaches file input change listeners (scoped to #importSection)
 *  - Attaches delete-file icon click listeners
 *  - Sets up drag-and-drop on each upload label
 *  - Hides the Imported Data section by default
 *
 * Called from app.js after templates are loaded.
 */
export function initializeImportSection() {
    const importSection = document.getElementById('importSection');
    if (!importSection) return;

    ensureSavedDataTabsClickHandler(document.getElementById('savedDataTabs'));
    if (importSection.dataset.initialized === 'true') {
        return;
    }
    importSection.dataset.initialized = 'true';

    // Attach file input change listeners ONLY within the Import Section
    importSection.querySelectorAll('input[type="file"]').forEach(input => {
        input.addEventListener('change', function () {
            updateFileName(this);
        });
        // Initial call to ensure default state is set up correctly
        updateFileName(input);
    });

    // Attach click listener for delete icons ONLY within the Import Section
    importSection.querySelectorAll('.delete-file-container').forEach(container => {
        container.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            const inputId = this.getAttribute('data-input-id');
            clearFileInput(inputId);
        });
    });

    // Ensure the Imported Data section is hidden by default
    const savedSection = document.getElementById('savedDataSection');
    if (savedSection) {
        savedSection.style.display = 'none';
    }

    // Drag-and-drop support on each upload label
    const inputTypeMap = {
        'afterproofClassificationImport': 'AfterproofClassification',
        'afterproofPDMImport': 'AfterproofPDM',
        'backupScraperImport': 'BeforeproofData',
        'qcToolDataImport': 'QCToolData'
    };

    importSection.querySelectorAll('.upload-label').forEach(label => {
        const inputEl = label.previousElementSibling; // the hidden <input type="file">
        if (!inputEl || inputEl.type !== 'file') return;

        // Prevent default browser behavior for drag events
        ['dragenter', 'dragover'].forEach(eventName => {
            label.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                label.classList.add('drag-over');
            });
        });

        ['dragleave', 'drop'].forEach(eventName => {
            label.addEventListener(eventName, (e) => {
                e.preventDefault();
                e.stopPropagation();
                label.classList.remove('drag-over');
            });
        });

        label.addEventListener('drop', (e) => {
            const files = e.dataTransfer?.files;
            if (!files || files.length === 0) return;

            // Set the file on the input element via DataTransfer
            const dt = new DataTransfer();
            dt.items.add(files[0]);
            inputEl.files = dt.files;

            // Determine import type from input ID
            const importType = inputTypeMap[inputEl.id];
            if (importType) {
                importData(importType, inputEl);
            } else {
                updateFileName(inputEl);
            }
        });
    });

}
