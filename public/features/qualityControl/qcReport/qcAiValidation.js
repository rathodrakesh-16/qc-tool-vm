// qcAiValidation.js — Experimental Gemini AI PDM Description Validation
// Fully event-driven. Listens for 'reportGenerated' and 'reportCleared' events.
// Injects AI validation results into each PDM card's .inner-content.
// Supports enable/disable toggle persisted in localStorage.

import { authManager } from '../../../core/auth/AuthManager.js';
import { qcReportState } from './qcReportState.js';

const AI_SECTION_CLASS = 'ai-validation-section';
const AI_LOADING_CLASS = 'ai-loading-indicator';
const AI_WARNING_CLASS = 'ai-validation-warning';
const AI_NO_ISSUES_CLASS = 'ai-no-issues';
const STORAGE_KEY = 'aiValidationEnabled';

const MAX_POLLS = 360;           // 360 × 2.5s = 15 minutes max
const PENDING_TIMEOUT_POLLS = 24; // 24 × 2.5s = 60s before "worker offline" warning

// Tracks the currently active polling job. Any poll loop whose jobId does not
// match this value is stale and exits immediately (handles report-cleared / re-generate races).
let activeJobId = null;

/**
 * Check if AI validation is enabled (persisted preference).
 */
function isAiEnabled() {
    const stored = localStorage.getItem(STORAGE_KEY);
    // Default to disabled if not set — user must manually enable
    return stored === 'true';
}

/**
 * Set AI validation enabled state.
 */
function setAiEnabled(enabled) {
    localStorage.setItem(STORAGE_KEY, String(enabled));
}

/**
 * Remove all injected AI validation blocks from PDM cards.
 */
function clearAiValidation() {
    activeJobId = null; // cancel any active polling loop
    document.querySelectorAll(
        `.${AI_SECTION_CLASS}, .${AI_LOADING_CLASS}, .${AI_WARNING_CLASS}, .${AI_NO_ISSUES_CLASS}`
    ).forEach(el => el.remove());
}

/**
 * Show a loading indicator inside each PDM card that has a description.
 * @param {string[]} pdmNums
 */
function showLoadingIndicators(pdmNums) {
    pdmNums.forEach(pdmNum => {
        const card = document.getElementById(`pdm-section-${pdmNum}`);
        if (!card) return;
        const inner = card.querySelector('.inner-content');
        if (!inner) return;

        const loader = document.createElement('div');
        loader.className = AI_LOADING_CLASS;
        loader.innerHTML = `
            <div class="ai-spinner"></div>
            <span>AI reviewing description…</span>
        `;
        inner.appendChild(loader);
    });
}

/**
 * Render AI errors inside a specific PDM card.
 * @param {string} pdmNum
 * @param {string[]} errors
 */
function renderAiErrors(pdmNum, errors) {
    const card = document.getElementById(`pdm-section-${pdmNum}`);
    if (!card) return;
    const inner = card.querySelector('.inner-content');
    if (!inner) return;

    // Remove any existing AI or loading blocks for this card
    inner.querySelectorAll(`.${AI_SECTION_CLASS}, .${AI_LOADING_CLASS}, .${AI_WARNING_CLASS}, .${AI_NO_ISSUES_CLASS}`).forEach(el => el.remove());

    if (errors.length === 0) {
        const noIssues = document.createElement('div');
        noIssues.className = `${AI_NO_ISSUES_CLASS} ai-feedback-block`;
        noIssues.innerHTML = `<i class="fas fa-robot"></i> <span>AI Review — No issues found</span>`;
        inner.appendChild(noIssues);
        return;
    }

    const section = document.createElement('div');
    section.className = `${AI_SECTION_CLASS} ai-feedback-block`;

    const header = document.createElement('div');
    header.className = 'ai-header';
    header.innerHTML = `<i class="fas fa-robot"></i> AI Review <span class="ai-header-note">(AI can make mistakes, please review all suggestions carefully before applying them)</span>`;
    section.appendChild(header);

    const ol = document.createElement('ol');
    ol.className = 'ai-error-list';
    errors.forEach(err => {
        const li = document.createElement('li');

        const textString = typeof err === 'string' ? err : (err.text || 'Unknown issue');
        const contentDiv = document.createElement('div');

        const textSpan = document.createElement('span');
        textSpan.textContent = textString;
        contentDiv.appendChild(textSpan);

        li.appendChild(contentDiv);

        if (typeof err === 'object' && err.suggestions && err.suggestions.length > 0) {
            const suggestionsDiv = document.createElement('div');
            suggestionsDiv.className = 'ai-error-suggestions';
            suggestionsDiv.style.marginTop = '4px';
            suggestionsDiv.style.fontSize = '0.9em';

            const em = document.createElement('em');
            em.textContent = 'Suggestion: ';
            suggestionsDiv.appendChild(em);

            const textNode = document.createTextNode(err.suggestions.join(' | '));
            suggestionsDiv.appendChild(textNode);

            li.appendChild(suggestionsDiv);
        }

        ol.appendChild(li);
    });
    section.appendChild(ol);

    inner.appendChild(section);
}

/**
 * Remove loading indicators and show a warning in each PDM card.
 * @param {string[]} pdmNums
 * @param {string} message
 */
function showWarningInCards(pdmNums, message) {
    pdmNums.forEach(pdmNum => {
        const card = document.getElementById(`pdm-section-${pdmNum}`);
        if (!card) return;
        const inner = card.querySelector('.inner-content');
        if (!inner) return;

        inner.querySelectorAll(`.${AI_LOADING_CLASS}`).forEach(el => el.remove());

        const warning = document.createElement('div');
        warning.className = AI_WARNING_CLASS;
        warning.innerHTML = `<i class="fas fa-robot"></i> <span>${message}</span>`;
        inner.appendChild(warning);
    });
}

/**
 * Update toggle checkbox state from localStorage.
 */
function updateToggleState() {
    const checkbox = document.getElementById('aiToggleCheckbox');
    if (!checkbox) return;
    checkbox.checked = isAiEnabled();
    const label = document.querySelector('.ai-toggle-label');
    if (label) {
        label.textContent = checkbox.checked ? 'Disable AI Review' : 'Enable AI Review';
    }
}

/**
 * Main handler: triggered after report is generated.
 * Reads pdmGroups, calls backend async, polls for results.
 */
async function runAiValidation() {
    if (!isAiEnabled()) {
        clearAiValidation();
        return;
    }

    const pdmGroups = qcReportState.pdmGroups || {};
    const pdmDescriptions = {};

    for (const pdmNum in pdmGroups) {
        const text = pdmGroups[pdmNum]?.pdmText || '';
        if (text.trim() !== '') {
            pdmDescriptions[pdmNum] = text;
        }
    }

    const pdmNums = Object.keys(pdmDescriptions);
    if (pdmNums.length === 0) return;

    showLoadingIndicators(pdmNums);

    try {
        const response = await authManager.aiValidateStart({ pdmDescriptions });

        if (!response.enabled) {
            document.querySelectorAll(`.${AI_LOADING_CLASS}`).forEach(el => el.remove());
            return;
        }

        // Cache hit — render immediately, no polling needed
        if (response.cached) {
            document.querySelectorAll(`.${AI_LOADING_CLASS}`).forEach(el => el.remove());
            if (response.warning) {
                showWarningInCards(pdmNums, response.warning);
            } else {
                const errorsMap = {};
                (response.results || []).forEach(r => { errorsMap[r.pdmNum] = r.aiErrors || []; });
                pdmNums.forEach(p => renderAiErrors(p, errorsMap[p] || []));
            }
            return;
        }

        // Async path — poll until complete, rendering results as batches finish
        activeJobId = response.jobId;
        const renderedSet = new Set();
        pollAiValidationStatus(response.jobId, pdmNums, renderedSet, 0);

    } catch (error) {
        document.querySelectorAll(`.${AI_LOADING_CLASS}`).forEach(el => el.remove());
        showWarningInCards(pdmNums, 'AI review unavailable');
    }
}

/**
 * Poll the backend for job progress, rendering results as each batch completes.
 * @param {string} jobId
 * @param {string[]} allPdmNums
 * @param {Set<string>} renderedSet - tracks which PDM cards have already been rendered
 * @param {number} pollCount
 */
async function pollAiValidationStatus(jobId, allPdmNums, renderedSet, pollCount) {
    // Bail if this loop was superseded by a new report or clearAiValidation()
    if (jobId !== activeJobId) return;

    if (pollCount >= MAX_POLLS) {
        document.querySelectorAll(`.${AI_LOADING_CLASS}`).forEach(el => el.remove());
        const unrendered = allPdmNums.filter(p => !renderedSet.has(p));
        showWarningInCards(unrendered, 'AI review timed out. Please try again.');
        return;
    }

    try {
        const status = await authManager.aiValidateStatus(jobId);

        // If still pending after 60 seconds, the queue worker may not be running
        if (pollCount >= PENDING_TIMEOUT_POLLS && status.status === 'pending') {
            document.querySelectorAll(`.${AI_LOADING_CLASS}`).forEach(el => el.remove());
            showWarningInCards(allPdmNums, 'AI review is taking longer than expected. The queue worker may not be running.');
            return;
        }

        // Render any newly completed PDMs from this poll
        (status.results || []).forEach(r => {
            if (!renderedSet.has(r.pdmNum)) {
                renderAiErrors(r.pdmNum, r.aiErrors || []);
                renderedSet.add(r.pdmNum);
            }
        });

        if (status.status === 'complete' || status.status === 'failed') {
            document.querySelectorAll(`.${AI_LOADING_CLASS}`).forEach(el => el.remove());
            const unrendered = allPdmNums.filter(p => !renderedSet.has(p));
            if (status.warning && unrendered.length > 0) {
                showWarningInCards(unrendered, status.warning);
            }
            return;
        }

        // Schedule next poll
        setTimeout(() => pollAiValidationStatus(jobId, allPdmNums, renderedSet, pollCount + 1), 2500);

    } catch (error) {
        document.querySelectorAll(`.${AI_LOADING_CLASS}`).forEach(el => el.remove());
        const unrendered = allPdmNums.filter(p => !renderedSet.has(p));
        showWarningInCards(unrendered, 'AI review unavailable');
    }
}

/**
 * Initialize event listeners and toggle. Call once during app setup.
 */
export function initializeAiValidation() {
    // Set up toggle checkbox
    const checkbox = document.getElementById('aiToggleCheckbox');
    if (checkbox) {
        updateToggleState();

        checkbox.addEventListener('change', () => {
            setAiEnabled(checkbox.checked);

            const label = document.querySelector('.ai-toggle-label');
            if (label) {
                label.textContent = checkbox.checked ? 'Disable AI Review' : 'Enable AI Review';
            }

            if (checkbox.checked && qcReportState.isReportGenerated) {
                runAiValidation();
            } else if (!checkbox.checked) {
                clearAiValidation();
            }
        });
    }

    document.addEventListener('reportGenerated', () => {
        runAiValidation();
    });

    document.addEventListener('reportCleared', () => {
        clearAiValidation();
    });
}

