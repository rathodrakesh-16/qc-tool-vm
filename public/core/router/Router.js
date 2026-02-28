import { ROUTES } from './routes.js';
import { authManager } from '../auth/AuthManager.js';
import { APP_VERSION } from '../version.js';
import { renderUserProfilePage } from '../../pages/user/userProfilePage.js';
import { renderAdminDashboard, initializeAdminPanel } from '../../features/admin/adminDashboard.js';
import { initializeTable } from '../../features/qualityControl/importSection/importSection.js';
import { initializeDashboard } from '../../features/dashboard/dashboard.js';

/**
 * Router Class for QC Tool
 * Handles history-based SPA routing with guards/middleware support
 */

export class Router {
    constructor(routes, options = {}) {
        this.routes = routes;
        this.guards = [];
        this.currentRoute = null;
        this.params = {};

        // Options with defaults
        this.options = {
            defaultRoute: '/dashboard',
            loginRoute: '/login',
            ...options
        };

        // Bind methods
        this.handleRoute = this.handleRoute.bind(this);
        this.navigate = this.navigate.bind(this);
    }

    /**
     * Initialize the router
     */
    init() {
        // Listen for browser history navigation (back/forward)
        window.addEventListener('popstate', this.handleRoute);

        // Listen for auth events
        document.addEventListener('auth:logout', () => {
            this.navigate(this.options.loginRoute);
        });

        document.addEventListener('auth:login', (e) => {
            this.handlePostLogin(e.detail);
        });

        // Handle initial route
        this.handleRoute();

    }

    /**
     * Add a route guard (middleware)
     * @param {Function} guardFn - Function that returns true to allow, false to block, or string to redirect
     */
    addGuard(guardFn) {
        this.guards.push(guardFn);
    }

    /**
     * Navigate to a route programmatically
     * @param {string} path - The route path (e.g., '/dashboard' or '/users/:userId')
     * @param {Object} params - Optional params for dynamic routes
     */
    navigate(path, params = {}) {
        let targetPath = path.startsWith('/') ? path : `/${path}`;

        // Replace params in path
        Object.keys(params).forEach(key => {
            targetPath = targetPath.replace(`:${key}`, encodeURIComponent(params[key]));
        });

        if (window.location.pathname !== targetPath) {
            window.history.pushState({}, '', targetPath);
            this.handleRoute();
        } else {
            // Path didn't change but we still want to process the route
            this.handleRoute();
        }
    }

    /**
     * Main route handler - called on navigation and history changes
     */
    handleRoute() {
        // Parse current path
        const path = window.location.pathname || '/';

        // Handle root path - check if user is logged in
        if (path === '/') {
            const user = authManager.getUser();
            if (user) {
                this.navigate(this.options.defaultRoute);
            } else {
                this.navigate(this.options.loginRoute);
            }
            return;
        }


        // Find matching route
        const { route, params } = this.matchRoute(path);

        if (!route) {
            this.handleNotFound(path);
            return;
        }

        // Store params
        this.params = params;

        // Run guards
        const guardContext = {
            path,
            route,
            params,
            user: authManager.getUser()
        };

        for (const guard of this.guards) {
            const result = guard(guardContext);
            if (result === false) {
                return;
            }
            if (typeof result === 'string') {
                // Guard returned a redirect path
                this.navigate(result);
                return;
            }
        }

        // Update current route
        this.currentRoute = route;

        // Render the route
        this.renderRoute(route, params);
    }

    /**
     * Match a path to a route config
     * @param {string} path - The URL path
     * @returns {Object} - { route, params }
     */
    matchRoute(path) {
        // First try exact match
        for (const [key, route] of Object.entries(this.routes)) {
            if (route.path === path) {
                return { route: { ...route, key }, params: {} };
            }
        }

        // Then try dynamic routes
        for (const [key, route] of Object.entries(this.routes)) {
            if (route.dynamic) {
                const params = this.matchDynamicRoute(route.path, path);
                if (params) {
                    return { route: { ...route, key }, params };
                }
            }
        }

        // No match found
        return { route: null, params: {} };
    }

    /**
     * Match a dynamic route pattern against a path
     * @param {string} pattern - Route pattern like '/users/:userId'
     * @param {string} path - Actual path like '/users/john.doe@company.com'
     * @returns {Object|null} - Extracted params or null if no match
     */
    matchDynamicRoute(pattern, path) {
        // Convert pattern to regex
        // /users/:userId -> /users/([^/]+)
        const regexPattern = pattern.replace(/:[^/]+/g, '([^/]+)');
        const regex = new RegExp(`^${regexPattern}$`);

        const match = path.match(regex);
        if (!match) return null;

        // Extract param names from pattern
        const paramNames = [];
        const paramRegex = /:([^/]+)/g;
        let paramMatch;
        while ((paramMatch = paramRegex.exec(pattern)) !== null) {
            paramNames.push(paramMatch[1]);
        }

        // Build params object
        const params = {};
        paramNames.forEach((name, index) => {
            params[name] = decodeURIComponent(match[index + 1]);
        });

        return params;
    }

    /**
     * Render a matched route
     * @param {Object} route - The route config
     * @param {Object} params - Extracted URL params
     */
    renderRoute(route, params) {
        // Update document title
        document.title = route.title ? route.title : `QC Tool ${APP_VERSION}`;

        // Handle login route specially
        if (route.path === '/login') {
            this.showLoginPage();
            return;
        }

        // Handle normal sheets
        if (route.sheetId) {
            this.showSheet(route.sheetId, params, route);
        }

        // Dispatch route change event
        const event = new CustomEvent('route:change', {
            detail: { route, params }
        });
        document.dispatchEvent(event);
    }

    /**
     * Show the login page
     */
    showLoginPage() {
        // Hide all sheets
        document.querySelectorAll('.blank-sheet, #workspace, #userProfilePage').forEach(sheet => {
            sheet.style.display = 'none';
            sheet.classList.add('hidden');
            sheet.classList.remove('active');
        });

        // Show login content
        const loginContent = document.getElementById('loginContent');
        if (loginContent) {
            loginContent.style.display = 'flex';
        }

        // Disable sidebar buttons
        document.querySelectorAll('.sidebar button').forEach(btn => {
            btn.classList.add('disabled');
            btn.disabled = true;
        });

        // Hide user display
        const currentUserDisplay = document.getElementById('currentUserDisplay');
        if (currentUserDisplay) {
            currentUserDisplay.style.display = 'none';
        }

        // Hide logout button
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.style.display = 'none';
        }
    }

    /**
     * Show a sheet by ID
     * @param {string} sheetId - DOM element ID
     * @param {Object} params - Route params for dynamic routes
     * @param {Object} route - Route config
     */
    showSheet(sheetId, params = {}, route = {}) {

        // Hide login content
        const loginContent = document.getElementById('loginContent');
        if (loginContent) {
            loginContent.style.display = 'none';
        }

        // Hide all sheets
        const sheets = document.querySelectorAll('.blank-sheet, #userProfilePage, #workspace');
        sheets.forEach(sheet => {
            sheet.style.display = 'none';
            sheet.classList.add('hidden');
            sheet.classList.remove('active');
        });

        // Show target sheet
        const targetSheet = document.getElementById(sheetId);
        if (targetSheet) {
            targetSheet.classList.remove('hidden');
            targetSheet.classList.add('active');
            targetSheet.style.display = (sheetId === 'workspace') ? 'flex' : 'block';
        } else {
            return;
        }

        // Store in localStorage for persistence (except special pages)
        if (!['adminPanel', 'userProfilePage', 'loginContent'].includes(sheetId)) {
            localStorage.setItem('lastSheet', sheetId);
        }

        // Update sidebar active state
        this.updateSidebar(sheetId);

        // Dispatch showSheet event for feature initialization
        document.dispatchEvent(new CustomEvent('showSheet', { detail: sheetId }));

        // Handle dynamic route callbacks
        this.handleDynamicRouteCallback(sheetId, params);

        // Handle special sheet initializations
        this.handleSheetInit(sheetId, route);
    }

    /**
     * Handle callbacks for dynamic routes
     */
    handleDynamicRouteCallback(sheetId, params) {
        // User profile page
        if (sheetId === 'userProfilePage' && params.userId) {
            renderUserProfilePage(params.userId);
        }

        // Admin profile page (dynamic admin route)
        if (sheetId === 'adminPanel' && params.adminname) {
            // The admin panel can use router.getParams().adminname to get the admin name
        }
    }

    /**
     * Handle special sheet initializations
     */
    handleSheetInit(sheetId, route) {
        // Admin panel initialization
        if (sheetId === 'adminPanel') {
            try {
                renderAdminDashboard();
            } catch (e) {
                initializeAdminPanel();
            }
        }

        // Import section initialization
        if (sheetId === 'importSection') {
            initializeTable();
        }

        // Dashboard initialization
        if (sheetId === 'dashboard') {
            initializeDashboard();
        }
    }

    /**
     * Update sidebar active state
     */
    updateSidebar(sheetId) {
        // Remove all active states
        document.querySelectorAll('.sidebar button').forEach(btn => {
            btn.classList.remove('active');
        });

        // Map sheetId to route path for matching
        const sheetToRoute = {
            'dashboard': '/dashboard',
            'workspace': '/workspace',
            'importSection': '/import-section',
            'qcReport': '/qc-report',
            'adminPanel': '/admin'
        };

        const routePath = sheetToRoute[sheetId];
        if (!routePath) return;

        const findButtonByRoute = (path) => {
            if (path === '/dashboard') {
                return Array.from(document.querySelectorAll('.sidebar > div > button'))
                    .find(btn => btn.textContent.includes('Dashboard')) || null;
            }

            if (path === '/workspace') {
                return document.querySelector('#workspaceButtons .nested-btn');
            }

            if (path === '/import-section' || path === '/qc-report') {
                const qcNestedButtons = document.querySelectorAll('#qualityControlButtons .nested-btn');
                return path === '/import-section'
                    ? (qcNestedButtons[0] || null)
                    : (qcNestedButtons[1] || null);
            }

            if (path === '/admin') {
                return Array.from(document.querySelectorAll('.sidebar button'))
                    .find(btn => btn.textContent.includes('Admin')) || null;
            }

            return null;
        };

        // Primary lookup via explicit route metadata on sidebar buttons.
        let targetButton = document.querySelector(`.sidebar button[data-route="${routePath}"]`);

        // Secondary lookup for templates without data-route attributes.
        if (!targetButton) {
            targetButton = findButtonByRoute(routePath);
        }

        if (!targetButton) return;

        targetButton.classList.add('active');

        // Expand parent nested container if needed
        const nestedContainer = targetButton.closest('.nested-buttons');
        if (nestedContainer) {
            nestedContainer.classList.add('visible');
            nestedContainer.style.display = 'flex';
            const toggleButton = nestedContainer.previousElementSibling;
            const toggleIcon = toggleButton?.querySelector('.toggle-icon');
            if (toggleIcon) {
                toggleIcon.classList.remove('collapsed');
            }
        }
    }

    /**
     * Handle 404 - route not found
     */
    handleNotFound(path) {
        // Redirect to dashboard
        this.navigate(this.options.defaultRoute);
    }

    /**
     * Handle post-login navigation
     */
    handlePostLogin(user) {
        if (!user) return;

        if (user.role === 'admin') {
            // Navigate to admin profile with admin's username
            const cleanAdminName = user.username.toLowerCase().replace(/\s+/g, '_');
            this.navigate('/admin/:adminname', { adminname: cleanAdminName });
        } else {
            if (!user.userId) {
                this.navigate('/dashboard');
                return;
            }
            this.navigate('/users/:userId', { userId: user.userId.toLowerCase() });
        }
    }

    /**
     * Get current route params
     */
    getParams() {
        return this.params;
    }

    /**
     * Get current route
     */
    getCurrentRoute() {
        return this.currentRoute;
    }
}

// Window bridge removed - Router is imported directly
