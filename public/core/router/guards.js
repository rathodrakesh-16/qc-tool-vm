/**
 * Route Guards for QC Tool Router
 * Guards are middleware functions that run before a route is rendered
 * Return true to allow, false to block, or a string path to redirect
 */

/**
 * Login redirect guard - redirects away from login if already authenticated
 * @param {Object} context - { path, route, params, user }
 * @returns {boolean|string}
 */
export function loginRedirectGuard(context) {
    const { route, user } = context;

    // Only apply to login route
    if (route.path !== '/login') {
        return true;
    }

    // If user is already logged in, redirect to appropriate page
    if (user) {
        if (user.role === 'admin') {
            const cleanAdminName = user.username.toLowerCase().replace(/\s+/g, '_');
            return `/admin/${encodeURIComponent(cleanAdminName)}`;
        } else {
            if (!user.userId) {
                return '/dashboard';
            }
            return `/users/${encodeURIComponent(user.userId.toLowerCase())}`;
        }
    }

    return true;
}

/**
 * Authentication guard - redirects to login if not authenticated
 * @param {Object} context - { path, route, params, user }
 * @returns {boolean|string}
 */
export function authGuard(context) {
    const { route, user } = context;

    // Skip for public routes
    if (route.public) {
        return true;
    }

    // Check authentication
    if (!user) {
        return '/login';
    }

    return true;
}

/**
 * Role guard - checks if user has required role for the route
 * @param {Object} context - { path, route, params, user }
 * @returns {boolean|string}
 */
export function roleGuard(context) {
    const { route, user, params } = context;

    // Skip for public routes or routes without role requirements
    if (route.public || !route.roles || route.roles.length === 0) {
        return true;
    }

    // Check if user has required role
    if (!route.roles.includes(user.role)) {
        // UX-only redirect; backend authorization remains the security boundary.
        return '/dashboard';
    }

    if (route.key === 'userProfile' && user.role !== 'admin') {
        const requestedUserId = (params?.userId || '').toLowerCase();
        const sessionUserId = (user.userId || '').toLowerCase();
        if (requestedUserId && sessionUserId && requestedUserId !== sessionUserId) {
            return `/users/${encodeURIComponent(sessionUserId)}`;
        }
    }

    return true;
}

// Window bridges removed - guards are imported directly
