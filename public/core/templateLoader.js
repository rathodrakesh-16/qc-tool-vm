/**
 * Template Loader - Fetches HTML view files and injects them into the DOM.
 * All views are loaded at startup before event initialization so existing
 * JS code finds DOM elements exactly as before.
 */

const TEMPLATE_VERSION = '0.1.3.2';

/**
 * Ordered list of view files to load.
 * Order must match the original index.html DOM order.
 */
const VIEWS = [
    'views/login.html',
    'views/dashboard.html',
    'views/importSection.html',
    'views/qcReport.html',
    'views/adminPanel.html',
    'views/userProfile.html',
    'views/workspace.html'
];

/**
 * Load a single HTML view file.
 * @param {string} path - Relative path to the view file
 * @returns {Promise<string>} - The HTML content
 */
async function loadView(path) {
    const url = `${path}?v=${TEMPLATE_VERSION}`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Failed to load view: ${path} (${response.status})`);
    }

    return response.text();
}

/**
 * Load all HTML views and inject them into the container.
 * Fetches in parallel but injects in order to preserve DOM structure.
 * @param {string} containerSelector - CSS selector for the container element
 * @returns {Promise<void>}
 */
export async function loadAllTemplates(containerSelector = '.main-content') {
    const container = document.querySelector(containerSelector);

    if (!container) {
        throw new Error(`Template container "${containerSelector}" not found`);
    }

    const startTime = performance.now();

    try {
        // Fetch ALL views in parallel
        const htmlResults = await Promise.all(
            VIEWS.map(path => loadView(path))
        );

        // Clear loading spinner
        container.innerHTML = '';

        // Inject in order (preserves original DOM structure)
        htmlResults.forEach(html => {
            container.insertAdjacentHTML('beforeend', html);
        });

        const elapsed = (performance.now() - startTime).toFixed(0);

    } catch (error) {

        container.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:center;height:100%;flex-direction:column;gap:16px;">
                <h2 style="color:#b91c1c;">Failed to Load Application</h2>
                <p style="color:#64748b;">Please refresh the page. If the issue persists, contact support.</p>
                <button data-action="reload-app" style="padding:8px 24px;cursor:pointer;">
                    Refresh Page
                </button>
            </div>
        `;
        const refreshButton = container.querySelector('[data-action="reload-app"]');
        if (refreshButton) {
            refreshButton.addEventListener('click', () => window.location.reload());
        }

        throw error;
    }
}
