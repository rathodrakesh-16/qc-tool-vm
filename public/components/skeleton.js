function toPositiveInteger(value, fallback) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1) {
        return fallback;
    }
    return Math.floor(parsed);
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

export function setSkeletonBusyState(element, isBusy) {
    if (!element) return;

    element.setAttribute('aria-busy', isBusy ? 'true' : 'false');
    if (isBusy) {
        element.setAttribute('data-skeleton-busy', 'true');
    } else {
        element.removeAttribute('data-skeleton-busy');
    }
}

export function renderAccountCardsSkeleton(container, options = {}) {
    if (!container) return;

    const count = toPositiveInteger(options.count, 8);
    let html = '';

    for (let index = 0; index < count; index++) {
        html += `
            <div class="account-card skeleton-account-card skeleton-shimmer" aria-hidden="true">
                <div class="skeleton-account-header">
                    <span class="skeleton-pill skeleton-block skeleton-w-28"></span>
                    <span class="skeleton-pill skeleton-block skeleton-w-34"></span>
                </div>
                <div class="skeleton-account-body">
                    <span class="skeleton-line skeleton-block skeleton-w-72 skeleton-h-14"></span>
                    <div class="skeleton-account-team">
                        <div class="skeleton-team-row">
                            <span class="skeleton-block skeleton-circle"></span>
                            <span class="skeleton-line skeleton-block skeleton-w-64"></span>
                        </div>
                        <div class="skeleton-team-row">
                            <span class="skeleton-block skeleton-circle"></span>
                            <span class="skeleton-line skeleton-block skeleton-w-56"></span>
                        </div>
                    </div>
                </div>
                <div class="skeleton-account-dates">
                    <span class="skeleton-line skeleton-block skeleton-w-40"></span>
                    <span class="skeleton-line skeleton-block skeleton-w-40"></span>
                </div>
                <div class="skeleton-account-footer">
                    <span class="skeleton-pill skeleton-block skeleton-w-44"></span>
                    <span class="skeleton-pill skeleton-block skeleton-w-32"></span>
                    <span class="skeleton-pill skeleton-block skeleton-w-22"></span>
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
    setSkeletonBusyState(container, true);
}

export function renderDocumentsSkeleton(panel, options = {}) {
    if (!panel) return;

    const title = options.title || 'General SOPs & Documents';
    const count = toPositiveInteger(options.count, 6);
    let rows = '';

    for (let index = 0; index < count; index++) {
        rows += `
            <div class="dashboard-document-card skeleton-document-card skeleton-shimmer" aria-hidden="true">
                <div class="dashboard-document-info">
                    <span class="skeleton-block skeleton-document-icon"></span>
                    <span class="skeleton-line skeleton-block skeleton-w-68"></span>
                </div>
                <div class="dashboard-document-actions">
                    <span class="skeleton-block skeleton-circle"></span>
                </div>
            </div>
        `;
    }

    panel.innerHTML = `
        <h2 class="dashboard-section-title">${escapeHtml(title)}</h2>
        <div class="dashboard-documents-list skeleton-documents-list" aria-hidden="true">
            ${rows}
        </div>
    `;

    setSkeletonBusyState(panel, true);
}

function getAdminWidthClass(columnIndex) {
    const widthMap = [
        'skeleton-w-48',
        'skeleton-w-64',
        'skeleton-w-36',
        'skeleton-w-56',
        'skeleton-w-44',
        'skeleton-w-52',
        'skeleton-w-30',
        'skeleton-w-26'
    ];
    return widthMap[columnIndex] || 'skeleton-w-48';
}

export function renderAdminUsersSkeleton(container, options = {}) {
    if (!container) return;

    const rows = toPositiveInteger(options.rows, 8);
    const columns = toPositiveInteger(options.columns, 8);
    const rowClass = options.rowClass || 'um-table-row';
    const cellClass = options.cellClass || 'um-table-cell';

    let html = '';
    for (let rowIndex = 0; rowIndex < rows; rowIndex++) {
        html += `<div class="${rowClass} skeleton-admin-row skeleton-shimmer" aria-hidden="true">`;
        for (let columnIndex = 0; columnIndex < columns; columnIndex++) {
            html += `
                <div class="${cellClass}">
                    <span class="skeleton-line skeleton-block ${getAdminWidthClass(columnIndex)}"></span>
                </div>
            `;
        }
        html += '</div>';
    }

    container.innerHTML = html;
    setSkeletonBusyState(container, true);
}

export function renderQCReportSkeleton(container, options = {}) {
    if (!container) return;

    const pdmCards = toPositiveInteger(options.pdmCards, 3);
    const validationItems = toPositiveInteger(options.validationItems, 4);

    function summaryPartHtml(rowCount) {
        let rows = '';
        for (let i = 0; i < rowCount; i++) {
            rows += `
                <div class="skeleton-qc-summary-row">
                    <span class="skeleton-line skeleton-block skeleton-w-28"></span>
                    <span class="skeleton-line skeleton-block skeleton-w-56"></span>
                </div>`;
        }
        return `<div class="skeleton-qc-summary-part">${rows}</div>`;
    }

    function pdmCardHtml(rowCount) {
        let rows = '';
        for (let i = 0; i < rowCount; i++) {
            rows += `
                <div class="skeleton-qc-row">
                    <span class="skeleton-line skeleton-block skeleton-w-26"></span>
                    <span class="skeleton-line skeleton-block skeleton-w-52"></span>
                </div>`;
        }
        return `
            <div class="skeleton-qc-card skeleton-shimmer" aria-hidden="true">
                <div class="skeleton-qc-card-header">
                    <span class="skeleton-line skeleton-block skeleton-w-22 skeleton-h-14"></span>
                    <span class="skeleton-pill skeleton-block skeleton-w-22"></span>
                </div>
                <div class="skeleton-qc-card-body">${rows}</div>
            </div>`;
    }

    let cardsHtml = '';
    for (let i = 0; i < pdmCards; i++) {
        cardsHtml += pdmCardHtml(6 + (i % 2));
    }

    let validationHtml = '';
    for (let i = 0; i < validationItems; i++) {
        validationHtml += `
            <div class="skeleton-qc-validation-item">
                <span class="skeleton-line skeleton-block skeleton-w-30 skeleton-h-14"></span>
                <span class="skeleton-line skeleton-block skeleton-w-72"></span>
                <span class="skeleton-line skeleton-block skeleton-w-56"></span>
            </div>`;
    }

    const existing = document.getElementById('reportSkeleton');
    if (existing) existing.remove();

    const skeleton = document.createElement('div');
    skeleton.className = 'skeleton-qc-container skeleton-shimmer';
    skeleton.id = 'reportSkeleton';
    skeleton.setAttribute('aria-hidden', 'true');
    skeleton.innerHTML = `
            <div class="skeleton-qc-main">
                <div class="skeleton-qc-card skeleton-shimmer">
                    <div class="skeleton-qc-card-header">
                        <span class="skeleton-line skeleton-block skeleton-w-26 skeleton-h-14"></span>
                    </div>
                    <div class="skeleton-qc-card-body">
                        ${summaryPartHtml(4)}
                        ${summaryPartHtml(5)}
                        ${summaryPartHtml(4)}
                    </div>
                </div>
                ${cardsHtml}
            </div>
            <div class="skeleton-qc-sidebar">
                <div class="skeleton-qc-sidebar-card">
                    <div class="skeleton-qc-sidebar-header">
                        <span class="skeleton-line skeleton-block skeleton-w-34 skeleton-h-14"></span>
                        <div class="skeleton-qc-sidebar-badges">
                            <span class="skeleton-pill skeleton-block skeleton-w-22"></span>
                            <span class="skeleton-pill skeleton-block skeleton-w-22"></span>
                        </div>
                    </div>
                    <div class="skeleton-qc-sidebar-body">
                        ${validationHtml}
                    </div>
                </div>
            </div>`;

    container.appendChild(skeleton);
    setSkeletonBusyState(container, true);
}

export function removeQCReportSkeleton(container) {
    if (!container) return;

    const skeleton = document.getElementById('reportSkeleton');
    if (skeleton) skeleton.remove();
    setSkeletonBusyState(container, false);
}

export function renderUserProfileSkeleton(container, options = {}) {
    if (!container) return;

    const infoItems = toPositiveInteger(options.infoItems, 6);
    const statsBoxes = toPositiveInteger(options.statsBoxes, 6);

    let infoHtml = '';
    for (let index = 0; index < infoItems; index++) {
        infoHtml += `
            <div class="profile-info-item">
                <span class="skeleton-block skeleton-circle"></span>
                <div class="profile-info-content">
                    <span class="skeleton-line skeleton-block skeleton-w-32"></span>
                    <span class="skeleton-line skeleton-block skeleton-w-56"></span>
                </div>
            </div>
        `;
    }

    let statsHtml = '';
    for (let index = 0; index < statsBoxes; index++) {
        statsHtml += `
            <div class="profile-stat-box">
                <div class="profile-stat-header">
                    <span class="skeleton-block skeleton-circle"></span>
                    <span class="skeleton-line skeleton-block skeleton-w-56"></span>
                </div>
                <span class="skeleton-line skeleton-block skeleton-w-30 skeleton-h-14"></span>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="user-profile-section skeleton-user-profile skeleton-shimmer" aria-hidden="true">
            <div class="user-profile-section-header">
                <span class="skeleton-line skeleton-block skeleton-w-36 skeleton-h-14"></span>
                <span class="skeleton-pill skeleton-block skeleton-w-26"></span>
            </div>
            <div class="user-profile-body skeleton-user-profile-body">
                <div class="profile-details-group">
                    <span class="skeleton-line skeleton-block skeleton-w-44 skeleton-h-14"></span>
                    <div class="profile-info-grid">
                        ${infoHtml}
                    </div>
                </div>
                <div class="profile-divider"></div>
                <div class="profile-stats-group">
                    <span class="skeleton-line skeleton-block skeleton-w-44 skeleton-h-14"></span>
                    <div class="profile-stats-grid">
                        ${statsHtml}
                    </div>
                </div>
                <div class="profile-divider"></div>
                <div class="profile-team-group">
                    <span class="skeleton-line skeleton-block skeleton-w-44 skeleton-h-14"></span>
                    <div class="profile-team-placeholder">
                        <span class="skeleton-line skeleton-block skeleton-w-68"></span>
                    </div>
                </div>
            </div>
        </div>
    `;

    setSkeletonBusyState(container, true);
}
