/**
 * Route Configuration for QC Tool
 * Centralized route definitions with metadata for guards and rendering
 */

export const ROUTES = {
    // Public routes (no authentication required)
    login: {
        path: '/login',
        sheetId: 'loginContent',
        title: 'Login',
        public: true,
        showSidebar: false
    },

    // Protected routes (authentication required)
    dashboard: {
        path: '/dashboard',
        sheetId: 'dashboard',
        title: 'Dashboard',
        roles: ['user', 'admin']
    },

    workspace: {
        path: '/workspace',
        sheetId: 'workspace',
        title: 'Workspace',
        roles: ['user', 'admin']
    },

    importSection: {
        path: '/import-section',
        sheetId: 'importSection',
        title: 'Import Section',
        roles: ['user', 'admin']
    },

    qcReport: {
        path: '/qc-report',
        sheetId: 'qcReport',
        title: 'QC Report',
        roles: ['user', 'admin']
    },

    // Admin-only routes
    adminPanel: {
        path: '/admin',
        sheetId: 'adminPanel',
        title: 'Admin Panel',
        roles: ['admin']
    },

    // Dynamic admin route with admin name
    adminProfile: {
        path: '/admin/:adminname',
        sheetId: 'adminPanel',
        title: 'Admin Profile',
        roles: ['admin'],
        dynamic: true
    },

    // Dynamic routes with parameters
    userProfile: {
        path: '/users/:userId',
        sheetId: 'userProfilePage',
        title: 'User Profile',
        roles: ['user', 'admin'],
        dynamic: true
    },

    workspaceProduction: {
        path: '/:accountId/production',
        sheetId: 'workspace',
        title: 'Workspace',
        roles: ['user', 'admin'],
        dynamic: true
    },

    workspaceAccountData: {
        path: '/:accountId/account-data',
        sheetId: 'workspace',
        title: 'Workspace',
        roles: ['user', 'admin'],
        dynamic: true
    },

    workspaceProductionReport: {
        path: '/:accountId/production-report',
        sheetId: 'workspace',
        title: 'Workspace',
        roles: ['user', 'admin'],
        dynamic: true
    },

    workspaceQcReview: {
        path: '/:accountId/qc-review',
        sheetId: 'workspace',
        title: 'Workspace',
        roles: ['user', 'admin'],
        dynamic: true
    },

    workspaceQcReport: {
        path: '/:accountId/qc-report',
        sheetId: 'workspace',
        title: 'Workspace',
        roles: ['user', 'admin'],
        dynamic: true
    }
};

// Window bridge removed - ROUTES is imported directly
