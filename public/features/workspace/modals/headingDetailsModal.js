/* scripts/modals/headingDetailsModal.js */
import { workspaceState } from '../state/workspaceState.js';

export function openHeadingDetailsModalById(headingId) {
    if (!headingId) return;

    // Search for the heading object in the workspaceState
    let heading = findHeadingById(headingId);

    if (!heading) {
        return;
    }

    openHeadingDetailsModal(heading);
}

export function findHeadingById(id) {
    // 1. Search in registry first (primary source)
    if (workspaceState.headingsRegistry && workspaceState.headingsRegistry[id]) {
        return workspaceState.headingsRegistry[id];
    }

    // 2. Search Current PDM Headings (snapshots)
    if (workspaceState.currentPDM && workspaceState.currentPDM.headings) {
        const found = workspaceState.currentPDM.headings.find(h => h.id === id);
        if (found) return found;
    }

    // 4. Search Saved PDMs
    if (workspaceState.savedPDMs) {
        for (const pdm of workspaceState.savedPDMs) {
            if (pdm.headings) {
                const found = pdm.headings.find(h => h.id === id);
                if (found) return found;
            }
        }
    }

    return null;
}

export function openHeadingDetailsModal(heading) {
    // Create Modal HTML Structure
    const overlay = document.createElement('div');
    overlay.className = 'heading-details-modal-overlay';
    overlay.id = 'headingDetailsModalOverlay';

    // Populate Fields (excluding Companies)
    // Format Aliases as a list if present
    let aliasesContent = heading.aliases || '-';
    if (heading.aliases && typeof heading.aliases === 'string') {
        const aliasList = heading.aliases.split(',').map(a => a.trim()).filter(a => a);
        if (aliasList.length > 0) {
            aliasesContent = `<div style="display: flex; flex-direction: column; gap: 4px;">${aliasList.map(a => `<span>${a}</span>`).join('')}</div>`;
        }
    }

    // Format Families as a list if present (new multi-family support)
    let familiesContent = '-';
    if (heading.families && Array.isArray(heading.families) && heading.families.length > 0) {
        // Get unique families only (deduplicate)
        const uniqueFamilies = [...new Set(heading.families.map(f => f.trim()).filter(f => f))];
        if (uniqueFamilies.length > 0) {
            familiesContent = `<div style="display: flex; flex-direction: column; gap: 4px;">${uniqueFamilies.map(f => `<span>${f}</span>`).join('')}</div>`;
        }
    } else if (heading.family) {
        // Fallback to single family if families array not present
        familiesContent = heading.family;
    }

    // Map system status
    const statusMap = {
        'additional': 'Additional',
        'existing': 'Existing',
        'ranked': 'Ranked'
    };
    const classificationStatus = statusMap[heading.status] || 'Additional';

    // Populate Fields (excluding Companies and Updated At)
    const fields = [
        { label: 'Heading Name', value: heading.name },
        { label: 'Heading ID', value: heading.id },
        { label: 'Heading Status', value: heading.originalStatus },
        { label: 'Families', value: familiesContent, isHtml: true },
        { label: 'Category', value: heading.category },
        { label: 'Heading Type', value: heading.headingType },
        { label: 'Classification Status', value: classificationStatus },
        { label: 'Aliases', value: aliasesContent, isHtml: true },
        { label: 'Definition', value: heading.definition }
    ];

    const gridContent = fields.map(field => `
        <div class="heading-detail-item">
            <span class="heading-detail-label">${field.label}</span>
            <span class="heading-detail-value">${field.isHtml ? field.value : (field.value || '-')}</span>
        </div>
    `).join('');

    overlay.innerHTML = `
        <div class="heading-details-modal">
            <div class="heading-details-header">
                <h2>Heading Details</h2>
                <button class="heading-details-close-btn" type="button">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="heading-details-body">
                <div class="heading-details-grid">
                    ${gridContent}
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(overlay);

    const closeBtn = overlay.querySelector('.heading-details-close-btn');
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            closeHeadingDetailsModal();
        });
    }

    // Close on overlay click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) {
            closeHeadingDetailsModal();
        }
    });
}

export function closeHeadingDetailsModal() {
    const overlay = document.getElementById('headingDetailsModalOverlay');
    if (overlay) {
        overlay.remove();
    }
}

// Window bridges removed - exports are imported where needed
