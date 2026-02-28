// Login Page JavaScript Functions
import { authManager } from '../../core/auth/AuthManager.js';
import { router } from '../../core/app.js';
import { APP_VERSION } from '../../core/version.js';

let isLoggingOut = false;
const LOGOUT_BUTTON_SELECTOR = '.admin-logout-btn, .logout-btn-header, #logoutBtn';

function getLogoutButtons(triggerButton = null) {
    const buttons = Array.from(document.querySelectorAll(LOGOUT_BUTTON_SELECTOR));
    if (triggerButton && !buttons.includes(triggerButton)) {
        buttons.push(triggerButton);
    }
    return buttons;
}

function setLogoutButtonsLoading(isLoading, triggerButton = null) {
    const buttons = getLogoutButtons(triggerButton);

    buttons.forEach((button) => {
        if (!(button instanceof HTMLElement)) {
            return;
        }

        if (isLoading) {
            if (!button.dataset.logoutOriginalHtml) {
                button.dataset.logoutOriginalHtml = button.innerHTML;
            }
            if (!button.dataset.logoutOriginalDisabled) {
                button.dataset.logoutOriginalDisabled = String(button.disabled);
            }
            button.disabled = true;
            button.classList.add('is-logging-out');
            button.setAttribute('aria-busy', 'true');
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Logging out...';
            return;
        }

        if (button.dataset.logoutOriginalHtml) {
            button.innerHTML = button.dataset.logoutOriginalHtml;
            delete button.dataset.logoutOriginalHtml;
        }
        if (button.dataset.logoutOriginalDisabled) {
            button.disabled = button.dataset.logoutOriginalDisabled === 'true';
            delete button.dataset.logoutOriginalDisabled;
        }
        button.classList.remove('is-logging-out');
        button.removeAttribute('aria-busy');
    });
}

function setLoginLoadingState(isLoading) {
    const loginBtn = document.querySelector('.login-btn');
    const loginForm = document.querySelector('.login-form');

    if (loginForm) {
        loginForm.setAttribute('aria-busy', isLoading ? 'true' : 'false');
    }

    if (!loginBtn) return;

    if (isLoading) {
        if (!loginBtn.dataset.originalHtml) {
            loginBtn.dataset.originalHtml = loginBtn.innerHTML;
        }
        loginBtn.disabled = true;
        loginBtn.classList.add('loading');
        loginBtn.setAttribute('aria-busy', 'true');
        loginBtn.innerHTML = '<i class="fas fa-spinner fa-spin" aria-hidden="true"></i><span>Signing in...</span>';
        return;
    }

    if (loginBtn.dataset.originalHtml) {
        loginBtn.innerHTML = loginBtn.dataset.originalHtml;
        delete loginBtn.dataset.originalHtml;
    }
    loginBtn.disabled = false;
    loginBtn.classList.remove('loading');
    loginBtn.removeAttribute('aria-busy');
}

/**
 * Toggle password visibility
 */
export function togglePassword() {
    const passwordInput = document.getElementById('password');
    const toggleIcon = document.querySelector('.login-toggle-password');

    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        toggleIcon.classList.remove('fa-eye');
        toggleIcon.classList.add('fa-eye-slash');
    } else {
        passwordInput.type = 'password';
        toggleIcon.classList.remove('fa-eye-slash');
        toggleIcon.classList.add('fa-eye');
    }
}

/**
 * Handle login with credentials
 */
export function handleLogin() {
    const userId = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const errorMessage = document.getElementById('login-error');
    const loginBtn = document.querySelector('.login-btn');

    if (loginBtn?.classList.contains('loading')) {
        return;
    }

    if (!userId || password === '') {
        errorMessage.textContent = 'UserId and password are required.';
        errorMessage.style.display = 'block';
        return;
    }

    errorMessage.style.display = 'none';
    setLoginLoadingState(true);

    Promise.resolve(authManager.login(userId, password))
        .then((result) => {
            if (!result || result.error) {
                const msg = result?.message || 'Login failed: Invalid credentials';
                errorMessage.textContent = msg;
                errorMessage.style.display = 'block';
                return;
            }
            const user = result;

            // Hide login page
            document.getElementById('loginContent').style.display = 'none';

            // Enable all sidebar buttons except adminPanelButton for non-admins
            const sidebarButtons = document.querySelectorAll('.sidebar button');
            sidebarButtons.forEach(button => {
                button.classList.remove('disabled');
                button.disabled = false;
            });

            const qualityControlBtn = document.querySelector('.quality-control-btn');
            if (qualityControlBtn) {
                qualityControlBtn.classList.remove('disabled');
                qualityControlBtn.disabled = false;
                // Event listener already set by eventHandlers.js - no need for onclick
                const nestedButtons = document.querySelectorAll('#qualityControlButtons button');
                nestedButtons.forEach(btn => {
                    btn.classList.remove('disabled');
                    btn.disabled = false;
                });
            }

            const currentUsernameSpan = document.getElementById('currentUsername');
            const currentUserDisplay = document.getElementById('currentUserDisplay');
            if (currentUsernameSpan && currentUserDisplay) {
                currentUsernameSpan.textContent = user.username;
                currentUserDisplay.style.display = 'flex';
            }

            const logoutBtn = document.getElementById('logoutBtn');
            if (logoutBtn) {
                logoutBtn.disabled = false;
                logoutBtn.style.display = 'flex';
            }

            // Dispatch auth:login event - router handles navigation
            document.dispatchEvent(new CustomEvent('auth:login', { detail: user }));
        })
        .catch(() => {
            errorMessage.textContent = 'Login failed: Unable to reach server';
            errorMessage.style.display = 'block';
        })
        .finally(() => {
            setLoginLoadingState(false);
        });
}



/**
 * Handle logout
 */
export async function handleLogout(triggerButton = null) {
    if (isLoggingOut) {
        return;
    }

    isLoggingOut = true;
    setLogoutButtonsLoading(true, triggerButton);

    try {
        try {
            await authManager.logout();
        } catch (e) {
        }

        document.getElementById('loginContent').style.display = 'flex';

        document.querySelectorAll('.blank-sheet, #workspace').forEach(sheet => {
            sheet.style.display = 'none';
        });

        const sidebarButtons = document.querySelectorAll('.sidebar button');
        sidebarButtons.forEach(btn => {
            btn.classList.add('disabled');
            btn.disabled = true;
        });

        // removed console log for button hiding

        const currentUserDisplay = document.getElementById('currentUserDisplay');
        if (currentUserDisplay) {
            currentUserDisplay.style.display = 'none';
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.disabled = true;
            logoutBtn.style.display = 'none';
        }

        // Clear input fields
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
        document.getElementById('login-error').style.display = 'none';

        // Close User Profile Modal (if open)
        if (typeof closeUserProfileModal === 'function') {
            closeUserProfileModal();
        }

        // Reset Page Title
        document.title = `QC Tool ${APP_VERSION}`;

        // Navigate to login
        router.navigate('/login');
    } finally {
        setLogoutButtonsLoading(false, triggerButton);
        isLoggingOut = false;
    }
}

/**
 * Initialize login page on page load
 */
export function initializeLoginPage() {
    const sessionUser = authManager.getUser();

    if (sessionUser) {

        document.getElementById('loginContent').style.display = 'none';

        const sidebarButtons = document.querySelectorAll('.sidebar button');
        sidebarButtons.forEach(button => {
            button.classList.remove('disabled');
            button.disabled = false;
        });

        const qualityControlBtn = document.querySelector('.quality-control-btn');
        if (qualityControlBtn) {
            qualityControlBtn.classList.remove('disabled');
            qualityControlBtn.disabled = false;
            // Event listener already set by eventHandlers.js - no need for onclick
            const nestedButtons = document.querySelectorAll('#qualityControlButtons button');
            nestedButtons.forEach(btn => {
                btn.classList.remove('disabled');
                btn.disabled = false;
            });
        }

        const currentUsernameSpan = document.getElementById('currentUsername');
        const currentUserDisplay = document.getElementById('currentUserDisplay');
        if (currentUsernameSpan && currentUserDisplay) {
            currentUsernameSpan.textContent = sessionUser.username;
            currentUserDisplay.style.display = 'flex';
        }

        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.disabled = false;
            logoutBtn.style.display = 'flex';
        }

        // Router handles navigation based on hash or default route
        // If hash exists, router will handle it; if not, router will redirect to default
    } else {
        document.getElementById('loginContent').style.display = 'flex';

        document.querySelectorAll('.sidebar button').forEach(btn => {
            btn.classList.add('disabled');
            btn.disabled = true;
        });

        // Add Enter key listeners for login
        const loginInputs = ['username', 'password'];
        loginInputs.forEach(id => {
            const input = document.getElementById(id);
            if (input) {
                input.addEventListener('keypress', function (e) {
                    if (e.key === 'Enter') {
                        handleLogin();
                    }
                });
            }
        });
    }
}

// Self-initialization removed — initializeLoginPage() is called from app.js after templates load
